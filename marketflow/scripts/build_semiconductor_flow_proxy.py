# 반도체 버킷별 거래량 프록시 지표를 계산해 캐시에 저장하는 스크립트
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np

ROOT        = Path(__file__).resolve().parent.parent.parent
DB_PATH     = ROOT / 'marketflow/data/marketflow.db'
BUCKET_CFG  = ROOT / 'marketflow/config/semiconductor_buckets.json'
OUT_PATH    = ROOT / 'marketflow/backend/output/cache/semiconductor_flow_proxy_latest.json'

LOOKBACK_DAYS = 30   # load this many trading days for calcs
AVG_WINDOW    = 20
SHORT_WINDOW  = 5

# Confirmation thresholds
SURGE_THRESHOLD  = 1.30
THIN_THRESHOLD   = 0.80


def load_ohlcv(cur, symbol: str, n_days: int) -> pd.DataFrame:
    cur.execute(
        '''SELECT date,
                  COALESCE(adj_close, close) AS close,
                  volume
           FROM ohlcv_daily
           WHERE symbol=?
             AND COALESCE(adj_close, close) IS NOT NULL
             AND COALESCE(adj_close, close) > 0
             AND volume IS NOT NULL AND volume > 0
           ORDER BY date DESC
           LIMIT ?''',
        (symbol, n_days)
    )
    rows = cur.fetchall()
    if not rows:
        return pd.DataFrame(columns=['date', 'close', 'volume'])
    df = pd.DataFrame(rows, columns=['date', 'close', 'volume'])
    df['date']   = pd.to_datetime(df['date'])
    df['close']  = df['close'].astype(float)
    df['volume'] = df['volume'].astype(float)
    return df.sort_values('date').reset_index(drop=True)


def flow_status(ratio5d: float, return20d: float) -> str:
    if ratio5d >= SURGE_THRESHOLD:
        return 'Confirming' if return20d >= 0 else 'Distribution Pressure'
    if ratio5d >= THIN_THRESHOLD:
        return 'Neutral'
    return 'Thin Participation'


def calc_ticker_metrics(df: pd.DataFrame) -> dict | None:
    if len(df) < AVG_WINDOW + 1:
        return None
    avg20 = df['volume'].iloc[-(AVG_WINDOW):].mean()
    avg5  = df['volume'].iloc[-(SHORT_WINDOW):].mean()
    cur_v = float(df['volume'].iloc[-1])
    r5    = (df['close'].iloc[-1] / df['close'].iloc[-(SHORT_WINDOW + 1)] - 1) * 100  if len(df) >= SHORT_WINDOW + 1 else None
    r20   = (df['close'].iloc[-1] / df['close'].iloc[-(AVG_WINDOW + 1)] - 1) * 100   if len(df) >= AVG_WINDOW + 1 else None
    return {
        'volumeRatioCurrent': round(cur_v / avg20, 3) if avg20 > 0 else None,
        'volumeRatio5D':      round(avg5  / avg20, 3) if avg20 > 0 else None,
        'return5D':           round(r5,  2) if r5  is not None else None,
        'return20D':          round(r20, 2) if r20 is not None else None,
    }


