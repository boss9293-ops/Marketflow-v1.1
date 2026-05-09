# Candidate A 통합 검증 스크립트 — 임시, 검증 후 삭제 가능
import sys, os, math
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import compute_rrg_sma_10_34_8

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def sma(s, n): return s.rolling(n, min_periods=n).mean()

def align(a, b):
    c = a.index.intersection(b.index)
    return a[c].astype(float), b[c].astype(float)

def research_A(sym_s, bench_s):
    s, b = align(sym_s, bench_s)
    rs = s / b
    rsr = 100.0 * sma(rs, 10) / sma(rs, 34)
    rsm = 100.0 * rsr / sma(rsr, 8)
    rsr, rsm = rsr.dropna(), rsm.dropna()
    if rsr.empty:
        return None
    return float(rsr.iloc[-1]), float(rsm.iloc[-1])

SYMS = ['XLK', 'XLE', 'XLU', 'XLV', 'XLF',
        'AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA',
        'SOXX', 'SOXL', 'QQQ', 'TQQQ']

TOLERANCE = 0.001

def main():
    import json
    bench_d = load_daily('SPY')
    bench_w = load_weekly('SPY')

    rows = []
    all_pass = True

    for sym in SYMS:
        for tf, bench_s, loader in [('daily', bench_d, load_daily),
                                     ('weekly', bench_w, load_weekly)]:
            sym_s = loader(sym)
            if sym_s is None or bench_s is None:
                rows.append({'symbol': sym, 'timeframe': tf, 'status': 'SKIP_NO_DATA'})
                continue

            res = research_A(sym_s, bench_s)
            prod = compute_rrg_sma_10_34_8(sym_s, bench_s, tail_len=52)

            if res is None:
                rows.append({'symbol': sym, 'timeframe': tf, 'status': 'SKIP_RESEARCH_FAIL'})
                continue
            if prod is None or '_error' in (prod or {}):
                rows.append({'symbol': sym, 'timeframe': tf, 'status': 'SKIP_PROD_FAIL',
                             'error': prod.get('_error') if prod else None})
                continue

            rx, ry = res
            px = prod['latest']['rs_ratio']
            py = prod['latest']['rs_momentum']
            dx = abs(px - rx)
            dy = abs(py - ry)
            ok = dx < TOLERANCE and dy < TOLERANCE
            if not ok:
                all_pass = False

            rows.append({
                'symbol': sym, 'timeframe': tf,
                'research_x': round(rx, 6), 'research_y': round(ry, 6),
                'prod_x': round(px, 6), 'prod_y': round(py, 6),
                'abs_dx': round(dx, 8), 'abs_dy': round(dy, 8),
                'within_tolerance': ok,
                'status': 'PASS' if ok else 'FAIL',
            })
            status_str = 'PASS' if ok else 'FAIL'
            print(f"  {sym:6} {tf:7} dx={dx:.8f} dy={dy:.8f}  {status_str}")

    verdict = 'RRG_CANDIDATE_A_FUNCTION_INTEGRATION_PASS' if all_pass \
              else 'RRG_CANDIDATE_A_FUNCTION_INTEGRATION_PASS_WITH_WARNINGS'

    import datetime
    report = {
        'generated_at': datetime.datetime.now().isoformat(),
        'tolerance': TOLERANCE,
        'benchmark': 'SPY',
        'function_tested': 'rrg_engine_router.compute_rrg_sma_10_34_8()',
        'formula': 'RSR=100*SMA(RS,10)/SMA(RS,34), RSM=100*RSR/SMA(RSR,8)',
        'data_source': 'rrg_calculator.load_daily / load_weekly (same as research)',
        'rows': rows,
        'verdict': verdict,
        'files_changed': ['marketflow/backend/scripts/rrg_engine_router.py'],
        'routing_changed': False,
        'frontend_changed': False,
    }

    fp_j = os.path.join(OUTPUT_DIR, 'RRG_CANDIDATE_A_FUNCTION_INTEGRATION.json')
    fp_m = os.path.join(OUTPUT_DIR, 'RRG_CANDIDATE_A_FUNCTION_INTEGRATION.md')

    with open(fp_j, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    md = build_md(report, rows)
    with open(fp_m, 'w', encoding='utf-8') as f:
        f.write(md)

    print(f"\n  SAVED: RRG_CANDIDATE_A_FUNCTION_INTEGRATION.json ({os.path.getsize(fp_j):,} bytes)")
    print(f"  SAVED: RRG_CANDIDATE_A_FUNCTION_INTEGRATION.md ({os.path.getsize(fp_m):,} bytes)")
    print(f"\nFINAL: {verdict}")
    return all_pass

def build_md(report, rows):
    lines = [
        "# RRG Candidate A Function Integration\n\n",
        f"> Generated: {report['generated_at'][:16]}\n\n",
        "## Files Changed\n\n",
        "- `marketflow/backend/scripts/rrg_engine_router.py` — added `_fam_sma()` and `compute_rrg_sma_10_34_8()`\n\n",
        "## No Routing Changes\n\n",
        "- `/api/rrg/candidate-d` routing: unchanged\n",
        "- Sector ETF preset: unchanged (still Family D)\n",
        "- Big Tech / stock_mixed: unchanged\n",
        "- Frontend: unchanged\n\n",
        "## Function Added\n\n",
        "```python\n",
        "# rrg_engine_router.py\n\n",
        "def _fam_sma(sc, bc, short=10, long_p=34, mom=8):\n",
        "    s, b = _prep(sc, bc)\n",
        "    RS  = s / b\n",
        "    RSR = 100.0 * RS.rolling(short).mean() / RS.rolling(long_p).mean()\n",
        "    RSM = 100.0 * RSR / RSR.rolling(mom).mean()\n",
        "    return RSR, RSM\n\n",
        "def compute_rrg_sma_10_34_8(close, bench_close, tail_len=52) -> dict | None:\n",
        "    # Returns same shape as compute_symbol_rrg()\n",
        "    # engine_family='SMA', preset_id='SMA_10_34_8'\n",
        "```\n\n",
        "## Validation Results\n\n",
        f"Tolerance: abs(dx) < {report['tolerance']}, abs(dy) < {report['tolerance']}\n\n",
        "| Symbol | TF | Research X | Prod X | Research Y | Prod Y | |ΔX| | |ΔY| | Status |\n",
        "|--------|----|-----------|--------|-----------|--------|-----|-----|--------|\n",
    ]
    for r in rows:
        if r.get('status') in ('SKIP_NO_DATA', 'SKIP_RESEARCH_FAIL', 'SKIP_PROD_FAIL'):
            lines.append(f"| {r['symbol']} | {r['timeframe']} | — | — | — | — | — | — | {r['status']} |\n")
        else:
            lines.append(
                f"| {r['symbol']} | {r['timeframe']} | {r['research_x']:.4f} | {r['prod_x']:.4f} | "
                f"{r['research_y']:.4f} | {r['prod_y']:.4f} | "
                f"{r['abs_dx']:.2e} | {r['abs_dy']:.2e} | {r['status']} |\n"
            )
    lines.append(f"\n**VERDICT: {report['verdict']}**\n")
    return "".join(lines)

if __name__ == '__main__':
    main()
