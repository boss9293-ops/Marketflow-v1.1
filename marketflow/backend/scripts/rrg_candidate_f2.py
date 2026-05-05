"""
MarketFlow RRG — Candidate F2 (RRGPy-Exact Reference)

Key difference from F v1:
  RSR_ROC = 100.0 * (RS_Ratio / RS_Ratio.shift(1) - 1.0)
  — shift(1) always, not shift(M)

Kx / Ky are passed as arguments (default 3.0) to allow grid search.
N stays from preset (52 weekly / 65 daily).
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


def calc_rrg_candidate_f2(
    symbol_close: pd.Series,
    benchmark_close: pd.Series,
    timeframe: str = 'daily',
    kx: float = 3.0,
    ky: float = 3.0,
) -> pd.DataFrame:
    """
    F2 main calculation.

    Returns DataFrame with columns:
      rs, rs_ratio, rs_momentum, quadrant
    Index: DatetimeIndex (date)
    """
    if timeframe not in PRESETS:
        timeframe = 'daily'
    p = PRESETS[timeframe]
    N = p['N']

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
    RS_Ratio = 100.0 + kx * z_rs

    # Step 3: ROC of RS_Ratio — shift(1), not shift(M)
    RSR_ROC = 100.0 * (RS_Ratio / RS_Ratio.shift(1) - 1.0)

    # Step 4: RS-Momentum via z-score of ROC
    roc_mean = RSR_ROC.rolling(window=N, min_periods=N).mean().shift(1)
    roc_std  = RSR_ROC.rolling(window=N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    z_roc    = (RSR_ROC - roc_mean) / roc_std
    RS_Momentum = 100.0 + ky * z_roc

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


def calc_f2_diagnostic(
    symbol_close: pd.Series,
    benchmark_close: pd.Series,
    symbol: str,
    timeframe: str = 'weekly',
    kx: float = 3.0,
    ky: float = 3.0,
) -> dict:
    """Return full component breakdown for the latest valid row."""
    if timeframe not in PRESETS:
        timeframe = 'weekly'
    p = PRESETS[timeframe]
    N = p['N']

    common = symbol_close.index.intersection(benchmark_close.index)
    sym   = symbol_close.loc[common].copy()
    bench = benchmark_close.loc[common].copy()
    mask  = sym.notna() & bench.notna() & (bench != 0)
    sym, bench = sym[mask], bench[mask]

    RS = 100.0 * sym / bench
    rs_mean = RS.rolling(N, min_periods=N).mean().shift(1)
    rs_std  = RS.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    z_rs    = (RS - rs_mean) / rs_std
    RS_Ratio = 100.0 + kx * z_rs

    RSR_ROC = 100.0 * (RS_Ratio / RS_Ratio.shift(1) - 1.0)
    roc_mean = RSR_ROC.rolling(N, min_periods=N).mean().shift(1)
    roc_std  = RSR_ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    z_roc    = (RSR_ROC - roc_mean) / roc_std
    RS_Momentum = 100.0 + ky * z_roc

    df = pd.DataFrame({
        'rs': RS, 'rs_ratio': RS_Ratio, 'rs_momentum': RS_Momentum,
        'rs_mean': rs_mean, 'rs_std': rs_std, 'z_rs': z_rs,
        'RSR_ROC': RSR_ROC, 'roc_mean': roc_mean, 'roc_std': roc_std, 'z_roc': z_roc,
    }).dropna(subset=['rs_ratio', 'rs_momentum'])

    if len(df) == 0:
        return {'symbol': symbol, 'error': 'no_valid_rows', 'valid_rows': 0}

    row = df.iloc[-1]
    return {
        'symbol':       symbol,
        'latest_date':  str(df.index[-1].date()),
        'valid_rows':   len(df),
        'timeframe':    timeframe,
        'kx':           kx,
        'ky':           ky,
        'N':            N,
        'RS':           round(float(row['rs']), 6),
        'rs_mean':      round(float(row['rs_mean']), 6),
        'rs_std':       round(float(row['rs_std']), 6),
        'z_rs':         round(float(row['z_rs']), 6),
        'RS_Ratio':     round(float(row['rs_ratio']), 4),
        'RSR_ROC':      round(float(row['RSR_ROC']), 6),
        'roc_mean':     round(float(row['roc_mean']), 6),
        'roc_std':      round(float(row['roc_std']), 6),
        'z_roc':        round(float(row['z_roc']), 6),
        'RS_Momentum':  round(float(row['rs_momentum']), 4),
        'quadrant':     _classify_quadrant(float(row['rs_ratio']), float(row['rs_momentum'])),
    }
