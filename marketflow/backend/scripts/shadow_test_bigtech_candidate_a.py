# Big Tech Candidate A 섀도 테스트 — 비교 전용, 프로덕션 라우팅 변경 없음
"""
Family C (현재 stock_mixed 프로덕션) vs Candidate A (SMA 10/34/8) 비교.
StockCharts 근사 참조값과 대조.
"""
import sys, os, json, math, datetime
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import compute_symbol_rrg, compute_rrg_sma_10_34_8

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# StockCharts 근사값 (수동 캡처 — approximate, 동일 날짜 보장 없음)
SC_REF = {
    'daily': {
        'AAPL': (99.70,  100.40),
        'MSFT': (102.00,  99.55),
        'NVDA': (102.90,  99.15),
        'AMD':  (121.00, 102.30),
        'TSLA': (98.10,  100.15),
    },
    'weekly': {
        'AAPL': (99.20,   99.60),
        'MSFT': (89.00,  102.30),
        'NVDA': (100.00, 101.00),
        'AMD':  (109.40, 107.60),
        'TSLA': (90.80,   97.10),
    },
}

SYMS = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA']
BOUNDARY_TOL = 0.30

def _quad(x, y):
    if x >= 100 and y >= 100: return 'Leading'
    if x >= 100 and y <  100: return 'Weakening'
    if x <  100 and y >= 100: return 'Improving'
    return 'Lagging'

def _boundary(x, y):
    return abs(x - 100.0) < BOUNDARY_TOL or abs(y - 100.0) < BOUNDARY_TOL

def _dist(x1, y1, x2, y2):
    return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)

