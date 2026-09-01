from scanner.modes.manual import run_manual_scan
async def run_targeted_scan(fixture_ids: list[str]):
    fixtures = [{"id": fid, "label": fid} for fid in fixture_ids]
    return await run_manual_scan(fixtures=fixtures)
