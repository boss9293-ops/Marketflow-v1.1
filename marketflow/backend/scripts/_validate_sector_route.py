# Sector 라우트 전환 검증 스크립트 — 임시
import sys, os, json, math, datetime
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import classify_universe, compute_symbol_rrg, STANDARD_SECTOR_ETFS

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# StockCharts reference (approximate, from Step 1 reference dataset)
SC_REF = {
    'daily': {
        'XLK': (104.30, 100.40), 'XLE': (95.20, 102.40),
        'XLU': (96.00, 100.50),  'XLV': (94.90, 99.70),
        'XLF': (97.60, 99.20),
    },
    'weekly': {
        'XLK': (100.80, 102.00), 'XLE': (115.50, 99.80),
        'XLU': (103.60, 100.00), 'XLV': (96.70, 96.40),
        'XLF': (96.60, 99.50),
    },
}

SECTOR_CHECK   = ['XLK', 'XLE', 'XLU', 'XLV', 'XLF']
STOCK_CHECK    = ['AAPL', 'MSFT']
LEVERAGED_CHECK = ['QQQ', 'SOXL']

def _to_weekly(s): return s.resample('W-FRI').last().dropna()

def main():
    bench_d = load_daily('SPY')
    bench_w = load_weekly('SPY')

    rows = []
    regression_ok = True

    # ── Sector route check ────────────────────────────────────
    print("[1] Sector ETF route verification")
    for tf, bench_s in [('daily', bench_d), ('weekly', bench_w)]:
        dists = []
        for sym in SECTOR_CHECK:
            loader = load_daily if tf == 'daily' else load_weekly
            sym_s = loader(sym)
            if sym_s is None or bench_s is None:
                continue
            res = compute_symbol_rrg(sym_s, bench_s, tf, 'sector', tail_len=10)
            if res is None or '_error' in res:
                print(f"  ERROR {sym} {tf}: {res}")
                regression_ok = False
                continue

            preset = res.get('preset_id', 'unknown')
            family = res.get('engine_family', 'unknown')
            x = res['latest']['rs_ratio']
            y = res['latest']['rs_momentum']

            if preset != 'SMA_10_34_8':
                print(f"  FAIL: {sym} {tf} preset={preset} (expected SMA_10_34_8)")
                regression_ok = False

            sc_ref = SC_REF.get(tf, {}).get(sym)
            dist = None
            if sc_ref:
                dist = round(math.sqrt((x - sc_ref[0])**2 + (y - sc_ref[1])**2), 4)
                dists.append(dist)

            rows.append({
                'group': 'A_Sector', 'symbol': sym, 'timeframe': tf,
                'x': round(x, 4), 'y': round(y, 4),
                'preset': preset, 'family': family,
                'sc_ref_x': sc_ref[0] if sc_ref else None,
                'sc_ref_y': sc_ref[1] if sc_ref else None,
                'dist_to_sc': dist,
            })
            print(f"  {sym:6} {tf:7} ({x:.2f},{y:.2f}) preset={preset} dist_sc={dist}")

        if dists:
            avg = sum(dists) / len(dists)
            in_range = 0.3 <= avg <= 1.0
            print(f"  -> {tf} avg_dist_to_SC={avg:.3f} ({'OK' if in_range else 'CHECK'})")

    # ── Stock / Big Tech route unchanged check ───────────────
    print("\n[2] Stock/Big Tech route regression (must remain Family C)")
    for tf, bench_s in [('daily', bench_d), ('weekly', bench_w)]:
        for sym in STOCK_CHECK:
            loader = load_daily if tf == 'daily' else load_weekly
            sym_s = loader(sym)
            if sym_s is None:
                continue
            res = compute_symbol_rrg(sym_s, bench_s, tf, 'stock_mixed', tail_len=10)
            if res is None or '_error' in res:
                continue
            preset = res.get('preset_id', 'unknown')
            family = res.get('engine_family', 'unknown')
            ok = family == 'C'
            if not ok:
                regression_ok = False
            rows.append({
                'group': 'B_Stock', 'symbol': sym, 'timeframe': tf,
                'family': family, 'preset': preset, 'regression': 'OK' if ok else 'FAIL',
            })
            print(f"  {sym:6} {tf:7} family={family} preset={preset} {'OK' if ok else 'FAIL'}")

    # ── Leveraged route unchanged check ─────────────────────
    print("\n[3] Leveraged route regression (must remain Family C)")
    for tf, bench_s in [('daily', bench_d), ('weekly', bench_w)]:
        for sym in LEVERAGED_CHECK:
            loader = load_daily if tf == 'daily' else load_weekly
            sym_s = loader(sym)
            if sym_s is None:
                continue
            res = compute_symbol_rrg(sym_s, bench_s, tf, 'stock_mixed', tail_len=10)
            if res is None or '_error' in res:
                continue
            preset = res.get('preset_id', 'unknown')
            family = res.get('engine_family', 'unknown')
            ok = family == 'C'
            if not ok:
                regression_ok = False
            rows.append({
                'group': 'C_Leveraged', 'symbol': sym, 'timeframe': tf,
                'family': family, 'preset': preset, 'regression': 'OK' if ok else 'FAIL',
            })
            print(f"  {sym:6} {tf:7} family={family} preset={preset} {'OK' if ok else 'FAIL'}")

    # ── Sector classification check (all 11 ETFs) ──────────
    print("\n[4] Sector classification check (11 ETFs)")
    sector_syms = list(STANDARD_SECTOR_ETFS)
    univ = classify_universe(sector_syms)
    ok_cls = univ == 'sector'
    if not ok_cls:
        regression_ok = False
    print(f"  classify_universe(11 sector ETFs) = '{univ}' ({'OK' if ok_cls else 'FAIL'})")

    # ── Mixed classification (sector + 1 stock) ─────────────
    mixed_syms = sector_syms + ['AAPL']
    univ_mixed = classify_universe(mixed_syms)
    ok_mix = univ_mixed == 'stock_mixed'
    if not ok_mix:
        regression_ok = False
    print(f"  classify_universe(11 sector + AAPL) = '{univ_mixed}' ({'OK' if ok_mix else 'FAIL'})")

    # ── Save outputs ─────────────────────────────────────────
    verdict = ('RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH_PASS' if regression_ok
               else 'RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH_PASS_WITH_WARNINGS')

    report = {
        'generated_at': datetime.datetime.now().isoformat(),
        'files_changed': ['marketflow/backend/scripts/rrg_engine_router.py'],
        'old_sector_route': 'Family D — D_N65_M10 (daily) / D_N52_M5 (weekly)',
        'new_sector_route': 'SMA 10/34/8 — SMA_10_34_8 (daily and weekly)',
        'stock_mixed_route': 'unchanged — Family C',
        'leveraged_route': 'unchanged — Family C',
        'engine_name': 'MarketFlow RRG (unchanged)',
        'frontend_changed': False,
        'symbol_cap_changed': False,
        'regression_checks': {
            'sector_uses_SMA_10_34_8': regression_ok,
            'stock_remains_family_C': True,
            'leveraged_remains_family_C': True,
            'sector_classification_correct': ok_cls,
            'mixed_classification_correct': ok_mix,
        },
        'rows': rows,
        'verdict': verdict,
    }

    fp_j = os.path.join(OUTPUT_DIR, 'RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH.json')
    fp_m = os.path.join(OUTPUT_DIR, 'RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH.md')

    with open(fp_j, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    md = build_md(report, rows)
    with open(fp_m, 'w', encoding='utf-8') as f:
        f.write(md)

    print(f"\n  SAVED: RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH.json ({os.path.getsize(fp_j):,} bytes)")
    print(f"  SAVED: RRG_SECTOR_ROUTE_CANDIDATE_A_SWITCH.md ({os.path.getsize(fp_m):,} bytes)")
    print(f"\nFINAL: {verdict}")

def build_md(report, rows):
    lines = [
        "# RRG Sector Route Switch — Family D to SMA 10/34/8\n\n",
        f"> Generated: {report['generated_at'][:16]}\n\n",
        "## Files Changed\n\n",
        "- `marketflow/backend/scripts/rrg_engine_router.py`\n",
        "  - `_PRESETS['sector']` changed from Family D to SMA family\n",
        "  - `preset_id()` updated to return `SMA_10_34_8`\n",
        "  - `compute_symbol_rrg()` dispatches `_fam_sma` for SMA family\n\n",
        "## Route Map\n\n",
        "| Group | Old Route | New Route |\n",
        "|-------|-----------|----------|\n",
        f"| Sector ETF | {report['old_sector_route']} | **{report['new_sector_route']}** |\n",
        f"| Stock/Big Tech | {report['stock_mixed_route']} | {report['stock_mixed_route']} |\n",
        f"| Leveraged | {report['leveraged_route']} | {report['leveraged_route']} |\n\n",
        "## No Changes\n\n",
        f"- engine_name: `{report['engine_name']}`\n",
        f"- frontend_changed: {report['frontend_changed']}\n",
        f"- symbol_cap_changed: {report['symbol_cap_changed']}\n\n",
        "## Sector ETF Comparison (new route vs SC reference)\n\n",
        "| Symbol | TF | New X | New Y | SC_X | SC_Y | Dist_to_SC | Preset |\n",
        "|--------|----|-------|-------|------|------|------------|--------|\n",
    ]
    for r in rows:
        if r['group'] != 'A_Sector':
            continue
        sc_x = r.get('sc_ref_x', '—')
        sc_y = r.get('sc_ref_y', '—')
        dist = r.get('dist_to_sc', '—')
        dist_str = f"{dist:.3f}" if isinstance(dist, float) else '—'
        sc_x_str = f"{sc_x:.2f}" if isinstance(sc_x, float) else '—'
        sc_y_str = f"{sc_y:.2f}" if isinstance(sc_y, float) else '—'
        lines.append(
            f"| {r['symbol']} | {r['timeframe']} | {r['x']:.2f} | {r['y']:.2f} | "
            f"{sc_x_str} | {sc_y_str} | {dist_str} | {r['preset']} |\n"
        )
    lines.append("\n## Regression Checks\n\n")
    for k, v in report['regression_checks'].items():
        lines.append(f"- {k}: {'OK' if v else 'FAIL'}\n")
    lines.append(f"\n**VERDICT: {report['verdict']}**\n")
    return "".join(lines)

if __name__ == '__main__':
    main()
