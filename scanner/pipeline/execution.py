"""Pipeline execution — canonical contracts, provenance, no fake data.

Provenance chain:
  MarketSnapshot → FeatureSnapshot → Specialist (AgentInput→AgentOutput) → Ensemble → Calibration → Value → Risk → Prediction

Every Prediction retains FeatureSnapshot + MarketSnapshot actually used.
No hardcoded fixtures, no uniform random odds, no mock data in prod paths.
"""
from __future__ import annotations
import asyncio
from typing import Optional

from scanner.pipeline.state import get_scanner_state
from market.value import assess_value
from risk.engine import assess_risk
from intelligence.features.snapshot import build_feature_snapshot
from intelligence.ensemble import ensemble_from_specialists
from intelligence.calibration import calibrate_probability
from intelligence.contracts import DataStatus

try:
    import intelligence.agents.wire  # noqa
    from intelligence.agents.registry import agent_registry
    _AGENTS_AVAILABLE = True
except Exception:
    _AGENTS_AVAILABLE = False
    agent_registry = None  # type: ignore

PIPELINE_STAGES = ["DATA","FEATURES","MATCH_CONTEXT","FORM","TEAM_STRENGTH","AVAILABILITY","MATCHUP","AI_BRAIN","ENSEMBLE","CALIBRATION","VALUE","RISK","PREDICTION"]

async def _build_market_snapshot(fixture: dict):
    """Build MarketSnapshot — real provider or marked UNAVAILABLE, never uniform random.

    Market semantics are sport-aware: football → MATCH_RESULT, basketball → MONEYLINE, etc.
    No cross-sport market fallback.
    """
    from intelligence.contracts import MarketSnapshot, MarketSnapshotEntry, DataStatus
    from intelligence.market_registry import get_primary_market, is_implemented as is_market_implemented
    from core.time import utcnow
    fid = fixture["id"]
    sport = fixture.get("sport", "football")
    # NOT_IMPLEMENTED for unknown sports — still create snapshot but mark reasoning
    if not is_market_implemented(sport):
        return MarketSnapshot(
            fixture_id=fid, sport=sport, entries=[],
            captured_at=utcnow(), source="none", status=DataStatus.UNAVAILABLE,
            unavailable_reason=f"NOT_IMPLEMENTED: no market registry for sport={sport}",
        )
    try:
        from ingestion.collectors.odds import collect_odds
        raw_odds = await collect_odds(event_id=fid, sport=sport)
        entries = []
        for o in raw_odds:
            entries.append(MarketSnapshotEntry(
                market=o["market"],
                selection=o["selection"],
                bookmaker=o["bookmaker"],
                price_decimal=o["price_decimal"],
                implied_probability=o.get("implied_probability"),
                captured_at=o.get("captured_at", utcnow()),
                is_stale=o.get("is_stale", False),
            ))
        if entries:
            target = get_primary_market(sport)
            has_target = any(e.market == target for e in entries)
            status = DataStatus.AVAILABLE if has_target else DataStatus.UNCERTAIN
            reason = None if has_target else f"no {target} in snapshot"
            return MarketSnapshot(
                fixture_id=fid, sport=sport, entries=entries,
                captured_at=utcnow(), source="provider", status=status, unavailable_reason=reason,
            )
        else:
            return MarketSnapshot(
                fixture_id=fid, sport=sport, entries=[],
                captured_at=utcnow(), source="none", status=DataStatus.UNAVAILABLE,
                unavailable_reason="no odds provider configured",
            )
    except Exception as e:
        return MarketSnapshot(
            fixture_id=fid, sport=sport, entries=[],
            captured_at=utcnow(), source="error", status=DataStatus.UNAVAILABLE,
            unavailable_reason=str(e)[:120],
        )

