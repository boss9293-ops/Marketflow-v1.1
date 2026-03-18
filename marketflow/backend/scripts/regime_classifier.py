"""
Classifies current market regime.
Output: output/market_regime.json
Data: ohlcv_daily (SPY) + cache.db series_data (VIX)
"""
import pandas as pd
import numpy as np
import json, os, sqlite3
from datetime import datetime, timedelta


def get_db_path(filename: str) -> str:
    base = os.path.dirname(__file__)
    candidates = [
        os.path.join(base, '..', '..', 'data', filename),
        os.path.join(base, '..', 'data', filename),
    ]
    for p in candidates:
        n = os.path.normpath(p)
        if os.path.exists(n):
            return n
    return os.path.normpath(candidates[0])


def load_spy_daily(lookback_days: int = 400) -> pd.Series | None:
    db = get_db_path('marketflow.db')
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, close FROM ohlcv_daily WHERE symbol='SPY' AND date>=? ORDER BY date",
            conn, params=(cutoff,))
        conn.close()
        if df.empty:
            return None
        df['date'] = pd.to_datetime(df['date'])
        return df.set_index('date')['close']
    except Exception as e:
        print(f"  DB SPY load error: {e}")
        return None


def load_vix_daily(lookback_days: int = 400) -> pd.Series | None:
    db = get_db_path('cache.db')
    if not os.path.exists(db):
        return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, value FROM series_data WHERE symbol='VIX' AND date>=? ORDER BY date",
            conn, params=(cutoff,))
        conn.close()
        if df.empty:
            return None
        df['date'] = pd.to_datetime(df['date'])
        return df.set_index('date')['value']
    except Exception as e:
        print(f"  DB VIX load error: {e}")
        return None


def classify_regime():
    spy_close = load_spy_daily()
    vix_series = load_vix_daily()

    if spy_close is None or len(spy_close) < 50:
        print("Warning: SPY data unavailable. Using fallback.")
        regime = {
            'timestamp': datetime.now().isoformat(),
            'trend': 'Unknown', 'risk_appetite': 'Unknown',
            'volatility': 'Unknown', 'cycle': 'Unknown',
            'vix_level': 0, 'strategy': 'Data unavailable',
            'confidence': 'Low', 'note': 'Market data unavailable'
        }
        output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'market_regime.json')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(regime, f, indent=2, ensure_ascii=False)
        print("Market Regime: Unknown (data unavailable)")
        return

    current_price = float(spy_close.iloc[-1])
    ma50  = float(spy_close.rolling(50).mean().iloc[-1])
    ma200 = float(spy_close.rolling(200).mean().dropna().iloc[-1]) if len(spy_close) >= 200 else ma50

    if current_price > ma50 > ma200:
        trend = 'Bull'
    elif current_price < ma50 < ma200:
        trend = 'Bear'
    else:
        trend = 'Transition'

    current_vix = float(vix_series.iloc[-1]) if vix_series is not None and not vix_series.empty else 20.0

    if current_vix < 15:
        vol_regime = 'Low Vol';    risk_appetite = 'Risk On'
    elif current_vix < 20:
        vol_regime = 'Normal Vol'; risk_appetite = 'Risk On'
    elif current_vix < 30:
        vol_regime = 'Elevated Vol'; risk_appetite = 'Risk Off'
    else:
        vol_regime = 'High Vol';   risk_appetite = 'Risk Off'

    n = len(spy_close)
    ret_3m = float(((spy_close.iloc[-1] / spy_close.iloc[max(-63,-n)]) - 1) * 100)
    ret_6m = float(((spy_close.iloc[-1] / spy_close.iloc[max(-126,-n)]) - 1) * 100)

    if ret_6m > 10 and ret_3m > 5:
        cycle = 'Late Cycle'
    elif ret_6m > 0:
        cycle = 'Mid Cycle'
    else:
        cycle = 'Early Cycle'

    if trend == 'Bull' and risk_appetite == 'Risk On':
        strategy = 'Aggressive: Growth stocks, Tech, High Beta'
    elif trend == 'Bear' and risk_appetite == 'Risk Off':
        strategy = 'Defensive: Cash, Bonds, Quality Dividend'
    else:
        strategy = 'Balanced: Diversified portfolio, Sector rotation'

    regime = {
        'timestamp': datetime.now().isoformat(),
        'trend': trend,
        'risk_appetite': risk_appetite,
        'volatility': vol_regime,
        'cycle': cycle,
        'vix_level': round(current_vix, 1),
        'strategy': strategy,
        'confidence': 'High' if trend in ['Bull', 'Bear'] else 'Medium'
    }

    output_path = os.path.join(os.path.dirname(__file__), '..', 'output', 'market_regime.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(regime, f, indent=2, ensure_ascii=False)

    print(f"Market Regime: {trend} / {risk_appetite} / {cycle} (VIX={current_vix:.1f})")

if __name__ == '__main__':
    classify_regime()
