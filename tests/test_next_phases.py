import pytest
from ingestion.freshness import compute_freshness, ttl_for_status
from ingestion.collectors.news import normalize_news, deduplicate, ingest_news
from scanner.invalidation import affected_nodes, invalidate_for_event
from analytics.calibration.service import calibration_report, clear, record_prediction, record_outcome

def test_freshness_ttl():
    assert ttl_for_status("live") == 10
    assert ttl_for_status("scheduled") == 120
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    f = compute_freshness(now, "live")
    assert not f["is_stale"]
    assert f["label"] == "fresh"

def test_news_pipeline():
    raw = {"title":"Arsenal injury doubt for Chelsea","body":"Saka hamstring","source":"BBC"}
    item = normalize_news(raw)
    assert "ARS" in item.entities or item.relevance_score == 0.9
    # dedup
    items = [item, item]
    deduped = deduplicate([item, item.model_copy(update={"id":"dup2"})])
    # second has same dedup_key -> filtered
    assert len(deduped) == 1

@pytest.mark.asyncio
async def test_news_ingest_emits():
    from core.cache import cache
    cache.invalidate_prefix("news:")
    test_items = [
        {"title":"Injury doubt for upcoming match","body":"Key player hamstring","source":"BBC"},
        {"title":"Coach confirms lineup","body":"No surprises expected","source":"Sky"},
        {"title":"Transfer confirmed","body":"Deal done","source":"ESPN"},
    ]
    ranked = await ingest_news(test_items, sport="football")
    assert len(ranked) == 3
    assert ranked[0].relevance_score >= 0.5

def test_invalidation_graph():
    assert "fixtures" in affected_nodes("MATCH_STARTED")
    assert "value" in affected_nodes("ODDS_UPDATED")
    # incremental check
    from scanner.invalidation import is_incremental
    assert is_incremental("NEWS_RECEIVED")
    assert not is_incremental("MATCH_FINISHED")

def test_calibration_buckets():
    clear()
    record_prediction({"fixture_id":"f1","selection":"HOME","probability":0.6,"calibrated_probability":0.62,"sport":"football"})
    record_prediction({"fixture_id":"f2","selection":"AWAY","probability":0.4,"calibrated_probability":0.38,"sport":"football"})
    record_outcome("f1","HOME")
    record_outcome("f2","HOME")
    rep = calibration_report(sport="football")
    assert rep["total_predictions"] == 2
    assert rep["resolved"] == 2
    assert rep["brier_score"] is not None
    assert len(rep["curve"]) == 10
    clear()
