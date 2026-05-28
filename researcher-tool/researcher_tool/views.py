from __future__ import annotations

from typing import Any


def status_view(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "research_id": job.get("research_id"),
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "query": job.get("query"),
        "report_type": "research_report",
        "source_count": len(job.get("source_urls") or []),
        "search_total": len(job.get("search_queries") or []),
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "completed_at": job.get("completed_at"),
    }


def result_view(job: dict[str, Any], *, include_sources: bool = True) -> dict[str, Any]:
    data = {
        "research_id": job.get("research_id"),
        "status": job.get("status"),
        "query": job.get("query"),
        "report_type": "research_report",
        "report_markdown": job.get("report_markdown") or "",
        "source_urls": job.get("source_urls") or [],
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "completed_at": job.get("completed_at"),
    }
    if include_sources:
        data["sources"] = job.get("selected_sources") or []
    return data


def compact_job_view(job: dict[str, Any]) -> dict[str, Any]:
    data = status_view(job)
    data["query_domains"] = job.get("query_domains") or []
    data["agent_name"] = job.get("agent_name") or ""
    data["agent_role_prompt"] = job.get("agent_role_prompt") or ""
    data["search_queries"] = job.get("search_queries") or []
    data["source_urls"] = job.get("source_urls") or []
    data["source_count"] = len(job.get("source_urls") or [])
    data["iterations"] = [iteration_view(it) for it in (job.get("iterations") or [])]
    data["research_log"] = job.get("research_log") or []
    data["iteration"] = int(job.get("iteration") or 0)
    data["max_iterations"] = int(job.get("max_iterations") or 5)
    data["enabled_sources"] = job.get("enabled_sources") or []
    data["schema_version"] = int(job.get("schema_version") or 1)
    data["result"] = result_view(job, include_sources=False) if job.get("report_markdown") else None
    return data


def iteration_view(entry: dict[str, Any]) -> dict[str, Any]:
    """Public view of one iteration entry; ``raw_results`` is never exposed."""
    return {
        "iteration": int(entry.get("iteration") or 0),
        "source_id": entry.get("source_id") or "",
        "source_name": entry.get("source_name") or "",
        "queries": entry.get("queries") or [],
        "results_count": int(entry.get("results_count") or 0),
        "source_calls": [
            {k: v for k, v in (call or {}).items() if k != "items"}
            for call in (entry.get("source_calls") or [])
        ],
        "appended_at": entry.get("appended_at"),
    }


def source_view(source: dict[str, Any]) -> dict[str, Any]:
    return dict(source)


def job_view(job: dict[str, Any]) -> dict[str, Any]:
    data = dict(job)
    data["result"] = result_view(job) if job.get("report_markdown") else None
    data["source_count"] = len(job.get("source_urls") or [])
    return data
