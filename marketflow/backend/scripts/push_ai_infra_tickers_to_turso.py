# AI 인프라 신규 티커 17개를 Turso ohlcv_daily / universe_symbols에 푸시
from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

TURSO_URL   = 'https://marketos-boss9293.aws-us-east-1.turso.io'
TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzU2ODQwODIsImlkIjoiMDE5ZDZlZjUtYmQwMS03MTY5LTk3NGYtMjMzMTU0MDNjOGQxIiwicmlkIjoiMTU0NjI2MzItZmJjYi00OTc4LWFkOGEtNDM4YzFlYjUzMzFkIn0.L-bUX3P2NnFhHa2CS5zzWulNba9fHGOhqCDSj2UG-bUqiUG1d3LOtCgyCOu3HobLMb-bXgJ_VPU7CHQGJJ76DQ'
PIPE_URL    = f'{TURSO_URL}/v2/pipeline'

ROOT    = Path(__file__).resolve().parents[3]
LOCAL_DB = ROOT / 'marketflow' / 'data' / 'marketflow.db'

TARGET_SYMBOLS = [
    'ACMR', 'CLS', 'COHR', 'COHU', 'COPX',
    'FORM', 'MOD', 'NVT', 'ONTO', 'SANM',
    'SCCO', 'TECK', 'TTMI', 'VRT', 'WTS',
    'BWXT', 'CCJ', 'OKLO', 'SMR',
]

BATCH_SIZE = 50   # rows per HTTP pipeline call
TIMEOUT    = 120  # seconds per request


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _call(statements: list[dict], timeout: int = TIMEOUT) -> dict:
    body = json.dumps({'requests': statements}).encode()
    req  = urllib.request.Request(
        PIPE_URL,
        data=body,
        headers={
            'Authorization': f'Bearer {TURSO_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def turso_execute_single(sql: str, timeout: int = TIMEOUT):
    res = _call([
        {'type': 'execute', 'stmt': {'sql': sql}},
        {'type': 'close'},
    ], timeout=timeout)
    return res['results'][0]


def turso_insert_batch(sql: str, rows: list[tuple]) -> None:
    if not rows:
        return
    stmts = []
    for row in rows:
        # Turso HTTP API: value must always be a string (or null)
        args = [
            {'type': 'null', 'value': None} if v is None
            else {'type': 'text', 'value': str(v)}
            for v in row
        ]
        stmts.append({'type': 'execute', 'stmt': {'sql': sql, 'args': args}})
    stmts.append({'type': 'close'})
    _call(stmts)


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> int:
    if not LOCAL_DB.exists():
        print(f'[ERROR] Local DB not found: {LOCAL_DB}')
        return 1

    # ── 1. Ping Turso ──────────────────────────────────────────────────────────
    print(f'[INFO] Connecting to Turso: {TURSO_URL}')
    try:
        res = turso_execute_single("SELECT 1 AS ok", timeout=30)
        print('[OK] Turso connection alive')
    except Exception as e:
        print(f'[ERROR] Turso connection failed: {e}')
        return 1

    # ── 2. Read local DB ───────────────────────────────────────────────────────
    conn = sqlite3.connect(str(LOCAL_DB))
    conn.row_factory = sqlite3.Row

    ph = ','.join(['?' for _ in TARGET_SYMBOLS])

    ohlcv_rows = conn.execute(
        f"""SELECT symbol, date, open, high, low, close, adj_close, volume, source
            FROM ohlcv_daily
            WHERE symbol IN ({ph})
            ORDER BY symbol, date""",
        TARGET_SYMBOLS,
    ).fetchall()

    universe_rows = conn.execute(
        f"""SELECT symbol, name, sector, industry, exchange,
                   market_cap, is_active, is_top100, last_updated
            FROM universe_symbols
            WHERE symbol IN ({ph})""",
        TARGET_SYMBOLS,
    ).fetchall()

    conn.close()

    print(f'[INFO] ohlcv_daily rows to push: {len(ohlcv_rows)}')
    print(f'[INFO] universe_symbols rows to push: {len(universe_rows)}')

    if not ohlcv_rows:
        print('[WARN] No ohlcv data found for target symbols in local DB.')
        return 1

    # ── 3. Push ohlcv_daily ────────────────────────────────────────────────────
    ohlcv_sql = (
        'INSERT OR REPLACE INTO ohlcv_daily '
        '(symbol, date, open, high, low, close, adj_close, volume, source, updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    from datetime import datetime
    now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    total = 0
    for i in range(0, len(ohlcv_rows), BATCH_SIZE):
        batch = [
            (r['symbol'], r['date'], r['open'], r['high'], r['low'],
             r['close'], r['adj_close'], r['volume'], r['source'], now)
            for r in ohlcv_rows[i:i + BATCH_SIZE]
        ]
        retries = 3
        for attempt in range(1, retries + 1):
            try:
                turso_insert_batch(ohlcv_sql, batch)
                total += len(batch)
                break
            except Exception as e:
                print(f'[WARN] Batch {i//BATCH_SIZE+1} attempt {attempt} failed: {e}')
                if attempt < retries:
                    time.sleep(5 * attempt)
                else:
                    print('[ERROR] Batch failed after retries - aborting')
                    return 1

        if total % 500 == 0 or i + BATCH_SIZE >= len(ohlcv_rows):
            print(f'[PROGRESS] ohlcv_daily: {total}/{len(ohlcv_rows)} rows')

    print(f'[OK] ohlcv_daily: {total} rows pushed to Turso')

    # ── 4. Push universe_symbols ───────────────────────────────────────────────
    if universe_rows:
        us_sql = (
            'INSERT OR REPLACE INTO universe_symbols '
            '(symbol, name, sector, industry, exchange, '
            ' market_cap, is_active, is_top100, last_updated) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        us_batch = [
            (r['symbol'], r['name'], r['sector'], r['industry'], r['exchange'],
             r['market_cap'], r['is_active'], r['is_top100'], r['last_updated'])
            for r in universe_rows
        ]
        turso_insert_batch(us_sql, us_batch)
        print(f'[OK] universe_symbols: {len(us_batch)} rows pushed')

    # ── 5. Verify spot-check ───────────────────────────────────────────────────
    print('\n[VERIFY] Spot-checking Turso...')
    for sym in ['ACMR', 'VRT', 'TTMI']:
        try:
            res = turso_execute_single(
                f"SELECT COUNT(*) as n, MAX(date) as ld FROM ohlcv_daily WHERE symbol='{sym}'",
                timeout=60,
            )
            row = res['response']['result']['rows'][0]
            cnt = row[0]['value']
            ld  = row[1]['value']
            print(f'  {sym:<8} rows={cnt}  last={ld}')
        except Exception as e:
            print(f'  {sym:<8} verify error: {e}')

    print('\n[DONE] Turso push complete.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