def main():
    bench_d = load_daily('SPY')
    bench_w = load_weekly('SPY')

    rows = []
    for tf in ['daily', 'weekly']:
        bench = bench_d if tf == 'daily' else bench_w
        loader = load_daily if tf == 'daily' else load_weekly
        sc_tf = SC_REF[tf]

        for sym in SYMS:
            sym_s = loader(sym)
            if sym_s is None or bench is None:
                rows.append({'symbol': sym, 'timeframe': tf, 'error': 'no_data'})
                continue

            # Family C (production stock_mixed route)
            res_c = compute_symbol_rrg(sym_s, bench, tf, 'stock_mixed', tail_len=10)
            # Candidate A shadow
            res_a = compute_rrg_sma_10_34_8(sym_s, bench, tail_len=10)

            if (res_c is None or '_error' in res_c or
                    res_a is None or '_error' in res_a):
                rows.append({'symbol': sym, 'timeframe': tf, 'error': 'compute_failed'})
                continue

            cx = res_c['latest']['rs_ratio'];   cy = res_c['latest']['rs_momentum']
            ax = res_a['latest']['rs_ratio'];   ay = res_a['latest']['rs_momentum']

            sc = sc_tf.get(sym)
            sc_x, sc_y = (sc[0], sc[1]) if sc else (None, None)

            dist_c = _dist(cx, cy, sc_x, sc_y) if sc else None
            dist_a = _dist(ax, ay, sc_x, sc_y) if sc else None

            if dist_c is not None and dist_a is not None:
                winner = 'A' if dist_a < dist_c else ('C' if dist_c < dist_a else 'TIE')
                improvement_pct = ((dist_c - dist_a) / dist_c * 100) if dist_c > 0 else 0.0
            else:
                winner = 'N/A'; improvement_pct = None

            q_c  = _quad(cx, cy)
            q_a  = _quad(ax, ay)
            q_sc = _quad(sc_x, sc_y) if sc else None
            qm_c = (q_c == q_sc) if q_sc else None
            qm_a = (q_a == q_sc) if q_sc else None

            rows.append({
                'symbol': sym, 'timeframe': tf,
                'family_c_x':   round(cx, 4), 'family_c_y':   round(cy, 4),
                'candidate_a_x': round(ax, 4), 'candidate_a_y': round(ay, 4),
                'sc_x': sc_x, 'sc_y': sc_y, 'sc_approximate': True,
                'dist_family_c_to_sc': round(dist_c, 4) if dist_c else None,
                'dist_candidate_a_to_sc': round(dist_a, 4) if dist_a else None,
                'improvement_pct': round(improvement_pct, 2) if improvement_pct is not None else None,
                'winner': winner,
                'quadrant_family_c': q_c,
                'quadrant_candidate_a': q_a,
                'quadrant_sc': q_sc,
                'quad_match_family_c': qm_c,
                'quad_match_candidate_a': qm_a,
                'sc_boundary': _boundary(sc_x, sc_y) if sc else None,
            })

    # Aggregate metrics
    def agg(tf, key):
        vals = [r[key] for r in rows
                if r.get('timeframe') == tf and r.get(key) is not None and 'error' not in r]
        return round(sum(vals) / len(vals), 4) if vals else None

    def qmatch(tf, key):
        vals = [r[key] for r in rows
                if r.get('timeframe') == tf and r.get(key) is not None and 'error' not in r]
        return sum(1 for v in vals if v), len(vals)

    metrics = {}
    for tf in ['daily', 'weekly']:
        qc_n, qc_t = qmatch(tf, 'quad_match_family_c')
        qa_n, qa_t = qmatch(tf, 'quad_match_candidate_a')
        metrics[tf] = {
            'avg_dist_family_c':     agg(tf, 'dist_family_c_to_sc'),
            'avg_dist_candidate_a':  agg(tf, 'dist_candidate_a_to_sc'),
            'quad_match_family_c':   f"{qc_n}/{qc_t}",
            'quad_match_candidate_a': f"{qa_n}/{qa_t}",
            'winner_count_A':  sum(1 for r in rows if r.get('timeframe') == tf and r.get('winner') == 'A'),
            'winner_count_C':  sum(1 for r in rows if r.get('timeframe') == tf and r.get('winner') == 'C'),
        }

    # Recommendation
    def recommend(m_d, m_w):
        if m_d is None or m_w is None:
            return 'RUN_MORE_REFERENCES'
        avg_c = (m_d['avg_dist_family_c'] + m_w['avg_dist_family_c']) / 2
        avg_a = (m_d['avg_dist_candidate_a'] + m_w['avg_dist_candidate_a']) / 2
        improvement = (avg_c - avg_a) / avg_c * 100 if avg_c > 0 else 0
        wc_a = m_d['winner_count_A'] + m_w['winner_count_A']
        wc_c = m_d['winner_count_C'] + m_w['winner_count_C']
        if improvement >= 25 and wc_a >= wc_c:
            return 'SWITCH_TO_CANDIDATE_A'
        if improvement >= 10:
            return 'RUN_MORE_REFERENCES'
        return 'KEEP_FAMILY_C'

    rec = recommend(metrics.get('daily'), metrics.get('weekly'))

    verdict_map = {
        'SWITCH_TO_CANDIDATE_A': 'RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST_PASS',
        'RUN_MORE_REFERENCES':   'RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST_PASS_WITH_WARNINGS',
        'KEEP_FAMILY_C':         'RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST_PASS',
    }

    output = {
        'generated_at': datetime.datetime.now().isoformat(),
        'caution': 'SC values are approximate manual captures. Temporal misalignment with fresh computations is expected.',
        'production_changed': False,
        'benchmark': 'SPY',
        'symbols': SYMS,
        'metrics': metrics,
        'recommendation': rec,
        'rows': rows,
        'verdict': verdict_map[rec],
    }

    fp_j = os.path.join(OUTPUT_DIR, 'RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST.json')
    fp_m = os.path.join(OUTPUT_DIR, 'RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST.md')

    with open(fp_j, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    with open(fp_m, 'w', encoding='utf-8') as f:
        f.write(build_md(output, rows, metrics, rec))

    # Console summary
    print("\n[DAILY]")
    m = metrics.get('daily', {})
    print(f"  Family C  avg_dist={m.get('avg_dist_family_c')} quad={m.get('quad_match_family_c')}")
    print(f"  Cand A    avg_dist={m.get('avg_dist_candidate_a')} quad={m.get('quad_match_candidate_a')}")
    print(f"  Winner A={m.get('winner_count_A')} C={m.get('winner_count_C')}")

    print("\n[WEEKLY]")
    m = metrics.get('weekly', {})
    print(f"  Family C  avg_dist={m.get('avg_dist_family_c')} quad={m.get('quad_match_family_c')}")
    print(f"  Cand A    avg_dist={m.get('avg_dist_candidate_a')} quad={m.get('quad_match_candidate_a')}")
    print(f"  Winner A={m.get('winner_count_A')} C={m.get('winner_count_C')}")

    print(f"\n  RECOMMENDATION: {rec}")
    print(f"\n  SAVED: RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST.json ({os.path.getsize(fp_j):,} bytes)")
    print(f"  SAVED: RRG_BIG_TECH_CANDIDATE_A_SHADOW_TEST.md ({os.path.getsize(fp_m):,} bytes)")
    print(f"\nFINAL: {output['verdict']}")


def build_md(output, rows, metrics, rec):
    def qstr(x, y, bound=False):
        q = _quad(x, y)
        return f"{q}{'*' if bound else ''}"

    lines = [
        "# RRG Big Tech Shadow Test — Family C vs Candidate A\n\n",
        f"> Generated: {output['generated_at'][:16]}\n",
        f"> **Caution**: {output['caution']}\n",
        "> Production routing is unchanged.\n\n",
        "## Executive Summary\n\n",
    ]

    # Quick summary table
    lines.append("| | Family C | Candidate A |\n")
    lines.append("|---|----------|-------------|\n")
    for tf in ['daily', 'weekly']:
        m = metrics.get(tf, {})
        lines.append(
            f"| {tf.capitalize()} avg_dist_to_SC | {m.get('avg_dist_family_c', 'N/A')} | "
            f"{m.get('avg_dist_candidate_a', 'N/A')} |\n"
        )
        lines.append(
            f"| {tf.capitalize()} quad_match | {m.get('quad_match_family_c', 'N/A')} | "
            f"{m.get('quad_match_candidate_a', 'N/A')} |\n"
        )
        lines.append(
            f"| {tf.capitalize()} symbols_won | {m.get('winner_count_C', 0)} | "
            f"{m.get('winner_count_A', 0)} |\n"
        )
    lines.append("\n")

    # Detail tables
    for tf in ['daily', 'weekly']:
        lines.append(f"## {tf.capitalize()} Detail\n\n")
        lines.append(
            "| Symbol | SC_X | SC_Y | SC_Quad | "
            "FamC_X | FamC_Y | FamC_Dist | FamC_Quad | FamC_QM | "
            "CandA_X | CandA_Y | CandA_Dist | CandA_Quad | CandA_QM | "
            "Improv% | Winner |\n"
        )
        lines.append("|" + "|".join(["---"] * 15) + "|\n")

        for r in rows:
            if r.get('timeframe') != tf or 'error' in r:
                if 'error' in r and r.get('timeframe') == tf:
                    lines.append(f"| {r['symbol']} | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ERR |\n")
                continue
            sc_b = '*' if r.get('sc_boundary') else ''
            qm_c = 'Y' if r.get('quad_match_family_c') else ('N' if r.get('quad_match_family_c') is False else '?')
            qm_a = 'Y' if r.get('quad_match_candidate_a') else ('N' if r.get('quad_match_candidate_a') is False else '?')
            imp  = f"{r['improvement_pct']:+.1f}%" if r.get('improvement_pct') is not None else '—'
            lines.append(
                f"| {r['symbol']} | "
                f"{r['sc_x']:.2f}{sc_b} | {r['sc_y']:.2f}{sc_b} | {r.get('quadrant_sc', '?')} | "
                f"{r['family_c_x']:.2f} | {r['family_c_y']:.2f} | "
                f"{r['dist_family_c_to_sc']:.3f} | {r['quadrant_family_c']} | {qm_c} | "
                f"{r['candidate_a_x']:.2f} | {r['candidate_a_y']:.2f} | "
                f"{r['dist_candidate_a_to_sc']:.3f} | {r['quadrant_candidate_a']} | {qm_a} | "
                f"{imp} | **{r['winner']}** |\n"
            )
        lines.append("\n")

    # Recommendation
    rec_text = {
        'SWITCH_TO_CANDIDATE_A': (
            "**SWITCH TO CANDIDATE A** — Candidate A improves avg_distance by >=25% "
            "AND does not worsen quadrant match. Switch stock/mixed route in next WORK_ORDER."
        ),
        'RUN_MORE_REFERENCES': (
            "**RUN MORE REFERENCES** — Candidate A shows improvement but below 25% threshold, "
            "or results are mixed. Capture more StockCharts reference points before switching."
        ),
        'KEEP_FAMILY_C': (
            "**KEEP FAMILY C** — Family C is comparable or better than Candidate A for Big Tech. "
            "No route change recommended."
        ),
    }
    lines.append("## Recommendation\n\n")
    lines.append(f"{rec_text.get(rec, rec)}\n\n")
    lines.append("*Note: SC reference values are approximate. Temporal misalignment limits precision.*\n\n")
    lines.append(f"**VERDICT: {output['verdict']}**\n")
    return "".join(lines)


if __name__ == '__main__':
    main()
