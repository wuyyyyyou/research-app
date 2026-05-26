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
    data["result"] = result_view(job, include_sources=False) if job.get("report_markdown") else None
    return data


def job_view(job: dict[str, Any]) -> dict[str, Any]:
    data = dict(job)
    data["result"] = result_view(job) if job.get("report_markdown") else None
    data["source_count"] = len(job.get("source_urls") or [])
    return data
