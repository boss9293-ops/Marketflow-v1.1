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

DB_PATH  = ROOT / 'marketflow/backend/data/cache.db'
OUT_PATH = ROOT / 'marketflow/backend/output/cache/rrg_paths_latest.json'

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


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found: {DB_PATH}')
        return

    db  = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()

    qqq_series = load_series(cur, 'QQQ')
    spy_series = load_series(cur, 'SPY')
    db.close()

    series_list: list[dict] = []
    has_benchmark_path = False

    # ── QQQ vs SPY — calculable with full series ─────────────────────────
    if len(qqq_series) >= 252 and len(spy_series) >= 252:
        df = calc_rrg_candidate_d(qqq_series, spy_series)
        points = to_weekly_points(df, LOOKBACK_WEEKS)
        if points:
            last = points[-1]
            cur_q = quadrant(last['rsRatio'], last['rsMomentum'])
            series_list.append({
                'id':        'qqq_vs_spy',
                'label':     'QQQ vs SPY',
                'benchmark': 'SPY',
                'source':    'LOCAL_DB',
                'quadrant':  cur_q,
                'direction': 'Pending',   # inferDirection lives in UI layer
                'points':    points,
                'note':      'Full Candidate-D path from series_data (daily → weekly resampled)',
            })
            has_benchmark_path = True
            print(f'  QQQ vs SPY: {len(points)}W points, latest quadrant={cur_q}')
    else:
        print('  QQQ or SPY series too short — skipping QQQ vs SPY')

    # ── Semiconductor buckets — all PENDING (no bucket price series yet) ─
    BUCKET_PENDING = [
        ('ai_compute',       'AI Compute',        'SOXX', 'No AI Compute bucket price series in local DB'),
        ('memory_hbm',       'Memory / HBM',       'SOXX', 'No Memory/HBM bucket price series in local DB'),
        ('foundry_pkg',      'Foundry / Pkg',      'SOXX', 'No Foundry/Pkg bucket price series in local DB'),
        ('equipment',        'Equipment',          'SOXX', 'No Equipment bucket price series in local DB'),
        ('soxx_vs_qqq',      'SOXX vs QQQ',        'QQQ',  'SMH/SOXX not in series_data — adding to series_data is next step'),
        ('soxx_vs_spy',      'SOXX vs SPY',        'SPY',  'SMH/SOXX not in series_data — adding to series_data is next step'),
    ]
    for id_, label, bm, note in BUCKET_PENDING:
        series_list.append(pending_series(id_, label, bm, note))

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'benchmark':   'SOXX',
        'lookback':    f'{LOOKBACK_WEEKS}W',
        'series':      series_list,
        'dataStatus': {
            'hasBenchmarkPath': has_benchmark_path,
            'hasBucketPath':    False,
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
    print(f'    hasBenchmarkPath={has_benchmark_path}  hasBucketPath=False')


if __name__ == '__main__':
    main()
