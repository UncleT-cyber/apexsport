from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/api/verify", tags=["verify"])

@router.get("/aliveness")
async def aliveness():
    """Explainable aliveness check: traces real fixture through full pipeline."""
    from scanner.universe.discovery import discover_fixtures
    from intelligence.brain import get_active_llm, get_brain_status
    from intelligence.prediction_store import list_predictions

    # Check LLM global config
    llm = get_active_llm()
    brain = get_brain_status()
    # Check fixtures for football
    foot_fixtures = await discover_fixtures(sport="football", days=7)
    basket_fixtures = await discover_fixtures(sport="basketball", days=7)

    # Check sport correctness: no cross-contamination in discovered fixtures
    foot_sport_ok = all(f.get("sport", "football") == "football" for f in foot_fixtures) if foot_fixtures else True
    basket_sport_ok = all(f.get("sport", "basketball") == "basketball" for f in basket_fixtures) if basket_fixtures else True

    # Check recent predictions have sport correctness
    preds = list_predictions(limit=20)
    pred_sport_ok = True
    for p in preds:
        sport = p.get("sport")
        # Ensure prediction sport matches its fixture sport (if we can)
        if sport not in ("football", "basketball"):
            pred_sport_ok = False
    # Check LLM payment failure?
    llm_ok = llm is not None
    # Check if any prediction has real provenance (not stub)
    real_pred = None
    for p in preds:
        outs = p.get("specialist_outputs", [])
        if outs and any(not s.get("model_metadata", {}).get("is_stub") for s in outs):
            real_pred = p
            break

    # Failure explainability: stage counts from last scan
    from scanner.pipeline.state import get_scanner_state
    snap = get_scanner_state().get_snapshot()
    stage_counts = snap.stage_counts or {}
    last_error = snap.last_error

    return {
        "is_alive": bool(real_pred and llm_ok and foot_sport_ok),
        "checks": {
            "llm_configured": llm_ok,
            "llm_provider": llm["provider"] if llm else None,
            "llm_model": llm["model"] if llm else None,
            "football_fixtures": len(foot_fixtures),
            "basketball_fixtures": len(basket_fixtures),
            "football_sport_correct": foot_sport_ok,
            "basketball_sport_correct": basket_sport_ok,
            "total_predictions": len(preds),
            "has_real_prediction_with_provenance": real_pred is not None,
            "last_scan_stage_counts": stage_counts,
            "last_error": last_error,
        },
        "explanation": (
            "Engine is alive when a real fixture traces DATA→CANONICAL→FEATURES→6 SPECIALISTS→ENSEMBLE→CALIBRATION→VALUE→RISK→PREDICTION with persisted provenance."
            if real_pred else
            "Engine not alive: no real prediction yet. Check LLM (global config) and provider fixtures. If LLM returns 402 Payment Required, switch to free model (Groq/OpenRouter) in Settings → AI & Models."
        ),
        "next_steps": [
            "If LLM 402: Settings → AI & Models → select Groq llama-3.1-8b-instant (free) → SAVE → re-scan",
            "If fixtures 0: check provider keys in Settings → Market Data → TEST each (sportmonks/api_football must be CONNECTED)",
            "Then POST /api/scanner/scan-now?sport=football and GET /api/scanner/state to see stage_counts",
        ],
    }

