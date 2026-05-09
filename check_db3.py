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
    
    cur.execute("PRAGMA table_info(universe_symbols);")
    print("universe_symbols columns:", [row[1] for row in cur.fetchall()])
    
    cur.execute("SELECT symbol, index_name, type, exchange FROM universe_symbols LIMIT 10;")
    print("Sample universe_symbols:", cur.fetchall())
    
    cur.execute("SELECT index_name, count(*) FROM universe_symbols GROUP BY index_name;")
    print("universe_symbols by index_name:", cur.fetchall())
    
    cur.execute("SELECT type, count(*) FROM universe_symbols GROUP BY type;")
    print("universe_symbols by type:", cur.fetchall())

    conn.close()
