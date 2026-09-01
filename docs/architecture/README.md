# Apex Sports Architecture

## Observation Audit (ApexLoop reference)

| ApexLoop Component | What it does | Domain-independent pattern | Apex Sports equivalent | Adaptation |
|---|---|---|---|---|
| Provider base + health | Abstract market data providers | Capability enum + health + priority + fallback | `providers/base/provider.py` + `providers/registry/` | FIXTURES/ODDS/LIVE/NEWS capabilities |
| EventBus + EventType | Decoupled SCAN/SIGNAL/RISK pipeline | In-process + redis broadcaster | `core/events/bus.py` + `apps/api/websocket.py` | sports types: FIXTURE_UPDATED, ODDS_UPDATED, PREDICTION_CREATED, INJURY_DETECTED |
| ScannerStateService | Single source of truth for scan | State machine + Snapshot + events list | `scanner/pipeline/state.py` | Fixtures not symbols; 13-stage pipeline |
| ScannerPage radar canvas | Conic sweep + ripples + dot status | Canvas animation tied to is_scanning | `apps/web/src/pages/ScannerPage.tsx` | green palette; VALUE/RISK stages |
| App shell sidebar | Collapsible nav + status dot | Layout + CLSX collapsed classes | `apps/web/src/App.tsx` | Dashboard/Scanner/Predictions/Slips/Analytics/Backtest/Settings |
| Config hierarchy | settings.json > env > defaults | `get_settings` + `get_runtime_settings` | `core/config/settings.py` | Provider keys, agent toggles, LLM model selection |
| Data fresh vs stale | DataFreshness metadata | freshness attached to every response | `providers/base/provider.py` | sports freshness 60s, odds stale after 10s |

## Pipeline (13 stages)

```
PROVIDER → ADAPTER → CANONICAL DATA
    ↓
SPORTS UNIVERSE (discovery.py — real providers only, empty if none configured)
    ↓
DATA (MarketSnapshot — real odds from providers, UNAVAILABLE if none)
    ↓
FEATURES (FeatureSnapshot — 6 groups, UNAVAILABLE when no feed exists)
    ↓
SPECIALISTS (6 agents × 2 sports — LLM or is_stub=True with confidence=0)
    ↓
ENSEMBLE (deterministic weighted average by confidence, disagreement = std × 2)
    ↓
CALIBRATION (raw vs calibrated, is_active, Brier score, bucket correction)
    ↓
VALUE (deterministic: edge = calibrated − implied, EV, fair odds)
    ↓
RISK (deterministic: LOW/MED/HIGH/BLOCKED, correlation-aware)
    ↓
PREDICTION (full provenance: fixture + market_snapshot + feature_snapshot
            + 6 specialist_outputs + ensemble + calibration + value + risk)
    ↓
SLIP (correlation-aware optimizer, sportsbook export at edge)
```

## Data Flow Rules

1. **No fabricated data** — every fixture, odd, news item comes from a real provider or is UNAVAILABLE
2. **No uniform random** — no `rng.uniform()`, no `rng.choice()`, no seed-based stubs
3. **No hardcoded fixtures** — `discover_fixtures()` returns empty when no provider configured
4. **No hardcoded odds** — `collect_odds()` returns empty when no provider configured
5. **No hardcoded mock results** — backtest requires real outcome data via `POST /api/analytics/outcome`
6. **UNAVAILABLE is valid** — FeatureSnapshot groups, MarketSnapshot, agents all have DataStatus.UNAVAILABLE
7. **is_stub=True** — agents that fail or have no LLM return zero confidence, pipeline skips them
8. **Prediction requires real specialists** — pipeline returns None when no specialist outputs exist

## Key Decisions

- **Canonical domain** distinct from provider raw (normalization + entity resolution preserves external_ids)
- **Value/Risk deterministic** (`market/value.py`, `risk/engine.py`) — never LLM
- **Sports registry extensible** (`sports/registry.py`) — football first, basketball added, core sport-agnostic
- **Scanner modes**: manual (implemented), scheduled/continuous/event-triggered (wired)
- **Frontend consumes only canonical DTOs** — no provider credentials in browser
- **Brain reads live settings** — no hardcoded model names, no hardcoded agent lists
- **Slip optimizer is explainable** — correlation, exposure, composition all deterministically scored
- **Booking codes are external references only** — never invented by Apex Sports

