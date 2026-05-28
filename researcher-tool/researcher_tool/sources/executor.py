from __future__ import annotations

import json
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable

from .envelope import ENVELOPE_ERROR_CODES, MAX_PAGES

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_RESULT_TEMPLATE_RE = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")


class SourceCallError(Exception):
    """Classified failure for a source call. Carries one of the six codes."""

    def __init__(self, code: str, message: str, *, detail: dict[str, Any] | None = None):
        if code not in ENVELOPE_ERROR_CODES:
            code = "bad_definition"
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}


@dataclass
class SourceCallResult:
    source_id: str
    source_name: str
    query: str
    items: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    error: str | None = None


@dataclass
class SourceTestResult:
    source_id: str
    source_name: str
    query: str
    pages: list[dict[str, Any]] = field(default_factory=list)
    extracted: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    error: dict[str, Any] | None = None


@dataclass
class PreparedRequest:
    method: str
    url: str
    headers: dict[str, str]
    body: Any = None
    body_text: str = ""
    body_bytes: bytes | None = None

    def to_public(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "method": self.method,
            "url": self.url,
            "headers": self.headers,
        }
        if self.body is not None:
            data["body"] = self.body
        if self.body_text:
            data["body_text"] = self.body_text
        return data


@dataclass
class HttpResponseDebug:
    status: int
    headers: dict[str, str]
    text: str
    json: Any = None


