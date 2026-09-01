from core.events.bus import event_bus, EventType
from scanner.modes.manual import run_manual_scan

async def on_injury(event):
    # targeted rescan: affected fixtures only
    fixtures = event.data.get("affected_fixtures", [])
    if fixtures:
        await run_manual_scan(fixtures=[{"id": fid, "label": fid} for fid in fixtures])

def wire_event_triggered():
    event_bus.on(EventType.INJURY_DETECTED, on_injury)
    event_bus.on(EventType.LINEUP_UPDATED, on_injury)
    event_bus.on(EventType.ODDS_UPDATED, on_injury)