## Intelligence Contracts (`intelligence/contracts.py`)

All pipeline data types are Pydantic models with full provenance:

| Contract | Purpose |
|---|---|
| `MarketSnapshot` | Real odds from providers (entries, status, source) |
| `FeatureSnapshot` | 6 feature groups with DataStatus (AVAILABLE/UNAVAILABLE/STALE/UNCERTAIN) |
| `AgentInput` | Input to specialist (fixture + features + market) |
| `AgentOutput` | Specialist output (probabilities, confidence, evidence, warnings, is_stub) |
| `EnsembleOutput` | Aggregated specialist probabilities (disagreement, ensemble_confidence) |
| `CalibrationOutput` | Raw vs calibrated probability (is_active, Brier, method) |
| `ValueOutput` | Market odds → edge/EV/fair odds (deterministic) |
| `RiskOutput` | Risk level, score, reasons (deterministic) |
| `Prediction` | Full provenance chain (all of the above + fixture + metadata) |
| `SlipSelection` | Selection with prediction_id trace (sport, competition, model_used) |
| `BetSlip` | Canonical slip (sportsbook-independent, persisted) |

## Agent Architecture

### Football (6 specialists)
| Agent | Focus | Prompt |
|---|---|---|
| `form_sentinel` | Recent form, momentum, last 5 results | `intelligence/prompts/football/form_sentinel/v1.md` |
| `team_strength` | Elo, xG, offensive/defensive ratings | `intelligence/prompts/football/team_strength/v1.md` |
| `player_availability` | Injuries, suspensions, lineup, fatigue | `intelligence/prompts/football/player_availability/v1.md` |
| `matchup_analyst` | Tactical H2H, formation, style clash | `intelligence/prompts/football/matchup_analyst/v1.md` |
| `market_analyst` | Odds movement, vig, steam, market quality | `intelligence/prompts/football/market_analyst/v1.md` |
| `strategy_ensemble` | Combine specialists, final conviction | `intelligence/prompts/football/strategy_ensemble/v1.md` |

### Basketball (6 specialists)
| Agent | Focus |
|---|---|
| `pace_tempo` | Pace, possessions, tempo control |
| `shooting_efficiency` | eFG%, TS%, three-point variance |
| `rebound_rim` | Rebound, rim protection, paint |
| `availability_fatigue` | Injuries, load, back-to-back |
| `matchup_scheme` | Scheme matchup, pace clash |
| `market_efficiency` | Line movement, spread/total steam |

**Agent behavior**: LLM configured → structured JSON output. No LLM → `is_stub=True`, `confidence=0`, pipeline skips.

## Frontend Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Metrics, fixture context, prediction table, live telemetry, provider health |
| Scanner | `/scanner` | Radar canvas, pipeline stages, event stream, predictions list |
| Predictions | `/predictions` | Full prediction list with sport/market/value filters, search, inspector |
| Slips | `/slips` | Prediction picker, optimizer, persisted slips, sportsbook export |
| Analytics | `/analytics` | Calibration reliability diagram, Brier score |
| Backtest | `/backtest` | Walk-forward replay (no future leakage) |
| Settings | `/settings` | LLM providers + model selection, data providers, agent toggles |

## Testing

36 tests covering:
- `test_canonical.py` — canonical contracts, entity resolution
- `test_agents.py` — agent structured output validation
- `test_basketball.py` — multi-sport extension, basketball rules
- `test_api.py` — health, scanner state, admin endpoints
- `test_providers.py` — provider registry, normalization
- `test_scanner.py` — pipeline execution
- `test_ingestion.py` — news normalization, freshness
- `test_next_phases.py` — invalidation graph, calibration buckets
- `test_phase4.py` — slip optimizer, correlation, validation
- `tests/slips/` — slip store, provenance
- `tests/api/` — API endpoint tests
- `tests/backtesting/` — walk-forward engine
- `tests/core/` — identifiers, config
- `tests/domain/` — domain models
- `tests/entity_resolution/` — team name resolution
- `tests/ingestion/` — collector tests
- `tests/intelligence/` — contracts, features, ensemble, calibration
- `tests/market/` — value engine, odds normalization
- `tests/providers/` — provider adapter tests
- `tests/risk/` — risk engine, correlation
- `tests/scanner/` — scanner modes, universe
