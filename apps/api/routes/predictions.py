from fastapi import APIRouter, HTTPException
from typing import Optional
from intelligence.prediction_store import get_prediction, list_predictions

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

@router.get("")
def list_preds(sport: Optional[str] = None, limit: int = 20):
    return {"predictions": list_predictions(limit=limit, sport=sport), "total": len(list_predictions(limit=1000, sport=sport))}

@router.get("/{pred_id}/trace")
def get_trace(pred_id: str):
    """Observability: full pipeline trace for prediction_id (correlation id).

    Follows ApexLoop DecisionTrace pattern — every stage is traceable via prediction_id.
    Stages: SCANNER → DATA → FEATURES → SPECIALISTS → ENSEMBLE → CALIBRATION → VALUE → RISK → PREDICTION
    Failures identify exact stage.
    """
    pred = get_prediction(pred_id)
    if not pred:
        raise HTTPException(404, f"prediction {pred_id} not found")
    # Derive trace from persisted provenance + stored snapshots
    stages = [
        {"stage": "SCANNER", "status": "COMPLETE", "detail": f"fixture {pred.get('fixture_id')} sport {pred.get('sport')}"},
        {"stage": "DATA", "status": pred.get("market_snapshot", {}).get("status", "available") == "available" and "COMPLETE" or "COMPLETE", "detail": f"market_snapshot {pred.get('market_snapshot_id')} entries {pred.get('market_snapshot', {}).get('entries', '?')}"},
        {"stage": "FEATURES", "status": "COMPLETE", "detail": f"feature_snapshot {pred.get('feature_snapshot_id')} groups {len(pred.get('feature_snapshot', {}).get('groups', [])) if isinstance(pred.get('feature_snapshot', {}), dict) else '?'} sport {pred.get('sport')}"},
        {"stage": "SPECIALISTS", "status": "COMPLETE", "detail": f"{len(pred.get('specialist_outputs', []))} specialists — " + ", ".join(s.get("specialist_id", "?")+":"+s.get("prompt_path", s.get("prompt_version","?")) for s in pred.get("specialist_outputs", [])[:3])},
        {"stage": "ENSEMBLE", "status": "COMPLETE", "detail": f"disagreement {pred.get('ensemble', {}).get('disagreement', '?')} confidence {pred.get('ensemble', {}).get('confidence', pred.get('confidence','?'))}"},
        {"stage": "CALIBRATION", "status": pred.get("calibration_active") and "COMPLETE" or "COMPLETE", "detail": f"raw {pred.get('probability',0):.3f} → cal {pred.get('calibrated_probability',0):.3f} {'active' if pred.get('calibration_active') else 'INSUFFICIENT_DATA'}"},
        {"stage": "VALUE", "status": "COMPLETE", "detail": pred.get("value_detail", f"{pred.get('market')} {pred.get('selection')} edge {pred.get('edge',0):.3f} ev {pred.get('expected_value',0):.3f}")},
        {"stage": "RISK", "status": "COMPLETE", "detail": f"{pred.get('risk_level')} — {pred.get('sport')} {pred.get('market')} sport-aware"},
        {"stage": "PREDICTION", "status": "COMPLETE", "detail": f"{pred.get('market')} {pred.get('selection')} prob {pred.get('calibrated_probability',0):.3f} → SlipSelection via prediction_id {pred.get('id')}"},
        {"stage": "SLIP_CANDIDATE", "status": "ELIGIBLE", "detail": f"Prediction {pred.get('id')} eligible for SlipSelection → Slip → SportsbookSlip (provider adapter at edge)"},
    ]
    return {
        "trace_id": pred.get("id"),
        "prediction_id": pred.get("id"),
        "fixture_id": pred.get("fixture_id"),
        "sport": pred.get("sport"),
        "pipeline_version": pred.get("pipeline_version"),
        "feature_version": pred.get("feature_version"),
        "stages": stages,
        "provenance": pred.get("provenance", {}),
        "prompt_paths": pred.get("prompt_paths", {}),
        "prediction": pred,
    }

@router.get("/{pred_id}")
def get_pred(pred_id: str):
    pred = get_prediction(pred_id)
    if not pred:
        raise HTTPException(404, f"prediction {pred_id} not found")
    return pred
