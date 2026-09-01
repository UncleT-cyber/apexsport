"""Phase 1 — Canonical Intelligence Contracts + Provenance

Every arrow in the pipeline has an explicit data contract.
No fake data in production paths. Provenance is retained in Prediction.

Pipeline:
  MarketSnapshot → FeatureSnapshot → Specialist (AgentInput→AgentOutput) → Ensemble → Calibration → Value → Risk → Prediction
  Prediction → SlipSelection → Slip

Versioning: pipeline_version / feature_version / model_version / prompt_version are explicit.
"""
from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field

from core.identifiers import new_id
from core.time import utcnow

# ─── Shared ───────────────────────────────────────────────────────────────────
class DataStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    STALE = "stale"
    UNCERTAIN = "uncertain"

PIPELINE_VERSION = "v1"
FEATURE_VERSION = "v1"

# ─── CanonicalFixture ─────────────────────────────────────────────────────────
class CanonicalFixture(BaseModel):
    """Owner: ingestion / normalization — independent of provider."""
    id: str = Field(default_factory=lambda: new_id("fix"))
    sport: str  # football / basketball
    competition: str
    competition_code: Optional[str] = None
    home_team: str
    home_code: str
    away_team: str
    away_code: str
    kickoff_at: datetime
    venue: Optional[str] = None
    status: str = "scheduled"  # scheduled/live/halftime/completed
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}

# ─── MarketSnapshot ───────────────────────────────────────────────────────────
class MarketSnapshotEntry(BaseModel):
    market: str  # canonical: MATCH_RESULT / MONEYLINE / SPREAD / TOTAL_POINTS etc.
    selection: str  # HOME / DRAW / AWAY / OVER_2.5 / HOME_-5.5 etc.
    bookmaker: str
    price_decimal: float
    implied_probability: Optional[float] = None
    captured_at: datetime = Field(default_factory=utcnow)
    is_stale: bool = False
    model_config = {"frozen": True}

class MarketSnapshot(BaseModel):
    """Owner: market/odds — real market data, never uniform random in prod."""
    id: str = Field(default_factory=lambda: new_id("mkt_snap"))
    fixture_id: str
    sport: str
    entries: list[MarketSnapshotEntry] = Field(default_factory=list)
    captured_at: datetime = Field(default_factory=utcnow)
    source: str = "unknown"  # provider name or mock
    status: DataStatus = DataStatus.AVAILABLE
    unavailable_reason: Optional[str] = None
    model_config = {"frozen": True}

    def odds_for(self, market: str, selection: str) -> Optional[MarketSnapshotEntry]:
        for e in self.entries:
            if e.market == market and e.selection == selection:
                return e
        return None

# ─── FeatureSnapshot ──────────────────────────────────────────────────────────
class FeatureGroup(BaseModel):
    name: str  # MATCH_CONTEXT / FORM / TEAM_STRENGTH / AVAILABILITY / MATCHUP / MARKET_CONTEXT
    status: DataStatus = DataStatus.AVAILABLE
    values: dict = Field(default_factory=dict)
    unavailable_reason: Optional[str] = None
    computed_at: datetime = Field(default_factory=utcnow)
    staleness_seconds: Optional[float] = None
    model_config = {"frozen": True}

class FeatureSnapshot(BaseModel):
    """Owner: intelligence/features — retained verbatim in Prediction."""
    id: str = Field(default_factory=lambda: new_id("feat"))
    fixture_id: str
    sport: str
    feature_version: str = FEATURE_VERSION
    groups: list[FeatureGroup] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

    def group(self, name: str) -> Optional[FeatureGroup]:
        for g in self.groups:
            if g.name == name:
                return g
        return None

# ─── Agent I/O ────────────────────────────────────────────────────────────────
class EvidenceItem(BaseModel):
    feature: str
    observation: str
    reasoning: str
    model_config = {"frozen": True}

class AgentInput(BaseModel):
    fixture: CanonicalFixture
    market_snapshot: MarketSnapshot
    feature_snapshot: FeatureSnapshot
    sport: str
    model_config = {"frozen": True}

class AgentOutput(BaseModel):
    """Structured, validated — never arbitrary prose. Rejected if malformed.

    Multi-sport provenance: every output records sport + prompt_version + prompt_path
    so a basketball prediction can be traced to basketball/form/v1 vs football/form/v1.
    """
    specialist_id: str
    sport: str = "football"  # denormalized for traceability (must match AgentInput sport)
    model: str
    model_version: str = "v1"
    prompt_version: str = "v1"
    prompt_path: str = ""  # canonical path: sport/specialist/version  e.g. football/form_sentinel/v1
    prompt_status: str = "available"  # available | not_implemented
    feature_snapshot_id: str
    assessment: str  # short reasoning summary
    probabilities: dict[str, float]  # {"HOME":0.5,"DRAW":0.25,"AWAY":0.25} or {"HOME":0.55,"AWAY":0.45}
    confidence: float = Field(ge=0, le=1)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    key_factors: list[str] = Field(default_factory=list)
    model_metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

