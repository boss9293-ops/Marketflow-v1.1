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

from mcp.tools.watchlist_ranker import rank_watchlist  # noqa: E402


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


def test_watchlist_ranker_empty_watchlist():
    result = rank_watchlist([], lookback_days=3)
    assert result == {"ranked_items": []}


def test_watchlist_ranker_shape_order_and_guardrails():
    result = rank_watchlist(["NVDA", "TSLA", "AAPL"], lookback_days=3)
    assert "ranked_items" in result
    ranked_items = result["ranked_items"]
    assert isinstance(ranked_items, list)
    assert len(ranked_items) >= 1

    required = {"symbol", "attention_score", "main_reason", "risk_pressure", "engine_conflict", "briefing_line"}
    for item in ranked_items:
        assert set(item.keys()) == required
        assert isinstance(item["symbol"], str) and item["symbol"]
        assert isinstance(item["attention_score"], int)
        assert 0 <= item["attention_score"] <= 100

    scores = [item["attention_score"] for item in ranked_items]
    assert scores == sorted(scores, reverse=True)
    _assert_no_banned_language(result)