async def run_fixture_pipeline(fixture: dict) -> Optional[dict]:
    state = get_scanner_state()
    fid = fixture["id"]
    await state.update_fixture_status(fid, "ANALYZING")

    # ─── DATA: MarketSnapshot ───────────────────────────────────────────────
    await state.update_pipeline_stage("DATA", fid, "ACTIVE")
    market_snapshot = await _build_market_snapshot(fixture)
    await asyncio.sleep(0.02)
    await state.update_pipeline_stage("DATA", fid, "COMPLETE", detail=f"market:{market_snapshot.status.value} entries:{len(market_snapshot.entries)}")

    # ─── FEATURES: FeatureSnapshot ─────────────────────────────────────────
    await state.update_pipeline_stage("FEATURES", fid, "ACTIVE")
    sport = fixture.get("sport", "football")
    feature_snapshot = build_feature_snapshot(fixture_id=fid, sport=sport, fixture=fixture, market_snapshot=market_snapshot)
    feats = {g.name: g.values for g in feature_snapshot.groups if g.status == DataStatus.AVAILABLE}
    await asyncio.sleep(0.04)
    avail = sum(1 for g in feature_snapshot.groups if g.status == DataStatus.AVAILABLE)
    total = len(feature_snapshot.groups)
    detail = f"{avail}/{total} groups available"
    if avail < total:
        detail += f" ({', '.join(g.name for g in feature_snapshot.groups if g.status != DataStatus.AVAILABLE)})"
    await state.update_pipeline_stage("FEATURES", fid, "COMPLETE", detail=detail)

    for stage in ["MATCH_CONTEXT","FORM","TEAM_STRENGTH","AVAILABILITY","MATCHUP"]:
        await state.update_pipeline_stage(stage, fid, "ACTIVE")
        await asyncio.sleep(0.02)
        grp = next((g for g in feature_snapshot.groups if g.name == stage), None)
        st = "COMPLETE" if grp and grp.status == DataStatus.AVAILABLE else "COMPLETE"
        det = grp.status.value if grp else "unknown"
        await state.update_pipeline_stage(stage, fid, st, detail=det)

    # ─── AI_BRAIN: real specialists only — stub outputs marked is_stub ──────
    await state.update_pipeline_stage("AI_BRAIN", fid, "ACTIVE")
    confidences: list[float] = []
    specialist_outputs: list = []
    data_quality = "ok"
    brain_llm = None
    brain_agents_enabled = {}
    try:
        from intelligence.brain import get_active_llm, get_enabled_agents
        brain_llm = get_active_llm()
        brain_agents_enabled = get_enabled_agents()
        llm_label = brain_llm['provider']+':'+brain_llm['model'] if brain_llm else 'none'
        enabled_count = sum(1 for v in brain_agents_enabled.values() if v)
        await state.update_pipeline_stage("AI_BRAIN", fid, "ACTIVE", detail=f"llm={llm_label} agents={enabled_count}/12")
    except Exception:
        pass

    # Sport-aware specialist resolution — no hardcoded sport list here; delegate to brain
    # Ensures adding a new sport (tennis) only requires registering specialists, not modifying pipeline
    if _AGENTS_AVAILABLE and agent_registry:
        from intelligence.brain import specialists_for_sport, sport_for_specialist  # noqa
        from intelligence.features.snapshot import validate_snapshot_for_sport
        from intelligence.market_registry import get_probability_keys

        # Validate feature snapshot is not cross-sport leaked
        valid_snap, snap_reason = validate_snapshot_for_sport(feature_snapshot, sport)
        if not valid_snap:
            await state.record_rejection(fid, snap_reason, rejection_code="INVALID_MARKET", rejection_stage="DATA", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
            await state.update_fixture_status(fid, "COMPLETE")
            return None

        wanted = set(specialists_for_sport(sport))
        # Fallback for legacy if sport not in registry: use football/basketball hardcoded sets (but log NOT_IMPLEMENTED)
        if not wanted:
            if sport == "basketball":
                wanted = {"pace_tempo","shooting_efficiency","rebound_rim","availability_fatigue","matchup_scheme","market_efficiency"}
            elif sport == "football":
                wanted = {"form_sentinel","team_strength","player_availability","matchup_analyst","market_analyst","strategy_ensemble"}
            else:
                await state.record_rejection(fid, f"NOT_IMPLEMENTED: no specialists for sport={sport}", rejection_code="TECHNICAL_FAILURE", rejection_stage="AI_BRAIN", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
                await state.update_fixture_status(fid, "COMPLETE")
                return None

        # Filter registry to wanted set, and ensure they received sport-correct FeatureSnapshot
        agents = [a for a in agent_registry.all() if a.name in wanted]

        async def _run_agent(agent):
            try:
                ctx = {"features": feats, "llm": brain_llm, "sport": sport, "feature_snapshot": feature_snapshot, "market_snapshot": market_snapshot}
                out = await asyncio.wait_for(agent.analyze(fixture, ctx), timeout=10)
                # Contract check: output sport must match fixture sport (prevents cross-sport leakage)
                if getattr(out, "sport", sport) != sport:
                    from intelligence.contracts import AgentOutput, EvidenceItem
                    return AgentOutput(
                        specialist_id=agent.name,
                        sport=sport,
                        model=out.model,
                        model_version=out.model_version,
                        prompt_version=out.prompt_version,
                        prompt_path=out.prompt_path or f"{sport}/{agent.name}/{out.prompt_version}",
                        prompt_status="not_implemented",
                        feature_snapshot_id=feature_snapshot.id,
                        assessment=f"UNAVAILABLE — sport mismatch: agent returned {out.sport} != fixture {sport}",
                        probabilities={k: 0 for k in get_probability_keys(sport)},
                        confidence=0,
                        evidence=[EvidenceItem(feature="sport_mismatch", observation=f"{out.sport} != {sport}", reasoning="cross-sport leakage prevented")],
                        uncertainties=[f"sport_mismatch {out.sport}"],
                        warnings=[f"sport_mismatch: {agent.name}"],
                        key_factors=[],
                        model_metadata={"provider": brain_llm["provider"] if brain_llm else "none", "fallback": True, "is_stub": True, "sport": sport},
                    )
                return out
            except Exception as e:
                from intelligence.contracts import AgentOutput, EvidenceItem
                return AgentOutput(
                    specialist_id=agent.name,
                    sport=sport,
                    model=brain_llm["model"] if brain_llm else "none",
                    model_version="v1",
                    prompt_version="v1",
                    prompt_path=f"{sport}/{agent.name}/v1",
                    prompt_status="not_implemented",
                    feature_snapshot_id=feature_snapshot.id,
                    assessment=f"UNAVAILABLE — {agent.name}: {str(e)[:80]}",
                    probabilities={k: 0 for k in get_probability_keys(sport)},
                    confidence=0,
                    evidence=[EvidenceItem(feature="timeout", observation=str(e)[:80], reasoning="agent failed, no prediction produced")],
                    uncertainties=[str(e)[:120]],
                    warnings=[f"agent_unavailable: {agent.name}"],
                    key_factors=[],
                    model_metadata={"provider": brain_llm["provider"] if brain_llm else "none", "fallback": True, "is_stub": True, "sport": sport},
                )

        if agents:
            results = await asyncio.gather(*[_run_agent(a) for a in agents])
            for out in results:
                if not isinstance(out, Exception):
                    # Skip stub outputs — no real confidence
                    if out.model_metadata and out.model_metadata.get("is_stub"):
                        data_quality = "degraded"
                        continue
                    specialist_outputs.append(out)
                    confidences.append(out.confidence)
                    if out.warnings:
                        data_quality = "degraded"

    # If no real specialist outputs, pipeline cannot produce a meaningful prediction
    if not specialist_outputs or not confidences:
        await state.update_pipeline_stage("AI_BRAIN", fid, "COMPLETE", detail="0 real specialists — no LLM configured")
        await state.record_rejection(fid, "no specialist outputs — no LLM or all agents unavailable", rejection_code="TECHNICAL_FAILURE", rejection_stage="AI_BRAIN", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
        await state.update_fixture_status(fid, "COMPLETE")
        return None

    await asyncio.sleep(0.06)
    avg_conf = sum(confidences)/len(confidences) if confidences else 0
    await state.update_pipeline_stage("AI_BRAIN", fid, "COMPLETE", detail=f"{len(specialist_outputs)} specialists confidence avg {avg_conf:.2f}")

    # ─── ENSEMBLE: real aggregation of specialist probabilities ───────────────
    await state.update_pipeline_stage("ENSEMBLE", fid, "ACTIVE")
    specialist_probs = [out.probabilities for out in specialist_outputs if out.probabilities]
    if specialist_probs:
        ensemble_out = ensemble_from_specialists(specialist_outputs)
        probs = ensemble_out.probabilities
        if sport == "basketball":
            candidates = {k: v for k, v in probs.items() if k in ("HOME","AWAY")}
            if not candidates:
                candidates = probs
        else:
            candidates = probs
        selected_via_ensemble = max(candidates, key=candidates.get) if candidates else "HOME"
        ensemble_prob_for_value = max(candidates.values()) if candidates else 0.5
        ens_conf = ensemble_out.ensemble_confidence
        disagreement = ensemble_out.disagreement
    else:
        await state.update_pipeline_stage("ENSEMBLE", fid, "COMPLETE", detail="no specialist probs")
        await state.record_rejection(fid, "no specialist probabilities for ensemble", rejection_code="ENSEMBLE_INVALID", rejection_stage="ENSEMBLE", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
        await state.update_fixture_status(fid, "COMPLETE")
        return None

    await asyncio.sleep(0.02)
    await state.update_pipeline_stage("ENSEMBLE", fid, "COMPLETE", detail=f"disagreement {disagreement:.2f}")

    # ─── CALIBRATION: distinct from confidence — raw vs calibrated, with is_active
    await state.update_pipeline_stage("CALIBRATION", fid, "ACTIVE")
    raw_prob = ensemble_prob_for_value
    from intelligence.calibration import calibrate as calibrate_stage
    calib_out = calibrate_stage(raw_prob, sport=sport)
    calibrated = calib_out.calibrated_probability
    is_cal_active = calib_out.is_active
    calib_method = calib_out.method
    detail = f"raw {calib_out.raw_probability:.3f} → cal {calib_out.calibrated_probability:.3f} {calib_out.method} {'active' if calib_out.is_active else 'INSUFFICIENT_DATA'}"
    if calib_out.brier_score is not None:
        detail += f" Brier {calib_out.brier_score:.3f}"
    if calib_out.inactive_reason:
        detail += f" ({calib_out.inactive_reason[:40]})"
    await asyncio.sleep(0.02)
    await state.update_pipeline_stage("CALIBRATION", fid, "COMPLETE", detail=detail)

    # ─── VALUE: deterministic, requires real MarketSnapshot — sport-aware market semantics ──
    await state.update_pipeline_stage("VALUE", fid, "ACTIVE")
    from intelligence.market_registry import get_primary_market, validate_market
    target_market = get_primary_market(sport)
    # Validate sport is implemented; if not, cannot produce value
    from intelligence.market_registry import is_implemented as is_market_implemented
    if not is_market_implemented(sport):
        await state.record_rejection(fid, f"NOT_IMPLEMENTED: no market semantics for sport={sport}", rejection_code="INVALID_MARKET", rejection_stage="VALUE", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
        await state.update_fixture_status(fid, "COMPLETE")
        return None
    # Validate ensemble selection is valid for sport's primary market
    ok_sel, _ = validate_market(sport, target_market, selected_via_ensemble)
    if not ok_sel and sport == "basketball" and selected_via_ensemble == "DRAW":
        # Basketball should never produce DRAW — treat as NOT_IMPLEMENTED mis-prediction
        await state.record_rejection(fid, "invalid basketball DRAW selection — sport-aware market enforced", rejection_code="INVALID_MARKET", rejection_stage="VALUE", fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
        await state.update_fixture_status(fid, "COMPLETE")
        return None
    target_selection = selected_via_ensemble

    market_entry = market_snapshot.odds_for(target_market, target_selection) if market_snapshot else None
    if not market_entry and market_snapshot and market_snapshot.entries:
        for e in market_snapshot.entries:
            if e.market == target_market:
                market_entry = e
                target_selection = e.selection
                break
    if not market_entry and market_snapshot and market_snapshot.entries:
        market_entry = market_snapshot.entries[0]
        target_market = market_entry.market
        target_selection = market_entry.selection

    if market_entry:
        market_odds = market_entry.price_decimal
        value = assess_value(market_odds, calibrated)
        value_status = "COMPLETE"
        value_detail = f"{target_market} {target_selection} @ {market_odds} edge {value.edge:.3f}"
    else:
        market_odds = 0
        from market.value import ValueAssessment
        value = ValueAssessment(market_odds=0, implied_probability=0, calibrated_probability=calibrated, fair_odds_val=0, edge=0, expected_value=0, is_value=False)
        value_status = "COMPLETE"
        value_detail = "UNAVAILABLE — no market snapshot"

    await asyncio.sleep(0.02)
    await state.update_pipeline_stage("VALUE", fid, value_status, detail=value_detail)

    # ─── RISK: independent ────────────────────────────────────────────────────
    await state.update_pipeline_stage("RISK", fid, "ACTIVE")
    # Detect stale market for STALE_DATA code
    is_stale_flag = market_snapshot.is_stale if hasattr(market_snapshot, "is_stale") else False
    if is_stale_flag or (market_snapshot.status == DataStatus.STALE):
        # Still proceed but mark for potential STALE_DATA if later blocked — keep trace
        pass
    risk = assess_risk(confidence=ens_conf, edge=value.edge, data_quality=data_quality, market_quality="ok" if market_entry else "stale", correlation=0, selection_count=1)
    await asyncio.sleep(0.02)
    await state.update_pipeline_stage("RISK", fid, "COMPLETE", detail=f"{risk.level} score {risk.score:.2f}")
    if risk.blocked:
        # Distinguish STALE_DATA vs RISK_BLOCKED
        code = "STALE_DATA" if (is_stale_flag or not market_entry) else "RISK_BLOCKED"
        stage = "DATA" if code == "STALE_DATA" else "RISK"
        await state.record_rejection(fid, f"risk {risk.level}: {', '.join(risk.reasons) or 'blocked'}", rejection_code=code, rejection_stage=stage, fixture=fixture, feature_snapshot_id=feature_snapshot.id, market_snapshot_id=market_snapshot.id)
        await state.update_fixture_status(fid, "COMPLETE")
        return None

    # ─── PREDICTION: traceable chain ───────────────────────────────────────
    await state.update_pipeline_stage("PREDICTION", fid, "ACTIVE")
    final_selection = target_selection
    final_market = target_market

    from core.identifiers import new_id as _new_id
    pred_id = _new_id("pred")
    # Provenance: every specialist's prompt_path / prompt_version / model / feature_snapshot_id / pipeline_version
    prompt_paths = {o.specialist_id: getattr(o, "prompt_path", f"{sport}/{o.specialist_id}/{o.prompt_version}") for o in specialist_outputs}
    prompt_statuses = {o.specialist_id: getattr(o, "prompt_status", "available") for o in specialist_outputs}
    prompt_versions = {o.specialist_id: o.prompt_version for o in specialist_outputs}
    from core.time import utcnow
    now_iso = utcnow().isoformat()
    pred = {
        "id": pred_id,
        "fixture_id": fid,
        "fixture": fixture,
        "fixture_label": fixture.get("label", fid),
        "competition": fixture.get("competition", ""),
        "sport": sport,
        "market": final_market,
        "selection": final_selection,
        "probability": raw_prob,
        "calibrated_probability": calibrated,
        "confidence": ens_conf,
        "market_odds": market_odds,
        "implied_probability": round(value.implied_probability, 3),
        "fair_odds": round(value.fair_odds_val, 2),
        "edge": round(value.edge, 3),
        "expected_value": round(value.expected_value, 3),
        "is_value": value.is_value,
        "risk_level": risk.level,
        "risk_score": risk.score,
        "kickoff_at": fixture.get("kickoff_at"),
        "created_at": now_iso,
        "model_used": brain_llm["model"] if brain_llm else "none",
        "provider_used": brain_llm["provider"] if brain_llm else "none",
        "agents_used": len(specialist_outputs),
        "feature_snapshot_id": feature_snapshot.id,
        "market_snapshot_id": market_snapshot.id,
        "pipeline_version": "v1",
        "feature_version": feature_snapshot.feature_version,
        "calibration_active": is_cal_active,
        # Structured outputs for complete chain inspectability (fixture → market_snapshot → feature_snapshot → specialists → ensemble → calibration → value → risk → prediction)
        "ensemble_output": {"probabilities": probs, "disagreement": disagreement, "confidence": ens_conf, "version": "v1"},
        "calibration_output": {"raw_probability": calib_out.raw_probability, "calibrated_probability": calib_out.calibrated_probability, "method": calib_out.method, "is_active": calib_out.is_active, "brier_score": calib_out.brier_score, "inactive_reason": calib_out.inactive_reason, "version": calib_out.version},
        "value_output": {"market_odds": value.market_odds, "implied_probability": value.implied_probability, "fair_probability": calibrated, "fair_odds": value.fair_odds_val, "edge": value.edge, "ev": value.expected_value, "is_value": value.is_value, "version": "v1"},
        "risk_output": {"selection_risk": risk.level, "risk_score": risk.score, "reasons": risk.reasons, "exposure": {}, "correlation": 0, "version": "v1"},
        # Enhanced sport-aware provenance
        "prompt_paths": prompt_paths,  # specialist → sport/specialist/version
        "prompt_statuses": prompt_statuses,
        "prompt_versions": prompt_versions,
        "provenance": {
            "sport": sport,
            "pipeline_version": "v1",
            "feature_version": feature_snapshot.feature_version,
            "feature_snapshot_id": feature_snapshot.id,
            "specialists": [
                {
                    "sport": getattr(o, "sport", sport),
                    "specialist": o.specialist_id,
                    "model": o.model,
                    "model_version": o.model_version,
                    "prompt_version": o.prompt_version,
                    "prompt_path": getattr(o, "prompt_path", f"{sport}/{o.specialist_id}/{o.prompt_version}"),
                    "prompt_status": getattr(o, "prompt_status", "available"),
                    "feature_snapshot_id": o.feature_snapshot_id,
                }
                for o in specialist_outputs
            ],
        },
        "feature_snapshot": {"id": feature_snapshot.id, "sport": feature_snapshot.sport, "groups": [{"name": g.name, "status": g.status.value, "values": g.values, "unavailable_reason": g.unavailable_reason} for g in feature_snapshot.groups]},
        "market_snapshot": {"id": market_snapshot.id, "status": market_snapshot.status.value, "entries": len(market_snapshot.entries), "sport": market_snapshot.sport},
        "specialist_outputs": [o.model_dump() for o in specialist_outputs],
        "ensemble": {"probabilities": probs, "disagreement": disagreement, "confidence": ens_conf},
        "value_detail": value_detail,
    }
    await state.record_prediction(pred)
    try:
        from intelligence.prediction_store import save_prediction
        save_prediction(pred)
    except Exception:
        pass
    try:
        from analytics.calibration.service import record_prediction as calib_record
        calib_record({**pred, "model_version": brain_llm["model"] if brain_llm else "none", "feature_version": feature_snapshot.feature_version, "prompt_version": brain_llm["provider"]+":"+brain_llm["model"] if brain_llm else "none", "data_snapshot_at": fixture.get("kickoff_at")})
    except Exception:
        pass
    await state.update_pipeline_stage("PREDICTION", fid, "COMPLETE", detail=f"{final_market} {final_selection} prob {calibrated:.3f}")
    await state.update_fixture_status(fid, "COMPLETE")
    return pred
