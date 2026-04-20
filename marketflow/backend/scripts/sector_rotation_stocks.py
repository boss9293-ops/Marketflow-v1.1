"""
Sector Rotation Stock Picker.

DB-first picker for sector rotation stocks.
Output: output/rotation_picks.json
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
import json
import os
import sqlite3

import numpy as np
import pandas as pd
import yfinance as yf

try:
    from db_utils import resolve_marketflow_db
except Exception:
    resolve_marketflow_db = None


SECTORS = {
    "XLK": ("Technology", "early_recovery"),
    "XLY": ("Consumer Discretionary", "early_recovery"),
    "XLC": ("Communication Services", "early_recovery"),
    "XLI": ("Industrials", "expansion"),
    "XLB": ("Materials", "expansion"),
    "XLE": ("Energy", "expansion"),
    "XLF": ("Financials", "peak"),
    "XLRE": ("Real Estate", "peak"),
    "XLV": ("Healthcare", "slowdown"),
    "XLP": ("Consumer Staples", "slowdown"),
    "XLU": ("Utilities", "slowdown"),
}

SECTOR_STOCKS = {
    "XLK": ["AAPL", "MSFT", "NVDA", "AVGO", "CSCO", "ADBE", "CRM", "INTC", "AMD", "QCOM"],
    "XLY": ["AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "TJX", "BKNG"],
    "XLI": ["CAT", "RTX", "UNP", "HON", "BA", "UPS", "DE", "LMT", "GE", "MMM"],
    "XLB": ["LIN", "APD", "SHW", "ECL", "FCX", "NEM", "DD", "DOW", "NUE", "VMC"],
    "XLE": ["XOM", "CVX", "COP", "SLB", "EOG", "PSX", "MPC", "VLO", "OXY", "HAL"],
    "XLF": ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "SPGI", "USB"],
    "XLRE": ["PLD", "AMT", "CCI", "EQIX", "PSA", "SPG", "O", "DLR", "VICI", "AVB"],
    "XLV": ["UNH", "JNJ", "LLY", "ABBV", "MRK", "TMO", "ABT", "DHR", "PFE", "BMY"],
    "XLP": ["PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB"],
    "XLU": ["NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "ED", "ES"],
    "XLC": ["META", "GOOGL", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA"],
}

PHASE_LABELS = {
    "early_recovery": "Early Recovery",
    "expansion": "Expansion",
    "peak": "Peak",
    "slowdown": "Slowdown",
}

PHASE_COLOR = {
    "early_recovery": "#22c55e",
    "expansion": "#00D9FF",
    "peak": "#f59e0b",
    "slowdown": "#ef4444",
}

DB_LOOKBACK_DAYS = 400


def output_dir() -> str:
    return os.path.join(os.path.dirname(__file__), "..", "output")


def load_json(filename: str):
    path = os.path.join(output_dir(), filename)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_db_path() -> str:
    if resolve_marketflow_db is not None:
        try:
            return resolve_marketflow_db(required_tables=("ohlcv_daily",), data_plane="live")
        except Exception:
            pass
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "marketflow.db"))


def load_history_from_db(symbol: str, lookback_days: int = DB_LOOKBACK_DAYS):
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return None

    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    conn = sqlite3.connect(db_path)
    try:
        df = pd.read_sql_query(
            """
            SELECT date, close, volume, high
            FROM ohlcv_daily
            WHERE symbol=? AND close IS NOT NULL AND date>=?
            ORDER BY date ASC
            """,
            conn,
            params=(symbol, cutoff),
        )
    except Exception as exc:
        print(f"  DB load error {symbol}: {exc}")
        return None
    finally:
        conn.close()

    if df.empty:
        return None

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df["high"] = pd.to_numeric(df["high"], errors="coerce")
    df = df.dropna(subset=["date", "close"])
    if df.empty:
        return None
    return df


def load_history(symbol: str, lookback_days: int = DB_LOOKBACK_DAYS):
    df = load_history_from_db(symbol, lookback_days=lookback_days)
    if df is not None and len(df) >= 20:
        return df

    try:
        hist = yf.Ticker(symbol).history(period="6mo")
        if hist is None or hist.empty:
            return None
        hist = hist.reset_index()
        date_col = "Date" if "Date" in hist.columns else hist.columns[0]
        df = pd.DataFrame(
            {
                "date": pd.to_datetime(hist[date_col], errors="coerce"),
                "close": pd.to_numeric(hist.get("Close", pd.Series(dtype=float)), errors="coerce"),
                "volume": pd.to_numeric(hist.get("Volume", pd.Series(dtype=float)), errors="coerce"),
                "high": pd.to_numeric(hist.get("High", pd.Series(dtype=float)), errors="coerce"),
            }
        ).dropna(subset=["date", "close"])
        return df if not df.empty else None
    except Exception as exc:
        print(f"  yfinance fallback error {symbol}: {exc}")
        return None


def pct_change_from_close(close: pd.Series, bars_ago: int) -> float:
    if len(close) <= bars_ago:
        return 0.0
    base = float(close.iloc[-(bars_ago + 1)])
    if base <= 0:
        return 0.0
    return float((close.iloc[-1] / base - 1) * 100)


def recent_vs_prior_mean(close: pd.Series, recent: int = 20, prior: int = 40) -> float:
    if len(close) < recent + prior:
        return 0.0
    recent_mean = float(close.iloc[-recent:].mean())
    prior_mean = float(close.iloc[-(recent + prior):-recent].mean())
    if prior_mean <= 0:
        return 0.0
    return float((recent_mean / prior_mean - 1) * 100)


def identify_rotation_phase():
    """Determine the current rotation phase from local DB-first ETF history."""
    performance = {}
    spy_hist = load_history("SPY")
    spy_ret = pct_change_from_close(spy_hist["close"], 63) if spy_hist is not None else 0.0

    for symbol, (name, phase) in SECTORS.items():
        try:
            hist = load_history(symbol)
            if hist is None or len(hist) < 20:
                continue

            close = hist["close"]
            ret_3m = pct_change_from_close(close, 63)
            momentum = recent_vs_prior_mean(close)
            rel_strength = ret_3m - spy_ret
            score = ret_3m * 0.5 + momentum * 0.3 + rel_strength * 0.2

            performance[symbol] = {
                "name": name,
                "phase": phase,
                "return_3m": round(ret_3m, 2),
                "momentum": round(momentum, 2),
                "rel_strength": round(rel_strength, 2),
                "score": round(score, 2),
            }
        except Exception:
            continue

    if not performance:
        perf_json = load_json("sector_performance.json") or {}
        sectors = perf_json.get("sectors") or []
        for item in sectors:
            symbol = str(item.get("symbol") or "").upper().strip()
            if symbol not in SECTORS:
                continue
            name, phase = SECTORS[symbol]
            ret_3m = float(item.get("change_3m") or 0.0)
            momentum = float(item.get("change_1m") or 0.0)
            rel_strength = ret_3m - spy_ret
            score = ret_3m * 0.5 + momentum * 0.3 + rel_strength * 0.2
            performance[symbol] = {
                "name": name,
                "phase": phase,
                "return_3m": round(ret_3m, 2),
                "momentum": round(momentum, 2),
                "rel_strength": round(rel_strength, 2),
                "score": round(score, 2),
            }

    if not performance:
        return "early_recovery", [], performance

    top3 = sorted(performance.items(), key=lambda x: x[1]["score"], reverse=True)[:3]
    phases = [item[1]["phase"] for item in top3]
    phase_counts = Counter(phases)
    most_common = max(phase_counts.values()) if phase_counts else 0
    phase_candidates = [phase for phase, count in phase_counts.items() if count == most_common]
    current_phase = phase_candidates[0] if len(phase_candidates) == 1 else top3[0][1]["phase"]
    leading_sectors = [symbol for symbol, _ in top3]

    return current_phase, leading_sectors, performance


def find_rotation_stocks(sector_etf: str, min_score: int = 70):
    """Find sector stocks with rotation strength from local OHLCV data."""
    stocks = SECTOR_STOCKS.get(sector_etf, [])
    rotation_picks = []
    fallback_candidates = []

    try:
        etf_hist = load_history(sector_etf)
        etf_close = etf_hist["close"] if etf_hist is not None else None
        sector_return_3m = pct_change_from_close(etf_close, 63) if etf_close is not None else 0.0
    except Exception:
        sector_return_3m = 0.0

    for symbol in stocks:
        try:
            hist = load_history(symbol)
            if hist is None or len(hist) < 60:
                continue

            close = hist["close"]
            volume = hist["volume"]
            high = hist["high"]

            current_price = float(close.iloc[-1])
            stock_return_3m = pct_change_from_close(close, 63)
            relative_strength = stock_return_3m - sector_return_3m

            sma20 = close.rolling(20).mean()
            sma50 = close.rolling(50).mean()
            above_sma20 = current_price > float(sma20.iloc[-1])
            above_sma50 = current_price > float(sma50.iloc[-1])
            sma_cross = float(sma20.iloc[-1]) > float(sma50.iloc[-1])

            avg_vol_60 = float(volume.iloc[-60:].mean())
            recent_vol = float(volume.iloc[-10:].mean())
            volume_ratio = round(recent_vol / avg_vol_60, 2) if avg_vol_60 > 0 else 1.0

            recent_vol_std = float(close.iloc[-20:].std())
            prior_vol_std = float(close.iloc[-60:-20].std())
            vol_contraction = recent_vol_std < prior_vol_std

            recent_high = float(high.iloc[-30:].max()) if not high.tail(30).dropna().empty else current_price
            distance_to_pivot = ((recent_high - current_price) / current_price) * 100 if current_price > 0 else 0.0
            near_pivot = distance_to_pivot < 5.0

            delta = close.diff()
            gain = delta.clip(lower=0).rolling(14).mean()
            loss = (-delta.clip(upper=0)).rolling(14).mean()
            rs = gain / loss.replace(0, np.nan)
            if rs.empty or pd.isna(rs.iloc[-1]):
                rsi = 100.0
            else:
                rsi = float(100 - 100 / (1 + rs.iloc[-1]))

            score = 0
            if relative_strength > 0:
                score += 25
            if above_sma20:
                score += 15
            if above_sma50:
                score += 10
            if sma_cross:
                score += 15
            if volume_ratio > 1.2:
                score += 15
            if vol_contraction:
                score += 10
            if near_pivot:
                score += 10

            signal = "Strong Buy" if score >= 85 else "Buy" if score >= 70 else "Watch"
            candidate = {
                "symbol": symbol,
                "score": score,
                "signal": signal,
                "relative_strength": round(relative_strength, 2),
                "stock_return_3m": round(stock_return_3m, 2),
                "sector_return_3m": round(sector_return_3m, 2),
                "volume_ratio": volume_ratio,
                "current_price": round(current_price, 2),
                "pivot": round(recent_high, 2),
                "distance_to_pivot": round(distance_to_pivot, 2),
                "rsi": round(rsi, 1),
                "above_sma20": above_sma20,
                "above_sma50": above_sma50,
                "sma_cross": sma_cross,
                "vol_contraction": vol_contraction,
            }
            fallback_candidates.append(candidate)
            if score >= min_score:
                rotation_picks.append(candidate)
        except Exception:
            continue

    if not rotation_picks and fallback_candidates:
        fallback_candidates.sort(key=lambda x: x["score"], reverse=True)
        rotation_picks = fallback_candidates[:3]

    rotation_picks.sort(key=lambda x: x["score"], reverse=True)
    return rotation_picks


def generate_rotation_picks():
    print("Sector Rotation Stock Picker running...")

    phase, leading_sectors, all_performance = identify_rotation_phase()
    if not leading_sectors and all_performance:
        leading_sectors = [
            symbol
            for symbol, _ in sorted(all_performance.items(), key=lambda x: x[1]["score"], reverse=True)[:3]
        ]

    print(f"  Phase: {phase.upper()} | Leaders: {', '.join(leading_sectors)}")

    rotation_picks = {}
    for sector in leading_sectors:
        sector_name = all_performance.get(sector, {}).get("name", sector)
        stocks = find_rotation_stocks(sector, min_score=70)
        rotation_picks[sector] = {
            "name": sector_name,
            "performance": all_performance.get(sector, {}),
            "stocks": stocks,
        }
        print(f"  {sector} ({sector_name}): {len(stocks)} picks")

    all_stocks = []
    for sector_data in rotation_picks.values():
        for stock in sector_data["stocks"]:
            if not any(existing["symbol"] == stock["symbol"] for existing in all_stocks):
                all_stocks.append(stock)

    all_stocks.sort(key=lambda x: x["score"], reverse=True)
    top10 = all_stocks[:10]

    result = {
        "timestamp": datetime.now().isoformat(),
        "phase": phase,
        "phase_label": PHASE_LABELS.get(phase, phase),
        "phase_color": PHASE_COLOR.get(phase, "#6b7280"),
        "leading_sectors": leading_sectors,
        "sector_performance": all_performance,
        "rotation_picks": rotation_picks,
        "top10": top10,
        "total_picks": len(all_stocks),
    }

    out_path = os.path.join(output_dir(), "rotation_picks.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    top_symbol = top10[0]["symbol"] if top10 else "N/A"
    print(f"  Done: {len(all_stocks)} rotation stocks | Phase={phase} | Top={top_symbol}")


if __name__ == "__main__":
    generate_rotation_picks()
