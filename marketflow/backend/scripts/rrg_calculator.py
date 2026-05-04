"""
RRG (Relative Rotation Graph) Data Generator
MF RS-Ratio & MF RS-Momentum — JdK-style dual-EMA approximation.

Formula:
  RS            = (Close / BenchClose) * 100
  MF_RS_Ratio   = 100 + ((EMA(RS, short) / EMA(RS, long) - 1) * 100)
  MF_RS_Momentum = 100 + ((EMA(RSRatio, short) / EMA(RSRatio, long) - 1) * 100)

Warm-up rule: fetch max(visibleRange, longPeriod * 3) rows before trimming.

Output: output/rrg_data.json
Data source: ohlcv_daily DB (primary) → yfinance (fallback)
"""
import pandas as pd
import numpy as np
import json
import os
import sqlite3
from datetime import datetime, timedelta

SECTORS = {
    'XLK':  'Technology',
    'XLV':  'Healthcare',
    'XLF':  'Financials',
    'XLE':  'Energy',
    'XLY':  'Consumer Discretionary',
    'XLP':  'Consumer Staples',
    'XLI':  'Industrials',
    'XLB':  'Materials',
    'XLRE': 'Real Estate',
    'XLU':  'Utilities',
    'XLC':  'Communication Services',
}
BENCHMARK = 'SPY'

SHORT_PERIOD       = 10
LONG_PERIOD_DAILY  = 28   # Daily: 10/28 matches StockCharts daily RRG (MACD-style)
LONG_PERIOD_WEEKLY = 65   # Weekly: original JdK 10/65 parameters
LONG_PERIOD        = LONG_PERIOD_DAILY  # default for backward compat
TRAIL_POINTS       = 260

# Warm-up: fetch enough historical rows so EMA is stable when visible range begins.
# Weekly: LONG_PERIOD weeks * 7 days/week * 3 (warm-up factor) + buffer
# Daily:  LONG_PERIOD * 3 trading days + buffer
WEEKLY_LOOKBACK = max(1600, LONG_PERIOD * 7 * 3 + 90)   # ~1545 days, EMA-65w converge
DAILY_LOOKBACK  = max(500, LONG_PERIOD * 3 + 90)        # ~500 days, EMA-65d converge


def get_db_path() -> str:
    base = os.path.dirname(__file__)
    candidates = [
        os.path.join(base, '..', '..', 'data', 'marketflow.db'),
        os.path.join(base, '..', 'data', 'marketflow.db'),
    ]
    for p in candidates:
        norm = os.path.normpath(p)
        if os.path.exists(norm):
            return norm
    return os.path.normpath(candidates[0])


def load_weekly_from_db(symbol: str, lookback_days: int = WEEKLY_LOOKBACK) -> pd.Series | None:
    db = get_db_path()
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, COALESCE(adj_close, close) AS close FROM ohlcv_daily WHERE symbol=? AND date>=? ORDER BY date",
            conn, params=(symbol, cutoff),
        )
        conn.close()
        if df.empty or len(df) < 50:
            return None
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date')['close']
        weekly = df.resample('W-FRI').last().dropna()
        return weekly
    except Exception as e:
        print(f"  DB load error {symbol}: {e}")
        return None


