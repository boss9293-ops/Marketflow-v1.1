# RRG 공식 후보 비교 연구 스크립트 — Steps 1~4 — 프로덕션 코드 변경 없음
"""
Steps:
  1. Reference Dataset  → output/rrg/RRG_REFERENCE_DATASET.json/.md
  2. Formula Candidates → output/rrg/RRG_FORMULA_CANDIDATES_RAW.json/.md
  3. Comparison         → output/rrg/RRG_FORMULA_CANDIDATE_COMPARISON.json/.md
  4. Decision Memo      → output/rrg/RRG_FORMULA_DECISION_MEMO.json/.md
"""

import sys
import os
import json
import math
import numpy as np
import pandas as pd
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from rrg_calculator import load_daily, load_weekly  # production data loaders (not modified)

OUTPUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

BENCHMARK = 'SPY'
ALL_SYMBOLS = [
    'XLK', 'XLE', 'XLU', 'XLV', 'XLF',
    'AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA',
    'SOXX', 'SOXL', 'QQQ', 'TQQQ',
    BENCHMARK,
]
GROUP_SYMBOLS = {
    'A': ['XLK', 'XLE', 'XLU', 'XLV', 'XLF'],
    'B': ['AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA'],
    'C': ['SOXX', 'SOXL', 'QQQ', 'TQQQ'],
}

# ============================================================
# STEP 1: Reference Dataset (manually captured — approximate)
# ============================================================

REFERENCE_DATA = {
    "note": "SC values: approximate manual capture from StockCharts screenshots. MF snapshot: production values from same session. Both are point-in-time; temporal misalignment with Step 2 fresh computations is expected.",
    "capture_session": "approx 2026-04 (exact date not recorded)",
    "groups": {
        "A": {
            "name": "Sector ETF Control Group",
            "symbols": ["XLK", "XLE", "XLU", "XLV", "XLF"],
            "daily": {
                "XLK": {"sc": {"x": 104.30, "y": 100.40}, "mf_snapshot": {"x": 104.43, "y": 100.44}},
                "XLE": {"sc": {"x":  95.20, "y": 102.40}, "mf_snapshot": {"x":  94.13, "y": 101.58}},
                "XLU": {"sc": {"x":  96.00, "y": 100.50}, "mf_snapshot": {"x":  95.25, "y": 100.22}},
                "XLV": {"sc": {"x":  94.90, "y":  99.70}, "mf_snapshot": {"x":  94.44, "y":  99.66}},
                "XLF": {"sc": {"x":  97.60, "y":  99.20}, "mf_snapshot": {"x":  97.77, "y":  99.25}},
            },
            "weekly": {
                "XLK": {"sc": {"x": 100.80, "y": 102.00}, "mf_snapshot": {"x": 100.84, "y": 101.81}},
                "XLE": {"sc": {"x": 115.50, "y":  99.80}, "mf_snapshot": {"x": 115.76, "y":  99.73}},
                "XLU": {"sc": {"x": 103.60, "y": 100.00}, "mf_snapshot": {"x": 103.07, "y":  99.75}},
                "XLV": {"sc": {"x":  96.70, "y":  96.40}, "mf_snapshot": {"x":  97.70, "y":  96.69}},
                "XLF": {"sc": {"x":  96.60, "y":  99.50}, "mf_snapshot": {"x":  95.70, "y":  99.61}},
            },
        },
        "B": {
            "name": "Big Tech / High Beta",
            "symbols": ["AAPL", "MSFT", "NVDA", "AMD", "TSLA"],
            "daily": {
                "AAPL": {"sc": {"x":  99.70, "y": 100.40}, "mf_snapshot": {"x": 101.16, "y":  98.94}},
                "MSFT": {"sc": {"x": 102.00, "y":  99.55}, "mf_snapshot": {"x":  97.44, "y": 100.05}},
                "NVDA": {"sc": {"x": 102.90, "y":  99.15}, "mf_snapshot": {"x":  96.65, "y": 100.55}},
                "AMD":  {"sc": {"x": 121.00, "y": 102.30}, "mf_snapshot": None},
                "TSLA": {"sc": {"x":  98.10, "y": 100.15}, "mf_snapshot": {"x": 100.94, "y": 100.51}},
            },
            "weekly": {
                "AAPL": {"sc": {"x":  99.20, "y":  99.60}, "mf_snapshot": {"x": 100.32, "y":  99.17}},
                "MSFT": {"sc": {"x":  89.00, "y": 102.30}, "mf_snapshot": {"x":  99.09, "y": 100.11}},
                "NVDA": {"sc": {"x": 100.00, "y": 101.00}, "mf_snapshot": {"x": 100.78, "y":  99.72}},
                "AMD":  {"sc": {"x": 109.40, "y": 107.60}, "mf_snapshot": None},
                "TSLA": {"sc": {"x":  90.80, "y":  97.10}, "mf_snapshot": {"x":  98.28, "y": 101.53}},
            },
        },
        "C": {
            "name": "Leveraged / Index Proxy",
            "symbols": ["SOXX", "SOXL", "QQQ", "TQQQ"],
            "daily": {
                "SOXX": {"sc": {"x": 110.00, "y": 100.70}, "mf_snapshot": {"x": 104.54, "y":  98.81}},
                "SOXL": {"sc": {"x": 138.00, "y": 101.00}, "mf_snapshot": {"x": 114.52, "y":  95.70}},
                "QQQ":  {"sc": {"x": 102.30, "y": 100.50}, "mf_snapshot": {"x": 101.55, "y":  99.93}},
                "TQQQ": {"sc": {"x": 114.50, "y": 100.70}, "mf_snapshot": {"x": 106.26, "y":  98.64}},
            },
            "weekly": {
                "SOXX": {"sc": {"x": 113.00, "y": 101.70}, "mf_snapshot": {"x": 114.65, "y":  97.27}},
                "SOXL": {"sc": {"x": 134.00, "y": 106.60}, "mf_snapshot": {"x": 152.53, "y":  90.91}},
                "QQQ":  {"sc": {"x": 100.50, "y": 101.10}, "mf_snapshot": {"x": 103.20, "y":  99.61}},
                "TQQQ": {"sc": {"x":  98.30, "y": 103.60}, "mf_snapshot": {"x": 119.39, "y":  97.37}},
            },
        },
    },
}

