from intelligence.agents.base import AnalysisAgent
from intelligence.contracts import AgentOutput, EvidenceItem
from intelligence.brain import get_specialist_config

class ShootingEfficiencyAgent(AnalysisAgent):
    @property
    def name(self) -> str:
        return "shooting_efficiency"

    async def analyze(self, fixture: dict, context: dict) -> AgentOutput:
        sport = fixture.get("sport", "football" if self.name in ("form_sentinel","team_strength","player_availability","matchup_analyst","market_analyst","strategy_ensemble") else "basketball")
        cfg = get_specialist_config(self.name, sport=sport)
        pv = cfg["prompt_version"]
        model = cfg["model"]
        provider = cfg["provider"]
        base_url = cfg.get("base_url","")
        fid = fixture.get("id", "unknown")
        fs = context.get("feature_snapshot")
        feat_id = fs.id if fs else "unknown"
        market_snapshot = context.get("market_snapshot")
        prompt_template = cfg.get("prompt_template","")
        # Build variables for basketball
        def grp_str(n):
            if not fs:
                return "UNAVAILABLE"
            g = next((x for x in fs.groups if x.name == n), None)
            return f"{g.status.value}: {g.values if g.status.value=='available' else g.unavailable_reason}" if g else "UNAVAILABLE"
        variables = {
            "fixture_id": fid,
            "home": fixture.get("home") or "Home",
            "away": fixture.get("away") or "Away",
            "competition": fixture.get("competition") or "Unknown",
            "feature_snapshot_id": feat_id,
            "feature_version": fs.feature_version if fs else "v1",
        }
        if cfg.get("is_configured") and provider != "none" and model != "stub-deterministic":
            try:
                from intelligence.llm_client import call_llm
                import json, pathlib
                raw = json.loads(pathlib.Path("settings.json").read_text()) if pathlib.Path("settings.json").exists() else {}
                api_key = raw.get("llm", {}).get(provider, {}).get("api_key","")
                from core.config.settings import get_runtime_settings
                try:
                    rs = get_runtime_settings()
                    if provider == "huggingface":
                        api_key = rs.llm.huggingface_api_key or api_key
                    elif provider == "openai":
                        api_key = rs.llm.openai_api_key or api_key
                except Exception:
                    pass
                llm_result = await call_llm(prompt_template or "You are shooting_efficiency for basketball. Return JSON with probabilities HOME/AWAY, confidence, assessment, evidence.", variables, provider, model, base_url, api_key, timeout=12)
                probs = llm_result.get("probabilities") or {}
                from intelligence.market_registry import validate_probabilities as _validate_probs
                ok, reason = _validate_probs(sport, probs)
                if not ok:
                    raise ValueError(reason)
                s = sum(probs.values()) or 1
                probs = {k: round(v/s,3) for k,v in probs.items()}
                confidence = max(0, min(1, float(llm_result.get("confidence", 0.5))))
                evidence = []
                for ev in llm_result.get("evidence", [])[:3]:
                    if isinstance(ev, dict):
                        evidence.append(EvidenceItem(feature=ev.get("feature","unknown"), observation=str(ev.get("observation",""))[:120], reasoning=str(ev.get("reasoning",""))[:200]))
                if not evidence:
                    evidence = [EvidenceItem(feature="llm", observation=llm_result.get("assessment","")[:120], reasoning="eFG%, TS%, three-point variance")]
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
            except Exception:
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
            probabilities={k: 0 for k in (lambda s: {"HOME", "AWAY"} if s=="basketball" else {"HOME","DRAW","AWAY"})(sport)},
            confidence=0,
            evidence=evidence,
            uncertainties=["no LLM configured"],
            warnings=[f"agent_unavailable: {self.name}"],
            key_factors=[],
            model_metadata={"provider": cfg["provider"], "sport": sport, "prompt_path": cfg.get("prompt_path",""), "prompt_status": cfg.get("prompt_status",""), "is_stub": True},
        )