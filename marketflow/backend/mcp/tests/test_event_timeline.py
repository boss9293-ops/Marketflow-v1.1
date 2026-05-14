from __future__ import annotations

import sys
import re
from pathlib import Path
from typing import Any


BACKEND_DIR = Path(__file__).resolve().parents[2]
MARKETFLOW_DIR = BACKEND_DIR.parent
for path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from mcp.tools.event_timeline import build_event_timeline  # noqa: E402


BANNED_PATTERNS = (
    re.compile(r"\bbuy\b", re.IGNORECASE),
    re.compile(r"\bsell\b", re.IGNORECASE),
    re.compile(r"\bentry\b", re.IGNORECASE),
    re.compile(r"\bexit\b", re.IGNORECASE),
    re.compile(r"\btarget\s+price\b", re.IGNORECASE),
)


def _assert_no_banned_language(payload: Any) -> None:
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS:
            assert not pattern.search(payload)
        return
    if isinstance(payload, list):
        for item in payload:
            _assert_no_banned_language(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            _assert_no_banned_language(value)


def test_event_timeline_valid_symbol_shape_and_guardrails():
    result = build_event_timeline("NVDA", lookback_days=5, mode="beginner")
    assert set(result.keys()) == {"symbol", "lookback_days", "timeline", "summary"}
    assert result["symbol"] == "NVDA"
    assert isinstance(result["lookback_days"], int)
    assert isinstance(result["timeline"], list)
    assert isinstance(result["summary"], dict)
    assert set(result["summary"].keys()) == {
        "top_driver",
        "price_confirmation",
        "risk_engine_agreement",
        "beginner_explanation",
    }
    _assert_no_banned_language(result)
