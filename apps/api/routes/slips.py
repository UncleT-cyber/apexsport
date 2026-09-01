from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from domain.slips.slip import BetSlip, SlipSelection
from scanner.pipeline.state import get_scanner_state
from slips.optimizer import optimize_slip
from slips.validator import validate_slip
from slips.store import save_slip, get_slip, list_slips as store_list
from sportsbooks.registry import registry as sportsbook_registry

router = APIRouter(prefix="/api/slips", tags=["slips"])

# ─── DRAFT SLIP WORKSPACE (cart) — current/uncommitted vs persisted ─────────
# The Current Slip is the user's working cart. Persisted Slips are finalized records.
# Direction: Prediction → SlipSelection → Current Slip → Validation → Optimization → Persisted Slip
from slips.draft import (
    get_draft_ids as _draft_ids,
    add_to_draft as _draft_add,
    remove_from_draft as _draft_remove,
    clear_draft as _draft_clear,
    validate_prediction_for_draft as _validate_for_draft,
    build_current_slip as _build_current,
)
from core.events.bus import event_bus, EventType  # for telemetry if available

def _emit_telemetry(event: str, data: dict):
    try:
        # fire-and-forget
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # schedule async emit if bus is async
                pass
        except Exception:
            pass
        # also try direct sync via event_bus if it has emit
        if hasattr(event_bus, "emit"):
            # event_bus.emit is often async
            pass
    except Exception:
        pass
    # fallback: log to scanner state events for observability
    try:
        from scanner.pipeline.state import get_scanner_state
        st = get_scanner_state()
        # best-effort add event
        st._add_event("SLIP", f"{event}: {data.get('prediction_id') or data.get('slip_id', '')}", None, "INFO")
    except Exception:
        pass

# Legacy in-memory for backward compat — now delegates to store
# _slips kept as alias to store for any direct imports, but all writes go through store

class CreateSlipRequest(BaseModel):
    selections: list[SlipSelection]
    sportsbook: Optional[str] = None
    booking_code: Optional[str] = None  # external reference only

class CreateFromPredictionsRequest(BaseModel):
    prediction_ids: list[str]
    sportsbook: Optional[str] = None

def _predictions_source(sport: Optional[str] = None) -> list[dict]:
    """Unified source: prediction_store (permanent) + scanner state (live), deduped by prediction id."""
    # Try prediction_store first — permanent
    try:
        from intelligence.prediction_store import list_predictions
        preds = list_predictions(limit=50, sport=sport)
    except Exception:
        preds = []
    # Merge scanner recent for anything not yet in store (same scan, before persist)
    try:
        state = get_scanner_state()
        recent = state.state.recent_predictions
        if sport:
            recent = [p for p in recent if p.get("sport") == sport]
        # dedup by id/fixture_id
        seen = {p.get("id") or p.get("fixture_id") for p in preds}
        for p in recent:
            pid = p.get("id") or p.get("fixture_id")
            if pid not in seen:
                preds.append(p)
                seen.add(pid)
    except Exception:
        pass
    return preds

def _to_selection(p: dict) -> SlipSelection:
    # No hardcoded odds — use actual snapshot price; if missing, keep None and validator will flag UNAVAILABLE
    return SlipSelection(
        event_id=p["fixture_id"],
        event_label=p.get("fixture_label", p["fixture_id"]),
        market=p.get("market") or "MATCH_RESULT",
        selection=p.get("selection") or "HOME",
        odds=p.get("market_odds"),
        probability=p.get("probability"),
        calibrated_probability=p.get("calibrated_probability"),
        edge=p.get("edge"),
        confidence=p.get("confidence"),
        prediction_id=p.get("id") or p.get("fixture_id"),
        sport=p.get("sport"),
        competition=p.get("competition"),
        kickoff_at=str(p.get("kickoff_at")) if p.get("kickoff_at") else None,
        model_used=p.get("model_used"),
    )

@router.post("")
def create_slip(req: CreateSlipRequest):
    if req.booking_code is not None:
        if len(req.booking_code.strip()) < 3:
            return {"error": "invalid booking code — must be supplied by sportsbook", "code": 400}
    slip = BetSlip(selections=req.selections, sportsbook=req.sportsbook, booking_code=req.booking_code.strip() if req.booking_code else None)
    # frozen-safe
    slip = slip.model_copy(update={"total_odds": slip.compute_total_odds()})
    ok, errors = validate_slip(slip)
    if not ok:
        return {"error": "slip validation failed", "reasons": errors, "slip": slip.model_dump()}
    save_slip(slip)
    return slip.model_dump()