def load_weekly(symbol: str, lookback_days: int = WEEKLY_LOOKBACK) -> pd.Series | None:
    series = load_weekly_from_db(symbol, lookback_days=lookback_days)
    if series is not None and len(series) >= 15:
        return series
    try:
        import yfinance as yf
        # yfinance: fetch enough history for warm-up
        period_years = max(2, (lookback_days // 365) + 1)
        raw = yf.download(symbol, period=f'{period_years}y', interval='1wk',
                          auto_adjust=True, progress=False)
        if raw.empty:
            return None
        close = raw['Close']
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        return close.dropna()
    except Exception as e:
        print(f"  yfinance fallback error {symbol}: {e}")
        return None


def load_daily_from_db(symbol: str, lookback_days: int = DAILY_LOOKBACK) -> pd.Series | None:
    db = get_db_path()
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, COALESCE(adj_close, close) AS close FROM ohlcv_daily WHERE symbol=? AND date>=? ORDER BY date",
            conn, params=(symbol, cutoff),
        )
        conn.close()
        if df.empty or len(df) < 20:
            return None
        df['date'] = pd.to_datetime(df['date'])
        return df.set_index('date')['close']
    except Exception as e:
        print(f"  DB load daily error {symbol}: {e}")
        return None


def load_daily(symbol: str, lookback_days: int = DAILY_LOOKBACK) -> pd.Series | None:
    series = load_daily_from_db(symbol, lookback_days=lookback_days)
    if series is not None and len(series) >= 20:
        return series
    try:
        import yfinance as yf
        period_years = max(2, (lookback_days // 365) + 1)
        raw = yf.download(symbol, period=f'{period_years}y', interval='1d',
                          auto_adjust=True, progress=False)
        if raw.empty:
            return None
        close = raw['Close']
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        return close.dropna()
    except Exception as e:
        print(f"  yfinance daily fallback error {symbol}: {e}")
        return None


def _calc_ema_series(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _apply_rrg_formula(
    close: pd.Series,
    bench: pd.Series,
    short: int,
    long_p: int,
) -> tuple[pd.Series, pd.Series]:
    """
    Returns (rs_ratio, rs_momentum).
    RS            = (close / bench) * 100
    MF_RS_Ratio   = 100 + ((EMA(RS, short) / EMA(RS, long) - 1) * 100)
    MF_RS_Momentum = 100 + ROC(RS_Ratio, short)
                   = 100 + ((RS_Ratio_t / RS_Ratio_{t-short} - 1) * 100)
    """
    rs = (close / bench) * 100
    ema_s = _calc_ema_series(rs, short)
    ema_l = _calc_ema_series(rs, long_p)
    rs_ratio = 100.0 + ((ema_s / ema_l - 1.0) * 100.0)

    # ROC(RS_Ratio, short): measures whether RS_Ratio is rising or falling
    rs_momentum = 100.0 + ((rs_ratio / rs_ratio.shift(short) - 1.0) * 100.0)

    return rs_ratio, rs_momentum


def calculate_rrg(
    symbol: str,
    bench_close: pd.Series,
    weeks: int = SHORT_PERIOD,
    short_period: int | None = None,
    long_period: int = LONG_PERIOD_WEEKLY,
):
    """
    Weekly RRG calculation.
    `weeks` kept for backward compatibility (maps to short_period if short_period is None).
    """
    short = short_period if short_period is not None else weeks
    long_p = long_period

    needed_days = max(WEEKLY_LOOKBACK, long_p * 7 * 3 + 90)
    try:
        close = load_weekly(symbol, lookback_days=needed_days)
        if close is None:
            return None

        common = close.index.intersection(bench_close.index)
        min_rows = long_p + short + 2
        if len(common) < min_rows:
            return None
        close = close[common]
        bench = bench_close[common]

        rs_ratio, rs_momentum = _apply_rrg_formula(close, bench, short, long_p)
        rs_ratio   = rs_ratio.dropna()
        rs_momentum = rs_momentum.dropna()
        common2    = rs_ratio.index.intersection(rs_momentum.index)
        if len(common2) < short + 2:
            return None

        rs_ratio    = rs_ratio[common2]
        rs_momentum = rs_momentum[common2]
        calc_rows   = len(rs_ratio)

        trail = []
        for i in range(-TRAIL_POINTS - 1, -1):
            if abs(i) > len(rs_ratio):
                continue
            trail.append({
                'ratio':    round(float(rs_ratio.iloc[i]), 4),
                'momentum': round(float(rs_momentum.iloc[i]), 4),
            })

        current = {
            'ratio':    round(float(rs_ratio.iloc[-1]), 4),
            'momentum': round(float(rs_momentum.iloc[-1]), 4),
        }

        n = min(TRAIL_POINTS, len(close))
        price_change = float(((close.iloc[-1] / close.iloc[-n]) - 1) * 100)

        return {
            'current':      current,
            'trail':        trail,
            'price':        round(float(close.iloc[-1]), 2),
            'change':       round(price_change, 2),
            'calcRows':     calc_rows,
            'shortPeriod':  short,
            'longPeriod':   long_p,
            'dataPeriod':   'weekly',
        }

    except Exception as e:
        print(f"  Error {symbol}: {e}")
        return None


def calculate_rrg_daily(
    symbol: str,
    bench_close: pd.Series,
    days: int = SHORT_PERIOD,
    short_period: int | None = None,
    long_period: int = LONG_PERIOD_DAILY,
):
    """
    Daily RRG calculation.
    `days` kept for backward compatibility (maps to short_period if short_period is None).
    """
    short = short_period if short_period is not None else days
    long_p = long_period

    needed_days = max(DAILY_LOOKBACK, long_p * 3 + 90)
    try:
        close = load_daily(symbol, lookback_days=needed_days)
        if close is None:
            return None

        common = close.index.intersection(bench_close.index)
        min_rows = long_p + short + 2
        if len(common) < min_rows:
            return None
        close = close[common]
        bench = bench_close[common]

        rs_ratio, rs_momentum = _apply_rrg_formula(close, bench, short, long_p)
        rs_ratio    = rs_ratio.dropna()
        rs_momentum = rs_momentum.dropna()
        common2     = rs_ratio.index.intersection(rs_momentum.index)
        if len(common2) < short + 2:
            return None

        rs_ratio    = rs_ratio[common2]
        rs_momentum = rs_momentum[common2]
        calc_rows   = len(rs_ratio)

        trail = []
        for i in range(-TRAIL_POINTS - 1, -1):
            if abs(i) > len(rs_ratio):
                continue
            trail.append({
                'ratio':    round(float(rs_ratio.iloc[i]), 4),
                'momentum': round(float(rs_momentum.iloc[i]), 4),
            })

        current = {
            'ratio':    round(float(rs_ratio.iloc[-1]), 4),
            'momentum': round(float(rs_momentum.iloc[-1]), 4),
        }

        n = min(TRAIL_POINTS, len(close))
        price_change = float(((close.iloc[-1] / close.iloc[-n]) - 1) * 100)

        return {
            'current':      current,
            'trail':        trail,
            'price':        round(float(close.iloc[-1]), 2),
            'change':       round(price_change, 2),
            'calcRows':     calc_rows,
            'shortPeriod':  short,
            'longPeriod':   long_p,
            'dataPeriod':   'daily',
        }

    except Exception as e:
        print(f"  Error daily {symbol}: {e}")
        return None


def generate_rrg_data():
    print(f"Loading benchmark ({BENCHMARK})...")
    bench_close = load_weekly(BENCHMARK)
    if bench_close is None or len(bench_close) < LONG_PERIOD:
        print(f"Failed to load {BENCHMARK} data")
        return

    print(f"  {BENCHMARK}: {len(bench_close)} weekly bars "
          f"({bench_close.index[0].date()} -> {bench_close.index[-1].date()})")

    rrg_data = {
        'timestamp': datetime.now().isoformat(),
        'benchmark': BENCHMARK,
        'formula':   f'MF RRG dual-EMA {SHORT_PERIOD}/{LONG_PERIOD}',
        'sectors':   [],
    }

    for symbol, name in SECTORS.items():
        print(f"  Processing {symbol}...")
        data = calculate_rrg(symbol, bench_close,
                              short_period=SHORT_PERIOD, long_period=LONG_PERIOD)
        if data:
            rrg_data['sectors'].append({'symbol': symbol, 'name': name, **data})
        else:
            print(f"  Skipped {symbol} (insufficient data)")

    output_dir = os.path.join(os.path.dirname(__file__), '..', 'output')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'rrg_data.json')

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(rrg_data, f, indent=2, ensure_ascii=False)

    print(f"RRG data saved: {len(rrg_data['sectors'])} sectors -> {output_path}")


if __name__ == '__main__':
    generate_rrg_data()
