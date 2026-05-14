"""
MCP Tool v0.7: Watchlist News Context
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List

from mcp.services.ai_interpretation_adapter import (
    attention_level_label,
    ensure_no_banned_language,
    sanitize_payload,
)
from mcp.services.data_router import clamp01, normalize_symbol, safe_int
from mcp.tools.event_timeline import build_event_timeline
from mcp.tools.signal_quality import evaluate_signal_quality
from mcp.tools.watchlist_ranker import rank_watchlist


def _dedupe_symbols(values: Iterable[Any]) -> List[str]:
    seen = set()
    out: List[str] = []
    for value in values:
        symbol = normalize_symbol(value)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        out.append(symbol)
    return out


def _risk_pressure_label(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"low", "medium", "high"}:
        return text
    return "unclear"


def _related_events_from_timeline(rows: Any, limit: int = 3) -> List[str]:
    if not isinstance(rows, list):
        return []
    out: List[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        headline = str(row.get("headline") or "").strip()
        if not headline or headline in out:
            continue
        out.append(headline)
        if len(out) >= max(1, limit):
            break
    return out


def _meta_source(values: Iterable[str]) -> str:
    return "cache" if any(str(item) == "cache" for item in values) else "fallback"


def build_watchlist_news_context(
    symbols: list[str],
    lookback_days: int = 3,
    mode: str = "watchlist",
) -> dict:
    lookback_days = safe_int(lookback_days, default=3, min_value=1, max_value=10)
    normalized_symbols = _dedupe_symbols(symbols or [])

    ranked_payload = rank_watchlist(
        symbols=normalized_symbols,
        lookback_days=lookback_days,
        mode="daily_briefing",
    )
    ranked_items = ranked_payload.get("ranked_items", []) if isinstance(ranked_payload, dict) else []
    if not isinstance(ranked_items, list):
        ranked_items = []

    source_markers: List[str] = [str(ranked_payload.get("_meta", {}).get("source", "fallback")) if isinstance(ranked_payload, dict) else "fallback"]
    output_rows: List[Dict[str, Any]] = []

    for item in ranked_items:
        if not isinstance(item, dict):
            continue
        symbol = normalize_symbol(item.get("symbol"))
        if not symbol:
            continue

        timeline_payload = build_event_timeline(symbol=symbol, lookback_days=lookback_days, mode="beginner")
        source_markers.append(
            str(timeline_payload.get("_meta", {}).get("source", "fallback")) if isinstance(timeline_payload, dict) else "fallback"
        )
        timeline_rows = timeline_payload.get("timeline", []) if isinstance(timeline_payload, dict) else []
        summary = timeline_payload.get("summary", {}) if isinstance(timeline_payload, dict) else {}
        top_row = timeline_rows[0] if isinstance(timeline_rows, list) and timeline_rows and isinstance(timeline_rows[0], dict) else {}

        attention_score = safe_int(item.get("attention_score"), default=50, min_value=0, max_value=100)
        default_event_strength = max(0.30, min(1.0, float(attention_score) / 100.0))
        event_strength = clamp01(top_row.get("event_strength"), default=default_event_strength)
        signal_payload = evaluate_signal_quality(
            symbol=symbol,
            event={"event_strength": event_strength},
            price_context=True,
            sector_context=True,
            risk_context=True,
        )
        source_markers.append(str(signal_payload.get("_meta", {}).get("source", "fallback")) if isinstance(signal_payload, dict) else "fallback")

        main_event = str(
            item.get("main_reason")
            or summary.get("top_driver")
            or f"{symbol} is running with fallback event context."
        )
        signal_state = str(signal_payload.get("quality_state") or "unclear")
        risk_pressure = _risk_pressure_label(item.get("risk_pressure"))
        related_events = _related_events_from_timeline(timeline_rows, limit=3)
        output_rows.append(
            {
                "symbol": symbol,
                "attention_score": attention_score,
                "main_event": main_event,
                "related_events": related_events,
                "risk_pressure": risk_pressure,
                "signal_quality": signal_state,
                "watchlist_line": (
                    f"{symbol}: Attention Level {attention_level_label(attention_score / 100.0)}; "
                    f"Signal quality is {signal_state.replace('_', ' ')}; "
                    f"Risk Pressure {risk_pressure}."
                ),
            }
        )

    output_rows.sort(key=lambda row: (-safe_int(row.get("attention_score"), default=0), str(row.get("symbol") or "")))
    payload = {
        "mode": "watchlist" if not str(mode or "").strip() else str(mode).strip(),
        "ranked_watchlist_news": output_rows,
        "_meta": {
            "source": _meta_source(source_markers),
            "live_api_call_attempted": False,
            "symbols": normalized_symbols,
            "lookback_days": lookback_days,
            "watchlist_ranker": ranked_payload.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []})
            if isinstance(ranked_payload, dict)
            else {"source": "fallback", "loaded_files": [], "missing_files": []},
        },
    }
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload

