# AI 인프라 병목 버킷 basket index RRG 경로 계산 — Candidate-D 공식 재사용
import sys
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / 'marketflow/backend/scripts'))
from rrg_candidate_d import calc_rrg_candidate_d, quadrant  # type: ignore

DB_PATH  = ROOT / 'marketflow/data/marketflow.db'
OUT_PATH = ROOT / 'marketflow/backend/output/cache/bottleneck_rrg_latest.json'

LOOKBACK_WEEKS = 24
MIN_ROWS       = 252       # same threshold as build_rrg_paths.py

# ── Bucket definitions (mirrors aiInfraBucketMap.ts) ─────────────────────────
# Each bucket: id, display_name, stage_pos (1-5), benchmark, symbols
BUCKETS = [
    {'id': 'AI_CHIP',          'name': 'AI Chip',                  'pos': 1, 'bm': 'SOXX', 'symbols': ['NVDA','AMD','AVGO','MRVL']},
    {'id': 'HBM_MEMORY',       'name': 'HBM Memory',               'pos': 2, 'bm': 'SOXX', 'symbols': ['MU']},
    {'id': 'PACKAGING',        'name': 'Advanced Packaging',       'pos': 2, 'bm': 'SOXX', 'symbols': ['AMAT','KLAC','ACMR','TSM']},
    {'id': 'COOLING',          'name': 'Cooling',                  'pos': 3, 'bm': 'SOXX', 'symbols': ['VRT','ETN','TT','MOD','NVT']},
    {'id': 'PCB_SUBSTRATE',    'name': 'PCB & Substrate',          'pos': 3, 'bm': 'SOXX', 'symbols': ['TTM','SANM','CLS','FLEX']},
    {'id': 'TEST_EQUIPMENT',   'name': 'Test Equipment',           'pos': 3, 'bm': 'SOXX', 'symbols': ['TER','COHU','FORM','KLAC','ONTO']},
    {'id': 'GLASS_SUBSTRATE',  'name': 'Glass Substrate',          'pos': 3, 'bm': 'SOXX', 'symbols': ['GLW','AMAT']},
    {'id': 'OPTICAL_NETWORK',  'name': 'Optical Network',          'pos': 3, 'bm': 'QQQ',  'symbols': ['ANET','CIEN','LITE','COHR','AVGO']},
    {'id': 'POWER_INFRA',      'name': 'Power Infrastructure',     'pos': 4, 'bm': 'SPY',  'symbols': ['ETN','PWR','HUBB','GEV','VRT','NVT']},
    {'id': 'CLEANROOM_WATER',  'name': 'Cleanroom & Water',        'pos': 4, 'bm': 'SPY',  'symbols': ['ACMR','XYL','ECL','WTS']},
    {'id': 'SPECIALTY_GAS',    'name': 'Specialty Gas',            'pos': 4, 'bm': 'SPY',  'symbols': ['LIN','APD','ENTG','CCMP']},
    {'id': 'DATA_CENTER_INFRA','name': 'Data Center Infrastructure','pos': 5, 'bm': 'SPY',  'symbols': ['EQIX','DLR','IRM','VRT']},
    {'id': 'RAW_MATERIAL',     'name': 'Raw Material',             'pos': 5, 'bm': 'SPY',  'symbols': ['FCX','SCCO','TECK','COPX']},
]

BENCHMARKS = ['SOXX', 'QQQ', 'SPY']


def load_ohlcv(cur, symbol: str) -> pd.Series:
    cur.execute(
        '''SELECT date, COALESCE(adj_close, close) AS price
           FROM ohlcv_daily
           WHERE symbol=? AND COALESCE(adj_close, close) IS NOT NULL
             AND COALESCE(adj_close, close) > 0
           ORDER BY date''',
        (symbol,)
    )
    rows = cur.fetchall()
    if not rows:
        return pd.Series(dtype=float, name=symbol)
    idx  = pd.to_datetime([r[0] for r in rows])
    vals = [float(r[1]) for r in rows]
    return pd.Series(vals, index=idx, name=symbol, dtype=float)


def build_basket_series(series_map: dict[str, pd.Series], symbols: list[str]) -> pd.Series | None:
    """Equal-weight basket index, normalized to 100 at first common date."""
    valid = {s: series_map[s] for s in symbols if s in series_map and len(series_map[s]) > 0}
    if not valid:
        return None

    # Align on common dates
    aligned = pd.DataFrame(valid).dropna(how='all')
    if aligned.empty:
        return None

    # Fill gaps forward within each symbol (handles sparse tickers)
    aligned = aligned.ffill().bfill()
    aligned = aligned.dropna(how='any')

    if len(aligned) < MIN_ROWS:
        return None

    # Normalize each column to 100 at first row, then average
    normed = (aligned / aligned.iloc[0]) * 100
    basket = normed.mean(axis=1)
    return basket.rename('basket')


def to_weekly_points(df: pd.DataFrame, n_weeks: int = LOOKBACK_WEEKS) -> list[dict]:
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


