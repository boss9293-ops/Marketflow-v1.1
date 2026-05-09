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
    
    cur.execute("PRAGMA table_info(etf_catalog);")
    print("etf_catalog columns:", [row[1] for row in cur.fetchall()])
    
    cur.execute("SELECT count(*) FROM etf_catalog;")
    print("Total etf_catalog:", cur.fetchone()[0])
    
    cur.execute("SELECT exchange, count(*) FROM universe_symbols GROUP BY exchange;")
    print("universe_symbols exchange counts:", cur.fetchall())
    
    cur.execute("SELECT sector, count(*) FROM universe_symbols GROUP BY sector;")
    print("universe_symbols sector counts:", cur.fetchall())

    conn.close()
