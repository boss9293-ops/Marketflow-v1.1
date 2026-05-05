"""
MarketFlow RRG Engine Router — Internal only.
Users never see engine family, preset names, or Kx/Ky values.

Routing policy:
  All symbols in STANDARD_SECTOR_ETFS → SMA 10/34/8 (updated 2026-05-05)
  Any individual stock or non-sector ETF → Family C (EMA z-score)

Final presets (validated 2026-05-05):
  Sector  daily:  SMA_10_34_8
  Sector  weekly: SMA_10_34_8
  Stock   daily:  C_s10_N65_Kx2_Ky2
  Stock   weekly: C_s10_N52_Kx2_Ky2
"""
import math
import pandas as pd

EPSILON = 1e-4

STANDARD_SECTOR_ETFS: frozenset = frozenset({
    'XLK', 'XLV', 'XLF', 'XLE', 'XLY',
    'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC',
})

_PRESETS = {
    'sector': {
        'daily':  {'family': 'SMA', 'short': 10, 'long_p': 34, 'mom': 8},
        'weekly': {'family': 'SMA', 'short': 10, 'long_p': 34, 'mom': 8},
    },
    'stock_mixed': {
        'daily':  {'family': 'C', 'N': 65, 'Kx': 2, 'Ky': 2, 'EMA': 10},
        'weekly': {'family': 'C', 'N': 52, 'Kx': 2, 'Ky': 2, 'EMA': 10},
    },
}

# Coordinate warning thresholds (no clipping — display/autoscale handles extremes)
SOFT_WARN_LO, SOFT_WARN_HI = 85.0, 115.0
HARD_WARN_LO, HARD_WARN_HI = 70.0, 130.0


def classify_universe(symbols: list) -> str:
    """'sector' only when every symbol is a standard sector ETF."""
    clean = {s.strip().upper() for s in symbols if s.strip()}
    if not clean:
        return 'stock_mixed'
    return 'sector' if clean <= STANDARD_SECTOR_ETFS else 'stock_mixed'


def preset_id(universe_type: str, timeframe: str) -> str:
    p = _PRESETS[universe_type][timeframe]
    if p['family'] == 'SMA':
        return f"SMA_{p['short']}_{p['long_p']}_{p['mom']}"
    if p['family'] == 'D':
        return f"D_N{p['N']}_M{p['M']}"
    return f"C_s{p['EMA']}_N{p['N']}_Kx{p['Kx']}_Ky{p['Ky']}"


def _prep(sc: pd.Series, bc: pd.Series):
    common = sc.index.intersection(bc.index)
    s, b = sc.loc[common], bc.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    return s[mask], b[mask]


def _fam_d(sc: pd.Series, bc: pd.Series, N: int, M: int):
    s, b = _prep(sc, bc)
    RS  = 100.0 * s / b
    RSR = 100.0 * RS  / RS.rolling(N, min_periods=N).mean()
    RSM = 100.0 * RSR / RSR.rolling(M, min_periods=M).mean()
    return RSR, RSM


def _fam_c(sc: pd.Series, bc: pd.Series, N: int, Kx: float, Ky: float, EMA: int = 10):
    s, b = _prep(sc, bc)
    RS   = 100.0 * s / b
    RSs  = RS.ewm(span=EMA, adjust=False).mean()
    rs_m = RSs.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RSs.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RSs - rs_m) / rs_s
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    return RSR, 100.0 + Ky * (ROC - ro_m) / ro_s


def _fam_sma(sc: pd.Series, bc: pd.Series, short: int = 10, long_p: int = 34, mom: int = 8):
    """SMA 10/34/8: RSR = 100*SMA(RS,short)/SMA(RS,long_p), RSM = 100*RSR/SMA(RSR,mom)"""
    s, b = _prep(sc, bc)
    RS  = s / b  # raw ratio; SMA division normalizes to ~100
    RSR = 100.0 * RS.rolling(short,  min_periods=short).mean() \
                / RS.rolling(long_p, min_periods=long_p).mean()
    RSM = 100.0 * RSR / RSR.rolling(mom, min_periods=mom).mean()
    return RSR, RSM


def _quadrant(x: float, y: float) -> str:
    if x >= 100 and y >= 100: return 'Leading'
    if x >= 100 and y <  100: return 'Weakening'
    if x <  100 and y >= 100: return 'Improving'
    return 'Lagging'


def _coord_warn(x: float, y: float) -> str:
    if x < HARD_WARN_LO or x > HARD_WARN_HI or y < HARD_WARN_LO or y > HARD_WARN_HI:
        return 'HARD'
    if x < SOFT_WARN_LO or x > SOFT_WARN_HI or y < SOFT_WARN_LO or y > SOFT_WARN_HI:
        return 'SOFT'
    return ''


