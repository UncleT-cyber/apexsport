from intelligence.agents.base import AnalysisAgent
from intelligence.contracts import AgentOutput, EvidenceItem
from intelligence.prompts.registry import prompt_registry
from intelligence.brain import get_specialist_config

class MarketAnalystAgent(AnalysisAgent):
    @property
    def name(self) -> str:
        return "market_analyst"

    async def analyze(self, fixture: dict, context: dict) -> AgentOutput:
        sport = fixture.get("sport", "football" if self.name in ("form_sentinel","team_strength","player_availability","matchup_analyst","market_analyst","strategy_ensemble") else "basketball")
        cfg = get_specialist_config(self.name, sport=sport)
        pv = cfg["prompt_version"]
        model = cfg["model"]
        provider = cfg["provider"]
        base_url = cfg.get("base_url","")
        # Try LLM if configured (has_key), else stub
        fid = fixture.get("id", "unknown")
        fs = context.get("feature_snapshot")
        feat_id = fs.id if fs else "unknown"
        # Build prompt variables
        from pathlib import Path
        # Load prompt template already in cfg
        prompt_template = cfg.get("prompt_template","")
        # Prepare variables for template
        feature_snapshot = context.get("feature_snapshot")
        market_snapshot = context.get("market_snapshot")
        # Build feature group strings for prompt
        def grp_str(name):
            if not feature_snapshot:
                return "UNAVAILABLE"
            g = next((x for x in feature_snapshot.groups if x.name == name), None)
            if not g:
                return "UNAVAILABLE"
            return f"{g.status.value}: {g.values if g.status.value=='available' else g.unavailable_reason}"
        variables = {
            "fixture_id": fid,
            "home": fixture.get("home") or fixture.get("home_team") or "Home",
            "away": fixture.get("away") or fixture.get("away_team") or "Away",
            "competition": fixture.get("competition") or "Unknown",
            "feature_snapshot_id": feat_id,
            "feature_version": feature_snapshot.feature_version if feature_snapshot else "v1",
            "form_group": grp_str("FORM"),
            "form_status": next((g.status.value for g in (feature_snapshot.groups if feature_snapshot else []) if g.name=="FORM"), "unavailable"),
            "team_strength_group": grp_str("TEAM_STRENGTH"),
            "team_strength_status": next((g.status.value for g in (feature_snapshot.groups if feature_snapshot else []) if g.name=="TEAM_STRENGTH"), "unavailable"),
            "availability_group": grp_str("AVAILABILITY"),
            "availability_status": next((g.status.value for g in (feature_snapshot.groups if feature_snapshot else []) if g.name=="AVAILABILITY"), "unavailable"),
            "matchup_group": grp_str("MATCHUP"),
            "matchup_status": next((g.status.value for g in (feature_snapshot.groups if feature_snapshot else []) if g.name=="MATCHUP"), "unavailable"),
            "match_context_group": grp_str("MATCH_CONTEXT"),
            "market_context_group": grp_str("MARKET_CONTEXT"),
            "market_context_status": next((g.status.value for g in (feature_snapshot.groups if feature_snapshot else []) if g.name=="MARKET_CONTEXT"), "unavailable"),
            "market_snapshot": str(market_snapshot.model_dump() if hasattr(market_snapshot, "model_dump") else market_snapshot)[:800] if market_snapshot else "UNAVAILABLE",
            "market_entries": str(market_snapshot.entries[:2] if hasattr(market_snapshot, "entries") else "[]")[:500],
            "available_features": ", ".join([g.name for g in (feature_snapshot.groups if feature_snapshot else []) if g.status.value=="available"]),
        }
        # Try LLM if provider is configured and model is not stub
        if cfg.get("is_configured") and provider != "none" and model != "stub-deterministic":
            try:
                import json, httpx
                from intelligence.llm_client import call_llm
                from core.config.settings import get_runtime_settings
                # Get api_key from settings (need to load raw)
                import json as _json, pathlib as _pl
                raw = _json.loads(_pl.Path("settings.json").read_text()) if _pl.Path("settings.json").exists() else {}
                api_key = raw.get("llm", {}).get(provider, {}).get("api_key","")
                # Also try get_runtime_settings
                try:
                    rs = get_runtime_settings()
                    # Map provider to settings attr
                    if provider == "huggingface":
                        api_key = rs.llm.huggingface_api_key or api_key
                        base_url = rs.llm.huggingface_api_key and _pl.Path("settings.json").exists() and raw.get("llm",{}).get("huggingface",{}).get("base_url") or base_url
                    elif provider == "openai":
                        api_key = rs.llm.openai_api_key or api_key
                except Exception:
                    pass
                llm_result = await call_llm(prompt_template, variables, provider, model, base_url, api_key, timeout=12)
                # Validate structured output
                probs = llm_result.get("probabilities") or {}
                # Sport-aware probability validation (shared contract, sport-specific market semantics)
                from intelligence.market_registry import validate_probabilities as _validate_probs
                ok, reason = _validate_probs(sport, probs)
                if not ok:
                    raise ValueError(reason)
                s = sum(probs.values()) or 1
                probs = {k: round(v/s,3) for k,v in probs.items()}
                confidence = float(llm_result.get("confidence", 0.5))
                confidence = max(0, min(1, confidence))
                # Build evidence
                evidence = []
                for ev in llm_result.get("evidence", [])[:4]:
                    if isinstance(ev, dict):
                        evidence.append(EvidenceItem(feature=ev.get("feature","unknown"), observation=str(ev.get("observation",""))[:120], reasoning=str(ev.get("reasoning",""))[:200]))
                    else:
                        evidence.append(EvidenceItem(feature="unknown", observation=str(ev)[:120], reasoning=""))
                if not evidence:
                    evidence = [EvidenceItem(feature="llm", observation=llm_result.get("assessment","")[:120], reasoning="LLM assessment")]
                return AgentOutput(
                    specialist_id=self.name,
                    sport=sport,
                    model=model,
                    model_version=cfg.get("model_version","v1"),
                    prompt_version=pv,
                    prompt_path=cfg.get("prompt_path","") or f"{sport}/{self.name}/{pv}",
                    prompt_status=cfg.get("prompt_status","available"),
                    feature_snapshot_id=feat_id,
                    assessment=str(llm_result.get("assessment","LLM assessment"))[:500],
                    probabilities=probs,
                    confidence=confidence,
                    evidence=evidence,
                    uncertainties=llm_result.get("uncertainties", [])[:3],
                    warnings=llm_result.get("warnings", [])[:3],
                    key_factors=llm_result.get("key_factors", [])[:3],
                    model_metadata={"provider": provider, "sport": sport, "prompt_path": cfg.get("prompt_path",""), "prompt_status": cfg.get("prompt_status",""), "llm": True},
                )
            except Exception as e:
                # Fall through to stub with degraded data_quality
                pass
        # No LLM configured or all failed — agent unavailable, no fake data
        fs = context.get("feature_snapshot")
        feat_id = fs.id if fs else "unknown"
        evidence = []
        if fs:
            for g in fs.groups:
                if g.status.value == "available" and g.values:
                    for kk, vv in list(g.values.items())[:1]:
                        evidence.append(EvidenceItem(feature=kk, observation=str(vv)[:80], reasoning=f"{self.name}: real feature data"))
                        break
        if not evidence:
            evidence = [EvidenceItem(feature=self.name, observation="agent unavailable — no LLM configured", reasoning="no prediction produced")]
        from intelligence.market_registry import get_probability_keys as _prob_keys
        _keys = _prob_keys(sport)
        zero_probs = {k: 0 for k in _keys}
        return AgentOutput(
            specialist_id=self.name,
            sport=sport,
            model=cfg["model"],
            model_version=cfg.get("model_version","v1"),
            prompt_version=pv,
            prompt_path=cfg.get("prompt_path","") or f"{sport}/{self.name}/{pv}",
            prompt_status=cfg.get("prompt_status","available"),
            feature_snapshot_id=feat_id,
            assessment=f"UNAVAILABLE — {self.name}: no LLM configured or all attempts failed",
            probabilities=zero_probs,
            confidence=0,
            evidence=evidence,
            uncertainties=["no LLM configured"],
            warnings=[f"agent_unavailable: {self.name}"],
            key_factors=[],
            model_metadata={"provider": cfg["provider"], "sport": sport, "prompt_path": cfg.get("prompt_path",""), "prompt_status": cfg.get("prompt_status",""), "is_stub": True},
        )