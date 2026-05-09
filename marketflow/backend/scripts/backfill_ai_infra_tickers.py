# AI 인프라 버킷 누락 심볼 백필 스크립트 — us_stock_db Daily_data 소스 사용
from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path('D:/MyWork_ai/ProjectAgent/Marketflow/v1.1-20260419')
DB_PATH = ROOT / 'marketflow/data/marketflow.db'
LOCAL_DATA_ROOT = Path('D:/MyWork_ai/ProjectAgent/Marketflow/us_stock_db/Daily_data')

# Tickers to import: (symbol, file_rel_path, asset_type, exchange, name, is_active)
TARGETS = [
    ('ACMR',  'nasdaq stocks/1/acmr.txt',   'equity', 'NASDAQ', 'ACM Research Inc',             1),
    ('CLS',   'nyse stocks/1/cls.txt',       'equity', 'NYSE',   'Celestica Inc',                1),
    ('COHR',  'nyse stocks/1/cohr.txt',      'equity', 'NYSE',   'Coherent Corp',                1),
    ('COHU',  'nasdaq stocks/1/cohu.txt',    'equity', 'NASDAQ', 'Cohu Inc',                     1),
    ('COPX',  'nyse etfs/1/copx.txt',        'etf',    'NYSEARCA','Global X Copper Miners ETF',  1),
    ('FORM',  'nasdaq stocks/1/form.txt',    'equity', 'NASDAQ', 'FormFactor Inc',               1),
    ('MOD',   'nyse stocks/2/mod.txt',       'equity', 'NYSE',   'Modine Manufacturing Co',      1),
    ('NVT',   'nyse stocks/2/nvt.txt',       'equity', 'NYSE',   'nVent Electric plc',           1),
    ('ONTO',  'nyse stocks/2/onto.txt',      'equity', 'NYSE',   'Onto Innovation Inc',          1),
    ('SANM',  'nasdaq stocks/2/sanm.txt',    'equity', 'NASDAQ', 'Sanmina Corp',                 1),
    ('SCCO',  'nyse stocks/2/scco.txt',      'equity', 'NYSE',   'Southern Copper Corp',         1),
    ('TECK',  'nyse stocks/2/teck.txt',      'equity', 'NYSE',   'Teck Resources Ltd',           1),
    ('TTMI',  'nasdaq stocks/3/ttmi.txt',    'equity', 'NASDAQ', 'TTM Technologies Inc',         1),
    ('VRT',   'nyse stocks/2/vrt.txt',       'equity', 'NYSE',   'Vertiv Holdings Co',           1),
    ('WTS',   'nyse stocks/2/wts.txt',       'equity', 'NYSE',   'Watts Water Technologies Inc', 1),
    ('BWXT',  'nyse stocks/1/bwxt.txt',      'equity', 'NYSE',   'BWX Technologies Inc',         1),
    ('CCJ',   'nyse stocks/1/ccj.txt',       'equity', 'NYSE',   'Cameco Corp',                  1),
]

# CCMP — inactive legacy (acquired by Entegris 2022), no price file available
LEGACY = [
    ('CCMP', 'equity', 'NASDAQ', 'CMC Materials Inc', 0, 'ENTG'),
]


def parse_stooq_txt(path: str, symbol: str) -> list[dict]:
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for line in lines[1:]:  # skip header
        parts = line.strip().split(',')
        if len(parts) < 8:
            continue
        raw_date = parts[2].strip()
        if len(raw_date) != 8:
            continue
        try:
            date_str = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}'
            open_  = float(parts[4]) if parts[4] else None
            high   = float(parts[5]) if parts[5] else None
            low    = float(parts[6]) if parts[6] else None
            close  = float(parts[7]) if parts[7] else None
            vol    = float(parts[8]) if len(parts) > 8 and parts[8] else None
        except ValueError:
            continue
        if close is None or close <= 0:
            continue
        rows.append({
            'symbol': symbol,
            'date': date_str,
            'open': open_,
            'high': high,
            'low': low,
            'close': close,
            'adj_close': None,
            'volume': int(vol) if vol is not None else None,
            'source': 'stooq_local',
            'updated_at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        })
    return rows


def upsert_universe_symbol(cur: sqlite3.Cursor, symbol: str, name: str,
                            exchange: str, is_active: int) -> None:
    cur.execute('''
        INSERT INTO universe_symbols (symbol, name, sector, industry, exchange,
                                      market_cap, is_active, is_top100, last_updated)
        VALUES (?, ?, 'Technology', 'Semiconductors', ?, NULL, ?, 0, ?)
        ON CONFLICT(symbol) DO UPDATE SET
            name=excluded.name,
            exchange=excluded.exchange,
            is_active=excluded.is_active,
            last_updated=excluded.last_updated
    ''', (symbol, name, exchange, is_active,
          datetime.utcnow().strftime('%Y-%m-%d')))


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute('PRAGMA journal_mode=WAL')
    cur = conn.cursor()

    # Check universe_symbols has 'symbol' primary key or unique constraint
    cur.execute("PRAGMA table_info(universe_symbols)")
    cols = {r[1]: r for r in cur.fetchall()}
    has_symbol_col = 'symbol' in cols
    if not has_symbol_col:
        print('ERROR: universe_symbols missing symbol column')
        sys.exit(1)

    total_inserted = 0
    results = []

    # ── Active tickers ────────────────────────────────────────────────────────
    for symbol, rel_path, asset_type, exchange, name, is_active in TARGETS:
        file_path = LOCAL_DATA_ROOT / rel_path
        if not file_path.exists():
            print(f'  SKIP {symbol}: file not found at {file_path}')
            results.append((symbol, 'FILE_NOT_FOUND', 0, None))
            continue

        rows = parse_stooq_txt(str(file_path), symbol)
        if not rows:
            print(f'  SKIP {symbol}: no parseable rows')
            results.append((symbol, 'PARSE_EMPTY', 0, None))
            continue

        # Upsert universe_symbols
        upsert_universe_symbol(cur, symbol, name, exchange, is_active)

        # Bulk insert into ohlcv_daily
        cur.executemany('''
            INSERT OR REPLACE INTO ohlcv_daily
                (symbol, date, open, high, low, close, adj_close, volume, source, updated_at)
            VALUES
                (:symbol, :date, :open, :high, :low, :close, :adj_close, :volume, :source, :updated_at)
        ''', rows)

        n = len(rows)
        last_date = rows[-1]['date'] if rows else None
        total_inserted += n
        results.append((symbol, 'OK', n, last_date))
        print(f'  OK   {symbol:<8} {n:>5} rows  last={last_date}')

    # ── Legacy / inactive ─────────────────────────────────────────────────────
    for symbol, asset_type, exchange, name, is_active, replacement in LEGACY:
        upsert_universe_symbol(cur, symbol, name, exchange, is_active)
        results.append((symbol, 'LEGACY_SKIP', 0, None))
        print(f'  LEGACY {symbol:<8} is_active=0  replacement={replacement}')

    conn.commit()
    conn.close()

    print(f'\n=== DONE: {total_inserted} total rows inserted ===\n')

    print(f"{'Ticker':<8} {'Status':<16} {'Rows':<8} {'Last Date'}")
    print('-' * 50)
    for symbol, status, n, last_date in results:
        print(f'{symbol:<8} {status:<16} {n:<8} {str(last_date or "—")}')


if __name__ == '__main__':
    main()
