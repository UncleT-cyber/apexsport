"""Tennis sport package — template for extensibility (STATUS: NOT_IMPLEMENTED).
Adding tennis must be an extension of the framework, not a rewrite.

Desired usage:
    from sports.tennis import register_tennis
    register_tennis()

Until tennis prompts/features are implemented, the prompt registry returns
NOT_IMPLEMENTED for tennis and the pipeline refuses to produce predictions
with substituted football prompts.
"""
from __future__ import annotations

def register_tennis():
    from sports.registry import sport_registry
    from intelligence.market_registry import register_sport_markets
    from intelligence.prompts.registry import prompt_registry, PromptVersion  # noqa
    from intelligence.features.feature_registry import feature_registry
    from intelligence.brain import register_sport_specialists

    sport_registry.register("tennis", "Tennis", "sports.tennis.domain")
    # Register tennis specialists (extension, not rewrite) — sport-aware brain mapping
    register_sport_specialists(
        "tennis",
        ["form_serve", "baseline_power", "availability_fitness", "matchup_surface", "market_efficiency", "mental_clutch"],
    )

    # Markets — tennis-specific (no draw, set/game semantics)
    register_sport_markets(
        "tennis",
        {"MATCH_WINNER", "SET_WINNER", "GAME_SPREAD", "TOTAL_GAMES", "SET_BETTING"},
        {
            "MATCH_WINNER": {"HOME", "AWAY"},
            "SET_WINNER": {"HOME", "AWAY"},
            "GAME_SPREAD": set(),  # dynamic
            "TOTAL_GAMES": set(),
        },
        primary="MATCH_WINNER",
        prob_keys={"HOME", "AWAY"},
    )

    # Features — tennis-specific, do not reuse football xG / basketball pace
    def _tennis_unavailable(name: str):
        from intelligence.features.feature_registry import feature_registry  # noqa
        def fn(ctx: dict) -> dict:
            return {"_status": "unavailable", "_reason": f"NOT_IMPLEMENTED: tennis {name} unavailable"}
        return fn

    # Sport-specific calculators (isolated from football/basketball)
    for grp in ["form", "serve", "baseline", "availability", "matchup", "market_context", "match_context"]:
        feature_registry.register("tennis", grp, _tennis_unavailable(grp))

    # Prompts — intentionally NOT registered so that
    # prompt_registry.resolve("tennis", "form_serve", "v1") → NOT_IMPLEMENTED
    # When tennis prompts are authored, create files:
    #   intelligence/prompts/tennis/form_serve/v1.md  or  sports/tennis/prompts/form_serve/v1.md
    # and they will be auto-discovered. Do not register stub football prompts for tennis.

    # Models placeholder
    try:
        from intelligence.models.registry import model_registry, ModelMeta
        model_registry.register(ModelMeta(id="tennis_elo_surface", version="v1", kind="statistical", sport="tennis"))
        model_registry.register(ModelMeta(id="tennis_serve_hold", version="v1", kind="statistical", sport="tennis"))
    except Exception:
        pass

    # Rules
    try:
        import sports.tennis.rules  # noqa
    except Exception:
        pass
