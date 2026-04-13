# -*- coding: utf-8 -*-
"""
Build a SOXX-centered leveraged survival playback archive.

Output:
  backend/output/soxx_survival_playback.json

The archive mirrors the existing VR survival playback shape so the frontend
can consume it later with minimal extra plumbing. It uses SOXX as the stress
anchor, QQQ as the relative-strength benchmark, and a SOXL-like leveraged
proxy to model survival behavior.
"""
from __future__ import annotations

import json
import math
import os
import sqlite3
import sys
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
OUTPUT_DIR = BACKEND_DIR / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if load_dotenv is not None:
    try:
        load_dotenv(ROOT_DIR / ".env")
        load_dotenv(BACKEND_DIR / ".env")
    except Exception:
        pass

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from db_utils import resolve_marketflow_db
except Exception:
    def resolve_marketflow_db(*_args, **_kwargs):
        return str((BACKEND_DIR.parent / "data" / "marketflow.db").resolve())

try:
    from backend.services.cache_store import CacheStore, SeriesPoint
except Exception:
    CacheStore = None
    SeriesPoint = None


if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


OUTPUT_NAME = "soxx_survival_playback.json"
PRIMARY_SYMBOL = "SOXX"
BENCHMARK_SYMBOL = "QQQ"
LEVERAGED_SYMBOL = "SOXL"
WINDOW_PRE_DAYS = 63
WINDOW_POST_DAYS = 63
MONTHLY_HISTORY_START = "1980-01-01"
MONTHLY_WINDOW_PRE_MONTHS = 12
MONTHLY_WINDOW_POST_MONTHS = 6
FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

MONTHLY_FRED_SERIES: dict[str, dict[str, str]] = {
    "ipg": {"symbol": "SEMI_IPG", "series_id": "IPG3344S", "label": "Industrial Production", "unit": "index", "color": "#7dd3fc"},
    "caput": {"symbol": "SEMI_CAPUT", "series_id": "CAPUTLG3344S", "label": "Capacity Utilization", "unit": "pct", "color": "#f59e0b"},
    "capacity": {"symbol": "SEMI_CAPACITY", "series_id": "CAPG3344S", "label": "Capacity", "unit": "index", "color": "#34d399"},
    "orders": {"symbol": "SEMI_NEW_ORDERS", "series_id": "A34SNO", "label": "New Orders", "unit": "index", "color": "#f472b6"},
    "shipments": {"symbol": "SEMI_SHIPMENTS", "series_id": "A34SVS", "label": "Shipments", "unit": "index", "color": "#a78bfa"},
    "inventories": {"symbol": "SEMI_INVENTORIES", "series_id": "A34STI", "label": "Inventories", "unit": "index", "color": "#fb7185"},
    "inv_ship": {"symbol": "SEMI_INV_SHIP", "series_id": "A34SIS", "label": "Inventories / Shipments", "unit": "ratio", "color": "#fbbf24"},
    "unfilled": {"symbol": "SEMI_UNFILLED", "series_id": "A34SUO", "label": "Unfilled Orders", "unit": "index", "color": "#60a5fa"},
    "riw": {"symbol": "SEMI_RIW", "series_id": "RIWG3344S", "label": "Relative Importance", "unit": "index", "color": "#c084fc"},
}

MONTHLY_FRED_SERIES_ORDER = ("ipg", "caput", "capacity", "orders", "shipments", "inventories", "inv_ship", "unfilled", "riw")

EVENT_SPECS: list[dict[str, str]] = [
    {"name": "2008-09 Global Financial Crisis", "start": "2008-09-01", "end": "2009-04-30"},
    {"name": "2011-08 Euro / Debt Ceiling Shock", "start": "2011-07-01", "end": "2011-10-31"},
    {"name": "2015-08 China Devaluation / Inventory Slump", "start": "2015-07-01", "end": "2016-02-29"},
    {"name": "2018-02 Volmageddon / Trade War Shock", "start": "2018-01-26", "end": "2018-04-30"},
    {"name": "2018-10 Q4 Semiconductor Repricing", "start": "2018-10-01", "end": "2018-12-31"},
    {"name": "2020-02 COVID Semiconductor Crash", "start": "2020-02-19", "end": "2020-04-30"},
    {"name": "2022-01 Rate-Hike Semiconductor Winter", "start": "2022-01-03", "end": "2022-10-31"},
    {"name": "2024-07 AI Correction", "start": "2024-07-10", "end": "2024-09-30"},
    {"name": "2025-03 AI Digestion / Multiples Reset", "start": "2025-03-01", "end": "2025-05-31"},
]


def now_run_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def rolling_mean(values: deque[float]) -> float | None:
    return float(sum(values) / len(values)) if values else None


def rolling_std(values: Iterable[float]) -> float | None:
    values = list(values)
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    return math.sqrt(sum((x - mean) ** 2 for x in values) / len(values))


def percentile_of(value: float | None, history: list[float]) -> float:
    if value is None or not history:
        return 50.0
    return sum(1 for item in history if item <= value) / len(history) * 100.0


def month_end_timestamp(value: Any) -> pd.Timestamp:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return pd.NaT
    return ts.to_period("M").to_timestamp("M")


def normalize_monthly_series(rows: list[tuple[str, float]], symbol: str) -> pd.Series:
    if not rows:
        return pd.Series(dtype=float, name=symbol)

    frame = pd.DataFrame(rows, columns=["date", "value"])
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).sort_values("date")
    if frame.empty:
        return pd.Series(dtype=float, name=symbol)

    frame["month"] = frame["date"].dt.to_period("M").dt.to_timestamp("M")
    frame = frame.drop_duplicates(subset=["month"], keep="last")
    series = pd.Series(pd.to_numeric(frame["value"], errors="coerce").astype(float).values, index=pd.DatetimeIndex(frame["month"]), name=symbol)
    series = series.dropna().sort_index()
    series.index = series.index.to_period("M").to_timestamp("M")
    return series


def load_cached_monthly_series(cache_symbol: str, start_date: str) -> pd.Series:
    if CacheStore is None:
        return pd.Series(dtype=float, name=cache_symbol)

    store = CacheStore()
    try:
        rows = store.get_series_range(cache_symbol, start_date, datetime.utcnow().date().isoformat())
    finally:
        store.close()
    return normalize_monthly_series(rows, cache_symbol)


