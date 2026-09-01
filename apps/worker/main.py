"""Worker — separate from web/API. Runs scheduled/continuous + event-triggered + news polling.

Do NOT run endless loops inside web server process.
"""
from __future__ import annotations
import asyncio
import os
from core.config.settings import get_settings

async def scheduled_worker():
    from scanner.modes.scheduled import scheduled_loop
    interval = int(os.getenv("SCAN_INTERVAL_SECONDS", str(get_settings().scanner.interval_seconds)))
    await scheduled_loop(interval_seconds=interval)

async def continuous_worker():
    from scanner.modes.continuous import continuous_loop
    await continuous_loop(poll_seconds=60)

async def news_poll_worker():
    """News polling — only runs if a real news provider is configured."""
    from ingestion.collectors.news import ingest_news
    from providers.registry.provider_registry import registry
    from providers.base.provider import ProviderCapability
    news_providers = registry.for_capability(ProviderCapability.NEWS)
    if not news_providers:
        return  # no news provider configured — skip
    while True:
        try:
            for p in news_providers:
                if p.is_configured():
                    try:
                        raw = await p.fetch_news()
                        if raw:
                            await ingest_news(raw, sport="football")
                    except Exception:
                        continue
        except Exception:
            pass
        await asyncio.sleep(300)

async def live_poll_worker():
    from ingestion.collectors.live import poll_live
    while True:
        try:
            await poll_live("football")
            await poll_live("basketball")
        except Exception:
            pass
        await asyncio.sleep(15)

async def main():
    mode = os.getenv("APEXSPORT_WORKER_MODE", "scheduled")  # scheduled|continuous|all
    # wire event-triggered once
    try:
        from scanner.modes.event_triggered import wire_event_triggered
        wire_event_triggered()
    except Exception:
        pass

    tasks = []
    if mode in ("scheduled","all"):
        tasks.append(asyncio.create_task(scheduled_worker()))
    if mode in ("continuous","all"):
        tasks.append(asyncio.create_task(continuous_worker()))
    tasks.append(asyncio.create_task(news_poll_worker()))
    tasks.append(asyncio.create_task(live_poll_worker()))
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
