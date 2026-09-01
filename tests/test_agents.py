import pytest
import intelligence.agents.wire  # noqa
from intelligence.agents.registry import agent_registry
from intelligence.agents.base import AgentOutput

@pytest.mark.asyncio
async def test_agents_structured_output():
    # After basketball extension: 12 (6 football + 6 basketball); before: 6
    assert len(agent_registry.all()) in (6, 12)
    agent = agent_registry.get("form_sentinel")
    assert agent is not None
    out = await agent.analyze({"id": "evt_ars_che", "label": "ARS vs CHE"}, {})
    # schema validation via Pydantic — would raise if not structured
    assert isinstance(out, AgentOutput)
    assert 0 <= out.confidence <= 1
    assert "assessment" in out.model_dump()
    assert "probabilities" in out.model_dump()
    assert "specialist_id" in out.model_dump()
    assert out.probabilities  # at least one selection

def test_prompt_versioning():
    from intelligence.prompts.registry import prompt_registry
    pv = prompt_registry.active("form_sentinel")
    assert pv is not None
    assert pv.version == "v1"
    assert pv.active
