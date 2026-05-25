#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from researcher_adapter.context_selector import LexicalContextSelector
from researcher_adapter.dispatcher import ResearchDispatcher
from researcher_adapter.errors import ResearcherError
from researcher_adapter.job_store import JobStore
from researcher_adapter.orchestrator import AnnaResearchOrchestrator
from researcher_adapter.sampling_llm import SamplingClient
from researcher_adapter.tavily_retrieval import TavilySummaryRetriever

TOOL_ID = "tool-test-researcher-12345678"
TOOL_METHOD = "research"
VERSION = "0.1.0"

MANIFEST: dict[str, Any] = {
    "name": TOOL_ID,
    "display_name": "Anna Researcher",
    "version": VERSION,
    "description": "Runs a research_report as an Anna App Adapter MVP.",
    "author": "Anna Research",
    "host_capabilities": ["llm.sample"],
    "credentials": [
        {
            "name": "TAVILY_API_KEY",
            "display_name": "Tavily API Key",
            "description": "Required for MVP web retrieval.",
            "required": True,
            "sensitive": True,
        }
    ],
    "tools": [
        {
            "name": TOOL_METHOD,
            "description": "Manage an Anna Researcher job using action=start|advance|get_status|get_result.",
            "parameters": [
                {"name": "action", "type": "string", "description": "start | advance | get_status | get_result", "required": True},
                {"name": "query", "type": "string", "description": "Research query. Required for action=start.", "required": False},
                {"name": "query_domains", "type": "array", "items": {"type": "string"}, "description": "Optional domain filter for Tavily search.", "required": False},
                {"name": "research_id", "type": "string", "description": "Research job identifier for status/result/advance.", "required": False},
            ],
        }
    ],
    "runtime": {"type": "uv", "min_version": "0.1.0"},
}

_stdout_lock = threading.Lock()


def write_frame(msg: dict[str, Any]) -> None:
    payload = json.dumps(msg, ensure_ascii=False)
    with _stdout_lock:
        sys.stdout.write(payload + "\n")
        sys.stdout.flush()


sampling = SamplingClient(write_frame=write_frame)
retriever = TavilySummaryRetriever()
orchestrator = AnnaResearchOrchestrator(
    sampling=sampling,
    retriever=retriever,
    selector=LexicalContextSelector(),
)
dispatcher = ResearchDispatcher(store=JobStore(), orchestrator=orchestrator)

_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
_loop_thread.start()


def make_response(req_id: Any, *, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    response = {"jsonrpc": "2.0", "id": req_id}
    if error is not None:
        response["error"] = error
    else:
        response["result"] = result
    return response


def handle_initialize(req_id: Any, params: dict[str, Any]) -> dict[str, Any]:
    proto = (params or {}).get("protocolVersion") or "1.1"
    if proto != "2.0":
        sampling.disable("host did not negotiate Executa protocol v2; Anna Sampling LLM is unavailable")
    return make_response(
        req_id,
        result={
            "protocolVersion": "2.0" if proto == "2.0" else "1.1",
            "serverInfo": {"name": TOOL_ID, "version": VERSION},
            "client_capabilities": {"sampling": {}} if proto == "2.0" else {},
            "capabilities": {},
        },
    )


def handle_describe(req_id: Any) -> dict[str, Any]:
    return make_response(req_id, result=MANIFEST)


def handle_health(req_id: Any) -> dict[str, Any]:
    return make_response(
        req_id,
        result={
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": VERSION,
            "tools_count": len(MANIFEST["tools"]),
        },
    )


def handle_invoke(req_id: Any, params: dict[str, Any]) -> None:
    tool = params.get("tool")
    args = params.get("arguments") or {}
    context = params.get("context") or {}
    invoke_id = params.get("invoke_id") or ""
    if tool != TOOL_METHOD:
        write_frame(make_response(req_id, error={"code": -32601, "message": f"unknown tool: {tool}"}))
        return
    if not isinstance(args, dict):
        write_frame(make_response(req_id, error={"code": -32602, "message": "`arguments` must be an object"}))
        return

    credentials = context.get("credentials") or {}
    tavily_key = credentials.get("TAVILY_API_KEY") or os.getenv("TAVILY_API_KEY")
    retriever.api_key = tavily_key

    future = asyncio.run_coroutine_threadsafe(
        dispatcher.dispatch(args, context=context, invoke_id=invoke_id),
        _loop,
    )
    try:
        data = future.result(timeout=180)
        write_frame(make_response(req_id, result={"success": True, "tool": tool, "data": data}))
    except ResearcherError as exc:
        write_frame(make_response(req_id, result={"success": False, "tool": tool, "error": exc.message, "data": {"code": exc.code, **exc.data}}))
    except Exception as exc:  # noqa: BLE001
        write_frame(make_response(req_id, result={"success": False, "tool": tool, "error": f"{type(exc).__name__}: {exc}"}))


def handle_message(line: str, pool: ThreadPoolExecutor) -> None:
    try:
        msg = json.loads(line)
    except json.JSONDecodeError as exc:
        write_frame(make_response(None, error={"code": -32700, "message": f"parse error: {exc}"}))
        return

    if "method" not in msg:
        if not sampling.dispatch_response(msg):
            print(f"[anna-researcher] unmatched response id={msg.get('id')!r}", file=sys.stderr)
        return

    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}
    if method == "initialize":
        write_frame(handle_initialize(req_id, params))
    elif method == "describe":
        write_frame(handle_describe(req_id))
    elif method == "health":
        write_frame(handle_health(req_id))
    elif method == "invoke":
        pool.submit(handle_invoke, req_id, params)
    elif method == "shutdown":
        write_frame(make_response(req_id, result={"ok": True}))
    else:
        write_frame(make_response(req_id, error={"code": -32601, "message": f"method not found: {method}"}))


def main() -> None:
    print(f"[anna-researcher] {TOOL_ID} v{VERSION} ready", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=4, thread_name_prefix="invoke") as pool:
        for line in sys.stdin:
            line = line.strip()
            if line:
                handle_message(line, pool)


if __name__ == "__main__":
    main()

