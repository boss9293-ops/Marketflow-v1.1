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
    
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cur.fetchall()]
    print("Tables:", tables)

    # Let's see if there's a way to distinguish Nasdaq and Dow
    cur.execute("SELECT exchange, COUNT(*) FROM universe_symbols GROUP BY exchange;")
    print("Exchanges:", cur.fetchall())
    
    # Are ETFs in universe_symbols?
    cur.execute("SELECT COUNT(*) FROM universe_symbols WHERE symbol IN (SELECT symbol FROM etf_catalog);")
    print("ETFs in universe_symbols:", cur.fetchone()[0])
    
    # Let's look at a few records
    cur.execute("SELECT symbol, name, exchange FROM universe_symbols LIMIT 20;")
    print("Sample:", cur.fetchall())

    conn.close()