def fetch_fred_monthly_series(series_id: str, start_date: str) -> pd.Series:
    if not FRED_API_KEY:
        return pd.Series(dtype=float, name=series_id)

    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    }
    response = requests.get(FRED_BASE_URL, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    rows: list[tuple[str, float]] = []
    for obs in data.get("observations", []):
        d = obs.get("date")
        v = obs.get("value")
        if not d or v in (None, ".", ""):
            continue
        try:
            rows.append((str(d), float(v)))
        except Exception:
            continue

    return normalize_monthly_series(rows, series_id)


def persist_monthly_series(symbol: str, series: pd.Series, series_id: str, label: str, unit: str) -> None:
    if CacheStore is None or SeriesPoint is None or series.empty:
        return

    store = CacheStore()
    try:
        asof = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        quality = "OK" if len(series) >= 120 else ("PARTIAL" if len(series) > 0 else "NA")
        points = [
            SeriesPoint(
                symbol=symbol,
                date=pd.Timestamp(idx).strftime("%Y-%m-%d"),
                value=float(value),
                source="FRED",
                asof=asof,
                quality=quality,
            )
            for idx, value in series.dropna().items()
        ]
        if points:
            store.upsert_series_points(points)
            store.upsert_series_meta(
                symbol=symbol,
                source="FRED",
                unit=unit,
                freq="M",
                last_updated=asof,
                quality=quality,
                notes=f"fred_series_id={series_id}; {label}",
            )
    finally:
        store.close()


def load_monthly_series(spec: dict[str, str], start_date: str) -> tuple[pd.Series, str]:
    cache_symbol = spec["symbol"]
    series_id = spec["series_id"]
    label = spec["label"]
    unit = spec.get("unit", "")

    cached = load_cached_monthly_series(cache_symbol, start_date)
    if len(cached) >= 120:
        return cached, "cache"

    try:
        remote = fetch_fred_monthly_series(series_id, start_date)
        if not remote.empty:
            persist_monthly_series(cache_symbol, remote, series_id, label, unit)
            return remote, "fred"
    except Exception:
        if not cached.empty:
            return cached, "cache-partial"

    return cached, "missing"


def build_monthly_cycle_frame() -> tuple[pd.DataFrame, dict[str, dict[str, Any]]]:
    frames: list[pd.DataFrame] = []
    sources: dict[str, dict[str, Any]] = {}

    for key in MONTHLY_FRED_SERIES_ORDER:
        spec = MONTHLY_FRED_SERIES[key]
        series, source = load_monthly_series(spec, MONTHLY_HISTORY_START)
        if series.empty:
            continue
        frames.append(series.rename(key).to_frame())
        sources[key] = {
            "symbol": spec["symbol"],
            "series_id": spec["series_id"],
            "label": spec["label"],
            "source": source,
            "points": int(series.dropna().shape[0]),
        }

    if not frames:
        return pd.DataFrame(), sources

    frame = pd.concat(frames, axis=1).sort_index()
    frame.index = pd.to_datetime(frame.index, errors="coerce")
    frame = frame[~frame.index.isna()]
    frame.index = frame.index.to_period("M").to_timestamp("M")
    frame = frame[~frame.index.duplicated(keep="last")]
    frame = frame.sort_index()
    return frame, sources


def weighted_signal(row: pd.Series, config: list[tuple[str, float, bool]], histories: dict[str, list[float]]) -> float | None:
    total = 0.0
    weight_sum = 0.0
    for col, weight, invert in config:
        if col not in row.index:
            continue
        value = row[col]
        if value is None or pd.isna(value):
            continue
        history = histories.get(col)
        if not history:
            continue
        sample = -float(value) if invert else float(value)
        history_values = [-item for item in history] if invert else history
        total += weight * percentile_of(sample, history_values)
        weight_sum += weight
    if not weight_sum:
        return None
    return round(total / weight_sum, 1)


def classify_monthly_window(points: list[dict[str, Any]]) -> dict[str, Any]:
    demand_values = [float(p["demand"]) for p in points if isinstance(p.get("demand"), (int, float))]
    supply_values = [float(p["supply"]) for p in points if isinstance(p.get("supply"), (int, float))]
    inventory_values = [float(p["inventory"]) for p in points if isinstance(p.get("inventory"), (int, float))]
    balance_values = [float(p["balance"]) for p in points if isinstance(p.get("balance"), (int, float))]

    demand_avg = round(sum(demand_values) / len(demand_values), 1) if demand_values else None
    supply_avg = round(sum(supply_values) / len(supply_values), 1) if supply_values else None
    inventory_avg = round(sum(inventory_values) / len(inventory_values), 1) if inventory_values else None
    balance_avg = round(sum(balance_values) / len(balance_values), 1) if balance_values else None

    phase = "Transition"
    headline = "Monthly semiconductor tape is transitioning."
    summary = "The selected window has not yet resolved into a clear demand or supply regime."

    if demand_avg is not None and supply_avg is not None and inventory_avg is not None and balance_avg is not None:
        if demand_avg >= 48 and balance_avg >= 5:
            phase = "Demand-led expansion"
            headline = "Demand outruns supply and the tape prices in breadth."
            summary = "Orders, shipments, and production are running hotter than the supply backdrop, so the cycle tends to reward leverage."
        elif demand_avg >= 48 and supply_avg >= 52:
            phase = "Tight monetization"
            headline = "Demand stays hot while supply remains tight."
            summary = "The market keeps paying for capacity, but the next leg depends on monetization rather than just scarcity."
        elif demand_avg <= 48 and inventory_avg >= 55:
            phase = "Inventory correction"
            headline = "Inventory pressure outruns demand."
            summary = "Demand softens while inventory and backlog signals stay heavy, which usually compresses semis quickly."
        elif balance_avg <= -8:
            phase = "Supply build"
            headline = "Supply is building faster than demand."
            summary = "Capacity expansion is catching up to demand, so valuation usually becomes more fragile."
        elif demand_avg <= 45 and supply_avg <= 45:
            phase = "Trough / repair"
            headline = "Both demand and supply are repairing."
            summary = "The cycle is waiting for a new catalyst after a broad reset."

    return {
        "phase": phase,
        "headline": headline,
        "summary": summary,
        "demand_avg": demand_avg,
        "supply_avg": supply_avg,
        "inventory_avg": inventory_avg,
        "balance_avg": balance_avg,
    }


def build_monthly_macro_window(frame: pd.DataFrame, start: str, end: str) -> dict[str, Any] | None:
    if frame.empty:
        return None

    derived = frame.copy()
    for key in MONTHLY_FRED_SERIES_ORDER:
        if key not in derived.columns:
            continue
        yoy = derived[key].pct_change(12) * 100.0
        yoy = yoy.replace([math.inf, -math.inf], pd.NA)
        derived[f"{key}_yoy"] = yoy
        derived[f"{key}_yoy_3mma"] = derived[f"{key}_yoy"].rolling(3, min_periods=1).mean()

    start_ts = month_end_timestamp(pd.Timestamp(start) - pd.DateOffset(months=MONTHLY_WINDOW_PRE_MONTHS))
    end_ts = month_end_timestamp(pd.Timestamp(end) + pd.DateOffset(months=MONTHLY_WINDOW_POST_MONTHS))
    if pd.isna(start_ts) or pd.isna(end_ts):
        return None

    window = derived.loc[(derived.index >= start_ts) & (derived.index <= end_ts)].copy()
    if window.empty:
        return None

    histories = {
        col: [float(value) for value in derived[col].dropna().tolist()]
        for col in derived.columns
        if col.endswith("_yoy_3mma")
    }

    demand_config = [
        ("orders_yoy_3mma", 0.4, False),
        ("shipments_yoy_3mma", 0.35, False),
        ("ipg_yoy_3mma", 0.25, False),
    ]
    supply_config = [
        ("caput_yoy_3mma", 0.45, False),
        ("unfilled_yoy_3mma", 0.35, False),
        ("inventories_yoy_3mma", 0.20, True),
    ]
    inventory_config = [
        ("inv_ship_yoy_3mma", 1.0, False),
    ]

    window_points: list[dict[str, Any]] = []
    for dt, row in window.iterrows():
        demand = weighted_signal(row, demand_config, histories)
        supply = weighted_signal(row, supply_config, histories)
        inventory = weighted_signal(row, inventory_config, histories)
        balance = round(demand - supply, 1) if demand is not None and supply is not None else None

        window_points.append(
            {
                "d": dt.strftime("%Y-%m-%d"),
                "demand": demand,
                "supply": supply,
                "inventory": inventory,
                "balance": balance,
                "orders": round(float(row["orders_yoy_3mma"]), 1) if "orders_yoy_3mma" in row and pd.notna(row["orders_yoy_3mma"]) else None,
                "shipments": round(float(row["shipments_yoy_3mma"]), 1) if "shipments_yoy_3mma" in row and pd.notna(row["shipments_yoy_3mma"]) else None,
                "ipg": round(float(row["ipg_yoy_3mma"]), 1) if "ipg_yoy_3mma" in row and pd.notna(row["ipg_yoy_3mma"]) else None,
                "caput": round(float(row["caput_yoy_3mma"]), 1) if "caput_yoy_3mma" in row and pd.notna(row["caput_yoy_3mma"]) else None,
                "inventories": round(float(row["inventories_yoy_3mma"]), 1) if "inventories_yoy_3mma" in row and pd.notna(row["inventories_yoy_3mma"]) else None,
                "inv_ship": round(float(row["inv_ship_yoy_3mma"]), 1) if "inv_ship_yoy_3mma" in row and pd.notna(row["inv_ship_yoy_3mma"]) else None,
                "capacity": round(float(row["capacity_yoy_3mma"]), 1) if "capacity_yoy_3mma" in row and pd.notna(row["capacity_yoy_3mma"]) else None,
                "unfilled": round(float(row["unfilled_yoy_3mma"]), 1) if "unfilled_yoy_3mma" in row and pd.notna(row["unfilled_yoy_3mma"]) else None,
                "in_event": bool(pd.Timestamp(start) <= dt <= pd.Timestamp(end)),
            }
        )

    meta = classify_monthly_window(window_points)
    return {
        "window_start": window_points[0]["d"],
        "window_end": window_points[-1]["d"],
        "points": window_points,
        **meta,
    }


def load_close_series(cur: sqlite3.Cursor, symbol: str) -> pd.Series:
    rows = cur.execute(
        "SELECT date, close FROM ohlcv_daily WHERE symbol=? AND close IS NOT NULL ORDER BY date",
        (symbol,),
    ).fetchall()
    if not rows:
        return pd.Series(dtype=float, name=symbol.lower())

    frame = pd.DataFrame(rows, columns=["date", "close"])
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce", utc=True)
    frame = frame.dropna(subset=["date"]).sort_values("date")
    frame = frame.drop_duplicates(subset=["date"], keep="last")
    frame["date"] = frame["date"].dt.tz_convert(None)
    frame = frame.set_index("date")
    series = pd.to_numeric(frame["close"], errors="coerce").dropna().astype(float)
    series.name = symbol.lower()
    return series


def load_market_frame() -> pd.DataFrame:
    db_path = resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        soxx = load_close_series(cur, PRIMARY_SYMBOL)
        qqq = load_close_series(cur, BENCHMARK_SYMBOL)
        soxl = load_close_series(cur, LEVERAGED_SYMBOL)
    finally:
        con.close()

    if soxx.empty:
        raise RuntimeError("No SOXX price data found in ohlcv_daily")
    if qqq.empty:
        raise RuntimeError("No QQQ price data found in ohlcv_daily")

    frame = pd.concat([soxx, qqq, soxl], axis=1).sort_index()
    frame = frame.dropna(subset=[PRIMARY_SYMBOL.lower(), BENCHMARK_SYMBOL.lower()])
    frame.columns = ["soxx", "qqq", "soxl"]
    return frame


def build_hybrid_leveraged_index(frame: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """
    Build a continuous leveraged proxy.

    - Uses actual SOXL returns when SOXL history exists on consecutive days.
    - Falls back to a 3x SOXX synthetic proxy outside actual coverage.
    """
    soxx = frame["soxx"].astype(float)
    soxl = frame["soxl"].astype(float)
    soxx_ret = soxx.pct_change(fill_method=None).fillna(0.0)
    actual_ret = soxl.pct_change(fill_method=None)
    synthetic_ret = (soxx_ret * 3.0).clip(lower=-0.95)

    leveraged_ret = synthetic_ret.copy()
    actual_mask = soxl.notna() & soxl.shift(1).notna()
    leveraged_ret.loc[actual_mask] = actual_ret.loc[actual_mask]
    leveraged_ret = leveraged_ret.fillna(synthetic_ret).fillna(0.0)

    leveraged_source = pd.Series("synthetic", index=frame.index)
    leveraged_source.loc[actual_mask] = "real"

    leveraged_index = []
    current = 100.0
    for ret in leveraged_ret.values:
        current = max(0.01, current * (1.0 + float(ret)))
        leveraged_index.append(current)

    leveraged_index = pd.Series(leveraged_index, index=frame.index, name="soxl_proxy")
    leveraged_dd = (leveraged_index / leveraged_index.cummax() - 1.0) * 100.0
    return leveraged_index, leveraged_dd, leveraged_ret, leveraged_source


def build_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    soxx = frame["soxx"].astype(float)
    qqq = frame["qqq"].astype(float)
    soxl_proxy, soxl_dd, leveraged_ret, leveraged_source = build_hybrid_leveraged_index(frame)

    rows: list[dict[str, Any]] = []

    ma20_buf: deque[float] = deque(maxlen=20)
    ma50_buf: deque[float] = deque(maxlen=50)
    ma200_buf: deque[float] = deque(maxlen=200)
    vol_hist: deque[float] = deque(maxlen=252)
    soxx_peak = 0.0

    days_above_ma200 = 0
    days_below_ma200 = 0
    state = "NORMAL"
    shock_cooldown = 0
    shock_stage = 0
    shock_stage_days = 0

    for i, (dt, row) in enumerate(frame.iterrows()):
        soxx_price = float(row["soxx"])
        qqq_price = float(row["qqq"])
        soxl_price = float(soxl_proxy.loc[dt])

        ma20_buf.append(soxx_price)
        ma50_buf.append(soxx_price)
        ma200_buf.append(soxx_price)

        ma20 = rolling_mean(ma20_buf) if len(ma20_buf) >= 20 else None
        ma50 = rolling_mean(ma50_buf) if len(ma50_buf) >= 50 else None
        ma200 = rolling_mean(ma200_buf) if len(ma200_buf) >= 200 else None

        soxx_ret_1d = 0.0 if i == 0 else (soxx_price / float(soxx.iloc[i - 1]) - 1.0)
        soxx_ret_3d = (soxx_price / float(soxx.iloc[i - 3]) - 1.0) * 100.0 if i >= 3 else None
        soxx_ret_5d = (soxx_price / float(soxx.iloc[i - 5]) - 1.0) * 100.0 if i >= 5 else None
        soxx_ret_20d = (soxx_price / float(soxx.iloc[i - 20]) - 1.0) * 100.0 if i >= 20 else None
        soxx_ret_60d = (soxx_price / float(soxx.iloc[i - 60]) - 1.0) * 100.0 if i >= 60 else None

        qqq_ret_20d = (qqq_price / float(qqq.iloc[i - 20]) - 1.0) * 100.0 if i >= 20 else None
        qqq_ret_60d = (qqq_price / float(qqq.iloc[i - 60]) - 1.0) * 100.0 if i >= 60 else None

        if len(ma20_buf) >= 20:
            daily_returns = [
                (ma20_buf[j] / ma20_buf[j - 1]) - 1.0
                for j in range(1, len(ma20_buf))
            ]
            vol20 = rolling_std(daily_returns)
            vol20_pct = (vol20 * math.sqrt(252) * 100.0) if vol20 is not None else None
        else:
            vol20_pct = None

        if vol20_pct is not None:
            vol_hist.append(vol20_pct)
        vol_pct = percentile_of(vol20_pct, list(vol_hist))

        if soxx_price > soxx_peak:
            soxx_peak = soxx_price
        dd_pct = (soxx_price / soxx_peak - 1.0) * 100.0 if soxx_peak > 0 else 0.0
        soxl_dd_pct = float(soxl_dd.loc[dt]) if pd.notna(soxl_dd.loc[dt]) else 0.0

        if ma200 is not None:
            if soxx_price > ma200:
                days_above_ma200 += 1
                days_below_ma200 = 0
            else:
                days_below_ma200 += 1
                days_above_ma200 = 0
        else:
            days_above_ma200 = 0
            days_below_ma200 = 0

        rel_60d = None
        if soxx_ret_60d is not None and qqq_ret_60d is not None:
            rel_60d = soxx_ret_60d - qqq_ret_60d

        rel_20d = None
        if soxx_ret_20d is not None and qqq_ret_20d is not None:
            rel_20d = soxx_ret_20d - qqq_ret_20d

        shock_trigger = False
        if soxx_ret_5d is not None and soxx_ret_5d <= -7.0:
            shock_trigger = True
        if soxx_ret_3d is not None and soxx_ret_3d <= -4.0 and vol_pct >= 80:
            shock_trigger = True
        if dd_pct <= -12 and rel_60d is not None and rel_60d <= -8:
            shock_trigger = True

        trend_s = 30.0 if (ma200 is not None and soxx_price < ma200) else 0.0
        ma50_s = 10.0 if (ma50 is not None and soxx_price < ma50) else 0.0
        depth_s = clamp(abs(dd_pct) / 30.0 * 30.0, 0.0, 30.0) if dd_pct < 0 else 0.0
        rel_s = clamp(max(0.0, -(rel_60d or 0.0)) / 20.0 * 15.0, 0.0, 15.0) if rel_60d is not None else 0.0
        vol_s = clamp(vol_pct / 100.0 * 10.0, 0.0, 10.0)
        shock_s = 15.0 if shock_trigger else 0.0
        score = round(min(100.0, trend_s + ma50_s + depth_s + rel_s + vol_s + shock_s), 1)

        if score < 25:
            level = 0
        elif score < 45:
            level = 1
        elif score < 65:
            level = 2
        elif score < 80:
            level = 3
        else:
            level = 4

        pool_by_level = {0: 0.0, 1: 35.0, 2: 60.0, 3: 80.0, 4: 100.0}

        if shock_trigger:
            state = "SHOCK"
            shock_cooldown = 5
            shock_stage = 0
            shock_stage_days = 0
            pool_pct = 100.0
        elif state == "SHOCK":
            if shock_cooldown > 0:
                shock_cooldown -= 1
                pool_pct = 100.0
            else:
                shock_stage_days += 1
                if shock_stage == 0:
                    if ma50 is not None and soxx_price > ma50 and vol_pct < 75:
                        shock_stage = 1
                        shock_stage_days = 1
                    pool_pct = 100.0
                elif shock_stage == 1:
                    pool_pct = 85.0
                    if shock_stage_days >= 5 and vol_pct < 60:
                        shock_stage = 2
                        shock_stage_days = 0
                elif shock_stage == 2:
                    pool_pct = 70.0
                    if shock_stage_days >= 5 and vol_pct < 50:
                        shock_stage = 3
                        shock_stage_days = 0
                elif shock_stage == 3:
                    pool_pct = 55.0
                    if shock_stage_days >= 5 and ma200 is not None and soxx_price > ma200:
                        shock_stage = 4
                        shock_stage_days = 0
                elif shock_stage == 4:
                    pool_pct = 35.0
                    if shock_stage_days >= 5:
                        shock_stage = 5
                        state = "NORMAL"
                        pool_pct = pool_by_level[level]
                else:
                    state = "NORMAL"
                    pool_pct = pool_by_level[level]
        elif state == "STRUCTURAL":
            pool_pct = 80.0
            if days_above_ma200 >= 10 and vol_pct < 60:
                state = "NORMAL"
                pool_pct = pool_by_level[level]
        elif state == "GRINDING":
            pool_pct = 60.0
            if days_above_ma200 >= 5:
                state = "NORMAL"
                pool_pct = pool_by_level[level]
        else:
            if ma200 is not None and days_below_ma200 >= 10 and dd_pct <= -15 and (rel_60d is None or rel_60d <= -5):
                state = "STRUCTURAL"
                pool_pct = 80.0
            elif ma200 is not None and days_below_ma200 >= 40 and 25 < vol_pct < 70 and (rel_20d is None or rel_20d <= -4):
                state = "GRINDING"
                pool_pct = 60.0
            else:
                pool_pct = pool_by_level[level]

        exposure_pct = 100.0 - pool_pct

        if state == "SHOCK" and shock_cooldown > 0:
            explain = f"Shock lock active. {shock_cooldown} trading days remain before staged re-entry."
        elif state == "SHOCK" and shock_stage < 5:
            explain = f"Re-entry stage {shock_stage}/4. {exposure_pct:.0f}% deployed while SOXX stabilizes."
        elif state == "STRUCTURAL":
            explain = f"Structural damage flagged. SOXL exposure capped at {100.0 - pool_pct:.0f}%."
        elif state == "GRINDING":
            explain = f"Grinding regime. SOXL exposure held at {100.0 - pool_pct:.0f}%."
        elif level >= 2:
            explain = f"Risk elevated. Score {score:.1f} keeps SOXL in defensive sizing."
        elif level == 1:
            explain = f"Caution zone. Score {score:.1f} suggests lighter SOXL deployment."
        else:
            explain = f"Normal regime. Score {score:.1f} supports full-sized SOXL risk budget."

        rows.append(
            {
                "d": dt.strftime("%Y-%m-%d"),
                "soxx_n": soxx_price,
                "qqq_n": soxx_price,
                "ma20": ma20,
                "ma50": ma50,
                "ma200": ma200,
                "ma50_n": (ma50 / soxx_price * 100.0) if ma50 is not None and soxx_price else None,
                "ma200_n": (ma200 / soxx_price * 100.0) if ma200 is not None and soxx_price else None,
                "soxl_n": soxl_price,
                "tqqq_n": soxl_price,
                "score": score,
                "level": level,
                "state": state,
                "pool_pct": pool_pct,
                "exposure_pct": exposure_pct,
                "dd_pct": dd_pct,
                "tqqq_dd": soxl_dd_pct,
                "vol_pct": vol_pct,
                "rel_20d": rel_20d,
                "rel_60d": rel_60d,
                "days_above_ma200": days_above_ma200,
                "days_below_ma200": days_below_ma200,
                "shock_cooldown": shock_cooldown,
                "shock_stage": shock_stage,
                "explain": explain,
                "soxx_ret_1d": soxx_ret_1d,
                "leveraged_ret_1d": float(leveraged_ret.loc[dt]) if pd.notna(leveraged_ret.loc[dt]) else 0.0,
                "leveraged_source": str(leveraged_source.loc[dt]),
            }
        )

    return rows


def build_event_name(spec_name: str) -> str:
    return spec_name


def build_event_story(spec_name: str) -> dict[str, str]:
    name = spec_name.lower()
    if "global financial crisis" in name:
        return {
            "regime": "Liquidity shock",
            "summary": "Credit and funding stress forced a full de-leveraging of high-beta semis.",
            "driver": "Orders and multiples broke together as the financial system seized up.",
            "lesson": "When liquidity breaks, SOXL is a downside accelerator, not a bargain.",
        }
    if "euro / debt ceiling shock" in name:
        return {
            "regime": "Policy shock",
            "summary": "Sovereign stress and fiscal uncertainty compressed semiconductor multiples.",
            "driver": "Risk-off flows and macro uncertainty dominated the tape even before earnings could help.",
            "lesson": "Macro can dominate for months until policy clarity returns.",
        }
    if "china devaluation / inventory slump" in name:
        return {
            "regime": "Demand correction",
            "summary": "Demand softened while the channel worked through inventory.",
            "driver": "China FX stress and slower end-demand pushed the sector into a slower clearing cycle.",
            "lesson": "Inventory correction can feel like a secular break even when it is cyclical.",
        }
    if "volmageddon / trade war shock" in name:
        return {
            "regime": "Volatility shock",
            "summary": "A volatility spike and trade-war uncertainty hit semis at the same time.",
            "driver": "Cross-asset deleveraging and tariff risk compressed the cycle before fundamentals fully rolled over.",
            "lesson": "Even strong themes can fail when the market is forced to de-risk.",
        }
    if "q4 semiconductor repricing" in name:
        return {
            "regime": "Multiple reset",
            "summary": "The market repriced the next leg of growth as the cycle cooled.",
            "driver": "Guidance softened, breadth narrowed, and the tape stopped paying for the same narrative multiple.",
            "lesson": "Breadth deterioration usually shows up before the full earnings reset is obvious.",
        }
    if "covid semiconductor crash" in name:
        return {
            "regime": "Shock and reversal",
            "summary": "The initial lockdown shock hit prices hard, then policy rescue shortened the reset.",
            "driver": "Demand froze, then stimulus and supply disruption created one of the fastest reversals in the archive.",
            "lesson": "The fastest recoveries begin when supply gets tight again.",
        }
    if "rate-hike semiconductor winter" in name:
        return {
            "regime": "Rate shock",
            "summary": "Higher discount rates and valuation compression drove a long winter.",
            "driver": "Fed hikes hit duration-sensitive semis even while the long-term AI story was still forming.",
            "lesson": "SOXL is a long-duration equity, so macro rates matter as much as demand.",
        }
    if "2024-07 ai correction" in name:
        return {
            "regime": "AI digestion",
            "summary": "The first AI wave stayed real, but the market needed proof after the initial surge.",
            "driver": "Multiple expansion and concentration in a few leaders led to a sharp digestion phase.",
            "lesson": "A strong theme can still correct when breadth is too narrow.",
        }
    if "2025-03 ai digestion" in name:
        return {
            "regime": "Monetization reset",
            "summary": "The tape moved from first-wave excitement to monetization proof.",
            "driver": "Valuation reset and long digestion gave the market time to wait for real earnings and capex confirmation.",
            "lesson": "The boom can stay alive even while SOXL spends months grinding lower or sideways.",
        }
    return {
        "regime": "Unknown",
        "summary": "The archive window captures a stress episode in the semiconductor cycle.",
        "driver": "Prices, liquidity, and expectations moved together.",
        "lesson": "SOXL behaves best when breadth and capital formation are both aligned.",
    }


def build_playback_rows(records: list[dict[str, Any]], start_idx: int, end_idx: int, pre_idx: int, post_idx: int) -> list[dict[str, Any]]:
    base_soxx = records[pre_idx]["soxx_n"]
    base_soxl = records[pre_idx]["soxl_n"]
    bh_value = 10000.0
    vr_value = 10000.0
    rows: list[dict[str, Any]] = []

    prev_leveraged = None
    for idx in range(pre_idx, post_idx + 1):
        rec = records[idx]
        soxx_n = round(rec["soxx_n"] / base_soxx * 100.0, 2) if base_soxx else None
        ma50_n = round(rec["ma50"] / base_soxx * 100.0, 2) if rec["ma50"] is not None and base_soxx else None
        ma200_n = round(rec["ma200"] / base_soxx * 100.0, 2) if rec["ma200"] is not None and base_soxx else None
        soxl_n = round(rec["soxl_n"] / base_soxl * 100.0, 2) if base_soxl else None

        if prev_leveraged is not None:
            leveraged_ret = (rec["soxl_n"] / prev_leveraged) - 1.0 if prev_leveraged else 0.0
            bh_value *= (1.0 + leveraged_ret)
            vr_value *= (1.0 + leveraged_ret * (rec["exposure_pct"] / 100.0))
        prev_leveraged = rec["soxl_n"]

        rows.append(
            {
                "d": rec["d"],
                "qqq_n": soxx_n,
                "soxx_n": soxx_n,
                "ma50_n": ma50_n,
                "ma200_n": ma200_n,
                "tqqq_n": soxl_n,
                "soxl_n": soxl_n,
                "score": rec["score"],
                "level": rec["level"],
                "state": rec["state"],
                "pool_pct": rec["pool_pct"],
                "exposure_pct": rec["exposure_pct"],
                "bh_10k": round(bh_value),
                "vr_10k": round(vr_value),
                "in_ev": start_idx <= idx <= end_idx,
                "dd_pct": round(rec["dd_pct"], 2),
                "tqqq_dd": round(rec["tqqq_dd"], 2),
            }
        )

    return rows


def build_playback_archive(records: list[dict[str, Any]], frame: pd.DataFrame, monthly_frame: pd.DataFrame | None = None) -> dict[str, Any]:
    index_by_date = {d.strftime("%Y-%m-%d"): i for i, d in enumerate(frame.index)}
    events: list[dict[str, Any]] = []

    for event_id, spec in enumerate(EVENT_SPECS, start=1):
        if spec["start"] not in index_by_date or spec["end"] not in index_by_date:
            start_ts = pd.Timestamp(spec["start"])
            end_ts = pd.Timestamp(spec["end"])
            start_idx = int(frame.index.searchsorted(start_ts, side="left"))
            end_idx = int(frame.index.searchsorted(end_ts, side="right")) - 1
        else:
            start_idx = index_by_date[spec["start"]]
            end_idx = index_by_date[spec["end"]]

        start_idx = max(0, min(start_idx, len(records) - 1))
        end_idx = max(start_idx, min(end_idx, len(records) - 1))
        pre_idx = max(0, start_idx - WINDOW_PRE_DAYS)
        post_idx = min(len(records) - 1, end_idx + WINDOW_POST_DAYS)

        playback = build_playback_rows(records, start_idx, end_idx, pre_idx, post_idx)
        if not playback:
            continue

        risk_on = None
        risk_off = None
        shock_dates: list[str] = []
        struct_dates: list[str] = []
        prev_level = None
        for point in playback:
            if prev_level is not None and prev_level < 2 <= point["level"] and risk_on is None:
                risk_on = point["d"]
            if prev_level is not None and prev_level >= 2 > point["level"] and risk_on and risk_off is None:
                risk_off = point["d"]
            if point["state"] == "SHOCK":
                shock_dates.append(point["d"])
            if point["state"] == "STRUCTURAL":
                struct_dates.append(point["d"])
            prev_level = point["level"]

        event_points = [point for point in playback if point["in_ev"]]
        bh_vals = [point["bh_10k"] for point in playback]
        vr_vals = [point["vr_10k"] for point in playback]
        soxx_vals = [point["qqq_n"] for point in event_points if isinstance(point["qqq_n"], (int, float))]
        soxl_vals = [point["tqqq_n"] for point in event_points if isinstance(point["tqqq_n"], (int, float))]

        min_bh = min(bh_vals) if bh_vals else None
        min_vr = min(vr_vals) if vr_vals else None
        fin_bh = bh_vals[-1] if bh_vals else None
        fin_vr = vr_vals[-1] if vr_vals else None

        min_soxx = min(soxx_vals) if soxx_vals else None
        min_soxl = min(soxl_vals) if soxl_vals else None

        events.append(
            {
                "id": event_id,
                "name": build_event_name(spec["name"]),
                "start": records[start_idx]["d"],
                "end": records[end_idx]["d"],
                "story": build_event_story(spec["name"]),
                "macro_window": build_monthly_macro_window(monthly_frame, records[start_idx]["d"], records[end_idx]["d"]) if monthly_frame is not None and not monthly_frame.empty else None,
                "risk_on": risk_on,
                "risk_off": risk_off,
                "shock_dates": shock_dates[:5],
                "struct_dates": struct_dates[:5],
                "stats": {
                    "soxx_trough": round(float(min_soxx), 2) if min_soxx is not None else None,
                    "soxl_trough": round(float(min_soxl), 2) if min_soxl is not None else None,
                    "bh_trough": round(float(min_bh), 0) if min_bh is not None else None,
                    "vr_trough": round(float(min_vr), 0) if min_vr is not None else None,
                    "bh_final": round(float(fin_bh), 0) if fin_bh is not None else None,
                    "vr_final": round(float(fin_vr), 0) if fin_vr is not None else None,
                    "capital_saved_pct": round((min_vr - min_bh) / 10000.0 * 100.0, 1) if min_vr is not None and min_bh is not None else None,
                },
                "playback": playback,
            }
        )

    return {"run_id": now_run_id(), "events": events}


def main() -> int:
    try:
        frame = load_market_frame()
        records = build_records(frame)
        monthly_frame, monthly_sources = build_monthly_cycle_frame()
        archive = build_playback_archive(records, frame, monthly_frame)
        if monthly_sources:
            archive["macro_sources"] = monthly_sources
    except Exception as exc:
        print(f"[ERROR] {exc}", flush=True)
        return 1

    out_path = OUTPUT_DIR / OUTPUT_NAME
    out_path.write_text(json.dumps(archive, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    first_event = archive["events"][0]["name"] if archive["events"] else "none"
    last_event = archive["events"][-1]["name"] if archive["events"] else "none"
    print(
        f"SOXX rows={len(frame)} records={len(records)} events={len(archive['events'])} "
        f"first={first_event} last={last_event}",
        flush=True,
    )
    print(f"Wrote {out_path} ({out_path.stat().st_size // 1024} KB)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