@router.post("/from-prediction-ids")
def create_from_ids(req: CreateFromPredictionsRequest):
    """Create canonical slip from explicit prediction IDs — fully traceable.

    Direction: Prediction → SlipSelection → Slip (never provider-specific prediction).
    Prediction ID is stable throughout downstream flow.
    """
    preds_map = {p.get("id"): p for p in _predictions_source()}
    # also map by fixture_id
    for p in _predictions_source():
        preds_map[p.get("fixture_id")] = p
    selections = []
    missing = []
    for pid in req.prediction_ids:
        p = preds_map.get(pid)
        if not p:
            missing.append(pid)
            continue
        selections.append(_to_selection(p))
    if missing:
        raise HTTPException(400, f"predictions not found: {missing}")
    slip = BetSlip(selections=selections, sportsbook=req.sportsbook)
    slip = slip.model_copy(update={"total_odds": slip.compute_total_odds()})
    ok, errors = validate_slip(slip)
    slip = slip.model_copy(update={"status": "validated" if ok else "draft"})
    save_slip(slip)
    return {"slip": slip.model_dump(), "valid": ok, "validation_errors": errors}

# ─── CURRENT SLIP (cart) ENDPOINTS ──────────────────────────────────────────
@router.get("/current")
def get_current_slip(sportsbook: Optional[str] = None):
    """Get current working slip (cart) — uncommitted selection state."""
    slip, meta = _build_current(sportsbook)
    # Enrich selections with prediction snapshot staleness
    staleness = []
    for s in slip.selections:
        try:
            from intelligence.prediction_store import get_prediction
            pred = get_prediction(s.prediction_id or s.event_id)
            if pred:
                from slips.draft import is_stale
                stale, reason = is_stale(pred)
                if stale:
                    staleness.append({"prediction_id": s.prediction_id, "reason": reason})
        except Exception:
            pass
    return {
        "slip": slip.model_dump(),
        "meta": meta,
        "count": len(slip.selections),
        "staleness": staleness,
        "state": "DRAFT" if slip.selections else "EMPTY",
    }

@router.post("/current/add")
def add_to_current(prediction_id: str = Query(..., description="prediction_id or fixture_id")):
    """Add Prediction to current slip (cart) — validates eligibility."""
    # Resolve prediction
    pred = None
    try:
        from intelligence.prediction_store import get_prediction
        pred = get_prediction(prediction_id)
    except Exception:
        pass
    if not pred:
        # also try _predictions_source
        for p in _predictions_source():
            if p.get("id") == prediction_id or p.get("fixture_id") == prediction_id:
                pred = p
                break
    if not pred:
        raise HTTPException(404, f"Prediction {prediction_id} not found — cannot add to slip")
    ok, reason = _validate_for_draft(pred, set(_draft_ids()))
    if not ok:
        raise HTTPException(400, reason or "Prediction not eligible for slip")
    added, err = _draft_add(pred.get("id") or prediction_id)
    if not added:
        raise HTTPException(400, err or "Already in slip")
    _emit_telemetry("PREDICTION_SELECTED", {"prediction_id": pred.get("id"), "fixture_id": pred.get("fixture_id")})
    slip, meta = _build_current()
    return {"added": prediction_id, "slip": slip.model_dump(), "meta": meta, "count": len(slip.selections)}

@router.post("/current/remove")
def remove_from_current(prediction_id: str = Query(..., description="prediction_id to remove")):
    ok = _draft_remove(prediction_id)
    if not ok:
        # try also by fixture_id
        for pid in list(_draft_ids()):
            try:
                from intelligence.prediction_store import get_prediction
                p = get_prediction(pid)
                if p and (p.get("fixture_id") == prediction_id):
                    _draft_remove(pid)
                    ok = True
                    break
            except Exception:
                pass
    if not ok:
        raise HTTPException(404, f"Prediction {prediction_id} not in current slip")
    _emit_telemetry("PREDICTION_REMOVED", {"prediction_id": prediction_id})
    slip, meta = _build_current()
    return {"removed": prediction_id, "slip": slip.model_dump(), "meta": meta, "count": len(slip.selections)}

