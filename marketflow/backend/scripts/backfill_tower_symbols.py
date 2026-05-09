# AI Investment Tower 누락 심볼 백필 - SNOW/MDB/NET(로컬 stooq) + ABB(yfinance)

from __future__ import annotations

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT    = Path('D:/MyWork_ai/ProjectAgent/Marketflow/v1.1-20260419')
DB_PATH = ROOT / 'marketflow/data/marketflow.db'
LOCAL   = Path('D:/MyWork_ai/ProjectAgent/Marketflow/us_stock_db/Daily_data')

LOCAL_TARGETS = [
    ('SNOW', LOCAL / 'nyse stocks/2/snow.txt',    'NYSE',   'Snowflake Inc'),
    ('MDB',  LOCAL / 'nasdaq stocks/2/mdb.txt',   'NASDAQ', 'MongoDB Inc'),
    ('NET',  LOCAL / 'nyse stocks/2/net.txt',     'NYSE',   'Cloudflare Inc'),
]


def parse_stooq_txt(path: Path, symbol: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    for line in lines[1:]:
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
            'symbol': symbol, 'date': date_str,
            'open': open_, 'high': high, 'low': low, 'close': close,
            'adj_close': None, 'volume': int(vol) if vol else None,
            'source': 'stooq_local',
            'updated_at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        })
    return rows


def fetch_yfinance(symbol: str, start: str = '2010-01-01') -> list[dict]:
    import yfinance as yf
    # Try download (more robust than Ticker.history for international symbols)
    df = yf.download(symbol, start=start, auto_adjust=True, progress=False)
    if df is None or df.empty:
        # Fallback: Ticker.history
        tk = yf.Ticker(symbol)
        df = tk.history(start=start, auto_adjust=True)
    if df is None or df.empty:
        return []
    # Flatten MultiIndex columns if present
    if hasattr(df.columns, 'levels'):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    rows: list[dict] = []
    ts = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    for dt, row in df.iterrows():
        try:
            close = float(row['Close'])
        except (KeyError, ValueError, TypeError):
            continue
        if close <= 0:
            continue
        rows.append({
            'symbol': symbol,
            'date': dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10],
            'open':      float(row.get('Open', 0)) or None,
            'high':      float(row.get('High', 0)) or None,
            'low':       float(row.get('Low',  0)) or None,
            'close':     close,
            'adj_close': close,
            'volume':    int(row.get('Volume', 0)) or None,
            'source':    'yfinance',
            'updated_at': ts,
        })
    return rows


def upsert_universe(cur: sqlite3.Cursor, symbol: str, name: str,
                    exchange: str, sector: str = 'Technology') -> None:
    cur.execute('''
        INSERT INTO universe_symbols
            (symbol, name, sector, industry, exchange, market_cap, is_active, is_top100, last_updated)
        VALUES (?, ?, ?, 'Software', ?, NULL, 1, 0, ?)
        ON CONFLICT(symbol) DO UPDATE SET
            name=excluded.name, exchange=excluded.exchange,
            is_active=1, last_updated=excluded.last_updated
    ''', (symbol, name, sector, exchange, datetime.utcnow().strftime('%Y-%m-%d')))


def upsert_ohlcv(cur: sqlite3.Cursor, rows: list[dict]) -> int:
    cur.executemany('''
        INSERT OR REPLACE INTO ohlcv_daily
            (symbol, date, open, high, low, close, adj_close, volume, source, updated_at)
        VALUES
            (:symbol, :date, :open, :high, :low, :close, :adj_close, :volume, :source, :updated_at)
    ''', rows)
    return len(rows)


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute('PRAGMA journal_mode=WAL')
    cur = conn.cursor()

    results: list[tuple[str, str, int, str | None, str | None]] = []

    # ── Local stooq files ─────────────────────────────────────────────────────
    for symbol, file_path, exchange, name in LOCAL_TARGETS:
        if not file_path.exists():
            print(f'  SKIP {symbol}: file not found')
            results.append((symbol, 'FILE_NOT_FOUND', 0, None, None))
            continue
        rows = parse_stooq_txt(file_path, symbol)
        if not rows:
            print(f'  SKIP {symbol}: no parseable rows')
            results.append((symbol, 'PARSE_EMPTY', 0, None, None))
            continue
        upsert_universe(cur, symbol, name, exchange)
        upsert_ohlcv(cur, rows)
        first = rows[0]['date']
        last  = rows[-1]['date']
        results.append((symbol, 'OK_LOCAL', len(rows), first, last))
        print(f'  OK   {symbol:<6} {len(rows):>5} rows  {first} → {last}')

    # ── ABB via yfinance (ABBN.SW — Swiss listing; USD-equivalent momentum) ──
    # ABB.US unavailable on Yahoo Finance; ABBN.SW prices used for breadth/MA50.
    # % momentum is FX-neutral within each period; suitable for basket RS calc.
    print('  Fetching ABB via yfinance (ABBN.SW)...')
    try:
        abb_rows = fetch_yfinance('ABBN.SW')
        # Relabel as ABB for DB consistency with tower layer basket
        for r in abb_rows:
            r['symbol'] = 'ABB'
            r['source'] = 'yfinance_ABBN.SW'
        if abb_rows:
            upsert_universe(cur, 'ABB', 'ABB Ltd', 'NYSE', 'Industrials')
            upsert_ohlcv(cur, abb_rows)
            first = abb_rows[0]['date']
            last  = abb_rows[-1]['date']
            results.append(('ABB', 'OK_YFINANCE', len(abb_rows), first, last))
            print(f'  OK   ABB    {len(abb_rows):>5} rows  {first} → {last}')
        else:
            results.append(('ABB', 'YFINANCE_EMPTY', 0, None, None))
            print('  FAIL ABB: yfinance returned empty')
    except Exception as e:
        results.append(('ABB', f'ERROR: {e}', 0, None, None))
        print(f'  FAIL ABB: {e}')

    conn.commit()
    conn.close()

    print(f'\n{"Symbol":<6} {"Status":<16} {"Rows":>6} {"First":>12} {"Last":>12}')
    print('-' * 58)
    for sym, status, n, first, last in results:
        print(f'{sym:<6} {status:<16} {n:>6} {str(first or "-"):>12} {str(last or "-"):>12}')


if __name__ == '__main__':
    main()
