# 반도체 RRG 히스토리컬 경로 캐시를 빌드하는 스크립트 (Candidate-D 공식 재사용)
import sys
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np  # noqa: F401 — needed by rrg_candidate_d

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / 'marketflow/backend/scripts'))
from rrg_candidate_d import calc_rrg_candidate_d, quadrant  # type: ignore

DB_PATH         = ROOT / 'marketflow/backend/data/cache.db'
OUT_PATH        = ROOT / 'marketflow/backend/output/cache/rrg_paths_latest.json'
BUCKET_PRICES   = ROOT / 'marketflow/backend/output/cache/semiconductor_bucket_prices_latest.json'

LOOKBACK_WEEKS = 24


def load_series(cur, symbol: str) -> 'pd.Series':
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


def to_weekly_points(df: pd.DataFrame, n_weeks: int = LOOKBACK_WEEKS) -> list[dict]:
    """Resample daily RRG DataFrame to weekly (last trading day), return n_weeks points."""
    weekly = df.resample('W-FRI').last().dropna(subset=['rs_ratio', 'rs_momentum'])
    recent = weekly.tail(n_weeks)
    points = []
    for dt, row in recent.iterrows():
        points.append({
            'date':       dt.strftime('%Y-%m-%d'),
            'rsRatio':    round(float(row['rs_ratio']),    3),
            'rsMomentum': round(float(row['rs_momentum']), 3),
        })
    return points


def pending_series(id_: str, label: str, bm: str, note: str) -> dict:
    return {
        'id':        id_,
        'label':     label,
        'benchmark': bm,
        'source':    'PENDING',
        'quadrant':  'Pending',
        'direction': 'Pending',
        'points':    [],
        'note':      note,
    }


