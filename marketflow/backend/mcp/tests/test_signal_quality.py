from __future__ import annotations

import sys
import re
from pathlib import Path
from typing import Any, Dict


BACKEND_DIR = Path(__file__).resolve().parents[2]
MARKETFLOW_DIR = BACKEND_DIR.parent
for path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from mcp.tools.signal_quality import evaluate_signal_quality  # noqa: E402


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


def _call(event: Dict[str, float]) -> Dict[str, Any]:
    return evaluate_signal_quality(
        symbol="NVDA",
        event=event,
        price_context=False,
        sector_context=False,
        risk_context=False,
    )


def test_signal_quality_state_selection_and_shape():
    strong = _call(
        {
            "event_strength": 0.90,
            "price_confirmation": 0.86,
            "sector_confirmation": 0.84,
            "volume_confirmation": 0.72,
            "risk_engine_alignment": 0.80,
        }
    )
    assert strong["quality_state"] == "strong_confirmation"

    weak = _call(
        {
            "event_strength": 0.67,
            "price_confirmation": 0.66,
            "sector_confirmation": 0.62,
            "volume_confirmation": 0.58,
            "risk_engine_alignment": 0.64,
        }
    )
    assert weak["quality_state"] == "weak_confirmation"

    conflict = _call(
        {
            "event_strength": 0.88,
            "price_confirmation": 0.20,
            "sector_confirmation": 0.52,
            "volume_confirmation": 0.55,
            "risk_engine_alignment": 0.22,
        }
    )
    assert conflict["quality_state"] == "conflict"

    noise = _call(
        {
            "event_strength": 0.15,
            "price_confirmation": 0.20,
            "sector_confirmation": 0.18,
            "volume_confirmation": 0.24,
            "risk_engine_alignment": 0.25,
        }
    )
    assert noise["quality_state"] == "noise"

    unclear = _call(
        {
            "event_strength": 0.49,
            "price_confirmation": 0.48,
            "sector_confirmation": 0.50,
            "volume_confirmation": 0.45,
            "risk_engine_alignment": 0.52,
        }
    )
    assert unclear["quality_state"] == "unclear"

    for payload in (strong, weak, conflict, noise, unclear):
        assert set(payload.keys()) == {"quality_state", "score", "components", "interpretation", "warning"}
        assert set(payload["components"].keys()) == {
            "event_strength",
            "price_confirmation",
            "sector_confirmation",
            "volume_confirmation",
            "risk_engine_alignment",
        }
        _assert_no_banned_language(payload)