def pending_series(bucket_id: str, name: str, bm: str, note: str) -> dict:
    return {
        'id':        bucket_id,
        'label':     name,
        'benchmark': bm,
        'source':    'PENDING',
        'quadrant':  'Pending',
        'direction': 'Pending',
        'points':    [],
        'note':      note,
    }


def calc_bucket_series(bucket: dict, series_map: dict[str, pd.Series],
                       bm_series: pd.Series) -> dict:
    basket = build_basket_series(series_map, bucket['symbols'])
    if basket is None:
        sym_avail = [s for s in bucket['symbols'] if s in series_map and len(series_map[s]) > 0]
        return pending_series(
            bucket['id'], bucket['name'], bucket['bm'],
            f'Basket insufficient: {len(sym_avail)}/{len(bucket["symbols"])} symbols, need {MIN_ROWS}+ rows'
        )

    if len(bm_series) < MIN_ROWS:
        return pending_series(bucket['id'], bucket['name'], bucket['bm'],
                              f'Benchmark {bucket["bm"]} insufficient rows')

    # Align basket and benchmark
    df_both = pd.DataFrame({'basket': basket, 'bm': bm_series}).dropna()
    if len(df_both) < MIN_ROWS:
        return pending_series(bucket['id'], bucket['name'], bucket['bm'],
                              f'Only {len(df_both)} aligned rows after join (need {MIN_ROWS}+)')

    try:
        rrg_df = calc_rrg_candidate_d(df_both['basket'], df_both['bm'])
        points = to_weekly_points(rrg_df, LOOKBACK_WEEKS)
        if not points:
            return pending_series(bucket['id'], bucket['name'], bucket['bm'],
                                  'No weekly points after resampling')
        last = points[-1]
        cur_q = quadrant(last['rsRatio'], last['rsMomentum'])
        priced = sum(1 for s in bucket['symbols'] if s in series_map and len(series_map[s]) > 0)
        coverage = f'{priced}/{len(bucket["symbols"])} symbols'
        print(f'  [{bucket["id"]}] vs {bucket["bm"]}: {len(points)}W pts, quadrant={cur_q}, cov={coverage}')
        return {
            'id':        bucket['id'],
            'label':     bucket['name'],
            'benchmark': bucket['bm'],
            'source':    'LOCAL_DB',
            'quadrant':  cur_q,
            'direction': 'Pending',  # D-4에서 direction 계산 추가 예정
            'points':    points,
            'note':      f'Candidate-D basket index. Coverage: {coverage}. Benchmark: {bucket["bm"]}.',
        }
    except Exception as e:
        return pending_series(bucket['id'], bucket['name'], bucket['bm'],
                              f'Calculation error: {e}')


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found at {DB_PATH}')
        return

    conn = sqlite3.connect(str(DB_PATH))
    cur  = conn.cursor()

    # Collect all required tickers
    all_symbols = set(BENCHMARKS)
    for b in BUCKETS:
        all_symbols.update(b['symbols'])

    print(f'Loading {len(all_symbols)} tickers from ohlcv_daily...')
    series_map: dict[str, pd.Series] = {}
    for sym in sorted(all_symbols):
        s = load_ohlcv(cur, sym)
        series_map[sym] = s
        if len(s) > 0:
            print(f'  {sym}: {len(s)} rows  ({s.index[0].date()} → {s.index[-1].date()})')
        else:
            print(f'  {sym}: NO DATA')

    conn.close()

    # Build RRG series for each bucket
    series_out = []
    for bucket in BUCKETS:
        bm_series = series_map.get(bucket['bm'], pd.Series(dtype=float))
        result = calc_bucket_series(bucket, series_map, bm_series)
        series_out.append(result)

    # Summary stats
    live    = [s for s in series_out if s['source'] == 'LOCAL_DB']
    pending = [s for s in series_out if s['source'] == 'PENDING']
    by_q: dict[str, list[str]] = {'Leading':[], 'Weakening':[], 'Lagging':[], 'Improving':[], 'Pending':[]}
    for s in series_out:
        by_q.setdefault(s['quadrant'], []).append(s['id'])

    print(f'\nRRG summary: {len(live)} live, {len(pending)} pending')
    for q, ids in by_q.items():
        if ids: print(f'  {q}: {", ".join(ids)}')

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'benchmark':   'SOXX',   # default display benchmark
        'lookback':    '24W',
        'series':      series_out,
        'dataStatus': {
            'hasBenchmarkPath': any(s['source'] == 'LOCAL_DB' for s in series_out),
            'hasBucketPath':    len(live) > 0,
            'pendingReason':    f'{len(pending)}/{len(BUCKETS)} buckets pending' if pending else None,
        },
        'note': 'AI Bottleneck Radar bucket-level RRG. Candidate-D formula. Equal-weight basket index.',
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'\nOK: bottleneck RRG written → {OUT_PATH}')


if __name__ == '__main__':
    main()
