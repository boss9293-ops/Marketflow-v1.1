from __future__ import annotations

import math
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from services.options_summary_builder import build_options_summary
from services.stock_analysis_engine import run_stock_analysis


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = _BACKEND_DIR / "scripts"
if os.fspath(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, os.fspath(_SCRIPTS_DIR))

from fetch_options_daily import (  # type: ignore
    apply_options_mode,
    fetch_options_payload,
    load_options_cache,
    normalize_mode,
    normalize_ticker,
)


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


def _round_value(value: Any, digits: int = 2) -> Optional[float]:
    number = _finite_number(value)
    if number is None:
        return None
    rounded = round(number, digits)
    if float(rounded).is_integer():
        return float(int(rounded))
    return rounded


def _safe_get(mapping: Any, key: str, default: Any = None) -> Any:
    return mapping.get(key, default) if isinstance(mapping, dict) else default


def _pct(value: Any) -> Optional[float]:
    number = _finite_number(value)
    if number is None:
        return None
    return _round_value(number * 100, 2)


def _relation_to_level(price: Optional[float], level: Optional[float], tolerance_pct: float = 1.0) -> str:
    if price is None or level is None or price <= 0:
        return "unknown"
    delta_pct = ((price - level) / price) * 100
    if abs(delta_pct) <= tolerance_pct:
        return "near"
    return "above" if price > level else "below"


