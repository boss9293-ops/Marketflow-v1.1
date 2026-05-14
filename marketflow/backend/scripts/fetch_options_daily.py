"""
Fetch and summarize daily options chains from Yahoo Finance.

Outputs:
  backend/output/cache/options/{TICKER}.json

Usage:
  python backend/scripts/fetch_options_daily.py AAPL
  python backend/scripts/fetch_options_daily.py AAPL --expiry 2026-05-15
  python backend/scripts/fetch_options_daily.py AAPL --stdout
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

try:
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover
    pd = None

try:
    import yfinance as yf  # type: ignore
except Exception:  # pragma: no cover
    yf = None


DATA_VERSION = "options_mvp_v1"
SOURCE = "yfinance"
DEFAULT_MAX_EXPIRIES = 6
DEFAULT_MODE = "near"
VALID_MODES = {"near", "full"}
NEAR_SPOT_PCT = 0.20


def configure_yfinance_cache() -> None:
    if yf is None:
        return
    cache_env = os.environ.get("YFINANCE_CACHE_DIR", "").strip()
    cache_root = Path(cache_env) if cache_env else backend_dir() / "output" / "cache" / "yfinance"
    try:
        cache_root.mkdir(parents=True, exist_ok=True)
        cache_module = getattr(yf, "cache", None)
        if cache_module is not None and hasattr(cache_module, "set_cache_location"):
            cache_module.set_cache_location(os.fspath(cache_root))
        elif hasattr(yf, "set_tz_cache_location"):
            yf.set_tz_cache_location(os.fspath(cache_root))
    except Exception:
        pass


def backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def output_cache_dir() -> Path:
    return backend_dir() / "output" / "cache" / "options"


def normalize_ticker(value: str) -> str:
    raw = str(value or "").strip().upper()
    if ":" in raw:
        raw = raw.split(":")[-1]
    return raw


def yahoo_ticker(value: str) -> str:
    return normalize_ticker(value).replace(".", "-")


def safe_cache_symbol(value: str) -> str:
    normalized = normalize_ticker(value)
    cleaned = re.sub(r"[^A-Z0-9._-]+", "_", normalized)
    return cleaned or "UNKNOWN"


def cache_path(ticker: str) -> Path:
    return output_cache_dir() / f"{safe_cache_symbol(ticker)}.json"


def _finite_number(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        number = float(value)
        if not math.isfinite(number):
            return None
        return number
    except Exception:
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    number = _finite_number(value)
    if number is None:
        return default
    return int(max(0, round(number)))


def _round_float(value: Any, digits: int = 4) -> Optional[float]:
    number = _finite_number(value)
    if number is None:
        return None
    rounded = round(number, digits)
    if float(rounded).is_integer():
        return float(int(rounded))
    return rounded


def _round_money(value: Any) -> Optional[float]:
    number = _finite_number(value)
    if number is None:
        return None
    return round(number, 2)


def _clean_strike(value: Any) -> Optional[float]:
    return _round_float(value, 4)


def _get_fast_info_value(fast_info: Any, keys: Sequence[str]) -> Optional[float]:
    if not fast_info:
        return None
    for key in keys:
        value = None
        try:
            if hasattr(fast_info, "get"):
                value = fast_info.get(key)
        except Exception:
            value = None
        if value is None:
            try:
                value = getattr(fast_info, key)
            except Exception:
                value = None
        number = _finite_number(value)
        if number is not None and number > 0:
            return number
    return None


def fetch_current_price(ticker_obj: Any) -> Optional[float]:
    fast_price = _get_fast_info_value(
        getattr(ticker_obj, "fast_info", None),
        (
            "last_price",
            "lastPrice",
            "regular_market_price",
            "regularMarketPrice",
            "previous_close",
            "previousClose",
        ),
    )
    if fast_price is not None:
        return _round_money(fast_price)

    try:
        history = ticker_obj.history(period="5d", auto_adjust=False)
        if history is not None and not history.empty and "Close" in history:
            close = _finite_number(history["Close"].dropna().iloc[-1])
            if close is not None and close > 0:
                return _round_money(close)
    except Exception:
        pass
    return None


def _frame_empty(frame: Any) -> bool:
    if frame is None:
        return True
    try:
        return bool(frame.empty)
    except Exception:
        return True


def build_strike_rows(calls: Any, puts: Any) -> List[Dict[str, Any]]:
    rows: Dict[float, Dict[str, Any]] = {}

    def ensure_row(strike: float) -> Dict[str, Any]:
        return rows.setdefault(
            strike,
            {
                "strike": strike,
                "call_oi": 0,
                "put_oi": 0,
                "call_volume": 0,
                "put_volume": 0,
                "call_iv": None,
                "put_iv": None,
            },
        )

    if not _frame_empty(calls):
        for _, raw in calls.iterrows():
            strike = _clean_strike(raw.get("strike"))
            if strike is None:
                continue
            item = ensure_row(strike)
            item["call_oi"] = _safe_int(raw.get("openInterest"))
            item["call_volume"] = _safe_int(raw.get("volume"))
            item["call_iv"] = _round_float(raw.get("impliedVolatility"), 6)

    if not _frame_empty(puts):
        for _, raw in puts.iterrows():
            strike = _clean_strike(raw.get("strike"))
            if strike is None:
                continue
            item = ensure_row(strike)
            item["put_oi"] = _safe_int(raw.get("openInterest"))
            item["put_volume"] = _safe_int(raw.get("volume"))
            item["put_iv"] = _round_float(raw.get("impliedVolatility"), 6)

    return [rows[key] for key in sorted(rows)]


def put_call_ratio_oi(strikes: Sequence[Dict[str, Any]]) -> Optional[float]:
    call_oi = sum(_safe_int(row.get("call_oi")) for row in strikes)
    put_oi = sum(_safe_int(row.get("put_oi")) for row in strikes)
    if call_oi <= 0:
        return None
    return round(put_oi / call_oi, 4)


def normalize_mode(value: Optional[str]) -> str:
    mode = str(value or DEFAULT_MODE).strip().lower()
    return mode if mode in VALID_MODES else DEFAULT_MODE


def build_filter_range(current_price: Optional[float]) -> Optional[Dict[str, float]]:
    if current_price is None or current_price <= 0:
        return None
    return {
        "lower": _round_money(current_price * (1 - NEAR_SPOT_PCT)) or 0.0,
        "upper": _round_money(current_price * (1 + NEAR_SPOT_PCT)) or 0.0,
    }


def filter_strikes_near_spot(
    strikes: Sequence[Dict[str, Any]],
    current_price: Optional[float],
) -> List[Dict[str, Any]]:
    filter_range = build_filter_range(current_price)
    if not filter_range:
        return [dict(row) for row in strikes]
    lower = filter_range["lower"]
    upper = filter_range["upper"]
    return [
        dict(row)
        for row in strikes
        if (strike := _finite_number(row.get("strike"))) is not None and lower <= strike <= upper
    ]


def _oi_threshold(strikes: Sequence[Dict[str, Any]], key: str) -> float:
    total_oi = sum(_safe_int(row.get(key)) for row in strikes)
    return max(total_oi * 0.02, 100.0)


def largest_oi_strike(
    strikes: Sequence[Dict[str, Any]],
    key: str,
    current_price: Optional[float] = None,
) -> Optional[float]:
    candidates = [row for row in strikes if _safe_int(row.get(key)) > 0]
    if not candidates:
        return None
    threshold = _oi_threshold(strikes, key)
    liquid_candidates = [row for row in candidates if _safe_int(row.get(key)) >= threshold]
    if not liquid_candidates:
        top_n = max(1, math.ceil(len(candidates) * 0.10))
        liquid_candidates = sorted(candidates, key=lambda row: _safe_int(row.get(key)), reverse=True)[:top_n]

    anchor = current_price if current_price is not None and current_price > 0 else 0.0
    chosen = max(
        liquid_candidates,
        key=lambda row: (
            _safe_int(row.get(key)),
            -abs((_finite_number(row.get("strike")) or 0.0) - anchor),
        ),
    )
    return _clean_strike(chosen.get("strike"))


def calculate_max_pain(strikes: Sequence[Dict[str, Any]]) -> Optional[float]:
    candidates = [_finite_number(row.get("strike")) for row in strikes]
    candidate_strikes = sorted({s for s in candidates if s is not None})
    if not candidate_strikes:
        return None

    call_rows = [
        (_finite_number(row.get("strike")), _safe_int(row.get("call_oi")))
        for row in strikes
        if _safe_int(row.get("call_oi")) > 0
    ]
    put_rows = [
        (_finite_number(row.get("strike")), _safe_int(row.get("put_oi")))
        for row in strikes
        if _safe_int(row.get("put_oi")) > 0
    ]
    if not call_rows and not put_rows:
        return None

    best_strike: Optional[float] = None
    best_pain: Optional[float] = None
    for settlement in candidate_strikes:
        call_pain = sum(max(0.0, settlement - strike) * oi for strike, oi in call_rows if strike is not None)
        put_pain = sum(max(0.0, strike - settlement) * oi for strike, oi in put_rows if strike is not None)
        total_pain = call_pain + put_pain
        if best_pain is None or total_pain < best_pain:
            best_pain = total_pain
            best_strike = settlement

    return _clean_strike(best_strike)


def calculate_expected_move(
    current_price: Optional[float],
    strikes: Sequence[Dict[str, Any]],
    dte: int,
) -> Dict[str, Optional[float]]:
    if current_price is None or current_price <= 0 or dte <= 0:
        return {"amount": None, "lower": None, "upper": None, "atm_iv": None}

    strike_rows = [row for row in strikes if _finite_number(row.get("strike")) is not None]
    if not strike_rows:
        return {"amount": None, "lower": None, "upper": None, "atm_iv": None}

    atm = min(strike_rows, key=lambda row: abs((_finite_number(row.get("strike")) or 0) - current_price))
    iv_values = [
        value
        for value in (_finite_number(atm.get("call_iv")), _finite_number(atm.get("put_iv")))
        if value is not None and 0 < value < 10
    ]
    if not iv_values:
        return {"amount": None, "lower": None, "upper": None, "atm_iv": None}

    atm_iv = sum(iv_values) / len(iv_values)
    amount = current_price * atm_iv * math.sqrt(dte / 365)
    return {
        "amount": _round_money(amount),
        "lower": _round_money(current_price - amount),
        "upper": _round_money(current_price + amount),
        "atm_iv": _round_float(atm_iv, 6),
    }


def summarize_metrics(
    strikes: Sequence[Dict[str, Any]],
    current_price: Optional[float],
    dte: int,
) -> Dict[str, Any]:
    return {
        "put_call_ratio_oi": put_call_ratio_oi(strikes),
        "max_pain": calculate_max_pain(strikes),
        "call_wall": largest_oi_strike(strikes, "call_oi", current_price),
        "put_wall": largest_oi_strike(strikes, "put_oi", current_price),
        "expected_move": calculate_expected_move(current_price, strikes, dte),
        "strike_count": len(strikes),
    }


def enrich_expiry_metrics(expiry_payload: Dict[str, Any], current_price: Optional[float]) -> Dict[str, Any]:
    out = deepcopy(expiry_payload)
    strikes = out.get("strikes")
    if not isinstance(strikes, list):
        strikes = []
    dte = int(_finite_number(out.get("dte")) or 0)
    near_strikes = filter_strikes_near_spot(strikes, current_price)
    metrics_full = summarize_metrics(strikes, current_price, dte)
    metrics_near = summarize_metrics(near_strikes, current_price, dte)
    filter_range = build_filter_range(current_price)

    out["filter_range"] = filter_range
    out["metrics"] = {
        "near": metrics_near,
        "full": metrics_full,
    }
    out["put_call_ratio_oi_near"] = metrics_near["put_call_ratio_oi"]
    out["put_call_ratio_oi_full"] = metrics_full["put_call_ratio_oi"]
    out["max_pain_near"] = metrics_near["max_pain"]
    out["max_pain_full"] = metrics_full["max_pain"]
    out["call_wall_near"] = metrics_near["call_wall"]
    out["call_wall_full"] = metrics_full["call_wall"]
    out["put_wall_near"] = metrics_near["put_wall"]
    out["put_wall_full"] = metrics_full["put_wall"]
    out["expected_move_near"] = metrics_near["expected_move"]
    out["expected_move_full"] = metrics_full["expected_move"]

    selected_metrics = metrics_near
    out["put_call_ratio_oi"] = selected_metrics["put_call_ratio_oi"]
    out["max_pain"] = selected_metrics["max_pain"]
    out["call_wall"] = selected_metrics["call_wall"]
    out["put_wall"] = selected_metrics["put_wall"]
    out["expected_move"] = selected_metrics["expected_move"]
    return out


def apply_options_mode(payload: Dict[str, Any], mode: str = DEFAULT_MODE) -> Dict[str, Any]:
    selected_mode = normalize_mode(mode)
    out = deepcopy(payload)
    current_price = _finite_number(out.get("current_price"))
    filter_range = build_filter_range(current_price)
    out["mode"] = selected_mode
    out["filter_range"] = filter_range

    expiries = out.get("expiries")
    if not isinstance(expiries, list):
        out["expiries"] = []
        return out

    normalized_expiries: List[Dict[str, Any]] = []
    for item in expiries:
        if not isinstance(item, dict):
            continue
        enriched = enrich_expiry_metrics(item, current_price)
        all_strikes = enriched.get("strikes") if isinstance(enriched.get("strikes"), list) else []
        near_strikes = filter_strikes_near_spot(all_strikes, current_price)
        metrics = enriched.get("metrics") if isinstance(enriched.get("metrics"), dict) else {}
        selected_metrics = metrics.get(selected_mode) if isinstance(metrics.get(selected_mode), dict) else {}

        if selected_metrics:
            enriched["put_call_ratio_oi"] = selected_metrics.get("put_call_ratio_oi")
            enriched["max_pain"] = selected_metrics.get("max_pain")
            enriched["call_wall"] = selected_metrics.get("call_wall")
            enriched["put_wall"] = selected_metrics.get("put_wall")
            enriched["expected_move"] = selected_metrics.get("expected_move")

        enriched["mode"] = selected_mode
        enriched["filter_range"] = filter_range
        enriched["strikes_all_count"] = len(all_strikes)
        enriched["strikes_filtered_count"] = len(near_strikes)
        enriched["strikes"] = near_strikes if selected_mode == "near" else all_strikes
        normalized_expiries.append(enriched)

    out["expiries"] = normalized_expiries
    return out


def _expiry_dte(expiry: str, today: date) -> int:
    try:
        expiry_date = datetime.strptime(expiry, "%Y-%m-%d").date()
    except Exception:
        return 0
    return max((expiry_date - today).days, 0)


def summarize_expiry(ticker_obj: Any, expiry: str, current_price: Optional[float], today: date) -> Dict[str, Any]:
    chain = ticker_obj.option_chain(expiry)
    strikes = build_strike_rows(getattr(chain, "calls", None), getattr(chain, "puts", None))
    dte = _expiry_dte(expiry, today)
    return enrich_expiry_metrics({
        "expiry": expiry,
        "dte": dte,
        "strikes": strikes,
    }, current_price)


def select_expiries(
    available: Sequence[str],
    requested_expiry: Optional[str],
    max_expiries: int = DEFAULT_MAX_EXPIRIES,
) -> List[str]:
    clean_available = [str(item) for item in available if str(item).strip()]
    if requested_expiry:
        requested = str(requested_expiry).strip()
        if requested in clean_available:
            return [requested]
        raise ValueError(f"Expiry {requested} is not available for this ticker")
    return clean_available[: max(1, max_expiries)]


def fetch_options_payload(
    ticker: str,
    *,
    expiry: Optional[str] = None,
    max_expiries: int = DEFAULT_MAX_EXPIRIES,
    write_cache: bool = True,
) -> Dict[str, Any]:
    normalized = normalize_ticker(ticker)
    if not normalized:
        raise ValueError("Ticker is required")
    if yf is None:
        raise RuntimeError("yfinance is not installed")
    if pd is None:
        raise RuntimeError("pandas is not installed")

    configure_yfinance_cache()
    today = date.today()
    ticker_obj = yf.Ticker(yahoo_ticker(normalized))
    available_expiries = list(getattr(ticker_obj, "options", []) or [])
    if not available_expiries:
        current_price = fetch_current_price(ticker_obj)
        payload = {
            "ticker": normalized,
            "as_of": today.isoformat(),
            "captured_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "source": SOURCE,
            "data_version": DATA_VERSION,
            "mode": DEFAULT_MODE,
            "filter_range": build_filter_range(current_price),
            "current_price": current_price,
            "available_expiries": [],
            "expiries": [],
            "warnings": ["No options expiries returned by Yahoo Finance"],
        }
        if write_cache:
            write_options_cache(normalized, payload)
        return payload

    current_price = fetch_current_price(ticker_obj)
    selected_expiries = select_expiries(available_expiries, expiry, max_expiries=max_expiries)
    expiry_payloads: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for selected in selected_expiries:
        try:
            expiry_payloads.append(summarize_expiry(ticker_obj, selected, current_price, today))
        except Exception as exc:
            warnings.append(f"{selected}: {exc}")

    payload = {
        "ticker": normalized,
        "as_of": today.isoformat(),
        "captured_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": SOURCE,
        "data_version": DATA_VERSION,
        "mode": DEFAULT_MODE,
        "filter_range": build_filter_range(current_price),
        "current_price": current_price,
        "available_expiries": available_expiries,
        "expiries": expiry_payloads,
        "warnings": warnings,
    }
    if write_cache:
        write_options_cache(normalized, payload)
    return payload


def write_options_cache(ticker: str, payload: Dict[str, Any]) -> Path:
    path = cache_path(ticker)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def load_options_cache(ticker: str) -> Optional[Dict[str, Any]]:
    path = cache_path(ticker)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Yahoo Finance options data into MarketFlow cache.")
    parser.add_argument("ticker", help="Ticker symbol, e.g. AAPL")
    parser.add_argument("--expiry", help="Optional expiry date YYYY-MM-DD")
    parser.add_argument("--max-expiries", type=int, default=DEFAULT_MAX_EXPIRIES)
    parser.add_argument("--no-write", action="store_true", help="Do not write the cache file")
    parser.add_argument("--stdout", action="store_true", help="Print the full JSON payload")
    args = parser.parse_args()

    payload = fetch_options_payload(
        args.ticker,
        expiry=args.expiry,
        max_expiries=args.max_expiries,
        write_cache=not args.no_write,
    )
    if args.stdout:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        path = cache_path(args.ticker)
        if args.no_write:
            print(json.dumps({"ticker": payload.get("ticker"), "expiries": len(payload.get("expiries") or [])}))
        else:
            print(os.fspath(path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
