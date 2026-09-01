"""Sportmonks News Provider — structured football news via Sportmonks News API.

Tries:
  GET https://api.sportmonks.com/v3/news?api_token=KEY
  GET https://api.sportmonks.com/v3/football/news?api_token=KEY
Maps to CanonicalNewsArticle.

If subscription does not include News API, returns empty (graceful fallback, not error).
"""
from __future__ import annotations
import httpx
from datetime import datetime, timezone
from typing import Optional
from core.config.settings import get_runtime_settings

async def fetch_sportmonks_news(sport: str = "football", limit: int = 12) -> list[dict]:
    settings = get_runtime_settings().sportmonks
    base = (settings.base_url or "https://api.sportmonks.com/v3").rstrip("/")
    key = settings.api_key
    if not key:
        return []
    # Endpoints to try (Sportmonks docs vary)
    endpoints = [
        f"{base}/news",
        f"{base}/football/news",
        f"{base}/news/football",
    ]
    async with httpx.AsyncClient(timeout=10) as client:
        for url in endpoints:
            try:
                resp = await client.get(url, params={"api_token": key, "per_page": limit, "include": "league;fixture"})
                if resp.status_code == 200:
                    data = resp.json()
                    raw_list = data.get("data", [])
                    out = []
                    for r in raw_list[:limit]:
                        # Map Sportmonks raw news to canonical-ish raw dict for ingestion
                        title = r.get("title") or r.get("name") or r.get("headline") or ""
                        body = r.get("body") or r.get("content") or r.get("summary") or ""
                        # Sportmonks news may have league/fixture linkage
                        league = (r.get("league") or {}).get("name") if isinstance(r.get("league"), dict) else None
                        fixture = r.get("fixture") or {}
                        fid = fixture.get("id") if isinstance(fixture, dict) else None
                        image = r.get("image_path") or r.get("image")
                        published = r.get("created_at") or r.get("updated_at") or r.get("publish_at")
                        out.append({
                            "id": str(r.get("id") or r.get("news_id") or ""),
                            "title": title,
                            "body": body,
                            "summary": body[:200] if body else "",
                            "sport": sport,
                            "league": league,
                            "fixture_id": str(fid) if fid else None,
                            "image_url": image,
                            "published_at": published,
                            "source": "Sportmonks",
                            "source_url": r.get("url"),
                            "type": r.get("type", "general"),
                        })
                    if out:
                        return out
                # If 401/403, no access — try next endpoint, but don't loop forever
                if resp.status_code in (401, 403):
                    continue
            except Exception:
                continue
    return []
