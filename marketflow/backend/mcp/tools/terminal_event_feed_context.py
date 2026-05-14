"""
MCP Tool v0.7: Terminal Event Feed Context
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

from mcp.services.ai_interpretation_adapter import (
    attention_level_label,
    ensure_no_banned_language,
    sanitize_payload,
)
from mcp.services.data_router import clamp01, normalize_symbol, parse_date, safe_int
from mcp.services.market_snapshot_adapter import (
    get_market_snapshot_context,
    get_risk_context,
    get_sector_confirmation,
    get_symbol_price_context,
)
from mcp.tools.event_timeline import build_event_timeline
from mcp.tools.signal_quality import evaluate_signal_quality


DEFAULT_TERMINAL_UNIVERSE = ["SPY", "QQQ", "SOXX", "NVDA", "TSLA", "AMD", "AVGO"]


def _normalize_date(value: Any) -> str:
    parsed = parse_date(value)
    if parsed is not None:
        return parsed.isoformat()
    return datetime.now(timezone.utc).date().isoformat()


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


def _normalize_price_confirmation(score: float, quality_state: str) -> str:
    if quality_state == "conflict":
        return "conflict"
    if score >= 0.62:
        return "confirmed"
    if score >= 0.45:
        return "weak"
    return "unclear"


def _resolve_event_type(base_event_type: str, change_pct: Any, risk_pressure: str) -> str:
    event_type = str(base_event_type or "news").strip().lower()
    change = float(change_pct) if isinstance(change_pct, (int, float)) else None
    if risk_pressure == "high" and (event_type in {"macro", "regulatory"} or (change is not None and change <= -1.0)):
        return "risk_signal"
    if event_type in {"sector", "industry", "sector_move"}:
        return "sector_move"
    if change is not None and abs(change) >= 1.6:
        return "price_move"
    return "news"


def _compact_market_section(section: Any, limit: int = 5) -> List[Dict[str, Any]]:
    if not isinstance(section, dict):
        return []
    out: List[Dict[str, Any]] = []
    for symbol, row in list(section.items())[: max(1, limit)]:
        if isinstance(row, dict):
            out.append(
                {
                    "symbol": str(symbol),
                    "name": row.get("name"),
                    "change_pct": row.get("change_pct"),
                }
            )
        else:
            out.append({"symbol": str(symbol), "name": None, "change_pct": None})
    return out


def _meta_source(values: Iterable[str]) -> str:
    return "cache" if any(str(item) == "cache" for item in values) else "fallback"


def build_terminal_event_feed_context(
    date: str | None = None,
    universe: list[str] | None = None,
    lookback_days: int = 3,
    mode: str = "terminal",
) -> dict:
    lookback_days = safe_int(lookback_days, default=3, min_value=1, max_value=10)
    target_date = _normalize_date(date)
    symbols = _dedupe_symbols(universe or DEFAULT_TERMINAL_UNIVERSE)
    if not symbols:
        symbols = list(DEFAULT_TERMINAL_UNIVERSE)

    snapshot = get_market_snapshot_context()
    risk = get_risk_context()
    source_markers: List[str] = [
        str(snapshot.get("_meta", {}).get("source", "fallback")),
        str(risk.get("_meta", {}).get("source", "fallback")),
    ]

    event_rows: List[Dict[str, Any]] = []
    for symbol in symbols[:12]:
        timeline = build_event_timeline(symbol=symbol, lookback_days=lookback_days, mode="beginner")
        timeline_rows = timeline.get("timeline", []) if isinstance(timeline, dict) else []
        summary = timeline.get("summary", {}) if isinstance(timeline, dict) else {}

        top_row = timeline_rows[0] if isinstance(timeline_rows, list) and timeline_rows and isinstance(timeline_rows[0], dict) else {}
        source_markers.append(str(timeline.get("_meta", {}).get("source", "fallback")) if isinstance(timeline, dict) else "fallback")

        price_ctx = get_symbol_price_context(symbol=symbol)
        sector_ctx = get_sector_confirmation(symbol=symbol)
        source_markers.append(str(price_ctx.get("_meta", {}).get("source", "fallback")))
        source_markers.append(str(sector_ctx.get("_meta", {}).get("source", "fallback")))

        event_strength = clamp01(top_row.get("event_strength"), default=0.35)
        signal_payload = evaluate_signal_quality(
            symbol=symbol,
            event={"event_strength": event_strength},
            price_context=True,
            sector_context=True,
            risk_context=True,
        )
        source_markers.append(str(signal_payload.get("_meta", {}).get("source", "fallback")) if isinstance(signal_payload, dict) else "fallback")
        components = signal_payload.get("components", {}) if isinstance(signal_payload, dict) else {}
        price_score = clamp01(
            components.get("price_confirmation"),
            default=clamp01(price_ctx.get("confirmation_score"), default=0.50),
        )
        quality_state = str(signal_payload.get("quality_state") or "unclear")
        price_confirmation = _normalize_price_confirmation(price_score, quality_state)

        headline = str(top_row.get("headline") or summary.get("top_driver") or f"{symbol} context is running on fallback data.")
        risk_pressure = str(risk.get("risk_pressure") or "medium")
        why_it_matters = (
            f"{summary.get('price_confirmation') or 'Confirmation is mixed and needs monitoring.'} "
            f"{summary.get('risk_engine_agreement') or 'Risk pressure and confirmation alignment are under watch.'}"
        )
        event_rows.append(
            {
                "rank": 0,
                "symbol": symbol,
                "event_type": _resolve_event_type(
                    base_event_type=str(top_row.get("event_type") or "news"),
                    change_pct=price_ctx.get("change_pct"),
                    risk_pressure=risk_pressure,
                ),
                "headline": headline,
                "event_strength": round(event_strength, 3),
                "price_confirmation": price_confirmation,
                "risk_context": f"Risk Pressure {risk_pressure}; phase {risk.get('phase', 'UNKNOWN')}.",
                "why_it_matters": why_it_matters,
                "terminal_line": (
                    f"{symbol}: Attention Level {attention_level_label(event_strength)} | "
                    f"Confirmation {price_confirmation} | Risk Pressure {risk_pressure}"
                ),
            }
        )

    event_rows.sort(key=lambda row: (-float(row.get("event_strength") or 0.0), str(row.get("symbol") or "")))
    if not event_rows:
        event_rows = [
            {
                "rank": 1,
                "symbol": "MARKET",
                "event_type": "news",
                "headline": "No cached event stream was found; fallback terminal context is active.",
                "event_strength": 0.30,
                "price_confirmation": "unclear",
                "risk_context": "Risk Pressure unclear.",
                "why_it_matters": "Event visibility is limited, so confirmation and conflict need a wider watch zone.",
                "terminal_line": "MARKET: Attention Level Low | Confirmation unclear | Risk Pressure unclear",
            }
        ]
    else:
        for idx, row in enumerate(event_rows, start=1):
            row["rank"] = idx

    market_context = {
        "indices": _compact_market_section(snapshot.get("indices"), limit=4),
        "etfs": _compact_market_section(snapshot.get("etfs"), limit=4),
        "mega_caps": _compact_market_section(snapshot.get("mega_caps"), limit=6),
        "sectors": _compact_market_section(snapshot.get("sectors"), limit=6),
    }
    risk_context = {
        "risk_label": risk.get("risk_label"),
        "phase": risk.get("phase"),
        "shock_probability": risk.get("shock_probability"),
        "risk_pressure": risk.get("risk_pressure"),
        "alignment_score": risk.get("alignment_score"),
    }

    payload = {
        "date": target_date,
        "mode": "terminal" if not str(mode or "").strip() else str(mode).strip(),
        "top_events": event_rows,
        "market_context": market_context,
        "risk_context": risk_context,
        "_meta": {
            "source": _meta_source(source_markers),
            "live_api_call_attempted": False,
            "symbols": symbols,
            "lookback_days": lookback_days,
            "market_snapshot": snapshot.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
            "risk": risk.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
        },
    }
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload

