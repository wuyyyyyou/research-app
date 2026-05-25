from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from conftest import PLUGIN_DIR, isolated_env


class PluginProcess:
    def __init__(self, tmp_path):
        self.proc = subprocess.Popen(
            [sys.executable, "researcher_plugin.py"],
            cwd=PLUGIN_DIR,
            env=isolated_env(tmp_path),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.next_id = 1

    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            self.proc.wait(timeout=5)

    def call(self, method, params=None):
        req_id = self.next_id
        self.next_id += 1
        payload = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            payload["params"] = params
        assert self.proc.stdin is not None
        assert self.proc.stdout is not None
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        assert line, self.proc.stderr.read() if self.proc.stderr else "no response"
        response = json.loads(line)
        assert response["id"] == req_id
        return response


def test_describe_and_health(tmp_path):
    plugin = PluginProcess(tmp_path)
    try:
        init = plugin.call("initialize", {"protocolVersion": "2.0"})
        assert init["result"]["protocolVersion"] == "2.0"
        describe = plugin.call("describe")
        assert describe["result"]["name"] == "tool-test-researcher-12345678"
        assert describe["result"]["host_capabilities"] == ["llm.sample"]
        health = plugin.call("health")
        assert health["result"]["status"] == "healthy"
    finally:
        plugin.close()


def test_full_fake_research_lifecycle(tmp_path):
    plugin = PluginProcess(tmp_path)
    try:
        plugin.call("initialize", {"protocolVersion": "2.0"})
        start = plugin.call(
            "invoke",
            {"tool": "research", "arguments": {"action": "start", "query": "anna app adapter"}},
        )
        assert start["result"]["success"] is True
        job = start["result"]["data"]["job"]
        research_id = job["research_id"]

        for _ in range(10):
            advance = plugin.call(
                "invoke",
                {"tool": "research", "arguments": {"action": "advance", "research_id": research_id}, "invoke_id": "invoke-test"},
            )
            assert advance["result"]["success"] is True
            job = advance["result"]["data"]["job"]
            if job["status"] == "completed":
                break

        assert job["status"] == "completed"
        result = plugin.call(
            "invoke",
            {"tool": "research", "arguments": {"action": "get_result", "research_id": research_id}},
        )
        assert result["result"]["success"] is True
        payload = result["result"]["data"]["result"]
        assert payload["report_type"] == "research_report"
        assert payload["report_markdown"].startswith("# Research Report")
        assert payload["source_urls"]
    finally:
        plugin.close()

