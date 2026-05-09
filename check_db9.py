import sqlite3
import os
import sys
import ast

def get_list_from_ast(filepath, list_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        source = f.read()
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id == list_name:
                return [elt.s if isinstance(elt, ast.Str) else elt.value for elt in node.value.elts]
    return []

db_path = None
for c in ['marketflow/data/marketflow.db', 'marketflow/backend/data/marketflow.db', 'marketflow.db']:
    if os.path.exists(c):
        db_path = c
        break

if db_path:
    NASDAQ_100_STOCKS = get_list_from_ast('marketflow/backend/scripts/symbol_registry.py', 'NASDAQ_100_STOCKS')
    DOW_30 = get_list_from_ast('marketflow/backend/scripts/symbol_registry.py', 'DOW_30')

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 1. ETFs
    cur.execute("SELECT count(*) FROM etf_catalog;")
    etf_count = cur.fetchone()[0]
    
    # 2. Nasdaq 100
    nasdaq_in_db = 0
    for sym in NASDAQ_100_STOCKS:
        cur.execute("SELECT count(*) FROM ohlcv_daily WHERE symbol=?", (sym,))
        if cur.fetchone()[0] > 0:
            nasdaq_in_db += 1
            
    # 3. Dow 30
    dow_in_db = 0
    for sym in DOW_30:
        cur.execute("SELECT count(*) FROM ohlcv_daily WHERE symbol=?", (sym,))
        if cur.fetchone()[0] > 0:
            dow_in_db += 1
            
    # Also check how many are in universe_symbols
    nasdaq_univ = 0
    for sym in NASDAQ_100_STOCKS:
        cur.execute("SELECT count(*) FROM universe_symbols WHERE symbol=?", (sym,))
        if cur.fetchone()[0] > 0:
            nasdaq_univ += 1

    dow_univ = 0
    for sym in DOW_30:
        cur.execute("SELECT count(*) FROM universe_symbols WHERE symbol=?", (sym,))
        if cur.fetchone()[0] > 0:
            dow_univ += 1

    print(f"ETFs in etf_catalog: {etf_count}")
    print(f"Nasdaq 100 in ohlcv_daily: {nasdaq_in_db} / {len(NASDAQ_100_STOCKS)} (Universe: {nasdaq_univ})")
    print(f"Dow 30 in ohlcv_daily: {dow_in_db} / {len(DOW_30)} (Universe: {dow_univ})")

    # Let's see total symbols
    cur.execute("SELECT count(DISTINCT symbol) FROM ohlcv_daily;")
    total_ohlcv = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM universe_symbols;")
    total_univ = cur.fetchone()[0]
    print(f"Total distinct symbols in ohlcv_daily: {total_ohlcv}")
    print(f"Total symbols in universe_symbols: {total_univ}")

    conn.close()
else:
    print("DB not found")
