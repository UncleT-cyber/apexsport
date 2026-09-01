from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/copilot", tags=["copilot"])

class ChatIn(BaseModel):
    messages: List[Dict[str, str]]  # [{role, content}]
    context: Optional[Dict[str, Any]] = None  # {type, prediction_id, slip_id, ...}

@router.post("/chat")
async def chat_endpoint(body: ChatIn):
    from intelligence.copilot.chat import chat as _chat, PROMPT_VERSION
    result = await _chat(messages=body.messages, context=body.context)
    return result

@router.get("/status")
def status():
    from intelligence.brain import get_active_llm
    llm = get_active_llm()
    from intelligence.copilot.chat import PROMPT_VERSION
    return {
        "prompt_version": PROMPT_VERSION,
        "model_used": llm["model"] if llm else None,
        "provider_used": llm["provider"] if llm else None,
        "is_configured": llm is not None,
        "note": "Copilot uses globally configured LLM (Settings → AI & Models), not independent config. Only prompt version is copilot-specific.",
    }

@router.get("/tools")
def tools():
    from intelligence.copilot.tools import TOOL_SCHEMAS
    return {"tools": TOOL_SCHEMAS, "count": len(TOOL_SCHEMAS)}

@router.post("/tool-execute")
def tool_execute(name: str, arguments: Dict[str, Any] = {}):
    from intelligence.copilot.tools import execute_tool
    return execute_tool(name, arguments)