@router.post("/current/clear")
def clear_current():
    _draft_clear()
    _emit_telemetry("SLIP_CLEARED", {})
    slip, meta = _build_current()
    return {"cleared": True, "slip": slip.model_dump(), "meta": meta}

@router.post("/current/validate")
def validate_current():
    """Validate current slip — exposes SLIP_VALIDATION_STARTED/COMPLETED telemetry."""
    _emit_telemetry("SLIP_VALIDATION_STARTED", {"count": len(_draft_ids())})
    slip, meta = _build_current()
    # validator already in meta, but re-run explicit
    from slips.validator import validate_slip as _val
    ok, errors = _val(slip)
    _emit_telemetry("SLIP_VALIDATION_COMPLETED", {"valid": ok, "errors": errors})
    return {"valid": ok, "errors": errors, "slip": slip.model_dump(), "meta": meta, "correlation": meta.get("correlation"), "aggregate_risk": meta.get("aggregate_risk")}

@router.post("/current/build")
def build_current(sportsbook: Optional[str] = None):
    """Build canonical persisted Slip from current selections — validate → correlation → optimizer → persist → preview.

    If validation changes slip (e.g., removes correlated leg), explain clearly.
    """
    _emit_telemetry("SLIP_VALIDATION_STARTED", {"count": len(_draft_ids())})
    _emit_telemetry("SLIP_OPTIMIZATION_STARTED", {"count": len(_draft_ids())})
    selections = _build_current()[0].selections
    if not selections:
        raise HTTPException(400, "Current slip is empty — add predictions first (ADD TO SLIP)")
    # Use optimizer with correlation-aware combination
    from slips.optimizer import optimize_slip as _opt
    candidates = selections
    slip_opt, report = _opt(candidates, max_selections=5, max_correlation=0.70, min_edge=0.03)
    # Explain what changed (never silently remove)
    removed = []
    orig_ids = {s.prediction_id for s in candidates}
    kept_ids = {s.prediction_id for s in slip_opt.selections}
    for pid in orig_ids - kept_ids:
        reason = next((r["reason"] for r in report.get("rejected", []) if r.get("event_id") in pid or pid in r.get("event_id","")), "filtered by optimizer (edge/correlation/risk)")
        removed.append({"prediction_id": pid, "reason": reason})
    # Persist if has selections
    if not slip_opt.selections:
        _emit_telemetry("SLIP_OPTIMIZATION_COMPLETED", {"chosen": 0, "removed": removed})
        return {"error": "Optimizer filtered all candidates — no valid slip could be built", "rejected": report.get("rejected", []), "removed": removed, "report": report}
    if sportsbook:
        slip_opt = slip_opt.model_copy(update={"sportsbook": sportsbook})
    ok, errors = __import__("slips.validator", fromlist=["validate_slip"]).validate_slip(slip_opt)
    if not ok:
        # still persist as draft if validation failed but show errors
        slip_opt = slip_opt.model_copy(update={"status": "draft"})
    else:
        slip_opt = slip_opt.model_copy(update={"status": "validated"})
    save_slip(slip_opt)
    _emit_telemetry("SLIP_CREATED", {"slip_id": slip_opt.id, "count": len(slip_opt.selections), "total_odds": slip_opt.total_odds})
    _emit_telemetry("SLIP_OPTIMIZATION_COMPLETED", {"chosen": len(slip_opt.selections), "removed": removed, "correlation": report.get("correlation")})
    # Clear draft after successful build (cart → persisted)
    _draft_clear()
    return {
        "slip": slip_opt.model_dump(),
        "report": report,
        "removed": removed,
        "explanation": f"Built canonical Slip {slip_opt.id} from {len(candidates)} selections → {len(slip_opt.selections)} kept. Removed: {', '.join(r['prediction_id'][:8]+':'+r['reason'] for r in removed) if removed else 'none'}",
        "valid": ok,
        "validation_errors": errors,
    }

@router.get("")
def list_slips_api(limit: int = 20):
    slips = store_list(limit=limit)
    return [s.model_dump() for s in slips]

@router.get("/from-predictions")
async def slips_from_predictions(sport: Optional[str] = None):
    preds = _predictions_source(sport)
    preds = preds[:8]
    selections = [_to_selection(p) for p in preds if p.get("is_value")]
    if not selections and preds:
        selections = [_to_selection(preds[0])]
    return {"selections": [s.model_dump() for s in selections], "sport": sport or "all"}
