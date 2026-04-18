"""로컬 DB 상태 확인 후 ohlcv_daily를 Turso에 업로드"""
import os, sys, sqlite3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 로컬 DB 경로 탐색
candidates = [
    os.path.join('data', 'marketflow.db'),
    os.path.join('backend', 'data', 'marketflow.db'),
]

db_path = None
for c in candidates:
    if os.path.exists(c):
        db_path = c
        break

if not db_path:
    print('[ERROR] marketflow.db not found in candidate paths')
    sys.exit(1)

print(f'[INFO] Local DB: {db_path} ({os.path.getsize(db_path)//1024//1024}MB)')

with sqlite3.connect(db_path) as conn:
    # ohlcv_daily 확인
    cnt = conn.execute("SELECT COUNT(*) FROM ohlcv_daily").fetchone()[0]
    latest = conn.execute("SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'").fetchone()[0]
    tqqq = conn.execute("SELECT COUNT(*) FROM ohlcv_daily WHERE symbol='TQQQ'").fetchone()[0]
    vix_cnt = conn.execute("SELECT COUNT(*) FROM market_daily WHERE vix IS NOT NULL").fetchone()[0]
    vix_latest = conn.execute("SELECT MAX(date) FROM market_daily WHERE vix IS NOT NULL").fetchone()[0]
    print(f'[INFO] ohlcv_daily total rows: {cnt}')
    print(f'[INFO] QQQ latest date: {latest}')
    print(f'[INFO] TQQQ rows: {tqqq}')
    print(f'[INFO] market_daily vix rows: {vix_cnt}, latest: {vix_latest}')

print('[OK] Local DB check done.')
