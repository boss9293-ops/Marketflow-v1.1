"""
Calculate sector performance (1D, 1W, 1M, 3M, 6M, 1Y) for major US sector ETFs.
DB-first: reads from ohlcv_daily in marketflow.db.
Output: output/sector_performance.json
"""
import json
import os
import sqlite3
from datetime import datetime
from typing import List, Tuple


SECTORS = {
    'XLK': 'Technology',
    'XLV': 'Healthcare',
    'XLF': 'Financial',
    'XLE': 'Energy',
    'XLY': 'Consumer Cyclical',
    'XLP': 'Consumer Defensive',
    'XLI': 'Industrials',
    'XLB': 'Basic Materials',
    'XLRE': 'Real Estate',
    'XLU': 'Utilities',
    'XLC': 'Communication Services',
}

BARS = {
    'change_1d': 1,
    'change_1w': 5,
    'change_1m': 21,
    'change_3m': 63,
    'change_6m': 126,
    'change_1y': 252,
}


def fetch_unique_daily_closes(conn: sqlite3.Connection, symbol: str) -> List[Tuple[str, float]]:
    """
    Return one close value per trading date, even if ohlcv_daily contains
    duplicate (symbol, date) rows on legacy databases.
    """
    try:
        rows = conn.execute(
            """
            WITH latest_per_day AS (
                SELECT date, MAX(rowid) AS rid
                FROM ohlcv_daily
                WHERE symbol = ? AND close IS NOT NULL
                GROUP BY date
            )
            SELECT o.date, o.close
            FROM ohlcv_daily o
            JOIN latest_per_day d ON o.rowid = d.rid
            WHERE o.symbol = ?
            ORDER BY o.date ASC
            """,
            (symbol, symbol),
        ).fetchall()
        return [(r[0], float(r[1])) for r in rows if r and r[0] and r[1] is not None]
    except Exception:
        # Fallback for older SQLite edge-cases: keep the last row per date in Python.
        raw = conn.execute(
            """
            SELECT date, close
            FROM ohlcv_daily
            WHERE symbol = ? AND close IS NOT NULL
            ORDER BY date ASC, rowid ASC
            """,
            (symbol,),
        ).fetchall()
        dedup: dict[str, float] = {}
        for date_str, close_val in raw:
            if not date_str or close_val is None:
                continue
            dedup[str(date_str)] = float(close_val)
        return sorted(dedup.items(), key=lambda x: x[0])


def calculate_sector_performance():
    db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'marketflow.db')
    db_path = os.path.abspath(db_path)

    result = {
        'timestamp': datetime.now().isoformat(),
        'sectors': [],
    }

    conn = sqlite3.connect(db_path)
    try:
        for symbol, name in SECTORS.items():
            rows = fetch_unique_daily_closes(conn, symbol)

            if not rows:
                print(f"Skip {symbol}: no data in DB")
                continue

            closes = [r[1] for r in rows]
            n = len(closes)
            current_price = closes[-1]

            def pct(bars_ago):
                if n > bars_ago:
                    return round(((current_price / closes[-bars_ago - 1]) - 1) * 100, 2)
                return 0.0

            entry = {
                'symbol': symbol,
                'name': name,
                'price': round(current_price, 2),
                'change_1d':  pct(1),
                'change_1w':  pct(5),
                'change_1m':  pct(21),
                'change_3m':  pct(63),
                'change_6m':  pct(126),
                'change_1y':  pct(252),
            }
            result['sectors'].append(entry)
            print(f"{symbol}: 1D={entry['change_1d']:.2f}% | 1W={entry['change_1w']:.2f}% | 1M={entry['change_1m']:.2f}% | last={rows[-1][0]}")
    finally:
        conn.close()

    output_dir = os.path.join(os.path.dirname(__file__), '..', 'output')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'sector_performance.json')
    with open(output_path, 'w', encoding='utf-8') as fh:
        json.dump(result, fh, indent=2)

    print(f"Sector performance saved: {len(result['sectors'])} sectors -> {output_path}")


if __name__ == '__main__':
    calculate_sector_performance()