def compute_symbol_rrg(
    close: pd.Series,
    bench_close: pd.Series,
    timeframe: str,
    universe_type: str,
    tail_len: int = 52,
) -> dict | None:
    """
    Compute RRG for one symbol using routed engine.
    Returns dict compatible with /api/rrg/candidate-d response format.
    Returns None on critical failure.
    """
    p = _PRESETS[universe_type][timeframe]
    try:
        if p['family'] == 'SMA':
            rsr_s, rsm_s = _fam_sma(close, bench_close, p['short'], p['long_p'], p['mom'])
        elif p['family'] == 'D':
            rsr_s, rsm_s = _fam_d(close, bench_close, p['N'], p['M'])
        else:
            rsr_s, rsm_s = _fam_c(close, bench_close, p['N'], p['Kx'], p['Ky'], p['EMA'])

        df = pd.DataFrame({'rs_ratio': rsr_s, 'rs_momentum': rsm_s}).dropna()
        if len(df) < 2:
            return None

        tail_df  = df.tail(tail_len)
        tail_out = []
        for row in tail_df.itertuples():
            rsr = float(row.rs_ratio)
            rsm = float(row.rs_momentum)
            if not math.isfinite(rsr) or not math.isfinite(rsm):
                continue
            tail_out.append({
                'date':        str(row.Index.date()),
                'rs_ratio':    round(rsr, 4),
                'rs_momentum': round(rsm, 4),
                'quadrant':    _quadrant(rsr, rsm),
                'xNorm':       round((rsr - 100.0) / 3.0, 4),
                'yNorm':       round((rsm - 100.0) / 3.0, 4),
            })

        if not tail_out:
            return None

        latest   = tail_out[-1]
        rsr_now  = latest['rs_ratio']
        rsm_now  = latest['rs_momentum']
        warnings = []
        cw = _coord_warn(rsr_now, rsm_now)
        if cw:
            warnings.append(f'{cw}_COORD: X={rsr_now:.1f} Y={rsm_now:.1f}')

        return {
            'latest': {
                **latest,
                'visualDistance': round(
                    math.sqrt(latest['xNorm'] ** 2 + latest['yNorm'] ** 2), 4),
            },
            'tail':          tail_out,
            'engine_family': p['family'],
            'preset_id':     preset_id(universe_type, timeframe),
            'warnings':      warnings,
        }

    except Exception as e:
        return {'_error': str(e)}


def compute_rrg_sma_10_34_8(
    close: pd.Series,
    bench_close: pd.Series,
    tail_len: int = 52,
) -> dict | None:
    """
    Production-safe Candidate A implementation.

    Formula (timeframe-agnostic):
      RS  = symbol / benchmark
      RSR = 100 * SMA(RS, 10) / SMA(RS, 34)
      RSM = 100 * RSR / SMA(RSR, 8)

    Returns same dict shape as compute_symbol_rrg().
    Returns None on failure.
    """
    try:
        rsr_s, rsm_s = _fam_sma(close, bench_close, short=10, long_p=34, mom=8)
        df = pd.DataFrame({'rs_ratio': rsr_s, 'rs_momentum': rsm_s}).dropna()
        if len(df) < 2:
            return None

        tail_df  = df.tail(tail_len)
        tail_out = []
        for row in tail_df.itertuples():
            rsr = float(row.rs_ratio)
            rsm = float(row.rs_momentum)
            if not math.isfinite(rsr) or not math.isfinite(rsm):
                continue
            tail_out.append({
                'date':        str(row.Index.date()),
                'rs_ratio':    round(rsr, 4),
                'rs_momentum': round(rsm, 4),
                'quadrant':    _quadrant(rsr, rsm),
                'xNorm':       round((rsr - 100.0) / 3.0, 4),
                'yNorm':       round((rsm - 100.0) / 3.0, 4),
            })

        if not tail_out:
            return None

        latest   = tail_out[-1]
        rsr_now  = latest['rs_ratio']
        rsm_now  = latest['rs_momentum']
        cw = _coord_warn(rsr_now, rsm_now)

        return {
            'latest': {
                **latest,
                'visualDistance': round(
                    math.sqrt(latest['xNorm'] ** 2 + latest['yNorm'] ** 2), 4),
            },
            'tail':          tail_out,
            'engine_family': 'SMA',
            'preset_id':     'SMA_10_34_8',
            'warnings':      [f'{cw}_COORD: X={rsr_now:.1f} Y={rsm_now:.1f}'] if cw else [],
        }

    except Exception as e:
        return {'_error': str(e)}