def _valuation_summary(analysis: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not analysis:
        return None
    valuation = _safe_get(analysis, "valuation", {})
    consensus = _safe_get(analysis, "consensus", {})
    return {
        "current_price": _round_value(_safe_get(analysis, "current_price"), 2),
        "current_pe": _round_value(_safe_get(analysis, "current_pe"), 2),
        "sector_pe": _round_value(_safe_get(analysis, "sector_pe"), 2),
        "valuation_state": _safe_get(analysis, "valuation_state"),
        "scenario": _safe_get(analysis, "scenario"),
        "market_cap": _round_value(_safe_get(valuation, "market_cap"), 0),
        "eps_ttm": _round_value(_safe_get(valuation, "eps_ttm"), 2),
        "eps_forward": _round_value(_safe_get(valuation, "eps_forward"), 2),
        "target_mean": _round_value(_safe_get(consensus, "target_mean"), 2),
        "target_high": _round_value(_safe_get(consensus, "target_high"), 2),
        "target_low": _round_value(_safe_get(consensus, "target_low"), 2),
        "analyst_count": _safe_get(consensus, "analyst_count") or _safe_get(consensus, "target_analyst_count"),
        "confidence": _safe_get(analysis, "confidence"),
    }


def _financial_summary(analysis: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not analysis:
        return None
    stats = _safe_get(analysis, "stats", {})
    valuation = _safe_get(analysis, "valuation", {})
    return {
        "revenue": _round_value(_safe_get(stats, "revenue"), 0),
        "gross_margin_percent": _pct(_safe_get(valuation, "gross_margin")),
        "operating_margin_percent": _pct(_safe_get(valuation, "operating_margin")),
        "net_margin_percent": _pct(_safe_get(valuation, "net_margin")),
        "revenue_growth_percent": _pct(_safe_get(valuation, "revenue_growth")),
        "roe_percent": _pct(_safe_get(stats, "roe")),
        "roa_percent": _pct(_safe_get(stats, "roa")),
        "roic_percent": _pct(_safe_get(stats, "roic")),
        "debt_to_equity": _round_value(_safe_get(valuation, "debt_to_equity"), 2),
        "current_ratio": _round_value(_safe_get(valuation, "current_ratio"), 2),
        "cash": _round_value(_safe_get(stats, "cash"), 0),
        "total_debt": _round_value(_safe_get(stats, "total_debt"), 0),
        "net_debt": _round_value(_safe_get(stats, "net_debt"), 0),
        "income_period": _safe_get(stats, "income_period"),
    }


def _technical_summary(analysis: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not analysis:
        return None
    valuation = _safe_get(analysis, "valuation", {})
    price = _finite_number(_safe_get(analysis, "current_price"))
    sma50 = _finite_number(_safe_get(valuation, "sma50"))
    sma200 = _finite_number(_safe_get(valuation, "sma200"))
    trend = "unknown"
    if price is not None and sma50 is not None and sma200 is not None:
        if price > sma50 > sma200:
            trend = "above key moving averages"
        elif price < sma50 < sma200:
            trend = "below key moving averages"
        else:
            trend = "mixed moving-average posture"

    return {
        "current_price": _round_value(price, 2),
        "trend_state": trend,
        "price_vs_sma50": _relation_to_level(price, sma50, tolerance_pct=0.5),
        "price_vs_sma200": _relation_to_level(price, sma200, tolerance_pct=0.5),
        "sma20": _round_value(_safe_get(valuation, "sma20"), 2),
        "sma50": _round_value(sma50, 2),
        "sma200": _round_value(sma200, 2),
        "rsi14": _round_value(_safe_get(valuation, "rsi14"), 1),
        "vol20": _round_value(_safe_get(valuation, "vol20"), 0),
        "performance": {
            "1w_percent": _pct(_safe_get(valuation, "perf_1w")),
            "1m_percent": _pct(_safe_get(valuation, "perf_1m")),
            "3m_percent": _pct(_safe_get(valuation, "perf_3m")),
            "6m_percent": _pct(_safe_get(valuation, "perf_6m")),
            "1y_percent": _pct(_safe_get(valuation, "perf_1y")),
            "ytd_percent": _pct(_safe_get(valuation, "perf_ytd")),
        },
        "price_range": {
            "high_1y": _round_value(_safe_get(valuation, "price_high_1y"), 2),
            "low_1y": _round_value(_safe_get(valuation, "price_low_1y"), 2),
        },
    }


def _load_options_summary(ticker: str, mode: str, warnings: List[str]) -> Optional[Dict[str, Any]]:
    payload = load_options_cache(ticker)
    if payload is None:
        try:
            payload = fetch_options_payload(ticker, max_expiries=1, write_cache=True)
        except Exception as exc:
            warnings.append(f"options_unavailable: {exc}")
            return None

    try:
        normalized_payload = apply_options_mode(payload, mode)
        return build_options_summary(normalized_payload)
    except Exception as exc:
        warnings.append(f"options_summary_failed: {exc}")
        return None


def _missing_data_warnings(
    valuation_summary: Optional[Dict[str, Any]],
    financial_summary: Optional[Dict[str, Any]],
    technical_summary: Optional[Dict[str, Any]],
    options_summary: Optional[Dict[str, Any]],
) -> List[str]:
    warnings: List[str] = []
    if not valuation_summary:
        warnings.append("valuation_summary_missing")
    if not financial_summary:
        warnings.append("financial_summary_missing")
    if not technical_summary:
        warnings.append("technical_summary_missing")
    if not options_summary:
        warnings.append("options_summary_missing")
    return warnings


def _data_quality(warnings: List[str]) -> str:
    if not warnings:
        return "complete"
    if len(warnings) <= 2:
        return "partial"
    return "limited"


def _build_key_questions(
    valuation_summary: Optional[Dict[str, Any]],
    financial_summary: Optional[Dict[str, Any]],
    technical_summary: Optional[Dict[str, Any]],
    options_summary: Optional[Dict[str, Any]],
) -> List[str]:
    questions = [
        "Does current valuation align with growth and margin quality?",
        "Are technical conditions confirming or diverging from the fundamental setup?",
    ]
    if options_summary:
        questions.append("Does options positioning confirm the equity market setup into the selected expiration?")
    if financial_summary and financial_summary.get("debt_to_equity") is not None:
        questions.append("Is balance-sheet leverage material to the risk profile?")
    return questions[:5]


def _build_risk_flags(
    valuation_summary: Optional[Dict[str, Any]],
    financial_summary: Optional[Dict[str, Any]],
    technical_summary: Optional[Dict[str, Any]],
    options_summary: Optional[Dict[str, Any]],
) -> List[str]:
    flags: List[str] = []
    if valuation_summary:
        state = _safe_get(valuation_summary, "valuation_state")
        label = str(_safe_get(state, "label", "")).lower() if isinstance(state, dict) else ""
        if label == "premium":
            flags.append("valuation_premium")
    if financial_summary:
        debt_to_equity = _finite_number(financial_summary.get("debt_to_equity"))
        if debt_to_equity is not None and debt_to_equity > 2:
            flags.append("elevated_leverage")
    if technical_summary and technical_summary.get("price_vs_sma200") == "below":
        flags.append("below_200d_average")
    if options_summary:
        summary = _safe_get(options_summary, "summary", {})
        if _safe_get(summary, "positioning_bias") == "put-heavy":
            flags.append("put_heavy_options_skew")
    return flags


def _one_line_context(
    ticker: str,
    analysis: Optional[Dict[str, Any]],
    valuation_summary: Optional[Dict[str, Any]],
    options_summary: Optional[Dict[str, Any]],
) -> str:
    name = _safe_get(analysis, "name", ticker) if analysis else ticker
    sector = _safe_get(analysis, "sector", "Unknown") if analysis else "Unknown"
    price = _safe_get(valuation_summary, "current_price") if valuation_summary else None
    options_tone = _safe_get(_safe_get(options_summary, "summary", {}), "market_tone") if options_summary else None
    price_text = f" at ${price}" if price is not None else ""
    tone_text = f"; options tone is {options_tone}" if options_tone else ""
    return f"{ticker} ({name}) is a {sector} name{price_text}{tone_text}."


def build_stock_ai_context(ticker: str, *, mode: str = "near") -> Dict[str, Any]:
    symbol = normalize_ticker(ticker)
    selected_mode = normalize_mode(mode)
    warnings: List[str] = []

    analysis: Optional[Dict[str, Any]] = None
    try:
        analysis = run_stock_analysis(symbol, mode="auto")
    except Exception as exc:
        warnings.append(f"stock_analysis_unavailable: {exc}")

    valuation_summary = _valuation_summary(analysis)
    financial_summary = _financial_summary(analysis)
    technical_summary = _technical_summary(analysis)
    options_summary = _load_options_summary(symbol, selected_mode, warnings)
    peer_summary = None

    warnings.extend(
        _missing_data_warnings(
            valuation_summary,
            financial_summary,
            technical_summary,
            options_summary,
        )
    )
    warnings = list(dict.fromkeys(warnings))

    key_questions = _build_key_questions(
        valuation_summary,
        financial_summary,
        technical_summary,
        options_summary,
    )
    risk_flags = _build_risk_flags(
        valuation_summary,
        financial_summary,
        technical_summary,
        options_summary,
    )

    return {
        "ticker": symbol,
        "as_of": date.today().isoformat(),
        "source": {
            "stock_analysis": "stock_analysis_engine",
            "options": "yfinance_cache",
        },
        "valuation_summary": valuation_summary,
        "financial_summary": financial_summary,
        "technical_summary": technical_summary,
        "options_summary": options_summary,
        "peer_summary": peer_summary,
        "peer_summary_placeholder": True,
        "missing_data_warnings": warnings,
        "ai_research_context": {
            "one_line_context": _one_line_context(symbol, analysis, valuation_summary, options_summary),
            "key_questions": key_questions,
            "risk_flags": risk_flags,
            "data_quality": _data_quality(warnings),
        },
    }
