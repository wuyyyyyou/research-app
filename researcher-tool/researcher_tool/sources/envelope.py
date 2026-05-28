from __future__ import annotations

import re
from typing import Any

from ..errors import ValidationError

ENVELOPE_PLACEHOLDERS = frozenset({"token", "query", "page", "page_size", "cursor"})
ENVELOPE_ERROR_CODES = (
    "auth_failed",
    "rate_limited",
    "upstream_5xx",
    "timeout",
    "bad_definition",
    "empty_result",
)
ALLOWED_METHODS = frozenset({"GET", "POST"})
ALLOWED_PAGINATION_MODES = frozenset({"page", "offset", "cursor", "none"})
MAX_PAGES = 5

_OAUTH_HINTS = ("oauth", "client_secret", "refresh_token", "id_token", "access_token")
_HMAC_HINTS = ("hmac", "signature", "signing_key", "signed_request", "x-signature")
_DISALLOWED_CONTENT_HINTS = ("multipart", "octet-stream", "event-stream", "stream", "ndjson")
_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_RESULT_TEMPLATE_RE = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")
_RESULT_CONTEXT_PLACEHOLDERS = frozenset({"query", "page", "page_size", "cursor"})


class EnvelopeError(ValidationError):
    """Stable validation failure for a Research Source envelope."""

    def __init__(self, reason: str, *, detail: str | None = None):
        message = f"bad_definition: {reason}"
        if detail:
            message = f"{message} ({detail})"
        super().__init__(message, data={"reason": reason, "detail": detail or ""})
        self.reason = reason


def validate_envelope(definition: dict[str, Any], *, kind: str = "user") -> None:
    """Reject any envelope that violates ADR 0004's constrained shape."""
    if not isinstance(definition, dict):
        raise EnvelopeError("definition_must_be_object")

    request = definition.get("request")
    if not isinstance(request, dict):
        raise EnvelopeError("request_required")

    method = str(request.get("method") or "").upper()
    if method not in ALLOWED_METHODS:
        raise EnvelopeError("method_must_be_get_or_post", detail=method or "<missing>")

    url = str(request.get("url") or "").strip()
    if not url:
        raise EnvelopeError("url_required")
    if not url.startswith("https://") and not url.startswith("http://"):
        raise EnvelopeError("url_must_be_http")

    headers = request.get("headers") or {}
    if headers and not isinstance(headers, dict):
        raise EnvelopeError("headers_must_be_object")
    body = request.get("body")
    if body is not None and not isinstance(body, (str, dict, list)):
        raise EnvelopeError("body_must_be_json_or_string")

    auth = definition.get("auth")
    if isinstance(auth, dict):
        for token in _OAUTH_HINTS:
            for key in auth:
                if token in str(key).lower():
                    raise EnvelopeError("oauth_not_supported", detail=str(key))
        for token in _HMAC_HINTS:
            for key in auth:
                if token in str(key).lower():
                    raise EnvelopeError("hmac_not_supported", detail=str(key))

    _reject_disallowed_content_types(headers, body)
    _reject_script_fields(definition)

    placeholders_seen = _collect_placeholders(url, headers, body)
    unknown = placeholders_seen - ENVELOPE_PLACEHOLDERS
    if unknown:
        raise EnvelopeError("unknown_placeholder", detail=",".join(sorted(unknown)))

    if "{token}" not in url and not _placeholder_in_mapping(headers, "token") and not _placeholder_in_value(body, "token"):
        raise EnvelopeError("token_placeholder_required")

    pagination = definition.get("pagination") or {"mode": "none"}
    if not isinstance(pagination, dict):
        raise EnvelopeError("pagination_must_be_object")
    mode = str(pagination.get("mode") or "none")
    if mode not in ALLOWED_PAGINATION_MODES:
        raise EnvelopeError("pagination_mode_invalid", detail=mode)
    max_pages = int(pagination.get("max_pages") or 1)
    if max_pages < 1:
        raise EnvelopeError("max_pages_must_be_positive")
    if max_pages > MAX_PAGES:
        raise EnvelopeError("max_pages_exceeds_cap", detail=str(max_pages))

    _validate_result(definition.get("result"))

    response = definition.get("response")
    if response is not None:
        if not isinstance(response, dict):
            raise EnvelopeError("response_must_be_object")
        declared = str(response.get("content_type") or "application/json").lower()
        if "json" not in declared:
            raise EnvelopeError("response_must_be_json", detail=declared)

    max_parallel = int(definition.get("max_parallel") or 1)
    if max_parallel < 1 or max_parallel > 8:
        raise EnvelopeError("max_parallel_out_of_range", detail=str(max_parallel))


def _collect_placeholders(url: str, headers: Any, body: Any) -> set[str]:
    found: set[str] = set()
    found.update(_PLACEHOLDER_RE.findall(url or ""))
    if isinstance(headers, dict):
        for value in headers.values():
            found.update(_PLACEHOLDER_RE.findall(str(value or "")))
    if isinstance(body, str):
        found.update(_PLACEHOLDER_RE.findall(body))
    elif isinstance(body, (dict, list)):
        found.update(_PLACEHOLDER_RE.findall(_stringify(body)))
    return found


