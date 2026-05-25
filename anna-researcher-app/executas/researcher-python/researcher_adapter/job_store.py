from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

from .errors import JobStoreError, NotFoundError

TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class JobStore:
    """JSON-backed Executa Local Job Store."""

    def __init__(self, root: Path | None = None, jobs_id: str | None = None):
        workspace = os.getenv("ANNA_RESEARCHER_WORKSPACE")
        default_root = Path(workspace).expanduser() if workspace else Path("~/anna-workspace").expanduser()
        self.root = root or default_root
        self.jobs_id = jobs_id or os.getenv("ANNA_RESEARCHER_JOBS_ID", "jobs-local")
        self.jobs_dir = self.root / "researcher" / self.jobs_id

    def create(self, *, query: str, query_domains: list[str] | None = None) -> dict[str, Any]:
        now = utc_now()
        research_id = f"research_{uuid.uuid4().hex[:12]}"
        job = {
            "schema_version": 1,
            "research_id": research_id,
            "query": query,
            "query_domains": query_domains or [],
            "report_type": "research_report",
            "status": "queued",
            "stage": "select_role",
            "progress": 0,
            "agent_name": None,
            "agent_role_prompt": None,
            "search_queries": [],
            "search_index": 0,
            "search_results": [],
            "selected_context": "",
            "source_urls": [],
            "report_markdown": "",
            "error": None,
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
        }
        self.save(job)
        return job

    def path_for(self, research_id: str) -> Path:
        return self.jobs_dir / f"{research_id}.json"

    def load(self, research_id: str) -> dict[str, Any]:
        path = self.path_for(research_id)
        if not path.exists():
            raise NotFoundError(f"research job not found: {research_id}")
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise JobStoreError(f"malformed job record: {research_id}") from exc
        if not isinstance(data, dict) or data.get("research_id") != research_id:
            raise JobStoreError(f"invalid job record: {research_id}")
        return data

    def save(self, job: dict[str, Any]) -> dict[str, Any]:
        research_id = str(job.get("research_id") or "")
        if not research_id:
            raise JobStoreError("job is missing research_id")
        job["updated_at"] = utc_now()
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        path = self.path_for(research_id)
        tmp = path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(job, f, ensure_ascii=False, indent=2, sort_keys=True)
        tmp.replace(path)
        return job

    def list_jobs(self) -> list[dict[str, Any]]:
        if not self.jobs_dir.exists():
            return []
        jobs: list[dict[str, Any]] = []
        for path in sorted(self.jobs_dir.glob("research_*.json")):
            try:
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    jobs.append(data)
            except Exception:
                continue
        return jobs

    def active_job(self) -> dict[str, Any] | None:
        jobs = [
            job for job in self.list_jobs()
            if job.get("status") not in TERMINAL_STATUSES
        ]
        if not jobs:
            return None
        jobs.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
        return jobs[0]