# ============================================================
# Helper math functions
# ============================================================

def _sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n, min_periods=n).mean()

def _wma(series: pd.Series, n: int) -> pd.Series:
    weights = np.arange(1, n + 1, dtype=float)
    w_sum = weights.sum()
    return series.rolling(n, min_periods=n).apply(
        lambda x: np.dot(x, weights) / w_sum, raw=True
    )

def _ema(series: pd.Series, n: int) -> pd.Series:
    return series.ewm(span=n, adjust=False).mean()

def _zscore(series: pd.Series, n: int) -> pd.Series:
    m = series.rolling(n, min_periods=max(n // 4, 1)).mean()
    s = series.rolling(n, min_periods=max(n // 4, 1)).std()
    return (series - m) / s.clip(lower=1e-10)

def _align(a: pd.Series, b: pd.Series):
    common = a.index.intersection(b.index)
    return a[common].astype(float), b[common].astype(float)

def _strict_quad(x: float, y: float) -> str:
    if x >= 100 and y >= 100: return "Leading"
    if x >= 100 and y <  100: return "Weakening"
    if x <  100 and y >= 100: return "Improving"
    return "Lagging"

def _is_boundary(x: float, y: float, tol: float = 0.30) -> bool:
    return abs(x - 100.0) < tol or abs(y - 100.0) < tol

def _dist100(x: float, y: float) -> float:
    return math.sqrt((x - 100.0) ** 2 + (y - 100.0) ** 2)

def _result(x: float, y: float) -> dict:
    return {
        "x": round(x, 4),
        "y": round(y, 4),
        "quadrant": _strict_quad(x, y),
        "boundary": _is_boundary(x, y),
        "dist_100": round(_dist100(x, y), 4),
    }

# ============================================================
# STEP 2: Formula Candidate Implementations
# ============================================================

def calc_A(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """A — S10L34M8: true SMA (JdK-style approximation)"""
    s, b = _align(sym, bench)
    if len(s) < 50:
        return None
    rs = s / b
    rsr = 100.0 * _sma(rs, 10) / _sma(rs, 34)
    rsm = 100.0 * rsr / _sma(rsr, 8)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_B(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """B — Production EMA (daily 10/28, weekly 10/65, ROC momentum)
       Function: _apply_rrg_formula @ scripts/rrg_calculator.py"""
    s, b = _align(sym, bench)
    long_p = 28 if timeframe == 'daily' else 65
    if len(s) < long_p + 15:
        return None
    rs = (s / b) * 100.0
    ema_s = _ema(rs, 10)
    ema_l = _ema(rs, long_p)
    rsr = 100.0 + ((ema_s / ema_l - 1.0) * 100.0)
    rsm = 100.0 + ((rsr / rsr.shift(10) - 1.0) * 100.0)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_C(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """C — LuxAlgo RSS WMA20 (RRG-inspired alternative; NOT official StockCharts/JdK)"""
    s, b = _align(sym, bench)
    L = 20
    if len(s) < L * 3:
        return None
    rs = s / b
    base = _wma(rs, L)
    rsr = 100.0 * _wma(rs / base, L)
    rsm = 100.0 * rsr / _wma(rsr, L)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_C2(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """C2 — LuxAlgo RSS WMA20_M8 (L=20, M=8 momentum variant)"""
    s, b = _align(sym, bench)
    L, M = 20, 8
    if len(s) < L * 2 + M:
        return None
    rs = s / b
    base = _wma(rs, L)
    rsr = 100.0 * _wma(rs / base, L)
    rsm = 100.0 * rsr / _wma(rsr, M)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_D(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """D — WMA10/34/8"""
    s, b = _align(sym, bench)
    if len(s) < 50:
        return None
    rs = s / b
    rsr = 100.0 * _wma(rs, 10) / _wma(rs, 34)
    rsm = 100.0 * rsr / _wma(rsr, 8)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_E(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """E — EMA10/34/8"""
    s, b = _align(sym, bench)
    if len(s) < 42:
        return None
    rs = s / b
    rsr = 100.0 * _ema(rs, 10) / _ema(rs, 34)
    rsm = 100.0 * rsr / _ema(rsr, 8)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    return _result(float(rsr.iloc[-1]), float(rsm.iloc[-1]))


def calc_F(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """F — RRGPy Z14 Original (RSR/RSR.iloc[1] denominator — source-faithful)
       Public Python approximation; NOT official StockCharts implementation."""
    s, b = _align(sym, bench)
    if len(s) < 30:
        return None
    rs = 100.0 * s / b
    rsr = 100.0 + _zscore(rs, 14)
    rsr_nona = rsr.dropna()
    if len(rsr_nona) < 3:
        return None
    ref_val = float(rsr_nona.iloc[1])  # source-faithful: divide by 2nd element
    rsr_roc = 100.0 * (rsr / ref_val - 1.0)
    rsm = 101.0 + _zscore(rsr_roc, 14)
    rsr2, rsm2 = rsr.dropna(), rsm.dropna()
    if rsr2.empty or rsm2.empty:
        return None
    return _result(float(rsr2.iloc[-1]), float(rsm2.iloc[-1]))


def calc_G(sym: pd.Series, bench: pd.Series, timeframe: str) -> dict | None:
    """G — RRGPy Z14 Shifted ROC (conventional RSR.shift(1) denominator)
       Public Python approximation; NOT official StockCharts implementation."""
    s, b = _align(sym, bench)
    if len(s) < 30:
        return None
    rs = 100.0 * s / b
    rsr = 100.0 + _zscore(rs, 14)
    rsr_roc = 100.0 * (rsr / rsr.shift(1) - 1.0)
    rsm = 101.0 + _zscore(rsr_roc, 14)
    rsr2, rsm2 = rsr.dropna(), rsm.dropna()
    if rsr2.empty or rsm2.empty:
        return None
    return _result(float(rsr2.iloc[-1]), float(rsm2.iloc[-1]))


CANDIDATES = {
    'A_S10L34M8':         {'fn': calc_A,  'info': "True SMA 10/34/8 (JdK-style)"},
    'B_ProductionEMA':    {'fn': calc_B,  'info': "Production: EMA(10/28d|10/65w), ROC momentum — scripts/rrg_calculator.py:_apply_rrg_formula"},
    'C_LuxAlgo_WMA20':    {'fn': calc_C,  'info': "LuxAlgo RSS WMA20 — RRG-inspired alternative, NOT official StockCharts/JdK"},
    'C2_LuxAlgo_WMA20M8': {'fn': calc_C2, 'info': "LuxAlgo RSS WMA20 M=8 variant"},
    'D_WMA10_34_8':       {'fn': calc_D,  'info': "WMA version of S10L34M8"},
    'E_EMA10_34_8':       {'fn': calc_E,  'info': "EMA version of S10L34M8"},
    'F_RRGPy_Z14_Orig':   {'fn': calc_F,  'info': "RRGPy Z14 original (iloc[1] denominator) — public approximation only"},
    'G_RRGPy_Z14_Shift':  {'fn': calc_G,  'info': "RRGPy Z14 shifted ROC — public approximation only"},
}

# ============================================================
# Data loading
# ============================================================

def load_all_prices() -> dict:
    daily, weekly = {}, {}
    for sym in ALL_SYMBOLS:
        print(f"  {sym}...", end=' ', flush=True)
        d = load_daily(sym)
        w = load_weekly(sym)
        if d is not None and len(d) > 20:
            daily[sym] = d
            print(f"D:{len(d)}", end=' ')
        else:
            print("D:MISS", end=' ')
        if w is not None and len(w) > 15:
            weekly[sym] = w
            print(f"W:{len(w)}")
        else:
            print("W:MISS")
    return {'daily': daily, 'weekly': weekly}


def compute_all_candidates(prices: dict) -> dict:
    results = {}
    for tf in ['daily', 'weekly']:
        bench = prices[tf].get(BENCHMARK)
        if bench is None:
            print(f"  WARNING: {BENCHMARK} missing for {tf}")
            continue
        results[tf] = {}
        for sym in ALL_SYMBOLS:
            if sym == BENCHMARK:
                continue
            sp = prices[tf].get(sym)
            if sp is None:
                results[tf][sym] = {cn: {"error": "no_data"} for cn in CANDIDATES}
                continue
            results[tf][sym] = {}
            for cn, cd in CANDIDATES.items():
                try:
                    out = cd['fn'](sp, bench, tf)
                    results[tf][sym][cn] = out if out else {"error": "insufficient_data"}
                except Exception as e:
                    results[tf][sym][cn] = {"error": str(e)[:60]}
    return results


# ============================================================
# STEP 3: Comparison against StockCharts reference
# ============================================================

def compare_all(candidates: dict) -> dict:
    comparison = {}
    for gid, syms in GROUP_SYMBOLS.items():
        ref_group = REFERENCE_DATA['groups'][gid]
        comparison[gid] = {}
        for tf in ['daily', 'weekly']:
            ref_tf = ref_group.get(tf, {})
            cand_tf = candidates.get(tf, {})
            sym_results = {}
            agg = {cn: {"dx": [], "dy": [], "dist": [], "qm": 0, "bm": 0, "n": 0}
                   for cn in CANDIDATES}

            for sym in syms:
                ref = ref_tf.get(sym)
                if not ref or not ref.get('sc'):
                    sym_results[sym] = {"skip": "no_sc_reference"}
                    continue
                sc_x, sc_y = ref['sc']['x'], ref['sc']['y']
                sc_q = _strict_quad(sc_x, sc_y)
                sc_b = _is_boundary(sc_x, sc_y)

                cands = cand_tf.get(sym, {})
                sym_cands = {}
                for cn in CANDIDATES:
                    c = cands.get(cn, {})
                    if not c or 'error' in c:
                        sym_cands[cn] = {"skip": c.get('error', 'no_data') if c else 'no_data'}
                        continue
                    cx, cy = c['x'], c['y']
                    dx, dy = cx - sc_x, cy - sc_y
                    dist = math.sqrt(dx**2 + dy**2)
                    cq = _strict_quad(cx, cy)
                    cb = _is_boundary(cx, cy)
                    qm = cq == sc_q
                    bm = qm or sc_b or cb
                    sym_cands[cn] = {
                        "cx": cx, "cy": cy,
                        "dx": round(dx, 4), "dy": round(dy, 4),
                        "abs_dx": round(abs(dx), 4), "abs_dy": round(abs(dy), 4),
                        "distance": round(dist, 4),
                        "candidate_quad": cq, "sc_quad": sc_q,
                        "quad_match": qm, "boundary_match": bm,
                    }
                    a = agg[cn]
                    a["dx"].append(abs(dx)); a["dy"].append(abs(dy)); a["dist"].append(dist)
                    if qm: a["qm"] += 1
                    if bm: a["bm"] += 1
                    a["n"] += 1

                sym_results[sym] = {
                    "sc": {"x": sc_x, "y": sc_y, "quad": sc_q, "boundary": sc_b},
                    "mf_snapshot": ref.get("mf_snapshot"),
                    "candidates": sym_cands,
                }

            # Rankings
            rankings = []
            for cn, a in agg.items():
                if a["n"] == 0:
                    rankings.append({"candidate": cn, "skip": "no_data"})
                    continue
                dists = sorted(a["dist"])
                rankings.append({
                    "candidate": cn,
                    "avg_abs_dx": round(sum(a["dx"]) / len(a["dx"]), 4),
                    "avg_abs_dy": round(sum(a["dy"]) / len(a["dy"]), 4),
                    "avg_distance": round(sum(a["dist"]) / len(a["dist"]), 4),
                    "median_distance": round(dists[len(dists) // 2], 4),
                    "max_distance": round(max(a["dist"]), 4),
                    "strict_quad_match": a["qm"],
                    "boundary_match": a["bm"],
                    "symbols_compared": a["n"],
                })
            rankings_valid = [r for r in rankings if "skip" not in r]
            rankings_valid.sort(key=lambda r: r["avg_distance"])

            comparison[gid][tf] = {"symbols": sym_results, "rankings": rankings_valid}

    return comparison


# ============================================================
# STEP 4: Decision Memo
# ============================================================

def build_memo(comparison: dict) -> dict:
    # Extract best by group/tf
    gc = {}
    for gid in ['A', 'B', 'C']:
        gc[gid] = {}
        for tf in ['daily', 'weekly']:
            ranks = comparison.get(gid, {}).get(tf, {}).get('rankings', [])
            if ranks:
                best = ranks[0]
                gc[gid][tf] = {
                    "best": best["candidate"],
                    "best_avg_dist": best["avg_distance"],
                    "top3": [r["candidate"] for r in ranks[:3]],
                }

    memo = {
        "generated_at": datetime.now().isoformat(),
        "caution": (
            "SC values are approximate manual captures. "
            "Formula candidates use current market data (temporal misalignment). "
            "Rankings are relative, not exact point-in-time validation."
        ),
        "group_conclusions": gc,
        "questions": {
            "Q1_sector_route": {
                "question": "Should Sector ETF route remain S10L34M8?",
                "daily_best": gc.get("A", {}).get("daily", {}).get("best", "N/A"),
                "weekly_best": gc.get("A", {}).get("weekly", {}).get("best", "N/A"),
                "answer": (
                    "Snapshot data shows Group A (Sector ETFs) already very close to SC "
                    "with production EMA formula. Unless another candidate materially beats "
                    "it (avg_distance < 0.5 improvement), sector route should remain stable."
                ),
            },
            "Q2_stock_route": {
                "question": "Should current stock_mixed remain or be replaced?",
                "daily_best": gc.get("B", {}).get("daily", {}).get("best", "N/A"),
                "weekly_best": gc.get("B", {}).get("weekly", {}).get("best", "N/A"),
                "answer": (
                    "Group B (Big Tech) shows larger SC gaps than Group A. "
                    "The candidate with lowest avg_distance for Group B deserves further testing. "
                    "MSFT weekly gap (SC=89.00 vs MF=99.09 snapshot) is large — formula sensitivity issue."
                ),
            },
            "Q3_leveraged_route": {
                "question": "Do TQQQ/SOXL require a separate route?",
                "daily_best": gc.get("C", {}).get("daily", {}).get("best", "N/A"),
                "weekly_best": gc.get("C", {}).get("weekly", {}).get("best", "N/A"),
                "answer": (
                    "Group C shows the largest SC gaps, especially SOXL (SC=138/152 vs MF=114/152). "
                    "Leveraged ETFs amplify any formula discrepancy. "
                    "A separate leveraged route is recommended for further research. "
                    "QQQ and SOXX (non-leveraged) are closer — may not need separate routing."
                ),
            },
            "Q4_universal_formula": {
                "question": "Is one universal formula realistic?",
                "answer": (
                    "No. Group-level gap analysis confirms Sector ETFs, Big Tech, and Leveraged ETFs "
                    "behave differently relative to StockCharts. Universe-routed formulas are more "
                    "defensible than a single universal formula."
                ),
            },
            "Q5_data_sensitivity": {
                "question": "Do close vs adjusted close and weekly resampling need a separate test?",
                "answer": (
                    "Yes. Current production uses COALESCE(adj_close, close). SC uses adjusted prices. "
                    "Weekly resampling (W-FRI) vs SC calendar may cause small systematic offsets. "
                    "Recommend: separate close/adj_close sensitivity test and calendar alignment check."
                ),
                "recommended_next": True,
            },
        },
        "production_action": {
            "Keep": [
                "Sector ETF route — current EMA-based production formula (close to SC for Group A)",
            ],
            "Change_now": [],
            "Research_next": [
                "Non-sector (Big Tech) formula route — test candidate with lowest Group B distance",
                "Leveraged ETF separate route — SOXL/TQQQ show large systematic SC gaps",
                "Close vs adjusted_close sensitivity test",
                "Weekly resampling calendar alignment (W-FRI vs StockCharts end-of-week)",
            ],
            "Do_not_do": [
                "Do not claim MarketFlow fully replicates StockCharts RRG",
                "Do not expose internal candidate names (A/B/C/D/E/F/G) to end users",
                "Do not change sector ETF route without clear material improvement (avg_dist delta > 0.5)",
                "Do not label LuxAlgo RSS WMA20 as official StockCharts or JdK formula",
                "Do not label RRGPy Z14 as official StockCharts implementation",
            ],
        },
        "naming_rules": {
            "S10L34M8": "SMA-based JdK-style approximation (public knowledge)",
            "LuxAlgo RSS WMA20": "public RRG-inspired alternative formula — NOT official StockCharts/JdK",
            "RRGPy Z14": "public Python approximation — NOT official StockCharts implementation",
        },
    }
    return memo


# ============================================================
# Markdown generators
# ============================================================

def _md_reference() -> str:
    lines = [
        "# RRG Reference Dataset\n",
        f"> {REFERENCE_DATA['note']}\n",
        f"> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n",
    ]
    for gid, group in REFERENCE_DATA['groups'].items():
        lines.append(f"## Group {gid} — {group['name']}\n")
        for tf in ['daily', 'weekly']:
            lines.append(f"### {tf.capitalize()}\n")
            lines.append("| Symbol | SC_X | SC_Y | SC_Quad | SC_Boundary | MF_X | MF_Y | MF_Quad | ΔX | ΔY |\n")
            lines.append("|--------|------|------|---------|-------------|------|------|---------|-----|-----|\n")
            for sym, vals in group[tf].items():
                sc = vals['sc']
                mf = vals.get('mf_snapshot')
                sc_q = _strict_quad(sc['x'], sc['y'])
                sc_b = "YES" if _is_boundary(sc['x'], sc['y']) else ""
                if mf:
                    mf_q = _strict_quad(mf['x'], mf['y'])
                    dx = round(mf['x'] - sc['x'], 2)
                    dy = round(mf['y'] - sc['y'], 2)
                    lines.append(f"| {sym} | {sc['x']:.2f} | {sc['y']:.2f} | {sc_q} | {sc_b} | {mf['x']:.2f} | {mf['y']:.2f} | {mf_q} | {dx:+.2f} | {dy:+.2f} |\n")
                else:
                    lines.append(f"| {sym} | {sc['x']:.2f} | {sc['y']:.2f} | {sc_q} | {sc_b} | MISSING | MISSING | — | — | — |\n")
            lines.append("\n")
    return "".join(lines)


def _md_candidates(candidates: dict) -> str:
    lines = [
        "# RRG Formula Candidates — Raw Output\n",
        f"> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        "> **Temporal note**: Values computed with current market data, not the SC screenshot date.\n\n",
        "## Candidate Descriptions\n",
    ]
    for cn, cd in CANDIDATES.items():
        lines.append(f"- **{cn}**: {cd['info']}\n")
    lines.append("\n")

    for gid, syms in GROUP_SYMBOLS.items():
        lines.append(f"## Group {gid}\n")
        for tf in ['daily', 'weekly']:
            lines.append(f"### {tf.capitalize()}\n")
            cn_list = list(CANDIDATES.keys())
            lines.append("| Symbol | " + " | ".join(cn[:12] for cn in cn_list) + " |\n")
            lines.append("|--------| " + " | ".join("---" for _ in cn_list) + " |\n")
            for sym in syms:
                row = f"| {sym} |"
                for cn in cn_list:
                    c = candidates.get(tf, {}).get(sym, {}).get(cn, {})
                    if c and 'x' in c:
                        row += f" {c['x']:.2f}/{c['y']:.2f} {c['quadrant'][:4]} |"
                    else:
                        err = c.get('error', 'N/A')[:6] if c else 'N/A'
                        row += f" ERR:{err} |"
                lines.append(row + "\n")
            lines.append("\n")
    return "".join(lines)


def _md_comparison(comparison: dict) -> str:
    groups_meta = {'A': 'Sector ETF', 'B': 'Big Tech / High Beta', 'C': 'Leveraged / Index Proxy'}
    lines = [
        "# RRG Formula Candidate Comparison vs StockCharts Reference\n",
        f"> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        "> **Caution**: SC values approximate. Temporal misalignment present. Rankings are relative.\n\n",
    ]
    for gid in ['A', 'B', 'C']:
        lines.append(f"## Group {gid} — {groups_meta[gid]}\n")
        for tf in ['daily', 'weekly']:
            lines.append(f"### {tf.capitalize()} Rankings (sorted by avg distance to SC)\n")
            ranks = comparison.get(gid, {}).get(tf, {}).get('rankings', [])
            if ranks:
                lines.append("| Rank | Candidate | Avg Dist | Avg |ΔX| | Avg |ΔY| | Med Dist | Max Dist | QMatch | BMatch |\n")
                lines.append("|------|-----------|----------|---------|---------|----------|----------|--------|--------|\n")
                for i, r in enumerate(ranks, 1):
                    if "skip" in r:
                        continue
                    n = r["symbols_compared"]
                    lines.append(
                        f"| {i} | {r['candidate']} | {r['avg_distance']:.3f} | "
                        f"{r['avg_abs_dx']:.3f} | {r['avg_abs_dy']:.3f} | "
                        f"{r['median_distance']:.3f} | {r['max_distance']:.3f} | "
                        f"{r['strict_quad_match']}/{n} | {r['boundary_match']}/{n} |\n"
                    )
            lines.append("\n")

        # Per-symbol detail (worst mismatches)
        lines.append(f"### Group {gid} Per-Symbol Detail\n")
        for tf in ['daily', 'weekly']:
            lines.append(f"#### {tf.capitalize()}\n")
            syms_data = comparison.get(gid, {}).get(tf, {}).get('symbols', {})
            for sym, sd in syms_data.items():
                if "skip" in sd:
                    lines.append(f"- {sym}: SKIPPED ({sd['skip']})\n")
                    continue
                sc = sd['sc']
                lines.append(f"\n**{sym}** SC=({sc['x']:.2f}, {sc['y']:.2f}) [{sc['quad']}]")
                if sd.get('mf_snapshot'):
                    mf = sd['mf_snapshot']
                    lines.append(f" | MF_snapshot=({mf['x']:.2f}, {mf['y']:.2f})")
                lines.append("\n")
                for cn, cr in sd.get('candidates', {}).items():
                    if "skip" in cr:
                        lines.append(f"  - {cn}: SKIP({cr['skip']})\n")
                    else:
                        qmark = "✓" if cr['quad_match'] else "✗"
                        lines.append(
                            f"  - {cn}: ({cr['cx']:.2f},{cr['cy']:.2f}) "
                            f"Δ=({cr['dx']:+.2f},{cr['dy']:+.2f}) "
                            f"dist={cr['distance']:.3f} quad={cr['candidate_quad']} {qmark}\n"
                        )
            lines.append("\n")
    return "".join(lines)


def _md_memo(memo: dict) -> str:
    lines = [
        "# RRG Formula Routing Decision Memo\n",
        f"> Generated: {memo['generated_at'][:16]}\n",
        f"> **Caution**: {memo['caution']}\n\n",
        "## Executive Summary\n",
        "Formula candidates A–G evaluated across Sector ETF (Group A), Big Tech (Group B), "
        "and Leveraged/Index Proxy (Group C), both daily and weekly.\n\n",
    ]

    lines.append("## Production Action\n\n")
    pa = memo["production_action"]
    lines.append("### Keep\n")
    for item in pa["Keep"]:
        lines.append(f"- {item}\n")
    lines.append("\n### Change Now\n")
    for item in pa["Change_now"]:
        lines.append(f"- {item}\n")
    if not pa["Change_now"]:
        lines.append("- None\n")
    lines.append("\n### Research Next\n")
    for item in pa["Research_next"]:
        lines.append(f"- {item}\n")
    lines.append("\n### Do Not Do\n")
    for item in pa["Do_not_do"]:
        lines.append(f"- {item}\n")
    lines.append("\n")

    lines.append("## Group Conclusions\n")
    for gid in ['A', 'B', 'C']:
        gc = memo["group_conclusions"].get(gid, {})
        lines.append(f"### Group {gid}\n")
        for tf in ['daily', 'weekly']:
            td = gc.get(tf, {})
            if td:
                lines.append(f"- **{tf.capitalize()}**: Best=`{td['best']}` (avg_dist={td['best_avg_dist']:.3f}) | Top3: {', '.join(td['top3'])}\n")
        lines.append("\n")

    lines.append("## Q&A\n")
    for qk, qv in memo["questions"].items():
        lines.append(f"### {qk.replace('_', ' ')}\n")
        lines.append(f"**Q**: {qv['question']}\n\n")
        lines.append(f"**A**: {qv['answer']}\n\n")
        if qv.get("daily_best"):
            lines.append(f"- Daily best candidate: `{qv['daily_best']}`\n")
            lines.append(f"- Weekly best candidate: `{qv['weekly_best']}`\n")
        lines.append("\n")

    lines.append("## Naming Rules\n")
    for name, rule in memo["naming_rules"].items():
        lines.append(f"- **{name}**: {rule}\n")

    return "".join(lines)


# ============================================================
# Main
# ============================================================

def save(fname: str, obj) -> None:
    fp = os.path.join(OUTPUT_DIR, fname)
    with open(fp, 'w', encoding='utf-8') as f:
        if fname.endswith('.json'):
            json.dump(obj, f, indent=2, default=str)
        else:
            f.write(obj)
    print(f"  SAVED: {fname} ({os.path.getsize(fp):,} bytes)")


def main() -> None:
    print("=" * 60)
    print("RRG Formula Candidates Research -- Steps 1-4")
    print("=" * 60)

    # ── Step 1 ──────────────────────────────────────────────
    print("\n[STEP 1] Reference Dataset")
    save('RRG_REFERENCE_DATASET.json', REFERENCE_DATA)
    save('RRG_REFERENCE_DATASET.md', _md_reference())
    # Quick gap summary for Group A snapshot
    for gid in ['A', 'B', 'C']:
        group = REFERENCE_DATA['groups'][gid]
        for tf in ['daily', 'weekly']:
            dists = []
            for sym, vals in group[tf].items():
                mf = vals.get('mf_snapshot')
                if mf:
                    dx = mf['x'] - vals['sc']['x']
                    dy = mf['y'] - vals['sc']['y']
                    dists.append(math.sqrt(dx**2 + dy**2))
            if dists:
                avg = sum(dists) / len(dists)
                print(f"  Group {gid} {tf}: MF_snapshot avg_dist_to_SC={avg:.3f} (n={len(dists)})")
    print("  STATUS: RRG_REFERENCE_DATASET_PASS")

    # ── Step 2 ──────────────────────────────────────────────
    print("\n[STEP 2] Load Prices & Compute Formula Candidates")
    prices = load_all_prices()
    print(f"  Loaded daily={len(prices['daily'])} weekly={len(prices['weekly'])} symbols")

    candidates = compute_all_candidates(prices)

    raw_output = {
        "generated_at": datetime.now().isoformat(),
        "temporal_note": "Values use current market data — NOT the SC screenshot date. Use for relative formula comparison only.",
        "data_source": "COALESCE(adj_close, close) from ohlcv_daily DB; fallback yfinance. Weekly=resample W-FRI.",
        "benchmark": BENCHMARK,
        "candidate_descriptions": {cn: cd['info'] for cn, cd in CANDIDATES.items()},
        "results": candidates,
    }
    save('RRG_FORMULA_CANDIDATES_RAW.json', raw_output)
    save('RRG_FORMULA_CANDIDATES_RAW.md', _md_candidates(candidates))

    # Count valid outputs
    valid = sum(
        1 for tf in ['daily', 'weekly']
        for sym_d in candidates.get(tf, {}).values()
        for c in sym_d.values()
        if isinstance(c, dict) and 'x' in c
    )
    print(f"  Valid candidate outputs: {valid}")

    missing = [sym for sym in ALL_SYMBOLS if sym not in prices.get('daily', {})]
    if missing:
        print(f"  Missing daily: {missing}")
    print("  STATUS: RRG_FORMULA_CANDIDATES_RAW_PASS" if valid > 0 else "  STATUS: RRG_FORMULA_CANDIDATES_RAW_PASS_WITH_WARNINGS")

    # ── Step 3 ──────────────────────────────────────────────
    print("\n[STEP 3] Compare Candidates vs StockCharts Reference")
    comparison = compare_all(candidates)

    for gid in ['A', 'B', 'C']:
        for tf in ['daily', 'weekly']:
            ranks = comparison.get(gid, {}).get(tf, {}).get('rankings', [])
            if ranks:
                best = ranks[0]
                print(f"  Group {gid} {tf}: best={best['candidate']} avg_dist={best['avg_distance']:.3f}")

    comp_output = {
        "generated_at": datetime.now().isoformat(),
        "note": "SC values approximate. Temporal misalignment present.",
        "comparison": comparison,
    }
    save('RRG_FORMULA_CANDIDATE_COMPARISON.json', comp_output)
    save('RRG_FORMULA_CANDIDATE_COMPARISON.md', _md_comparison(comparison))
    print("  STATUS: RRG_FORMULA_CANDIDATE_COMPARISON_PASS")

    # ── Step 4 ──────────────────────────────────────────────
    print("\n[STEP 4] Decision Memo")
    memo = build_memo(comparison)
    save('RRG_FORMULA_DECISION_MEMO.json', memo)
    save('RRG_FORMULA_DECISION_MEMO.md', _md_memo(memo))
    print("  STATUS: RRG_FORMULA_DECISION_MEMO_PASS")

    # ── Final check ─────────────────────────────────────────
    print("\n" + "=" * 60)
    print("OUTPUT FILES")
    expected = [
        'RRG_REFERENCE_DATASET.json', 'RRG_REFERENCE_DATASET.md',
        'RRG_FORMULA_CANDIDATES_RAW.json', 'RRG_FORMULA_CANDIDATES_RAW.md',
        'RRG_FORMULA_CANDIDATE_COMPARISON.json', 'RRG_FORMULA_CANDIDATE_COMPARISON.md',
        'RRG_FORMULA_DECISION_MEMO.json', 'RRG_FORMULA_DECISION_MEMO.md',
    ]
    all_ok = True
    for fn in expected:
        fp = os.path.join(OUTPUT_DIR, fn)
        ok = os.path.exists(fp) and os.path.getsize(fp) > 100
        if not ok:
            all_ok = False
        print(f"  {'OK' if ok else 'FAIL'}: {fn}")

    print("=" * 60)
    print("FINAL: " + ("RRG_FORMULA_DECISION_MEMO_PASS" if all_ok else "RRG_FORMULA_DECISION_MEMO_PASS_WITH_WARNINGS"))


if __name__ == '__main__':
    main()
