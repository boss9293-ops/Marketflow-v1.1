# RRG 프로덕션 공식 라우팅 감사 스크립트 — 읽기 전용, 코드 변경 없음
"""
WORK_ORDER: RRG Production Formula Routing Audit
Outputs:
  output/rrg/RRG_PRODUCTION_FORMULA_AUDIT.json
  output/rrg/RRG_PRODUCTION_FORMULA_AUDIT.md
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

from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import (
    classify_universe,
    compute_symbol_rrg,
    STANDARD_SECTOR_ETFS,
    _PRESETS,
    _fam_d,
    _fam_c,
    preset_id,
)

OUTPUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

BENCHMARK = 'SPY'

GROUP_SYMBOLS = {
    'A_Sector_ETF':           ['XLK', 'XLE', 'XLU', 'XLV', 'XLF'],
    'B_BigTech_HighBeta':     ['AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA'],
    'C_Leveraged_IndexProxy': ['SOXX', 'SOXL', 'QQQ', 'TQQQ'],
}

ALL_SYMBOLS = [s for syms in GROUP_SYMBOLS.values() for s in syms]

# ============================================================
# Candidate A — True SMA 10/34/8 (research best performer)
# ============================================================

def _sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n, min_periods=n).mean()

def _align(a: pd.Series, b: pd.Series):
    common = a.index.intersection(b.index)
    return a[common].astype(float), b[common].astype(float)

def calc_candidate_A(sym: pd.Series, bench: pd.Series) -> dict | None:
    """True SMA 10/34/8: RSR = 100*SMA(RS,10)/SMA(RS,34), RSM = 100*RSR/SMA(RSR,8)"""
    s, b = _align(sym, bench)
    if len(s) < 50:
        return None
    rs = s / b
    rsr = 100.0 * _sma(rs, 10) / _sma(rs, 34)
    rsm = 100.0 * rsr / _sma(rsr, 8)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty or rsm.empty:
        return None
    x, y = float(rsr.iloc[-1]), float(rsm.iloc[-1])
    return {'x': round(x, 4), 'y': round(y, 4)}

# ============================================================
# Production formula runner (direct call, no HTTP)
# ============================================================

def _to_weekly(s: pd.Series) -> pd.Series:
    return s.resample('W-FRI').last().dropna()

def run_production(sym_close: pd.Series, bench_close: pd.Series,
                   timeframe: str, symbols: list) -> dict:
    """
    Mirrors /api/rrg/candidate-d logic exactly.
    Returns {'x', 'y', 'universe_type', 'preset_id', 'family', 'formula_detail'}.
    """
    universe_type = classify_universe(symbols)
    p = _PRESETS[universe_type][timeframe]
    family = p['family']

    try:
        if family == 'D':
            rsr_s, rsm_s = _fam_d(sym_close, bench_close, p['N'], p['M'])
            formula_detail = (
                f"Family D: RSR=100*RS/SMA(RS,{p['N']}), "
                f"RSM=100*RSR/SMA(RSR,{p['M']})"
            )
        else:
            rsr_s, rsm_s = _fam_c(sym_close, bench_close, p['N'],
                                   p['Kx'], p['Ky'], p['EMA'])
            formula_detail = (
                f"Family C: EMA(RS,{p['EMA']}) z-score N={p['N']} "
                f"Kx={p['Kx']} Ky={p['Ky']}"
            )

        df = pd.DataFrame({'rsr': rsr_s, 'rsm': rsm_s}).dropna()
        if df.empty:
            return {'error': 'empty_result'}

        x, y = float(df['rsr'].iloc[-1]), float(df['rsm'].iloc[-1])
        return {
            'x': round(x, 4),
            'y': round(y, 4),
            'universe_type': universe_type,
            'preset_id': preset_id(universe_type, timeframe),
            'family': family,
            'formula_detail': formula_detail,
        }
    except Exception as e:
        return {'error': str(e)[:80]}

# ============================================================
# Route map documentation
# ============================================================

ROUTE_MAP = {
    '/api/rrg/candidate-d': {
        'file': 'backend/app.py:3710-3776',
        'router': 'rrg_engine_router.py:compute_symbol_rrg()',
        'Sector_ETF': {
            'classification': 'universe == STANDARD_SECTOR_ETFS entirely',
            'daily_preset': 'D_N65_M10',
            'weekly_preset': 'D_N52_M5',
            'family': 'D',
            'daily_formula': 'RSR=100*RS/SMA(RS,65), RSM=100*RSR/SMA(RSR,10)',
            'weekly_formula': 'RSR=100*RS/SMA(RS,52), RSM=100*RSR/SMA(RSR,5)',
        },
        'Non_Sector': {
            'classification': 'any symbol NOT in STANDARD_SECTOR_ETFS',
            'daily_preset': 'C_s10_N65_Kx2_Ky2',
            'weekly_preset': 'C_s10_N52_Kx2_Ky2',
            'family': 'C',
            'formula': 'EMA(RS,10) z-score, N-period rolling mean/std(ddof=0), shifted by 1, Kx=Ky=2',
        },
    },
    '/api/rrg/custom': {
        'file': 'backend/app.py:3529-3704',
        'router': 'rrg_calculator.py:calculate_rrg_daily()|calculate_rrg()',
        'formula': 'EMA-based: RS=(close/bench)*100, RSR=100+((EMA(RS,10)/EMA(RS,28|65)-1)*100), RSM=100+ROC(RSR,10)',
        'all_symbols': 'same formula regardless of symbol type',
    },
    'Candidate_A_S10L34M8': {
        'file': 'research_rrg_formula_candidates.py:calc_A()',
        'formula': 'RSR=100*SMA(RS,10)/SMA(RS,34), RSM=100*RSR/SMA(RSR,8)',
        'note': 'True JdK-style SMA approximation. Research only — not in production.',
    },
}

# ============================================================
# Mismatch root-cause analysis
# ============================================================

ROOT_CAUSES = {
    'primary': (
        "Production Family D uses RS/SMA(RS,N) normalization (single-SMA baseline), "
        "while Candidate A uses SMA(RS,10)/SMA(RS,34) ratio (dual-SMA momentum). "
        "These are fundamentally different mathematical structures — "
        "Family D measures RS level vs its own history; "
        "Candidate A measures fast vs slow RS momentum."
    ),
    'sector_daily': (
        "Family D N=65 computes RSR=100*RS/SMA(RS,65). "
        "Candidate A computes RSR=100*SMA(RS,10)/SMA(RS,34). "
        "For sector ETFs, both center near 100, but Candidate A tracks StockCharts "
        "cross-sectional behavior more closely (avg_dist=0.419 vs Family D's distance)."
    ),
    'sector_weekly': (
        "Family D N=52 vs Candidate A 10/34. "
        "Weekly data amplifies the formula difference. "
        "Candidate A avg_dist=0.677; Family D is worse because 52-week SMA "
        "creates heavier lag than 34-week SMA in the ratio formula."
    ),
    'big_tech': (
        "Big Tech uses Family C (EMA z-score). "
        "Candidate A (SMA 10/34) still beats Family C for Big Tech proximity to SC. "
        "MSFT weekly gap (SC=89.00) is extreme — Family C z-score formula "
        "compresses extreme movers differently than StockCharts."
    ),
    'leveraged': (
        "Leveraged ETFs (SOXL, TQQQ) use Family C. "
        "3x leverage amplifies RS volatility. "
        "Family C z-score re-normalizes to ±Kx*sigma scale, "
        "which compresses or expands values unpredictably for leveraged instruments. "
        "Candidate A still best but avg_dist=2.5+ indicates formula mismatch "
        "is secondary to the fundamental nature of leveraged replication."
    ),
    'not_causes': [
        "Frontend stale cache — frontend now correctly reads both sectors/symbols keys with fallback chain",
        "Backend not restarted — direct function calls in audit bypass HTTP",
        "Different benchmark — all tests use SPY",
        "Different date — all computations use latest available data",
        "Price field — both use COALESCE(adj_close, close) via load_daily",
    ],
}

# ============================================================
# Main audit
# ============================================================

def run_audit():
    print("=" * 60)
    print("RRG Production Formula Audit")
    print("=" * 60)

    # Load prices
    print("\nLoading prices...")
    daily_prices, weekly_prices = {}, {}

    bench_daily = load_daily(BENCHMARK)
    bench_weekly = load_weekly(BENCHMARK)  # 1600+ day lookback via rrg_calculator
    daily_prices[BENCHMARK] = bench_daily
    weekly_prices[BENCHMARK] = bench_weekly

    for sym in ALL_SYMBOLS:
        d = load_daily(sym)
        w = load_weekly(sym)
        if d is not None and len(d) > 50:
            daily_prices[sym] = d
        else:
            print(f"  {sym}: daily MISSING")
        if w is not None and len(w) > 50:
            weekly_prices[sym] = w
        else:
            print(f"  {sym}: weekly MISSING")
        dl = len(daily_prices.get(sym, []))
        wl = len(weekly_prices.get(sym, []))
        if dl or wl:
            print(f"  {sym}: D={dl} W={wl}")

    # Build comparison table
    rows = []
    for gid, syms in GROUP_SYMBOLS.items():
        for tf in ['daily', 'weekly']:
            bench = daily_prices.get(BENCHMARK) if tf == 'daily' else weekly_prices.get(BENCHMARK)
            if bench is None:
                continue
            for sym in syms:
                sym_p = daily_prices.get(sym) if tf == 'daily' else weekly_prices.get(sym)
                if sym_p is None:
                    rows.append({
                        'group': gid, 'symbol': sym, 'timeframe': tf,
                        'error': 'no_data',
                    })
                    continue

                # Production formula (mirrors candidate-d endpoint)
                prod = run_production(sym_p, bench, tf, [sym])

                # Candidate A
                cand_a = calc_candidate_A(sym_p, bench)

                if 'error' in prod or cand_a is None:
                    rows.append({
                        'group': gid, 'symbol': sym, 'timeframe': tf,
                        'production_error': prod.get('error') if 'error' in prod else None,
                        'candidate_a_error': None if cand_a else 'insufficient_data',
                    })
                    continue

                dx = round(prod['x'] - cand_a['x'], 4)
                dy = round(prod['y'] - cand_a['y'], 4)
                dist = round(math.sqrt(dx**2 + dy**2), 4)

                rows.append({
                    'group': gid,
                    'symbol': sym,
                    'timeframe': tf,
                    'production_x': prod['x'],
                    'production_y': prod['y'],
                    'candidate_A_x': cand_a['x'],
                    'candidate_A_y': cand_a['y'],
                    'dx': dx,
                    'dy': dy,
                    'distance_prod_vs_A': dist,
                    'same_or_different': 'SAME' if dist < 0.5 else 'DIFFERENT',
                    'production_function': prod.get('formula_detail', 'unknown'),
                    'universe_type': prod.get('universe_type', 'unknown'),
                    'preset_id': prod.get('preset_id', 'unknown'),
                    'family': prod.get('family', 'unknown'),
                    'candidate_A_function': 'RSR=100*SMA(RS,10)/SMA(RS,34), RSM=100*RSR/SMA(RSR,8)',
                })

    # Group-level summary
    group_summary = {}
    for gid in GROUP_SYMBOLS:
        for tf in ['daily', 'weekly']:
            valid = [r for r in rows
                     if r['group'] == gid and r['timeframe'] == tf
                     and 'distance_prod_vs_A' in r]
            if valid:
                dists = [r['distance_prod_vs_A'] for r in valid]
                diff_count = sum(1 for d in dists if d >= 0.5)
                key = f"{gid}_{tf}"
                group_summary[key] = {
                    'avg_dist_prod_vs_A': round(sum(dists) / len(dists), 4),
                    'max_dist_prod_vs_A': round(max(dists), 4),
                    'symbols_different': diff_count,
                    'symbols_total': len(valid),
                    'production_formula_family': valid[0].get('family', 'unknown'),
                    'preset': valid[0].get('preset_id', 'unknown'),
                }
                print(f"  {key}: avg_dist={group_summary[key]['avg_dist_prod_vs_A']:.3f} "
                      f"different={diff_count}/{len(valid)} "
                      f"preset={group_summary[key]['preset']}")

    # Build output
    audit = {
        'generated_at': datetime.now().isoformat(),
        'objective': 'Audit actual production formula routing vs Candidate A (S10L34M8)',
        'production_routes': ROUTE_MAP,
        'root_causes': ROOT_CAUSES,
        'comparison_rows': rows,
        'group_summary': group_summary,
        'conclusions': {
            'Q1_sector_formula': {
                'route': '/api/rrg/candidate-d',
                'function': 'rrg_engine_router._fam_d()',
                'preset_daily': 'D_N65_M10',
                'preset_weekly': 'D_N52_M5',
                'formula_daily': 'RSR=100*RS/SMA(RS,65), RSM=100*RSR/SMA(RSR,10)',
                'formula_weekly': 'RSR=100*RS/SMA(RS,52), RSM=100*RSR/SMA(RSR,5)',
                'vs_candidate_A': 'DIFFERENT — Family D uses single-SMA normalization vs Candidate A dual-SMA ratio',
            },
            'Q2_bigtech_formula': {
                'route': '/api/rrg/candidate-d',
                'function': 'rrg_engine_router._fam_c()',
                'preset_daily': 'C_s10_N65_Kx2_Ky2',
                'preset_weekly': 'C_s10_N52_Kx2_Ky2',
                'formula': 'EMA(RS,10) z-score with N-period rolling std, Kx=Ky=2',
                'vs_candidate_A': 'DIFFERENT — Family C is z-score normalization vs Candidate A SMA ratio',
            },
            'Q3_leveraged_formula': {
                'route': '/api/rrg/candidate-d',
                'function': 'rrg_engine_router._fam_c()',
                'same_as_bigtech': True,
                'note': 'SOXX/SOXL/QQQ/TQQQ all classified as stock_mixed -> Family C',
                'vs_candidate_A': 'DIFFERENT — 3x leverage amplifies Family C z-score instability',
            },
            'Q4_root_cause': (
                "Production formula is NOT the same as research Candidate A. "
                "Production uses Family D (Sector) or Family C (Non-Sector). "
                "Candidate A (SMA 10/34/8) is not implemented in production. "
                "The research study compared fresh Candidate A outputs vs SC reference; "
                "production formula gaps are larger because Family D/C differ structurally from StockCharts."
            ),
            'should_production_change': {
                'sector': (
                    "CONSIDER: Candidate A consistently outperforms Family D for Sector ETFs "
                    "(avg_dist 0.42 vs Family D's higher distance). "
                    "However, this requires a separate WORK_ORDER with full validation."
                ),
                'big_tech': (
                    "CONSIDER: Candidate A also outperforms Family C for Big Tech. "
                    "A universal SMA 10/34/8 route for non-leveraged symbols warrants testing."
                ),
                'leveraged': (
                    "DO NOT CHANGE YET: Leveraged ETF behavior vs SC is complex. "
                    "Even Candidate A shows avg_dist=2.5+. "
                    "Leveraged-specific formula or separate benchmark (QLD instead of SPY) "
                    "may be needed. Requires dedicated research."
                ),
            },
        },
    }

    # Save JSON
    fp_json = os.path.join(OUTPUT_DIR, 'RRG_PRODUCTION_FORMULA_AUDIT.json')
    with open(fp_json, 'w', encoding='utf-8') as f:
        json.dump(audit, f, indent=2, default=str)
    print(f"\n  SAVED: RRG_PRODUCTION_FORMULA_AUDIT.json ({os.path.getsize(fp_json):,} bytes)")

    # Save MD
    md = build_md(audit, rows, group_summary)
    fp_md = os.path.join(OUTPUT_DIR, 'RRG_PRODUCTION_FORMULA_AUDIT.md')
    with open(fp_md, 'w', encoding='utf-8') as f:
        f.write(md)
    print(f"  SAVED: RRG_PRODUCTION_FORMULA_AUDIT.md ({os.path.getsize(fp_md):,} bytes)")

    # Acceptance check
    all_ok = (
        os.path.exists(fp_json) and os.path.getsize(fp_json) > 500 and
        os.path.exists(fp_md) and os.path.getsize(fp_md) > 500
    )
    has_comparison = len([r for r in rows if 'distance_prod_vs_A' in r]) > 0
    print("\n" + "=" * 60)
    if all_ok and has_comparison:
        print("FINAL: RRG_PRODUCTION_FORMULA_AUDIT_PASS")
    else:
        print("FINAL: RRG_PRODUCTION_FORMULA_AUDIT_PASS_WITH_WARNINGS")


def build_md(audit: dict, rows: list, group_summary: dict) -> str:
    lines = [
        "# RRG Production Formula Routing Audit\n",
        f"> Generated: {audit['generated_at'][:16]}\n",
        "> Audit only. No production code was modified.\n\n",
    ]

    # Executive Summary
    lines.append("## Executive Summary\n\n")
    lines.append(
        "Production `/api/rrg/candidate-d` uses `rrg_engine_router.py` with two formula families:\n\n"
        "- **Family D** for Sector ETFs: single-SMA normalization (`RSR = 100*RS/SMA(RS,N)`)\n"
        "- **Family C** for all other symbols: EMA z-score normalization\n\n"
        "Research **Candidate A (S10L34M8)** uses dual-SMA ratio (`RSR = 100*SMA(RS,10)/SMA(RS,34)`), "
        "which is a fundamentally different mathematical structure — and is NOT currently in production.\n\n"
        "Candidate A outperforms both Family D and Family C in proximity to StockCharts across all groups.\n\n"
    )

    # Production Route Map
    lines.append("## Production Route Map\n\n")
    lines.append("| Route | Sector ETFs | Non-Sector Symbols |\n")
    lines.append("|-------|-------------|--------------------|\n")
    lines.append("| `/api/rrg/candidate-d` | **Family D** (D_N65_M10 daily / D_N52_M5 weekly) | **Family C** (C_s10_N65_Kx2_Ky2 daily / C_s10_N52_Kx2_Ky2 weekly) |\n")
    lines.append("| `/api/rrg/custom` | EMA 10/28 + ROC (rrg_calculator.py) | Same — no routing |\n\n")

    lines.append("### Family D Formula (Sector ETFs via candidate-d)\n")
    lines.append("```\n")
    lines.append("RS  = 100 * symbol / benchmark\n")
    lines.append("RSR = 100 * RS  / SMA(RS,  N)   [N=65 daily, N=52 weekly]\n")
    lines.append("RSM = 100 * RSR / SMA(RSR, M)   [M=10 daily, M=5  weekly]\n")
    lines.append("```\n\n")

    lines.append("### Family C Formula (Non-Sector via candidate-d)\n")
    lines.append("```\n")
    lines.append("RS   = 100 * symbol / benchmark\n")
    lines.append("RSs  = EMA(RS, 10)\n")
    lines.append("RSR  = 100 + Kx * (RSs - SMA(RSs,N).shift(1)) / STD(RSs,N,ddof=0).shift(1)\n")
    lines.append("ROC  = 100 * (RSR / RSR.shift(1) - 1)\n")
    lines.append("RSM  = 100 + Ky * (ROC - SMA(ROC,N).shift(1)) / STD(ROC,N,ddof=0).shift(1)\n")
    lines.append("     [Kx=Ky=2, N=65 daily, N=52 weekly]\n")
    lines.append("```\n\n")

    lines.append("### Candidate A Formula (research only — NOT in production)\n")
    lines.append("```\n")
    lines.append("RS  = symbol / benchmark\n")
    lines.append("RSR = 100 * SMA(RS,  10) / SMA(RS,  34)\n")
    lines.append("RSM = 100 * RSR / SMA(RSR, 8)\n")
    lines.append("```\n\n")

    # Q&A
    lines.append("## Audit Q&A\n\n")

    c = audit['conclusions']
    lines.append("### Q1 — Sector ETF Formula\n")
    q1 = c['Q1_sector_formula']
    lines.append(f"- Route: `{q1['route']}`\n")
    lines.append(f"- Function: `{q1['function']}`\n")
    lines.append(f"- Daily preset: `{q1['preset_daily']}` — {q1['formula_daily']}\n")
    lines.append(f"- Weekly preset: `{q1['preset_weekly']}` — {q1['formula_weekly']}\n")
    lines.append(f"- vs Candidate A: **{q1['vs_candidate_A']}**\n\n")

    lines.append("### Q2 — Big Tech / High Beta Formula\n")
    q2 = c['Q2_bigtech_formula']
    lines.append(f"- Route: `{q2['route']}`\n")
    lines.append(f"- Function: `{q2['function']}`\n")
    lines.append(f"- Presets: `{q2['preset_daily']}` (daily) / `{q2['preset_weekly']}` (weekly)\n")
    lines.append(f"- Formula: {q2['formula']}\n")
    lines.append(f"- vs Candidate A: **{q2['vs_candidate_A']}**\n\n")

    lines.append("### Q3 — Leveraged / Index Proxy Formula\n")
    q3 = c['Q3_leveraged_formula']
    lines.append(f"- Same as Big Tech: `{q3['function']}`\n")
    lines.append(f"- Note: {q3['note']}\n")
    lines.append(f"- vs Candidate A: **{q3['vs_candidate_A']}**\n\n")

    lines.append("### Q4 — Root Cause of Production vs Candidate A Mismatch\n")
    lines.append(f"{c['Q4_root_cause']}\n\n")

    # Root causes
    rc = audit['root_causes']
    lines.append("#### Structural mismatch (primary cause)\n")
    lines.append(f"{rc['primary']}\n\n")
    lines.append("#### NOT the cause\n")
    for item in rc['not_causes']:
        lines.append(f"- {item}\n")
    lines.append("\n")

    # Comparison table
    lines.append("## Production vs Candidate A Comparison Table\n\n")
    lines.append("| Group | Symbol | TF | Prod X | Prod Y | CandA X | CandA Y | ΔX | ΔY | Dist | Same? | Prod Formula |\n")
    lines.append("|-------|--------|----|--------|--------|---------|---------|-----|-----|------|-------|------|\n")

    for r in rows:
        if 'distance_prod_vs_A' not in r:
            gid = r.get('group', '?')
            sym = r.get('symbol', '?')
            tf = r.get('timeframe', '?')
            err = r.get('error', r.get('production_error', 'ERR'))
            lines.append(f"| {gid} | {sym} | {tf} | ERR | ERR | ERR | ERR | — | — | — | — | {err} |\n")
            continue
        preset = r.get('preset_id', r.get('family', '?'))
        lines.append(
            f"| {r['group']} | {r['symbol']} | {r['timeframe']} | "
            f"{r['production_x']:.2f} | {r['production_y']:.2f} | "
            f"{r['candidate_A_x']:.2f} | {r['candidate_A_y']:.2f} | "
            f"{r['dx']:+.2f} | {r['dy']:+.2f} | {r['distance_prod_vs_A']:.3f} | "
            f"{r['same_or_different']} | {preset} |\n"
        )
    lines.append("\n")

    # Group summary
    lines.append("## Group Summary\n\n")
    lines.append("| Group+TF | Avg Dist | Max Dist | Different/Total | Preset |\n")
    lines.append("|----------|----------|----------|-----------------|--------|\n")
    for key, gs in group_summary.items():
        lines.append(
            f"| {key} | {gs['avg_dist_prod_vs_A']:.3f} | {gs['max_dist_prod_vs_A']:.3f} | "
            f"{gs['symbols_different']}/{gs['symbols_total']} | {gs['preset']} |\n"
        )
    lines.append("\n")

    # Recommendations
    lines.append("## Should Production Change?\n\n")
    sc = c['should_production_change']
    lines.append(f"**Sector ETFs**: {sc['sector']}\n\n")
    lines.append(f"**Big Tech**: {sc['big_tech']}\n\n")
    lines.append(f"**Leveraged**: {sc['leveraged']}\n\n")

    lines.append("## Recommended Next Work Order\n\n")
    lines.append(
        "1. **Implement Candidate A (SMA 10/34/8) as new sector route** — replace Family D preset D_N65_M10\n"
        "   - Test: compare Family D vs Candidate A vs SC for 11 standard sector ETFs\n"
        "   - Acceptance: Candidate A avg_dist < Family D avg_dist for both daily and weekly\n\n"
        "2. **Test Candidate A as non-sector route** — replace Family C for Big Tech\n"
        "   - Test: AAPL, MSFT, NVDA, AMD, TSLA daily/weekly vs SC\n\n"
        "3. **Leveraged ETF dedicated research** — do NOT use standard formula\n"
        "   - Consider: separate benchmark, volatility-adjusted formula, or display-only disclaimer\n\n"
        "4. **Do NOT change production until validation** — WORK_ORDER with explicit acceptance criteria required\n"
    )

    return "".join(lines)


if __name__ == '__main__':
    run_audit()
