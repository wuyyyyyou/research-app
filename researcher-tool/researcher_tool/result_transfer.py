from __future__ import annotations

import json
import re
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import unquote, urlparse

from .errors import NotFoundError, ResearcherToolError, ValidationError
from .job_store import JobStore
from .views import result_view, status_view

RESULT_PATH_RE = re.compile(r"^/research-results/([^/]+)$")


class LocalResultTransferServer:
    def __init__(self, jobs: JobStore):
        self.jobs = jobs
        self._lock = threading.Lock()
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def descriptor(self, research_id: str) -> dict[str, str]:
        server = self._ensure_started()
        host, port = server.server_address[:2]
        return {
            "method": "POST",
            "url": f"http://{host}:{port}/research-results/{research_id}",
            "content_type": "application/json",
        }

    def _ensure_started(self) -> ThreadingHTTPServer:
        with self._lock:
            if self._server is not None:
                return self._server
            handler = self._make_handler()
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever, name="anna-researcher-result-transfer", daemon=True)
            thread.start()
            self._server = server
            self._thread = thread
            return server

    def _make_handler(self):
        jobs = self.jobs

        class ResultTransferHandler(BaseHTTPRequestHandler):
            server_version = "AnnaResearcherResultTransfer/0.1"

            def do_OPTIONS(self) -> None:  # noqa: N802
                research_id = self._research_id()
                if not research_id:
                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found", "message": "Not found"})
                    return
                self.send_response(HTTPStatus.NO_CONTENT)
                self._send_cors_headers()
                self.end_headers()

            def do_POST(self) -> None:  # noqa: N802
                research_id = self._research_id()
                if not research_id:
                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found", "message": "Not found"})
                    return
                try:
                    body = self._read_json_body()
                    result = save_http_result(jobs, research_id, body)
                    self._send_json(HTTPStatus.OK, result)
                except NotFoundError as exc:
                    self._send_json(HTTPStatus.NOT_FOUND, error_body(exc))
                except (ValidationError, ValueError) as exc:
                    message = exc.message if isinstance(exc, ValidationError) else str(exc)
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "validation_error", "message": message})
                except ResearcherToolError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, error_body(exc))
                except Exception as exc:  # noqa: BLE001
                    self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "internal_error", "message": f"{type(exc).__name__}: {exc}"})

            def do_GET(self) -> None:  # noqa: N802
                self._method_not_allowed()

            def do_PUT(self) -> None:  # noqa: N802
                self._method_not_allowed()

            def do_DELETE(self) -> None:  # noqa: N802
                self._method_not_allowed()

            def log_message(self, _format: str, *_args: Any) -> None:
                return

            def _method_not_allowed(self) -> None:
                if not self._research_id():
                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found", "message": "Not found"})
                    return
                self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "method_not_allowed", "message": "Method not allowed"})

            def _research_id(self) -> str | None:
                path = urlparse(self.path).path
                match = RESULT_PATH_RE.match(path)
                if not match:
                    return None
                return unquote(match.group(1)).strip()

            def _read_json_body(self) -> dict[str, Any]:
                raw_length = self.headers.get("Content-Length") or "0"
                try:
                    length = int(raw_length)
                except ValueError as exc:
                    raise ValueError("invalid Content-Length") from exc
                raw = self.rfile.read(max(length, 0))
                try:
                    body = json.loads(raw.decode("utf-8") or "{}")
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise ValueError("request body must be valid JSON") from exc
                if not isinstance(body, dict):
                    raise ValueError("request body must be a JSON object")
                return body

            def _send_json(self, status: int, payload: dict[str, Any]) -> None:
                data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(data)

            def _send_cors_headers(self) -> None:
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Access-Control-Allow-Private-Network", "true")

        return ResultTransferHandler


def save_http_result(jobs: JobStore, research_id: str, body: dict[str, Any]) -> dict[str, Any]:
    existing = jobs.load(research_id)
    report = str(body.get("report_markdown") or "")
    if not report.strip():
        raise ValidationError("report_markdown is required for a completed result")
    result = {
        "report_markdown": report,
        "source_urls": body.get("source_urls") or existing.get("source_urls") or [],
        "status": "completed",
        "stage": "completed",
        "progress": 100,
        "error": None,
    }
    job = jobs.save_result(research_id, result)
    return {"job": status_view(job), "result": compact_result_view(job)}


def compact_result_view(job: dict[str, Any]) -> dict[str, Any]:
    return result_view(job, include_sources=False)


def error_body(exc: ResearcherToolError) -> dict[str, Any]:
    return {"error": exc.code, "message": exc.message, "data": exc.data}