def _stringify(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(_stringify(v) for v in value.values())
    if isinstance(value, list):
        return " ".join(_stringify(v) for v in value)
    return str(value or "")


def _placeholder_in_mapping(headers: Any, name: str) -> bool:
    if not isinstance(headers, dict):
        return False
    needle = "{" + name + "}"
    return any(needle in str(v or "") for v in headers.values())


def _placeholder_in_value(body: Any, name: str) -> bool:
    needle = "{" + name + "}"
    return needle in _stringify(body)


def _reject_disallowed_content_types(headers: Any, body: Any) -> None:
    if isinstance(headers, dict):
        for key, value in headers.items():
            lowered_key = str(key).lower()
            lowered_value = str(value or "").lower()
            if lowered_key in {"content-type", "accept"}:
                for hint in _DISALLOWED_CONTENT_HINTS:
                    if hint in lowered_value:
                        raise EnvelopeError("content_type_not_supported", detail=lowered_value)
    if isinstance(body, str):
        lowered = body.lower()
        for hint in _DISALLOWED_CONTENT_HINTS:
            if hint in lowered and "boundary=" in lowered:
                raise EnvelopeError("content_type_not_supported", detail="multipart_body")


def _reject_script_fields(definition: dict[str, Any]) -> None:
    for forbidden in ("script", "pre_request", "transform", "javascript", "lua", "eval"):
        if forbidden in definition:
            raise EnvelopeError("script_fields_not_supported", detail=forbidden)


def _validate_result(result: Any) -> None:
    if not isinstance(result, dict):
        raise EnvelopeError("result_required")
    items_path = result.get("items_path")
    if not isinstance(items_path, str) or not items_path.strip():
        raise EnvelopeError("result_items_path_required")
    _validate_url_spec(result.get("url"))
    _validate_path_or_template_spec(result.get("title"), name="title")
    _validate_content_spec(result.get("content"))
    next_cursor = result.get("next_cursor")
    if next_cursor is not None and (not isinstance(next_cursor, str) or not next_cursor.strip()):
        raise EnvelopeError("result_next_cursor_invalid")


def _validate_url_spec(spec: Any) -> None:
    if not isinstance(spec, dict):
        raise EnvelopeError("result_url_required")
    mode = str(spec.get("mode") or "")
    if mode == "none":
        return
    if mode not in {"path", "template"}:
        raise EnvelopeError("result_url_mode_invalid", detail=mode or "<missing>")
    _require_string_value(spec, reason="result_url_value_required")
    if mode == "template":
        _validate_result_template(str(spec.get("value") or ""))


def _validate_path_or_template_spec(spec: Any, *, name: str) -> None:
    if not isinstance(spec, dict):
        raise EnvelopeError(f"result_{name}_required")
    mode = str(spec.get("mode") or "")
    if mode not in {"path", "template"}:
        raise EnvelopeError(f"result_{name}_mode_invalid", detail=mode or "<missing>")
    _require_string_value(spec, reason=f"result_{name}_value_required")
    if mode == "template":
        _validate_result_template(str(spec.get("value") or ""))


def _validate_content_spec(spec: Any) -> None:
    if not isinstance(spec, dict):
        raise EnvelopeError("result_content_required")
    mode = str(spec.get("mode") or "")
    if mode == "paths":
        value = spec.get("value")
        if not isinstance(value, list) or not value:
            raise EnvelopeError("result_content_paths_must_be_nonempty_array")
        for entry in value:
            if not isinstance(entry, str) or not entry.strip():
                raise EnvelopeError("result_content_path_invalid")
        return
    if mode == "template":
        _require_string_value(spec, reason="result_content_value_required")
        _validate_result_template(str(spec.get("value") or ""))
        return
    raise EnvelopeError("result_content_mode_invalid", detail=mode or "<missing>")


def _require_string_value(spec: dict[str, Any], *, reason: str) -> None:
    value = spec.get("value")
    if not isinstance(value, str) or not value.strip():
        raise EnvelopeError(reason)


def _validate_result_template(template: str) -> None:
    for raw in _RESULT_TEMPLATE_RE.findall(template or ""):
        name = raw.strip()
        if not name:
            raise EnvelopeError("result_template_placeholder_invalid")
        if name == "token" or name.startswith("token.") or name == "context.token" or name.startswith("context.token."):
            raise EnvelopeError("result_template_token_not_allowed")
        if name.startswith("item."):
            path = name[5:]
            if not path:
                raise EnvelopeError("result_template_placeholder_invalid", detail=name)
            continue
        if name.startswith("context."):
            key = name[8:]
            if key not in _RESULT_CONTEXT_PLACEHOLDERS:
                raise EnvelopeError("result_template_context_unknown", detail=key)
            continue
        raise EnvelopeError("result_template_placeholder_invalid", detail=name)
