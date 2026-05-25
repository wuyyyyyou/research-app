import asyncio

import pytest

from researcher_adapter.context_selector import LexicalContextSelector
from researcher_adapter.dispatcher import ResearchDispatcher
from researcher_adapter.errors import InvalidActionError, NotReadyError
from researcher_adapter.job_store import JobStore
from researcher_adapter.orchestrator import AnnaResearchOrchestrator
from researcher_adapter.sampling_llm import SamplingClient
from researcher_adapter.tavily_retrieval import TavilySummaryRetriever


def make_dispatcher(tmp_path):
    orchestrator = AnnaResearchOrchestrator(
        sampling=SamplingClient(fake=True),
        retriever=TavilySummaryRetriever(fake=True),
        selector=LexicalContextSelector(max_sources=4, context_budget=4000),
    )
    return ResearchDispatcher(store=JobStore(root=tmp_path, jobs_id="test"), orchestrator=orchestrator)


def test_dispatcher_start_single_active_job(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    first = dispatcher.start({"query": "anna researcher"})
    second = dispatcher.start({"query": "another"})

    assert first["active"] is False
    assert second["active"] is True
    assert first["job"]["research_id"] == second["job"]["research_id"]


def test_dispatcher_invalid_action_and_not_ready(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    start = dispatcher.start({"query": "anna researcher"})

    with pytest.raises(InvalidActionError):
        asyncio.run(dispatcher.dispatch({"action": "unknown"}))

    with pytest.raises(NotReadyError):
        dispatcher.get_result({"research_id": start["job"]["research_id"]})

