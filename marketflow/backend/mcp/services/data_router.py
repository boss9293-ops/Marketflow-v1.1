"""
Shared MCP data routing helpers.
Cache-first, safe path handling, and deterministic fallbacks.
"""
from __future__ import annotations

import copy
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional, Tuple


def find_backend_root() -> Path:
    """
    Resolve backend root from current module path robustly.
    Returns a deterministic fallback even if expected structure changes.
    """
    current = Path(__file__).resolve()
    for parent in current.parents:
        cache_dir = parent / "output" / "cache"
        if cache_dir.exists() and parent.name == "backend":
            return parent
    # Deterministic fallback for current project layout:
    # backend/mcp/services/data_router.py -> parents[2] = backend
    return current.parents[2]


BACKEND_DIR = find_backend_root()
OUTPUT_DIR = BACKEND_DIR / "output"
CACHE_DIR = OUTPUT_DIR / "cache"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_symbol(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if ":" in raw:
        raw = raw.split(":")[-1]
    return raw


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        if value is None:
            return default
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return default
            value = stripped
        number = float(value)
        if number != number:
            return default
        return number
    except Exception:
        return default


def safe_int(
    value: Any,
    default: int,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
) -> int:
    try:
        output = int(value)
    except Exception:
        output = int(default)
    if min_value is not None:
        output = max(min_value, output)
    if max_value is not None:
        output = min(max_value, output)
    return output


def clamp01(value: Any, default: float = 0.0) -> float:
    number = safe_float(value, default)
    if number is None:
        return float(default)
    return max(0.0, min(1.0, float(number)))


def parse_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    if len(text) >= 10:
        text = text[:10]
    try:
        return date.fromisoformat(text)
    except Exception:
        return None


def safe_read_json(path: str | Path) -> Any:
    """
    Safe JSON read utility.
    Never raises; returns None on any issue.
    """
    try:
        target = Path(path)
        if not target.exists() or not target.is_file():
            return None
        return json.loads(target.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_available_cache_files() -> list[str]:
    """
    List available cache JSON filenames under backend/output/cache.
    """
    try:
        if not CACHE_DIR.exists():
            return []
        return sorted([item.name for item in CACHE_DIR.iterdir() if item.is_file() and item.suffix.lower() == ".json"])
    except Exception:
        return []


def _meta(source: str, loaded_files: list[str] | None = None, missing_files: list[str] | None = None) -> dict:
    return {
        "source": source,
        "loaded_files": list(loaded_files or []),
        "missing_files": list(missing_files or []),
        "loaded_at": utc_now_iso(),
    }


def _with_embedded_meta(meta: dict) -> dict:
    """
    Ensure returned meta includes a nested `_meta` block for callers that
    expect `_meta.source` style access, while preserving top-level fields.
    """
    output = dict(meta or {})
    output["_meta"] = _meta(
        source=str(output.get("source") or "fallback"),
        loaded_files=list(output.get("loaded_files") or []),
        missing_files=list(output.get("missing_files") or []),
    )
    return output


def read_cache_json(filename: str, default: Any = None) -> Tuple[Any, dict]:
    """
    Read JSON from backend/output/cache safely with deterministic fallback.
    Returns (payload, meta).
    """
    safe_name = str(filename or "").replace("\\", "/").strip("/ ")
    path = CACHE_DIR / safe_name
    payload = safe_read_json(path)
    if payload is None:
        fallback = copy.deepcopy(default)
        meta = _meta(source="fallback", loaded_files=[], missing_files=[safe_name or str(path.name)])
        return fallback, _with_embedded_meta(meta)
    meta = _meta(source="cache", loaded_files=[safe_name], missing_files=[])
    return payload, _with_embedded_meta(meta)


def resolve_artifact_path(relative_path: str) -> Path:
    rel = str(relative_path or "").replace("\\", "/").lstrip("/")
    candidate = (OUTPUT_DIR / Path(rel)).resolve()
    root = OUTPUT_DIR.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Artifact path escapes output root: {relative_path!r}") from exc
    return candidate


def load_json_file(path: Path) -> Any:
    return safe_read_json(path)


def load_artifact(relative_path: str, default: Any = None) -> Tuple[Any, dict]:
    rel = str(relative_path or "").replace("\\", "/").strip()
    if rel.startswith("cache/"):
        cache_name = rel.split("cache/", 1)[1]
        payload, meta = read_cache_json(cache_name, default=default)
        base_meta = dict(meta or {})
        base_meta.update(
            {
                "relative_path": rel,
                "resolved_path": str(CACHE_DIR / cache_name),
                "found": base_meta.get("source") == "cache",
            }
        )
        return payload, _with_embedded_meta(base_meta)

    path = resolve_artifact_path(rel)
    payload = load_json_file(path)
    if payload is None:
        meta = {
            "relative_path": rel,
            "resolved_path": str(path),
            "found": False,
            "source": "fallback",
            "missing_files": [rel],
            "loaded_files": [],
            "loaded_at": utc_now_iso(),
        }
        return copy.deepcopy(default), _with_embedded_meta(meta)
    meta = {
        "relative_path": rel,
        "resolved_path": str(path),
        "found": True,
        "source": "cache",
        "missing_files": [],
        "loaded_files": [rel],
        "loaded_at": utc_now_iso(),
    }
    return payload, _with_embedded_meta(meta)


def load_first_available(candidates: Iterable[str], default: Any = None) -> Tuple[Any, dict]:
    candidate_list = [str(item) for item in candidates]
    collected_missing: list[str] = []
    first_missing_meta = {
        "relative_path": candidate_list[0] if candidate_list else None,
        "resolved_path": None,
        "found": False,
        "source": "fallback",
        "missing_files": [],
        "loaded_files": [],
        "loaded_at": utc_now_iso(),
    }
    for candidate in candidate_list:
        payload, meta = load_artifact(candidate, default=None)
        if meta.get("found"):
            return payload, meta
        for missing_name in meta.get("missing_files") or [str(candidate)]:
            if missing_name not in collected_missing:
                collected_missing.append(missing_name)
        if first_missing_meta.get("resolved_path") is None:
            first_missing_meta["resolved_path"] = meta.get("resolved_path")
    first_missing_meta["missing_files"] = collected_missing
    return copy.deepcopy(default), _with_embedded_meta(first_missing_meta)
