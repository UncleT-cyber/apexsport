from fastapi import APIRouter
from providers.registry.provider_registry import registry
from intelligence.agents.registry import agent_registry
from intelligence.prompts.registry import prompt_registry
from intelligence.models.registry import model_registry

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/providers")
async def admin_providers():
    h = await registry.health_all()
    return {k: v.model_dump() for k,v in h.items()}

@router.get("/agents")
def admin_agents():
    return {"agents": agent_registry.all_names()}

@router.get("/prompts")
def admin_prompts():
    # expose active prompts (not secrets)
    return {"prompts": [{"agent": k.split(":")[0], "version": v.version, "active": v.active} for k,v in prompt_registry._prompts.items()]}

@router.get("/models")
def admin_models():
    return {"models": [m.model_dump() for m in model_registry._models.values()]}

@router.get("/system")
def admin_system():
    from sports.registry import sport_registry
    return {"service": "apexsport", "sports": sport_registry.all()}

@router.get("/sports")
def admin_sports():
    from sports.registry import sport_registry
    return {"sports": sport_registry.all()}
