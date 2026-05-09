# -*- coding: utf-8 -*-
"""
SOXX holding-weighted contribution history generator.

The generator uses:
  official SOXX holdings snapshot
  local SQLite OHLCV history
  holding-level daily returns
  bucket / selected / residual aggregation

Missing ticker returns are reported per date and are not converted to zero.
"""
from __future__ import annotations

import json
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from db_utils import resolve_marketflow_db
    from services.data_contract import output_root
except Exception:
    BACKEND_DIR_FALLBACK = Path(__file__).resolve().parents[1]

    def resolve_marketflow_db(*_args: Any, **_kwargs: Any) -> str:
        return str((BACKEND_DIR_FALLBACK.parent / "data" / "marketflow.db").resolve())

    def output_root() -> Path:
        return (BACKEND_DIR_FALLBACK / "output").resolve()


BACKEND_DIR = Path(__file__).resolve().parents[1]

DATA_VERSION = "soxx_contribution_history_v2"
PERIOD = "1D"

DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS = 60
MIN_SOXX_CONTRIBUTION_HISTORY_DAYS = 20
MAX_SOXX_CONTRIBUTION_HISTORY_DAYS = 252
PRICE_LOOKBACK_BUFFER_ROWS = 40
SOXX_RETURN_DIFF_WARNING_THRESHOLD_PCT_POINT = 1.0

SELECTED_BUCKET_IDS = (
    "ai_compute",
    "memory",
    "equipment",
    "foundry_packaging",
)

BUCKET_LABELS = {
    "ai_compute": "AI Compute",
    "memory": "Memory / HBM",
    "equipment": "Equipment",
    "foundry_packaging": "Foundry / Packaging",
    "residual": "Other SOXX / Residual",
}

BUCKET_ORDER = (*SELECTED_BUCKET_IDS, "residual")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def round_value(value: float | None, digits: int = 5) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)


def normalize_days(days: int | None) -> int:
    if days is None:
        return DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS
    return max(
        MIN_SOXX_CONTRIBUTION_HISTORY_DAYS,
        min(MAX_SOXX_CONTRIBUTION_HISTORY_DAYS, int(days)),
    )


def holdings_path() -> Path:
    return BACKEND_DIR / "data" / "semiconductor" / "soxx_holdings_snapshot.json"


def contribution_history_output_path() -> Path:
    return output_root() / "semiconductor" / "soxx_contribution_history.json"


