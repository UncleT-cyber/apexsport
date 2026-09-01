# Tennis — Extensibility Example (NOT_IMPLEMENTED)

This directory demonstrates how adding a new sport is an **extension**, not a rewrite.

## What Adding Tennis Involves

```
sports/
  tennis/
    features/      sport-specific feature calculators (serve %, break-point conversion, surface form)
    specialists/   (optional) tennis-specific agents if not reused
    prompts/       sport-specific prompt assets: tennis/form_serve/v1 etc.
    markets/       tennis market semantics (MATCH_WINNER HOME/AWAY, SET_WINNER, GAME_SPREAD)
    models/        tennis models (elo_surface, serve_hold_model)
    rules/         sport validation rules
```

## Shared (no changes)

```
intelligence/
  agents/        specialist interface (AnalysisAgent)
  ensemble/      deterministic weighted average
  calibration/   Platt/isotonic
  provenance/   _prediction trace
  models/        model registry
  market_registry  shared contract
```

## Registration (single call)

```python
from sports.tennis import register_tennis
register_tennis()  # → registers sport, features, markets, prompts, models, agents
```

## Status

Tennis prompts are NOT_IMPLEMENTED — `get_prompt(sport="tennis", specialist="form_serve", version="v1")` returns NOT_IMPLEMENTED.
The engine never silently substitutes football prompts for tennis.