@router.get("/optimize")
async def optimize_get(
    sport: Optional[str] = None,
    max_selections: int = 5,
    max_correlation: float = 0.7,
    min_edge: float = 0.03,
    min_confidence: float = 0.4,
    sportsbook: Optional[str] = None,
):
    """Optimizer PREVIEW — deterministic, no side-effects, does NOT persist.

    GET = read-only preview (like ApexLoop SignalStore preview).
    POST = persist optimized slip. This prevents polling from creating duplicate slips.
    """
    preds = _predictions_source(sport)
    candidates = [_to_selection(p) for p in preds]
    slip, report = optimize_slip(
        candidates,
        max_selections=max_selections,
        max_correlation=max_correlation,
        min_edge=min_edge,
        min_confidence=min_confidence,
    )
    if sportsbook:
        slip = slip.model_copy(update={"sportsbook": sportsbook})
    ok, errors = validate_slip(slip)
    report["valid"] = ok
    report["validation_errors"] = errors
    # GET does NOT persist — returns ephemeral preview (no duplicate BetSlip ids per poll)
    return {"slip": slip.model_dump(), "report": report, "sport": sport or "all", "persisted": False}


@router.post("/optimize")
async def optimize(
    sport: Optional[str] = None,
    max_selections: int = 5,
    max_correlation: float = 0.7,
    min_edge: float = 0.03,
    min_confidence: float = 0.4,
    sportsbook: Optional[str] = None,
):
    """Portfolio optimizer — explainable, correlation-aware, exposure limits. Persists result on POST only."""
    preds = _predictions_source(sport)
    candidates = [_to_selection(p) for p in preds]
    slip, report = optimize_slip(
        candidates,
        max_selections=max_selections,
        max_correlation=max_correlation,
        min_edge=min_edge,
        min_confidence=min_confidence,
    )
    if sportsbook:
        slip = slip.model_copy(update={"sportsbook": sportsbook})
    ok, errors = validate_slip(slip)
    report["valid"] = ok
    report["validation_errors"] = errors
    # persist optimized slip if it has selections — POST only
    if slip.selections:
        slip = slip.model_copy(update={"status": "validated" if ok else "draft"})
        save_slip(slip)
    return {"slip": slip.model_dump(), "report": report, "sport": sport or "all", "persisted": bool(slip.selections)}

@router.get("/odds")
async def odds_normalized(sport: str = "football", event_id: Optional[str] = None):
    """Normalized canonical odds (provider → canonical)."""
    from ingestion.collectors.odds import collect_odds
    odds = await collect_odds(event_id=event_id, sport=sport)
    return {"odds": odds, "count": len(odds), "sport": sport}

@router.get("/export/preview")
async def export_preview(sport: Optional[str] = None, sportsbook: str = "sportybet"):
    """Preview sportsbook formatting for optimized slip without persisting."""
    preds = _predictions_source(sport)
    candidates = [_to_selection(p) for p in preds]
    slip, report = optimize_slip(candidates)
    adapter = sportsbook_registry.get(sportsbook.lower())
    if not adapter:
        return {"error": f"unknown sportsbook {sportsbook}"}
    return {"formatted": adapter.format_slip(slip), "report": report, "sport": sport or "all"}

# Detail + export must be after /export/preview to avoid route conflict with {slip_id}
@router.get("/{slip_id}")
def get_slip_api(slip_id: str):
    slip = get_slip(slip_id)
    if not slip:
        raise HTTPException(404, f"slip {slip_id} not found")
    return slip.model_dump()

@router.post("/{slip_id}/validate")
def validate_slip_api(slip_id: str):
    slip = get_slip(slip_id)
    if not slip:
        raise HTTPException(404, f"slip {slip_id} not found")
    ok, errors = validate_slip(slip)
    return {"valid": ok, "errors": errors, "slip": slip.model_dump()}

@router.delete("/{slip_id}")
def delete_slip_api(slip_id: str):
    from slips.store import delete_slip
    ok = delete_slip(slip_id)
    if not ok:
        raise HTTPException(404, f"slip {slip_id} not found")
    return {"deleted": slip_id}

