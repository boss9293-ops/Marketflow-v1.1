import sqlite3
import os

candidates = ['marketflow/data/marketflow.db', 'marketflow/backend/data/marketflow.db', 'marketflow.db']
db_path = None
for c in candidates:
    if os.path.exists(c):
        db_path = c
        break

if db_path:
    print(f"Connecting to {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cur.fetchall()]
    print('Tables:', tables)
    
    if 'instruments' in tables:
        cur.execute("SELECT count(*) FROM instruments;")
        print("Count in instruments:", cur.fetchone()[0])
        cur.execute("SELECT exchange, count(*) FROM instruments GROUP BY exchange;")
        print("By exchange:", cur.fetchall())
        cur.execute("SELECT type, count(*) FROM instruments GROUP BY type;")
        print("By type:", cur.fetchall())
        
    if 'ohlcv_daily' in tables:
        cur.execute("SELECT count(DISTINCT symbol) FROM ohlcv_daily;")
        print("Distinct symbols in ohlcv_daily:", cur.fetchone()[0])
        
    conn.close()
else:
    print("Database not found.")
