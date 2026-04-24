"""
build_semiconductor_mvp.py  Phase 2A
Reads Tier 1 semiconductor data from ohlcv_daily (existing DB).
Falls back to yfinance for Tier 2 (Samsung/SK Hynix).
Outputs:
  output/semiconductor_mvp_latest.json   — full structured payload
  output/cache/semiconductor_market_data.json — API route compatible
"""
import os
import sys
import json
import sqlite3
import datetime

import io
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import numpy as np


def _find_root():
    _cand = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
    if os.path.exists(os.path.join(_cand, 'data', 'marketflow.db')):
        return _cand
    _dev = r'd:\Youtube_pro\000-Code_develop'
    try:
        for _item in os.listdir(_dev):
            _full = os.path.join(_dev, _item, 'us_market_complete', 'marketflow')
            if os.path.exists(os.path.join(_full, 'data', 'marketflow.db')):
                return _full
    except Exception:
        pass
    return _cand


BASE      = _find_root()
DB_PATH   = os.path.join(BASE, 'data', 'marketflow.db')
CACHE_DIR = os.path.join(BASE, 'backend', 'output', 'cache')
OUT_DIR   = os.path.join(BASE, 'backend', 'output')

TIER1 = ['SOXX', 'SOXL', 'QQQ', 'NVDA', 'AMD', 'AVGO', 'MU', 'TSM', 'ASML', 'AMAT', 'LRCX', 'KLAC']
TIER2 = [('005930.KS', 'samsung'), ('000660.KS', 'skhynix')]

LOOKBACK = 90  # trading days


def pct_return(closes, n):
    if len(closes) < n + 1:
        return 0.0
    return float((closes[-1] / closes[-(n + 1)]) - 1)


def slope_30d(closes):
    if len(closes) < 5:
        return 0.0
    s = closes[-30:] if len(closes) >= 30 else closes
    x = np.arange(len(s))
    slope = np.polyfit(x, s, 1)[0]
    mean_p = float(np.mean(s))
    return float(slope / mean_p) if mean_p > 0 else 0.0


def above_20dma(closes):
    if len(closes) < 20:
        return True
    return float(closes[-1]) > float(np.mean(closes[-20:]))


def load_from_db(symbols: list[str]) -> dict:
    """Load last LOOKBACK trading days for each symbol from ohlcv_daily."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    result = {}
    for sym in symbols:
        cur.execute(
            "SELECT date, adj_close FROM ohlcv_daily "
            "WHERE symbol = ? AND adj_close IS NOT NULL "
            "ORDER BY date DESC LIMIT ?",
            (sym, LOOKBACK)
        )
        rows = cur.fetchall()
        if len(rows) < 5:
            print(f'  DB MISSING: {sym} ({len(rows)} rows)')
            result[sym] = None
            continue
        rows.sort(key=lambda r: r[0])
        closes = np.array([r[1] for r in rows], dtype=float)
        price = float(closes[-1])
        entry = {
            'ticker':      sym,
            'price':       round(price, 2),
            'return_5d':   round(pct_return(closes, 5), 6),
            'return_20d':  round(pct_return(closes, 20), 6),
            'return_30d':  round(pct_return(closes, 30), 6),
            'return_60d':  round(pct_return(closes, 60), 6),
            'above_20dma': above_20dma(closes),
            'slope_30d':   round(slope_30d(closes), 6),
            'as_of':       rows[-1][0],
        }
        result[sym] = entry
        print(f'  {sym}: price={price:.2f} r60d={entry["return_60d"]:+.1%} (DB)')
    conn.close()
    return result


def load_tier2_yfinance() -> dict:
    """Fetch Tier 2 Korean stocks via yfinance (not in DB)."""
    try:
        import yfinance as yf
    except ImportError:
        print('  yfinance not installed — tier2 unavailable')
        return {'available': False, 'samsung_trend': None, 'skhynix_trend': None}

    out = {'available': False, 'samsung_trend': None, 'skhynix_trend': None}
    name_map = {'samsung': 'samsung_trend', 'skhynix': 'skhynix_trend'}

    for sym, key in TIER2:
        try:
            data = yf.download(sym, period='3mo', auto_adjust=True, progress=False)
            if data.empty or 'Close' not in data.columns:
                continue
            closes = data['Close'].dropna().values
            if len(closes) < 5:
                continue
            s = slope_30d(closes)
            trend = 'POSITIVE' if s > 0.002 else 'NEGATIVE' if s < -0.002 else 'FLAT'
            out[name_map[key]] = trend
            out['available'] = True
            print(f'  {sym}: trend={trend} (yfinance)')
        except Exception as e:
            print(f'  Tier2 {sym} error: {e}')

    return out


def build_structured_payload(tickers: dict, tier2: dict, as_of: str, source: str) -> dict:
    """Full structured payload for semiconductor_mvp_latest.json."""
    coverage = {
        'db':   [s for s, v in tickers.items() if v is not None],
        'missing': [s for s, v in tickers.items() if v is None],
    }
    clean_tickers = {s: v for s, v in tickers.items() if v is not None}
    return {
        'as_of':       as_of,
        'generated_at': datetime.datetime.utcnow().isoformat() + 'Z',
        'data_source': source,
        'coverage':    coverage,
        'tickers':     clean_tickers,
        'tier2':       tier2,
    }


def build_api_payload(tickers: dict, tier2: dict, as_of: str) -> dict:
    """API-compatible payload (matches MarketDataInput in types.ts)."""
    clean = {}
    for s, v in tickers.items():
        if v is None:
            continue
        clean[s] = {k: v[k] for k in ['ticker', 'price', 'return_5d', 'return_20d', 'return_30d', 'return_60d', 'above_20dma', 'slope_30d']}
    return {
        'as_of':   as_of,
        'tickers': clean,
        'tier2':   tier2,
    }


def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    as_of = datetime.date.today().isoformat()
    print(f'Building semiconductor MVP data (Phase 2A) — {as_of}')
    print(f'DB: {DB_PATH}')

    print('\n[Tier 1 — DB]')
    tickers = load_from_db(TIER1)

    print('\n[Tier 2 — yfinance fallback]')
    tier2 = load_tier2_yfinance()

    # Determine as_of from DB data (use latest date found)
    db_dates = [v['as_of'] for v in tickers.values() if v and 'as_of' in v]
    if db_dates:
        as_of = max(db_dates)

    mvp_payload = build_structured_payload(tickers, tier2, as_of, 'db+yfinance_tier2')
    api_payload  = build_api_payload(tickers, tier2, as_of)

    mvp_path = os.path.join(OUT_DIR, 'semiconductor_mvp_latest.json')
    api_path = os.path.join(CACHE_DIR, 'semiconductor_market_data.json')

    with open(mvp_path, 'w', encoding='utf-8') as f:
        json.dump(mvp_payload, f, ensure_ascii=False, indent=2)

    with open(api_path, 'w', encoding='utf-8') as f:
        json.dump(api_payload, f, ensure_ascii=False, indent=2)

    found = len(mvp_payload['coverage']['db'])
    missing = mvp_payload['coverage']['missing']
    print(f'\nWritten: {mvp_path}')
    print(f'Written: {api_path}')
    print(f'Tier1: {found}/12 from DB | Missing: {missing or "none"}')
    print(f'Tier2 available: {tier2["available"]}')
    print(f'as_of: {as_of}')


if __name__ == '__main__':
    main()
