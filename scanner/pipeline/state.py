"""Scanner state — mirrors ApexLoop ScannerStateService but for fixtures."""
from __future__ import annotations
import asyncio
import time
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class ScannerState(str, Enum):
    IDLE = "IDLE"
    INITIALIZING = "INITIALIZING"
    FETCHING_DATA = "FETCHING_DATA"
    SCANNING = "SCANNING"
    PROCESSING = "PROCESSING"
    GENERATING_PREDICTIONS = "GENERATING_PREDICTIONS"
    COMPLETE = "COMPLETE"
    ERROR = "ERROR"

class FixtureStatus(BaseModel):
    fixture_id: str
    label: str  # "ARS vs CHE"
    status: str = "WAITING"  # WAITING/FETCHING/ANALYZING/COMPLETE/FAILED
    provider: Optional[str] = None
    error: Optional[str] = None

class PipelineStageInfo(BaseModel):
    stage: str
    status: str = "WAITING"
    fixture_id: Optional[str] = None
    detail: Optional[str] = None

class ScannerEvent(BaseModel):
    timestamp: float
    category: str
    message: str
    fixture_id: Optional[str] = None
    status: str = "INFO"

class ScannerSnapshot(BaseModel):
    state: ScannerState = ScannerState.IDLE
    is_scanning: bool = False
    current_fixture: Optional[str] = None
    fixtures_completed: int = 0
    fixtures_total: int = 0  # no hardcoded fixture count — real universe size, 0 before scan
    fixtures: list[FixtureStatus] = Field(default_factory=list)
    pipeline_stages: list[PipelineStageInfo] = Field(default_factory=list)
    current_pipeline_stage: Optional[str] = None
    provider_in_use: Optional[str] = None
    predictions_generated: int = 0
    candidates_rejected: int = 0
    value_opportunities: int = 0
    last_prediction: Optional[dict] = None
    recent_predictions: list[dict] = Field(default_factory=list)
    events: list[ScannerEvent] = Field(default_factory=list)
    scan_started_at: Optional[float] = None
    last_scan_completed_at: Optional[float] = None
    scan_duration_ms: Optional[float] = None
    total_scans: int = 0
    total_predictions: int = 0
    total_rejected: int = 0
    error_count: int = 0
    last_error: Optional[str] = None
    # Universe vs Batch telemetry (directive: Available Universe → Selected Scan Scope → Eligible → Batches)
    available_universe: int = 0
    eligible_count: int = 0
    batch_size: int = 20
    batches_total: int = 0
    current_batch: int = 0
    scan_scope: Optional[dict] = None  # {sport, league, date_from, date_to}
    scan_sport: Optional[str] = None
    scan_league: Optional[str] = None
    stage_counts: Optional[dict] = None  # {discovered, eligible, feature_ready, specialist_ok, ensemble_ok, calibrated, value_ok, risk_ok, predictions}
    scan_run_id: Optional[str] = None
    last_rejections: list[dict] = Field(default_factory=list)  # recent structured rejections for UI

_scanner_state: Optional["ScannerStateService"] = None

