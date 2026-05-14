from __future__ import annotations

import math
from typing import Any, Dict, Optional


PROHIBITED_TERMS = ("buy", "sell", "enter", "short", "strong long")


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


def _money(value: Any) -> str:
    number = _finite_number(value)
    if number is None:
        return "n/a"
    return f"${number:,.0f}" if float(number).is_integer() else f"${number:,.2f}"


def _range_text(expected_range: Optional[Dict[str, Any]]) -> str:
    if not expected_range:
        return "n/a"
    lower = expected_range.get("lower")
    upper = expected_range.get("upper")
    if _finite_number(lower) is None or _finite_number(upper) is None:
        return "n/a"
    return f"{_money(lower)} to {_money(upper)}"


def _distance_pct(level: Optional[float], spot: Optional[float]) -> Optional[float]:
    if level is None or spot is None or spot <= 0:
        return None
    return _round_value(((level - spot) / spot) * 100, 2)


def classify_positioning_bias(put_call_ratio: Optional[float]) -> str:
    if put_call_ratio is None:
        return "unavailable"
    if put_call_ratio < 0.7:
        return "call-heavy"
    if put_call_ratio <= 1.2:
        return "balanced"
    return "put-heavy"


def classify_spot_vs_max_pain(spot: Optional[float], max_pain: Optional[float]) -> str:
    if spot is None or max_pain is None or spot <= 0:
        return "unknown"
    if abs(spot - max_pain) / spot <= 0.01:
        return "near"
    return "above" if spot > max_pain else "below"


def classify_market_tone(
    positioning_bias: str,
    spot_vs_max_pain: str,
    spot: Optional[float],
    call_wall: Optional[float],
    put_wall: Optional[float],
    expected_move_percent: Optional[float],
) -> str:
    call_distance = _distance_pct(call_wall, spot)
    put_distance = _distance_pct(put_wall, spot)
    wide_move = expected_move_percent is not None and expected_move_percent >= 5

    if positioning_bias == "call-heavy":
        if call_distance is not None and call_distance > 0:
            return "moderately bullish"
        if spot_vs_max_pain in {"above", "near"}:
            return "constructive but capped"
        return "constructive"

    if positioning_bias == "put-heavy":
        if put_distance is not None and abs(put_distance) <= 2:
            return "defensive"
        if spot_vs_max_pain == "below":
            return "defensive"
        return "risk-skewed"

    if positioning_bias == "balanced":
        return "neutral with wider expected range" if wide_move else "neutral"

    return "insufficient data"


def build_options_interpretation(summary: Dict[str, Any]) -> str:
    call_wall = summary.get("call_wall")
    put_wall = summary.get("put_wall")
    expected_range = summary.get("expected_range")
    spot = summary.get("current_price")
    max_pain = summary.get("max_pain")
    spot_vs_max_pain = summary.get("spot_vs_max_pain")

    lines = []
    if _finite_number(call_wall) is not None and _finite_number(spot) is not None:
        if call_wall >= spot:
            lines.append("Options positioning remains concentrated above the current spot price.")
        else:
            lines.append("Options positioning is clustered below the current spot price.")
    elif _finite_number(max_pain) is not None and spot_vs_max_pain != "unknown":
        lines.append(f"Spot is {spot_vs_max_pain} max pain into this expiration cycle.")

    if _finite_number(call_wall) is not None and _finite_number(put_wall) is not None:
        lines.append(
            f"Call open interest is largest near {_money(call_wall)} while put positioning is clustered near {_money(put_wall)}."
        )
    elif _finite_number(call_wall) is not None:
        lines.append(f"Call open interest is largest near {_money(call_wall)}.")
    elif _finite_number(put_wall) is not None:
        lines.append(f"Put positioning is clustered near {_money(put_wall)}.")

    if expected_range and _range_text(expected_range) != "n/a":
        lines.append(
            f"The current implied move suggests the market is pricing a range of approximately {_range_text(expected_range)} into expiration."
        )

    if not lines:
        return "Options data is limited for this ticker or expiration."

    return " ".join(lines)


def _risk_comment(summary: Dict[str, Any]) -> str:
    spot = _finite_number(summary.get("current_price"))
    call_wall = _finite_number(summary.get("call_wall"))
    put_wall = _finite_number(summary.get("put_wall"))
    bias = str(summary.get("positioning_bias") or "")

    if spot is not None and call_wall is not None and call_wall > spot:
        return "Options positioning remains concentrated above spot."
    if spot is not None and put_wall is not None and put_wall < spot:
        return "Downside positioning remains visible below spot."
    if bias == "put-heavy":
        return "Options positioning shows a defensive risk skew."
    if bias == "call-heavy":
        return "Options positioning shows a call-side skew."
    return "Options positioning appears balanced across the selected chain."


