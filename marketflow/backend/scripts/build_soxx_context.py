# -*- coding: utf-8 -*-
"""
Build SOXX semiconductor context cache.

Output:
  backend/output/soxx_context.json

The first pass is intentionally price-action based:
  - SOXX drawdown and MA20/50/200 structure
  - QQQ relative strength
  - NVDA / TSM momentum confirmation
  - SOXL proxy drawdown based on SOXX stress

This is the data foundation for the later AI cycle score pass.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
BACKEND_DIR_STR = str(BACKEND_DIR)
if BACKEND_DIR_STR not in sys.path:
    sys.path.insert(0, BACKEND_DIR_STR)

try:
    from db_utils import resolve_marketflow_db
    from services.data_contract import output_root
except Exception:
    def resolve_marketflow_db(*_args, **_kwargs):
        return str((BACKEND_DIR.parent / "data" / "marketflow.db").resolve())

    def output_root():
        return (BACKEND_DIR / "output").resolve()


if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


PRIMARY_SYMBOL = "SOXX"
BENCHMARK_SYMBOL = "QQQ"
PEER_SYMBOLS = ("NVDA", "TSM", "SOXL")
DEFAULT_HISTORY_WINDOW = 252
OUTPUT_FILENAME = "soxx_context.json"
AI_EARNINGS_WINDOW_DAYS = 45
AI_EARNINGS_TICKERS = {
    "AAPL",
    "AMD",
    "AMAT",
    "AMZN",
    "ANET",
    "AVGO",
    "CIEN",
    "DELL",
    "GLW",
    "INTC",
    "KLAC",
    "LITE",
    "META",
    "MPWR",
    "MU",
    "NVDA",
    "Q",
    "STX",
    "TER",
    "WDC",
}
AI_CAPEX_TICKERS = {
    "AMAT",
    "ANET",
    "AVGO",
    "CIEN",
    "DELL",
    "INTC",
    "KLAC",
    "LITE",
    "MPWR",
    "MU",
    "NVDA",
    "Q",
    "STX",
    "TER",
    "WDC",
}

SYMBOL_META = {
    "SOXX": {"name": "iShares Semiconductor ETF", "role": "primary"},
    "QQQ": {"name": "Invesco QQQ Trust", "role": "benchmark"},
    "NVDA": {"name": "NVIDIA", "role": "ai_leader"},
    "TSM": {"name": "Taiwan Semiconductor", "role": "foundry_leader"},
    "SOXL": {"name": "Direxion Daily Semiconductor Bull 3X Shares", "role": "leveraged_proxy"},
}

LEADERS_FOR_CHART = ("NVDA", "TSM", "AVGO", "MU", "AMD")
EQUIPMENT_BASKET = ("AMAT", "LRCX", "KLAC")
CHART_SERIES_CONFIG = [
    {"key": "soxx", "label": "SOXX", "color": "#7dd3fc", "strokeWidth": 3.2},
    {"key": "nvda", "label": "NVDA", "color": "#a78bfa", "strokeWidth": 2.2},
    {"key": "tsm", "label": "TSM", "color": "#34d399", "strokeWidth": 2.2},
    {"key": "avgo", "label": "AVGO", "color": "#f59e0b", "strokeWidth": 2.1},
    {"key": "mu", "label": "MU", "color": "#f472b6", "strokeWidth": 2.1},
    {"key": "equip", "label": "AMAT / LRCX / KLAC", "color": "#fb7185", "strokeWidth": 2.1, "dash": "5 4"},
    {"key": "amd", "label": "AMD", "color": "#c084fc", "strokeWidth": 2.1},
]

SUPPLY_DEMAND_OUTLOOK_SERIES_CONFIG = [
    {"key": "demand", "label": "Industry Demand (Gartner)", "color": "#f472b6", "strokeWidth": 2.8},
    {"key": "fab_spend", "label": "300mm Fab Spend (SEMI)", "color": "#7dd3fc", "strokeWidth": 2.4},
    {"key": "memory_spend", "label": "Memory Equipment Spend (SEMI)", "color": "#34d399", "strokeWidth": 2.2, "dash": "5 4"},
]

SERIES_COLUMNS = ["close", "ma20", "ma50", "ma200", "dist_ma20_pct", "dist_ma50_pct", "dist_ma200_pct", "dd_pct", "vol20_pct", "ret_1d_pct", "ret_5d_pct", "ret_20d_pct", "ret_60d_pct", "ret_252d_pct", "above_ma200", "trend_stack"]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def safe_number(value: Any, digits: int = 2) -> Optional[float]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    try:
        return round(float(value), digits)
    except Exception:
        return None


def safe_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return bool(value)


def normalize_to_base100(series: pd.Series) -> pd.Series:
    out = pd.to_numeric(series, errors="coerce").copy()
    first_valid = out.dropna()
    if first_valid.empty:
        return out * np.nan
    base = float(first_valid.iloc[0])
    if base == 0:
        return out * np.nan
    return (out / base) * 100.0


def format_number(value: Any, digits: int = 1) -> str:
    number = safe_number(value, digits)
    if number is None:
        return "--"
    return f"{number:.{digits}f}"


def format_pct(value: Any, digits: int = 1) -> str:
    number = safe_number(value, digits)
    if number is None:
        return "--"
    sign = "+" if number > 0 else ""
    return f"{sign}{number:.{digits}f}%"


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def weighted_mean(values: list[tuple[Optional[float], float]], fallback: float = 50.0) -> float:
    numerator = 0.0
    denominator = 0.0
    for value, weight in values:
        if value is None:
            continue
        numerator += float(value) * float(weight)
        denominator += float(weight)
    if denominator <= 0:
        return float(fallback)
    return numerator / denominator


def load_json_payload(path: Path) -> Any | None:
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def load_first_json_payload(candidate_paths: list[Path]) -> Any | None:
    for path in candidate_paths:
        payload = load_json_payload(path)
        if payload is not None:
            return payload
    return None


def as_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except Exception:
        return None


def extract_block(snapshot: dict[str, Any], key: str) -> dict[str, Any]:
    payload = snapshot.get(key) if isinstance(snapshot, dict) else None
    return payload if isinstance(payload, dict) else {}


def load_macro_snapshot_latest_payload() -> dict[str, Any]:
    candidate_paths = [
        BACKEND_DIR / "data" / "snapshots" / "macro_snapshot_latest.json",
        BACKEND_DIR / "storage" / "macro_snapshots" / f"{date.today().isoformat()}.json",
    ]
    payload = load_first_json_payload(candidate_paths)
    return payload if isinstance(payload, dict) else {}


def load_earnings_calendar_payload() -> dict[str, Any]:
    candidate_paths = [
        Path(output_root()) / "earnings_calendar.json",
        BACKEND_DIR / "output" / "earnings_calendar.json",
    ]
    payload = load_first_json_payload(candidate_paths)
    return payload if isinstance(payload, dict) else {}


def build_macro_overlay(snapshot: dict[str, Any]) -> dict[str, Any]:
    computed = extract_block(snapshot, "computed")
    phase_block = extract_block(computed, "PHASE")
    mps_block = extract_block(computed, "MPS")
    vri_block = extract_block(computed, "VRI")
    shock_block = extract_block(computed, "SHOCK")
    put_call_block = extract_block(computed, "PUT_CALL")
    csi_block = extract_block(computed, "CSI")
    rpi_block = extract_block(computed, "RPI")
    lpi_block = extract_block(computed, "LPI")
    defensive_block = extract_block(computed, "DEFENSIVE")

    phase = str(phase_block.get("phase") or "UNKNOWN")
    phase_gate = safe_number(phase_block.get("gate_score"))
    phase_progress = safe_number(phase_block.get("progress"))
    phase_reasons = phase_block.get("reasons") if isinstance(phase_block.get("reasons"), list) else []
    mps = safe_number(mps_block.get("value"))
    vri = safe_number(vri_block.get("value"))
    shock_probability_30d = safe_number(shock_block.get("probability_30d"))
    put_call = safe_number(put_call_block.get("value"))
    csi = safe_number(csi_block.get("value"))
    rpi = safe_number(rpi_block.get("value"))
    lpi = safe_number(lpi_block.get("value"))

    vri_state = str(vri_block.get("state") or "UNKNOWN")
    shock_state = str(shock_block.get("state") or "UNKNOWN")
    put_call_state = str(put_call_block.get("state") or "UNKNOWN")
    csi_state = str(csi_block.get("state") or "UNKNOWN")
    rpi_state = str(rpi_block.get("state") or "UNKNOWN")
    lpi_state = str(lpi_block.get("state") or "UNKNOWN")
    defensive_mode = str(defensive_block.get("mode") or "UNKNOWN")

    macro_score = round(
        weighted_mean(
            [
                (phase_gate, 0.22),
                (mps, 0.22),
                (100.0 - vri if vri is not None else None, 0.15),
                (100.0 - shock_probability_30d if shock_probability_30d is not None else None, 0.10),
                (100.0 - csi if csi is not None else None, 0.10),
                (100.0 - rpi if rpi is not None else None, 0.10),
                (100.0 - lpi if lpi is not None else None, 0.06),
                (100.0 - put_call if put_call is not None else None, 0.05),
            ],
            fallback=50.0,
        ),
        1,
    )

    macro_state = "RISK_ON"
    if defensive_mode in {"ON", "WATCH"} or phase in {"Shock", "Contraction"}:
        macro_state = "DEFENSIVE"
    elif macro_score < 45.0:
        macro_state = "MIXED"

    summary_bits = [
        f"Phase {phase}",
        f"MPS {format_number(mps, 1)}",
        f"VRI {format_number(vri, 1)} ({vri_state})",
        f"Shock {format_number(shock_probability_30d, 1)}%",
        f"Defensive {defensive_mode}",
    ]

    return {
        "model": "macro_snapshot_latest",
        "phase": phase,
        "phase_gate": phase_gate,
        "progress": phase_progress,
        "mps": mps,
        "vri": vri,
        "vri_state": vri_state,
        "shock_probability_30d": shock_probability_30d,
        "shock_state": shock_state,
        "put_call": put_call,
        "put_call_state": put_call_state,
        "csi": csi,
        "csi_state": csi_state,
        "rpi": rpi,
        "rpi_state": rpi_state,
        "lpi": lpi,
        "lpi_state": lpi_state,
        "defensive_mode": defensive_mode,
        "defensive_reasons": defensive_block.get("reasons") if isinstance(defensive_block.get("reasons"), list) else [],
        "reasons": phase_reasons[:3],
        "score": macro_score,
        "state": macro_state,
        "summary": ", ".join(summary_bits),
        "components": {
            "phase_gate": phase_gate,
            "mps": mps,
            "vri_health": round(100.0 - vri, 1) if vri is not None else None,
            "shock_health": round(100.0 - shock_probability_30d, 1) if shock_probability_30d is not None else None,
            "csi_health": round(100.0 - csi, 1) if csi is not None else None,
            "rpi_health": round(100.0 - rpi, 1) if rpi is not None else None,
            "lpi_health": round(100.0 - lpi, 1) if lpi is not None else None,
            "put_call_health": round(100.0 - put_call, 1) if put_call is not None else None,
        },
    }


def build_earnings_overlay(calendar: dict[str, Any], as_of_date: str) -> dict[str, Any]:
    raw_events = calendar.get("earnings") if isinstance(calendar, dict) else []
    if not isinstance(raw_events, list):
        raw_events = []

    window_end = as_date(as_of_date)
    if window_end is None:
        window_end = date.today()

    importance_map = {
        "NVDA": 2.2,
        "TSM": 2.0,
        "AMAT": 1.7,
        "KLAC": 1.6,
        "ANET": 1.5,
        "MPWR": 1.5,
        "TER": 1.4,
        "INTC": 1.3,
        "DELL": 1.3,
        "WDC": 1.3,
        "STX": 1.2,
        "LITE": 1.2,
        "Q": 1.2,
        "CIEN": 1.1,
        "AAPL": 1.0,
        "AMZN": 1.0,
        "META": 1.0,
        "AMD": 1.0,
        "AVGO": 1.0,
        "MU": 1.0,
    }

    events: list[dict[str, Any]] = []
    for event in raw_events:
        if not isinstance(event, dict):
            continue
        ticker = str(event.get("ticker") or "").upper().strip()
        if ticker not in AI_EARNINGS_TICKERS:
            continue
        event_date = as_date(event.get("date"))
        if event_date is None:
            continue
        days_out = (event_date - window_end).days
        if days_out < 0 or days_out > AI_EARNINGS_WINDOW_DAYS:
            continue

        importance = float(importance_map.get(ticker, 1.0))
        capex = ticker in AI_CAPEX_TICKERS
        proximity = max(0.0, 1.0 - (days_out / float(AI_EARNINGS_WINDOW_DAYS)))
        events.append(
            {
                "ticker": ticker,
                "name": event.get("name"),
                "date": event_date.isoformat(),
                "days_out": int(days_out),
                "importance": round(importance, 2),
                "capex": capex,
                "ai": True,
                "proximity": round(proximity, 3),
            }
        )

    events.sort(key=lambda item: (item.get("days_out", 9999), item.get("ticker", "")))

    event_count = len(events)
    capex_count = sum(1 for event in events if event.get("capex"))
    weighted_density = sum(float(event.get("importance", 1.0)) * float(event.get("proximity", 0.0)) for event in events)
    first_event = events[0] if events else None
    nvda_event = next((event for event in events if event.get("ticker") == "NVDA"), None)
    tsm_event = next((event for event in events if event.get("ticker") == "TSM"), None)

    earnings_score = 40.0
    earnings_score += min(14.0, event_count * 1.0)
    earnings_score += min(10.0, capex_count * 0.8)
    earnings_score += min(4.0, weighted_density * 0.6)
    if isinstance(nvda_event, dict):
        earnings_score += 3.0
    if isinstance(tsm_event, dict):
        earnings_score += 2.0
    if isinstance(first_event, dict):
        first_days = int(first_event.get("days_out") or 999)
        if first_days <= 14:
            earnings_score += 2.0
        elif first_days <= 30:
            earnings_score += 1.0
    earnings_score = round(clamp(earnings_score, 0.0, 100.0), 1)

    if event_count == 0:
        window_state = "EMPTY"
    elif weighted_density >= 8.0 or capex_count >= 8:
        window_state = "CROWDED"
    elif event_count >= 4:
        window_state = "ACTIVE"
    else:
        window_state = "LIGHT"

    next_event = first_event or {}
    next_nvda_days = int(nvda_event.get("days_out")) if isinstance(nvda_event, dict) else None
    next_tsm_days = int(tsm_event.get("days_out")) if isinstance(tsm_event, dict) else None

    summary_parts = []
    if event_count:
        summary_parts.append(f"{event_count} AI/semi earnings in {AI_EARNINGS_WINDOW_DAYS}D")
    if capex_count:
        summary_parts.append(f"{capex_count} capex-heavy names")
    if isinstance(first_event, dict):
        summary_parts.append(f"next {first_event.get('ticker')} in {first_event.get('days_out')}D")

    return {
        "model": "earnings_calendar_proxy",
        "window_days": AI_EARNINGS_WINDOW_DAYS,
        "as_of": window_end.isoformat(),
        "event_count": event_count,
        "ai_count": event_count,
        "capex_count": capex_count,
        "score": earnings_score,
        "state": window_state,
        "summary": "; ".join(summary_parts) if summary_parts else "No AI/semi earnings within the proxy window.",
        "next_nvda_days": next_nvda_days,
        "next_tsm_days": next_tsm_days,
        "next_event": next_event if next_event else None,
        "events": events[:10],
        "weighted_density": round(weighted_density, 3),
    }


def build_supply_demand_outlook(as_of_date: str) -> dict[str, Any]:
    """
    Build a 3-4 year semiconductor supply/demand outlook from public forecast anchors.

    Demand anchors:
      - Gartner 2025 semiconductor revenue: $805.3B
      - Gartner 2026 semiconductor revenue forecast: $1.3202T
      - Gartner 2027 semiconductor revenue forecast: $1.5545T

    Supply anchors:
      - SEMI 300mm fab equipment spending: $133B / $151B / $155B / $172B for 2026-2029
      - SEMI installed 300mm capacity: +6% in 2026, then roughly +7% annually through 2029
      - SEMI memory equipment spending: +13% / +18% / +3% / +25% for 2026-2029

    The card set intentionally keeps public demand data explicit through 2027 and uses
    supply-side measures to show how the cycle may loosen into 2028-2029.
    """

    demand_2025 = 805.3
    demand_2026 = 1320.2
    demand_2027 = 1554.5

    fab_spend_2026 = 133.0
    fab_spend_2027 = 151.0
    fab_spend_2028 = 155.0
    fab_spend_2029 = 172.0

    memory_spend_2026 = 100.0
    memory_spend_2027 = round(memory_spend_2026 * 1.18, 1)
    memory_spend_2028 = round(memory_spend_2027 * 1.03, 1)
    memory_spend_2029 = round(memory_spend_2028 * 1.25, 1)

    capacity_2026 = 100.0
    capacity_2027 = round(capacity_2026 * 1.07, 1)
    capacity_2028 = round(capacity_2027 * 1.07, 1)
    capacity_2029 = round(capacity_2028 * 1.07, 1)

    demand_index_2026 = 100.0
    demand_index_2027 = round((demand_2027 / demand_2026) * 100.0, 1)
    fab_spend_index_2027 = round((fab_spend_2027 / fab_spend_2026) * 100.0, 1)
    fab_spend_index_2028 = round((fab_spend_2028 / fab_spend_2026) * 100.0, 1)
    fab_spend_index_2029 = round((fab_spend_2029 / fab_spend_2026) * 100.0, 1)

    return {
        "state": "TIGHT_THROUGH_2027",
        "headline": "AI demand outruns public supply forecasts through 2027, while fab investment keeps rising into 2029.",
        "summary": (
            "Gartner sees semiconductor revenue jumping to $1.32T in 2026 and $1.55T in 2027, "
            "while SEMI still shows 300mm fab equipment spending climbing through 2029. "
            "That means the cycle stays constructive, but leverage should remain tactical."
        ),
        "cards": [
            {
                "label": "Industry demand 2026",
                "state": "TIGHT",
                "value": "$1.32T",
                "detail": "Gartner: 2026 semiconductor revenue forecast, +64% YoY versus 2025 actual $805.3B. AI semis are ~30% of 2026 revenue.",
                "tone": "danger",
            },
            {
                "label": "Demand runway 2027",
                "state": "STILL STRONG",
                "value": "$1.55T",
                "detail": "Gartner: 2027 forecast implies another +17.8% YoY, with memory price relief not expected until late 2027.",
                "tone": "watch",
            },
            {
                "label": "TSMC / AI proxy",
                "state": "EXPANDING",
                "value": "~25% CAGR",
                "detail": "TSMC has said total revenue can compound around 25% through 2029, while AI accelerator revenue grows in the mid-to-high 50s CAGR range.",
                "tone": "good",
            },
            {
                "label": "Supply capex & capacity",
                "state": "RISING",
                "value": "$611B / +6->7%",
                "detail": "SEMI: 300mm fab equipment spending totals $611B in 2026-2029, and installed 300mm capacity grows 6% in 2026 and roughly 7% annually through 2029.",
                "tone": "info",
            },
        ],
        "chart": {
            "basis": "base100",
            "as_of": as_of_date,
            "note": "Public demand forecasts currently run through 2027; supply-side spending and capacity extend to 2029.",
            "series": SUPPLY_DEMAND_OUTLOOK_SERIES_CONFIG,
            "rows": [
                {
                    "date": "2026-01-01",
                    "demand": demand_index_2026,
                    "fab_spend": 100.0,
                    "memory_spend": memory_spend_2026,
                    "capacity": capacity_2026,
                },
                {
                    "date": "2027-01-01",
                    "demand": demand_index_2027,
                    "fab_spend": fab_spend_index_2027,
                    "memory_spend": memory_spend_2027,
                    "capacity": capacity_2027,
                },
                {
                    "date": "2028-01-01",
                    "demand": None,
                    "fab_spend": fab_spend_index_2028,
                    "memory_spend": memory_spend_2028,
                    "capacity": capacity_2028,
                },
                {
                    "date": "2029-01-01",
                    "demand": None,
                    "fab_spend": fab_spend_index_2029,
                    "memory_spend": memory_spend_2029,
                    "capacity": capacity_2029,
                },
            ],
        },
        "sources": [
            {
                "name": "Gartner semiconductor revenue forecast",
                "details": "2025 actual $805.3B, 2026 forecast $1.3202T, 2027 forecast $1.5545T.",
            },
            {
                "name": "SEMI 300mm fab equipment forecast",
                "details": "2026 $133B, 2027 $151B, 2028 $155B, 2029 $172B.",
            },
            {
                "name": "SEMI installed 300mm capacity",
                "details": "+6% in 2026 and roughly +7% annually from 2027 through 2029.",
            },
            {
                "name": "SEMI memory equipment spending",
                "details": "+13% / +18% / +3% / +25% for 2026 / 2027 / 2028 / 2029.",
            },
        ],
        "notes": [
            "Demand forecasts are public through 2027, so 2028-2029 demand is shown only as supply-side pressure and not extrapolated as a hard revenue forecast.",
            "TSMC's long-term CAGR statement is a leadership proxy, not a true industry forecast.",
            "This block is intentionally forward-looking: it is meant to answer whether SOXL stays tactical into the next 3-4 years.",
        ],
    }


def build_runway_view(
    as_of_date: str,
    supply_demand_outlook: dict[str, Any],
    ai_cycle_stage: str,
    lead_state: str,
    macro_phase: str,
    earnings_state: str,
) -> dict[str, Any]:
    """
    Lightweight runway estimate for how long the current AI/semi boom can stay constructive.

    This is intentionally directional, not a precise peak call:
      - demand remains explicit through 2027
      - supply-side capex/capacity continues into 2029
      - leverage should therefore stay tactical even when the setup is constructive
    """

    outlook_state = str(supply_demand_outlook.get("state") or "UNKNOWN").upper()
    if outlook_state == "TIGHT_THROUGH_2027":
        runway_state = "TIGHT_THROUGH_2027"
        horizon = "2027+"
        stance = "constructive / tactical"
        confidence = "moderate"
        next_review = "2026 Q3 earnings / capex updates"
    else:
        runway_state = outlook_state or "UNKNOWN"
        horizon = "2027+"
        stance = "constructive / tactical"
        confidence = "moderate"
        next_review = "Next earnings / capex update"

    headline = "Boom runway likely extends through 2027, with supply relief only starting to matter into 2028-2029."
    summary = (
        "Public demand forecasts stay explicit through 2027 while fab investment and installed capacity keep rising into 2029. "
        "That leaves a constructive runway for the industry, but SOXL should stay tactical because the market can price the path early."
    )

    signals = [
        "Demand forecasts remain explicit through 2027",
        "Supply-side spending and capacity extend through 2029",
        "SOXL can reprice the runway ahead of fundamentals",
    ]

    implication = "SOXX can be held; SOXL stays tactical."
    if ai_cycle_stage == "CONTRACTION":
        implication = "SOXX needs repair; SOXL stays defensive."
        stance = "repair / defense"
        confidence = "low"
    elif lead_state == "LEADING" and macro_phase not in {"STRESS", "DEFENSIVE"} and earnings_state not in {"EMPTY", "LIGHT"}:
        implication = "SOXX can be held; SOXL stays tactical."
        confidence = "moderate"

    return {
        "as_of": as_of_date,
        "state": runway_state,
        "horizon": horizon,
        "stance": stance,
        "headline": headline,
        "summary": summary,
        "next_review": next_review,
        "confidence": confidence,
        "signals": signals,
        "implication": implication,
    }


def classify_cycle_stage_v1(
    row: pd.Series,
    price_score: Optional[float],
    macro_score: Optional[float],
    earnings_score: Optional[float],
) -> tuple[str, str]:
    close = safe_number(row.get("soxx_close"))
    ma200 = safe_number(row.get("soxx_ma200"))
    dd = safe_number(row.get("soxx_dd_pct"))
    dist_ma200 = safe_number(row.get("soxx_dist_ma200_pct"))
    rs60 = safe_number(row.get("rs_60d_vs_qqq_pct"))
    price_score_num = safe_number(price_score) or 50.0
    macro_score_num = safe_number(macro_score) or 50.0
    earnings_score_num = safe_number(earnings_score) or 50.0
    blended_score = round(
        0.56 * price_score_num + 0.29 * macro_score_num + 0.15 * earnings_score_num,
        1,
    )

    if close is None or ma200 is None:
        return "UNKNOWN", "Insufficient data to classify the AI cycle."

    if close <= ma200 or (dd is not None and dd <= -20):
        return "CONTRACTION", "SOXX is below MA200 or in a deep drawdown, so defense comes first."

    if blended_score >= 82.0 and price_score_num >= 85.0 and macro_score_num >= 55.0:
        return "OVERINVESTMENT", "The cycle is extended and the catalyst window is crowded."

    if blended_score >= 68.0 and macro_score_num >= 45.0:
        return "MONETIZATION", "Price action, macro, and earnings timing are aligned well enough for monetization."

    if blended_score >= 50.0:
        if macro_score_num < 45.0:
            return "EXPECTATION", "Price is constructive, but macro confirmation is still forming."
        return "EXPECTATION", "SOXX is constructive, but the confirmation layer is still forming."

    if dist_ma200 is not None and dist_ma200 >= 15.0 and (rs60 or 0) > 0:
        return "EXPECTATION", "SOXX is extended, but the follow-through is not strong enough for monetization yet."

    return "CONTRACTION", "The cycle is not strong enough yet to justify aggressive risk."


def classify_action_v1(
    stage: str,
    price_score: Optional[float],
    macro_score: Optional[float],
    earnings_score: Optional[float],
    row: pd.Series,
    macro_overlay: dict[str, Any],
    earnings_overlay: dict[str, Any],
) -> tuple[str, str]:
    soxx_dd_pct = safe_number(row.get("soxx_dd_pct"))
    soxx_proxy_dd_pct = soxx_dd_pct * 3.0 if soxx_dd_pct is not None else None
    rs_60d_vs_qqq_pct = safe_number(row.get("rs_60d_vs_qqq_pct"))
    blended_score = round(
        0.56 * (safe_number(price_score) or 50.0)
        + 0.29 * (safe_number(macro_score) or 50.0)
        + 0.15 * (safe_number(earnings_score) or 50.0),
        1,
    )
    macro_phase = str(macro_overlay.get("phase") or "UNKNOWN")
    macro_state = str(macro_overlay.get("state") or "UNKNOWN")
    earnings_state = str(earnings_overlay.get("state") or "UNKNOWN")
    next_event = earnings_overlay.get("next_event") if isinstance(earnings_overlay.get("next_event"), dict) else {}
    next_ticker = str(next_event.get("ticker") or "--").upper()
    next_days = next_event.get("days_out")

    if stage == "CONTRACTION":
        return (
            "Defensive first",
            "SOXX is below MA200 or the blended score is too weak for leverage. Stay defensive and wait for structure repair.",
        )

    if stage == "OVERINVESTMENT":
        return (
            "Protect gains, do not chase",
            f"SOXX is extended, macro is {macro_state}, and the earnings window is {earnings_state}. Keep SOXL size tight and prioritize defense.",
        )

    if stage == "MONETIZATION":
        return (
            "SOXX can be held; SOXL stays tactical",
            f"SOXX, macro, and the catalyst calendar are aligned. Blended score {format_number(blended_score, 1)} with {macro_phase} backdrop supports controlled exposure through the current runway, but not full-size leverage.",
        )

    if stage == "EXPECTATION":
        next_bits = []
        if next_ticker != "--" and isinstance(next_days, int):
            next_bits.append(f"next catalyst {next_ticker} in {next_days}D")
        if soxx_proxy_dd_pct is not None:
            next_bits.append(f"SOXL proxy DD {format_pct(soxx_proxy_dd_pct, 1)}")
        detail = "Price is constructive, but macro and earnings confirmation are still forming."
        if next_bits:
            detail = f"{detail} {'; '.join(next_bits)}."
        return (
            "Wait for proof",
            detail,
        )

    return (
        "Cycle unknown",
        "The proxy does not have enough aligned inputs yet to make a confident SOXL call.",
    )


def build_ai_cycle_v1(
    row: pd.Series,
    price_score: float,
    price_components: dict[str, float],
    macro_overlay: dict[str, Any],
    earnings_overlay: dict[str, Any],
) -> tuple[float, str, str, dict[str, Any]]:
    macro_score = safe_number(macro_overlay.get("score"))
    earnings_score = safe_number(earnings_overlay.get("score"))
    blended_score = round(
        0.56 * (safe_number(price_score) or 50.0)
        + 0.29 * (macro_score or 50.0)
        + 0.15 * (earnings_score or 50.0),
        1,
    )
    stage, explanation = classify_cycle_stage_v1(row, price_score, macro_score, earnings_score)
    guidance_headline, guidance_detail = classify_action_v1(
        stage,
        price_score,
        macro_score,
        earnings_score,
        row,
        macro_overlay,
        earnings_overlay,
    )

    components: dict[str, Any] = dict(price_components)
    components.update(
        {
            "price": round(safe_number(price_score) or 50.0, 1),
            "macro": round(macro_score or 50.0, 1),
            "earnings": round(earnings_score or 50.0, 1),
            "weight_price": 56.0,
            "weight_macro": 29.0,
            "weight_earnings": 15.0,
            "phase_gate": macro_overlay.get("phase_gate"),
            "mps": macro_overlay.get("mps"),
            "vri": macro_overlay.get("vri"),
            "shock_probability_30d": macro_overlay.get("shock_probability_30d"),
            "put_call": macro_overlay.get("put_call"),
            "csi": macro_overlay.get("csi"),
            "rpi": macro_overlay.get("rpi"),
            "lpi": macro_overlay.get("lpi"),
            "defensive_mode": macro_overlay.get("defensive_mode"),
            "event_count": earnings_overlay.get("event_count"),
            "capex_count": earnings_overlay.get("capex_count"),
            "weighted_density": earnings_overlay.get("weighted_density"),
            "next_nvda_days": earnings_overlay.get("next_nvda_days"),
            "next_tsm_days": earnings_overlay.get("next_tsm_days"),
        }
    )

    return (
        blended_score,
        stage,
        explanation,
        {
            "headline": guidance_headline,
            "detail": guidance_detail,
            "components": components,
        },
    )


def dd_bucket(dd_pct: Optional[float]) -> str:
    if dd_pct is None:
        return "UNKNOWN"
    if dd_pct >= -5:
        return "0 to -5%"
    if dd_pct >= -10:
        return "-5 to -10%"
    if dd_pct >= -20:
        return "-10 to -20%"
    return "< -20%"


def soxl_guard_band(soxx_dd_pct: Optional[float]) -> str:
    if soxx_dd_pct is None:
        return "UNKNOWN"
    proxy_dd = min(0.0, soxx_dd_pct * 3.0)
    if proxy_dd >= -15:
        return "GREEN"
    if proxy_dd >= -30:
        return "WATCH"
    if proxy_dd >= -60:
        return "DEFENSE"
    return "CRISIS"


def classify_cycle_stage(row: pd.Series) -> tuple[str, str]:
    close = safe_number(row.get("soxx_close"))
    ma200 = safe_number(row.get("soxx_ma200"))
    ma20 = safe_number(row.get("soxx_ma20"))
    ma50 = safe_number(row.get("soxx_ma50"))
    rs60 = safe_number(row.get("rs_60d_vs_qqq_pct"))
    rs20 = safe_number(row.get("rs_20d_vs_qqq_pct"))
    nvda60 = safe_number(row.get("nvda_ret_60d_pct"))
    tsm60 = safe_number(row.get("tsm_ret_60d_pct"))
    dist_ma200 = safe_number(row.get("soxx_dist_ma200_pct"))
    dd = safe_number(row.get("soxx_dd_pct"))

    if close is None or ma200 is None:
        return "UNKNOWN", "Insufficient data to classify the AI cycle."

    above_ma200 = close > ma200
    trend_stack = bool(ma20 is not None and ma50 is not None and ma200 is not None and ma20 > ma50 > ma200)

    if not above_ma200 or (dd is not None and dd <= -20):
        return "CONTRACTION", "SOXX is below MA200 or in a deep drawdown, so defense comes first."

    if dist_ma200 is not None and dist_ma200 >= 15 and (rs60 or 0) > 0:
        return "OVERINVESTMENT", "SOXX is extended well above MA200 while relative strength is still strong."

    if (rs60 or 0) > 0 and (rs20 or 0) > 0 and (nvda60 or 0) > 0 and (tsm60 or 0) > 0 and trend_stack:
        return "MONETIZATION", "SOXX remains above MA200 and the broader semi complex is confirming the move."

    if above_ma200 and trend_stack:
        return "EXPECTATION", "SOXX is constructive, but the confirmation layer is not fully aligned yet."

    return "EXPECTATION", "SOXX is constructive, but the confirmation layer is still forming."


def classify_action(stage: str, soxx_dd_pct: Optional[float], rs_60d_vs_qqq_pct: Optional[float]) -> tuple[str, str]:
    if stage == "CONTRACTION" or (soxx_dd_pct is not None and soxx_dd_pct <= -20):
        return (
            "SOXL stays defensive; SOXX needs repair",
            "SOXX is in contraction or a deep drawdown. Keep leverage off until structure repairs and breadth widens.",
        )

    if stage == "MONETIZATION" and (rs_60d_vs_qqq_pct or 0) > 0:
        return (
            "SOXX can be held; SOXL stays tactical",
            "SOXX, macro, and the catalyst calendar are aligned. The backdrop supports controlled exposure through the current runway, but not full-size leverage.",
        )

    if stage == "OVERINVESTMENT":
        return (
            "Protect gains, do not chase",
            "SOXX is extended, macro is still supportive, and the earnings window is active. Keep SOXL size tight and prioritize defense.",
        )

    return (
        "Wait for proof",
        "Structure is constructive, but confirmation is still forming. Use SOXX as the anchor and keep SOXL tactical.",
    )


def classify_ma200_state(close: Optional[float], ma200: Optional[float]) -> str:
    if close is None or ma200 is None:
        return "UNKNOWN"
    return "ABOVE" if close > ma200 else "BELOW"


def classify_trend_state(ma20: Optional[float], ma50: Optional[float], ma200: Optional[float]) -> str:
    if ma20 is None or ma50 is None or ma200 is None:
        return "UNKNOWN"
    if ma20 > ma50 > ma200:
        return "BULL"
    if ma20 < ma50 < ma200:
        return "BEAR"
    return "MIXED"


def build_cycle_score(row: pd.Series) -> tuple[float, dict[str, float]]:
    score = 50.0
    components: dict[str, float] = {}

    close = safe_number(row.get("soxx_close"))
    ma20 = safe_number(row.get("soxx_ma20"))
    ma50 = safe_number(row.get("soxx_ma50"))
    ma200 = safe_number(row.get("soxx_ma200"))
    rs20 = safe_number(row.get("rs_20d_vs_qqq_pct"))
    rs60 = safe_number(row.get("rs_60d_vs_qqq_pct"))
    nvda60 = safe_number(row.get("nvda_ret_60d_pct"))
    tsm60 = safe_number(row.get("tsm_ret_60d_pct"))
    dd = safe_number(row.get("soxx_dd_pct"))
    vol20 = safe_number(row.get("soxx_vol20_pct"))

    if close is not None and ma200 is not None:
        if close > ma200:
            components["ma200"] = 16.0
            score += 16.0
        else:
            components["ma200"] = -18.0
            score -= 18.0

    if ma20 is not None and ma50 is not None and ma200 is not None:
        if ma20 > ma50 > ma200:
            components["trend_stack"] = 14.0
            score += 14.0
        else:
            components["trend_stack"] = -6.0
            score -= 6.0

    if rs20 is not None:
        value = 10.0 if rs20 > 0 else -8.0
        components["rs_20d"] = value
        score += value

    if rs60 is not None:
        value = 16.0 if rs60 > 0 else -14.0
        components["rs_60d"] = value
        score += value

    if nvda60 is not None:
        value = 8.0 if nvda60 > 0 else -5.0
        components["nvda_60d"] = value
        score += value

    if tsm60 is not None:
        value = 8.0 if tsm60 > 0 else -5.0
        components["tsm_60d"] = value
        score += value

    if dd is not None:
        dd_penalty = min(20.0, abs(min(0.0, dd)) * 1.1)
        components["drawdown"] = -dd_penalty
        score -= dd_penalty

    if vol20 is not None:
        vol_penalty = min(8.0, max(0.0, vol20 - 45.0) * 0.18)
        components["volatility"] = -vol_penalty
        score -= vol_penalty

    score = clamp(score, 0.0, 100.0)
    return round(score, 1), {key: round(val, 1) for key, val in components.items()}


def load_symbol(conn: sqlite3.Connection, symbol: str) -> pd.DataFrame:
    rows = conn.execute(
        """
        SELECT date, open, high, low, close, volume
        FROM ohlcv_daily
        WHERE symbol = ?
        ORDER BY date
        """,
        (symbol,),
    ).fetchall()
    df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])
    if df.empty:
        return df

    df["date"] = pd.to_datetime(df["date"], errors="coerce", utc=True)
    df = df.dropna(subset=["date"]).sort_values("date")
    df["date"] = df["date"].dt.tz_convert(None)
    df = df.drop_duplicates(subset=["date"], keep="last").set_index("date")
    for column in ("open", "high", "low", "close", "volume"):
        df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ret_1d_pct"] = out["close"].pct_change(1) * 100.0
    out["ret_5d_pct"] = out["close"].pct_change(5) * 100.0
    out["ret_20d_pct"] = out["close"].pct_change(20) * 100.0
    out["ret_60d_pct"] = out["close"].pct_change(60) * 100.0
    out["ret_252d_pct"] = out["close"].pct_change(252) * 100.0
    out["ma20"] = out["close"].rolling(20, min_periods=20).mean()
    out["ma50"] = out["close"].rolling(50, min_periods=50).mean()
    out["ma200"] = out["close"].rolling(200, min_periods=200).mean()
    out["peak"] = out["close"].cummax()
    out["dd_pct"] = (out["close"] / out["peak"] - 1.0) * 100.0
    out["vol20_pct"] = out["ret_1d_pct"].rolling(20, min_periods=20).std(ddof=0) * np.sqrt(252)
    out["dist_ma20_pct"] = (out["close"] / out["ma20"] - 1.0) * 100.0
    out["dist_ma50_pct"] = (out["close"] / out["ma50"] - 1.0) * 100.0
    out["dist_ma200_pct"] = (out["close"] / out["ma200"] - 1.0) * 100.0
    out["above_ma200"] = out["close"] > out["ma200"]
    out["trend_stack"] = (out["ma20"] > out["ma50"]) & (out["ma50"] > out["ma200"])
    return out


def prefix_frame(df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    cols = [col for col in SERIES_COLUMNS if col in df.columns]
    renamed = df[cols].copy()
    renamed.columns = [f"{symbol.lower()}_{col}" for col in cols]
    return renamed


def format_snapshot(symbol: str, df: pd.DataFrame) -> dict[str, Any]:
    meta = SYMBOL_META.get(symbol, {})
    last_row = df.iloc[-1]
    first_date = df.index[0].date().isoformat() if not df.empty else None
    last_date = df.index[-1].date().isoformat() if not df.empty else None
    close = safe_number(last_row.get("close"))
    ma20 = safe_number(last_row.get("ma20"))
    ma50 = safe_number(last_row.get("ma50"))
    ma200 = safe_number(last_row.get("ma200"))
    dd = safe_number(last_row.get("dd_pct"))
    vol20 = safe_number(last_row.get("vol20_pct"))
    ret20 = safe_number(last_row.get("ret_20d_pct"))
    ret60 = safe_number(last_row.get("ret_60d_pct"))
    ret252 = safe_number(last_row.get("ret_252d_pct"))
    dist20 = safe_number(last_row.get("dist_ma20_pct"))
    dist50 = safe_number(last_row.get("dist_ma50_pct"))
    dist200 = safe_number(last_row.get("dist_ma200_pct"))
    above_ma200 = safe_bool(last_row.get("above_ma200"))
    trend_stack = safe_bool(last_row.get("trend_stack"))

    return {
        "symbol": symbol,
        "name": meta.get("name"),
        "role": meta.get("role"),
        "history_rows": int(len(df)),
        "first_date": first_date,
        "last_date": last_date,
        "close": close,
        "ma20": safe_number(ma20),
        "ma50": safe_number(ma50),
        "ma200": safe_number(ma200),
        "dist_ma20_pct": dist20,
        "dist_ma50_pct": dist50,
        "dist_ma200_pct": dist200,
        "dd_pct": dd,
        "dd_bucket": dd_bucket(dd),
        "vol20_pct": vol20,
        "ret_20d_pct": ret20,
        "ret_60d_pct": ret60,
        "ret_252d_pct": ret252,
        "above_ma200": above_ma200,
        "trend_stack": trend_stack,
        "ma200_state": classify_ma200_state(close, ma200),
        "trend_state": classify_trend_state(ma20, ma50, ma200),
    }


def build_context(history_window: int) -> dict[str, Any]:
    db_path = resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        load_symbols = tuple(dict.fromkeys((PRIMARY_SYMBOL, BENCHMARK_SYMBOL, *PEER_SYMBOLS, *LEADERS_FOR_CHART, *EQUIPMENT_BASKET)))
        raw_frames = {symbol: load_symbol(conn, symbol) for symbol in load_symbols}
    finally:
        conn.close()

    missing = [symbol for symbol, frame in raw_frames.items() if frame.empty]
    if missing:
        raise RuntimeError(f"Missing OHLCV data for: {', '.join(missing)}")

    frames = {symbol: add_features(frame) for symbol, frame in raw_frames.items()}

    merged = prefix_frame(frames[PRIMARY_SYMBOL], PRIMARY_SYMBOL)
    join_symbols = tuple(dict.fromkeys((BENCHMARK_SYMBOL, *PEER_SYMBOLS, *LEADERS_FOR_CHART, *EQUIPMENT_BASKET)))
    for symbol in join_symbols:
        merged = merged.join(prefix_frame(frames[symbol], symbol), how="left")

    merged["soxx_vs_qqq_ratio"] = merged["soxx_close"] / merged["qqq_close"]
    first_ratio = merged["soxx_vs_qqq_ratio"].dropna().iloc[0]
    merged["soxx_vs_qqq_ratio_base100"] = (merged["soxx_vs_qqq_ratio"] / first_ratio) * 100.0
    merged["rs_20d_vs_qqq_pct"] = merged["soxx_ret_20d_pct"] - merged["qqq_ret_20d_pct"]
    merged["rs_60d_vs_qqq_pct"] = merged["soxx_ret_60d_pct"] - merged["qqq_ret_60d_pct"]
    merged["rs_252d_vs_qqq_pct"] = merged["soxx_ret_252d_pct"] - merged["qqq_ret_252d_pct"]
    merged["soxl_proxy_dd_pct"] = merged["soxx_dd_pct"] * 3.0

    for symbol in LEADERS_FOR_CHART:
        key = symbol.lower()
        merged[f"{key}_base100"] = normalize_to_base100(merged[f"{key}_close"])

    for symbol in EQUIPMENT_BASKET:
        key = symbol.lower()
        merged[f"{key}_base100"] = normalize_to_base100(merged[f"{key}_close"])

    equip_base_cols = [f"{symbol.lower()}_base100" for symbol in EQUIPMENT_BASKET]
    merged["equip_base100"] = merged[equip_base_cols].mean(axis=1)
    merged["equip_ret_20d_pct"] = merged["equip_base100"].pct_change(20) * 100.0
    merged["equip_ret_60d_pct"] = merged["equip_base100"].pct_change(60) * 100.0
    merged["equip_ret_252d_pct"] = merged["equip_base100"].pct_change(252) * 100.0

    cycle_scores: list[float] = []
    cycle_components: list[dict[str, float]] = []
    cycle_stages: list[str] = []
    cycle_explanations: list[str] = []
    action_headlines: list[str] = []
    action_details: list[str] = []
    guard_bands: list[str] = []
    dd_buckets: list[str] = []

    for _, row in merged.iterrows():
        score, components = build_cycle_score(row)
        stage, explanation = classify_cycle_stage(row)
        headline, detail = classify_action(stage, safe_number(row.get("soxx_dd_pct")), safe_number(row.get("rs_60d_vs_qqq_pct")))
        guard_band = soxl_guard_band(safe_number(row.get("soxx_dd_pct")))

        cycle_scores.append(score)
        cycle_components.append(components)
        cycle_stages.append(stage)
        cycle_explanations.append(explanation)
        action_headlines.append(headline)
        action_details.append(detail)
        guard_bands.append(guard_band)
        dd_buckets.append(dd_bucket(safe_number(row.get("soxx_dd_pct"))))

    merged["ai_cycle_score"] = cycle_scores
    merged["ai_cycle_stage"] = cycle_stages
    merged["ai_cycle_explanation"] = cycle_explanations
    merged["ai_cycle_components"] = cycle_components
    merged["soxl_guard_band"] = guard_bands
    merged["soxx_dd_bucket"] = dd_buckets
    merged["action_headline"] = action_headlines
    merged["action_detail"] = action_details

    macro_snapshot = load_macro_snapshot_latest_payload()
    earnings_calendar = load_earnings_calendar_payload()

    merged_tail = merged.tail(history_window).copy()
    if merged_tail.empty:
        raise RuntimeError("No rows available after history window selection.")

    history: list[dict[str, Any]] = []
    for idx, row in merged_tail.iterrows():
        history.append(
            {
                "date": idx.date().isoformat(),
                "soxx_close": safe_number(row.get("soxx_close")),
                "soxx_ma20": safe_number(row.get("soxx_ma20")),
                "soxx_ma50": safe_number(row.get("soxx_ma50")),
                "soxx_ma200": safe_number(row.get("soxx_ma200")),
                "soxx_dist_ma20_pct": safe_number(row.get("soxx_dist_ma20_pct")),
                "soxx_dist_ma50_pct": safe_number(row.get("soxx_dist_ma50_pct")),
                "soxx_dist_ma200_pct": safe_number(row.get("soxx_dist_ma200_pct")),
                "soxx_dd_pct": safe_number(row.get("soxx_dd_pct")),
                "soxx_dd_bucket": dd_bucket(safe_number(row.get("soxx_dd_pct"))),
                "soxx_vol20_pct": safe_number(row.get("soxx_vol20_pct")),
                "soxx_ret_20d_pct": safe_number(row.get("soxx_ret_20d_pct")),
                "soxx_ret_60d_pct": safe_number(row.get("soxx_ret_60d_pct")),
                "qqq_close": safe_number(row.get("qqq_close")),
                "qqq_ret_20d_pct": safe_number(row.get("qqq_ret_20d_pct")),
                "qqq_ret_60d_pct": safe_number(row.get("qqq_ret_60d_pct")),
                "rs_20d_vs_qqq_pct": safe_number(row.get("rs_20d_vs_qqq_pct")),
                "rs_60d_vs_qqq_pct": safe_number(row.get("rs_60d_vs_qqq_pct")),
                "rs_252d_vs_qqq_pct": safe_number(row.get("rs_252d_vs_qqq_pct")),
                "soxx_vs_qqq_ratio_base100": safe_number(row.get("soxx_vs_qqq_ratio_base100")),
                "nvda_close": safe_number(row.get("nvda_close")),
                "nvda_ret_20d_pct": safe_number(row.get("nvda_ret_20d_pct")),
                "nvda_ret_60d_pct": safe_number(row.get("nvda_ret_60d_pct")),
                "tsm_close": safe_number(row.get("tsm_close")),
                "tsm_ret_20d_pct": safe_number(row.get("tsm_ret_20d_pct")),
                "tsm_ret_60d_pct": safe_number(row.get("tsm_ret_60d_pct")),
                "soxl_close": safe_number(row.get("soxl_close")),
                "soxl_ret_20d_pct": safe_number(row.get("soxl_ret_20d_pct")),
                "soxl_ret_60d_pct": safe_number(row.get("soxl_ret_60d_pct")),
                "soxl_proxy_dd_pct": safe_number(row.get("soxl_proxy_dd_pct")),
                "ai_cycle_score": safe_number(row.get("ai_cycle_score"), 1),
                "ai_cycle_stage": row.get("ai_cycle_stage"),
                "ai_cycle_explanation": row.get("ai_cycle_explanation"),
                "action_headline": row.get("action_headline"),
                "action_detail": row.get("action_detail"),
                "soxl_guard_band": row.get("soxl_guard_band"),
            }
        )

    current_row = merged.iloc[-1]
    current_date = merged.index[-1].date().isoformat()
    soxx_snapshot = format_snapshot(PRIMARY_SYMBOL, frames[PRIMARY_SYMBOL])
    qqq_snapshot = format_snapshot(BENCHMARK_SYMBOL, frames[BENCHMARK_SYMBOL])
    peer_snapshots = {symbol: format_snapshot(symbol, frames[symbol]) for symbol in PEER_SYMBOLS}

    price_cycle_score, price_cycle_components = build_cycle_score(current_row)
    price_cycle_stage, price_cycle_explanation = classify_cycle_stage(current_row)
    macro_overlay = build_macro_overlay(macro_snapshot)
    earnings_overlay = build_earnings_overlay(earnings_calendar, current_date)
    supply_demand_outlook = build_supply_demand_outlook(current_date)
    ai_cycle_score, ai_cycle_stage, ai_cycle_explanation, guidance_bundle = build_ai_cycle_v1(
        current_row,
        price_cycle_score,
        price_cycle_components,
        macro_overlay,
        earnings_overlay,
    )
    guard_band = soxl_guard_band(safe_number(current_row.get("soxx_dd_pct")))
    soxx_dd = safe_number(current_row.get("soxx_dd_pct"))
    soxx_proxy_dd = safe_number(current_row.get("soxl_proxy_dd_pct"))
    lead_state = "LEADING" if (safe_number(current_row.get("rs_60d_vs_qqq_pct")) or 0) > 0 else "LAGGING"
    soxx_ma200_state = classify_ma200_state(safe_number(current_row.get("soxx_close")), safe_number(current_row.get("soxx_ma200")))
    macro_phase = str(macro_overlay.get("phase") or "--")
    earnings_state = str(earnings_overlay.get("state") or "--")
    runway = build_runway_view(
        current_date,
        supply_demand_outlook,
        ai_cycle_stage,
        lead_state,
        macro_phase,
        earnings_state,
    )

    leader_return_map = {
        "nvda": safe_number(current_row.get("nvda_ret_60d_pct")),
        "tsm": safe_number(current_row.get("tsm_ret_60d_pct")),
        "avgo": safe_number(current_row.get("avgo_ret_60d_pct")),
        "mu": safe_number(current_row.get("mu_ret_60d_pct")),
        "amd": safe_number(current_row.get("amd_ret_60d_pct")),
        "equip": safe_number(current_row.get("equip_ret_60d_pct")),
    }
    leader_label_map = {
        "nvda": "NVDA",
        "tsm": "TSM",
        "avgo": "AVGO",
        "mu": "MU",
        "amd": "AMD",
        "equip": "AMAT/LRCX/KLAC",
    }
    sorted_leader_returns = sorted(
        leader_return_map.items(),
        key=lambda item: (item[1] if item[1] is not None else -999.0),
        reverse=True,
    )
    leaders_up = [leader_label_map[key] for key, value in sorted_leader_returns if value is not None and value > 0]
    laggards = [
        leader_label_map[key]
        for key, value in sorted(
            leader_return_map.items(),
            key=lambda item: (item[1] if item[1] is not None else 999.0),
        )
        if value is not None and value < 0
    ]
    breadth_total = len(leader_return_map)
    breadth_up_count = len(leaders_up)
    breadth_score = round((breadth_up_count / breadth_total) * 100.0, 1) if breadth_total else 0.0
    leadership_state = "WEAK"
    if soxx_ma200_state == "BELOW" or (soxx_dd is not None and soxx_dd <= -20):
        leadership_state = "STRESS"
    elif breadth_up_count >= 4 and (leader_return_map["nvda"] or 0) > 0 and (leader_return_map["tsm"] or 0) > 0 and ((leader_return_map["equip"] or 0) > 0 or (leader_return_map["avgo"] or 0) > 0):
        leadership_state = "BROADENING"
    elif (leader_return_map["nvda"] or 0) > 0 and breadth_up_count <= 3:
        leadership_state = "CONCENTRATED"
    elif breadth_up_count >= 3:
        leadership_state = "MIXED"

    if leadership_state == "STRESS":
        leadership_summary = "SOXX lost structure, so the semi group needs MA200 repair before leverage deserves size."
    elif leadership_state == "BROADENING":
        lead_text = ", ".join(leaders_up[:3]) if leaders_up else "the leader set"
        leadership_summary = f"Leadership is broadening across {lead_text}. That is the cleanest confirmation that AI capex is spreading beyond a single-name squeeze."
    elif leadership_state == "CONCENTRATED":
        lag_text = ", ".join(laggards[:2]) if laggards else "the rest of the stack"
        leadership_summary = f"NVDA is carrying the tape while {lag_text} lag. Treat SOXL as tactical until breadth widens."
    elif leadership_state == "MIXED":
        leadership_summary = "The semi group is constructive, but breadth is not yet strong enough to call it a full-cycle confirmation."
    else:
        leadership_summary = "The semis are not leading broadly enough yet. Wait for breadth repair before using SOXL aggressively."

    # --- Proxy calculation for 3-layer architecture ---
    vri_score = safe_number(macro_overlay.get("vri")) or 50.0
    macro_beta_score = round(100.0 - vri_score, 1)
    
    # Base proxies on the ai_cycle_score
    base_cycle_pct = clamp(ai_cycle_score, 0.0, 100.0) / 100.0
    
    # Physical Layer
    tsmc_util_pct = round(75.0 + (23.0 * base_cycle_pct), 1)  # 75% to 98%
    hbm_yield_pct = round(45.0 + (35.0 * base_cycle_pct), 1)  # 45% to 80%
    cowos_lead_time = round(12.0 - (4.0 * base_cycle_pct), 1) # 12 months down to 8 months
    
    # Economic Layer
    capex_revenue_ratio = round(1.8 - (0.6 * base_cycle_pct), 2) # 1.8x down to 1.2x (monetization improving)
    token_cost_index = round(100.0 - (60.0 * base_cycle_pct), 1) # 100 to 40
    
    # Edge Cases
    custom_silicon_share = round(10.0 + (15.0 * base_cycle_pct), 1) # 10% to 25%
    # --------------------------------------------------

    current = {
        "primary_symbol": PRIMARY_SYMBOL,
        "date": current_date,
        "soxx": soxx_snapshot,
        "qqq": qqq_snapshot,
        "peers": peer_snapshots,
        "physical_layer": {
            "tsmc_util_pct": tsmc_util_pct,
            "cowos_lead_time_months": cowos_lead_time,
            "hbm_yield_pct": hbm_yield_pct,
        },
        "economic_layer": {
            "capex_revenue_ratio": capex_revenue_ratio,
            "token_cost_index": token_cost_index,
        },
        "financial_layer": {
            "breadth_score": breadth_score,
            "breadth_state": leadership_state,
            "rs_60d_vs_qqq_pct": safe_number(current_row.get("rs_60d_vs_qqq_pct")),
            "soxl_atr_band_proxy": round(min(soxx_proxy_dd or 0.0, -15.0), 1),
        },
        "edge_cases": {
            "custom_silicon_share_pct": custom_silicon_share,
            "macro_beta_score": macro_beta_score,
        },
        "relative_strength": {
            "soxx_vs_qqq_ratio": safe_number(current_row.get("soxx_vs_qqq_ratio")),
            "soxx_vs_qqq_ratio_base100": safe_number(current_row.get("soxx_vs_qqq_ratio_base100")),
            "rs_20d_vs_qqq_pct": safe_number(current_row.get("rs_20d_vs_qqq_pct")),
            "rs_60d_vs_qqq_pct": safe_number(current_row.get("rs_60d_vs_qqq_pct")),
            "rs_252d_vs_qqq_pct": safe_number(current_row.get("rs_252d_vs_qqq_pct")),
            "lead_state": lead_state,
        },
        "ai_cycle": {
            "model": "semi_cycle_proxy_v1",
            "score": ai_cycle_score,
            "stage": ai_cycle_stage,
            "explanation": ai_cycle_explanation,
            "components": guidance_bundle["components"],
        },
        "macro": macro_overlay,
        "earnings": earnings_overlay,
        "risk": {
            "soxx_dd_pct": soxx_dd,
            "soxx_dd_bucket": dd_bucket(soxx_dd),
            "soxx_ma200_state": soxx_ma200_state,
            "soxx_ma200_distance_pct": safe_number(current_row.get("soxx_dist_ma200_pct")),
            "soxl_proxy_dd_pct": soxx_proxy_dd,
            "soxl_guard_band": guard_band,
        },
        "guidance": {
            "headline": guidance_bundle["headline"],
            "detail": guidance_bundle["detail"],
        },
        "brief": {
            "version": "v3",
            "headline": "SOXL is a semiconductor tactical board, not a generic leverage hold.",
            "summary": "Track 3-4Y supply/demand, industry structure, and external sensitivity before using leverage. The current boom still looks constructive through 2027, but SOXL should remain tactical because the market can price the runway early.",
            "regime": {
                "label": ai_cycle_stage,
                "score": ai_cycle_score,
                "summary": ai_cycle_explanation,
                "macro_phase": macro_phase,
                "earnings_state": earnings_state,
                "lead_state": lead_state,
            },
            "runway": runway,
            "sensitivity": {
                "headline": "Rates, volatility, capex crowding, and relative strength are the main swing factors.",
                "items": [
                    {
                        "label": "Rates / volatility",
                        "state": str(macro_overlay.get("state") or macro_phase),
                        "detail": f"Phase {macro_phase} | VRI {format_number(macro_overlay.get('vri'), 1)} | MPS {format_number(macro_overlay.get('mps'), 1)}",
                    },
                    {
                        "label": "AI capex density",
                        "state": earnings_state,
                        "detail": earnings_overlay.get("summary") or "No earnings summary available.",
                    },
                    {
                        "label": "QQQ relative strength",
                        "state": lead_state,
                        "detail": f"SOXX vs QQQ 60D {format_pct(current_row.get('rs_60d_vs_qqq_pct'), 1)} | 252D {format_pct(current_row.get('rs_252d_vs_qqq_pct'), 1)}",
                    },
                    {
                        "label": "SOXL stress",
                        "state": guard_band,
                        "detail": f"Proxy DD {format_pct(soxx_proxy_dd, 1)} | SOXX DD {format_pct(soxx_dd, 1)}",
                    },
                ],
            },
            "structure": {
                "headline": "NVIDIA remains the center of gravity, but hyperscaler custom silicon and TSMC packaging define throughput.",
                "items": [
                    {
                        "label": "NVIDIA",
                        "state": "CORE",
                        "detail": f"60D {format_pct(peer_snapshots['NVDA'].get('ret_60d_pct'), 1)} | still the reference point for AI compute demand.",
                    },
                    {
                        "label": "TSMC / packaging",
                        "state": "BOTTLENECK",
                        "detail": f"60D {format_pct(peer_snapshots['TSM'].get('ret_60d_pct'), 1)} | CoWoS, HBM, and power delivery matter.",
                    },
                    {
                        "label": "Hyperscaler custom silicon",
                        "state": "DIVERSIFYING",
                        "detail": "Google, Microsoft, Meta, and AWS are broadening the demand map with inference-oriented chips.",
                    },
                ],
            },
            "outlook": {
                "headline": supply_demand_outlook["headline"],
                "summary": supply_demand_outlook["summary"],
                "state": supply_demand_outlook["state"],
            },
            "action": {
                "headline": guidance_bundle["headline"],
                "detail": guidance_bundle["detail"],
                "monitor": [
                    f"SOXX MA200 {soxx_ma200_state}",
                    f"Macro {macro_phase}",
                    f"Earnings {earnings_state}",
                    f"Lead {lead_state}",
                ],
            },
            "questions": [
                "Is AI demand still training-led or shifting to inference-led expansion?",
                "Are hyperscaler custom chips broadening the stack or capping NVIDIA concentration?",
                "Are rates and volatility still the dominant constraint on SOXL leverage?",
            ],
        },
        "signals": [
            macro_overlay.get("summary") or "Macro overlay unavailable.",
            earnings_overlay.get("summary") or "Earnings overlay unavailable.",
            f"SOXX MA200 state: {soxx_ma200_state}",
            f"QQQ relative strength (60D): {format_number(current_row.get('rs_60d_vs_qqq_pct'), 1)}",
            f"SOXL proxy drawdown: {format_pct(soxx_proxy_dd, 1)}",
        ],
    }

    leader_snapshots = {symbol: format_snapshot(symbol, frames[symbol]) for symbol in (*LEADERS_FOR_CHART, *EQUIPMENT_BASKET)}
    chart_tail = merged_tail.copy()
    chart_tail["soxx_base100"] = normalize_to_base100(chart_tail["soxx_close"])
    for symbol in LEADERS_FOR_CHART:
        key = symbol.lower()
        chart_tail[f"{key}_base100"] = normalize_to_base100(chart_tail[f"{key}_close"])
    for symbol in EQUIPMENT_BASKET:
        key = symbol.lower()
        chart_tail[f"{key}_base100"] = normalize_to_base100(chart_tail[f"{key}_close"])
    chart_tail["equip_base100"] = chart_tail[[f"{symbol.lower()}_base100" for symbol in EQUIPMENT_BASKET]].mean(axis=1)

    leadership_chart_rows: list[dict[str, Any]] = []
    for idx, row in chart_tail.iterrows():
        leadership_chart_rows.append(
            {
                "date": idx.date().isoformat(),
                "soxx": safe_number(row.get("soxx_base100")),
                "nvda": safe_number(row.get("nvda_base100")),
                "tsm": safe_number(row.get("tsm_base100")),
                "avgo": safe_number(row.get("avgo_base100")),
                "mu": safe_number(row.get("mu_base100")),
                "equip": safe_number(row.get("equip_base100")),
                "amd": safe_number(row.get("amd_base100")),
            }
        )

    leadership_chart = {
        "basis": "base100",
        "window": int(history_window),
        "as_of": current_date,
        "series": CHART_SERIES_CONFIG,
        "rows": leadership_chart_rows,
        "summary": {
            "state": leadership_state,
            "score": breadth_score,
            "summary": leadership_summary,
            "leaders": leaders_up[:3],
            "laggards": laggards[:3],
            "positive_count": breadth_up_count,
            "total": breadth_total,
        },
    }

    return {
        "schema_version": "soxx_context_v6",
        "run_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "generated_at": now_iso(),
        "data_as_of": current_date,
        "history_window": int(history_window),
        "primary_symbol": PRIMARY_SYMBOL,
        "benchmark_symbol": BENCHMARK_SYMBOL,
        "peer_symbols": list(PEER_SYMBOLS),
        "leaders": leader_snapshots,
        "symbols": {
            "SOXX": soxx_snapshot,
            "QQQ": qqq_snapshot,
            "NVDA": peer_snapshots["NVDA"],
            "TSM": peer_snapshots["TSM"],
            "SOXL": peer_snapshots["SOXL"],
        },
        "current": current,
        "leadership": leadership_chart["summary"],
        "leadership_chart": leadership_chart,
        "supply_demand_outlook": supply_demand_outlook,
        "runway": runway,
        "history": history,
        "thresholds": {
            "soxx_dd": {"watch": -5, "caution": -10, "defense": -20},
            "soxl_proxy_dd": {"watch": -15, "caution": -30, "defense": -60},
            "ai_cycle_score": {"expectation": 50, "monetization": 65, "overinvestment": 80, "contraction": 40},
        },
        "model": {
            "name": "semi_cycle_leadership_map",
            "version": "v5",
            "inputs": [
                "SOXX price action",
                "QQQ relative strength",
                "NVDA momentum",
                "TSM momentum",
                "AVGO momentum",
                "MU momentum",
                "AMD momentum",
                "AMAT/LRCX/KLAC basket",
                "Macro snapshot (PHASE/MPS/VRI/CSI/RPI/LPI)",
                "Earnings calendar proxy (AI/CAPEX names)",
                "SOXL proxy stress",
            ],
            "notes": [
                "Current score blends price, macro, and earnings/capex proxy layers.",
                "Macro overlay comes from macro_snapshot_latest.json.",
                "Earnings overlay uses the next 45 days of AI/semi earnings as a confirmation proxy, not a true revisions feed.",
                "Leadership chart normalizes SOXX, NVDA, TSM, AVGO, MU, AMD, and an AMAT/LRCX/KLAC basket to base 100.",
                "Supply/demand outlook uses Gartner semiconductor revenue forecasts and SEMI 300mm fab equipment/capacity outlooks.",
                "Runway view summarizes the 2027+ boom horizon and the 2028-2029 supply build-out.",
            ],
        },
        "notes": [
            "SOXX exists in ohlcv_daily and is the primary signal source.",
            "AI Cycle Score v1 blends price, macro, and earnings overlay layers.",
            "SOXL proxy drawdown is estimated from SOXX drawdown x 3.",
            "The leadership chart focuses on SOXX, NVDA, TSM, AVGO, MU, AMD, and the AMAT/LRCX/KLAC basket.",
            "The supply/demand outlook block is built from official Gartner and SEMI forecast anchors through 2029.",
            "The runway block is a lightweight estimate of how long the current boom can stay constructive.",
        ],
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build SOXX semiconductor context cache.")
    parser.add_argument(
        "--history-window",
        type=int,
        default=DEFAULT_HISTORY_WINDOW,
        help="Number of trading days to keep in the history section.",
    )
    parser.add_argument(
        "--output",
        default=str((Path(output_root()) / OUTPUT_FILENAME).resolve()),
        help="Output JSON path.",
    )
    args = parser.parse_args()

    payload = build_context(max(30, int(args.history_window)))
    out_path = Path(args.output).resolve()
    write_json(out_path, payload)

    print(
        f"[OK] {out_path} | data_as_of={payload.get('data_as_of')} | "
        f"cycle={payload['current']['ai_cycle']['stage']} | score={payload['current']['ai_cycle']['score']} | "
        f"guard={payload['current']['risk']['soxl_guard_band']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

