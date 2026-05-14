"""
MCP v0.6 safe bridge for existing Daily Briefing engine outputs.

This bridge only uses offline-safe, read-only cache artifacts by default.
No live LLM API calls are attempted unless explicitly enabled in future work.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload
from mcp.services.data_router import load_artifact


ALLOWED_ENGINE_VERSIONS = {"v3", "v6"}
ALLOWED_RENDERERS = {"claude", "deepseek"}

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

EXTRA_REPLACEMENTS = (
    (re.compile(r"\bstrong\s+buy\b", re.IGNORECASE), "high attention level"),
    (re.compile(r"\btrade\s+setup\b", re.IGNORECASE), "scenario structure"),
    (re.compile(r"\brecommendation\b", re.IGNORECASE), "interpretation guidance"),
)


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _cache_path_for(engine_version: str, renderer: str) -> str:
    if renderer == "claude":
        return f"cache/daily_briefing_{engine_version}.json"
    return f"cache/daily_briefing_deepseek_{engine_version}.json"


def _sanitize_text(text: str) -> str:
    output = str(text or "")
    for pattern, replacement in EXTRA_REPLACEMENTS:
        output = pattern.sub(replacement, output)
    return output


def _sanitize_payload(payload: Any) -> Any:
    payload = sanitize_payload(payload)
    if isinstance(payload, str):
        return _sanitize_text(payload)
    if isinstance(payload, list):
        return [_sanitize_payload(item) for item in payload]
    if isinstance(payload, dict):
        return {key: _sanitize_payload(value) for key, value in payload.items()}
    return payload


def _ensure_no_banned_language(payload: Any) -> None:
    ensure_no_banned_language(payload)
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS:
            if pattern.search(payload):
                raise ValueError(f"Banned language found: {payload}")
        return
    if isinstance(payload, list):
        for item in payload:
            _ensure_no_banned_language(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            _ensure_no_banned_language(value)


def _derive_title(context: Dict[str, Any], payload: Dict[str, Any], engine_version: str, renderer: str) -> str:
    candidates = [
        payload.get("one_line_ko"),
        payload.get("one_line"),
        payload.get("hook_ko"),
        payload.get("hook"),
        payload.get("core_question"),
        context.get("top_market_story"),
    ]
    for row in candidates:
        text = str(row or "").strip()
        if text:
            return text
    return f"Daily Briefing {engine_version.upper()} x {renderer.title()} interpretation context"


def _derive_sections(payload: Dict[str, Any], context: Dict[str, Any]) -> List[Dict[str, str]]:
    sections: List[Dict[str, str]] = []
    for idx, row in enumerate(_as_list(payload.get("sections"))):
        if isinstance(row, dict):
            heading = str(row.get("title") or row.get("id") or f"Section {idx + 1}")
            structural = str(row.get("structural_ko") or row.get("structural") or "").strip()
            implication = str(row.get("implication_ko") or row.get("implication") or "").strip()
            signal = str(row.get("signal") or "").strip()
            parts = [part for part in (structural, implication, signal) if part]
            sections.append({"heading": heading, "content": " ".join(parts).strip()})
        elif isinstance(row, str) and row.strip():
            sections.append({"heading": f"Section {idx + 1}", "content": row.strip()})

    if sections:
        return sections

    top_story = str(context.get("top_market_story") or "No top market story was available.")
    risk_context = _as_dict(context.get("risk_context"))
    risk_pressure = str(risk_context.get("risk_pressure") or "medium")
    return [
        {"heading": "Top Story", "content": top_story},
        {"heading": "Risk Interpretation", "content": f"Risk Pressure is {risk_pressure}; monitor Confirmation and Conflict."},
    ]


def _derive_script(payload: Dict[str, Any], sections: List[Dict[str, str]], context: Dict[str, Any]) -> str:
    lines: List[str] = []
    for row in _as_list(payload.get("human_commentary")):
        text = str(row or "").strip()
        if text:
            lines.append(text)
    for key in ("one_line_ko", "one_line", "market_tension", "core_question"):
        text = str(payload.get(key) or "").strip()
        if text:
            lines.append(text)
    for row in _as_list(payload.get("next_checkpoints")):
        text = str(row or "").strip()
        if text:
            lines.append(f"Checkpoint: {text}")

    if not lines:
        for row in sections:
            lines.append(str(row.get("content") or "").strip())

    if not lines:
        lines.append(str(context.get("top_market_story") or "No market story was available."))

    return "\n".join(line for line in lines if line).strip()


def _disabled_result(
    *,
    context: Dict[str, Any],
    engine_version: str,
    renderer: str,
    mode: str,
    allow_live_calls: bool,
    engine_path: str | None,
    notes: List[str],
) -> Dict[str, Any]:
    title = _derive_title(context, {}, engine_version, renderer)
    output = {
        "engine_version": engine_version,
        "renderer": renderer,
        "mode": mode,
        "title": title,
        "sections": [
            {
                "heading": "Disabled",
                "content": "Safe offline engine wiring was not confirmed for this matrix cell.",
            }
        ],
        "script": (
            "Scenario remains in fallback mode. Keep Interpretation and Watch Zone discipline "
            "until safe offline wiring is confirmed."
        ),
        "_meta": {
            "source": "disabled",
            "engine_path": engine_path,
            "safe_wiring": False,
            "live_api_allowed": bool(allow_live_calls),
            "live_api_call_attempted": False,
            "notes": list(notes),
        },
    }
    output = _sanitize_payload(output)
    _ensure_no_banned_language(output)
    return output


def call_existing_briefing_engine_safe(
    context: dict,
    engine_version: str,
    renderer: str,
    mode: str = "midform",
    allow_live_calls: bool = False,
) -> dict:
    """
    Attempt safe offline bridge call into existing Daily Briefing outputs.

    Safety constraints:
    - no live API calls by default
    - read-only cache artifacts only
    - no production write side effects
    """
    version = str(engine_version or "").strip().lower()
    render = str(renderer or "").strip().lower()
    normalized_mode = str(mode or "midform").strip().lower() or "midform"
    normalized_context = _as_dict(context)

    notes: List[str] = []
    if version not in ALLOWED_ENGINE_VERSIONS:
        return _disabled_result(
            context=normalized_context,
            engine_version=version or "unknown",
            renderer=render or "unknown",
            mode=normalized_mode,
            allow_live_calls=allow_live_calls,
            engine_path=None,
            notes=["Unsupported engine_version for safe bridge."],
        )
    if render not in ALLOWED_RENDERERS:
        return _disabled_result(
            context=normalized_context,
            engine_version=version,
            renderer=render or "unknown",
            mode=normalized_mode,
            allow_live_calls=allow_live_calls,
            engine_path=None,
            notes=["Unsupported renderer for safe bridge."],
        )

    engine_path = _cache_path_for(version, render)
    payload, meta = load_artifact(engine_path, default=None)
    cache_payload = payload if isinstance(payload, dict) else {}
    cache_meta = meta if isinstance(meta, dict) else {}
    if not cache_payload:
        notes.append("Cache payload is missing or invalid; keeping safe fallback.")
        if cache_meta.get("missing_files"):
            notes.append(f"Missing files: {', '.join(str(item) for item in cache_meta.get('missing_files') or [])}")
        if allow_live_calls:
            notes.append("Live calls are allowed by flag but not used in v0.6 safe bridge.")
        return _disabled_result(
            context=normalized_context,
            engine_version=version,
            renderer=render,
            mode=normalized_mode,
            allow_live_calls=allow_live_calls,
            engine_path=engine_path,
            notes=notes,
        )

    title = _derive_title(normalized_context, cache_payload, version, render)
    sections = _derive_sections(cache_payload, normalized_context)
    script = _derive_script(cache_payload, sections, normalized_context)
    if allow_live_calls:
        notes.append("Live calls were allowed by flag but not attempted in safe bridge mode.")

    output = {
        "engine_version": version,
        "renderer": render,
        "mode": normalized_mode,
        "title": title,
        "sections": sections,
        "script": script,
        "_meta": {
            "source": "existing_engine_safe",
            "engine_path": engine_path,
            "safe_wiring": True,
            "live_api_allowed": bool(allow_live_calls),
            "live_api_call_attempted": False,
            "notes": notes,
        },
    }
    output = _sanitize_payload(output)
    _ensure_no_banned_language(output)
    return output

