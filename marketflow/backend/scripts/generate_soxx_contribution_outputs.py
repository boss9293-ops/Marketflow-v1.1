"""
Generate SOXX/SOXL Lens contribution outputs from holdings and price history.

Outputs written to marketflow/backend/output/semiconductor/:
  soxx_contribution_snapshot_latest.json   — 1D / 5D / 1M contribution snapshot
  soxx_contribution_history_60d.json       — 60 trading-day 1D contribution history
  soxx_contribution_generation_log.json    — generation run log

Rules:
  Missing ticker returns are reported and not converted to zero.
  On failure the previous output is preserved.
  No trading signals or forecasts are produced.

Usage:
  cd marketflow/backend
  python scripts/generate_soxx_contribution_outputs.py
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sqlite3
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

try:
    from db_utils import resolve_marketflow_db
    from services.data_contract import output_root
    from services.soxx_contribution_history import (
        build_contribution_history,
        holdings_path,
        load_holdings,
        load_price_rows,
        round_value,
        SELECTED_BUCKET_IDS,
        BUCKET_LABELS,
        BUCKET_ORDER,
        SOXX_RETURN_DIFF_WARNING_THRESHOLD_PCT_POINT,
    )
except Exception as _import_err:
    print(f"[WARN] Import error: {_import_err}", file=sys.stderr)
    sys.exit(1)

PERIOD_LOOKBACK: dict[str, int] = {
    "1D": 1,
    "5D": 5,
    "1M": 21,
}
SNAPSHOT_PERIODS = ["1D", "5D", "1M"]
PRICE_BUFFER_ROWS = 10

OUTPUT_SEMICONDUCTOR_DIR = output_root() / "semiconductor"
SNAPSHOT_FILENAME = "soxx_contribution_snapshot_latest.json"
HISTORY_FILENAME = "soxx_contribution_history_60d.json"
LOG_FILENAME = "soxx_contribution_generation_log.json"

LEGACY_HISTORY_FILENAME = "soxx_contribution_history.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_price_rows_for_snapshot(
    conn: sqlite3.Connection,
    tickers: list[str],
) -> dict[str, list[tuple[str, float]]]:
    row_limit = max(PERIOD_LOOKBACK.values()) + PRICE_BUFFER_ROWS
    return {ticker: load_price_rows(conn, ticker, row_limit) for ticker in tickers}


def nth_observation_return_pct(
    rows: list[tuple[str, float]],
    n: int,
) -> float | None:
    if len(rows) < n + 1:
        return None
    current_price = rows[-1][1]
    prior_price = rows[-(n + 1)][1]
    if not (current_price > 0 and prior_price > 0):
        return None
    return (current_price / prior_price - 1.0) * 100.0


def build_period_contribution(
    period: str,
    holdings: list[dict[str, Any]],
    prices_by_ticker: dict[str, list[tuple[str, float]]],
) -> dict[str, Any]:
    n = PERIOD_LOOKBACK[period]
    missing_tickers: list[str] = []
    available_ticker_count = 0
    total_ticker_count = 0

    bucket_acc: dict[str, dict[str, Any]] = {
        bucket_id: {
            "contribution": 0.0,
            "available": 0,
            "total": 0,
            "missing": [],
        }
        for bucket_id in BUCKET_ORDER
    }

    for holding in holdings:
        ticker = str(holding.get("ticker") or "").strip().upper()
        if not ticker:
            continue
        weight_pct = float(holding.get("weightPct") or 0.0)
        bucket_id = holding.get("bucketId")
        bucket_key = bucket_id if bucket_id in SELECTED_BUCKET_IDS else "residual"

        acc = bucket_acc[bucket_key]
        acc["total"] += 1
        total_ticker_count += 1

        ret = nth_observation_return_pct(prices_by_ticker.get(ticker, []), n)
        if ret is None:
            missing_tickers.append(ticker)
            acc["missing"].append(ticker)
            continue

        available_ticker_count += 1
        acc["available"] += 1
        acc["contribution"] += weight_pct * ret / 100.0

    selected_vals = [
        bucket_acc[bid]["contribution"]
        for bid in SELECTED_BUCKET_IDS
        if bucket_acc[bid]["available"] > 0
    ]
    selected_contribution = round_value(sum(selected_vals)) if selected_vals else None

    residual_acc = bucket_acc["residual"]
    residual_contribution = (
        round_value(residual_acc["contribution"]) if residual_acc["available"] > 0 else None
    )

    total_contribution: float | None = None
    if selected_contribution is not None or residual_contribution is not None:
        total_contribution = round_value(
            (selected_contribution or 0.0) + (residual_contribution or 0.0)
        )

    soxx_rows = prices_by_ticker.get("SOXX", [])
    soxx_return = nth_observation_return_pct(soxx_rows, n)

    if total_contribution is not None and soxx_return is not None:
        diff = abs(total_contribution - soxx_return)
    else:
        diff = None

    period_warnings: list[str] = []
    if diff is not None and diff > SOXX_RETURN_DIFF_WARNING_THRESHOLD_PCT_POINT:
        period_warnings.append(
            f"Contribution total differs from SOXX return by {diff:.2f}%p. "
            "This may reflect holdings coverage, stale weights, missing tickers, fees, ETF mechanics, or data timing."
        )
    if missing_tickers:
        period_warnings.append(
            f"Missing ticker returns for {period}: {', '.join(sorted(missing_tickers))}."
        )

    if available_ticker_count <= 0:
        status = "unavailable"
    elif missing_tickers:
        status = "partial"
    else:
        status = "available"

    asof_date: str | None = None
    if soxx_rows:
        asof_date = soxx_rows[-1][0]

    return {
        "period": period,
        "asOf": asof_date,
        "selectedContributionPctPoint": selected_contribution,
        "residualContributionPctPoint": residual_contribution,
        "totalContributionPctPoint": total_contribution,
        "soxxReturnPct": round_value(soxx_return),
        "availableTickerCount": available_ticker_count,
        "totalTickerCount": total_ticker_count,
        "missingTickers": sorted(missing_tickers),
        "status": status,
        "warnings": period_warnings,
    }


def build_snapshot(
    holdings: list[dict[str, Any]],
    prices_by_ticker: dict[str, list[tuple[str, float]]],
    holdings_payload: dict[str, Any],
) -> dict[str, Any]:
    all_warnings: list[str] = []
    periods_output: dict[str, Any] = {}

    for period in SNAPSHOT_PERIODS:
        period_result = build_period_contribution(period, holdings, prices_by_ticker)
        periods_output[period] = period_result
        all_warnings.extend(period_result.get("warnings", []))

    statuses = [periods_output[p]["status"] for p in SNAPSHOT_PERIODS]
    if all(s == "unavailable" for s in statuses):
        overall_status = "unavailable"
    elif any(s in ("partial", "unavailable") for s in statuses):
        overall_status = "partial"
    else:
        overall_status = "available"

    asof_date = (
        periods_output.get("1D", {}).get("asOf")
        or periods_output.get("5D", {}).get("asOf")
        or None
    )

    return {
        "source": "local_price_db",
        "generatedAt": now_iso(),
        "holdingsAsOf": holdings_payload.get("as_of_date"),
        "asOf": asof_date,
        "status": overall_status,
        "periods": periods_output,
        "warnings": all_warnings,
        "note": "Historical structure context only. Not a forecast or trading signal.",
    }


def safe_write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.json")
    try:
        tmp.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if path.exists():
            backup = path.with_suffix(".bak.json")
            shutil.copy2(path, backup)
        shutil.move(str(tmp), str(path))
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                pass


def build_log(
    outputs: list[dict[str, Any]],
    missing_tickers: list[str],
    all_warnings: list[str],
    error: str | None,
) -> dict[str, Any]:
    statuses = [o["status"] for o in outputs]
    if error:
        overall = "failed"
    elif all(s == "failed" for s in statuses):
        overall = "failed"
    elif any(s == "failed" for s in statuses) or any(s == "partial" for s in statuses):
        overall = "partial"
    elif all(s == "available" for s in statuses):
        overall = "available"
    else:
        overall = "partial"

    return {
        "lastRunAt": now_iso(),
        "status": overall,
        "source": "local_price_db",
        "outputs": outputs,
        "missingTickers": sorted(set(missing_tickers)),
        "warnings": all_warnings,
        "error": error,
    }


def main() -> int:
    all_warnings: list[str] = []
    output_log_entries: list[dict[str, Any]] = []
    global_missing_tickers: list[str] = []
    error_msg: str | None = None

    try:
        holdings_payload = load_holdings()
    except Exception as exc:
        error_msg = f"Failed to load SOXX holdings: {exc}"
        log = build_log([], [], [error_msg], error_msg)
        safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / LOG_FILENAME, log)
        print(f"[FAIL] {error_msg}", file=sys.stderr)
        return 1

    holdings: list[dict[str, Any]] = holdings_payload.get("holdings") or []
    holding_tickers = sorted({
        str(h.get("ticker") or "").strip().upper()
        for h in holdings
        if h.get("ticker")
    })
    all_price_tickers = sorted({*holding_tickers, "SOXX"})

    try:
        db_path = resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
        conn = sqlite3.connect(db_path)
        try:
            prices_for_snapshot = load_price_rows_for_snapshot(conn, all_price_tickers)
        finally:
            conn.close()
    except Exception as exc:
        error_msg = f"Failed to load price data: {exc}"
        log = build_log([], [], [error_msg], error_msg)
        safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / LOG_FILENAME, log)
        print(f"[FAIL] {error_msg}", file=sys.stderr)
        return 1

    # --- Snapshot (1D / 5D / 1M) ---
    snapshot_status = "failed"
    snapshot_records = 0
    snapshot_warnings: list[str] = []
    try:
        snapshot = build_snapshot(holdings, prices_for_snapshot, holdings_payload)
        snapshot_status = snapshot["status"]
        snapshot_records = len(SNAPSHOT_PERIODS)
        snapshot_warnings = snapshot.get("warnings", [])
        all_warnings.extend(snapshot_warnings)
        for p in SNAPSHOT_PERIODS:
            global_missing_tickers.extend(snapshot["periods"][p].get("missingTickers", []))

        safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / SNAPSHOT_FILENAME, snapshot)
        print(f"[OK] Snapshot written → {SNAPSHOT_FILENAME} (status: {snapshot_status})")
    except Exception as exc:
        snapshot_warnings = [f"Snapshot generation failed: {exc}"]
        all_warnings.extend(snapshot_warnings)
        print(f"[FAIL] Snapshot: {exc}", file=sys.stderr)
        traceback.print_exc()

    output_log_entries.append({
        "file": SNAPSHOT_FILENAME,
        "status": snapshot_status,
        "records": snapshot_records,
        "warnings": snapshot_warnings,
    })

    # --- 60d History ---
    history_status = "failed"
    history_records = 0
    history_warnings: list[str] = []
    try:
        history_payload = build_contribution_history(days=60)
        history_status = history_payload.get("status", "unavailable")
        history = history_payload.get("history", [])
        history_records = len(history)
        history_warnings = history_payload.get("warnings", [])
        all_warnings.extend(history_warnings)

        for row in history:
            global_missing_tickers.extend(row.get("missingTickers", []))

        ds9_history = {
            **history_payload,
            "source": "local_price_db",
            "daysRequested": 60,
        }
        safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / HISTORY_FILENAME, ds9_history)
        print(f"[OK] History written → {HISTORY_FILENAME} ({history_records} points, status: {history_status})")

        # Keep legacy path in sync for the existing frontend API route.
        safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / LEGACY_HISTORY_FILENAME, ds9_history)
        print(f"[OK] Legacy alias written → {LEGACY_HISTORY_FILENAME}")
    except Exception as exc:
        history_warnings = [f"History generation failed: {exc}"]
        all_warnings.extend(history_warnings)
        print(f"[FAIL] History: {exc}", file=sys.stderr)
        traceback.print_exc()

    output_log_entries.append({
        "file": HISTORY_FILENAME,
        "status": history_status,
        "records": history_records,
        "warnings": history_warnings,
    })

    # --- Generation Log ---
    log = build_log(output_log_entries, global_missing_tickers, all_warnings, error_msg)
    safe_write_json(OUTPUT_SEMICONDUCTOR_DIR / LOG_FILENAME, log)
    print(f"[OK] Log written → {LOG_FILENAME} (status: {log['status']})")

    overall_failed = error_msg or any(e["status"] == "failed" for e in output_log_entries)
    return 1 if overall_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
