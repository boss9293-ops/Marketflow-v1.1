"""
News/event adapter for MCP tools (v0.2 cache-aware).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from mcp.services.data_router import clamp01, load_artifact, normalize_symbol, parse_date, safe_float


TICKER_HISTORY_CANDIDATES = (
    "cache/ticker-news-history-v6-watchlist-direct.json",
    "cache/ticker-news-history-v4-watchlist-direct.json",
    "cache/ticker-news-history-v3-direct.json",
    "cache/ticker-news-history-v2-1630.json",
)
CONTEXT_NEWS_CANDIDATES = (
    "cache/context_news.json",
    "cache/market-headlines-history.json",
)


def _parse_datetime(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except Exception:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _event_type_from_text(headline: str, summary: str) -> str:
    text = f"{headline} {summary}".lower()
    if "earnings" in text or "guidance" in text or "eps" in text:
        return "earnings"
    if "fed" in text or "ppi" in text or "cpi" in text or "rate" in text:
        return "macro"
    if "lawsuit" in text or "regulation" in text or "investigation" in text:
        return "regulatory"
    if "acquire" in text or "deal" in text or "partnership" in text:
        return "corporate_action"
    return "news"


def _tone_from_text(headline: str, summary: str) -> str:
    text = f"{headline} {summary}".lower()
    positive_markers = ("beat", "growth", "surge", "record", "strong", "upgrade")
    negative_markers = ("miss", "cut", "lawsuit", "downgrade", "drop", "risk")
    pos = sum(1 for marker in positive_markers if marker in text)
    neg = sum(1 for marker in negative_markers if marker in text)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def _event_strength(relevance: float, event_time: datetime, anchor_time: datetime) -> float:
    age_days = max(0.0, (anchor_time - event_time).total_seconds() / 86400.0)
    recency = max(0.0, 1.0 - min(age_days / 7.0, 1.0))
    return round(clamp01(0.65 * relevance + 0.35 * recency, default=0.35), 3)


def _merge_meta(meta_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    loaded_files: List[str] = []
    missing_files: List[str] = []
    source = "fallback"
    for row in meta_rows:
        for file_name in row.get("loaded_files") or []:
            if file_name not in loaded_files:
                loaded_files.append(file_name)
        for file_name in row.get("missing_files") or []:
            if file_name not in missing_files:
                missing_files.append(file_name)
        if row.get("source") == "cache":
            source = "cache"
    return {
        "source": source,
        "loaded_files": loaded_files,
        "missing_files": missing_files,
    }


def _extract_symbol_events_from_ticker_history(payload: Any, symbol: str) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    symbols = payload.get("symbols")
    if not isinstance(symbols, dict):
        return []
    symbol_data = symbols.get(symbol) if isinstance(symbols.get(symbol), dict) else {}
    timeline = symbol_data.get("timeline") if isinstance(symbol_data, dict) else []
    details = symbol_data.get("details") if isinstance(symbol_data, dict) else []

    detail_map: Dict[str, Dict[str, Any]] = {}
    if isinstance(details, list):
        for item in details:
            if isinstance(item, dict):
                detail_map[str(item.get("id") or "")] = item

    events: List[Dict[str, Any]] = []
    if not isinstance(timeline, list):
        return events

    anchor = datetime.now(timezone.utc)
    for idx, row in enumerate(timeline):
        if not isinstance(row, dict):
            continue
        row_id = str(row.get("id") or f"{symbol}-{idx}")
        detail = detail_map.get(row_id, {})
        event_dt = _parse_datetime(row.get("publishedAtET") or detail.get("publishedAtET"))
        headline = str(row.get("headline") or detail.get("headline") or "No headline")
        summary = str(row.get("summary") or detail.get("summary") or "")
        relevance = clamp01(detail.get("relevanceScore"), default=0.55)
        events.append(
            {
                "id": row_id,
                "symbol": symbol,
                "date": (parse_date(row.get("dateET")) or event_dt.date()).isoformat(),
                "headline": headline,
                "source": row.get("source") or detail.get("source") or "ticker_cache",
                "event_type": _event_type_from_text(headline, summary),
                "relevance_score": round(relevance, 3),
                "published_at": event_dt.isoformat(),
                "summary": summary,
                "tone": _tone_from_text(headline, summary),
                "event_strength": _event_strength(relevance, event_dt, anchor),
            }
        )
    return events


def _extract_context_events(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    out: List[Dict[str, Any]] = []
    articles = payload.get("articles")
    if isinstance(articles, list):
        for idx, row in enumerate(articles):
            if not isinstance(row, dict):
                continue
            published = _parse_datetime(row.get("published_at"))
            headline = str(row.get("title") or row.get("headline") or "Market context event")
            summary = str(row.get("summary") or "")
            score_raw = safe_float(row.get("score"), default=10.0) or 10.0
            relevance = clamp01(score_raw / 20.0, default=0.5)
            out.append(
                {
                    "id": str(row.get("id") or f"context-{idx}"),
                    "symbol": "MARKET",
                    "date": published.date().isoformat(),
                    "headline": headline,
                    "source": row.get("source") or "context_news",
                    "event_type": "news",
                    "relevance_score": round(relevance, 3),
                    "published_at": published.isoformat(),
                    "summary": summary,
                    "tone": _tone_from_text(headline, summary),
                    "event_strength": _event_strength(relevance, published, datetime.now(timezone.utc)),
                }
            )
    elif isinstance(payload.get("headlines"), list):
        for idx, row in enumerate(payload.get("headlines")):
            if not isinstance(row, dict):
                continue
            headline = str(row.get("title") or row.get("headline") or "Market context event")
            out.append(
                {
                    "id": str(row.get("id") or f"headline-{idx}"),
                    "symbol": "MARKET",
                    "date": str(row.get("date") or datetime.now(timezone.utc).date().isoformat())[:10],
                    "headline": headline,
                    "source": row.get("source") or "headline_cache",
                    "event_type": "news",
                    "relevance_score": 0.45,
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "summary": str(row.get("summary") or ""),
                    "tone": "neutral",
                    "event_strength": 0.45,
                }
            )
    return out


def get_cached_events(symbol: str = "", lookback_days: int = 7) -> Dict[str, Any]:
    symbol = normalize_symbol(symbol)
    lookback_days = max(1, int(lookback_days))
    anchor = datetime.now(timezone.utc)
    cutoff = anchor.date() - timedelta(days=lookback_days)

    meta_rows: List[Dict[str, Any]] = []
    symbol_events: List[Dict[str, Any]] = []

    for candidate in TICKER_HISTORY_CANDIDATES:
        payload, meta = load_artifact(candidate, default=None)
        meta_rows.append(meta)
        if payload is None or not symbol:
            continue
        extracted = _extract_symbol_events_from_ticker_history(payload, symbol)
        if extracted:
            symbol_events = extracted
            break

    filtered_symbol_events: List[Dict[str, Any]] = []
    for row in symbol_events:
        event_date = parse_date(row.get("date"))
        if event_date is None or event_date < cutoff:
            continue
        filtered_symbol_events.append(row)

    if filtered_symbol_events:
        filtered_symbol_events.sort(key=lambda item: _parse_datetime(item.get("published_at")), reverse=True)
        return {"events": filtered_symbol_events, "_meta": _merge_meta(meta_rows)}

    context_events: List[Dict[str, Any]] = []
    for candidate in CONTEXT_NEWS_CANDIDATES:
        payload, meta = load_artifact(candidate, default=None)
        meta_rows.append(meta)
        if payload is None:
            continue
        extracted = _extract_context_events(payload)
        if extracted:
            context_events = extracted
            break

    filtered_context_events: List[Dict[str, Any]] = []
    for row in context_events:
        event_date = parse_date(row.get("date"))
        if event_date is None or event_date < cutoff:
            continue
        # keep requested symbol tagging for timeline compatibility if symbol is provided.
        if symbol:
            row = dict(row)
            row["symbol"] = symbol
        filtered_context_events.append(row)

    filtered_context_events.sort(key=lambda item: _parse_datetime(item.get("published_at")), reverse=True)
    return {"events": filtered_context_events, "_meta": _merge_meta(meta_rows)}


def get_symbol_events(symbol: str, lookback_days: int = 7) -> List[Dict[str, Any]]:
    payload = get_cached_events(symbol=symbol, lookback_days=lookback_days)
    events = payload.get("events") if isinstance(payload, dict) else []
    if not isinstance(events, list):
        events = []
    if events:
        return events

    # Deterministic fallback placeholder
    anchor = datetime.now(timezone.utc)
    normalized = normalize_symbol(symbol)
    return [
        {
            "id": f"{normalized}-placeholder",
            "symbol": normalized,
            "date": anchor.date().isoformat(),
            "event_date": anchor.date().isoformat(),
            "headline": f"No recent symbol-specific events were confirmed for {normalized}.",
            "source": "fallback",
            "event_type": "news",
            "relevance_score": 0.28,
            "published_at": anchor.isoformat(),
            "summary": "Fallback placeholder while cache events are unavailable.",
            "tone": "neutral",
            "event_strength": 0.28,
        }
    ]


def get_top_market_story() -> str:
    payload = get_cached_events(symbol="", lookback_days=3)
    events = payload.get("events") if isinstance(payload, dict) else []
    if isinstance(events, list):
        for row in events:
            if isinstance(row, dict) and row.get("headline"):
                return str(row.get("headline"))
    return "Market context cache is not available; using fallback story line."


def get_context_top_events(limit: int = 5) -> List[Dict[str, Any]]:
    payload = get_cached_events(symbol="", lookback_days=5)
    rows = payload.get("events") if isinstance(payload, dict) else []
    out: List[Dict[str, Any]] = []
    if isinstance(rows, list):
        for row in rows[: max(1, limit)]:
            if not isinstance(row, dict):
                continue
            out.append(
                {
                    "symbol": row.get("symbol", "MARKET"),
                    "event_date": row.get("date") or row.get("event_date"),
                    "headline": row.get("headline"),
                    "source": row.get("source"),
                    "event_strength": round(clamp01(row.get("event_strength"), default=0.45), 3),
                }
            )
    return out
