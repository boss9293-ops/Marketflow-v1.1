"""
RRG Candidate D — Symbol-level Normalized Log RS Trend
MarketFlow Research Implementation (isolated from production)

Formula:
  logRS_t   = ln(AdjClose_symbol(t) / AdjClose_benchmark(t))
  trend_t   = EMA(logRS, 10) - EMA(logRS, LP)
  zTrend_t  = (trend_t - rolling_mean(trend, N).shift(1))
              / (rolling_std(trend, N).shift(1).clip(lower=eps) ** alpha)
  RS_Ratio_t = 100 + Kx * zTrend_t

  rawMom_t   = zTrend_t - zTrend_{t-M}
  zMom_t     = (rawMom_t - rolling_mean(rawMom, N2).shift(1))
               / (rolling_std(rawMom, N2).shift(1).clip(lower=eps) ** beta)
  RS_Momentum_t = 100 + Ky * zMom_t

Key: Kx/Ky are fixed constants — NOT derived from current universe.
     rolling mean/std shifted by 1 to avoid look-ahead.
"""
import pandas as pd
import numpy as np

DEFAULT_LP      = 28
DEFAULT_M       = 10
DEFAULT_N       = 252
DEFAULT_N2      = 252
DEFAULT_ALPHA   = 0.5
DEFAULT_BETA    = 0.5
DEFAULT_KX      = 6.5
DEFAULT_KY      = 3.0
DEFAULT_EPSILON = 1e-6
SHORT           = 10


def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def quadrant(x: float, y: float) -> str:
    if x >= 100 and y >= 100: return 'Leading'
    if x >= 100 and y <  100: return 'Weakening'
    if x <  100 and y <  100: return 'Lagging'
    return 'Improving'


def calc_rrg_candidate_d(
    symbol_close: pd.Series,
    benchmark_close: pd.Series,
    lp: int   = DEFAULT_LP,
    m: int    = DEFAULT_M,
    n: int    = DEFAULT_N,
    n2: int   = DEFAULT_N2,
    alpha: float = DEFAULT_ALPHA,
    beta: float  = DEFAULT_BETA,
    kx: float    = DEFAULT_KX,
    ky: float    = DEFAULT_KY,
    epsilon: float = DEFAULT_EPSILON,
) -> pd.DataFrame:
    """
    Returns a DataFrame with columns:
      date, logRS, trend, trendMean, trendStd, zTrend, rs_ratio,
      rawMom, momMean, momStd, zMom, rs_momentum, quadrant,
      xNorm, yNorm, visualDistance
    """
    common = symbol_close.index.intersection(benchmark_close.index)
    s = symbol_close[common].astype(float)
    b = benchmark_close[common].astype(float)

    logRS = np.log(s / b)

    ema_short = _ema(logRS, SHORT)
    ema_long  = _ema(logRS, lp)
    trend     = ema_short - ema_long

    # shift(1) prevents look-ahead
    trend_mean = trend.rolling(n, min_periods=max(n // 4, 1)).mean().shift(1)
    trend_std  = trend.rolling(n, min_periods=max(n // 4, 1)).std().shift(1).clip(lower=epsilon)

    z_trend   = (trend - trend_mean) / (trend_std ** alpha)
    rs_ratio  = 100.0 + kx * z_trend

    raw_mom   = z_trend - z_trend.shift(m)
    mom_mean  = raw_mom.rolling(n2, min_periods=max(n2 // 4, 1)).mean().shift(1)
    mom_std   = raw_mom.rolling(n2, min_periods=max(n2 // 4, 1)).std().shift(1).clip(lower=epsilon)

    z_mom        = (raw_mom - mom_mean) / (mom_std ** beta)
    rs_momentum  = 100.0 + ky * z_mom

    x_norm = (rs_ratio - 100.0) / 6.5
    y_norm = (rs_momentum - 100.0) / 3.0
    vis_dist = np.sqrt(x_norm**2 + y_norm**2)

    df = pd.DataFrame({
        'logRS':          logRS,
        'trend':          trend,
        'trendMean':      trend_mean,
        'trendStd':       trend_std,
        'zTrend':         z_trend,
        'rs_ratio':       rs_ratio,
        'rawMom':         raw_mom,
        'momMean':        mom_mean,
        'momStd':         mom_std,
        'zMom':           z_mom,
        'rs_momentum':    rs_momentum,
        'xNorm':          x_norm,
        'yNorm':          y_norm,
        'visualDistance': vis_dist,
    }, index=common)

    df['quadrant'] = df.apply(lambda r: quadrant(r['rs_ratio'], r['rs_momentum']), axis=1)
    df.index.name = 'date'
    return df
