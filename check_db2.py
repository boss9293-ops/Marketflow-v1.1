import sqlite3
import os

candidates = ['marketflow/data/marketflow.db', 'marketflow/backend/data/marketflow.db', 'marketflow.db']
db_path = None
for c in candidates:
    if os.path.exists(c):
        db_path = c
        break

if db_path:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    print("=== universe_symbols ===")
    cur.execute("SELECT count(*) FROM universe_symbols;")
    print("Total universe_symbols:", cur.fetchone()[0])
    try:
        cur.execute("SELECT asset_class, count(*) FROM universe_symbols GROUP BY asset_class;")
        print("By asset_class:", cur.fetchall())
    except:
        pass
    try:
        cur.execute("SELECT exchange, count(*) FROM universe_symbols GROUP BY exchange;")
        print("By exchange:", cur.fetchall())
    except:
        pass
        
    print("\n=== etf_catalog ===")
    try:
        cur.execute("SELECT count(*) FROM etf_catalog;")
        print("Total etf_catalog:", cur.fetchone()[0])
    except:
        pass

    print("\n=== ohlcv_daily ===")
    cur.execute("SELECT count(DISTINCT symbol) FROM ohlcv_daily;")
    print("Total unique symbols in ohlcv_daily:", cur.fetchone()[0])
    
    conn.close()
