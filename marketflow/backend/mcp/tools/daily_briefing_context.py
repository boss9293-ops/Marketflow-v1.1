"""
MCP Tool 4: Daily Briefing Context
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload
from mcp.services.data_router import normalize_symbol, parse_date
from mcp.services.market_snapshot_adapter import (
    get_market_snapshot_context,
    get_risk_context,
    get_sector_confirmation,
)
from mcp.services.news_adapter import get_context_top_events, get_top_market_story
from mcp.tools.event_timeline import build_event_timeline
from mcp.tools.watchlist_ranker import rank_watchlist


def _normalize_date(value: Any) -> str:
    parsed = parse_date(value)
    if parsed is not None:
        return parsed.isoformat()
    return datetime.now(timezone.utc).date().isoformat()


def _dedupe_symbols(values: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for value in values:
        symbol = normalize_symbol(value)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        out.append(symbol)
    return out


def build_daily_briefing_context(date: str, universe: list[str], mode: str = "midform") -> dict:
    del mode  # reserved for future rendering policy selection
    normalized_date = _normalize_date(date)
    symbols = _dedupe_symbols(universe or [])

    market_snapshot = get_market_snapshot_context()
    top_market_story = get_top_market_story()

    top_events: List[Dict[str, Any]] = []
    timeline_summaries: Dict[str, Dict[str, Any]] = {}
    for symbol in symbols[:10]:
        timeline_payload = build_event_timeline(symbol=symbol, lookback_days=3, mode="beginner")
        timeline_summaries[symbol] = timeline_payload.get("summary", {}) if isinstance(timeline_payload, dict) else {}
        rows = timeline_payload.get("timeline", []) if isinstance(timeline_payload, dict) else []
        if isinstance(rows, list) and rows:
            row = rows[0] if isinstance(rows[0], dict) else {}
            top_events.append(
                {
                    "symbol": symbol,
                    "event_date": row.get("event_date"),
                    "headline": row.get("headline"),
                    "source": row.get("source"),
                    "event_strength": row.get("event_strength"),
                }
            )

    context_rows = get_context_top_events(limit=max(0, 5 - len(top_events)))
    for row in context_rows:
        if len(top_events) >= 5:
            break
        top_events.append(row)

    watchlist_payload = rank_watchlist(symbols=symbols, lookback_days=3, mode="daily_briefing")
    watchlist_rank = watchlist_payload.get("ranked_items", []) if isinstance(watchlist_payload, dict) else []

    sector_context: List[Dict[str, Any]] = []
    for item in watchlist_rank[:5]:
        symbol = normalize_symbol(item.get("symbol"))
        if not symbol:
            continue
        sector = get_sector_confirmation(symbol=symbol)
        sector_context.append(
            {
                "symbol": symbol,
                "proxy_symbol": sector.get("proxy_symbol"),
                "sector_confirmation_score": sector.get("score"),
                "note": sector.get("note"),
            }
        )
    if not sector_context and isinstance(market_snapshot.get("sectors"), dict):
        for sector_name, sector_row in list(market_snapshot.get("sectors", {}).items())[:5]:
            if not isinstance(sector_row, dict):
                continue
            sector_context.append(
                {
                    "symbol": sector_name,
                    "proxy_symbol": None,
                    "sector_confirmation_score": sector_row.get("avg_score"),
                    "note": sector_row.get("name") or sector_name,
                }
            )

    risk_context = get_risk_context()
    if not top_events and symbols:
        first_symbol = symbols[0]
        summary = timeline_summaries.get(first_symbol, {})
        if isinstance(summary, dict) and summary.get("top_driver"):
            top_market_story = str(summary.get("top_driver"))
    briefing_outline = [
        f"Top market story: {top_market_story}",
        f"Watchlist attention leaders: {', '.join(item.get('symbol', '') for item in watchlist_rank[:3]) or 'none'}",
        f"Risk pressure: {risk_context.get('risk_pressure', 'medium')} (phase: {risk_context.get('phase', 'UNKNOWN')})",
        "Watch Zone: confirm whether attention and risk pressure stay aligned through the next session.",
    ]

    payload = {
        "date": normalized_date,
        "top_market_story": top_market_story,
        "top_events": top_events,
        "watchlist_rank": watchlist_rank,
        "sector_context": sector_context,
        "risk_context": risk_context,
        "briefing_outline": briefing_outline,
        "_meta": {
            "source": "cache" if (
                market_snapshot.get("_meta", {}).get("source") == "cache"
                or watchlist_payload.get("_meta", {}).get("source") == "cache"
            ) else "fallback",
            "market_snapshot": market_snapshot.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
            "watchlist_ranker": watchlist_payload.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
            "timeline_symbols": symbols[:10],
        },
    }
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
