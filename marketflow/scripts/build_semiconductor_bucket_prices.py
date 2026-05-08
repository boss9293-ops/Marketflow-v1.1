# 반도체 버킷 가격 프록시 인덱스를 계산해 캐시에 저장하는 스크립트
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import pandas as pd
import numpy as np

ROOT            = Path(__file__).resolve().parent.parent.parent
DB_PATH         = ROOT / 'marketflow/backend/data/cache.db'
SERIES_CACHE    = ROOT / 'marketflow/backend/output/cache/semiconductor_series_data_latest.json'
BUCKET_CFG      = ROOT / 'marketflow/config/semiconductor_buckets.json'
OUT_PATH        = ROOT / 'marketflow/backend/output/cache/semiconductor_bucket_prices_latest.json'

MIN_SERIES_POINTS = 60

BucketStatus = Literal['CACHE', 'PARTIAL', 'PENDING']


def load_series_cache() -> dict[str, list[tuple[str, float]]]:
    """Load semiconductor_series_data_latest.json if available."""
    if not SERIES_CACHE.exists():
        return {}
    with open(SERIES_CACHE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result: dict[str, list[tuple[str, float]]] = {}
    for sym, info in data.get('tickers', {}).items():
        if info.get('status') in ('CACHE', 'PARTIAL'):
            result[sym] = [(r['date'], r['close']) for r in info.get('series', [])]
    return result


def load_series_from_cache_map(cache_map: dict, symbol: str) -> pd.Series:
    rows = cache_map.get(symbol, [])
    if not rows:
        return pd.Series(dtype=float, name=symbol)
    idx  = pd.to_datetime([r[0] for r in rows])
    vals = [r[1] for r in rows]
    return pd.Series(vals, index=idx, name=symbol, dtype=float)


def load_series_from_db(cur, symbol: str) -> pd.Series:
    cur.execute(
        'SELECT date, value FROM series_data WHERE symbol=? ORDER BY date',
        (symbol,)
    )
    rows = cur.fetchall()
    if not rows:
        return pd.Series(dtype=float, name=symbol)
    idx  = pd.to_datetime([r[0] for r in rows])
    vals = [r[1] for r in rows]
    return pd.Series(vals, index=idx, name=symbol, dtype=float)


def normalize_to_base100(series: pd.Series) -> pd.Series:
    """Rebase series to 100 at first valid value."""
    first = series.dropna().iloc[0] if not series.dropna().empty else None
    if first is None or first == 0:
        return series
    return series / first * 100.0


def build_bucket_index(
    ticker_series: dict[str, pd.Series],
    weights: dict[str, float],
    available: list[str],
) -> pd.Series:
    """Weighted average of normalized ticker series, on common dates."""
    normed = {t: normalize_to_base100(ticker_series[t]) for t in available}
    # Align to common index
    df = pd.DataFrame(normed)
    df = df.dropna(how='all')
    # Re-normalize weights for available tickers
    total_w = sum(weights[t] for t in available)
    if total_w == 0:
        return pd.Series(dtype=float)
    index = pd.Series(0.0, index=df.index)
    for t in available:
        w = weights[t] / total_w
        index = index + df[t].ffill() * w
    return index.dropna()


def to_series_records(s: pd.Series) -> list[dict]:
    return [
        {'date': dt.strftime('%Y-%m-%d'), 'value': round(float(v), 4)}
        for dt, v in s.items()
        if not (v is None or np.isnan(v))
    ]


def main():
    if not BUCKET_CFG.exists():
        print(f'ERROR: bucket config not found: {BUCKET_CFG}')
        return

    with open(BUCKET_CFG, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    # Primary source: semiconductor_series_data_latest.json
    series_cache = load_series_cache()
    source_label = 'semiconductor_series_data' if series_cache else 'series_data'
    if series_cache:
        print(f'  Using series cache: {SERIES_CACHE.name} ({len(series_cache)} tickers)')
    else:
        print('  Series cache missing — falling back to cache.db series_data')

    # Fallback: cache.db series_data
    db  = sqlite3.connect(str(DB_PATH)) if DB_PATH.exists() else None
    cur = db.cursor() if db else None

    def load_series(symbol: str) -> pd.Series:
        if series_cache:
            return load_series_from_cache_map(series_cache, symbol)
        if cur:
            return load_series_from_db(cur, symbol)
        return pd.Series(dtype=float, name=symbol)

    buckets_out: list[dict] = []

    for bucket_id, bucket_def in cfg.items():
        label    = bucket_def['label']
        tickers  = bucket_def['tickers']
        weights  = bucket_def['weights']

        available: list[str] = []
        missing:   list[str] = []
        ticker_series: dict[str, pd.Series] = {}

        for t in tickers:
            s = load_series(t)
            if len(s) >= MIN_SERIES_POINTS:
                available.append(t)
                ticker_series[t] = s
            else:
                missing.append(t)

        if not available:
            status: BucketStatus = 'PENDING'
            series_records: list[dict] = []
            note = f'All tickers missing: {", ".join(missing)}'
        elif missing:
            status = 'PARTIAL'
            idx = build_bucket_index(ticker_series, weights, available)
            series_records = to_series_records(idx)
            note = f'Partial — missing tickers: {", ".join(missing)}'
        else:
            status = 'CACHE'
            idx = build_bucket_index(ticker_series, weights, available)
            series_records = to_series_records(idx)
            note = 'All tickers available'

        print(f'  {label}: status={status}, available={available}, missing={missing}, pts={len(series_records)}')

        buckets_out.append({
            'id':               bucket_id,
            'label':            label,
            'status':           status,
            'availableTickers': available,
            'missingTickers':   missing,
            'series':           series_records,
            'note':             note,
        })

    if db:
        db.close()

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source':      source_label,
        'buckets':     buckets_out,
        'note':        'Bucket prices are normalized proxy indices (base 100, weighted average of constituent tickers).',
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'OK: bucket prices written → {OUT_PATH}')


if __name__ == '__main__':
    main()