@router.post("/{slip_id}/export")
def export_slip(slip_id: str, sportsbook: str = Query(..., description="sportybet|bet9ja|betway|generic|draftkings|fanduel")):
    slip = get_slip(slip_id)
    if not slip:
        return {"error": "slip not found", "code": 404}
    adapter = sportsbook_registry.get(sportsbook.lower())
    if not adapter:
        return {"error": f"unknown sportsbook {sportsbook}", "known": [b.name for b in sportsbook_registry.all()], "status": "NOT CONNECTED"}
    # Adapter exists but may not support execution/share — check capability
    try:
        formatted = adapter.format_slip(slip)
    except Exception as e:
        return {"error": f"EXPORT NOT AVAILABLE: {e}", "status": "EXPORT NOT AVAILABLE"}
    _emit_telemetry("SLIP_EXPORT_COMPLETED", {"slip_id": slip_id, "sportsbook": sportsbook})
    return formatted

@router.get("/{slip_id}/export/json")
def export_json(slip_id: str):
    """Canonical JSON export — portable, not provider-specific."""
    slip = get_slip(slip_id)
    if not slip:
        raise HTTPException(404, f"slip {slip_id} not found")
    _emit_telemetry("SLIP_EXPORT_STARTED", {"slip_id": slip_id, "format": "json"})
    data = slip.model_dump()
    # Include provenance: each selection's prediction snapshot already in slip
    return {"format": "canonical_json", "slip": data, "exported_at": __import__("core.time", fromlist=["utcnow"]).utcnow().isoformat(), "note": "Canonical Slip — provider formatting at edge is separate"}

@router.get("/{slip_id}/export/pdf")
def export_pdf(slip_id: str):
    """PDF/printable export — returns print-optimized HTML (primary human-readable). Use browser Print to PDF."""
    from fastapi.responses import HTMLResponse
    slip = get_slip(slip_id)
    if not slip:
        raise HTTPException(404, f"slip {slip_id} not found")
    _emit_telemetry("SLIP_EXPORT_STARTED", {"slip_id": slip_id, "format": "pdf"})
    # Reuse same ticket HTML as frontend print — generate server-side
    selections_html = "".join([
        f"""
        <div style=\"border:1px solid #000;padding:6px;margin:6px 0;background:#f8f8f8\">
          <div style=\"font-weight:bold;font-size:10px\">LEG {i+1} — {s.sport or ''} • {s.competition or ''}</div>
          <div style=\"font-weight:bold\">{s.event_label}</div>
          <div style=\"display:flex;justify-content:space-between;font-size:10px\"><span>{s.market} → {s.selection}</span><span>{s.odds:.2f}</span></div>
          <div style=\"font-size:9px;color:#555\">pred {s.prediction_id or ''} • cal {(s.calibrated_probability or 0)*100:.1f}% • edge {(s.edge or 0)*100:.1f}%</div>
        </div>
        """
        for i, s in enumerate(slip.selections)
    ])
    html = f"""
    <html><head><title>Apex Sports — Slip {slip.id}</title>
    <style>@page{{size:80mm auto;margin:8mm}}body{{font-family:monospace;font-size:10px;color:#000;background:#fff;width:72mm;margin:0 auto}}
    .header{{text-align:center;border-bottom:2px dashed #000;padding-bottom:6px;margin-bottom:8px}}.title{{font-weight:bold;font-size:13px;letter-spacing:1px}}.sub{{font-size:8px;color:#555}}
    .totalBox{{border:1px solid #000;padding:6px;margin-top:8px;background:#f0f0f0}}</style></head>
    <body>
      <div class=\"header\"><div class=\"title\">APEX SPORTS</div><div class=\"sub\">INTELLIGENCE • NOT A SPORTSBOOK</div><div class=\"sub\">Slip {slip.id} • {slip.status} • {slip.sportsbook or 'CANONICAL'}</div></div>
      {selections_html}
      <div class=\"totalBox\"><div style=\"display:flex;justify-content:space-between;font-weight:bold\"><span>COMBINED ODDS</span><span>{slip.total_odds or slip.compute_total_odds():.2f}</span></div>
      <div style=\"font-size:9px;color:#555\">ID {slip.id} • {slip.created_at} • Risk {slip.risk_level or ''}</div></div>
      <div style=\"text-align:center;font-size:7px;color:#555;margin-top:8px;border-top:1px dashed #000;padding-top:6px\">Prediction → SlipSelection → Slip → SportsbookSlip<br/>Canonical Slip — provider adapters at edge only</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>
    """
    _emit_telemetry("SLIP_EXPORT_COMPLETED", {"slip_id": slip_id, "format": "pdf"})
    return HTMLResponse(content=html, media_type="text/html")
