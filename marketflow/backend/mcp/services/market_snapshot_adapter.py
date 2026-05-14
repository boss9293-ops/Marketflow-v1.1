"""
Market snapshot adapter for MCP tools (v0.2 cache-aware).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from mcp.services.data_router import clamp01, load_artifact, normalize_symbol, safe_float


INDEX_SYMBOLS = {"SPX", "NDX", "IXIC", "RUT", "SPY", "QQQ", "DIA", "IWM"}
ETF_SYMBOLS = {"SPY", "QQQ", "TQQQ", "SOXL", "SMH"}
MEGA_CAP_SYMBOLS = {"NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "TSLA"}

SECTOR_PROXY_MAP = {
    "NVDA": "SOXL",
    "AMD": "SOXL",
    "TSM": "SOXL",
    "AVGO": "SOXL",
    "AAPL": "QQQ",
    "MSFT": "QQQ",
    "AMZN": "QQQ",
    "META": "QQQ",
    "TSLA": "QQQ",
}

SNAPSHOT_CANDIDATES = (
    "cache/market_snapshot.json",
    "cache/core_price_snapshot_latest.json",
    "cache/market_state.json",
    "cache/risk_engine.json",
    "cache/overview_home.json",
    "cache/smart_money.json",
    "pipeline_status.json",
    "pipeline_history.json",
    "risk_v1.json",
    "risk_v1_playback.json",
    "risk_v1_sim.json",
)


def _score_from_change(change_pct: Optional[float]) -> float:
    if change_pct is None:
        return 0.50
    if change_pct >= 2.0:
        return 0.88
    if change_pct >= 0.8:
        return 0.74
    if change_pct >= -0.4:
        return 0.56
    if change_pct >= -1.2:
        return 0.38
    return 0.24


def _blank_snapshot() -> Dict[str, Any]:
    return {
        "indices": {},
        "etfs": {},
        "mega_caps": {},
        "sectors": {},
        "risk": {},
        "_meta": {
            "source": "fallback",
            "loaded_files": [],
            "missing_files": [],
        },
    }


def _merge_meta(state: Dict[str, Any], meta: Dict[str, Any]) -> None:
    loaded = state["_meta"]["loaded_files"]
    missing = state["_meta"]["missing_files"]
    for file_name in meta.get("loaded_files") or []:
        if file_name not in loaded:
            loaded.append(file_name)
    for file_name in meta.get("missing_files") or []:
        if file_name not in missing:
            missing.append(file_name)
    state["_meta"]["source"] = "cache" if loaded else "fallback"


def _compact_record(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": row.get("name"),
        "price": safe_float(row.get("price"), default=None),
        "change_pct": safe_float(row.get("change_pct"), default=None),
        "source": row.get("source"),
        "as_of": row.get("as_of"),
    }


def _ingest_core_snapshot(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    records = payload.get("records")
    if not isinstance(records, list):
        return
    for row in records:
        if not isinstance(row, dict):
            continue
        symbol = normalize_symbol(row.get("symbol"))
        if not symbol:
            continue
        asset_class = str(row.get("asset_class") or "").strip().lower()
        compact = _compact_record(row)

        if asset_class == "index" or symbol in INDEX_SYMBOLS:
            state["indices"][symbol] = compact
        if asset_class == "etf" or symbol in ETF_SYMBOLS:
            state["etfs"][symbol] = compact
        if asset_class == "stock" and symbol in MEGA_CAP_SYMBOLS:
            state["mega_caps"][symbol] = compact

        if asset_class == "sector":
            state["sectors"][symbol] = compact


def _ingest_market_snapshot(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    for key in ("indices", "etfs", "mega_caps", "sectors"):
        section = payload.get(key)
        if isinstance(section, dict):
            for symbol, row in section.items():
                sym = normalize_symbol(symbol)
                if not sym:
                    continue
                if isinstance(row, dict):
                    state[key][sym] = _compact_record(row)
    risk = payload.get("risk")
    if isinstance(risk, dict):
        state["risk"].update(risk)


def _ingest_market_state(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    risk = payload.get("risk")
    phase = payload.get("phase")
    gate = payload.get("gate")
    if isinstance(risk, dict):
        state["risk"]["risk_label"] = str(risk.get("value") or "MEDIUM").upper()
        state["risk"]["risk_detail"] = risk.get("detail")
    if isinstance(phase, dict):
        state["risk"]["phase"] = str(phase.get("value") or "UNKNOWN").upper()
    if isinstance(gate, dict):
        state["risk"]["gate_value"] = safe_float(gate.get("value"), default=None)


def _ingest_risk_engine(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    shock = payload.get("shock_probability")
    if isinstance(shock, dict):
        state["risk"]["shock_probability"] = safe_float(shock.get("value"), default=None)
        state["risk"]["shock_label"] = shock.get("label")
    defensive = payload.get("defensive_trigger")
    if isinstance(defensive, dict):
        state["risk"]["defensive_status"] = defensive.get("status")


def _ingest_risk_v1(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    current = payload.get("current")
    if not isinstance(current, dict):
        return
    state["risk"]["mss_score"] = safe_float(current.get("score"), default=None)
    state["risk"]["mss_zone"] = current.get("score_zone")
    state["risk"]["risk_level"] = current.get("level_label")


def _ingest_smart_money_sectors(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    top = payload.get("top")
    if not isinstance(top, list):
        return
    sector_scores: Dict[str, List[float]] = {}
    for row in top:
        if not isinstance(row, dict):
            continue
        sector = str(row.get("sector") or "").strip()
        if not sector:
            continue
        score = safe_float(row.get("score"), default=None)
        if score is None:
            continue
        sector_scores.setdefault(sector, []).append(float(score))

    for sector, values in sector_scores.items():
        if not values:
            continue
        avg_score = round(sum(values) / len(values), 2)
        state["sectors"][sector] = {
            "name": sector,
            "avg_score": avg_score,
            "sample_size": len(values),
            "source": "smart_money_cache",
        }


def _ingest_overview_home_sectors(state: Dict[str, Any], payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    hot_top5 = payload.get("hot_top5")
    if not isinstance(hot_top5, list):
        return
    for row in hot_top5:
        if not isinstance(row, dict):
            continue
        symbol = normalize_symbol(row.get("symbol"))
        if not symbol:
            continue
        # sector detail is often absent; keep symbol-level stub for context layer.
        if symbol not in state["sectors"]:
            state["sectors"][symbol] = {
                "name": row.get("name") or symbol,
                "hot_score": safe_float(row.get("hot_score"), default=None),
                "source": "overview_home_cache",
            }


def get_market_snapshot_context() -> Dict[str, Any]:
    state = _blank_snapshot()

    handlers = {
        "cache/core_price_snapshot_latest.json": _ingest_core_snapshot,
        "cache/market_snapshot.json": _ingest_market_snapshot,
        "cache/market_state.json": _ingest_market_state,
        "cache/risk_engine.json": _ingest_risk_engine,
        "risk_v1.json": _ingest_risk_v1,
        "risk_v1_playback.json": _ingest_risk_v1,
        "risk_v1_sim.json": _ingest_risk_v1,
        "cache/smart_money.json": _ingest_smart_money_sectors,
        "cache/overview_home.json": _ingest_overview_home_sectors,
    }

    for candidate in SNAPSHOT_CANDIDATES:
        payload, meta = load_artifact(candidate, default=None)
        _merge_meta(state, meta)
        handler = handlers.get(candidate)
        if handler is not None and payload is not None:
            handler(state, payload)

    # Normalize risk fallbacks.
    if "risk_label" not in state["risk"]:
        state["risk"]["risk_label"] = "MEDIUM"
    if "phase" not in state["risk"]:
        state["risk"]["phase"] = "UNKNOWN"
    if "shock_probability" not in state["risk"]:
        state["risk"]["shock_probability"] = None

    return state


def get_symbol_price_context(symbol: str) -> Dict[str, Any]:
    symbol = normalize_symbol(symbol)
    snapshot = get_market_snapshot_context()

    row = (
        snapshot["mega_caps"].get(symbol)
        or snapshot["etfs"].get(symbol)
        or snapshot["indices"].get(symbol)
    )
    price = safe_float(row.get("price"), default=None) if isinstance(row, dict) else None
    change_pct = safe_float(row.get("change_pct"), default=None) if isinstance(row, dict) else None

    direction = "unknown"
    if change_pct is not None:
        if change_pct > 0.1:
            direction = "up"
        elif change_pct < -0.1:
            direction = "down"
        else:
            direction = "flat"

    score = _score_from_change(change_pct)
    return {
        "symbol": symbol,
        "price": price,
        "change_pct": change_pct,
        "direction": direction,
        "confirmation_score": round(score, 3),
        "reference_level": f"{price:.2f}" if price is not None else "unavailable",
        "source": snapshot["_meta"]["source"],
        "_meta": snapshot["_meta"],
    }


def _load_movers() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    payload, meta = load_artifact("cache/movers_snapshot_latest.json", default={})
    if not isinstance(payload, dict):
        return [], meta
    categories = payload.get("categories")
    if not isinstance(categories, dict):
        return [], meta
    rows: List[Dict[str, Any]] = []
    for category_name in ("most_active", "unusual_volume", "gainers"):
        items = categories.get(category_name)
        if not isinstance(items, list):
            continue
        for row in items:
            if isinstance(row, dict):
                item = dict(row)
                item["_category"] = category_name
                rows.append(item)
    return rows, meta


def get_volume_confirmation(symbol: str) -> Dict[str, Any]:
    symbol = normalize_symbol(symbol)
    rows, meta = _load_movers()

    for row in rows:
        if normalize_symbol(row.get("symbol")) != symbol:
            continue
        rel_vol = safe_float(row.get("relative_volume_10d_calc"), default=1.0) or 1.0
        if rel_vol >= 3.0:
            score = 0.92
        elif rel_vol >= 2.0:
            score = 0.78
        elif rel_vol >= 1.2:
            score = 0.65
        else:
            score = 0.53
        return {
            "symbol": symbol,
            "found": True,
            "category": row.get("_category"),
            "relative_volume_10d_calc": rel_vol,
            "score": score,
            "_meta": {
                "source": meta.get("source", "fallback"),
                "loaded_files": meta.get("loaded_files", []),
                "missing_files": meta.get("missing_files", []),
            },
        }

    return {
        "symbol": symbol,
        "found": False,
        "category": None,
        "relative_volume_10d_calc": None,
        "score": 0.50,
        "_meta": {
            "source": meta.get("source", "fallback"),
            "loaded_files": meta.get("loaded_files", []),
            "missing_files": meta.get("missing_files", []),
        },
    }


def get_sector_confirmation(symbol: str) -> Dict[str, Any]:
    symbol = normalize_symbol(symbol)
    proxy_symbol = SECTOR_PROXY_MAP.get(symbol, "QQQ")
    snapshot = get_market_snapshot_context()
    proxy = snapshot["etfs"].get(proxy_symbol) or snapshot["indices"].get(proxy_symbol)
    change_pct = safe_float(proxy.get("change_pct"), default=None) if isinstance(proxy, dict) else None
    score = _score_from_change(change_pct)
    note = f"{proxy_symbol} context is unavailable."
    if change_pct is not None:
        note = f"{proxy_symbol} change {change_pct:+.2f}% provides sector confirmation context."
    return {
        "symbol": symbol,
        "proxy_symbol": proxy_symbol,
        "proxy_change_pct": change_pct,
        "score": round(score, 3),
        "note": note,
        "_meta": snapshot["_meta"],
    }


def get_risk_context() -> Dict[str, Any]:
    snapshot = get_market_snapshot_context()
    risk = snapshot.get("risk") if isinstance(snapshot, dict) else {}
    risk = risk if isinstance(risk, dict) else {}

    risk_label = str(risk.get("risk_label") or "MEDIUM").upper()
    phase = str(risk.get("phase") or "UNKNOWN").upper()
    shock_probability = safe_float(risk.get("shock_probability"), default=None)

    risk_pressure = "medium"
    if risk_label in {"HIGH", "SEVERE", "CRISIS"}:
        risk_pressure = "high"
    elif risk_label in {"LOW", "NORMAL"}:
        risk_pressure = "low"

    if shock_probability is not None:
        if shock_probability >= 40:
            risk_pressure = "high"
        elif shock_probability < 18 and risk_pressure != "high":
            risk_pressure = "low"

    alignment_score = 0.60
    if risk_pressure == "low" and phase in {"BULL", "EXPANSION"}:
        alignment_score = 0.78
    elif risk_pressure == "high" and phase in {"BEAR", "CONTRACTION"}:
        alignment_score = 0.74
    elif risk_pressure == "high":
        alignment_score = 0.36

    return {
        "risk_label": risk_label,
        "phase": phase,
        "shock_probability": shock_probability,
        "risk_pressure": risk_pressure,
        "alignment_score": clamp01(alignment_score, default=0.60),
        "_meta": snapshot.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
    }
