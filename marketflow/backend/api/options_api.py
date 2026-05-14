from __future__ import annotations

import os
import sys
from copy import deepcopy
from datetime import date
from typing import Any, Dict, Optional

from flask import Blueprint, jsonify, request

from services.options_summary_builder import build_options_summary


_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
_SCRIPTS_DIR = os.path.join(_BACKEND_DIR, "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from fetch_options_daily import (  # type: ignore
    DEFAULT_MAX_EXPIRIES,
    apply_options_mode,
    fetch_options_payload,
    load_options_cache,
    normalize_mode,
    normalize_ticker,
    write_options_cache,
)


options_bp = Blueprint("options", __name__)

EMPTY_MESSAGE = "No options data available for this ticker. This may happen for indexes, unsupported tickers, or temporary source limits."


def _with_options_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    out = deepcopy(payload)
    out["options_summary"] = build_options_summary(out)
    return out


def _empty_payload(ticker: str, mode: str, error: Optional[str] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "ticker": ticker,
        "as_of": date.today().isoformat(),
        "source": "yfinance",
        "mode": mode,
        "filter_range": None,
        "current_price": None,
        "available_expiries": [],
        "expiries": [],
        "options_summary": None,
        "message": EMPTY_MESSAGE,
    }
    if error:
        payload["error"] = error
    return payload


def _cache_is_fresh(payload: Optional[Dict[str, Any]]) -> bool:
    return bool(payload and payload.get("as_of") == date.today().isoformat())


def _has_expiry(payload: Optional[Dict[str, Any]], expiry: Optional[str]) -> bool:
    if not expiry:
        return True
    expiries = payload.get("expiries") if payload else None
    if not isinstance(expiries, list):
        return False
    return any(isinstance(item, dict) and item.get("expiry") == expiry for item in expiries)


def _has_default_expiry_set(payload: Optional[Dict[str, Any]], max_expiries: int) -> bool:
    if not payload:
        return False
    expiries = payload.get("expiries")
    if not isinstance(expiries, list) or not expiries:
        return False
    available = payload.get("available_expiries")
    if isinstance(available, list) and available:
        expected = min(max_expiries, len(available))
        return len(expiries) >= expected
    return True


def _filter_expiry(payload: Dict[str, Any], expiry: Optional[str]) -> Dict[str, Any]:
    if not expiry:
        return payload
    out = deepcopy(payload)
    expiries = out.get("expiries")
    if isinstance(expiries, list):
        out["expiries"] = [item for item in expiries if isinstance(item, dict) and item.get("expiry") == expiry]
    return out


def _parse_bool(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "refresh"}


def _parse_max_expiries(value: Optional[str]) -> int:
    try:
        parsed = int(str(value or "").strip())
        return min(max(parsed, 1), 12)
    except Exception:
        return DEFAULT_MAX_EXPIRIES


def _merge_expiry_payload(cached: Optional[Dict[str, Any]], fetched: Dict[str, Any], ticker: str) -> Dict[str, Any]:
    if not cached or cached.get("as_of") != fetched.get("as_of"):
        write_options_cache(ticker, fetched)
        return fetched

    merged = deepcopy(cached)
    for key in ("ticker", "as_of", "captured_at", "source", "data_version", "current_price", "available_expiries"):
        if key in fetched:
            merged[key] = fetched[key]

    merged_expiries = merged.get("expiries")
    fetched_expiries = fetched.get("expiries")
    if not isinstance(merged_expiries, list):
        merged_expiries = []
    if isinstance(fetched_expiries, list):
        by_expiry = {
            item.get("expiry"): item
            for item in merged_expiries
            if isinstance(item, dict) and item.get("expiry")
        }
        for item in fetched_expiries:
            if isinstance(item, dict) and item.get("expiry"):
                by_expiry[item["expiry"]] = item
        order = merged.get("available_expiries") if isinstance(merged.get("available_expiries"), list) else []
        merged["expiries"] = sorted(
            by_expiry.values(),
            key=lambda item: order.index(item.get("expiry")) if item.get("expiry") in order else 999,
        )

    warnings = []
    for source in (cached.get("warnings"), fetched.get("warnings")):
        if isinstance(source, list):
            warnings.extend(str(item) for item in source if item)
    merged["warnings"] = list(dict.fromkeys(warnings))
    write_options_cache(ticker, merged)
    return merged


@options_bp.route("/api/options", methods=["GET"])
def get_options():
    ticker = normalize_ticker(request.args.get("ticker", ""))
    expiry = str(request.args.get("expiry", "") or "").strip() or None
    mode = normalize_mode(request.args.get("mode"))
    refresh = _parse_bool(request.args.get("refresh"))
    max_expiries = _parse_max_expiries(request.args.get("max_expiries"))

    if not ticker:
        return jsonify({"error": "ticker query parameter is required"}), 400

    cached = load_options_cache(ticker)
    if (
        cached
        and not refresh
        and _cache_is_fresh(cached)
        and _has_expiry(cached, expiry)
        and (expiry or _has_default_expiry_set(cached, max_expiries))
    ):
        payload = apply_options_mode(_filter_expiry(cached, expiry), mode)
        return jsonify(_with_options_summary(payload)), 200

    try:
        payload = fetch_options_payload(
            ticker,
            expiry=expiry,
            max_expiries=max_expiries,
            write_cache=not expiry,
        )
        if expiry:
            payload = _merge_expiry_payload(cached, payload, ticker)
        payload = apply_options_mode(_filter_expiry(payload, expiry), mode)
        return jsonify(_with_options_summary(payload)), 200
    except Exception as exc:
        if cached:
            fallback = apply_options_mode(_filter_expiry(cached, expiry), mode)
            fallback["stale"] = True
            fallback["error"] = str(exc)
            warnings = fallback.get("warnings")
            if not isinstance(warnings, list):
                warnings = []
            warnings.append("Served stale options cache because refresh failed")
            fallback["warnings"] = warnings
            return jsonify(_with_options_summary(fallback)), 200
        return jsonify(_empty_payload(ticker, mode, str(exc))), 200
