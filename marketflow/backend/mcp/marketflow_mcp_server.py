"""
MarketFlow MCP Layer v0.1 server wiring.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request

from mcp.services.data_router import safe_int
from mcp.tools.daily_briefing_context import build_daily_briefing_context
from mcp.tools.event_timeline import build_event_timeline
from mcp.tools.signal_quality import evaluate_signal_quality
from mcp.tools.terminal_event_feed_context import build_terminal_event_feed_context
from mcp.tools.watchlist_news_context import build_watchlist_news_context
from mcp.tools.watchlist_ranker import rank_watchlist


marketflow_mcp_bp = Blueprint("marketflow_mcp", __name__)


def call_event_timeline(symbol: str, lookback_days: int = 7, mode: str = "beginner") -> Dict[str, Any]:
    return build_event_timeline(symbol=symbol, lookback_days=lookback_days, mode=mode)


def call_watchlist_ranker(symbols: List[str], lookback_days: int = 3, mode: str = "daily_briefing") -> Dict[str, Any]:
    return rank_watchlist(symbols=symbols, lookback_days=lookback_days, mode=mode)


def call_signal_quality(
    symbol: str,
    event: Dict[str, Any],
    price_context: bool = True,
    sector_context: bool = True,
    risk_context: bool = True,
) -> Dict[str, Any]:
    return evaluate_signal_quality(
        symbol=symbol,
        event=event,
        price_context=price_context,
        sector_context=sector_context,
        risk_context=risk_context,
    )


def call_daily_briefing_context(date: str, universe: List[str], mode: str = "midform") -> Dict[str, Any]:
    return build_daily_briefing_context(date=date, universe=universe, mode=mode)


def call_terminal_event_feed_context(
    date: str | None = None,
    universe: List[str] | None = None,
    lookback_days: int = 3,
    mode: str = "terminal",
) -> Dict[str, Any]:
    return build_terminal_event_feed_context(date=date, universe=universe, lookback_days=lookback_days, mode=mode)


def call_watchlist_news_context(
    symbols: List[str],
    lookback_days: int = 3,
    mode: str = "watchlist",
) -> Dict[str, Any]:
    return build_watchlist_news_context(symbols=symbols, lookback_days=lookback_days, mode=mode)


def _parse_bool(value: Any, default: bool = True) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return default
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_symbol_list(query_value: str) -> List[str]:
    if not query_value:
        return []
    rows = [item.strip().upper() for item in query_value.split(",")]
    return [item for item in rows if item]


def _coerce_symbol_list(value: Any) -> List[str]:
    if isinstance(value, list):
        rows = [str(item or "").strip().upper() for item in value]
        return [item for item in rows if item]
    if isinstance(value, str):
        return _parse_symbol_list(value)
    return []


def _request_payload() -> Dict[str, Any]:
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


@marketflow_mcp_bp.route("/api/mcp/event-timeline", methods=["GET", "POST"])
def api_event_timeline() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    symbol = str(payload.get("symbol") if request.method == "POST" else request.args.get("symbol", "")).strip().upper()
    if not symbol:
        return jsonify({"error": "symbol is required"}), 400
    lookback_days = safe_int(
        payload.get("lookback_days") if request.method == "POST" else request.args.get("lookback_days"),
        default=7,
        min_value=1,
        max_value=30,
    )
    mode = str(
        (payload.get("mode") if request.method == "POST" else request.args.get("mode", "beginner")) or "beginner"
    )
    return jsonify(call_event_timeline(symbol=symbol, lookback_days=lookback_days, mode=mode))


@marketflow_mcp_bp.route("/api/mcp/watchlist-ranker", methods=["GET", "POST"])
def api_watchlist_ranker() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    if request.method == "POST":
        symbols = _coerce_symbol_list(payload.get("symbols"))
        if not symbols:
            symbols = _coerce_symbol_list(payload.get("universe"))
    else:
        symbols = _parse_symbol_list(str(request.args.get("symbols", "")))
    lookback_days = safe_int(
        payload.get("lookback_days") if request.method == "POST" else request.args.get("lookback_days"),
        default=3,
        min_value=1,
        max_value=10,
    )
    mode = str(
        (payload.get("mode") if request.method == "POST" else request.args.get("mode", "daily_briefing"))
        or "daily_briefing"
    )
    return jsonify(call_watchlist_ranker(symbols=symbols, lookback_days=lookback_days, mode=mode))


@marketflow_mcp_bp.route("/api/mcp/signal-quality", methods=["GET", "POST"])
def api_signal_quality() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    symbol = str(payload.get("symbol") if request.method == "POST" else request.args.get("symbol", "")).strip().upper()
    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    event: Dict[str, Any] = {}
    if request.method == "POST":
        raw_event = payload.get("event")
        if isinstance(raw_event, dict):
            event = raw_event
        elif isinstance(raw_event, str) and raw_event.strip():
            try:
                parsed = json.loads(raw_event)
                if isinstance(parsed, dict):
                    event = parsed
                else:
                    return jsonify({"error": "event must be a JSON object"}), 400
            except Exception:
                return jsonify({"error": "event string must parse to a JSON object"}), 400
        elif raw_event is not None:
            return jsonify({"error": "event must be a JSON object"}), 400
    else:
        event_param = str(request.args.get("event", "")).strip()
        if event_param:
            try:
                parsed = json.loads(event_param)
                if isinstance(parsed, dict):
                    event = parsed
            except Exception:
                return jsonify({"error": "event must be a JSON object string"}), 400

    return jsonify(
        call_signal_quality(
            symbol=symbol,
            event=event,
            price_context=_parse_bool(
                payload.get("price_context") if request.method == "POST" else request.args.get("price_context"),
                default=True,
            ),
            sector_context=_parse_bool(
                payload.get("sector_context") if request.method == "POST" else request.args.get("sector_context"),
                default=True,
            ),
            risk_context=_parse_bool(
                payload.get("risk_context") if request.method == "POST" else request.args.get("risk_context"),
                default=True,
            ),
        )
    )


@marketflow_mcp_bp.route("/api/mcp/daily-briefing-context", methods=["GET", "POST"])
def api_daily_briefing_context() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    if request.method == "POST":
        date = str(payload.get("date", "")).strip()
        universe = _coerce_symbol_list(payload.get("universe"))
        if not universe:
            universe = _coerce_symbol_list(payload.get("symbols"))
        mode = str(payload.get("mode", "midform") or "midform")
    else:
        date = str(request.args.get("date", "")).strip()
        universe = _parse_symbol_list(str(request.args.get("universe", "")))
        mode = str(request.args.get("mode", "midform") or "midform")
    return jsonify(call_daily_briefing_context(date=date, universe=universe, mode=mode))


@marketflow_mcp_bp.route("/api/mcp/terminal-event-feed-context", methods=["GET", "POST"])
def api_terminal_event_feed_context() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    if request.method == "POST":
        date = str(payload.get("date", "")).strip() or None
        universe = _coerce_symbol_list(payload.get("universe"))
        if not universe:
            universe = _coerce_symbol_list(payload.get("symbols"))
        mode = str(payload.get("mode", "terminal") or "terminal")
        lookback_days = safe_int(payload.get("lookback_days"), default=3, min_value=1, max_value=10)
    else:
        date = str(request.args.get("date", "")).strip() or None
        universe = _parse_symbol_list(str(request.args.get("universe", "")))
        if not universe:
            universe = _parse_symbol_list(str(request.args.get("symbols", "")))
        mode = str(request.args.get("mode", "terminal") or "terminal")
        lookback_days = safe_int(request.args.get("lookback_days"), default=3, min_value=1, max_value=10)
    return jsonify(
        call_terminal_event_feed_context(
            date=date,
            universe=universe,
            lookback_days=lookback_days,
            mode=mode,
        )
    )


@marketflow_mcp_bp.route("/api/mcp/watchlist-news-context", methods=["GET", "POST"])
def api_watchlist_news_context() -> Any:
    payload = _request_payload() if request.method == "POST" else {}
    if request.method == "POST":
        symbols = _coerce_symbol_list(payload.get("symbols"))
        if not symbols:
            symbols = _coerce_symbol_list(payload.get("universe"))
        mode = str(payload.get("mode", "watchlist") or "watchlist")
        lookback_days = safe_int(payload.get("lookback_days"), default=3, min_value=1, max_value=10)
    else:
        symbols = _parse_symbol_list(str(request.args.get("symbols", "")))
        if not symbols:
            symbols = _parse_symbol_list(str(request.args.get("universe", "")))
        mode = str(request.args.get("mode", "watchlist") or "watchlist")
        lookback_days = safe_int(request.args.get("lookback_days"), default=3, min_value=1, max_value=10)
    return jsonify(
        call_watchlist_news_context(
            symbols=symbols,
            lookback_days=lookback_days,
            mode=mode,
        )
    )
