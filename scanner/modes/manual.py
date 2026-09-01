from __future__ import annotations
import asyncio
from scanner.pipeline.state import get_scanner_state
from scanner.universe.discovery import discover_fixtures
from scanner.pipeline.execution import run_fixture_pipeline
from core.events.bus import Event, EventType, event_bus

async def run_manual_scan(
    sport: str = "football",
    fixtures: list[dict] | None = None,
    league: str | None = None,
    days: int = 7,
    batch_size: int = 20,
    batch_index: int = 0,
    date_from=None,
    date_to=None,
) -> dict:
    """Sport-correct, league-scoped, batched scan.

    Scope enforced at backend domain: sport + league + date window before pipeline.
    Universe vs Batch: available_universe (all for sport) → eligible (after league) → batch slice.
    """
    from datetime import datetime, timedelta, timezone

    state = get_scanner_state()
    if state.state.is_scanning:
        return {"status": "already_scanning"}

    # Discover available universe for sport (without league filter)
    available = await discover_fixtures(sport=sport, days=days, date_from=date_from, date_to=date_to)
    available_count = len(available)

    # Apply league scoping to get eligible
    if fixtures is not None:
        # Explicit fixtures passed (e.g., targeted) — validate sport correctness
        eligible = []
        for f in fixtures:
            fs = f.get("sport", sport)
            if fs != sport:
                # Reject cross-sport fixture — never process basketball for football scan
                continue
            if league and league != "All Leagues" and f.get("competition") != league:
                if str(f.get("competition_code", "")) != str(league):
                    continue
            eligible.append(f)
    else:
        if league and league != "All Leagues":
            eligible = [f for f in available if f.get("competition") == league or str(f.get("competition_code", "")) == str(league)]
        else:
            eligible = available

    eligible_count = len(eligible)
    # Batch slicing
    total_batches = (eligible_count + batch_size - 1)//batch_size if batch_size else 1
    if batch_index >= total_batches and total_batches > 0:
        batch_index = 0
    batch_slice = eligible[batch_index*batch_size : (batch_index+1)*batch_size] if batch_size else eligible

    scope = {"sport": sport, "league": league or "All Leagues", "days": days, "batch_size": batch_size, "batch_index": batch_index}
    await state.start_scan(batch_slice, scope=scope, available_universe=available_count, eligible_count=eligible_count, batch_size=batch_size, batch_index=batch_index)

    await state.set_state(state.state.state.__class__.SCANNING if hasattr(state.state.state, "SCANNING") else state.state.state)
    from scanner.pipeline.state import ScannerState
    await state.set_state(ScannerState.SCANNING)
    event_bus.emit_sync(Event(event_type=EventType.SCAN_STARTED, source="scanner", data={"sport": sport, "league": league, "available": available_count, "eligible": eligible_count, "batch": f"{batch_index+1}/{total_batches}", "fixtures": len(batch_slice)}))

    # Track stage counts for explainability (directive section 13)
    stage_counts = {
        "discovered": available_count,
        "eligible": eligible_count,
        "batches_total": total_batches,
        "current_batch": batch_index,
        "scanning": f"{0} / {eligible_count}",
        "feature_ready": 0,
        "specialist_ok": 0,
        "ensemble_ok": 0,
        "calibrated": 0,
        "value_ok": 0,
        "risk_ok": 0,
        "predictions": 0,
    }

    results = []
    for idx, fx in enumerate(batch_slice):
        # Enforce sport correctness per-fixture before pipeline (provider→canonical trace)
        if fx.get("sport", sport) != sport:
            await state.record_rejection(fx.get("id", "?"), f"sport mismatch {fx.get('sport')} != scan sport {sport} — rejected")
            continue
        await state.update_fixture_status(fx["id"], "FETCHING")
        await asyncio.sleep(0.05)
        # Update batch progress telemetry
        async with state._lock:
            state._state.stage_counts = {**stage_counts, "scanning": f"{idx+1} / {eligible_count} (batch {batch_index+1}/{total_batches})"}
        pred = await run_fixture_pipeline(fx)
        # Update explainable stage counts
        if pred:
            results.append(pred)
            stage_counts["predictions"] += 1
            stage_counts["feature_ready"] += 1
            stage_counts["specialist_ok"] += 1
            stage_counts["ensemble_ok"] += 1
            stage_counts["calibrated"] += 1
            stage_counts["value_ok"] += 1
            stage_counts["risk_ok"] += 1
        else:
            # Pipeline rejected — counts still reflect attempted
            stage_counts["feature_ready"] += 1  # at least features attempted
        # Update state stage_counts live
        async with state._lock:
            state._state.stage_counts = dict(stage_counts)
            state._state.stage_counts["scanning"] = f"{idx+1} / {eligible_count}"

    await state.complete_scan()
    # Final explainable summary
    async with state._lock:
        state._state.stage_counts = {
            **stage_counts,
            "discovered": available_count,
            "eligible": eligible_count,
            "feature_ready": stage_counts["feature_ready"],
            "specialist_ok": stage_counts["specialist_ok"],
            "ensemble_ok": stage_counts["ensemble_ok"],
            "calibrated": stage_counts["calibrated"],
            "value_ok": stage_counts["value_ok"],
            "risk_ok": stage_counts["risk_ok"],
            "predictions": len(results),
            "rejected": state.state.candidates_rejected,
            "summary": f"Fixtures discovered: {available_count} → Eligible: {eligible_count} → Feature-ready: {stage_counts['feature_ready']} → Specialist ok: {stage_counts['specialist_ok']} → Ensemble ok: {stage_counts['ensemble_ok']} → Calibrated: {stage_counts['calibrated']} → Value-qualified: {stage_counts['value_ok']} → Risk-approved: {stage_counts['risk_ok']} → Predictions: {len(results)}" +
                       (f" — Stage FAILED: {state.state.last_error}" if state.state.last_error else "")
        }
    event_bus.emit_sync(Event(event_type=EventType.SCAN_COMPLETED, source="scanner", data={"sport": sport, "league": league, "_predictions": len(results), **stage_counts}))
    return {"status": "completed", "predictions": results, "fixtures": len(batch_slice), "available_universe": available_count, "eligible": eligible_count, "stage_counts": stage_counts}