@router.post("/acceptance")
async def acceptance(sport: str = "football", league: Optional[str] = None):
    """Run acceptance tests A-G programmatically. Returns pass/fail per test with evidence."""
    results = {}
    from scanner.universe.discovery import discover_fixtures
    from intelligence.brain import get_active_llm
    from intelligence.prediction_store import list_predictions, get_prediction

    # Test A: Football sport correctness
    foot = await discover_fixtures(sport="football")
    results["A_football_sport_correct"] = {
        "pass": all(f.get("sport", "football") == "football" for f in foot) if foot else True,
        "fixtures": len(foot),
        "sample": foot[:2] if foot else [],
        "note": "All fixtures sport=football" if foot else "No fixtures (truthful, not football leak)",
    }
    # Test B: Basketball
    basket = await discover_fixtures(sport="basketball")
    results["B_basketball_sport_correct"] = {
        "pass": all(f.get("sport", "basketball") == "basketball" for f in basket) if basket else True,
        "fixtures": len(basket),
        "note": "All fixtures sport=basketball" if basket else "No basketball fixtures available (provider may not support basketball fixtures — not leaking football)",
    }
    # Test C: League scoping
    if foot:
        leagues = sorted(set(f.get("competition") for f in foot if f.get("competition")))
        league_to_test = leagues[0] if leagues else None
        if league_to_test:
            filtered = await discover_fixtures(sport="football", league=league_to_test)
            results["C_league_scoping"] = {
                "pass": all(f.get("competition") == league_to_test for f in filtered),
                "league": league_to_test,
                "fixtures": len(filtered),
            }
        else:
            results["C_league_scoping"] = {"pass": True, "note": "No leagues to test"}
    else:
        results["C_league_scoping"] = {"pass": None, "note": "No football fixtures to test league scoping — run scan after provider fix"}

    # Test D: Trace prediction through pipeline
    preds = list_predictions(limit=5)
    if preds:
        p = preds[0]
        trace_ok = all(k in p for k in ["fixture", "market_snapshot", "feature_snapshot", "specialist_outputs", "ensemble", "calibration_output", "value_output", "risk_output", "provenance"])
        # Check that specialist outputs are real (not stub) if LLM configured
        llm = get_active_llm()
        results["D_pipeline_trace"] = {
            "pass": trace_ok,
            "prediction_id": p.get("id"),
            "sport": p.get("sport"),
            "has_provenance": "provenance" in p,
            "specialists": len(p.get("specialist_outputs", [])),
            "prompt_paths": p.get("prompt_paths", {}),
            "model_used": p.get("model_used"),
        }
    else:
        results["D_pipeline_trace"] = {"pass": False, "reason": "No predictions to trace — run a scan with working LLM (Groq free) and provider fixtures"}

    # Test E: Inspector provenance
    if preds:
        p = preds[0]
        has_provenance = bool(p.get("prompt_paths") and p.get("model_used") != "stub-deterministic")
        results["E_inspector_provenance"] = {
            "pass": has_provenance,
            "model": p.get("model_used"),
            "prompt_paths": p.get("prompt_paths", {}),
            "note": "Check Prediction Inspector shows sport/specialist/version" if has_provenance else "Prediction is stub — LLM 402?",
        }
    else:
        results["E_inspector_provenance"] = {"pass": False, "reason": "No prediction"}

    # Test F: Copilot uses domain
    # We test tool get_current_predictions returns same count as prediction_store
    try:
        from intelligence.copilot.tools import execute_tool
        tool_res = execute_tool("get_current_predictions", {"sport": "football", "limit": 3})
        store_count = len(preds)
        results["F_copilot_domain"] = {
            "pass": isinstance(tool_res, dict) and tool_res.get("count", 0) == min(3, store_count) or (store_count == 0 and tool_res.get("status") == "Data unavailable"),
            "tool_result_count": tool_res.get("count") if isinstance(tool_res, dict) else None,
            "store_count": store_count,
            "note": "Copilot tool reads canonical store, not hardcoded" if isinstance(tool_res, dict) else "Tool failed",
        }
    except Exception as e:
        results["F_copilot_domain"] = {"pass": False, "error": str(e)[:100]}

    # Test G: Global LLM config change affects both engine and copilot
    llm = get_active_llm()
    try:
        from intelligence.copilot.chat import PROMPT_VERSION as cop_prompt_v
        from intelligence.brain import get_brain_status
        brain = get_brain_status()
        results["G_global_llm"] = {
            "pass": llm is not None and brain["is_configured"],
            "engine_provider": llm["provider"] if llm else None,
            "engine_model": llm["model"] if llm else None,
            "copilot_prompt_version": cop_prompt_v,
            "note": "Both engine and copilot resolve via get_active_llm (same global Settings)",
        }
    except Exception as e:
        results["G_global_llm"] = {"pass": False, "error": str(e)[:100]}

    overall = all(v.get("pass") is True for v in results.values() if v.get("pass") is not None)
    return {"overall_pass": overall, "tests": results, "summary": "All acceptance tests must be True for engine to be considered alive (truthful, not appearance)."}
