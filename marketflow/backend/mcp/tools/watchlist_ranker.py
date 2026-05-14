"""
MCP Tool 2: Watchlist Ranker
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List

from mcp.schemas.watchlist_schema import RankedWatchlistItem, WatchlistRankOutput
from mcp.services.ai_interpretation_adapter import (
    attention_level_label,
    ensure_no_banned_language,
    sanitize_payload,
)
from mcp.services.data_router import clamp01, normalize_symbol, safe_int
from mcp.services.market_snapshot_adapter import (
    get_market_snapshot_context,
    get_risk_context,
    get_sector_confirmation,
    get_symbol_price_context,
)
from mcp.services.news_adapter import get_cached_events


WEIGHTS = {
    "event_strength": 0.30,
    "price_confirmation": 0.25,
    "sector_confirmation": 0.20,
    "risk_alignment": 0.15,
    "data_confidence": 0.10,
}


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


def _risk_alignment_score(risk_pressure: str, event_tone: str) -> float:
    if risk_pressure == "high":
        return 0.72 if event_tone in {"negative", "neutral"} else 0.34
    if risk_pressure == "low":
        return 0.78 if event_tone in {"positive", "neutral"} else 0.42
    return 0.62 if event_tone != "positive" else 0.55


def _data_confidence(has_events: bool, has_price: bool, has_sector_proxy: bool) -> float:
    score = 0.25
    if has_events:
        score += 0.35
    if has_price:
        score += 0.25
    if has_sector_proxy:
        score += 0.15
    return clamp01(score, default=0.40)


def rank_watchlist(symbols: list[str], lookback_days: int = 3, mode: str = "daily_briefing") -> dict:
    del mode  # reserved for future routing behavior
    lookback_days = safe_int(lookback_days, default=3, min_value=1, max_value=10)
    normalized_symbols = _dedupe_symbols(symbols or [])
    snapshot = get_market_snapshot_context()
    snapshot_meta = snapshot.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []})
    if not normalized_symbols:
        payload = WatchlistRankOutput(ranked_items=[]).to_dict()
        payload["_meta"] = {
            "source": snapshot_meta.get("source", "fallback"),
            "market_snapshot": snapshot_meta,
            "news": {"source": "fallback", "loaded_files": [], "missing_files": []},
        }
        payload = sanitize_payload(payload)
        ensure_no_banned_language(payload)
        return payload

    risk_context = get_risk_context()
    risk_pressure = str(risk_context.get("risk_pressure") or "medium")
    ranked_items: List[RankedWatchlistItem] = []
    news_meta_rows: List[Dict[str, Any]] = []

    for symbol in normalized_symbols:
        events_payload = get_cached_events(symbol=symbol, lookback_days=lookback_days)
        news_meta_rows.append(events_payload.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}))
        events = events_payload.get("events", [])
        if not isinstance(events, list):
            events = []
        top_event = events[0] if events else {}
        event_strength = clamp01(top_event.get("event_strength"), default=0.35)
        event_tone = str(top_event.get("tone") or "neutral")

        price_context = get_symbol_price_context(symbol=symbol)
        price_score = clamp01(price_context.get("confirmation_score"), default=0.50)

        sector_context = get_sector_confirmation(symbol=symbol)
        sector_score = clamp01(sector_context.get("score"), default=0.50)

        risk_alignment = _risk_alignment_score(risk_pressure=risk_pressure, event_tone=event_tone)
        confidence = _data_confidence(
            has_events=bool(events),
            has_price=price_context.get("price") is not None,
            has_sector_proxy=bool(sector_context.get("proxy_symbol")),
        )

        attention_score = round(
            100.0
            * (
                WEIGHTS["event_strength"] * event_strength
                + WEIGHTS["price_confirmation"] * price_score
                + WEIGHTS["sector_confirmation"] * sector_score
                + WEIGHTS["risk_alignment"] * risk_alignment
                + WEIGHTS["data_confidence"] * confidence
            )
        )
        attention_score = int(max(0, min(100, attention_score)))

        change_pct = price_context.get("change_pct")
        engine_conflict = bool(event_tone == "positive" and isinstance(change_pct, (int, float)) and change_pct < 0)
        if risk_pressure == "high" and event_tone == "positive":
            engine_conflict = True

        main_reason = str(top_event.get("headline") or f"{symbol} has limited event visibility in cached feeds.")
        briefing_line = (
            f"{symbol}: Attention Level {attention_level_label(attention_score / 100.0)}; "
            f"Risk Pressure {risk_pressure}; Confirmation context is being monitored."
        )

        ranked_items.append(
            RankedWatchlistItem(
                symbol=symbol,
                attention_score=attention_score,
                main_reason=main_reason,
                risk_pressure=risk_pressure,
                engine_conflict=engine_conflict,
                briefing_line=briefing_line,
            )
        )

    ranked_items.sort(key=lambda item: (-item.attention_score, item.symbol))
    payload = WatchlistRankOutput(ranked_items=ranked_items).to_dict()
    news_loaded: List[str] = []
    news_missing: List[str] = []
    news_source = "fallback"
    for row in news_meta_rows:
        if row.get("source") == "cache":
            news_source = "cache"
        for item in row.get("loaded_files") or []:
            if item not in news_loaded:
                news_loaded.append(item)
        for item in row.get("missing_files") or []:
            if item not in news_missing:
                news_missing.append(item)
    payload["_meta"] = {
        "source": "cache" if (snapshot_meta.get("source") == "cache" or news_source == "cache") else "fallback",
        "market_snapshot": snapshot_meta,
        "news": {
            "source": news_source,
            "loaded_files": news_loaded,
            "missing_files": news_missing,
        },
    }
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
