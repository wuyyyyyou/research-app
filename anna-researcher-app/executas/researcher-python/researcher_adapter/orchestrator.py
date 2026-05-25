from __future__ import annotations

import json
import re
from typing import Any

from .context_selector import LexicalContextSelector
from .errors import ResearcherError, RetrievalFailure, SamplingFailure
from .job_store import utc_now
from .sampling_llm import SamplingClient, text_from_sampling
from .tavily_retrieval import TavilySummaryRetriever

STAGES = ["select_role", "plan_queries", "search_next_query", "select_context", "write_report", "completed"]
PROGRESS = {
    "select_role": 10,
    "plan_queries": 25,
    "search_next_query": 55,
    "select_context": 75,
    "write_report": 90,
    "completed": 100,
}


class AnnaResearchOrchestrator:
    def __init__(
        self,
        *,
        sampling: SamplingClient,
        retriever: TavilySummaryRetriever,
        selector: LexicalContextSelector | None = None,
    ):
        self.sampling = sampling
        self.retriever = retriever
        self.selector = selector or LexicalContextSelector()

    async def advance(self, job: dict[str, Any], *, invoke_id: str = "") -> dict[str, Any]:
        if job.get("status") in {"completed", "failed", "cancelled"}:
            return job
        stage = job.get("stage") or "select_role"
        job["status"] = "running"
        job["progress"] = PROGRESS.get(stage, job.get("progress", 0))
        try:
            if stage == "select_role":
                await self._select_role(job, invoke_id=invoke_id)
                job["stage"] = "plan_queries"
            elif stage == "plan_queries":
                await self._plan_queries(job, invoke_id=invoke_id)
                job["stage"] = "search_next_query"
            elif stage == "search_next_query":
                self._search_next_query(job)
            elif stage == "select_context":
                self._select_context(job)
                job["stage"] = "write_report"
            elif stage == "write_report":
                await self._write_report(job, invoke_id=invoke_id)
                job["stage"] = "completed"
                job["status"] = "completed"
                job["completed_at"] = utc_now()
            elif stage == "completed":
                job["status"] = "completed"
            else:
                raise ResearcherError(f"unknown job stage: {stage}")
            job["progress"] = PROGRESS.get(job["stage"], 100 if job.get("status") == "completed" else job.get("progress", 0))
            if job.get("stage") == "completed":
                job["status"] = "completed"
                job["progress"] = 100
        except ResearcherError as exc:
            mark_failed(job, exc)
        except Exception as exc:  # noqa: BLE001
            mark_failed(job, ResearcherError(f"{type(exc).__name__}: {exc}"))
        return job

    async def _select_role(self, job: dict[str, Any], *, invoke_id: str) -> None:
        prompt = (
            "Choose a research agent role for this task. Return JSON with keys "
            "`server` and `agent_role_prompt` only.\n\n"
            f"Task: {job['query']}"
        )
        result = await self.sampling.complete(
            messages=[{"role": "user", "content": {"type": "text", "text": prompt}}],
            max_tokens=700,
            temperature=0.15,
            metadata={"executa_invoke_id": invoke_id, "stage": "select_role", "query": job["query"]},
        )
        text = text_from_sampling(result)
        role = parse_json_object(text) or {}
        job["agent_name"] = str(role.get("server") or "Default Research Assistant")
        job["agent_role_prompt"] = str(role.get("agent_role_prompt") or "You are an objective research assistant who writes structured, source-grounded reports.")

    async def _plan_queries(self, job: dict[str, Any], *, invoke_id: str) -> None:
        prompt = (
            "Generate up to 3 focused web search queries for this research task. "
            "Return JSON as {\"queries\": [..]} and do not include commentary.\n\n"
            f"Task: {job['query']}\nRole: {job.get('agent_role_prompt') or ''}"
        )
        result = await self.sampling.complete(
            messages=[{"role": "user", "content": {"type": "text", "text": prompt}}],
            max_tokens=900,
            temperature=0.2,
            metadata={"executa_invoke_id": invoke_id, "stage": "plan_queries", "query": job["query"]},
        )
        text = text_from_sampling(result)
        payload = parse_json_object(text) or {}
        planned = payload.get("queries") if isinstance(payload, dict) else None
        queries = normalize_queries(job["query"], planned if isinstance(planned, list) else [])
        job["search_queries"] = queries
        job["search_index"] = 0

    def _search_next_query(self, job: dict[str, Any]) -> None:
        queries = job.get("search_queries") or [job["query"]]
        index = int(job.get("search_index") or 0)
        if index >= len(queries):
            job["stage"] = "select_context"
            return
        query = queries[index]
        results = self.retriever.search(query, query_domains=job.get("query_domains") or [], max_results=5)
        existing_urls = {item.get("url") for item in job.get("search_results", [])}
        for item in results:
            if item.get("url") and item.get("url") not in existing_urls:
                job.setdefault("search_results", []).append(item)
                existing_urls.add(item.get("url"))
        job["search_index"] = index + 1
        job["source_urls"] = sorted({item["url"] for item in job.get("search_results", []) if item.get("url")})
        if job["search_index"] >= len(queries):
            job["stage"] = "select_context"
        else:
            job["stage"] = "search_next_query"

    def _select_context(self, job: dict[str, Any]) -> None:
        selected = self.selector.select(
            query=job["query"],
            search_queries=job.get("search_queries") or [job["query"]],
            search_results=job.get("search_results") or [],
        )
        job["selected_context"] = selected["selected_context"]
        job["selected_sources"] = selected["selected_sources"]
        job["source_urls"] = selected["source_urls"]
        if not job["selected_context"]:
            raise RetrievalFailure("No usable context was selected from Tavily results")

    async def _write_report(self, job: dict[str, Any], *, invoke_id: str) -> None:
        prompt = (
            f"Write a concise markdown research_report for: {job['query']}\n\n"
            "Use only the provided context. Include clear headings and cite sources by URL when useful.\n\n"
            f"Context:\n{job.get('selected_context', '')}"
        )
        result = await self.sampling.complete(
            messages=[
                {"role": "system", "content": {"type": "text", "text": job.get("agent_role_prompt") or "You are an objective research assistant."}},
                {"role": "user", "content": {"type": "text", "text": prompt}},
            ],
            max_tokens=6000,
            temperature=0.35,
            metadata={"executa_invoke_id": invoke_id, "stage": "write_report", "query": job["query"]},
        )
        report = text_from_sampling(result).strip()
        if not report:
            raise SamplingFailure("Anna Sampling returned an empty report")
        job["report_markdown"] = report


def normalize_queries(original: str, planned: list[Any], limit: int = 3) -> list[str]:
    queries = [original.strip()]
    for item in planned:
        text = str(item or "").strip()
        if text and text not in queries:
            queries.append(text[:180])
        if len(queries) >= limit:
            break
    return queries or [original]


def parse_json_object(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text or "", re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None


def mark_failed(job: dict[str, Any], exc: ResearcherError) -> None:
    job["status"] = "failed"
    job["error"] = {"code": exc.code, "message": exc.message, "data": exc.data}
    job["completed_at"] = utc_now()

