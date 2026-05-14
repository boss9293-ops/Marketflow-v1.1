"""
Language guardrails for interpretation-only MCP outputs.
"""
from __future__ import annotations

import re
from typing import Any


BANNED_PATTERNS = (
    re.compile(r"\bbuy\b", re.IGNORECASE),
    re.compile(r"\bsell\b", re.IGNORECASE),
    re.compile(r"\bentry\b", re.IGNORECASE),
    re.compile(r"\bexit\b", re.IGNORECASE),
    re.compile(r"\btarget\s+price\b", re.IGNORECASE),
)


def contains_banned_language(text: str) -> bool:
    for pattern in BANNED_PATTERNS:
        if pattern.search(text or ""):
            return True
    return False


def sanitize_text(text: str) -> str:
    if not text:
        return text
    output = str(text)
    output = re.sub(r"\btarget\s+price\b", "reference level", output, flags=re.IGNORECASE)
    output = re.sub(r"\bbuy\b", "accumulation attention", output, flags=re.IGNORECASE)
    output = re.sub(r"\bsell\b", "distribution pressure", output, flags=re.IGNORECASE)
    output = re.sub(r"\bentry\b", "watch zone", output, flags=re.IGNORECASE)
    output = re.sub(r"\bexit\b", "risk step-down", output, flags=re.IGNORECASE)
    return output


def sanitize_payload(payload: Any) -> Any:
    if isinstance(payload, str):
        return sanitize_text(payload)
    if isinstance(payload, list):
        return [sanitize_payload(item) for item in payload]
    if isinstance(payload, dict):
        return {key: sanitize_payload(value) for key, value in payload.items()}
    return payload


def ensure_no_banned_language(payload: Any) -> None:
    if isinstance(payload, str):
        if contains_banned_language(payload):
            raise ValueError(f"Banned language found: {payload}")
        return
    if isinstance(payload, list):
        for item in payload:
            ensure_no_banned_language(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            ensure_no_banned_language(value)


def attention_level_label(score_0_1: float) -> str:
    if score_0_1 >= 0.80:
        return "High"
    if score_0_1 >= 0.62:
        return "Elevated"
    if score_0_1 >= 0.45:
        return "Moderate"
    return "Low"


def risk_pressure_label(score_0_1: float) -> str:
    if score_0_1 >= 0.75:
        return "High"
    if score_0_1 >= 0.55:
        return "Medium"
    return "Low"
