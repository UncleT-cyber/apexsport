from fastapi import APIRouter
from intelligence.brain import get_brain_status, get_active_llm, get_enabled_agents

router = APIRouter(prefix="/api/brain", tags=["brain"])

@router.get("/status")
def brain_status():
    return get_brain_status()

@router.get("/llm")
def brain_llm():
    llm = get_active_llm()
    if not llm:
        return {"configured": False, "message": "No LLM selected — set a model in Settings → AI & Models (save a provider key, FETCH MODELS, select FREE/PAID, SAVE)"}
    return {"configured": True, "llm": llm}

@router.get("/agents")
def brain_agents():
    enabled = get_enabled_agents()
    return {"enabled": {k:v for k,v in enabled.items() if v}, "disabled": {k:v for k,v in enabled.items() if not v}, "all": enabled}
