"""Supabase REST client — uses httpx, no extra dependencies.

Calls PostgREST API directly. Requires:
  SUPABASE_URL — e.g. https://xyz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY — service_role key (full access, bypasses RLS)
"""
from __future__ import annotations

import os
from typing import Any, Optional

import httpx

_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None or _client.is_closed:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _client = httpx.Client(
            base_url=f"{url}/rest/v1",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            timeout=30.0,
        )
    return _client


def is_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL")) and bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


# ─── Generic CRUD ────────────────────────────────────────────────────────────

def insert(table: str, row: dict) -> dict:
    r = _get_client().post(f"/{table}", json=row)
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) else data


def upsert(table: str, row: dict, on_conflict: str = "id") -> dict:
    r = _get_client().post(
        f"/{table}",
        json=row,
        params={"on_conflict": on_conflict},
    )
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) else data


def select(table: str, filters: Optional[dict] = None, order: Optional[str] = None, limit: int = 100) -> list[dict]:
    params: dict[str, Any] = {"limit": limit}
    if order:
        params["order"] = order
    if filters:
        # PostgREST filter syntax: col=eq.value
        for k, v in filters.items():
            if v is None:
                params[k] = "is.null"
            else:
                params[k] = f"eq.{v}"
    r = _get_client().get(f"/{table}", params=params)
    r.raise_for_status()
    return r.json()


def select_one(table: str, filters: dict) -> Optional[dict]:
    rows = select(table, filters, limit=1)
    return rows[0] if rows else None


def update(table: str, filters: dict, patch: dict) -> list[dict]:
    params: dict[str, Any] = {}
    for k, v in filters.items():
        if v is None:
            params[k] = "is.null"
        else:
            params[k] = f"eq.{v}"
    r = _get_client().patch(f"/{table}", json=patch, params=params)
    r.raise_for_status()
    return r.json()


def delete(table: str, filters: dict) -> list[dict]:
    params: dict[str, Any] = {}
    for k, v in filters.items():
        if v is None:
            params[k] = "is.null"
        else:
            params[k] = f"eq.{v}"
    r = _get_client().delete(f"/{table}", params=params)
    r.raise_for_status()
    return r.json()


def rpc(function_name: str, params: Optional[dict] = None) -> Any:
    """Call a Supabase Edge Function / database function."""
    r = _get_client().post(f"/rpc/{function_name}", json=params or {})
    r.raise_for_status()
    return r.json()