# ─── Ensemble ─────────────────────────────────────────────────────────────────
class EnsembleOutput(BaseModel):
    specialist_outputs: list[AgentOutput] = Field(default_factory=list)
    weighting: dict[str, float] = Field(default_factory=dict)  # specialist_id -> weight
    probabilities: dict[str, float] = Field(default_factory=dict)
    disagreement: float = Field(ge=0, le=1, default=0)  # std or range across specialists
    ensemble_confidence: float = Field(ge=0, le=1, default=0)
    version: str = "v1"
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

# ─── Calibration ──────────────────────────────────────────────────────────────
class CalibrationOutput(BaseModel):
    raw_probability: float = Field(ge=0, le=1)
    calibrated_probability: float = Field(ge=0, le=1)
    method: str = "none"  # none / platt / isotonic / bucket
    version: str = "v1"
    is_active: bool = False  # false if insufficient historical data
    brier_score: Optional[float] = None
    inactive_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

# ─── Value ────────────────────────────────────────────────────────────────────
class ValueOutput(BaseModel):
    market_odds: float
    implied_probability: float = Field(ge=0, le=1)
    fair_probability: float = Field(ge=0, le=1)
    fair_odds: float
    edge: float  # calibrated - implied
    ev: float  # calibrated*odds -1
    is_value: bool = False
    version: str = "v1"
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

# ─── Risk ─────────────────────────────────────────────────────────────────────
class RiskOutput(BaseModel):
    selection_risk: str  # LOW/MEDIUM/HIGH/BLOCKED
    risk_score: float = Field(ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)
    exposure: dict = Field(default_factory=dict)
    correlation: float = Field(ge=0, le=1, default=0)
    uncertainty: list[str] = Field(default_factory=list)
    market_conditions: dict = Field(default_factory=dict)
    version: str = "v1"
    created_at: datetime = Field(default_factory=utcnow)
    model_config = {"frozen": True}

# ─── Prediction (traceable chain) ────────────────────────────────────────────
class Prediction(BaseModel):
    """Downstream identity — contains full provenance.

    Provenance chain (must be reconstructable):
        sport → specialist → model → model_version → prompt_version → prompt_path → feature_snapshot_id → pipeline_version

    Inspecting a basketball prediction must show:
        Basketball → Form Specialist → Model X → Prompt basketball/form/v1 → Features basketball
    Not generic: "AI Model: X"
    """
    id: str = Field(default_factory=lambda: new_id("pred"))
    fixture: CanonicalFixture
    market_snapshot: MarketSnapshot
    feature_snapshot: FeatureSnapshot
    specialist_outputs: list[AgentOutput] = Field(default_factory=list)
    ensemble_output: EnsembleOutput
    calibration_output: CalibrationOutput
    value_output: ValueOutput
    risk_output: RiskOutput
    final_selection: str
    final_market: str
    sport: str
    # versioning / traceability (shared contracts, sport-specific intelligence)
    pipeline_version: str = PIPELINE_VERSION
    feature_version: str = FEATURE_VERSION
    model_version: str = "v1"  # ensemble / primary model
    prompt_version: str = "v1"  # aggregated or per-specialist
    # Sport-aware provenance — sport/specialist/model/prompt_version/feature_snapshot_id/pipeline_version
    prompt_paths: dict[str, str] = Field(default_factory=dict)  # specialist_id → prompt_path e.g. football/form_sentinel/v1
    prompt_statuses: dict[str, str] = Field(default_factory=dict)  # specialist_id → available|not_implemented
    provenance: dict = Field(default_factory=dict)  # {sport, primary_model, prompt_paths, feature_snapshot_id, pipeline_version}
    created_at: datetime = Field(default_factory=utcnow)
    # human inspectable
    rationale: Optional[str] = None
    model_config = {"frozen": True}

# ─── Slip ─────────────────────────────────────────────────────────────────────
# Canonical Slip lives in domain/slips/slip.py (BetSlip). Re-export here for
# historical imports — single source of truth, no duplicated model.
# See domain/slips/slip.py:BetSlip for frozen canonical model.
from domain.slips.slip import BetSlip as Slip, SlipSelection as _DomainSlipSelection  # noqa: F401

class SlipSelection(BaseModel):
    """Legacy alias for backwards compat — delegate to domain.SlipSelection.

    New code should import from domain.slips.slip directly.
    This alias ensures `intelligence.contracts.SlipSelection` and `domain.slips.SlipSelection`
    share semantics; field names are normalized via with-helpers below.
    """
    prediction_id: str
    fixture_id: str
    fixture_label: str
    sport: str
    market: str
    selection: str
    odds: float
    calibrated_probability: Optional[float] = None
    edge: Optional[float] = None
    confidence: Optional[float] = None
    risk: Optional[RiskOutput] = None
    model_config = {"frozen": True}

    def to_domain(self) -> _DomainSlipSelection:
        """Convert contracts.SlipSelection → domain.SlipSelection (canonical)."""
        return _DomainSlipSelection(
            event_id=self.fixture_id,
            event_label=self.fixture_label,
            market=self.market,
            selection=self.selection,
            odds=self.odds,
            calibrated_probability=self.calibrated_probability,
            edge=self.edge,
            confidence=self.confidence,
            prediction_id=self.prediction_id,
            sport=self.sport,
        )
