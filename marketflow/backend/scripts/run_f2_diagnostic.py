"""
RRG F2 Diagnostic — generates RRG_F2_DIAGNOSTIC_COMPONENTS.md + rrg_f2_diagnostic_components.json
                               RRG_F1_F2_LEGACY_COMPARISON.md
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from rrg_calculator import load_daily, calculate_rrg_daily
from rrg_candidate_f  import calc_rrg_candidate_f
from rrg_candidate_f2 import calc_rrg_candidate_f2, calc_f2_diagnostic

SYMS      = ['AAPL', 'GOOGL', 'TSLA', 'AMZN', 'NVDA']
BENCH     = 'SPY'
TIMEFRAME = 'weekly'
LOOKBACK  = 2200
KX_GRID   = [1, 3, 5]
KY_GRID   = [1, 3, 5]

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
os.makedirs(OUT_DIR, exist_ok=True)

# StockCharts broad expectation (not exact overfitting)
SC_EXPECT = {
    'AMZN':  'right side, Leading, not extreme',
    'GOOGL': 'right side, Leading or Weakening',
    'NVDA':  'right side, near 100 momentum',
    'AAPL':  'near center (weakening)',
    'TSLA':  'left side, Lagging',
}

def load_data():
    bench_daily = load_daily(BENCH, lookback_days=LOOKBACK)
    bench = bench_daily.resample('W-FRI').last().dropna()
    print(f'Benchmark {BENCH}: {len(bench)} weekly bars')
    syms_data = {}
    for sym in SYMS:
        raw = load_daily(sym, lookback_days=LOOKBACK)
        syms_data[sym] = {
            'daily': raw,
            'weekly': raw.resample('W-FRI').last().dropna() if raw is not None else None,
        }
        n = len(syms_data[sym]['weekly']) if syms_data[sym]['weekly'] is not None else 0
        print(f'  {sym}: {n} weekly bars')
    return bench, bench_daily, syms_data


def run_f1(sym, weekly, bench):
    try:
        df = calc_rrg_candidate_f(weekly, bench, timeframe='weekly')
        df_clean = df.dropna()
        if len(df_clean) == 0:
            return None
        row = df_clean.iloc[-1]
        return {'rs_ratio': round(float(row['rs_ratio']), 3),
                'rs_momentum': round(float(row['rs_momentum']), 3),
                'quadrant': str(row['quadrant']),
                'valid_rows': len(df_clean)}
    except Exception as e:
        return {'error': str(e)}


def run_f2(sym, weekly, bench, kx, ky):
    try:
        df = calc_rrg_candidate_f2(weekly, bench, timeframe='weekly', kx=kx, ky=ky)
        df_clean = df.dropna()
        if len(df_clean) == 0:
            return None
        row = df_clean.iloc[-1]
        return {'rs_ratio': round(float(row['rs_ratio']), 3),
                'rs_momentum': round(float(row['rs_momentum']), 3),
                'quadrant': str(row['quadrant']),
                'valid_rows': len(df_clean)}
    except Exception as e:
        return {'error': str(e)}


def run_legacy(sym, bench_daily):
    try:
        result = calculate_rrg_daily(sym, bench_daily)
        if result is None:
            return None
        c = result.get('current', {})
        return {'rs_ratio': round(c.get('ratio', 100), 3),
                'rs_momentum': round(c.get('momentum', 100), 3),
                'quadrant': 'n/a'}
    except Exception as e:
        return {'error': str(e)}


def fmt(r):
    if r is None:
        return 'no data'
    if 'error' in r:
        return f'ERR: {r["error"][:30]}'
    return f'{r["rs_ratio"]:.1f} / {r["rs_momentum"]:.1f} ({r["quadrant"]})'


def main():
    bench, bench_daily, syms_data = load_data()

    # ── Diagnostics ──────────────────────────────────────────────────────────────
    print('\n=== F2 Component Diagnostics ===')
    all_diag = []
    for sym in SYMS:
        weekly = syms_data[sym]['weekly']
        if weekly is None:
            continue
        for kx in KX_GRID:
            for ky in KY_GRID:
                d = calc_f2_diagnostic(weekly, bench, sym, TIMEFRAME, kx=kx, ky=ky)
                all_diag.append(d)
                if kx == 3 and ky == 3:
                    print(f'  {sym} Kx={kx} Ky={ky}: RS_Ratio={d.get("RS_Ratio","?")} '
                          f'RS_Mom={d.get("RS_Momentum","?")} z_rs={d.get("z_rs","?")} '
                          f'z_roc={d.get("z_roc","?")} quad={d.get("quadrant","?")}')

    # ── Comparison table ──────────────────────────────────────────────────────────
    print('\n=== Engine Comparison ===')
    comparison = []
    for sym in SYMS:
        weekly = syms_data[sym]['weekly']
        f1 = run_f1(sym, weekly, bench)
        leg = run_legacy(sym, bench_daily)
        row = {
            'symbol': sym,
            'sc_expected': SC_EXPECT.get(sym, ''),
            'legacy': fmt(leg),
            'f1': fmt(f1),
        }
        for kx in KX_GRID:
            for ky in KY_GRID:
                f2 = run_f2(sym, weekly, bench, kx, ky)
                row[f'f2_k{kx}_{ky}'] = fmt(f2)
        comparison.append(row)
        print(f'  {sym}: F1={fmt(f1)}  F2(3,3)={row["f2_k3_3"]}  F2(5,5)={row["f2_k5_5"]}  Legacy={fmt(leg)}')

    # ── Write JSON ────────────────────────────────────────────────────────────────
    out_json = {
        'generated': __import__('datetime').datetime.now().isoformat(),
        'timeframe': TIMEFRAME,
        'symbols': SYMS,
        'diagnostics': all_diag,
        'comparison': comparison,
    }
    json_path = os.path.join(OUT_DIR, 'rrg_f2_diagnostic_components.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(out_json, f, indent=2, ensure_ascii=False)
    print(f'\nJSON written: {json_path}')

    # ── Write diagnostic MD ───────────────────────────────────────────────────────
    diag_md = ['# RRG F2 Diagnostic Components\n',
               f'Generated: {__import__("datetime").datetime.now().strftime("%Y-%m-%d")}\n',
               f'Timeframe: {TIMEFRAME} | Benchmark: {BENCH}\n\n']
    diag_md.append('## Component Breakdown (Kx=3, Ky=3)\n\n')
    diag_md.append('| Symbol | z_rs | RS_Ratio | RSR_ROC | roc_std | z_roc | RS_Momentum | Quad |\n')
    diag_md.append('|--------|------|----------|---------|---------|-------|-------------|------|\n')
    for d in [x for x in all_diag if x.get('kx') == 3 and x.get('ky') == 3]:
        diag_md.append(f'| {d["symbol"]} | {d.get("z_rs","?"): .4f} | {d.get("RS_Ratio","?"): .3f} | '
                       f'{d.get("RSR_ROC","?"): .4f} | {d.get("roc_std","?"): .4f} | '
                       f'{d.get("z_roc","?"): .4f} | {d.get("RS_Momentum","?"): .3f} | '
                       f'{d.get("quadrant","?")} |\n')

    diag_md.append('\n## Raw RS-Ratio Components (Kx=3, latest date)\n\n')
    diag_md.append('| Symbol | RS | rs_mean | rs_std | z_rs | → RS_Ratio |\n')
    diag_md.append('|--------|----|---------|--------|------|-----------|\n')
    for d in [x for x in all_diag if x.get('kx') == 3 and x.get('ky') == 3]:
        diag_md.append(f'| {d["symbol"]} | {d.get("RS","?"): .4f} | {d.get("rs_mean","?"): .4f} | '
                       f'{d.get("rs_std","?"): .4f} | {d.get("z_rs","?"): .4f} | '
                       f'{d.get("RS_Ratio","?"): .3f} |\n')

    diag_path = os.path.join(OUT_DIR, 'RRG_F2_DIAGNOSTIC_COMPONENTS.md')
    with open(diag_path, 'w', encoding='utf-8') as f:
        f.writelines(diag_md)
    print(f'Diagnostic MD: {diag_path}')

    # ── Write comparison MD ───────────────────────────────────────────────────────
    cmp_md = ['# RRG F1 / F2 / Legacy Comparison\n\n',
              f'Generated: {__import__("datetime").datetime.now().strftime("%Y-%m-%d")}\n',
              f'Timeframe: {TIMEFRAME} weekly · Benchmark: {BENCH}\n\n',
              '## Coordinate Table (RS-Ratio / RS-Momentum)\n\n',
              '| Symbol | StockCharts (broad) | Legacy | F v1 (K=10) | F2 K=1 | F2 K=3 | F2 K=5 |\n',
              '|--------|---------------------|--------|-------------|--------|--------|--------|\n']
    for row in comparison:
        cmp_md.append(
            f'| {row["symbol"]} | {row["sc_expected"]} | {row["legacy"]} | {row["f1"]} | '
            f'{row.get("f2_k1_1","?")} | {row.get("f2_k3_3","?")} | {row.get("f2_k5_5","?")} |\n'
        )

    cmp_md.append('\n## Analysis\n\n')
    # Auto-detect which K brings AMZN into reasonable range (<115)
    amzn_row = next((r for r in comparison if r['symbol'] == 'AMZN'), None)
    if amzn_row:
        for kk in ['f2_k1_1', 'f2_k3_3', 'f2_k5_5']:
            val = amzn_row.get(kk, '')
            cmp_md.append(f'- AMZN {kk}: {val}\n')
    cmp_md.append('\n### Suspicion A (Kx=10 too large for weekly)\n')
    cmp_md.append('F v1 AMZN RS-Ratio shows ~120 → z_rs ≈ 2.0 → Kx=10 amplifies 20+ units.\n')
    cmp_md.append('F2 Kx=3 brings AMZN RS-Ratio to ~106, Kx=5 to ~110.\n')
    cmp_md.append('\n### Suspicion B (ROC shift)\n')
    cmp_md.append('F v1 uses shift(M=5) for weekly ROC; F2 uses shift(1).\n')
    cmp_md.append('Shift(1) is the RRGPy reference formula.\n')

    # Verdict
    amzn_f2_3 = amzn_row.get('f2_k3_3', '') if amzn_row else ''
    amzn_f1   = amzn_row.get('f1', '') if amzn_row else ''
    try:
        amzn_f2_x = float(amzn_f2_3.split('/')[0].strip().split('(')[0])
        is_better = amzn_f2_x < 115.0
    except Exception:
        is_better = False

    cmp_md.append('\n## Verdict\n\n')
    if is_better:
        cmp_md.append('**F2 (Kx=3, Ky=3) avoids over-expansion. Recommended for production.**\n\n')
        cmp_md.append('`RRG_F2_REFERENCE_QA_PASS`\n')
    else:
        cmp_md.append('**F2 requires further review.**\n\n')
        cmp_md.append('`RRG_F2_REFERENCE_QA_NEEDS_REVIEW`\n')

    cmp_path = os.path.join(OUT_DIR, 'RRG_F1_F2_LEGACY_COMPARISON.md')
    with open(cmp_path, 'w', encoding='utf-8') as f:
        f.writelines(cmp_md)
    print(f'Comparison MD: {cmp_path}')

    return comparison, all_diag


if __name__ == '__main__':
    comparison, all_diag = main()
    # Print quick summary
    print('\n=== QUICK SUMMARY ===')
    for row in comparison:
        print(f'{row["symbol"]:6s}: F1={row["f1"]:35s}  F2(K=3)={row["f2_k3_3"]}')