def load_holdings() -> dict[str, Any]:
    path = holdings_path()
    if not path.exists():
        raise FileNotFoundError(f"SOXX holdings snapshot not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_reference_dates(conn: sqlite3.Connection, days: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT date
        FROM ohlcv_daily
        WHERE symbol = 'SOXX'
          AND COALESCE(adj_close, close) IS NOT NULL
        ORDER BY date DESC
        LIMIT ?
        """,
        (days + 1,),
    ).fetchall()
    return sorted(str(row[0]) for row in rows)


def load_price_rows(
    conn: sqlite3.Connection,
    ticker: str,
    row_limit: int,
) -> list[tuple[str, float]]:
    rows = conn.execute(
        """
        SELECT date, COALESCE(adj_close, close) AS px
        FROM ohlcv_daily
        WHERE symbol = ?
          AND COALESCE(adj_close, close) IS NOT NULL
        ORDER BY date DESC
        LIMIT ?
        """,
        (ticker, row_limit),
    ).fetchall()

    clean: list[tuple[str, float]] = []
    for date, px in rows:
        try:
            price = float(px)
        except Exception:
            continue
        if price > 0:
            clean.append((str(date), price))
    return sorted(clean, key=lambda item: item[0])


def price_on_date(rows: list[tuple[str, float]], target_date: str) -> float | None:
    for row_date, price in rows:
        if row_date == target_date:
            return price
        if row_date > target_date:
            break
    return None


def previous_price_before(rows: list[tuple[str, float]], target_date: str) -> float | None:
    candidate: float | None = None
    for row_date, price in rows:
        if row_date < target_date:
            candidate = price
        else:
            break
    return candidate


def daily_return_pct(rows: list[tuple[str, float]], target_date: str) -> float | None:
    current = price_on_date(rows, target_date)
    previous = previous_price_before(rows, target_date)
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    return (current / previous - 1.0) * 100.0


def init_bucket_accumulator() -> dict[str, dict[str, Any]]:
    return {
        bucket_id: {
            "contributionPctPoint": 0.0,
            "totalWeightPct": 0.0,
            "availableWeightPct": 0.0,
            "weightedReturnNumerator": 0.0,
            "availableTickerCount": 0,
            "totalTickerCount": 0,
            "missingTickers": [],
        }
        for bucket_id in BUCKET_ORDER
    }


def bucket_status(available_count: int, total_count: int) -> str:
    if total_count <= 0 or available_count <= 0:
        return "unavailable"
    if available_count < total_count:
        return "partial"
    return "available"


def build_snapshot(
    date: str,
    holdings: list[dict[str, Any]],
    prices_by_ticker: dict[str, list[tuple[str, float]]],
    soxx_return_pct: float | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    buckets = init_bucket_accumulator()
    missing_tickers: list[str] = []
    available_ticker_count = 0
    total_ticker_count = 0

    for holding in holdings:
        ticker = str(holding.get("ticker") or "").strip().upper()
        if not ticker:
            continue

        weight_pct = float(holding.get("weightPct") or 0.0)
        bucket_id = holding.get("bucketId")
        bucket_key = bucket_id if bucket_id in SELECTED_BUCKET_IDS else "residual"

        bucket = buckets[bucket_key]
        bucket["totalWeightPct"] = float(bucket["totalWeightPct"]) + weight_pct
        bucket["totalTickerCount"] = int(bucket["totalTickerCount"]) + 1
        total_ticker_count += 1

        return_pct = daily_return_pct(prices_by_ticker.get(ticker, []), date)
        if return_pct is None:
            missing_tickers.append(ticker)
            bucket["missingTickers"].append(ticker)
            continue

        available_ticker_count += 1
        bucket["availableTickerCount"] = int(bucket["availableTickerCount"]) + 1
        bucket["availableWeightPct"] = float(bucket["availableWeightPct"]) + weight_pct
        bucket["weightedReturnNumerator"] = float(bucket["weightedReturnNumerator"]) + weight_pct * return_pct
        bucket["contributionPctPoint"] = (
            float(bucket["contributionPctPoint"]) + weight_pct * return_pct / 100.0
        )

    bucket_points: list[dict[str, Any]] = []
    for bucket_id in BUCKET_ORDER:
        bucket = buckets[bucket_id]
        available_count = int(bucket["availableTickerCount"])
        total_count = int(bucket["totalTickerCount"])
        status = bucket_status(available_count, total_count)
        available_weight = float(bucket["availableWeightPct"])
        contribution = (
            float(bucket["contributionPctPoint"])
            if available_count > 0
            else None
        )
        return_pct = (
            float(bucket["weightedReturnNumerator"]) / available_weight
            if available_weight > 0
            else None
        )

        bucket_points.append({
            "date": date,
            "bucketId": bucket_id,
            "bucketName": BUCKET_LABELS[bucket_id],
            "contributionPctPoint": round_value(contribution),
            "returnPct": round_value(return_pct),
            "weightPct": round_value(float(bucket["totalWeightPct"])) or 0.0,
            "availableTickerCount": available_count,
            "totalTickerCount": total_count,
            "missingTickers": sorted(bucket["missingTickers"]),
            "status": status,
            # Legacy fields consumed by the current mini chart model.
            "period": PERIOD,
            "label": BUCKET_LABELS[bucket_id],
            "bucketContributionPctPoint": round_value(contribution),
            "bucketWeightPct": round_value(float(bucket["totalWeightPct"])) or 0.0,
            "bucketWeightedReturnPct": round_value(return_pct),
            "holdingsCount": total_count,
        })

    selected_values = [
        point["contributionPctPoint"]
        for point in bucket_points
        if point["bucketId"] in SELECTED_BUCKET_IDS and point["contributionPctPoint"] is not None
    ]
    residual_point = next((point for point in bucket_points if point["bucketId"] == "residual"), None)
    residual_contribution = (
        residual_point["contributionPctPoint"]
        if residual_point and residual_point["contributionPctPoint"] is not None
        else None
    )
    selected_contribution = round_value(sum(float(value) for value in selected_values)) if selected_values else None
    total_contribution = (
        round_value((selected_contribution or 0.0) + (residual_contribution or 0.0))
        if selected_contribution is not None or residual_contribution is not None
        else None
    )

    status = bucket_status(available_ticker_count, total_ticker_count)
    selected_weight = sum(
        float(point["weightPct"])
        for point in bucket_points
        if point["bucketId"] in SELECTED_BUCKET_IDS
    )
    residual_weight = float(residual_point["weightPct"]) if residual_point else 0.0

    history_point = {
        "date": date,
        "selectedContributionPctPoint": selected_contribution,
        "residualContributionPctPoint": residual_contribution,
        "totalContributionPctPoint": total_contribution,
        "soxxReturnPct": round_value(soxx_return_pct),
        "availableTickerCount": available_ticker_count,
        "totalTickerCount": total_ticker_count,
        "missingTickers": sorted(missing_tickers),
        "status": status,
    }

    # Legacy snapshot shape retained for existing frontend chart wiring.
    legacy_snapshot = {
        "date": date,
        "period": PERIOD,
        "selectedTotalPctPoint": selected_contribution,
        "residualPctPoint": residual_contribution,
        "totalContributionPctPoint": total_contribution,
        "soxxReturnPct": round_value(soxx_return_pct),
        "selectedWeightPct": round_value(selected_weight),
        "residualWeightPct": round_value(residual_weight),
        "availableTickerCount": available_ticker_count,
        "totalTickerCount": total_ticker_count,
        "missingTickers": sorted(missing_tickers),
        "status": status,
        "points": bucket_points,
        "warnings": (
            [f"Missing ticker returns: {', '.join(sorted(missing_tickers))}."]
            if missing_tickers
            else []
        ),
    }

    return {**history_point, "_legacySnapshot": legacy_snapshot}, bucket_points


def build_warnings(
    history: list[dict[str, Any]],
    days_requested: int,
    alignment_warning_dates: list[str],
) -> list[str]:
    warnings: list[str] = []

    if len(history) < MIN_SOXX_CONTRIBUTION_HISTORY_DAYS:
        warnings.append(
            f"Only {len(history)} contribution history records are available; "
            f"minimum target is {MIN_SOXX_CONTRIBUTION_HISTORY_DAYS}."
        )
    elif len(history) < days_requested:
        warnings.append(
            f"Only {len(history)} contribution history records are available for "
            f"{days_requested} requested trading days."
        )

    partial_rows = [row for row in history if row["status"] == "partial"]
    unavailable_rows = [row for row in history if row["status"] == "unavailable"]
    if partial_rows:
        missing_tickers = sorted({
            ticker
            for row in partial_rows
            for ticker in row.get("missingTickers", [])
        })
        warnings.append(
            f"{len(partial_rows)} dates have partial holding return coverage; "
            f"affected tickers: {', '.join(missing_tickers)}."
        )
    if unavailable_rows:
        warnings.append(f"{len(unavailable_rows)} dates have no usable holding returns.")
    if alignment_warning_dates:
        preview = ", ".join(alignment_warning_dates[:8])
        suffix = "..." if len(alignment_warning_dates) > 8 else ""
        warnings.append(
            "Contribution total differs from SOXX return by more than "
            f"{SOXX_RETURN_DIFF_WARNING_THRESHOLD_PCT_POINT:.2f}%p on "
            f"{len(alignment_warning_dates)} dates ({preview}{suffix}). This may reflect "
            "holdings coverage, stale weights, missing tickers, fees, or ETF mechanics."
        )

    return warnings


def overall_status(history: list[dict[str, Any]], warnings: list[str]) -> str:
    if not history or all(row["status"] == "unavailable" for row in history):
        return "unavailable"
    if warnings or any(row["status"] != "available" for row in history):
        return "partial"
    return "available"


def build_contribution_history(days: int | None = None) -> dict[str, Any]:
    days_requested = normalize_days(days)
    holdings_payload = load_holdings()
    holdings = holdings_payload.get("holdings") or []
    tickers = sorted({
        str(item.get("ticker") or "").strip().upper()
        for item in holdings
        if item.get("ticker")
    })
    all_price_tickers = sorted({*tickers, "SOXX"})
    holdings_total_weight = sum(float(item.get("weightPct") or 0.0) for item in holdings)

    db_path = resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
    row_limit = days_requested + PRICE_LOOKBACK_BUFFER_ROWS
    conn = sqlite3.connect(db_path)
    try:
        reference_dates = load_reference_dates(conn, days_requested)
        snapshot_dates = reference_dates[1:] if len(reference_dates) > 1 else []
        prices_by_ticker = {
            ticker: load_price_rows(conn, ticker, row_limit)
            for ticker in all_price_tickers
        }
    finally:
        conn.close()

    history: list[dict[str, Any]] = []
    bucket_history: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    alignment_warning_dates: list[str] = []

    for date in snapshot_dates[-days_requested:]:
        soxx_return = daily_return_pct(prices_by_ticker.get("SOXX", []), date)
        history_row, bucket_points = build_snapshot(date, holdings, prices_by_ticker, soxx_return)
        legacy_snapshot = history_row.pop("_legacySnapshot")
        history.append(history_row)
        bucket_history.extend(bucket_points)
        snapshots.append(legacy_snapshot)

        total_contribution = history_row.get("totalContributionPctPoint")
        if (
            isinstance(total_contribution, (int, float))
            and isinstance(soxx_return, (int, float))
            and math.isfinite(float(total_contribution))
            and math.isfinite(float(soxx_return))
            and abs(float(total_contribution) - float(soxx_return)) > SOXX_RETURN_DIFF_WARNING_THRESHOLD_PCT_POINT
        ):
            alignment_warning_dates.append(date)

    warnings = build_warnings(history, days_requested, alignment_warning_dates)
    status = overall_status(history, warnings)
    latest_date = history[-1]["date"] if history else None

    missing_tickers = sorted({
        ticker
        for row in history
        for ticker in row.get("missingTickers", [])
    })
    missing_ticker_date_rows = sum(len(row.get("missingTickers", [])) for row in history)

    return {
        "data_version": DATA_VERSION,
        "source": {
            "holdings": holdings_payload.get("source_note") or "Official SOXX holdings snapshot.",
            "prices": f"Existing local SQLite ohlcv_daily table ({Path(db_path).name}).",
        },
        "asOf": latest_date,
        "generated_at": now_iso(),
        "holdings_as_of": holdings_payload.get("as_of_date"),
        "daysRequested": days_requested,
        "period": PERIOD,
        "window_trading_days": days_requested,
        "status": status,
        "history": history,
        "bucketHistory": bucket_history,
        "snapshots": snapshots,
        "validation": {
            "snapshotCount": len(snapshots),
            "historyCount": len(history),
            "bucketPointCount": len(bucket_history),
            "hasResidual": bool(snapshots) and all(
                any(point.get("bucketId") == "residual" for point in snapshot.get("points", []))
                for snapshot in snapshots
            ),
            "hasSelectedTotal": bool(snapshots) and all(
                snapshot.get("selectedTotalPctPoint") is not None
                for snapshot in snapshots
            ),
            "holdingsTotalWeightPct": round_value(holdings_total_weight),
            "missingTickerCount": len(missing_tickers),
            "missingTickerDateRows": missing_ticker_date_rows,
            "soxxReturnDiffWarningCount": len(alignment_warning_dates),
            "warnings": warnings,
            "status": status,
        },
        "warnings": warnings[:50],
    }


def write_contribution_history(days: int | None = None, destination: Path | None = None) -> dict[str, Any]:
    payload = build_contribution_history(days)
    path = destination or contribution_history_output_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload
