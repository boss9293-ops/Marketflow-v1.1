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
    cur.execute("SELECT COUNT(*) FROM universe_symbols WHERE is_top100=1")
    print('is_top100 count:', cur.fetchone()[0])
    cur.execute("SELECT symbol FROM universe_symbols WHERE is_top100=1 LIMIT 20")
    print('is_top100 samples:', cur.fetchall())
    
    cur.execute("SELECT COUNT(*) FROM universe_symbols WHERE exchange='NYSE/NASDAQ'")
    print('NYSE/NASDAQ count:', cur.fetchone()[0])
