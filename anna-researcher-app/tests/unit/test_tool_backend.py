from __future__ import annotations

import os
import urllib.error
import urllib.request
import json

import pytest

from researcher_tool.context_selector import LexicalContextSelector
from researcher_tool.dispatcher import AppDispatcher
from researcher_tool.errors import ConfigurationError, NotFoundError, ValidationError
from researcher_tool.job_store import JobStore
from researcher_tool.settings import SettingsStore


def make_dispatcher(tmp_path):
    root = tmp_path / ".research"
    return AppDispatcher(settings=SettingsStore(root=root), jobs=JobStore(root=root), selector=LexicalContextSelector(max_sources=4, context_budget=4000))


def test_settings_mask_and_clear(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    assert dispatcher.dispatch("app_get_settings", {})["settings"]["tavily"]["configured"] is False
    view = dispatcher.dispatch("app_update_settings", {"tavily_api_key": "tvly-test-secret"})["settings"]
    assert view["tavily"]["configured"] is True
    assert "secret" not in view["tavily"]["masked"]
    assert dispatcher.dispatch("app_update_settings", {"clear_tavily_api_key": True})["settings"]["tavily"]["configured"] is False


def test_job_create_update_latest_and_not_found(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    job = dispatcher.dispatch("app_create_research_job", {"query": "anna", "query_domains": "https://Example.com/"})["job"]
    assert job["research_id"].startswith("research_")
    assert dispatcher.dispatch("app_get_research_job", {})["job"]["research_id"] == job["research_id"]
    updated = dispatcher.dispatch("app_update_research_job", {"research_id": job["research_id"], "updates": {"stage": "plan_queries", "progress": 25}})
    assert updated["job"]["stage"] == "plan_queries"
    with pytest.raises(ValidationError):
        dispatcher.dispatch("app_update_research_job", {"research_id": job["research_id"], "updates": {"tavily_api_key": "leak"}})
    with pytest.raises(NotFoundError):
        dispatcher.dispatch("app_get_research_job", {"research_id": "missing"})


def test_search_context_and_result_persistence(tmp_path, monkeypatch):
    monkeypatch.setenv("ANNA_RESEARCHER_FAKE_TAVILY", "1")
    dispatcher = make_dispatcher(tmp_path)
    dispatcher.dispatch("app_update_settings", {"tavily_api_key": "tvly-test-secret"})
    job = dispatcher.dispatch("app_create_research_job", {"query": "anna researcher"})["job"]
    search = dispatcher.dispatch("app_search_web", {"research_id": job["research_id"], "search_queries": ["anna", "researcher"]})
    assert search["search_results"]
    selected = dispatcher.dispatch("app_select_context", {"research_id": job["research_id"]})
    assert selected["selected_context"]
    transfer = dispatcher.dispatch("app_save_research_result", {"research_id": job["research_id"], "report_markdown": "# Done", "source_urls": selected["source_urls"]})["transfer"]
    assert transfer["method"] == "POST"
    assert "report_markdown" not in transfer
    saved = post_json(transfer["url"], {"report_markdown": "# Done", "source_urls": selected["source_urls"], "selected_sources": [{"url": "https://evil.example", "content": "ignored"}]})
    assert saved["result"]["report_markdown"] == "# Done"
    assert "sources" not in saved["result"]
    assert "selected_sources" not in saved["job"]
    loaded = dispatcher.dispatch("app_get_research_job", {"research_id": job["research_id"]})["job"]
    assert loaded["result"]["report_markdown"] == "# Done"
    assert "search_results" not in loaded
    assert "selected_context" not in loaded
    assert "selected_sources" not in loaded
    stored = dispatcher.jobs.load(job["research_id"])
    assert stored["selected_sources"] == selected["selected_sources"]


def test_result_transfer_http_errors_and_preflight(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    job = dispatcher.dispatch("app_create_research_job", {"query": "anna"})["job"]
    transfer = dispatcher.dispatch("app_save_research_result", {"research_id": job["research_id"]})["transfer"]

    options = urllib.request.Request(transfer["url"], method="OPTIONS")
    with urllib.request.urlopen(options, timeout=5) as response:
        assert response.status == 204
        assert response.headers["Access-Control-Allow-Origin"] == "*"
        assert response.headers["Access-Control-Allow-Private-Network"] == "true"

    with pytest.raises(urllib.error.HTTPError) as exc:
        post_json(transfer["url"], {"report_markdown": " "})
    assert exc.value.code == 400

    with pytest.raises(urllib.error.HTTPError) as exc:
        post_json(transfer["url"].replace(job["research_id"], "missing"), {"report_markdown": "# Done"})
    assert exc.value.code == 404

    request = urllib.request.Request(transfer["url"], method="GET")
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(request, timeout=5)
    assert exc.value.code == 405


def test_result_transfer_server_reuses_singleton_url(tmp_path):
    dispatcher = make_dispatcher(tmp_path)
    job = dispatcher.dispatch("app_create_research_job", {"query": "anna"})["job"]
    first = dispatcher.dispatch("app_save_research_result", {"research_id": job["research_id"]})["transfer"]["url"]
    second = dispatcher.dispatch("app_save_research_result", {"research_id": job["research_id"]})["transfer"]["url"]
    assert first == second


def test_search_requires_settings_without_fake_mode(tmp_path, monkeypatch):
    monkeypatch.delenv("ANNA_RESEARCHER_FAKE_TAVILY", raising=False)
    dispatcher = make_dispatcher(tmp_path)
    job = dispatcher.dispatch("app_create_research_job", {"query": "anna"})["job"]
    with pytest.raises(ConfigurationError):
        dispatcher.dispatch("app_search_web", {"research_id": job["research_id"], "search_queries": ["anna"]})


def test_selector_dedupes_and_limits_domains():
    selector = LexicalContextSelector(max_sources=2, max_per_domain=1, context_budget=700)
    selected = selector.select(
        query="anna app research",
        search_queries=["anna app research"],
        search_results=[
            {"query": "anna", "url": "https://example.com/a", "title": "Anna research", "content": "Anna app research context"},
            {"query": "anna", "url": "https://example.com/a", "title": "Duplicate", "content": "duplicate"},
            {"query": "anna", "url": "https://example.com/b", "title": "Same domain", "content": "anna app same domain"},
            {"query": "anna", "url": "https://docs.example.org/c", "title": "Context selector", "content": "research context selector evidence"},
        ],
    )
    assert selected["source_urls"] == ["https://example.com/a", "https://docs.example.org/c"]


def post_json(url: str, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))
