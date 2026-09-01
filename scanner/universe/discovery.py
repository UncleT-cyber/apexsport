"""Universe discovery — fixtures for upcoming window.

Returns ONLY real fixtures from configured providers.
When no provider is configured, returns empty list.
Never fabricates fixtures. Provider failure does not silently become 0 without telemetry.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
import time

# Simple in-memory cache for last successful fixtures per sport+league (to survive rate-limit window)
_last_success_cache: dict[str, tuple[list[dict], float]] = {}
_last_telemetry: dict[str, list[dict]] = {}
_CACHE_TTL = 600  # 10 minutes stale cache acceptable for UI (marked is_stale)

async def discover_fixtures(
    sport: str = "football",
    league: str | None = None,
    days: int = 7,
    date_from=None,
    date_to=None,
) -> list[dict]:
    """Provider Capability Resolver → Adapter → Canonical → Deduplication.

    Resolves providers by required capability (FIXTURES), sport, health, priority, configuration.
    Collects from ALL healthy providers, deduplicates, validates sport/league, returns canonical fixtures.
    Never fabricates. The Odds API is ODDS only — not used here.
    """
    from datetime import datetime, timedelta, timezone
    from providers.registry.provider_registry import registry
    from providers.base.provider import ProviderCapability, ProviderStatus

    if date_from is None:
        date_from = datetime.now(timezone.utc)
    if date_to is None:
        date_to = date_from + timedelta(days=days)

    # Resolve providers: FIXTURES capability, configured, healthy prioritized
    all_providers = registry.for_capability(ProviderCapability.FIXTURES)
    # Filter to configured only
    configured = [p for p in all_providers if p.is_configured()]
    if not configured:
        return []

    # Check health where available (use cached health if present, else assume configured is healthy)
    healthy: list = []
    degraded: list = []
    for p in configured:
        try:
            h = await p.health()
            # Consider CONFIGURED and CONNECTED as healthy enough to try; ERROR/DEGRADED still tried but lower priority
            if h.is_healthy or h.status in (ProviderStatus.CONFIGURED, ProviderStatus.CONNECTED):
                healthy.append(p)
            else:
                degraded.append(p)
        except Exception:
            healthy.append(p)
    # Priority order: healthy first (already sorted by registry priority), then degraded
    ordered = healthy + degraded

    # Collect from ALL healthy providers (hot-swappable, not first-only)
    collected: list[dict] = []
    provider_telemetry: list[dict] = []
    for p in ordered:
        try:
            try:
                raw = await p.fetch_fixtures(date_from=date_from, date_to=date_to)
            except TypeError:
                raw = await p.fetch_fixtures()
            count = len(raw) if isinstance(raw, list) else 0
            provider_telemetry.append({"provider": p.name, "status": "ACTIVE" if count else "EMPTY", "count": count})
            if not raw:
                continue
            for f in raw:
                # Keep raw with provider tag for dedup tracing
                f["_provider"] = p.name
                collected.append(f)
        except Exception as e:
            provider_telemetry.append({"provider": p.name, "status": "DEGRADED", "error": str(e)[:80]})
            continue

    cache_key = f"{sport}|{league or 'All'}"
    if not collected:
        # No provider returned data — try stale cache (survive 429 window)
        if cache_key in _last_success_cache:
            cached, ts = _last_success_cache[cache_key]
            if time.time() - ts < _CACHE_TTL:
                _last_telemetry[cache_key] = [{"provider": "cache", "status": "STALE", "count": len(cached), "note": "Rate-limited, serving stale cache"}]
                for f in cached:
                    f["is_stale"] = True
                return cached
        _last_telemetry[cache_key] = provider_telemetry
        return []

    # Canonicalization + sport/league validation + deduplication
    # Deduplicate by normalized key: home+away+date (ignore competition string variance to avoid Sportmonks vs ApiFootball duplicate)
    seen: dict[str, dict] = {}
    for f in collected:
        # Sport correctness at canonical boundary
        f_sport = f.get("sport", sport)
        if f_sport != sport:
            continue
        if league and league != "All Leagues" and f.get("competition") != league and str(f.get("competition_code","")) != str(league):
            continue
        # Build dedup key — home+away+date only (competition name variance across providers)
        home = (f.get("home") or f.get("home_team") or "").strip().lower()
        away = (f.get("away") or f.get("away_team") or "").strip().lower()
        kickoff = str(f.get("kickoff_at") or f.get("starting_at") or "")[:10]
        key = f"{home}|{away}|{kickoff}"
        # Use first occurrence, but merge provider provenance
        if key not in seen:
            fid = f.get("id") or f"evt_{len(seen)}"
            label = f.get("label") or f"{f.get('home','H')} vs {f.get('away','A')}"
            canonical = {
                "id": fid,
                "label": label,
                **{k: v for k, v in f.items() if not k.startswith("_")},
                "sport": sport,
                "provider": f.get("_provider", "unknown"),
                "providers": {f.get("_provider", "unknown"): f.get("external_ids", {}).get(f.get("_provider","")) or fid},
                "snapshot_at": datetime.now(timezone.utc).isoformat(),
            }
            canonical.setdefault("competition", f.get("competition", "Unknown"))
            canonical.setdefault("home_team", f.get("home") or f.get("home_team", "Home"))
            canonical.setdefault("away_team", f.get("away") or f.get("away_team", "Away"))
            canonical.setdefault("kickoff_at", f.get("kickoff_at") or f.get("starting_at"))
            seen[key] = canonical
        else:
            # Merge provenance: same fixture from second provider
            existing = seen[key]
            prov = f.get("_provider", "unknown")
            # Keep external_ids map
            if "providers" not in existing:
                existing["providers"] = {}
            existing["providers"][prov] = f.get("external_ids", {}).get(prov) or f.get("id")
            # Also keep sources list for telemetry
            existing.setdefault("sources", [existing.get("provider")])
            if prov not in existing["sources"]:
                existing["sources"].append(prov)

    out = list(seen.values())
    # Sort by kickoff
    out.sort(key=lambda x: x.get("kickoff_at") or "")
    # Cache successful result for rate-limit survival
    if out:
        _last_success_cache[cache_key] = (out, time.time())
        _last_telemetry[cache_key] = provider_telemetry
        return out
    # Empty after filtering (e.g., league not found) — try stale cache instead of 0
    if cache_key in _last_success_cache:
        cached, ts = _last_success_cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            _last_telemetry[cache_key] = [{"provider": "cache", "status": "STALE", "count": len(cached), "note": "Falling back to stale cache (filtered empty)"}] + provider_telemetry
            for f in cached:
                f["is_stale"] = True
            return cached
    _last_telemetry[cache_key] = provider_telemetry
    return out


def get_last_discovery_telemetry(sport: str = "football", league: str | None = None) -> list[dict]:
    """Expose last provider telemetry for failure reporting (ACTIVE/DEGRADED per provider)."""
    key = f"{sport}|{league or 'All'}"
    return _last_telemetry.get(key, [])
