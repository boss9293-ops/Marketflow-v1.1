import sqlite3
import os

db_path = None
for c in ['marketflow/data/marketflow.db', 'marketflow/backend/data/marketflow.db', 'marketflow.db']:
    if os.path.exists(c):
        db_path = c
        break

if db_path:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
    print('Schemas:')
    for row in cur.fetchall():
        if row[0] in ['universe_symbols', 'etf_catalog', 'watchlist_symbols', 'indices', 'constituents']:
            print(row[0], ':', row[1])
            
    cur.execute("SELECT symbol, name FROM universe_symbols WHERE name LIKE '%Nasdaq%' OR name LIKE '%Dow%';")
    print("Nasdaq/Dow in universe_symbols:", cur.fetchall())