def build_llm_options_context(options_summary: Dict[str, Any]) -> str:
    summary = options_summary.get("summary") if isinstance(options_summary.get("summary"), dict) else {}
    expected_range = summary.get("expected_range") if isinstance(summary.get("expected_range"), dict) else None
    expected_move_percent = summary.get("expected_move_percent")
    expected_move_text = "n/a" if expected_move_percent is None else f"{expected_move_percent}%"

    lines = [
        f"Ticker: {options_summary.get('ticker') or 'n/a'}",
        f"Expiry: {options_summary.get('expiry') or 'n/a'}",
        f"Mode: {options_summary.get('mode') or 'n/a'}",
        f"Market Tone: {summary.get('market_tone') or 'n/a'}",
        f"Positioning Bias: {summary.get('positioning_bias') or 'n/a'}",
        f"Call Wall: {_money(summary.get('call_wall'))}",
        f"Put Wall: {_money(summary.get('put_wall'))}",
        f"Max Pain: {_money(summary.get('max_pain'))}",
        f"Put/Call Ratio: {summary.get('put_call_ratio') if summary.get('put_call_ratio') is not None else 'n/a'}",
        f"Expected Move: {expected_move_text}",
        f"Expected Range: {_range_text(expected_range)}",
        "Interpretation:",
        str(summary.get("interpretation") or "n/a"),
    ]
    return "\n".join(lines)


def _sanitize_ai_text(value: str) -> str:
    # Guard the adapter output against directive-like trading language.
    sanitized = value
    replacements = {
        "buy": "call-side demand",
        "sell": "supply-side pressure",
        "enter": "begin",
        "short": "near-term",
        "strong long": "directional",
    }
    for term, replacement in replacements.items():
        sanitized = sanitized.replace(term, replacement)
        sanitized = sanitized.replace(term.title(), replacement.title())
    return sanitized


def build_options_summary(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    expiries = payload.get("expiries")
    if not isinstance(expiries, list) or not expiries:
        return None

    expiry_payload = next((item for item in expiries if isinstance(item, dict)), None)
    if not expiry_payload:
        return None

    current_price = _finite_number(payload.get("current_price"))
    put_call_ratio = _round_value(expiry_payload.get("put_call_ratio_oi"), 4)
    max_pain = _round_value(expiry_payload.get("max_pain"), 2)
    call_wall = _round_value(expiry_payload.get("call_wall"), 2)
    put_wall = _round_value(expiry_payload.get("put_wall"), 2)
    expected_move = expiry_payload.get("expected_move") if isinstance(expiry_payload.get("expected_move"), dict) else {}
    expected_amount = _finite_number(expected_move.get("amount"))
    expected_move_percent = (
        _round_value((expected_amount / current_price) * 100, 2)
        if expected_amount is not None and current_price is not None and current_price > 0
        else None
    )
    expected_range = {
        "lower": _round_value(expected_move.get("lower"), 2),
        "upper": _round_value(expected_move.get("upper"), 2),
    }

    positioning_bias = classify_positioning_bias(put_call_ratio)
    spot_vs_max_pain = classify_spot_vs_max_pain(current_price, max_pain)
    summary = {
        "positioning_bias": positioning_bias,
        "market_tone": classify_market_tone(
            positioning_bias,
            spot_vs_max_pain,
            current_price,
            call_wall,
            put_wall,
            expected_move_percent,
        ),
        "current_price": _round_value(current_price, 2),
        "call_wall": call_wall,
        "put_wall": put_wall,
        "max_pain": max_pain,
        "put_call_ratio": put_call_ratio,
        "expected_move_percent": expected_move_percent,
        "expected_range": expected_range,
        "spot_vs_max_pain": spot_vs_max_pain,
        "largest_call_cluster": call_wall,
        "largest_put_cluster": put_wall,
        "call_wall_distance_percent": _distance_pct(call_wall, current_price),
        "put_wall_distance_percent": _distance_pct(put_wall, current_price),
    }
    summary["risk_comment"] = _risk_comment(summary)
    summary["interpretation"] = build_options_interpretation(summary)
    summary["risk_comment"] = _sanitize_ai_text(str(summary["risk_comment"]))
    summary["interpretation"] = _sanitize_ai_text(str(summary["interpretation"]))

    options_summary = {
        "ticker": payload.get("ticker"),
        "expiry": expiry_payload.get("expiry"),
        "as_of": payload.get("as_of"),
        "mode": payload.get("mode") or expiry_payload.get("mode"),
        "source": payload.get("source"),
        "summary": summary,
    }
    options_summary["llm_context"] = _sanitize_ai_text(build_llm_options_context(options_summary))
    return options_summary