def weighted_avg(values: list[float], weights: list[float]) -> float | None:
    pairs = [(v, w) for v, w in zip(values, weights) if v is not None]
    if not pairs:
        return None
    total_w = sum(w for _, w in pairs)
    if total_w == 0:
        return None
    return sum(v * w for v, w in pairs) / total_w


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found: {DB_PATH}')
        return
    if not BUCKET_CFG.exists():
        print(f'ERROR: bucket config not found: {BUCKET_CFG}')
        return

    with open(BUCKET_CFG, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    db  = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()

    # Check benchmark
    bm_df = load_ohlcv(cur, 'SOXX', LOOKBACK_DAYS)
    bm_name = 'SOXX' if len(bm_df) >= AVG_WINDOW + 1 else 'SMH'
    if bm_name == 'SMH':
        bm_df = load_ohlcv(cur, 'SMH', LOOKBACK_DAYS)
    bm_name = bm_name if len(bm_df) >= AVG_WINDOW + 1 else 'PENDING'
    print(f'  Benchmark: {bm_name} ({len(bm_df)} rows)')

    buckets_out: list[dict] = []
    all_statuses: list[str] = []

    for bucket_id, bucket_def in cfg.items():
        label   = bucket_def['label']
        tickers = bucket_def['tickers']
        weights = bucket_def['weights']

        available: list[str] = []
        missing:   list[str] = []
        ticker_metrics: dict[str, dict] = {}

        for t in tickers:
            df = load_ohlcv(cur, t, LOOKBACK_DAYS)
            m  = calc_ticker_metrics(df)
            if m is None:
                missing.append(t)
                print(f'    {t}: PENDING (insufficient rows: {len(df)})')
            else:
                available.append(t)
                ticker_metrics[t] = m
                print(f'    {t}: vol5D/20D={m["volumeRatio5D"]}, ret20D={m["return20D"]}%')

        if not available:
            status = 'Pending'
            vol5d = None
            vol20d = None
            r5 = None
            r20 = None
            note = f'All tickers missing: {", ".join(missing)}'
        else:
            avail_weights = [weights[t] for t in available]
            vol5d  = weighted_avg([ticker_metrics[t]['volumeRatio5D']      for t in available], avail_weights)
            vol20d = weighted_avg([ticker_metrics[t]['volumeRatioCurrent'] for t in available], avail_weights)
            r5     = weighted_avg([ticker_metrics[t]['return5D']           for t in available], avail_weights)
            r20    = weighted_avg([ticker_metrics[t]['return20D']          for t in available], avail_weights)

            if missing:
                raw_status = flow_status(vol5d, r20 or 0) if vol5d is not None else 'Pending'
                status = 'Partial'
                note   = f'Partial — missing: {", ".join(missing)} · flow={raw_status}'
            else:
                status = flow_status(vol5d, r20 or 0) if vol5d is not None else 'Pending'
                note   = 'All tickers available'

        print(f'  {label}: status={status}, vol5D/20D={vol5d}, ret20D={r20}%')
        all_statuses.append(status)

        buckets_out.append({
            'id':               bucket_id,
            'label':            label,
            'status':           status,
            'volumeRatio5D':    round(vol5d,  3) if vol5d  is not None else None,
            'volumeRatio20D':   round(vol20d, 3) if vol20d is not None else None,
            'return5D':         round(r5,  2) if r5  is not None else None,
            'return20D':        round(r20, 2) if r20 is not None else None,
            'availableTickers': available,
            'missingTickers':   missing,
            'source':           'PENDING' if not available else ('PARTIAL' if missing else 'LOCAL_DB'),
            'note':             note,
        })

    db.close()

    # Summary
    confirming   = [b['label'] for b in buckets_out if b['status'] == 'Confirming']
    weak         = [b['label'] for b in buckets_out if b['status'] == 'Thin Participation']
    distrib      = [b['label'] for b in buckets_out if b['status'] == 'Distribution Pressure']

    if all(s in ('Pending', 'Partial') for s in all_statuses):
        overall = 'Pending'
    elif any(s == 'Confirming' for s in all_statuses):
        overall = 'Confirming' if len(confirming) >= 2 else 'Neutral'
    elif any(s == 'Distribution Pressure' for s in all_statuses):
        overall = 'Distribution Pressure'
    elif any(s == 'Thin Participation' for s in all_statuses):
        overall = 'Thin Participation'
    else:
        overall = 'Neutral'

    kor_parts: list[str] = []
    if confirming: kor_parts.append(f'{", ".join(confirming)}에서 거래량 확인이 강합니다.')
    if weak:       kor_parts.append(f'{", ".join(weak)} 참여도가 약합니다.')
    if distrib:    kor_parts.append(f'{", ".join(distrib)}에서 분산 압력이 감지됩니다.')
    korean = ' '.join(kor_parts) if kor_parts else '거래량 확인 데이터를 집계 중입니다.'

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'benchmark':   bm_name,
        'buckets':     buckets_out,
        'summary': {
            'overallStatus':              overall,
            'confirmingBuckets':          confirming,
            'weakParticipationBuckets':   weak,
            'distributionPressureBuckets': distrib,
            'koreanSummary':              korean,
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'OK: flow proxy written → {OUT_PATH}')
    print(f'    overall={overall}  confirming={confirming}  weak={weak}')


if __name__ == '__main__':
    main()
