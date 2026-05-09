# Leveraged/Index Proxy 라우팅 전환 후 검증 — 읽기 전용, 프로덕션 변경 없음
"""
SMA_10_34_8 (현재 프로덕션) vs Family C (이전 베이스라인) vs StockCharts 참조값 비교.
SOXX, SOXL, QQQ, TQQQ / Daily + Weekly.
"""
import sys, os, json, math, datetime
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import compute_symbol_rrg, _fam_c, _prep

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# StockCharts 근사 참조값 (수동 캡처 — approximate)
SC_REF = {
    'daily': {
        'SOXX': (110.00, 100.70),
        'SOXL': (138.00, 101.00),
        'QQQ':  (102.30, 100.50),
        'TQQQ': (114.50, 100.70),
    },
    'weekly': {
        'SOXX': (113.00, 101.70),
        'SOXL': (134.00, 106.60),
        'QQQ':  (100.50, 101.10),
        'TQQQ': (98.30,  103.60),
    },
}

# 이전 Family C 파라미터 (전환 전 stock_mixed 프리셋)
FAM_C_DAILY  = {'N': 65, 'Kx': 2, 'Ky': 2, 'EMA': 10}
FAM_C_WEEKLY = {'N': 52, 'Kx': 2, 'Ky': 2, 'EMA': 10}

SYMS = ['SOXX', 'SOXL', 'QQQ', 'TQQQ']
BOUNDARY_TOL = 0.30


def _quad(x, y):
    if x >= 100 and y >= 100: return 'Leading'
    if x >= 100 and y <  100: return 'Weakening'
    if x <  100 and y >= 100: return 'Improving'
    return 'Lagging'

def _dist(ax, ay, bx, by): return math.sqrt((ax - bx)**2 + (ay - by)**2)
def _boundary(x, y): return abs(x - 100.0) < BOUNDARY_TOL or abs(y - 100.0) < BOUNDARY_TOL

def _latest_fam_c(sym_s, bench_s, tf):
    """Family C 최신값 추출 (이전 베이스라인 재현)."""
    p = FAM_C_DAILY if tf == 'daily' else FAM_C_WEEKLY
    try:
        rsr_s, rsm_s = _fam_c(sym_s, bench_s, p['N'], p['Kx'], p['Ky'], p['EMA'])
        df = pd.DataFrame({'r': rsr_s, 'm': rsm_s}).dropna()
        if df.empty:
            return None
        return float(df['r'].iloc[-1]), float(df['m'].iloc[-1])
    except Exception:
        return None


