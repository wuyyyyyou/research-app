from __future__ import annotations

from typing import Any

from .errors import InvalidActionError, NotFoundError, NotReadyError, ValidationError
from .job_store import JobStore
from .orchestrator import AnnaResearchOrchestrator


class ResearchDispatcher:
    def __init__(self, *, store: JobStore, orchestrator: AnnaResearchOrchestrator):
        self.store = store
        self.orchestrator = orchestrator

    async def dispatch(self, args: dict[str, Any], *, context: dict[str, Any] | None = None, invoke_id: str = "") -> dict[str, Any]:
        action = args.get("action")
        if action == "start":
            return self.start(args)
        if action == "advance":
            return await self.advance(args, invoke_id=invoke_id)
        if action == "get_status":
            return self.get_status(args)
        if action == "get_result":
            return self.get_result(args)
        raise InvalidActionError(f"unknown action: {action!r}")

    def start(self, args: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query") or "").strip()
        if not query:
            raise ValidationError("query is required for action='start'")
        domains = normalize_domains(args.get("query_domains"))
        active = self.store.active_job()
        if active:
            return {"active": True, "job": status_view(active)}
        job = self.store.create(query=query, query_domains=domains)
        return {"active": False, "job": status_view(job)}

    async def advance(self, args: dict[str, Any], *, invoke_id: str) -> dict[str, Any]:
        job = self._load_target(args)
        job = await self.orchestrator.advance(job, invoke_id=invoke_id)
        self.store.save(job)
        return {"job": status_view(job)}

    def get_status(self, args: dict[str, Any]) -> dict[str, Any]:
        job = self._load_target(args)
        return {"job": status_view(job)}

    def get_result(self, args: dict[str, Any]) -> dict[str, Any]:
        job = self._load_target(args)
        if job.get("status") != "completed":
            raise NotReadyError("research result is not ready", data=status_view(job))
        return {
            "ready": True,
            "result": {
                "research_id": job["research_id"],
                "status": job["status"],
                "query": job["query"],
                "report_type": "research_report",
                "report_markdown": job.get("report_markdown") or "",
                "source_urls": job.get("source_urls") or [],
                "sources": job.get("selected_sources") or [],
                "error": job.get("error"),
                "created_at": job.get("created_at"),
                "updated_at": job.get("updated_at"),
                "completed_at": job.get("completed_at"),
            },
        }

    def _load_target(self, args: dict[str, Any]) -> dict[str, Any]:
        research_id = str(args.get("research_id") or "").strip()
        if research_id:
            return self.store.load(research_id)
        active = self.store.active_job()
        if active:
            return active
        raise NotFoundError("no active research job")


def status_view(job: dict[str, Any]) -> dict[str, Any]:
    total_queries = len(job.get("search_queries") or [])
    search_index = int(job.get("search_index") or 0)
    return {
        "research_id": job.get("research_id"),
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "query": job.get("query"),
        "report_type": "research_report",
        "source_count": len(job.get("source_urls") or []),
        "search_index": search_index,
        "search_total": total_queries,
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "completed_at": job.get("completed_at"),
    }


def normalize_domains(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, str):
        raw = value.split(",")
    elif isinstance(value, list):
        raw = value
    else:
        raise ValidationError("query_domains must be a string or array")
    domains = []
    for item in raw:
        text = str(item or "").strip().lower()
        text = text.removeprefix("https://").removeprefix("http://").strip("/")
        if text and text not in domains:
            domains.append(text)
    return domains

