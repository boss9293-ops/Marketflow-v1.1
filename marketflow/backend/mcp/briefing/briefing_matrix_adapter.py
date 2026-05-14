"""
MCP v0.4 briefing matrix adapter.

Builds test-only 2x2 briefing outputs from MCP daily briefing context:
- v3 + claude
- v3 + deepseek
- v6 + claude
- v6 + deepseek

Source mode policy:
- placeholder (default): offline placeholder only
- existing_engine_safe: cache-read only; no live API call
- disabled: returns disabled payload
"""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List

from mcp.briefing.briefing_engine_bridge import call_existing_briefing_engine_safe
from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload


ALLOWED_ENGINE_VERSIONS = {"v3", "v6"}
ALLOWED_RENDERERS = {"claude", "deepseek"}
ALLOWED_SOURCE_MODES = {"placeholder", "existing_engine_safe", "disabled"}


def _env_flag(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return default
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return default


ALLOW_LIVE_BRIEFING_CALLS = _env_flag("MARKETFLOW_MCP_ALLOW_LIVE_BRIEFING_CALLS", default=False)


BANNED_PATTERNS_V03 = (
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
    (re.compile(r"\brecommendation\b", re.IGNORECASE), "interpretation note"),
)


def _normalize_mode(mode: Any) -> str:
    text = str(mode or "midform").strip().lower()
    return text if text else "midform"


def _normalize_source_mode(mode: Any) -> str:
    text = str(mode or "placeholder").strip().lower()
    if text not in ALLOWED_SOURCE_MODES:
        raise ValueError(f"Unsupported source_mode: {mode!r}")
    return text


def _cache_candidate(engine_version: str, renderer: str) -> str:
    if renderer == "claude":
        return f"cache/daily_briefing_{engine_version}.json"
    return f"cache/daily_briefing_deepseek_{engine_version}.json"


def _merge_meta(base_meta: Dict[str, Any], source_mode: str, context: Dict[str, Any], cache_file: str) -> Dict[str, Any]:
    meta = dict(base_meta or {})
    meta["source_mode"] = source_mode
    meta["context_source"] = "mcp_daily_briefing_context"
    meta["cache_file"] = cache_file
    meta.setdefault("engine_path", meta.get("engine_path"))
    meta.setdefault("safe_wiring", bool(meta.get("safe_wiring", False)))
    meta.setdefault("live_api_allowed", bool(meta.get("live_api_allowed", ALLOW_LIVE_BRIEFING_CALLS)))
    meta.setdefault("live_api_call_attempted", bool(meta.get("live_api_call_attempted", False)))
    meta.setdefault("notes", list(meta.get("notes") or []))
    meta["context_digest"] = _context_digest(context)
    meta.setdefault("live_api_guard", "offline_only_default")
    return meta


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _sanitize_text_v03(text: str) -> str:
    output = str(text or "")
    for pattern, replacement in EXTRA_REPLACEMENTS:
        output = pattern.sub(replacement, output)
    return output


def _sanitize_payload_v03(payload: Any) -> Any:
    payload = sanitize_payload(payload)
    if isinstance(payload, str):
        return _sanitize_text_v03(payload)
    if isinstance(payload, list):
        return [_sanitize_payload_v03(item) for item in payload]
    if isinstance(payload, dict):
        return {key: _sanitize_payload_v03(value) for key, value in payload.items()}
    return payload


def _ensure_no_banned_language_v03(payload: Any) -> None:
    ensure_no_banned_language(payload)
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS_V03:
            if pattern.search(payload):
                raise ValueError(f"Banned language found: {payload}")
        return
    if isinstance(payload, list):
        for item in payload:
            _ensure_no_banned_language_v03(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            _ensure_no_banned_language_v03(value)


def _derive_title(context: Dict[str, Any], payload: Dict[str, Any], engine_version: str, renderer: str) -> str:
    candidates = [
        payload.get("one_line_ko"),
        payload.get("one_line"),
        payload.get("hook_ko"),
        payload.get("hook"),
        payload.get("core_question"),
        context.get("top_market_story"),
    ]
    for item in candidates:
        text = str(item or "").strip()
        if text:
            return text
    return f"Daily Briefing {engine_version.upper()} x {renderer.title()} interpretation context"


def _normalize_sections_from_payload(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    sections: List[Dict[str, str]] = []
    for idx, row in enumerate(_as_list(payload.get("sections"))):
        if isinstance(row, dict):
            heading = str(row.get("title") or row.get("id") or f"Section {idx + 1}")
            structural = str(row.get("structural_ko") or row.get("structural") or "").strip()
            implication = str(row.get("implication_ko") or row.get("implication") or "").strip()
            signal = str(row.get("signal") or "").strip()
            content_parts = [part for part in (structural, implication, signal) if part]
            sections.append({"heading": heading, "content": " ".join(content_parts).strip()})
        elif isinstance(row, str) and row.strip():
            sections.append({"heading": f"Section {idx + 1}", "content": row.strip()})
    return sections


def _fallback_sections_from_context(context: Dict[str, Any]) -> List[Dict[str, str]]:
    top_story = str(context.get("top_market_story") or "No top market story was available.")
    risk_context = _as_dict(context.get("risk_context"))
    risk_pressure = str(risk_context.get("risk_pressure") or "medium")
    watchlist = _as_list(context.get("watchlist_rank"))
    leaders = ", ".join(str(item.get("symbol") or "").strip() for item in watchlist[:3] if isinstance(item, dict))
    if not leaders:
        leaders = "No leaders were available."
    return [
        {"heading": "Top Story", "content": top_story},
        {"heading": "Attention Leaders", "content": f"Attention Level context: {leaders}."},
        {
            "heading": "Risk Interpretation",
            "content": f"Risk Pressure is {risk_pressure}; keep Confirmation and Conflict in the Watch Zone.",
        },
    ]


def _derive_script(context: Dict[str, Any], payload: Dict[str, Any], sections: List[Dict[str, str]]) -> str:
    lines: List[str] = []
    human_commentary = _as_list(payload.get("human_commentary"))
    for item in human_commentary:
        text = str(item or "").strip()
        if text:
            lines.append(text)

    for key in ("one_line_ko", "one_line", "market_tension", "core_question"):
        text = str(payload.get(key) or "").strip()
        if text:
            lines.append(text)

    checkpoints = _as_list(payload.get("next_checkpoints"))
    for item in checkpoints:
        text = str(item or "").strip()
        if text:
            lines.append(f"Checkpoint: {text}")

    if not lines:
        for section in sections:
            lines.append(str(section.get("content") or "").strip())

    if not lines:
        top_story = str(context.get("top_market_story") or "No market story was available.")
        lines = [
            f"Interpretation: {top_story}",
            "Scenario: Keep Watch Zone discipline while Confirmation and Conflict signals evolve.",
        ]

    script = "\n".join(line for line in lines if line).strip()
    return script


def _context_digest(context: Dict[str, Any]) -> Dict[str, Any]:
    watchlist = _as_list(context.get("watchlist_rank"))
    return {
        "date": context.get("date"),
        "top_market_story": context.get("top_market_story"),
        "top_event_count": len(_as_list(context.get("top_events"))),
        "watchlist_symbols": [
            str(item.get("symbol") or "").strip()
            for item in watchlist[:5]
            if isinstance(item, dict) and str(item.get("symbol") or "").strip()
        ],
    }


def _disabled_payload(version: str, renderer: str, mode: str) -> Dict[str, Any]:
    return {
        "engine_version": version,
        "renderer": renderer,
        "mode": mode,
        "title": f"Daily Briefing {version.upper()} x {renderer.title()} is disabled",
        "sections": [
            {
                "heading": "Disabled",
                "content": "This matrix cell is disabled for safe test harness operation.",
            }
        ],
        "script": "Interpretation is disabled in this mode. Keep using placeholder context for safe testing.",
        "_meta": {},
    }


def build_briefing_from_context(
    context: dict,
    engine_version: str,
    renderer: str,
    mode: str = "midform",
    source_mode: str = "placeholder",
) -> dict:
    """
    Build a test-only normalized briefing output from MCP context.
    Default source mode is offline placeholder.
    """
    version = str(engine_version or "").strip().lower()
    render = str(renderer or "").strip().lower()
    if version not in ALLOWED_ENGINE_VERSIONS:
        raise ValueError(f"Unsupported engine_version: {engine_version!r}")
    if render not in ALLOWED_RENDERERS:
        raise ValueError(f"Unsupported renderer: {renderer!r}")

    normalized_context = _as_dict(context)
    normalized_mode = _normalize_mode(mode)
    normalized_source_mode = _normalize_source_mode(source_mode)
    cache_file = _cache_candidate(version, render)

    cache_payload: Dict[str, Any] = {}
    source = "adapter_placeholder"

    if normalized_source_mode == "disabled":
        output = _disabled_payload(version=version, renderer=render, mode=normalized_mode)
        source = "disabled"
    else:
        if normalized_source_mode == "existing_engine_safe":
            output = call_existing_briefing_engine_safe(
                context=normalized_context,
                engine_version=version,
                renderer=render,
                mode=normalized_mode,
                allow_live_calls=bool(ALLOW_LIVE_BRIEFING_CALLS),
            )
            source = str(_as_dict(output.get("_meta")).get("source") or "disabled")
        else:
            title = _derive_title(normalized_context, cache_payload, version, render)
            sections = _normalize_sections_from_payload(cache_payload)
            if not sections:
                sections = _fallback_sections_from_context(normalized_context)
            script = _derive_script(normalized_context, cache_payload, sections)

            output = {
                "engine_version": version,
                "renderer": render,
                "mode": normalized_mode,
                "title": title,
                "sections": sections,
                "script": script,
                "_meta": {},
            }

    # v0.4 guard policy:
    # - never call live LLM APIs from this adapter by default
    # - even when MARKETFLOW_MCP_ALLOW_LIVE_BRIEFING_CALLS=true, this adapter
    #   currently remains cache/placeholder only.
    base_meta = _as_dict(output.get("_meta"))
    base_meta["source"] = source
    output["_meta"] = _merge_meta(
        base_meta=base_meta,
        source_mode=normalized_source_mode,
        context=normalized_context,
        cache_file=cache_file,
    )

    output = _sanitize_payload_v03(output)
    _ensure_no_banned_language_v03(output)
    return output
