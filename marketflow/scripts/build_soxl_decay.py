# SOXL vs SOXX/SMH 이론 3배 수익률 대비 실제 감쇠를 계산해 캐시에 저장하는 스크립트
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT     = Path(__file__).resolve().parent.parent.parent
DB_PATH  = ROOT / 'marketflow/data/marketflow.db'
OUT_PATH = ROOT / 'marketflow/backend/output/cache/soxl_decay_latest.json'

# Lookback windows: (label, approximate trading days)
WINDOWS = [
    ('5D',  5),
    ('1M',  21),
    ('3M',  63),
    ('6M',  126),
    ('1Y',  252),
]
DEFAULT_WINDOW = '3M'

# Status thresholds (pp)
FAVORABLE_PP = 2.0
CAUTION_PP   = -2.0
STRESS_PP    = -8.0


def load_series(cur, symbol: str) -> pd.Series:
    cur.execute(
        '''SELECT date, COALESCE(adj_close, close) AS price
           FROM ohlcv_daily
           WHERE symbol=?
             AND COALESCE(adj_close, close) IS NOT NULL
             AND COALESCE(adj_close, close) > 0
           ORDER BY date ASC''',
        (symbol,)
    )
    rows = cur.fetchall()
    if not rows:
        return pd.Series(dtype=float, name=symbol)
    idx  = pd.to_datetime([r[0] for r in rows])
    vals = [float(r[1]) for r in rows]
    return pd.Series(vals, index=idx, name=symbol, dtype=float)


def decay_status(decay_pp: float) -> str:
    if decay_pp >= FAVORABLE_PP:
        return 'FAVORABLE'
    if decay_pp >= CAUTION_PP:
        return 'NEUTRAL'
    if decay_pp >= STRESS_PP:
        return 'CAUTION'
    return 'STRESS'


def calc_metric(soxl: pd.Series, bm: pd.Series, label: str, n_days: int, bm_name: str) -> dict:
    common = soxl.index.intersection(bm.index)
    soxl_c = soxl.loc[common].dropna()
    bm_c   = bm.loc[common].dropna()

    if len(soxl_c) < n_days + 1:
        return {
            'window': label, 'benchmark': bm_name,
            'actualSoxlReturnPct': None, 'benchmarkReturnPct': None,
            'ideal3xReturnPct': None, 'decayPct': None,
            'status': 'PENDING', 'observations': len(soxl_c),
            'source': 'PENDING', 'note': f'Need {n_days+1} points, have {len(soxl_c)}',
        }

    soxl_w = soxl_c.iloc[-(n_days + 1):]
    bm_w   = bm_c.iloc[-(n_days + 1):]

    actual_soxl = (soxl_w.iloc[-1] / soxl_w.iloc[0] - 1) * 100
    actual_bm   = (bm_w.iloc[-1] / bm_w.iloc[0] - 1) * 100
    ideal_3x    = 3.0 * actual_bm
    decay       = actual_soxl - ideal_3x

    return {
        'window': label,
        'benchmark': bm_name,
        'actualSoxlReturnPct': round(actual_soxl, 2),
        'benchmarkReturnPct':  round(actual_bm, 2),
        'ideal3xReturnPct':    round(ideal_3x, 2),
        'decayPct':            round(decay, 2),
        'status':              decay_status(decay),
        'startDate':           soxl_w.index[0].strftime('%Y-%m-%d'),
        'endDate':             soxl_w.index[-1].strftime('%Y-%m-%d'),
        'observations':        len(soxl_w),
        'source':              'LOCAL_DB',
    }


def korean_summary(decay: float | None, status: str, bm: str, window: str) -> str:
    if decay is None:
        return '감쇠 데이터 대기 중입니다.'
    abs_d = abs(decay)
    window_kr = {'5D': '5거래일', '1M': '1개월', '3M': '3개월', '6M': '6개월', '1Y': '1년'}.get(window, window)
    if status == 'FAVORABLE':
        return (f'최근 {window_kr}간 SOXL 실제 수익률이 {bm} 이론 3배 경로보다 {abs_d:.1f}pp 높습니다. '
                f'변동성 감쇠가 제한적인 환경입니다.')
    if status == 'NEUTRAL':
        return (f'최근 {window_kr}간 SOXL 실제 수익률이 {bm} 이론 3배 수준에 근접합니다. '
                f'감쇠 영향이 크지 않은 환경입니다.')
    if status == 'CAUTION':
        return (f'최근 {window_kr}간 SOXL 실제 수익률이 {bm} 이론 3배보다 {abs_d:.1f}pp 낮습니다. '
                f'변동성 감쇠가 누적되고 있습니다.')
    return (f'최근 {window_kr}간 SOXL 실제 수익률이 {bm} 이론 3배보다 {abs_d:.1f}pp 낮습니다. '
            f'고변동성 구간으로 감쇠 비용이 큽니다.')


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found: {DB_PATH}')
        return

    db  = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()
    soxl_s = load_series(cur, 'SOXL')
    soxx_s = load_series(cur, 'SOXX')
    smh_s  = load_series(cur, 'SMH')
    db.close()

    print(f'  SOXL: {len(soxl_s)} pts  ({soxl_s.index[0].date()} → {soxl_s.index[-1].date()})')
    print(f'  SOXX: {len(soxx_s)} pts  ({soxx_s.index[0].date()} → {soxx_s.index[-1].date()})')
    print(f'  SMH:  {len(smh_s)} pts  ({smh_s.index[0].date()} → {smh_s.index[-1].date()})')

    # Benchmark selection
    if len(soxx_s) >= 252:
        bm, bm_name = soxx_s, 'SOXX'
        print('  Benchmark: SOXX (primary)')
    elif len(smh_s) >= 252:
        bm, bm_name = smh_s, 'SMH'
        print('  Benchmark: SMH (SOXX fallback)')
    else:
        print('  ERROR: no usable benchmark')
        payload = {
            'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'defaultWindow': DEFAULT_WINDOW, 'benchmark': 'PENDING',
            'metrics': [],
            'summary': {
                'currentDecayPct': None, 'status': 'PENDING',
                'label': 'Benchmark unavailable',
                'koreanSummary': '기준 지수 데이터가 없어 감쇠 계산을 할 수 없습니다.',
            },
        }
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return

    metrics = []
    for label, n_days in WINDOWS:
        m = calc_metric(soxl_s, bm, label, n_days, bm_name)
        metrics.append(m)
        d = m['decayPct']
        print(f'  {label}: SOXL={m["actualSoxlReturnPct"]}%  ideal3x={m["ideal3xReturnPct"]}%  decay={d}pp  status={m["status"]}')

    default_m = next((m for m in metrics if m['window'] == DEFAULT_WINDOW), metrics[-1])
    cur_decay  = default_m.get('decayPct')
    cur_status = default_m.get('status', 'PENDING')

    payload = {
        'generatedAt':  datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'defaultWindow': DEFAULT_WINDOW,
        'benchmark':    bm_name,
        'metrics':      metrics,
        'summary': {
            'currentDecayPct': cur_decay,
            'status':          cur_status,
            'label':           f'{DEFAULT_WINDOW} vs ideal 3x {bm_name}',
            'koreanSummary':   korean_summary(cur_decay, cur_status, bm_name, DEFAULT_WINDOW),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'OK: SOXL decay written → {OUT_PATH}')


if __name__ == '__main__':
    main()
