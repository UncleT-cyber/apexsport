# Apex Sports — Sports Intelligence Platform

> Football is the first domain, not the architectural limit.

Apex Sports ingests sports-world data, builds a canonical representation, runs statistical + specialist AI analysis, calibrates predictions, evaluates market value and risk, and produces bet slips / intelligence reports.

**Zero hardcoded data.** Every prediction, fixture, odd, and news item comes from a real provider or is marked UNAVAILABLE. No mock fixtures, no uniform random odds, no fake stubs.

## Architecture Principles

- Capabilities, not providers
- Domain abstractions (SPORT/COMPETITION/EVENT/PARTICIPANT/MARKET/ODDS/PREDICTION)
- Unified system (scanner is orchestration over same intelligence pipeline)
- Hot-swappable providers (Registry + Adapter + Capability Declaration + Health + Priority + Fallback)
- Canonical data model + Entity Resolution (external IDs preserved)
- Time is first-class, no future leakage
- Deterministic math separate from LLM reasoning; structured AI outputs
- No fabricated data — UNAVAILABLE is a valid state

## Pipeline (13 stages)

```
PROVIDER → ADAPTER → CANONICAL
    ↓
SPORTS UNIVERSE (discovery) → DATA (MarketSnapshot) → FEATURES (FeatureSnapshot)
    ↓
6 SPECIALISTS (form/team_strength/availability/matchup/market/strategy) → LLM or UNAVAILABLE
    ↓
ENSEMBLE (deterministic weighted average) → CALIBRATION (raw vs calibrated, is_active)
    ↓
VALUE (deterministic edge/EV/fair odds) → RISK (deterministic LOW/MED/HIGH/BLOCKED)
    ↓
PREDICTION (full provenance chain) → SLIP (correlation-aware optimizer)
```

## Project Layout

```
apexsport/
├── apps/
│   ├── api/            FastAPI backend (port 8000)
│   │   └── routes/     scanner, predictions, slips, brain, settings, health, news, analytics, backtesting
│   └── web/            Vite + React frontend (port 5174, proxy to 8000)
│       └── src/pages/  Dashboard, Scanner, Predictions, Slips, Analytics, Backtesting, Settings
├── core/               Identifiers, config, events bus, cache, time
├── domain/             Slips (BetSlip, SlipSelection), markets
├── ingestion/          Collectors (odds, news, live), entity resolution, freshness
├── intelligence/
│   ├── agents/         6 football + 6 basketball specialists (LLM or UNAVAILABLE)
│   ├── brain.py        Unified source of truth for agents + model resolution
│   ├── calibration/    raw vs calibrated probability, Brier score, bucket correction
│   ├── contracts.py    Canonical Intelligence Contracts (all pipeline data types)
│   ├── ensemble/       Deterministic weighted average aggregation
│   ├── features/       Feature registry + snapshot builder (6 groups, DataStatus)
│   ├── llm_client.py   OpenAI-compatible + Anthropic + Gemini
│   └── prompts/        Versioned prompt assets per specialist per sport
├── market/             Value engine (edge/EV/fair odds), odds normalization
├── risk/               Risk engine (LOW/MED/HIGH/BLOCKED), correlation scoring
├── scanner/            Pipeline execution, state, modes (manual/scheduled/continuous/event-triggered)
├── slips/              Optimizer (correlation-aware), validator, canonical store
├── sports/             Football rules, basketball rules + agents, registry
├── sportsbooks/        Adapter pattern (SportyBet, Bet9ja, Betway, DraftKings, FanDuel, Generic)
├── settings.json       Persisted provider keys, agent toggles, selected LLM model
└── tests/              36 tests covering contracts, agents, slips, API, basketball, backtesting
```

## Quick Start

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn apps.api.main:app --reload

# Frontend
cd apps/web && npm install && npm run dev
```

## Configuration

Settings are persisted in `settings.json` (single source of truth):

- **LLM Providers**: HuggingFace Router, OpenAI, Groq, OpenRouter, Anthropic, Gemini — set API key, fetch models, select one
- **Data Providers**: Sportmonks, ApiFootball, Sportradar, The Odds API — set API key
- **Agent Toggles**: 6 football + 6 basketball specialists — enable/disable individually

The brain reads live settings. No hardcoded model names. No hardcoded fixtures.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Operational health (scanner state, predictions, fixtures) |
| `/api/scanner/state` | GET | Scanner snapshot (pipeline stages, events, predictions) |
| `/api/scanner/scan-now` | POST | Trigger scan for a sport |
| `/api/fixtures` | GET | Discover fixtures from configured providers |
| `/api/predictions` | GET | List predictions with sport filter |
| `/api/predictions/{id}` | GET | Full prediction provenance (features → specialists → ensemble → calibration → value → risk) |
| `/api/slips` | GET | List persisted slips |
| `/api/slips` | POST | Create canonical slip |
| `/api/slips/from-prediction-ids` | POST | Create slip from explicit prediction IDs |
| `/api/slips/optimize` | GET/POST | Portfolio optimizer (correlation-aware, exposure limits) |
| `/api/slips/{id}` | GET | Get persisted slip detail |
| `/api/slips/{id}/validate` | POST | Validate slip |
| `/api/slips/{id}/export` | POST | Export to sportsbook format |
| `/api/brain/status` | GET | AI brain status (agents, LLM model) |
| `/api/news` | GET | Cached news |
| `/api/news/ingest` | POST | Ingest real news items |
| `/api/analytics/calibration` | GET | Calibration report (Brier, reliability diagram) |
| `/api/backtesting/predictions` | GET | Predictions for backtest |
| `/api/backtesting/demo` | POST | Demo backtest (requires real outcome data) |

## Key Components

### Prediction Inspector
Every prediction has a 🔍 button that opens a slide-out panel showing the full provenance chain:
- **Match Context**: fixture, competition, market, model used
- **Features**: 6 groups with AVAILABLE/UNAVAILABLE status (never fabricates)
- **AI Brain**: each specialist's model, prompt version, probabilities, evidence, warnings
- **Ensemble**: per-selection probabilities, disagreement, deterministic weighted average
- **Calibration**: raw vs calibrated probability, active/INSUFFICIENT_DATA
- **Value**: market odds, implied probability, fair odds, edge, EV
- **Risk**: independent risk level
- **Raw JSON**: full data dump

### Slip Engine
- **Canonical Store**: persistent `save_slip`/`get_slip`/`list_slips`
- **Correlation**: deterministic score (duplicate fixture 0.85, same competition +0.18, same market +0.08, temporal +0.12, cap 0.90)
- **Provenance**: every `SlipSelection` traces to its `prediction_id` with sport/competition/model
- **Validator**: duplicate fixtures, invalid odds, correlated selections
- **Sportsbook Export**: canonical → book mapping (SportyBet, Bet9ja, Betway, DraftKings, FanDuel, Generic)

### Providers (hot-swappable)
- **Sportmonks**: fixtures + live (requires key)
- **ApiFootball**: fixtures (requires key)
- **Sportradar**: fixtures (requires key)
- **The Odds API**: odds (requires key)
- **News providers**: ingest real news (requires key)

No provider configured → empty results → clear error messages. No fake data.

## Testing

```bash
python -m pytest tests/ -q          # 36 tests
cd apps/web && npx tsc --noEmit     # TypeScript clean
```

## Reference

ApexLoop (`/Users/admin/ApexLoop`) is the read-only reference for platform patterns (event bus, scanner state, provider abstraction, UI shell). Apex Sports adapts those patterns to the sports domain.
