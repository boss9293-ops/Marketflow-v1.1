import os, sys, tempfile, shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

TURSO_URL   = 'libsql://marketos-boss9293.aws-us-east-1.turso.io'
TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzU2ODQwODIsImlkIjoiMDE5ZDZlZjUtYmQwMS03MTY5LTk3NGYtMjMzMTU0MDNjOGQxIiwicmlkIjoiMTU0NjI2MzItZmJjYi00OTc4LWFkOGEtNDM4YzFlYjUzMzFkIn0.L-bUX3P2NnFhHa2CS5zzWulNba9fHGOhqCDSj2UG-bUqiUG1d3LOtCgyCOu3HobLMb-bXgJ_VPU7CHQGJJ76DQ'

try:
    import libsql
except ImportError:
    print('[ERROR] libsql not installed')
    sys.exit(1)

tmp_dir = tempfile.mkdtemp(prefix='turso_check_')
replica_path = os.path.join(tmp_dir, 'check.db')
print(f'[INFO] Connecting to {TURSO_URL}')
print(f'[INFO] Replica path: {replica_path}')

try:
    conn = libsql.connect(replica_path, sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
    print('[INFO] Syncing from Turso ...')
    conn.sync()

    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
    print(f'[INFO] Tables in Turso ({len(rows)}):')
    for r in rows:
        print(f'  {r[0]}')

    for table in ['ohlcv_daily', 'market_daily']:
        try:
            cnt = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()
            print(f'[INFO] {table} rows: {cnt[0]}')
        except Exception as e:
            print(f'[WARN] {table} not found: {e}')

    try:
        latest = conn.execute("SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'").fetchone()
        print(f'[INFO] QQQ latest date in Turso: {latest[0]}')
    except Exception as e:
        print(f'[WARN] QQQ date query: {e}')

    conn.close()
    print('[OK] Turso check done.')
except Exception as e:
    print(f'[ERROR] {type(e).__name__}: {e}')
    sys.exit(1)
finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)