class ResearchSourceExecutor:
    """Executes a single Research Source call per the constrained envelope.

    The executor does not see secret values from the user; it pulls the token
    from a credentials provider keyed by ``source_id`` immediately before HTTP."""

    def __init__(
        self,
        *,
        token_provider: Callable[[str], str],
        http_open: Callable[..., Any] | None = None,
        clock: Callable[[], float] | None = None,
        sleep: Callable[[float], None] | None = None,
        timeout: float = 30.0,
    ):
        self.token_provider = token_provider
        self._http_open = http_open or urllib.request.urlopen
        self._clock = clock or time.monotonic
        self._sleep = sleep or time.sleep
        self.timeout = timeout

    def call(self, definition: dict[str, Any], query: str) -> SourceCallResult:
        source_id = str(definition.get("id") or "")
        source_name = str(definition.get("name") or source_id)
        started = self._clock()
        try:
            token = self.token_provider(source_id)
            if not token:
                raise SourceCallError("auth_failed", "credential missing for source")
            items = self._paginate(definition, query=query, token=token)
        except SourceCallError as exc:
            duration_ms = int((self._clock() - started) * 1000)
            return SourceCallResult(
                source_id=source_id,
                source_name=source_name,
                query=query,
                items=[],
                duration_ms=duration_ms,
                error=exc.code,
            )

        duration_ms = int((self._clock() - started) * 1000)
        if not items:
            return SourceCallResult(
                source_id=source_id,
                source_name=source_name,
                query=query,
                items=[],
                duration_ms=duration_ms,
                error="empty_result",
            )
        return SourceCallResult(
            source_id=source_id,
            source_name=source_name,
            query=query,
            items=items,
            duration_ms=duration_ms,
            error=None,
        )

    def test(self, definition: dict[str, Any], query: str) -> SourceTestResult:
        source_id = str(definition.get("id") or "")
        source_name = str(definition.get("name") or source_id)
        started = self._clock()
        pages: list[dict[str, Any]] = []
        extracted: list[dict[str, Any]] = []
        error: dict[str, Any] | None = None
        try:
            token = self.token_provider(source_id)
            if not token:
                raise SourceCallError("auth_failed", "credential missing for source")
            extracted = self._paginate_debug(definition, query=query, token=token, pages=pages)
            if not extracted:
                error = {"code": "empty_result", "message": "research source returned no results"}
        except SourceCallError as exc:
            error = {"code": exc.code, "message": exc.message, "detail": exc.detail}

        duration_ms = int((self._clock() - started) * 1000)
        return SourceTestResult(
            source_id=source_id,
            source_name=source_name,
            query=query,
            pages=pages,
            extracted=extracted,
            duration_ms=duration_ms,
            error=error,
        )

    def _paginate(self, definition: dict[str, Any], *, query: str, token: str) -> list[dict[str, Any]]:
        pagination = definition.get("pagination") or {"mode": "none", "max_pages": 1}
        mode = str(pagination.get("mode") or "none")
        max_pages = min(int(pagination.get("max_pages") or 1), MAX_PAGES)
        page_size = int(pagination.get("page_size") or 5)
        start_page = int(pagination.get("start_page") or 1)
        items: list[dict[str, Any]] = []
        cursor = ""
        page_index = start_page

        for step in range(max_pages):
            ctx = {
                "token": token,
                "query": query,
                "page": str(page_index),
                "page_size": str(page_size),
                "cursor": cursor,
            }
            response = self._issue_request(definition, ctx)
            new_items, next_cursor = self._extract_items(definition, response, ctx=ctx)
            items.extend(new_items)
            if mode == "page":
                page_index += 1
                if not new_items:
                    break
            elif mode == "offset":
                page_index += page_size
                if not new_items:
                    break
            elif mode == "cursor":
                if not next_cursor or next_cursor == cursor:
                    break
                cursor = next_cursor
            else:
                break
        return items

    def _paginate_debug(
        self,
        definition: dict[str, Any],
        *,
        query: str,
        token: str,
        pages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        pagination = definition.get("pagination") or {"mode": "none", "max_pages": 1}
        mode = str(pagination.get("mode") or "none")
        max_pages = min(int(pagination.get("max_pages") or 1), MAX_PAGES)
        page_size = int(pagination.get("page_size") or 5)
        start_page = int(pagination.get("start_page") or 1)
        items: list[dict[str, Any]] = []
        cursor = ""
        page_index = start_page

        for step in range(max_pages):
            ctx = {
                "token": token,
                "query": query,
                "page": str(page_index),
                "page_size": str(page_size),
                "cursor": cursor,
            }
            prepared = self._prepare_request(definition, ctx)
            page: dict[str, Any] = {
                "page": step + 1,
                "context": {k: v for k, v in ctx.items() if k != "token"},
                "request": prepared.to_public(),
            }
            pages.append(page)
            response = self._do_http_debug(prepared)
            page["response"] = {
                "status": response.status,
                "headers": response.headers,
                "text": response.text,
                "json": response.json,
            }
            new_items, next_cursor = self._extract_items(definition, response.json if response.json is not None else {}, ctx=ctx)
            page["extracted"] = new_items
            page["next_cursor"] = next_cursor
            items.extend(new_items)
            if mode == "page":
                page_index += 1
                if not new_items:
                    break
            elif mode == "offset":
                page_index += page_size
                if not new_items:
                    break
            elif mode == "cursor":
                if not next_cursor or next_cursor == cursor:
                    break
                cursor = next_cursor
            else:
                break
        return items

    def _prepare_request(self, definition: dict[str, Any], ctx: dict[str, str]) -> PreparedRequest:
        request = definition.get("request") or {}
        method = str(request.get("method") or "GET").upper()
        url = _substitute(str(request.get("url") or ""), ctx, url_encode=True, url_target=True)
        headers_in = request.get("headers") or {}
        headers = {str(k): _substitute(str(v), ctx) for k, v in headers_in.items() if v is not None}
        body = request.get("body")
        body_out: Any = None
        body_text = ""
        body_bytes: bytes | None = None
        if method == "POST" and body is not None:
            if isinstance(body, (dict, list)):
                substituted = _substitute_in_json(body, ctx)
                body_out = substituted
                body_text = json.dumps(substituted, ensure_ascii=False)
                body_bytes = body_text.encode("utf-8")
                headers.setdefault("Content-Type", "application/json")
            else:
                body_text = _substitute(str(body), ctx)
                body_out = body_text
                body_bytes = body_text.encode("utf-8")
        return PreparedRequest(method=method, url=url, headers=headers, body=body_out, body_text=body_text, body_bytes=body_bytes)

    def _issue_request(self, definition: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any]:
        prepared = self._prepare_request(definition, ctx)

        retries = 1 if prepared.method == "GET" else 0
        last_exc: Exception | None = None
        for attempt in range(retries + 1):
            try:
                return self._do_http(prepared.method, prepared.url, prepared.headers, prepared.body_bytes)
            except SourceCallError as exc:
                last_exc = exc
                if exc.code in {"rate_limited", "upstream_5xx"} and attempt < retries:
                    self._sleep(1.0)
                    continue
                raise
        if last_exc is None:
            raise SourceCallError("bad_definition", "request did not execute")
        raise last_exc  # pragma: no cover

    def _do_http_debug(self, prepared: PreparedRequest) -> HttpResponseDebug:
        try:
            req = urllib.request.Request(prepared.url, data=prepared.body_bytes, headers=prepared.headers, method=prepared.method)
        except ValueError as exc:
            raise SourceCallError("bad_definition", f"invalid request: {exc}") from exc
        try:
            with self._http_open(req, timeout=self.timeout) as response:
                raw = response.read()
                status = getattr(response, "status", 200)
                headers = dict(getattr(response, "headers", {}) or {})
        except urllib.error.HTTPError as exc:
            code = _classify_http_status(exc.code)
            text = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
            detail = {
                "status": exc.code,
                "headers": dict(getattr(exc, "headers", {}) or {}),
                "text": text,
            }
            raise SourceCallError(code, f"HTTP {exc.code}", detail=detail) from exc
        except socket.timeout as exc:
            raise SourceCallError("timeout", "request timed out") from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            if isinstance(reason, socket.timeout):
                raise SourceCallError("timeout", "request timed out") from exc
            raise SourceCallError("upstream_5xx", f"upstream unavailable: {reason}") from exc
        except Exception as exc:  # pragma: no cover - defensive
            raise SourceCallError("upstream_5xx", f"transport failure: {exc}") from exc

        text = raw.decode("utf-8", errors="replace")
        parsed: Any = None
        if text.strip():
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SourceCallError("bad_definition", f"non-JSON response: {exc}", detail={"status": status, "headers": headers, "text": text}) from exc
        else:
            parsed = {}

        if status >= 500:
            raise SourceCallError("upstream_5xx", f"HTTP {status}", detail={"status": status, "headers": headers, "text": text, "json": parsed})
        if status in (401, 403):
            raise SourceCallError("auth_failed", f"HTTP {status}", detail={"status": status, "headers": headers, "text": text, "json": parsed})
        if status == 429:
            raise SourceCallError("rate_limited", "HTTP 429", detail={"status": status, "headers": headers, "text": text, "json": parsed})
        if status >= 400:
            raise SourceCallError("bad_definition", f"HTTP {status}", detail={"status": status, "headers": headers, "text": text, "json": parsed})
        return HttpResponseDebug(status=status, headers=headers, text=text, json=parsed)

    def _do_http(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        body_bytes: bytes | None,
    ) -> dict[str, Any]:
        try:
            req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
        except ValueError as exc:
            raise SourceCallError("bad_definition", f"invalid request: {exc}") from exc
        try:
            with self._http_open(req, timeout=self.timeout) as response:
                raw = response.read()
                status = getattr(response, "status", 200)
        except urllib.error.HTTPError as exc:
            code = _classify_http_status(exc.code)
            raise SourceCallError(code, f"HTTP {exc.code}") from exc
        except socket.timeout as exc:
            raise SourceCallError("timeout", "request timed out") from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            if isinstance(reason, socket.timeout):
                raise SourceCallError("timeout", "request timed out") from exc
            raise SourceCallError("upstream_5xx", f"upstream unavailable: {reason}") from exc
        except Exception as exc:  # pragma: no cover - defensive
            raise SourceCallError("upstream_5xx", f"transport failure: {exc}") from exc

        if status >= 500:
            raise SourceCallError("upstream_5xx", f"HTTP {status}")
        if status in (401, 403):
            raise SourceCallError("auth_failed", f"HTTP {status}")
        if status == 429:
            raise SourceCallError("rate_limited", "HTTP 429")
        if status >= 400:
            raise SourceCallError("bad_definition", f"HTTP {status}")

        text = raw.decode("utf-8", errors="replace")
        if not text.strip():
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise SourceCallError("bad_definition", f"non-JSON response: {exc}") from exc

    def _extract_items(
        self,
        definition: dict[str, Any],
        response: Any,
        *,
        ctx: dict[str, str],
    ) -> tuple[list[dict[str, Any]], str]:
        result = definition.get("result") or {}
        items_path = str(result.get("items_path") or "")
        raw_items = resolve_path(response, items_path)
        if raw_items is None:
            return [], ""
        if isinstance(raw_items, list):
            item_entries = raw_items
        elif isinstance(raw_items, dict):
            item_entries = [raw_items]
        else:
            raise SourceCallError("bad_definition", f"items_path did not yield a list or object: {items_path}")
        next_cursor_path = str(result.get("next_cursor") or "")

        out: list[dict[str, Any]] = []
        for entry in item_entries:
            url = _render_result_value(result.get("url"), entry, ctx)
            title = _render_result_value(result.get("title"), entry, ctx)
            content_text = _render_result_value(result.get("content"), entry, ctx)
            out.append(
                {
                    "query": ctx.get("query") or "",
                    "source_id": definition.get("id") or "",
                    "source_name": definition.get("name") or definition.get("id") or "",
                    "url": url,
                    "title": title,
                    "content": content_text,
                }
            )
        next_cursor = ""
        if next_cursor_path:
            next_cursor = stringify_value(resolve_path(response, next_cursor_path))
        return out, next_cursor


def _classify_http_status(code: int) -> str:
    if code in (401, 403):
        return "auth_failed"
    if code == 429:
        return "rate_limited"
    if code >= 500:
        return "upstream_5xx"
    return "bad_definition"


def _substitute(value: str, ctx: dict[str, str], *, url_encode: bool = False, url_target: bool = False) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in ctx:
            return match.group(0)
        raw = ctx[key]
        if url_target:
            return urllib.parse.quote(raw, safe=":/?&=+%,")
        if url_encode:
            return urllib.parse.quote(raw, safe="")
        return raw

    return _PLACEHOLDER_RE.sub(replace, value)


def _substitute_in_json(value: Any, ctx: dict[str, str]) -> Any:
    if isinstance(value, dict):
        return {k: _substitute_in_json(v, ctx) for k, v in value.items()}
    if isinstance(value, list):
        return [_substitute_in_json(v, ctx) for v in value]
    if isinstance(value, str):
        if value.startswith("{") and value.endswith("}") and "}" not in value[1:-1]:
            key = value[1:-1]
            if key in ctx:
                return ctx[key]
        return _substitute(value, ctx)
    return value


def _render_result_value(spec: Any, item: Any, ctx: dict[str, str]) -> str:
    if not isinstance(spec, dict):
        return ""
    mode = str(spec.get("mode") or "")
    value = spec.get("value")
    if mode == "none":
        return ""
    if mode == "path":
        return stringify_value(resolve_path(item, str(value or "")))
    if mode == "paths":
        parts: list[str] = []
        for path in list(value or []):
            text = stringify_value(resolve_path(item, str(path)))
            if text:
                parts.append(text)
        return "\n".join(parts)
    if mode == "template":
        return _render_result_template(str(value or ""), item, ctx)
    return ""


def _render_result_template(template: str, item: Any, ctx: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1).strip()
        if name.startswith("item."):
            return stringify_value(resolve_path(item, name[5:]))
        if name.startswith("context."):
            return str(ctx.get(name[8:], ""))
        return ""

    return _RESULT_TEMPLATE_RE.sub(replace, template)


def resolve_path(value: Any, path: str) -> Any:
    """Resolve a dot-and-bracket-index path against a JSON document.

    Examples: ``data.results[]`` returns the list under ``data.results``;
    ``items[0].name`` indexes a specific element; ``a.b.c`` walks nested
    dictionaries. Unknown segments yield ``None``."""
    if not path:
        return value
    cursor: Any = value
    for segment in _split_path(path):
        if cursor is None:
            return None
        if segment.endswith("[]"):
            key = segment[:-2]
            cursor = cursor.get(key) if isinstance(cursor, dict) and key else cursor
            if not isinstance(cursor, list):
                return None
            return cursor
        if "[" in segment and segment.endswith("]"):
            key, _, rest = segment.partition("[")
            index_str = rest[:-1]
            try:
                index = int(index_str)
            except ValueError:
                return None
            container = cursor.get(key) if isinstance(cursor, dict) and key else cursor
            if not isinstance(container, list) or index >= len(container) or index < -len(container):
                return None
            cursor = container[index]
            continue
        if isinstance(cursor, dict):
            cursor = cursor.get(segment)
        elif isinstance(cursor, list):
            try:
                cursor = cursor[int(segment)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return cursor


def _split_path(path: str) -> list[str]:
    segments: list[str] = []
    for chunk in path.split("."):
        if not chunk:
            continue
        segments.append(chunk)
    return segments


def stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple)):
        return ", ".join(stringify_value(v) for v in value if v is not None)
    if isinstance(value, dict):
        try:
            return json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(value)
    return str(value)