def load_from_series_cache(cache_path: Path) -> dict[str, pd.Series]:
    """Load ticker series from semiconductor_series_data_latest.json."""
    if not cache_path.exists():
        return {}
    with open(cache_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result: dict[str, pd.Series] = {}
    for sym, info in data.get('tickers', {}).items():
        rows = info.get('series', [])
        if rows and info.get('status') in ('CACHE', 'PARTIAL'):
            idx  = pd.to_datetime([r['date'] for r in rows])
            vals = [r['close'] for r in rows]
            result[sym] = pd.Series(vals, index=idx, name=sym, dtype=float)
    return result


SERIES_CACHE = ROOT / 'marketflow/backend/output/cache/semiconductor_series_data_latest.json'


def calc_bucket_rrg(bucket_s: pd.Series, benchmark_s: pd.Series,
                    series_id: str, label: str, bm: str, src: str) -> dict:
    if len(bucket_s) < 252 or len(benchmark_s) < 252:
        return pending_series(series_id, label, bm, 'Insufficient data points for Candidate-D')
    try:
        df  = calc_rrg_candidate_d(bucket_s, benchmark_s)
        pts = to_weekly_points(df, LOOKBACK_WEEKS)
        if not pts:
            return pending_series(series_id, label, bm, 'No weekly points after resampling')
        last  = pts[-1]
        cur_q = quadrant(last['rsRatio'], last['rsMomentum'])
        print(f'  {label} vs {bm}: {len(pts)}W pts, quadrant={cur_q}')
        return {
            'id': series_id, 'label': label, 'benchmark': bm, 'source': src,
            'quadrant': cur_q, 'direction': 'Pending',
            'points': pts,
            'note': f'Candidate-D proxy path. Source: {src}',
        }
    except Exception as e:
        return pending_series(series_id, label, bm, f'Calculation error: {e}')


def main():
    # Load ticker series (semiconductor cache first, then DB)
    ticker_cache = load_from_series_cache(SERIES_CACHE)
    if ticker_cache:
        print(f'  Loaded series cache: {len(ticker_cache)} tickers')
        qqq_series = ticker_cache.get('QQQ', pd.Series(dtype=float))
        spy_series = ticker_cache.get('SPY', pd.Series(dtype=float))
        soxx_series = ticker_cache.get('SOXX', pd.Series(dtype=float))
    else:
        if not DB_PATH.exists():
            print(f'ERROR: DB not found: {DB_PATH}')
            return
        db  = sqlite3.connect(str(DB_PATH))
        cur = db.cursor()
        qqq_series  = load_series(cur, 'QQQ')
        spy_series  = load_series(cur, 'SPY')
        soxx_series = pd.Series(dtype=float)
        db.close()

    series_list: list[dict] = []
    has_benchmark_path = False

    # ── QQQ vs SPY ────────────────────────────────────────────────────────
    if len(qqq_series) >= 252 and len(spy_series) >= 252:
        result = calc_bucket_rrg(qqq_series, spy_series, 'qqq_vs_spy', 'QQQ vs SPY', 'SPY',
                                 'LOCAL_DB' if not ticker_cache else 'CACHE')
        if result.get('source') != 'PENDING':
            has_benchmark_path = True
        series_list.append(result)
    else:
        print('  QQQ or SPY series too short — skipping QQQ vs SPY')

    # ── Semiconductor buckets — from bucket price cache ───────────────────
    has_bucket_path = False
    bucket_map: dict[str, dict] = {}
    if BUCKET_PRICES.exists():
        with open(BUCKET_PRICES, 'r', encoding='utf-8') as f:
            bp_cache = json.load(f)
        for b in bp_cache.get('buckets', []):
            bucket_map[b['id']] = b

    BUCKET_DEFS = [
        ('aiCompute',        'ai_compute',  'AI Compute',   'SOXX'),
        ('memoryHbm',        'memory_hbm',  'Memory / HBM', 'SOXX'),
        ('foundryPackaging', 'foundry_pkg', 'Foundry / Pkg','SOXX'),
        ('equipment',        'equipment',   'Equipment',    'SOXX'),
    ]

    has_soxx = len(soxx_series) >= 252

    for cfg_id, series_id, label, bm in BUCKET_DEFS:
        b = bucket_map.get(cfg_id)
        if b and b.get('status') in ('CACHE', 'PARTIAL') and len(b.get('series', [])) >= 252:
            raw       = b['series']
            idx       = pd.to_datetime([r['date'] for r in raw])
            vals      = [r['value'] for r in raw]
            bucket_s  = pd.Series(vals, index=idx, name=series_id, dtype=float)

            if has_soxx:
                result = calc_bucket_rrg(bucket_s, soxx_series, series_id, label, bm, 'CACHE')
                if result.get('source') != 'PENDING':
                    has_bucket_path = True
                series_list.append(result)
            else:
                note_str = f'{b.get("status")} bucket price available but SOXX benchmark missing'
                series_list.append(pending_series(series_id, label, bm, note_str))
        else:
            note_str = (b.get('note') or 'Bucket price series pending') if b else 'Bucket price cache missing'
            series_list.append(pending_series(series_id, label, bm, note_str))

    # ── SOXX vs QQQ / SOXX vs SPY ────────────────────────────────────────
    if has_soxx and len(qqq_series) >= 252:
        r = calc_bucket_rrg(soxx_series, qqq_series, 'soxx_vs_qqq', 'SOXX vs QQQ', 'QQQ', 'CACHE')
        if r.get('source') != 'PENDING':
            has_benchmark_path = True
        series_list.append(r)
    else:
        series_list.append(pending_series('soxx_vs_qqq', 'SOXX vs QQQ', 'QQQ',
                                          'SOXX or QQQ series insufficient'))
    if has_soxx and len(spy_series) >= 252:
        r = calc_bucket_rrg(soxx_series, spy_series, 'soxx_vs_spy', 'SOXX vs SPY', 'SPY', 'CACHE')
        if r.get('source') != 'PENDING':
            has_benchmark_path = True
        series_list.append(r)
    else:
        series_list.append(pending_series('soxx_vs_spy', 'SOXX vs SPY', 'SPY',
                                          'SOXX or SPY series insufficient'))

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'benchmark':   'SOXX',
        'lookback':    f'{LOOKBACK_WEEKS}W',
        'series':      series_list,
        'dataStatus': {
            'hasBenchmarkPath': has_benchmark_path,
            'hasBucketPath':    has_bucket_path,
            'pendingReason':    (
                None if has_benchmark_path
                else 'No usable symbol pairs in series_data for benchmark path'
            ),
        },
        'note': (
            'Semiconductor bucket paths require bucket-level price series (C-5C). '
            'SOXX/SMH requires series_data entry. '
            'QQQ vs SPY path uses full Candidate-D formula.'
        ),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'OK: RRG paths written → {OUT_PATH}')
    print(f'    hasBenchmarkPath={has_benchmark_path}  hasBucketPath={has_bucket_path}')


if __name__ == '__main__':
    main()
