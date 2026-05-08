# 반도체 버킷 계산에 필요한 티커별 일간 종가를 로컬 DB에서 추출해 캐시로 저장하는 스크립트
import json
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd
import numpy as np

ROOT     = Path(__file__).resolve().parent.parent.parent
DB_PATH  = ROOT / 'marketflow/data/marketflow.db'
OUT_PATH = ROOT / 'marketflow/backend/output/cache/semiconductor_series_data_latest.json'

REQUIRED_TICKERS = [
    'NVDA', 'AVGO', 'AMD',             # AI Compute
    'MU',                              # Memory / HBM
    'TSM',                             # Foundry / Packaging
    'ASML', 'AMAT', 'LRCX', 'KLAC',   # Equipment
    'SOXX', 'SMH',                     # Semiconductor benchmark
    'QQQ', 'SPY',                      # Market benchmark (already in cache.db)
]

MIN_CACHE_POINTS   = 24
MIN_PARTIAL_POINTS = 8
HISTORY_YEARS      = 3   # export last N years to keep cache manageable


def load_ohlcv(cur, symbol: str, start_date: str) -> list[tuple[str, float]]:
    cur.execute(
        '''SELECT date,
                  COALESCE(adj_close, close) as price
           FROM ohlcv_daily
           WHERE symbol=? AND date>=?
             AND COALESCE(adj_close, close) IS NOT NULL
             AND COALESCE(adj_close, close) > 0
           ORDER BY date ASC''',
        (symbol, start_date)
    )
    return cur.fetchall()


def dedupe_series(rows: list[tuple[str, float]]) -> list[tuple[str, float]]:
    seen: dict[str, float] = {}
    for date, price in rows:
        seen[date] = price
    return sorted(seen.items())


def series_status(n: int) -> str:
    if n >= MIN_CACHE_POINTS:
        return 'CACHE'
    if n >= MIN_PARTIAL_POINTS:
        return 'PARTIAL'
    return 'PENDING'


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found: {DB_PATH}')
        return

    start_date = (datetime.now() - timedelta(days=365 * HISTORY_YEARS)).strftime('%Y-%m-%d')
    db  = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()

    tickers_out: dict = {}
    missing: list[str] = []

    for sym in REQUIRED_TICKERS:
        rows = load_ohlcv(cur, sym, start_date)
        rows = dedupe_series(rows)

        if not rows:
            missing.append(sym)
            tickers_out[sym] = {
                'status': 'PENDING',
                'source': 'ohlcv_daily',
                'asOf': '',
                'count': 0,
                'series': [],
            }
            print(f'  {sym}: PENDING (no data)')
            continue

        # Validate: no NaN
        clean = [(d, float(p)) for d, p in rows if not (p is None or (isinstance(p, float) and np.isnan(p)))]
        status = series_status(len(clean))
        as_of  = clean[-1][0] if clean else ''

        tickers_out[sym] = {
            'status': status,
            'source': 'ohlcv_daily',
            'asOf':   as_of,
            'count':  len(clean),
            'series': [{'date': d, 'close': round(p, 4)} for d, p in clean],
        }
        print(f'  {sym}: {status} ({len(clean)} pts, {clean[0][0]} to {as_of})')

    db.close()

    payload = {
        'generatedAt':   datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source':        'marketflow/data/marketflow.db ohlcv_daily',
        'historyYears':  HISTORY_YEARS,
        'startDate':     start_date,
        'tickers':       tickers_out,
        'missingTickers': missing,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'OK: semiconductor series data written → {OUT_PATH}')
    if missing:
        print(f'    missing tickers: {missing}')


if __name__ == '__main__':
    main()
