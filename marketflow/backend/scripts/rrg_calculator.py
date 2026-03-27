"""
RRG (Relative Rotation Graph) Data Generator
주간 데이터 기반 JdK RS-Ratio & RS-Momentum 계산
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
WEEKS = 10        # RS-Ratio SMA 기간
TRAIL_POINTS = 260 # 저장할 최대 트레일 포인트 수


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


def load_weekly_from_db(symbol: str, lookback_days: int = 400) -> pd.Series | None:
    """Load daily close from DB and resample to weekly (Friday)."""
    db = get_db_path()
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, close FROM ohlcv_daily WHERE symbol=? AND date>=? ORDER BY date",
            conn, params=(symbol, cutoff),
        )
        conn.close()
        if df.empty or len(df) < 50:
            return None
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date')['close']
        # Resample to weekly (Friday)
        weekly = df.resample('W-FRI').last().dropna()
        return weekly
    except Exception as e:
        print(f"  DB load error {symbol}: {e}")
        return None


def load_weekly(symbol: str) -> pd.Series | None:
    """Try DB first, fall back to yfinance."""
    series = load_weekly_from_db(symbol)
    if series is not None and len(series) >= 15:
        return series
    # fallback
    try:
        import yfinance as yf
        raw = yf.download(symbol, period='1y', interval='1wk',
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


def calculate_rrg(symbol: str, bench_close: pd.Series, weeks: int = WEEKS):
    try:
        close = load_weekly(symbol)
        if close is None:
            return None

        # Align to common index
        common = close.index.intersection(bench_close.index)
        if len(common) < weeks + 3:
            return None
        close = close[common]
        bench = bench_close[common]

        # Relative Strength
        rs = close / bench

        # RS-Ratio: rs / rolling SMA * 100
        rs_sma = rs.rolling(window=weeks).mean()
        rs_ratio = (rs / rs_sma) * 100

        # RS-Momentum: 1-week ROC + 100 (JdK approximation)
        rs_momentum = rs_ratio.pct_change(1) * 100 + 100

        rs_ratio = rs_ratio.dropna()
        rs_momentum = rs_momentum.dropna()
        common2 = rs_ratio.index.intersection(rs_momentum.index)
        if len(common2) < weeks:
            return None

        rs_ratio = rs_ratio[common2]
        rs_momentum = rs_momentum[common2]

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
            'current':  current,
            'trail':    trail,
            'price':    round(float(close.iloc[-1]), 2),
            'change':   round(price_change, 2),
        }

    except Exception as e:
        print(f"  Error {symbol}: {e}")
        return None



def load_daily_from_db(symbol: str, lookback_days: int = 400) -> pd.Series | None:
    """Load daily close from DB (no resampling)."""
    db = get_db_path()
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, close FROM ohlcv_daily WHERE symbol=? AND date>=? ORDER BY date",
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


def load_daily(symbol: str) -> pd.Series | None:
    """Try DB first, fall back to yfinance daily."""
    series = load_daily_from_db(symbol)
    if series is not None and len(series) >= 20:
        return series
    try:
        import yfinance as yf
        raw = yf.download(symbol, period='2y', interval='1d',
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


def calculate_rrg_daily(symbol: str, bench_close: pd.Series, days: int = 14):
    """Calculate RRG using daily closes."""
    try:
        close = load_daily(symbol)
        if close is None:
            return None

        common = close.index.intersection(bench_close.index)
        if len(common) < days + 3:
            return None
        close = close[common]
        bench = bench_close[common]

        rs = close / bench
        rs_sma = rs.rolling(window=days).mean()
        rs_ratio = (rs / rs_sma) * 100
        rs_momentum = rs_ratio.pct_change(1) * 100 + 100

        rs_ratio = rs_ratio.dropna()
        rs_momentum = rs_momentum.dropna()
        common2 = rs_ratio.index.intersection(rs_momentum.index)
        if len(common2) < days:
            return None
        rs_ratio = rs_ratio[common2]
        rs_momentum = rs_momentum[common2]

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
            'current':  current,
            'trail':    trail,
            'price':    round(float(close.iloc[-1]), 2),
            'change':   round(price_change, 2),
        }

    except Exception as e:
        print(f"  Error daily {symbol}: {e}")
        return None


def generate_rrg_data():
    print(f"Loading benchmark ({BENCHMARK}) from DB...")
    bench_close = load_weekly(BENCHMARK)
    if bench_close is None or len(bench_close) < 15:
        print(f"Failed to load {BENCHMARK} data")
        return

    print(f"  {BENCHMARK}: {len(bench_close)} weekly bars ({bench_close.index[0].date()} -> {bench_close.index[-1].date()})")

    rrg_data = {
        'timestamp': datetime.now().isoformat(),
        'benchmark': BENCHMARK,
        'sectors': [],
    }

    for symbol, name in SECTORS.items():
        print(f"  Processing {symbol}...")
        data = calculate_rrg(symbol, bench_close)
        if data:
            rrg_data['sectors'].append({
                'symbol': symbol,
                'name':   name,
                **data,
            })
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
