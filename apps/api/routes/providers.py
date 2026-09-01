from fastapi import APIRouter
from providers.registry.provider_registry import registry

router = APIRouter(prefix="/api/providers", tags=["providers"])

@router.get("/health")
async def providers_health():
    health = await registry.health_all()
    return {k: v.model_dump() for k, v in health.items()}

@router.get("")
async def list_providers():
    return [{"name": p.name, "capabilities": [c.value for c in p.capabilities()], "configured": p.is_configured()} for p in registry.all()]