class ScannerStateService:
    def __init__(self) -> None:
        self._state = ScannerSnapshot()
        self._lock = asyncio.Lock()
        self._events: list[ScannerEvent] = []
        self._max_events = 150

    @property
    def state(self) -> ScannerSnapshot:
        return self._state

    async def start_scan(
        self,
        fixtures: list[dict],
        scope: Optional[dict] = None,
        available_universe: Optional[int] = None,
        eligible_count: Optional[int] = None,
        batch_size: int = 20,
        batch_index: int = 0,
    ) -> None:
        async with self._lock:
            from core.identifiers import new_id
            scan_run_id = new_id("scan")
            self._state.scan_run_id = scan_run_id
            self._state.state = ScannerState.INITIALIZING
            self._state.is_scanning = True
            self._state.fixtures_completed = 0
            self._state.fixtures_total = len(fixtures)
            self._state.fixtures = [FixtureStatus(fixture_id=f["id"], label=f.get("label", f["id"])) for f in fixtures]
            self._state.pipeline_stages = []
            self._state.current_pipeline_stage = None
            self._state.predictions_generated = 0
            self._state.candidates_rejected = 0
            self._state.value_opportunities = 0
            self._state.last_prediction = None
            self._state.recent_predictions = []
            self._state.events = []
            self._state.scan_started_at = time.time()
            self._state.scan_duration_ms = None
            self._state.error_count = 0
            self._state.last_error = None
            self._state.last_rejections = []
            # Universe vs Batch telemetry
            self._state.available_universe = available_universe if available_universe is not None else len(fixtures)
            self._state.eligible_count = eligible_count if eligible_count is not None else len(fixtures)
            self._state.batch_size = batch_size
            self._state.batches_total = (self._state.eligible_count + batch_size - 1)//batch_size if batch_size else 1
            self._state.current_batch = batch_index
            self._state.scan_scope = scope
            self._state.scan_sport = (scope or {}).get("sport")
            self._state.scan_league = (scope or {}).get("league")
            self._state.stage_counts = {
                "discovered": self._state.available_universe,
                "eligible": self._state.eligible_count,
                "batch_size": batch_size,
                "batches_total": self._state.batches_total,
                "current_batch": batch_index,
                "scanning": f"{0} / {self._state.eligible_count}" if self._state.eligible_count else "0 / 0",
            }
            # Clear any prior rejections for new scan (keep global store for analytics, but reset per-scan view)
            try:
                from scanner.rejection_store import clear as _clear_rej
                # Do not clear global, just ensure new scan_run_id will be used
                pass
            except Exception:
                pass
            scope_str = f"sport={scope.get('sport')}" if scope else f"{len(fixtures)} fixtures"
            if scope and scope.get("league"):
                scope_str += f" league={scope.get('league')}"
            self._add_event("SCANNER", f"Scan started — scope {scope_str} — ELIGIBLE: {self._state.eligible_count} (universe {self._state.available_universe}) batch {batch_index+1}/{self._state.batches_total} size {batch_size} run {scan_run_id}")

    async def set_state(self, s: ScannerState) -> None:
        async with self._lock:
            self._state.state = s

    async def update_fixture_status(self, fid: str, status: str, provider: Optional[str] = None, error: Optional[str] = None) -> None:
        async with self._lock:
            self._state.current_fixture = fid
            for f in self._state.fixtures:
                if f.fixture_id == fid:
                    f.status = status
                    if provider:
                        f.provider = provider
                    if error:
                        f.error = error
                    break
            if status == "COMPLETE":
                self._state.fixtures_completed += 1
                self._add_event("DATA", f"{fid} data ready", fid, "SUCCESS")
            elif status == "FETCHING":
                self._add_event("DATA", f"Fetching {fid}...", fid, "INFO")
            elif status == "FAILED":
                self._add_event("DATA", f"{fid} failed: {error}", fid, "ERROR")

    async def update_pipeline_stage(self, stage: str, fid: str, status: str = "ACTIVE", detail: Optional[str] = None) -> None:
        async with self._lock:
            self._state.current_pipeline_stage = stage
            found = False
            for ps in self._state.pipeline_stages:
                if ps.stage == stage and ps.fixture_id == fid:
                    ps.status = status
                    if detail:
                        ps.detail = detail
                    found = True
                    break
            if not found:
                self._state.pipeline_stages.append(PipelineStageInfo(stage=stage, status=status, fixture_id=fid, detail=detail))
            cat_map = {
                "DATA": "DATA", "FEATURES": "FEATURES", "MATCH_CONTEXT": "CONTEXT",
                "FORM": "FORM", "TEAM_STRENGTH": "STRENGTH", "AVAILABILITY": "AVAILABILITY",
                "MATCHUP": "MATCHUP", "AI_BRAIN": "AI_BRAIN", "ENSEMBLE": "ENSEMBLE",
                "CALIBRATION": "CALIBRATION", "VALUE": "VALUE", "RISK": "RISK", "PREDICTION": "PREDICTION",
            }
            cat = cat_map.get(stage, "SCANNER")
            if status == "ACTIVE":
                self._add_event(cat, f"{fid} — {stage}", fid, "INFO")
            elif status == "COMPLETE":
                self._add_event(cat, f"{fid} — {stage} complete", fid, "SUCCESS")
            elif status == "FAILED":
                self._add_event(cat, f"{fid} — {stage} failed", fid, "ERROR")

    async def record_prediction(self, pred: dict) -> None:
        async with self._lock:
            self._state.predictions_generated += 1
            self._state.total_predictions += 1
            self._state.last_prediction = pred
            self._state.recent_predictions.insert(0, pred)
            self._state.recent_predictions = self._state.recent_predictions[:20]
            fid = pred.get("fixture_id", "?")
            sel = pred.get("selection", "?")
            conf = pred.get("calibrated_probability", pred.get("probability", 0))
            self._add_event("PREDICTION", f"PREDICTION: {sel} {fid} {conf*100:.0f}%", fid, "SUCCESS")
            if pred.get("is_value"):
                self._state.value_opportunities += 1

    async def record_rejection(
        self,
        fid: str,
        reason: str,
        rejection_code: str | None = None,
        rejection_stage: str | None = None,
        fixture: dict | None = None,
        feature_snapshot_id: str | None = None,
        market_snapshot_id: str | None = None,
        pipeline_trace: list[dict] | None = None,
    ) -> None:
        async with self._lock:
            self._state.candidates_rejected += 1
            self._state.total_rejected += 1
            # Structured code derivation if not provided
            code = rejection_code or self._derive_rejection_code(reason, rejection_stage)
            stage = rejection_stage or self._derive_rejection_stage(reason, code)
            # Truncate reason for event
            self._add_event("RISK", f"{fid} rejected [{code}@{stage}]: {reason}", fid, "WARNING")
            # Also add to last_rejections for immediate UI
            # Build pipeline trace from current stages for this fixture if not provided
            trace = pipeline_trace
            if trace is None:
                trace = [
                    {"stage": ps.stage, "status": ps.status, "detail": ps.detail}
                    for ps in self._state.pipeline_stages
                    if ps.fixture_id == fid
                ]
            # Resolve fixture metadata for persistence
            label = fixture.get("label", fid) if fixture else fid
            sport = (fixture or {}).get("sport", self._state.scan_sport)
            comp = (fixture or {}).get("competition", "Unknown")
            kickoff = (fixture or {}).get("kickoff_at")
            # Save to structured store
            try:
                from scanner.rejection_store import save_rejection
                rec = save_rejection(
                    scan_run_id=self._state.scan_run_id or "no_run",
                    fixture_id=fid,
                    fixture_label=label,
                    sport=sport,
                    competition=comp,
                    rejection_code=code,
                    rejection_stage=stage,
                    rejection_reason=reason[:300],
                    pipeline_trace=trace,
                    feature_snapshot_id=feature_snapshot_id,
                    market_snapshot_id=market_snapshot_id,
                    timestamp=time.time(),
                    kickoff_at=str(kickoff) if kickoff else None,
                )
                # Keep per-scan view (last 50)
                self._state.last_rejections.append(rec)
                if len(self._state.last_rejections) > 50:
                    self._state.last_rejections = self._state.last_rejections[-50:]
            except Exception:
                pass

    def _derive_rejection_code(self, reason: str, stage: str | None) -> str:
        low = reason.lower()
        if "sport mismatch" in low or "invalid market" in low or "no market semantics" in low or "invalid basketball" in low:
            return "INVALID_MARKET"
        if "stale" in low:
            return "STALE_DATA"
        if "risk" in low and "blocked" in low:
            return "RISK_BLOCKED"
        if "low value" in low or "edge" in low and "thin edge" in low:
            return "LOW_VALUE"
        if "calibration" in low and ("insufficient" in low or "unavailable" in low):
            return "CALIBRATION_UNAVAILABLE"
        if "ensemble" in low or "no specialist probabilities" in low:
            return "ENSEMBLE_INVALID"
        if "feature" in low and ("incomplete" in low or "unavailable" in low):
            return "INSUFFICIENT_DATA"
        if "llm" in low or "timeout" in low or "agent failed" in low or "exception" in low or "malformed" in low or "no specialist outputs" in low:
            return "TECHNICAL_FAILURE"
        if "insufficient" in low and "data" in low:
            return "INSUFFICIENT_DATA"
        if stage == "AI_BRAIN" or stage == "ENSEMBLE":
            return "INTELLIGENCE_INCOMPLETE"
        return "TECHNICAL_FAILURE"

    def _derive_rejection_stage(self, reason: str, code: str) -> str:
        low = reason.lower()
        if "stale" in low:
            return "DATA"
        if "sport mismatch" in low or "market" in low:
            return "DATA"
        if "feature" in low:
            return "FEATURES"
        if "llm" in low or "specialist" in low or "agent" in low:
            return "AI_BRAIN"
        if "ensemble" in low:
            return "ENSEMBLE"
        if "calibration" in low:
            return "CALIBRATION"
        if "value" in low or "edge" in low:
            return "VALUE"
        if "risk" in low:
            return "RISK"
        # Use code mapping
        mapping = {
            "INSUFFICIENT_DATA": "FEATURES",
            "INTELLIGENCE_INCOMPLETE": "AI_BRAIN",
            "ENSEMBLE_INVALID": "ENSEMBLE",
            "CALIBRATION_UNAVAILABLE": "CALIBRATION",
            "LOW_VALUE": "VALUE",
            "RISK_BLOCKED": "RISK",
            "TECHNICAL_FAILURE": "AI_BRAIN",
            "INVALID_MARKET": "DATA",
            "STALE_DATA": "DATA",
        }
        return mapping.get(code, "PREDICTION")

    async def complete_scan(self) -> None:
        async with self._lock:
            self._state.state = ScannerState.COMPLETE
            self._state.is_scanning = False
            self._state.current_fixture = None
            self._state.current_pipeline_stage = None
            self._state.last_scan_completed_at = time.time()
            if self._state.scan_started_at:
                self._state.scan_duration_ms = (time.time() - self._state.scan_started_at) * 1000
            self._state.total_scans += 1
            self._add_event("SCANNER", f"Scan complete — {self._state.predictions_generated} predictions, {self._state.candidates_rejected} rejected")
            await asyncio.sleep(2)
            self._state.state = ScannerState.IDLE

    async def record_error(self, error: str) -> None:
        async with self._lock:
            self._state.state = ScannerState.ERROR
            self._state.is_scanning = False
            self._state.error_count += 1
            self._state.last_error = error
            self._add_event("SCANNER", f"Error: {error}", None, "ERROR")

    def _add_event(self, category: str, message: str, fid: Optional[str] = None, status: str = "INFO") -> None:
        evt = ScannerEvent(timestamp=time.time(), category=category, message=message, fixture_id=fid, status=status)
        self._events.append(evt)
        self._state.events = self._events[-self._max_events:]

    def get_snapshot(self) -> ScannerSnapshot:
        return self._state.model_copy()

def get_scanner_state() -> ScannerStateService:
    global _scanner_state
    if _scanner_state is None:
        _scanner_state = ScannerStateService()
    return _scanner_state
