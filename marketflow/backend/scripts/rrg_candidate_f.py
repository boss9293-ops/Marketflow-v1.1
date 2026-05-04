"""
MarketFlow RRG — Candidate F
Z-score normalization + fixed multiplier 10 + ROC momentum.
Based on public RRG methodology (RRGPy / RRG-Lite).

Formula:
  RS          = 100 * AdjClose_sym / AdjClose_bench
  z_rs        = (RS - rolling_mean(RS,N).shift(1)) / rolling_std(RS,N,ddof=0).shift(1)
  RS_Ratio    = 100 + Kx * z_rs

  RSR_ROC     = 100 * (RS_Ratio / RS_Ratio.shift(M) - 1)
  z_roc       = (RSR_ROC - rolling_mean(RSR_ROC,N).shift(1)) / rolling_std(RSR_ROC,N,ddof=0).shift(1)
  RS_Momentum = 100 + Ky * z_roc

Presets:
  daily:  N=65, M=10, Kx=10, Ky=10
  weekly: N=52, M=5,  Kx=10, Ky=10

Rules:
  - adj_close only (no raw close)
  - .shift(1) on all rolling stats (no look-ahead)
  - ddof=0 throughout
  - no forward-fill
  - no universe-dependent Kx/Ky
"""
import math
import pandas as pd
import numpy as np
from rrg_presets import PRESETS, EPSILON


def _classify_quadrant(rsr: float, rsm: float) -> str:
    if rsr >= 100 and rsm >= 100: return 'leading'
    if rsr >= 100 and rsm <  100: return 'weakening'
    if rsr <  100 and rsm <  100: return 'lagging'
    return 'improving'


def calc_rrg_candidate_f(
    symbol_close: pd.Series,
    benchmark_close: pd.Series,
    timeframe: str = 'daily',
) -> pd.DataFrame:
    """
    Candidate F main calculation.

    Returns DataFrame with columns:
      rs, rs_ratio, rs_momentum, quadrant
    Index: DatetimeIndex (date)
    """
    if timeframe not in PRESETS:
        timeframe = 'daily'
    p  = PRESETS[timeframe]
    N  = p['N']
    M  = p['M']
    Kx = p['Kx']
    Ky = p['Ky']

    # Step 0: inner join, drop NaN — no forward-fill
    common = symbol_close.index.intersection(benchmark_close.index)
    sym   = symbol_close.loc[common].copy()
    bench = benchmark_close.loc[common].copy()
    mask  = sym.notna() & bench.notna() & (bench != 0)
    sym   = sym[mask]
    bench = bench[mask]

    # Step 1: Relative Strength (linear ratio)
    RS = 100.0 * sym / bench

    # Step 2: RS-Ratio via z-score
    rs_mean = RS.rolling(window=N, min_periods=N).mean().shift(1)
    rs_std  = RS.rolling(window=N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    z_rs    = (RS - rs_mean) / rs_std
    RS_Ratio = 100.0 + Kx * z_rs

    # Step 3: ROC of RS_Ratio
    RSR_ROC = 100.0 * (RS_Ratio / RS_Ratio.shift(M) - 1.0)

    # Step 4: RS-Momentum via z-score of ROC
    roc_mean = RSR_ROC.rolling(window=N, min_periods=N).mean().shift(1)
    roc_std  = RSR_ROC.rolling(window=N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    z_roc    = (RSR_ROC - roc_mean) / roc_std
    RS_Momentum = 100.0 + Ky * z_roc

    # Step 5: assemble — use index directly (no unsafe index[mask] construction)
    result = pd.DataFrame({
        'rs':          RS,
        'rs_ratio':    RS_Ratio,
        'rs_momentum': RS_Momentum,
    })
    result = result.dropna(subset=['rs_ratio', 'rs_momentum'])
    result['quadrant'] = result.apply(
        lambda row: _classify_quadrant(row['rs_ratio'], row['rs_momentum']),
        axis=1,
    )
    result.index.name = 'date'
    return result


def calc_energy_metrics(result: pd.DataFrame, n_tail: int = 10) -> dict:
    """Energy metrics from the latest n_tail points."""
    tail = result.tail(n_tail)
    if len(tail) < 2:
        return {}
    latest = tail.iloc[-1]
    dx = float(latest['rs_ratio']) - 100.0
    dy = float(latest['rs_momentum']) - 100.0
    raw_dist = math.sqrt(dx**2 + dy**2)
    angle    = math.atan2(dy, dx) * 180.0 / math.pi

    if raw_dist < 1.0:   zone = 'neutral'
    elif raw_dist < 4.0: zone = 'active'
    else:                zone = 'extreme'

    pts = tail.tail(3)
    tdx = float(pts.iloc[-1]['rs_ratio'])    - float(pts.iloc[0]['rs_ratio'])
    tdy = float(pts.iloc[-1]['rs_momentum']) - float(pts.iloc[0]['rs_momentum'])
    speed = math.sqrt(tdx**2 + tdy**2) / max(len(pts) - 1, 1)

    return {
        'raw_distance': round(raw_dist, 3),
        'angle':        round(angle, 1),
        'energy_zone':  zone,
        'tail_speed':   round(speed, 4),
        'tail_angle':   round(math.atan2(tdy, tdx) * 180.0 / math.pi, 1),
        'quadrant':     _classify_quadrant(float(latest['rs_ratio']), float(latest['rs_momentum'])),
    }


def run_self_test(load_fn) -> dict:
    """SPY vs SPY — all valid rows should be (100.0, 100.0) ±0.01."""
    spy = load_fn('SPY')
    if spy is None or len(spy) < 100:
        return {'pass': False, 'reason': 'SPY data load failed'}
    df = calc_rrg_candidate_f(spy, spy, 'daily')
    valid = df.dropna()
    if len(valid) == 0:
        return {'pass': False, 'reason': 'all NaN after warmup'}
    tail20 = valid.tail(20)
    if tail20.isna().any().any():
        return {'pass': False, 'reason': 'NaN in final 20 rows'}
    max_x = float((valid['rs_ratio'] - 100.0).abs().max())
    max_y = float((valid['rs_momentum'] - 100.0).abs().max())
    passed = max_x < 0.01 and max_y < 0.01
    return {'pass': passed, 'max_x_err': round(max_x, 8), 'max_y_err': round(max_y, 8)}
