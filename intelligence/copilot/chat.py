"""Copilot chat — global LLM config, versioned prompt, tool loop.

Apex Sport Copilot MUST resolve its LLM provider/model through the same globally
configured LLM configuration used by Apex Sports (intelligence.brain.get_active_llm).
Copilot must not maintain an independent provider/model config. Only prompt version may differ.

Tool loop:
  1. Call LLM with system prompt + tool schemas + user message + context
  2. If LLM returns tool_calls → execute via tools.execute_tool → second LLM call to synthesize
  3. Return final answer + tool traces + provenance
"""
from __future__ import annotations

import json
import pathlib
from typing import Optional, List, Dict, Any

PROMPT_PATH = pathlib.Path(__file__).parent / "prompts" / "v1.md"
PROMPT_VERSION = "v1"

def _load_system_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except Exception:
        return "You are Apex Sport Copilot."

def _active_llm():
    from intelligence.brain import get_active_llm
    return get_active_llm()

def _tool_schemas_for_llm():
    from intelligence.copilot.tools import TOOL_SCHEMAS
    return TOOL_SCHEMAS

def _emit(event_type, data: dict):
    try:
        from core.events.bus import event_bus, Event, EventType
        # Never expose api_key or secrets — only provider/model/prompt_version
        safe = {k: v for k, v in data.items() if "api_key" not in k.lower() and "secret" not in k.lower()}
        event_bus.emit_sync(Event(event_type=event_type, source="copilot", data=safe))
    except Exception:
        pass

async def chat(
    messages: List[Dict[str, str]],
    context: Optional[Dict[str, Any]] = None,
    max_tool_iters: int = 2,
) -> Dict[str, Any]:
    """
    messages: [{"role":"user","content":"..."}, ...] — conversation history (user+assistant)
    context: {type: "prediction", prediction_id: "..."} etc.
    Returns: {answer, tool_calls: [...], model_used, provider_used, prompt_version, provenance}
    """
    from core.events.bus import EventType
    _emit(EventType.COPILOT_REQUESTED, {"messages": len(messages), "context": context or {}})
    llm = _active_llm()
    _emit(EventType.LLM_CONFIG_RESOLVED, {"provider": llm["provider"] if llm else None, "model": llm["model"] if llm else None, "has_key": llm["has_key"] if llm else False, "prompt_version": PROMPT_VERSION})
    if not llm:
        _emit(EventType.COPILOT_ERROR, {"stage": "LLM_CONFIG_RESOLVED", "error": "no_llm_configured"})
        return {
            "answer": "No LLM configured — open Settings → AI & Models, set an API key, FETCH MODELS, select a model, SAVE. The Copilot uses the same global model as the 6 specialists (not an independent config).",
            "error": "no_llm_configured",
            "prompt_version": PROMPT_VERSION,
        }
    provider = llm["provider"]
    model = llm["model"]
    base_url = llm["base_url"]
    _emit(EventType.MODEL_SELECTED, {"provider": provider, "model": model, "prompt_version": PROMPT_VERSION})

    # Load API key like specialists do (raw settings.json + get_runtime_settings)
    import json as _json, pathlib as _pl
    raw = _json.loads(_pl.Path("settings.json").read_text()) if _pl.Path("settings.json").exists() else {}
    api_key = raw.get("llm", {}).get(provider, {}).get("api_key", "")
    try:
        from core.config.settings import get_runtime_settings
        rs = get_runtime_settings()
        if provider == "huggingface":
            api_key = getattr(rs.llm, "huggingface_api_key", None) or api_key
        elif provider == "openai":
            api_key = getattr(rs.llm, "openai_api_key", None) or api_key
        elif provider == "anthropic":
            api_key = getattr(rs.llm, "anthropic_api_key", None) or api_key
    except Exception:
        pass
    if not api_key:
        return {"answer": "LLM provider found but API key missing — set it in Settings.", "error": "no_api_key", "prompt_version": PROMPT_VERSION}

    system_prompt = _load_system_prompt()
    tool_schemas = _tool_schemas_for_llm()

    # Build prompt for LLM: system + tool descriptions + context + conversation
    context_block = ""
    if context:
        context_block = f"\n\nCurrent UI context (use to resolve 'this'/'why does Apex like this?'):\n```json\n{json.dumps(context, indent=2)[:2000]}\n```"

    # If provider supports native tool calling (OpenAI, Anthropic), we can use llm_client with tools param
    # Otherwise, fall back to prompt-injection tool loop: ask LLM to emit JSON tool_calls

    # Prepare variables for template (copilot never fabricates features)
    prompt_template = system_prompt + "\n\nTools available (call via JSON):\n" + json.dumps(tool_schemas, indent=2) + context_block

    # First, try to get LLM to decide tools
    # We use intelligence.llm_client.call_llm but extend to handle tool-style
    # For copilot we craft a single prompt that includes conversation history stringified

    convo_text = "\n".join(f"{m['role']}: {m['content']}" for m in messages[-8:])  # last 8 turns
    variables = {"conversation": convo_text}

    # Build copilot prompt: system + conversation + instruction to output either {"tool_calls":[...]} or {"answer":"..."}
    copilot_user_prompt = f"""{prompt_template}

Conversation:
{convo_text}

Instructions:
- If you need live Apex data, respond with ONLY JSON: {{"tool_calls": [{{"name":"get_current_predictions","arguments":{{"sport":"football"}}}}]}}
- Up to 2 tool_calls per turn.
- If no tools needed, respond with ONLY JSON: {{"answer":"your concise helpful answer"}}
- Never invent predictions/odds/fixtures. If tool returns Data unavailable, say so honestly.
- When answering about a prediction, include model/provenance (from tool get_prediction_analysis) and a short WHY APEX? evidence summary, but no private chain-of-thought.
"""

    from intelligence.llm_client import call_llm as _call

    # We need to bypass the football-specific prompt variables; call_llm expects template with variables dict
    # For copilot we pass a synthetic template that just contains copilot_user_prompt already rendered
    # call_llm does template.format(**variables) — our copilot_user_prompt has no braces that need formatting (or escapes)
    # So we call with empty variables or with conversation variable that is unused

    _emit(EventType.REQUEST_SENT, {"provider": provider, "model": model, "messages": len(messages)})
    try:
        llm_result = await _call(copilot_user_prompt, {}, provider, model, base_url, api_key, timeout=25)
    except Exception as e:
        _emit(EventType.COPILOT_ERROR, {"stage": "REQUEST_SENT", "error": str(e)[:120]})
        return {"answer": f"Copilot LLM call failed: {str(e)[:200]}. Check provider health in Settings.", "error": str(e)[:200], "prompt_version": PROMPT_VERSION, "model_used": model, "provider_used": provider}

    tool_calls = llm_result.get("tool_calls") or llm_result.get("tool_call") or []
    # Some models return answer directly as assessment
    if llm_result.get("answer") and not tool_calls:
        _emit(EventType.RESPONSE_COMPLETED, {"provider": provider, "model": model, "answer_len": len(llm_result["answer"]), "tool_calls": 0})
        return {
            "answer": llm_result["answer"],
            "tool_calls": [],
            "model_used": model,
            "provider_used": provider,
            "prompt_version": PROMPT_VERSION,
            "provenance": {"provider": provider, "model": model, "prompt_version": PROMPT_VERSION},
        }

    # Normalize tool_calls: may be dict or list
    if isinstance(tool_calls, dict):
        tool_calls = [tool_calls]

    executed = []
    if tool_calls and max_tool_iters > 0:
        from intelligence.copilot.tools import execute_tool
        for tc in tool_calls[:3]:
            name = tc.get("name") or tc.get("tool") or tc.get("function")
            args = tc.get("arguments") or tc.get("args") or tc.get("parameters") or {}
            if not name:
                continue
            _emit(EventType.TOOL_CALL, {"tool": name, "arguments": args})
            result = execute_tool(name, args)
            _emit(EventType.TOOL_RESULT, {"tool": name, "has_result": bool(result), "result_keys": list(result.keys())[:5] if isinstance(result, dict) else []})
            executed.append({"name": name, "arguments": args, "result": result})

        # Second LLM call to synthesize final answer with tool results
        tool_results_block = json.dumps(executed, indent=2)[:8000]
        synthesis_prompt = f"""{prompt_template}

Conversation:
{convo_text}

Tool results (canonical Apex data — truth):
```json
{tool_results_block}
```

Now produce final answer. Rules:
- Synthesize tool results into concise helpful answer (no raw JSON dump).
- If tool returned Data unavailable, say so and suggest next step (e.g., run a scan, add outcome).
- When describing predictions, always cite model_used/provider and prompt_version from tool data.
- Distinguish "Apex Engine Prediction" vs "Copilot analysis".
- Keep under 180 words unless detail requested. Use formatting for odds/edge/Brier.

Respond with ONLY JSON: {{"answer":"..."}}
"""
        _emit(EventType.RESPONSE_STARTED, {"tool_calls": len(executed), "provider": provider, "model": model})
        try:
            synth = await _call(synthesis_prompt, {}, provider, model, base_url, api_key, timeout=25)
            final_answer = synth.get("answer") or synth.get("assessment") or str(synth)[:1000]
            _emit(EventType.RESPONSE_COMPLETED, {"provider": provider, "model": model, "answer_len": len(final_answer)})
        except Exception as e:
            _emit(EventType.COPILOT_ERROR, {"stage": "RESPONSE_STARTED", "error": str(e)[:120]})
            final_answer = f"Synthesized from tools (LLM synthesis failed: {e}):\n" + json.dumps(executed, indent=2)[:800]
        return {
            "answer": final_answer,
            "tool_calls": executed,
            "model_used": model,
            "provider_used": provider,
            "prompt_version": PROMPT_VERSION,
            "provenance": {"provider": provider, "model": model, "prompt_version": PROMPT_VERSION, "system_prompt_version": PROMPT_VERSION},
        }

    # No tools needed — llm_result already contains answer or we synthesize fallback
    fallback_answer = llm_result.get("answer") or llm_result.get("assessment") or llm_result.get("content") or "I can help with Apex predictions, slips, calibration, backtests, and engine status. Ask about a prediction or 'why does Apex like this?' while viewing a prediction."
    _emit(EventType.RESPONSE_COMPLETED, {"provider": provider, "model": model, "answer_len": len(fallback_answer), "tool_calls": 0})
    return {
        "answer": fallback_answer,
        "tool_calls": executed,
        "model_used": model,
        "provider_used": provider,
        "prompt_version": PROMPT_VERSION,
        "provenance": {"provider": provider, "model": model, "prompt_version": PROMPT_VERSION},
    }
