from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from ..errors import StoreError


def mask_secret(value: str) -> str:
    """Front-0-back-4 mask (e.g., '***f456'). Never reveals leading characters."""
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) <= 4:
        return "*" * len(text)
    return "***" + text[-4:]


class CredentialStore:
    """File-backed credential storage. Secrets never leave the store in full
    except via :meth:`get_token`, which is consumed only by the executor."""

    def __init__(self, root: Path):
        self.root = root
        self.path = root / "credentials.json"

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            with self.path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise StoreError("credentials file is malformed") from exc
        if not isinstance(data, dict):
            raise StoreError("credentials file root must be an object")
        return data

    def _write(self, data: dict[str, Any]) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        tmp.replace(self.path)

    def get_token(self, source_id: str) -> str:
        record = self._read().get(source_id)
        if isinstance(record, dict):
            return str(record.get("token") or "").strip()
        if isinstance(record, str):
            return record.strip()
        return ""

    def status(self, source_id: str) -> dict[str, Any]:
        token = self.get_token(source_id)
        if not token:
            return {"credential_status": "missing", "credential_masked": ""}
        return {"credential_status": "configured", "credential_masked": mask_secret(token)}

    def set_token(self, source_id: str, token: str) -> dict[str, Any]:
        clean = str(token or "").strip()
        if not clean:
            return self.clear(source_id)
        data = self._read()
        data[source_id] = {"token": clean}
        self._write(data)
        return self.status(source_id)

    def clear(self, source_id: str) -> dict[str, Any]:
        data = self._read()
        if source_id in data:
            data.pop(source_id, None)
            self._write(data)
        return self.status(source_id)

    def remove(self, source_id: str) -> None:
        data = self._read()
        if source_id in data:
            data.pop(source_id, None)
            self._write(data)


def migrate_legacy_tavily_key(settings_store, credential_store: CredentialStore) -> bool:
    """Copy the legacy ``tavily_api_key`` setting into the Tavily credential slot
    exactly once and remove the legacy field. Returns True if a copy happened."""
    raw = settings_store.read_raw()
    legacy = str(raw.get("tavily_api_key") or "").strip()
    if not legacy:
        return False
    existing = credential_store.get_token("tavily")
    if not existing:
        credential_store.set_token("tavily", legacy)
    raw.pop("tavily_api_key", None)
    settings_store._write(raw)
    return existing == ""
