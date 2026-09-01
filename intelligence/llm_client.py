"""LLM client for specialists — OpenAI-compatible (HuggingFace Router, OpenAI, Groq, OpenRouter).

No hardcoded model names. Uses active LLM from brain (provider/model/base_url/api_key).
Structured output via JSON mode.
"""
from __future__ import annotations
import json
import httpx
from typing import Optional

async def call_llm(
    prompt_template: str,
    variables: dict,
    provider: str,
    model: str,
    base_url: str,
    api_key: str,
    timeout: float = 15,
) -> dict:
    """Call LLM with prompt_template rendered with variables, return parsed JSON."""
    # Render template by simple .format (prompt files use {fixture_id} etc.)
    try:
        prompt = prompt_template.format(**variables)
    except Exception:
        prompt = prompt_template

    # For HuggingFace Router, OpenAI, Groq, OpenRouter — all OpenAI-compatible
    # Anthropic and Gemini have different APIs — handle separately
    base = base_url.rstrip("/")
    if provider == "anthropic":
        # Anthropic Messages API
        url = f"{base}/v1/messages" if not base.endswith("/v1") else f"{base}/messages"
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        body = {
            "model": model,
            "max_tokens": 800,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            text = data.get("content", [{}])[0].get("text", "") if isinstance(data.get("content"), list) else data.get("content", "")
            # Try to extract JSON from text
            try:
                # Find JSON object in text
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
                return json.loads(text)
            except Exception:
                raise ValueError(f"LLM did not return JSON: {text[:500]}")
    elif provider == "gemini":
        url = f"{base}/v1beta/models/{model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
            resp.raise_for_status()
            data = resp.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            try:
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
                return json.loads(text)
            except Exception:
                raise ValueError(f"Gemini did not return JSON: {text[:500]}")
    else:
        # OpenAI-compatible: HuggingFace Router, OpenAI, Groq, OpenRouter
        url = f"{base}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        # For HuggingFace Router, also ensure correct base
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a sports intelligence specialist. Respond with ONLY valid JSON, no markdown."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 800,
        }
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            # OpenAI compatible returns choices[0].message.content
            text = ""
            if "choices" in data:
                text = data["choices"][0].get("message", {}).get("content", "") or data["choices"][0].get("text", "")
            elif "content" in data:
                text = str(data["content"])
            else:
                text = json.dumps(data)
            # Extract JSON
            try:
                # Handle markdown code blocks
                if "```json" in text:
                    start = text.find("```json") + 7
                    end = text.find("```", start)
                    text = text[start:end]
                elif "```" in text:
                    start = text.find("```") + 3
                    end = text.find("```", start)
                    text = text[start:end]
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
                return json.loads(text)
            except Exception as e:
                raise ValueError(f"LLM did not return JSON for {provider}:{model}: {text[:500]} — {e}")
