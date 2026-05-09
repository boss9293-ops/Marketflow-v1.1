from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime
from typing import Dict

from db_utils import resolve_marketflow_db
from services.soxx_lens_universe import get_soxx_lens_tickers


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check SOXX Lens price coverage in ohlcv_daily.")
    parser.add_argument(
        "--stale-days",
        type=int,
        default=3,
        help="Calendar-day threshold for stale tickers (default: 3).",
    )
    return parser.parse_args()


def load_latest_dates(conn: sqlite3.Connection, tickers: list[str]) -> Dict[str, str]:
    if not tickers:
        return {}

    placeholders = ",".join("?" for _ in tickers)
    rows = conn.execute(
        f"""
        SELECT symbol, MAX(date) AS last_date
        FROM ohlcv_daily
        WHERE symbol IN ({placeholders})
        GROUP BY symbol
        """,
        tickers,
    ).fetchall()
    return {
        str(symbol).upper(): str(last_date)
        for symbol, last_date in rows
        if symbol and last_date
    }


def age_days(date_str: str) -> int | None:
    try:
        then = datetime.strptime(date_str, "%Y-%m-%d").date()
        return (datetime.now().date() - then).days
    except Exception:
        return None


def main() -> int:
    args = parse_args()

    db_path = resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
    tickers = get_soxx_lens_tickers()
    if not tickers:
        print("SOXX Lens Price Coverage")
        print("Required tickers: 0")
        print("Status: UNAVAILABLE")
        return 1

    conn = sqlite3.connect(db_path)
    try:
        latest_dates = load_latest_dates(conn, tickers)
    finally:
        conn.close()

    required_count = len(tickers)
    available_count = len(latest_dates)
    missing = sorted(ticker for ticker in tickers if ticker not in latest_dates)

    stale_tickers: list[str] = []
    for ticker, last_date in latest_dates.items():
        days = age_days(last_date)
        if days is not None and days > args.stale_days:
            stale_tickers.append(ticker)
    stale_tickers.sort()

    if available_count <= 0:
        status = "UNAVAILABLE"
    elif missing or stale_tickers:
        status = "PARTIAL"
    else:
        status = "AVAILABLE"

    latest_values = sorted(latest_dates.values())
    latest_min = latest_values[0] if latest_values else "n/a"
    latest_max = latest_values[-1] if latest_values else "n/a"

    print("SOXX Lens Price Coverage")
    print(f"Required tickers: {required_count}")
    print(f"Available tickers: {available_count}")
    print(f"Missing tickers: {', '.join(missing) if missing else 'None'}")
    print(f"Stale tickers (> {args.stale_days}d): {', '.join(stale_tickers) if stale_tickers else 'None'}")
    print(f"Latest date range: {latest_min} to {latest_max}")
    print(f"Status: {status}")

    return 0 if status in {"AVAILABLE", "PARTIAL"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
