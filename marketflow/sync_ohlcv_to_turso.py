"""
Turso HTTP API를 이용한 incremental sync.
libsql replica pull 없이 HTTP로 직접 SQL 실행 → 빠름.
"""
import os, sys, sqlite3, json, urllib.request, urllib.error

TURSO_URL   = 'https://marketos-boss9293.aws-us-east-1.turso.io'
TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzU2ODQwODIsImlkIjoiMDE5ZDZlZjUtYmQwMS03MTY5LTk3NGYtMjMzMTU0MDNjOGQxIiwicmlkIjoiMTU0NjI2MzItZmJjYi00OTc4LWFkOGEtNDM4YzFlYjUzMzFkIn0.L-bUX3P2NnFhHa2CS5zzWulNba9fHGOhqCDSj2UG-bUqiUG1d3LOtCgyCOu3HobLMb-bXgJ_VPU7CHQGJJ76DQ'
LOCAL_DB    = os.path.join('data', 'marketflow.db')
SYMBOLS     = ['QQQ', 'TQQQ', 'SPY', 'IWM', 'TLT', 'GLD', 'VXX']
PIPE_URL    = f'{TURSO_URL}/v2/pipeline'


def turso_execute(statements: list[dict]) -> dict:
    body = json.dumps({'requests': statements}).encode()
    req = urllib.request.Request(
        PIPE_URL,
        data=body,
        headers={
            'Authorization': f'Bearer {TURSO_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def turso_scalar(sql: str):
    """단일 값 반환 쿼리"""
    res = turso_execute([{'type': 'execute', 'stmt': {'sql': sql}}, {'type': 'close'}])
    try:
        return res['results'][0]['response']['result']['rows'][0][0]['value']
    except (KeyError, IndexError, TypeError):
        return None


def turso_insert_batch(sql: str, rows: list[tuple]) -> int:
    """여러 행을 HTTP 파이프라인으로 batch insert"""
    if not rows:
        return 0
    stmts = []
    for row in rows:
        args = [{'type': 'text', 'value': str(v) if v is not None else None} for v in row]
        stmts.append({'type': 'execute', 'stmt': {'sql': sql, 'args': args}})
    stmts.append({'type': 'close'})
    turso_execute(stmts)
    return len(rows)


def main():
    if not os.path.exists(LOCAL_DB):
        print(f'[ERROR] Local DB not found: {LOCAL_DB}'); return 1

    print(f'[INFO] Turso: {TURSO_URL}')

    # 1. Turso 현재 상태 확인
    try:
        qqq_latest = turso_scalar("SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'")
        mkt_latest = turso_scalar("SELECT MAX(date) FROM market_daily WHERE vix IS NOT NULL")
        ohlcv_cnt  = turso_scalar("SELECT COUNT(*) FROM ohlcv_daily")
        print(f'[INFO] Turso ohlcv_daily: {ohlcv_cnt} rows, QQQ latest: {qqq_latest}')
        print(f'[INFO] Turso market_daily VIX latest: {mkt_latest}')
    except Exception as e:
        print(f'[ERROR] Turso connection failed: {e}'); return 1

    # 2. 로컬 DB에서 새 데이터만 읽기
    src = sqlite3.connect(LOCAL_DB)
    src.row_factory = sqlite3.Row

    ph = ','.join(['?' for _ in SYMBOLS])
    ohlcv_cutoff = qqq_latest or '2020-01-01'
    ohlcv_rows = src.execute(
        f"""SELECT date, symbol, open, high, low, close, volume
            FROM ohlcv_daily
            WHERE symbol IN ({ph}) AND date > ?
            ORDER BY date""",
        [*SYMBOLS, ohlcv_cutoff]
    ).fetchall()

    mkt_cutoff = mkt_latest or '2020-01-01'
    market_rows = src.execute(
        """SELECT date, spy, qqq, iwm, vix, us10y, us2y, dxy, oil, gold
           FROM market_daily
           WHERE date > ? AND vix IS NOT NULL
           ORDER BY date""",
        [mkt_cutoff]
    ).fetchall()
    src.close()

    print(f'[INFO] New ohlcv_daily rows: {len(ohlcv_rows)}')
    print(f'[INFO] New market_daily rows: {len(market_rows)}')

    if not ohlcv_rows and not market_rows:
        print('[OK] Already up-to-date.'); return 0

    # 3. ohlcv_daily insert (배치 50)
    BATCH = 50
    if ohlcv_rows:
        sql = ("INSERT OR IGNORE INTO ohlcv_daily "
               "(date, symbol, open, high, low, close, volume) "
               "VALUES (?, ?, ?, ?, ?, ?, ?)")
        total = 0
        for i in range(0, len(ohlcv_rows), BATCH):
            batch = [(r['date'], r['symbol'], r['open'], r['high'],
                      r['low'], r['close'], r['volume'])
                     for r in ohlcv_rows[i:i+BATCH]]
            turso_insert_batch(sql, batch)
            total += len(batch)
            print(f'[PROGRESS] ohlcv: {total}/{len(ohlcv_rows)}')
        print(f'[OK] ohlcv_daily: {total} rows inserted')

    # 4. market_daily insert
    if market_rows:
        sql = ("INSERT OR IGNORE INTO market_daily "
               "(date, spy, qqq, iwm, vix, us10y, us2y, dxy, oil, gold) "
               "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        batch = [(r['date'], r['spy'], r['qqq'], r['iwm'], r['vix'],
                  r['us10y'], r['us2y'], r['dxy'], r['oil'], r['gold'])
                 for r in market_rows]
        turso_insert_batch(sql, batch)
        print(f'[OK] market_daily: {len(batch)} rows inserted')

    # 5. 최종 검증
    qqq_new = turso_scalar("SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'")
    total_ohlcv = turso_scalar("SELECT COUNT(*) FROM ohlcv_daily")
    print(f'[VERIFY] Turso ohlcv_daily: {total_ohlcv} rows, QQQ latest: {qqq_new}')
    print('[OK] Incremental sync complete.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
