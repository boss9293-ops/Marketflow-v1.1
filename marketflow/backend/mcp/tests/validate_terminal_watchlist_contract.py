"""
Validate MCP v0.8 Terminal/Watchlist UI contract outputs.

Run:
  python marketflow/backend/mcp/tests/validate_terminal_watchlist_contract.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List


MARKETFLOW_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = MARKETFLOW_DIR / "backend"
for _path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))


DEFAULT_OUTPUT_DIR = BACKEND_DIR / "output" / "mcp" / "terminal_watchlist"
TERMINAL_FILE = "terminal_event_feed_context.json"
WATCHLIST_FILE = "watchlist_news_context.json"

TERMINAL_TOP_KEYS = ("date", "mode", "top_events", "market_context", "risk_context", "_meta")
TERMINAL_ITEM_KEYS = (
    "rank",
    "symbol",
    "event_type",
    "headline",
    "event_strength",
    "price_confirmation",
    "risk_context",
    "why_it_matters",
    "terminal_line",
)
WATCHLIST_TOP_KEYS = ("mode", "ranked_watchlist_news", "_meta")
WATCHLIST_ITEM_KEYS = (
    "symbol",
    "attention_score",
    "main_event",
    "related_events",
    "risk_pressure",
    "signal_quality",
    "watchlist_line",
)

PRICE_CONFIRMATION_VALUES = {"confirmed", "weak", "conflict", "unclear"}
RISK_PRESSURE_VALUES = {"low", "medium", "high", "unclear"}
SIGNAL_QUALITY_VALUES = {"strong_confirmation", "weak_confirmation", "conflict", "noise", "unclear"}
META_SOURCE_VALUES = {"cache", "fallback"}

BANNED_PATTERNS = (
    re.compile(r"\bbuy\b", re.IGNORECASE),
    re.compile(r"\bsell\b", re.IGNORECASE),
    re.compile(r"\bentry\b", re.IGNORECASE),
    re.compile(r"\bexit\b", re.IGNORECASE),
    re.compile(r"\btarget\s+price\b", re.IGNORECASE),
    re.compile(r"\bstrong\s+buy\b", re.IGNORECASE),
    re.compile(r"\btrade\s+setup\b", re.IGNORECASE),
    re.compile(r"\brecommendation\b", re.IGNORECASE),
)


def _read_json(path: Path, errors: List[str], label: str) -> Dict[str, Any]:
    if not path.exists():
        errors.append(f"{label}: missing file {path}")
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{label}: invalid JSON: {exc}")
        return {}
    if not isinstance(payload, dict):
        errors.append(f"{label}: top-level payload must be object")
        return {}
    return payload


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _require_keys(payload: Dict[str, Any], keys: Iterable[str], errors: List[str], label: str) -> None:
    for key in keys:
        if key not in payload:
            errors.append(f"{label}: missing required key {key}")


def _check_no_banned_language(payload: Any, errors: List[str], path: str = "$") -> None:
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS:
            if pattern.search(payload):
                errors.append(f"{path}: banned term matched {pattern.pattern}")
        return
    if isinstance(payload, list):
        for idx, item in enumerate(payload):
            _check_no_banned_language(item, errors, f"{path}[{idx}]")
        return
    if isinstance(payload, dict):
        for key, value in payload.items():
            _check_no_banned_language(value, errors, f"{path}.{key}")


def _validate_meta(meta: Any, errors: List[str], label: str) -> None:
    if not isinstance(meta, dict):
        errors.append(f"{label}: _meta must be object")
        return
    source = meta.get("source")
    if source not in META_SOURCE_VALUES:
        errors.append(f"{label}: _meta.source must be cache or fallback, got {source!r}")
    if meta.get("live_api_call_attempted") is not False:
        errors.append(f"{label}: _meta.live_api_call_attempted must be false")


def _validate_terminal(payload: Dict[str, Any], errors: List[str]) -> None:
    _require_keys(payload, TERMINAL_TOP_KEYS, errors, "terminal")
    if payload.get("mode") != "terminal":
        errors.append(f"terminal: mode must be terminal, got {payload.get('mode')!r}")
    if not isinstance(payload.get("date"), str) or not payload.get("date"):
        errors.append("terminal: date must be non-empty string")
    if not isinstance(payload.get("market_context"), dict):
        errors.append("terminal: market_context must be object")
    if not isinstance(payload.get("risk_context"), dict):
        errors.append("terminal: risk_context must be object")
    _validate_meta(payload.get("_meta"), errors, "terminal")

    top_events = payload.get("top_events")
    if not isinstance(top_events, list):
        errors.append("terminal: top_events must be array")
        return
    for idx, item in enumerate(top_events):
        label = f"terminal.top_events[{idx}]"
        if not isinstance(item, dict):
            errors.append(f"{label}: item must be object")
            continue
        _require_keys(item, TERMINAL_ITEM_KEYS, errors, label)
        if not _is_number(item.get("rank")):
            errors.append(f"{label}: rank must be number")
        if not isinstance(item.get("symbol"), str) or not item.get("symbol"):
            errors.append(f"{label}: symbol must be non-empty string")
        if not isinstance(item.get("event_type"), str) or not item.get("event_type"):
            errors.append(f"{label}: event_type must be non-empty string")
        if not isinstance(item.get("headline"), str):
            errors.append(f"{label}: headline must be string")
        if not _is_number(item.get("event_strength")) or not 0 <= float(item.get("event_strength", -1)) <= 1:
            errors.append(f"{label}: event_strength must be number in [0, 1]")
        if item.get("price_confirmation") not in PRICE_CONFIRMATION_VALUES:
            errors.append(f"{label}: price_confirmation enum invalid: {item.get('price_confirmation')!r}")
        for text_key in ("risk_context", "why_it_matters", "terminal_line"):
            if not isinstance(item.get(text_key), str):
                errors.append(f"{label}: {text_key} must be string")


def _validate_watchlist(payload: Dict[str, Any], errors: List[str]) -> None:
    _require_keys(payload, WATCHLIST_TOP_KEYS, errors, "watchlist")
    if payload.get("mode") != "watchlist":
        errors.append(f"watchlist: mode must be watchlist, got {payload.get('mode')!r}")
    _validate_meta(payload.get("_meta"), errors, "watchlist")

    rows = payload.get("ranked_watchlist_news")
    if not isinstance(rows, list):
        errors.append("watchlist: ranked_watchlist_news must be array")
        return
    for idx, item in enumerate(rows):
        label = f"watchlist.ranked_watchlist_news[{idx}]"
        if not isinstance(item, dict):
            errors.append(f"{label}: item must be object")
            continue
        _require_keys(item, WATCHLIST_ITEM_KEYS, errors, label)
        if not isinstance(item.get("symbol"), str) or not item.get("symbol"):
            errors.append(f"{label}: symbol must be non-empty string")
        if not _is_number(item.get("attention_score")) or not 0 <= float(item.get("attention_score", -1)) <= 100:
            errors.append(f"{label}: attention_score must be number in [0, 100]")
        if not isinstance(item.get("main_event"), str):
            errors.append(f"{label}: main_event must be string")
        if not isinstance(item.get("related_events"), list):
            errors.append(f"{label}: related_events must be array")
        if item.get("risk_pressure") not in RISK_PRESSURE_VALUES:
            errors.append(f"{label}: risk_pressure enum invalid: {item.get('risk_pressure')!r}")
        if item.get("signal_quality") not in SIGNAL_QUALITY_VALUES:
            errors.append(f"{label}: signal_quality enum invalid: {item.get('signal_quality')!r}")
        if not isinstance(item.get("watchlist_line"), str):
            errors.append(f"{label}: watchlist_line must be string")


def validate_terminal_watchlist_contract(output_dir: str | Path | None = None) -> Dict[str, Any]:
    target_dir = Path(output_dir) if output_dir is not None else DEFAULT_OUTPUT_DIR
    target_dir = target_dir.resolve()
    errors: List[str] = []

    terminal_payload = _read_json(target_dir / TERMINAL_FILE, errors, "terminal")
    watchlist_payload = _read_json(target_dir / WATCHLIST_FILE, errors, "watchlist")
    if terminal_payload:
        _validate_terminal(terminal_payload, errors)
        _check_no_banned_language(terminal_payload, errors, "$.terminal")
    if watchlist_payload:
        _validate_watchlist(watchlist_payload, errors)
        _check_no_banned_language(watchlist_payload, errors, "$.watchlist")

    return {
        "ok": not errors,
        "error_count": len(errors),
        "errors": errors,
        "output_dir": str(target_dir),
        "files_checked": [TERMINAL_FILE, WATCHLIST_FILE],
        "_meta": {
            "source": "mcp_terminal_watchlist_contract_validator",
            "live_api_call_attempted": False,
        },
    }


def main() -> int:
    result = validate_terminal_watchlist_contract()
    if result.get("ok"):
        print("Terminal/Watchlist contract PASS")
        print(f"Output directory: {result.get('output_dir')}")
        return 0

    print("Terminal/Watchlist contract FAIL")
    for error in result.get("errors", []):
        print(f"- {error}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