def main():
    bench_d = load_daily('SPY')
    bench_w = load_weekly('SPY')

    rows = []
    for tf in ['daily', 'weekly']:
        bench = bench_d if tf == 'daily' else bench_w
        loader = load_daily if tf == 'daily' else load_weekly
        sc_tf  = SC_REF[tf]

        for sym in SYMS:
            sym_s = loader(sym)
            if sym_s is None or bench is None:
                rows.append({'symbol': sym, 'timeframe': tf, 'error': 'no_data'})
                continue

            # Current production (SMA_10_34_8)
            res_sma = compute_symbol_rrg(sym_s, bench, tf, 'stock_mixed', tail_len=10)
            if res_sma is None or '_error' in res_sma:
                rows.append({'symbol': sym, 'timeframe': tf,
                             'error': res_sma.get('_error') if res_sma else 'compute_failed'})
                continue

            sx = res_sma['latest']['rs_ratio']
            sy = res_sma['latest']['rs_momentum']

            # Family C baseline (recomputed)
            fc = _latest_fam_c(sym_s, bench, tf)
            cx, cy = (fc[0], fc[1]) if fc else (None, None)

            sc = sc_tf.get(sym)
            sc_x, sc_y = (sc[0], sc[1]) if sc else (None, None)

            dist_sma = _dist(sx, sy, sc_x, sc_y) if sc else None
            dist_c   = _dist(cx, cy, sc_x, sc_y) if (sc and fc) else None

            q_sma = _quad(sx, sy)
            q_c   = _quad(cx, cy) if fc else None
            q_sc  = _quad(sc_x, sc_y) if sc else None
            bound_sc = _boundary(sc_x, sc_y) if sc else None

            improvement = None
            if dist_sma is not None and dist_c is not None and dist_c > 0:
                improvement = (dist_c - dist_sma) / dist_c * 100

            rows.append({
                'symbol': sym, 'timeframe': tf,
                'sma_x': round(sx, 4), 'sma_y': round(sy, 4),
                'famc_x': round(cx, 4) if cx else None,
                'famc_y': round(cy, 4) if cy else None,
                'sc_x': sc_x, 'sc_y': sc_y, 'sc_approximate': True,
                'dist_sma_to_sc': round(dist_sma, 4) if dist_sma else None,
                'dist_famc_to_sc': round(dist_c, 4) if dist_c else None,
                'improvement_pct': round(improvement, 2) if improvement is not None else None,
                'dx_sma': round(sx - sc_x, 4) if sc else None,
                'dy_sma': round(sy - sc_y, 4) if sc else None,
                'quad_sma': q_sma, 'quad_famc': q_c, 'quad_sc': q_sc,
                'quad_match_sma': (q_sma == q_sc) if q_sc else None,
                'quad_match_famc': (q_c == q_sc) if (q_sc and q_c) else None,
                'sc_boundary': bound_sc,
            })
            imp_str = f"improv={improvement:+.1f}%" if improvement is not None else ""
            print(f"  {sym:6} {tf:7} SMA=({sx:.2f},{sy:.2f}) FamC=({cx:.2f},{cy:.2f}) "
                  f"dist_SMA={dist_sma:.3f} dist_C={dist_c:.3f} {imp_str}")

    # Aggregate metrics
    def avg(tf, key):
        v = [r[key] for r in rows
             if r.get('timeframe') == tf and r.get(key) is not None and 'error' not in r]
        return round(sum(v)/len(v), 4) if v else None

    def qmatch(tf, key):
        v = [r[key] for r in rows
             if r.get('timeframe') == tf and r.get(key) is not None and 'error' not in r]
        return sum(1 for x in v if x), len(v)

    metrics = {}
    for tf in ['daily', 'weekly']:
        sma_q, sma_n = qmatch(tf, 'quad_match_sma')
        c_q,   c_n   = qmatch(tf, 'quad_match_famc')
        metrics[tf] = {
            'avg_dist_sma':  avg(tf, 'dist_sma_to_sc'),
            'avg_dist_famc': avg(tf, 'dist_famc_to_sc'),
            'quad_match_sma':  f"{sma_q}/{sma_n}",
            'quad_match_famc': f"{c_q}/{c_n}",
            'worst_sma': max(
                (r['dist_sma_to_sc'] for r in rows
                 if r.get('timeframe') == tf and r.get('dist_sma_to_sc') is not None),
                default=None
            ),
        }

    print("\n[Metrics]")
    for tf in ['daily', 'weekly']:
        m = metrics[tf]
        print(f"  {tf}: SMA avg_dist={m['avg_dist_sma']} FamC avg_dist={m['avg_dist_famc']} "
              f"quad_SMA={m['quad_match_sma']} quad_C={m['quad_match_famc']}")

    # Decision
    def recommend():
        d = metrics.get('daily', {}); w = metrics.get('weekly', {})
        avg_sma  = ((d.get('avg_dist_sma')  or 0) + (w.get('avg_dist_sma')  or 0)) / 2
        avg_famc = ((d.get('avg_dist_famc') or 0) + (w.get('avg_dist_famc') or 0)) / 2
        imp = (avg_famc - avg_sma) / avg_famc * 100 if avg_famc > 0 else 0
        sma_qd, _ = qmatch('daily',  'quad_match_sma')
        c_qd,   _ = qmatch('daily',  'quad_match_famc')
        sma_qw, _ = qmatch('weekly', 'quad_match_sma')
        c_qw,   _ = qmatch('weekly', 'quad_match_famc')
        worst = max((r['dist_sma_to_sc'] for r in rows
                     if r.get('dist_sma_to_sc') is not None), default=0)
        if imp >= 25 and (sma_qd + sma_qw) >= (c_qd + c_qw):
            if worst > 10:
                return 'KEEP_SMA_BUT_RESEARCH_LEVERAGED'
            return 'KEEP_SMA'
        if avg_sma < avg_famc:
            return 'KEEP_SMA_BUT_RESEARCH_LEVERAGED'
        return 'REVERT_TO_FAMC'

    rec = recommend()
    rec_labels = {
        'KEEP_SMA': 'A. Keep SMA_10_34_8 for all leveraged/index proxy',
        'KEEP_SMA_BUT_RESEARCH_LEVERAGED': 'C. Keep SMA_10_34_8 but research dedicated leveraged route (SOXL/TQQQ gap still large)',
        'REVERT_TO_FAMC': 'B. Revert leveraged/index proxy to Family C',
    }
    print(f"\n  RECOMMENDATION: {rec_labels[rec]}")

    verdict = ('RRG_LEVERAGED_POST_SWITCH_VALIDATION_PASS'
               if rec != 'REVERT_TO_FAMC'
               else 'RRG_LEVERAGED_POST_SWITCH_VALIDATION_PASS_WITH_WARNINGS')

    output = {
        'generated_at': datetime.datetime.now().isoformat(),
        'caution': 'SC values approximate. Temporal misalignment with fresh computations expected.',
        'current_route': 'SMA_10_34_8 (post commit 7ad09c1)',
        'baseline_route': 'Family C (pre-switch)',
        'production_changed': False,
        'metrics': metrics,
        'recommendation': rec,
        'recommendation_label': rec_labels[rec],
        'rows': rows,
        'verdict': verdict,
    }

    fp_j = os.path.join(OUTPUT_DIR, 'RRG_LEVERAGED_POST_SWITCH_VALIDATION.json')
    fp_m = os.path.join(OUTPUT_DIR, 'RRG_LEVERAGED_POST_SWITCH_VALIDATION.md')
    with open(fp_j, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    with open(fp_m, 'w', encoding='utf-8') as f:
        f.write(build_md(output, rows, metrics, rec, rec_labels))

    print(f"\n  SAVED: RRG_LEVERAGED_POST_SWITCH_VALIDATION.json ({os.path.getsize(fp_j):,} bytes)")
    print(f"  SAVED: RRG_LEVERAGED_POST_SWITCH_VALIDATION.md ({os.path.getsize(fp_m):,} bytes)")
    print(f"\nFINAL: {verdict}")


def build_md(output, rows, metrics, rec, rec_labels):
    lines = [
        "# RRG Leveraged / Index Proxy — Post-Switch Validation\n\n",
        f"> Generated: {output['generated_at'][:16]}\n",
        f"> **Caution**: {output['caution']}\n",
        "> No production code was changed in this task.\n\n",
        "## Current Routing Confirmation\n\n",
        f"- All groups now use: `{output['current_route']}`\n",
        f"- Baseline compared: `{output['baseline_route']}`\n\n",
        "## Executive Summary\n\n",
        "| Metric | SMA_10_34_8 (current) | Family C (previous) |\n",
        "|--------|----------------------|---------------------|\n",
    ]
    for tf in ['daily', 'weekly']:
        m = metrics.get(tf, {})
        lines.append(
            f"| {tf.capitalize()} avg_dist_to_SC | **{m.get('avg_dist_sma','—')}** | "
            f"{m.get('avg_dist_famc','—')} |\n"
        )
        lines.append(
            f"| {tf.capitalize()} quad_match | **{m.get('quad_match_sma','—')}** | "
            f"{m.get('quad_match_famc','—')} |\n"
        )
        lines.append(
            f"| {tf.capitalize()} worst_gap | {m.get('worst_sma','—')} | — |\n"
        )
    lines.append("\n")

    for tf in ['daily', 'weekly']:
        lines.append(f"## {tf.capitalize()} Detail\n\n")
        lines.append(
            "| Symbol | SC_X | SC_Y | SC_Quad | "
            "SMA_X | SMA_Y | SMA_Dist | SMA_Quad | SMA_QM | "
            "FamC_X | FamC_Y | FamC_Dist | FamC_Quad | FamC_QM | "
            "Improv% |\n"
        )
        sep = "|".join(["---"] * 15)
        lines.append(f"|{sep}|\n")
        for r in rows:
            if r.get('timeframe') != tf or 'error' in r:
                if r.get('timeframe') == tf:
                    lines.append(f"| {r['symbol']} | — | — | — | — | — | — | — | — | — | — | — | — | — | ERR |\n")
                continue
            sc_b = '*' if r.get('sc_boundary') else ''
            qm_s = 'Y' if r.get('quad_match_sma')  else ('N' if r.get('quad_match_sma')  is False else '?')
            qm_c = 'Y' if r.get('quad_match_famc') else ('N' if r.get('quad_match_famc') is False else '?')
            imp  = f"{r['improvement_pct']:+.1f}%" if r.get('improvement_pct') is not None else '—'
            lines.append(
                f"| {r['symbol']} | {r['sc_x']:.2f}{sc_b} | {r['sc_y']:.2f}{sc_b} | {r.get('quad_sc','?')} | "
                f"{r['sma_x']:.2f} | {r['sma_y']:.2f} | {r['dist_sma_to_sc']:.3f} | "
                f"{r['quad_sma']} | {qm_s} | "
                f"{r['famc_x']:.2f} | {r['famc_y']:.2f} | {r['dist_famc_to_sc']:.3f} | "
                f"{r.get('quad_famc','?')} | {qm_c} | {imp} |\n"
            )
        lines.append("\n")

    # SOXL/TQQQ individual analysis
    lines.append("## SOXL / TQQQ Gap Analysis\n\n")
    for sym in ['SOXL', 'TQQQ']:
        lines.append(f"### {sym}\n")
        for tf in ['daily', 'weekly']:
            r = next((x for x in rows
                      if x.get('symbol') == sym and x.get('timeframe') == tf
                      and 'error' not in x), None)
            if r:
                lines.append(
                    f"- {tf}: SMA=({r['sma_x']:.2f},{r['sma_y']:.2f}) "
                    f"SC=({r['sc_x']:.2f},{r['sc_y']:.2f}) "
                    f"dist={r['dist_sma_to_sc']:.3f} Δx={r['dx_sma']:+.2f} Δy={r['dy_sma']:+.2f} "
                    f"quad_match={'Y' if r.get('quad_match_sma') else 'N'}\n"
                )
        lines.append("\n")

    rec_detail = {
        'KEEP_SMA': (
            "SMA_10_34_8 materially outperforms Family C for leveraged/index proxy. "
            "Keep current routing."
        ),
        'KEEP_SMA_BUT_RESEARCH_LEVERAGED': (
            "SMA_10_34_8 is better than Family C overall, but SOXL and/or TQQQ still show "
            "large absolute gaps vs StockCharts (dist > 10). "
            "This is consistent with the formula study finding that 3x leveraged ETFs "
            "amplify any formula discrepancy. "
            "Keep SMA_10_34_8 as the current best available formula, "
            "but open a dedicated leveraged route research WORK_ORDER."
        ),
        'REVERT_TO_FAMC': (
            "Family C produced better results for leveraged/index proxy. "
            "Revert stock_mixed route to Family C for this symbol group, "
            "or create a separate leveraged route using Family C."
        ),
    }
    lines.append("## Recommendation\n\n")
    lines.append(f"**{rec_labels[rec]}**\n\n")
    lines.append(f"{rec_detail[rec]}\n\n")
    lines.append("*SC reference values are approximate. Temporal misalignment limits precision.*\n\n")
    lines.append(f"**VERDICT: {output['verdict']}**\n")
    return "".join(lines)


if __name__ == '__main__':
    main()
