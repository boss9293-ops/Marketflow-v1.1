"""
MCP Tool 1: Event Timeline
"""
from __future__ import annotations

from typing import Any, Dict, List

from mcp.schemas.timeline_schema import EventTimelineOutput, TimelineEvent, TimelineSummary
from mcp.services.ai_interpretation_adapter import (
    attention_level_label,
    ensure_no_banned_language,
    sanitize_payload,
)
from mcp.services.data_router import normalize_symbol, safe_int
from mcp.services.market_snapshot_adapter import get_risk_context, get_symbol_price_context
from mcp.services.news_adapter import get_cached_events


def _price_confirmation_line(price_context: Dict[str, Any]) -> str:
    direction = price_context.get("direction")
    score = float(price_context.get("confirmation_score") or 0.5)
    reference = price_context.get("reference_level") or "unavailable"
    if direction == "up" and score >= 0.70:
        return f"Confirmation is firm with upward price context near reference level {reference}."
    if direction == "down" and score <= 0.40:
        return f"Conflict pressure is visible with downward price context near reference level {reference}."
    return f"Confirmation is mixed and requires monitoring around reference level {reference}."


def _risk_agreement_line(risk_context: Dict[str, Any], top_event: Dict[str, Any]) -> str:
    risk_pressure = str(risk_context.get("risk_pressure") or "medium")
    tone = str(top_event.get("tone") or "neutral")
    if risk_pressure == "high" and tone == "positive":
        return "Risk pressure is high while event tone is constructive, so conflict monitoring is required."
    if risk_pressure == "high":
        return "Risk pressure and event tone are aligned on caution."
    if risk_pressure == "low" and tone == "positive":
        return "Risk pressure and event tone are aligned on confirmation."
    return "Risk pressure and event tone are partially aligned; keep a watch zone active."


def build_event_timeline(symbol: str, lookback_days: int = 7, mode: str = "beginner") -> dict:
    symbol = normalize_symbol(symbol)
    lookback_days = safe_int(lookback_days, default=7, min_value=1, max_value=30)
    events_payload = get_cached_events(symbol=symbol, lookback_days=lookback_days)
    events = events_payload.get("events") if isinstance(events_payload, dict) else []
    if not isinstance(events, list):
        events = []
    price_context = get_symbol_price_context(symbol)
    risk_context = get_risk_context()

    timeline_rows: List[TimelineEvent] = []
    source_events = events[:12]
    if not source_events:
        source_events = [
            {
                "date": "",
                "event_type": "news",
                "headline": f"No cached events were available for {symbol}; fallback timeline is shown.",
                "source": "fallback",
                "event_strength": 0.30,
                "tone": "neutral",
            }
        ]
    for event in source_events:
        strength = float(event.get("event_strength") or 0.30)
        tone = str(event.get("tone") or "neutral")
        direction = str(price_context.get("direction") or "unknown")
        conflict = "Low"
        if tone == "positive" and direction == "down":
            conflict = "High"
        elif tone == "negative" and direction == "up":
            conflict = "Medium"

        if strength >= 0.75 and conflict != "High":
            confirmation = "Strong"
        elif strength >= 0.55:
            confirmation = "Moderate"
        else:
            confirmation = "Weak"

        scenario = "Scenario remains open; follow confirmation and conflict levels."
        if conflict == "High":
            scenario = "Scenario has conflict; use tighter watch zone discipline."
        elif confirmation == "Strong":
            scenario = "Scenario has confirmation support; monitor continuation quality."

        timeline_rows.append(
            TimelineEvent(
                event_date=str(event.get("event_date") or event.get("date") or ""),
                event_type=str(event.get("event_type") or "news_flow"),
                headline=str(event.get("headline") or "Event"),
                source=str(event.get("source") or "unknown"),
                event_strength=round(strength, 3),
                attention_level=attention_level_label(strength),
                confirmation=confirmation,
                conflict=conflict,
                watch_zone="Monitor event follow-through and intraday volatility.",
                reference_level=str(price_context.get("reference_level") or "unavailable"),
                scenario=scenario,
            )
        )

    top_event = events[0] if events else {}
    top_driver = str(top_event.get("headline") or f"No specific cached driver found for {symbol}.")
    summary = TimelineSummary(
        top_driver=top_driver,
        price_confirmation=_price_confirmation_line(price_context),
        risk_engine_agreement=_risk_agreement_line(risk_context, top_event),
        beginner_explanation=(
            "This timeline prioritizes why attention changed, where confirmation exists, and where conflict is rising."
            if str(mode).lower() == "beginner"
            else "Timeline context highlights attention shifts, confirmation state, and conflict pressure."
        ),
    )

    payload = EventTimelineOutput(
        symbol=symbol,
        lookback_days=lookback_days,
        timeline=timeline_rows,
        summary=summary,
    ).to_dict()
    payload["_meta"] = {
        "source": "cache" if bool(events) else "fallback",
        "news": (events_payload.get("_meta") if isinstance(events_payload, dict) else {"source": "fallback"}),
        "market_snapshot": price_context.get("_meta") or risk_context.get("_meta") or {"source": "fallback"},
    }

    # TODO: Replace mock-strength heuristics with event weighting from live NLP enrichment adapters.
    # TODO: Add intraday event sequencing once live timestamp-normalized adapters are available.
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
