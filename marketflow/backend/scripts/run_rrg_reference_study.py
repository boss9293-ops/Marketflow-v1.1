"""
RRG Reference Study — Formula Family Comparison vs StockCharts Reference Coordinates.

Families tested:
  A: Legacy-like (z-score RS, shift(M) ROC, Kx=Ky=10)
  B: F2 Raw Z   (z-score RS, shift(1) ROC, Kx=Ky in {1,3,5} + asymmetric)
  C: F2 Smoothed (EMA-pre-smooth RS, shift(1) ROC, EMA span in {10,14})
  D: EMA Ratio  (RS/MA(RS,N)*100, RS_Ratio/MA(RS_Ratio,M)*100)

Outputs:
  output/rrg/RRG_STOCKCHARTS_REFERENCE_STUDY.md
  output/rrg/rrg_reference_study_results.json
"""
import sys, os, json, math
import pandas as pd
import numpy as np
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from rrg_calculator import load_daily
from rrg_presets import EPSILON

# ── Constants ─────────────────────────────────────────────────────────────────
SYMS     = ['AAPL', 'GOOGL', 'TSLA', 'AMZN', 'NVDA', 'MSFT', 'AVGO', 'JPM', 'NFLX']
BENCH    = 'SPY'
N_W, M_W = 52, 5
N_D, M_D = 65, 10
LB_DAILY = 700    # daily bars to use for daily scoring
TAIL_LEN = 7
BOUNDARY = 0.5

# ── StockCharts reference (approximate visual reads) ──────────────────────────
SC_WEEKLY = {
    'NFLX':  (99.1,  108.0, 'improving'),
    'MSFT':  (89.0,  102.5, 'improving'),
    'TSLA':  (91.0,   97.2, 'lagging'),
    'AMZN':  (101.2, 104.6, 'leading'),
    'AVGO':  (102.3, 105.2, 'leading'),
    'NVDA':  (100.3, 101.1, 'leading'),
    'GOOGL': (103.7,  98.8, 'weakening'),
    'AAPL':  (99.2,  100.0, 'boundary'),
    'JPM':   (97.7,   99.8, 'lagging'),
}

SC_DAILY = {
    'TSLA':  (98.0,  100.3, 'improving'),
    'AAPL':  (99.5,  100.1, 'boundary'),
    'MSFT':  (102.3, 100.2, 'leading'),
    'GOOGL': (105.5, 101.7, 'leading'),
    'NVDA':  (103.2,  99.7, 'weakening'),
    'AMZN':  (106.6,  99.7, 'weakening'),
    'AVGO':  (108.5,  98.8, 'weakening'),
    'JPM':   (98.1,   99.0, 'lagging'),
    'NFLX':  (91.8,   96.3, 'lagging'),
}

# ── Utilities ─────────────────────────────────────────────────────────────────
def classify_quad(x, y):
    if abs(x - 100) < BOUNDARY or abs(y - 100) < BOUNDARY:
        return 'boundary'
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y <  100: return 'lagging'
    return 'improving'

def classify_quad_strict(x, y):
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y <  100: return 'lagging'
    return 'improving'

def kendall_tau(a, b):
    n = len(a)
    if n < 2: return 0.0
    c = d = 0
    for i in range(n):
        for j in range(i + 1, n):
            p = (a[i] - a[j]) * (b[i] - b[j])
            if p > 0: c += 1
            elif p < 0: d += 1
    denom = n * (n - 1) / 2
    return (c - d) / denom if denom else 0.0

def prep(s_close, b_close):
    common = s_close.index.intersection(b_close.index)
    s = s_close.loc[common]
    b = b_close.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    return s[mask], b[mask]

# ── Formula Families ──────────────────────────────────────────────────────────
def family_a(s_close, b_close, N, M, Kx=10.0, Ky=10.0):
    s, b = prep(s_close, b_close)
    RS = 100.0 * s / b
    rs_m = RS.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RS.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RS - rs_m) / rs_s
    ROC  = 100.0 * (RSR / RSR.shift(M) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSM  = 100.0 + Ky * (ROC - ro_m) / ro_s
    return RSR, RSM

def family_b(s_close, b_close, N, Kx, Ky):
    s, b = prep(s_close, b_close)
    RS = 100.0 * s / b
    rs_m = RS.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RS.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RS - rs_m) / rs_s
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSM  = 100.0 + Ky * (ROC - ro_m) / ro_s
    return RSR, RSM

def family_c(s_close, b_close, N, Kx, Ky, smooth):
    s, b = prep(s_close, b_close)
    RS   = 100.0 * s / b
    RS_s = RS.ewm(span=smooth, adjust=False).mean()
    rs_m = RS_s.rolling(N, min_periods=N).mean().shift(1)
    rs_s2= RS_s.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RS_s - rs_m) / rs_s2
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSM  = 100.0 + Ky * (ROC - ro_m) / ro_s
    return RSR, RSM

def family_d(s_close, b_close, N, M):
    s, b = prep(s_close, b_close)
    RS   = 100.0 * s / b
    RSR  = 100.0 * RS  / RS.rolling(N, min_periods=N).mean()
    RSM  = 100.0 * RSR / RSR.rolling(M, min_periods=M).mean()
    return RSR, RSM

# ── Runner ────────────────────────────────────────────────────────────────────
def run_candidate(fn, sym_data, bench_close):
    out = {}
    for sym, close in sym_data.items():
        try:
            rsr, rsm = fn(close, bench_close)
            df = pd.DataFrame({'x': rsr, 'y': rsm}).dropna()
            if len(df) < 2:
                continue
            x = float(df['x'].iloc[-1])
            y = float(df['y'].iloc[-1])
            trail = [(float(r['x']), float(r['y'])) for _, r in df.iloc[-(TAIL_LEN + 1):].iterrows()]
            out[sym] = (x, y, trail)
        except Exception as e:
            print(f'    ERR {sym}: {e}')
    return out

# ── Scoring ───────────────────────────────────────────────────────────────────
def score_result(computed, sc_ref):
    syms = [s for s in SYMS if s in computed and s in sc_ref]
    n = len(syms)
    if n == 0:
        return {'total': 0, 'error': 'no_syms'}

    # 1. Quadrant match (40%)
    qpts = 0.0
    qdets = {}
    for sym in syms:
        cx, cy, _ = computed[sym]
        sx, sy, eq = sc_ref[sym]
        cq = classify_quad(cx, cy)
        if eq == 'boundary':
            pts = 1.0 if (abs(cx - 100) <= 1.5 or abs(cy - 100) <= 1.5) else \
                  0.5 if cq == classify_quad_strict(sx, sy) else 0.0
        elif cq == eq:
            pts = 1.0
        elif cq == 'boundary':
            pts = 0.5
        else:
            pts = 0.0
        qpts += pts
        qdets[sym] = {'computed': cq, 'expected': eq, 'cx': round(cx, 2), 'cy': round(cy, 2), 'pts': pts}
    quad_score = qpts / n * 40.0

    # 2. Tail direction (25%) — position-side agreement + movement direction
    tpts = 0.0
    for sym in syms:
        cx, cy, trail = computed[sym]
        sx, sy, _ = sc_ref[sym]
        x_ok = (sx >= 100 and cx >= 100) or (sx < 100 and cx < 100)
        y_ok = (sy >= 100 and cy >= 100) or (sy < 100 and cy < 100)
        if x_ok and y_ok:
            tpts += 1.0
        elif x_ok or y_ok:
            bonus = 0.0
            if len(trail) >= 2:
                dx = trail[-1][0] - trail[-2][0]
                dy = trail[-1][1] - trail[-2][1]
                if x_ok:
                    bonus = 0.2 if (sy >= 100 and dy > 0) or (sy < 100 and dy < 0) else 0.0
                else:
                    bonus = 0.2 if (sx >= 100 and dx > 0) or (sx < 100 and dx < 0) else 0.0
            tpts += 0.7 + bonus
        else:
            if len(trail) >= 2:
                dx = trail[-1][0] - trail[-2][0]
                dy = trail[-1][1] - trail[-2][1]
                xm = (sx >= 100 and dx > 0) or (sx < 100 and dx < 0)
                ym = (sy >= 100 and dy > 0) or (sy < 100 and dy < 0)
                tpts += 0.3 if (xm and ym) else 0.15 if (xm or ym) else 0.0
    tail_score = tpts / n * 25.0

    # 3. Coordinate RMSE (20%)
    errs = [(computed[s][0] - sc_ref[s][0])**2 + (computed[s][1] - sc_ref[s][1])**2 for s in syms]
    rmse = math.sqrt(sum(errs) / n)
    coord_score = max(0.0, 20.0 - 2.0 * rmse)

    # 4. Relative ordering — Kendall tau on X and Y (10%)
    cxs = [computed[s][0] for s in syms]
    cys = [computed[s][1] for s in syms]
    rxs = [sc_ref[s][0]   for s in syms]
    rys = [sc_ref[s][1]   for s in syms]
    tau_x = kendall_tau(cxs, rxs)
    tau_y = kendall_tau(cys, rys)
    rank_score = ((tau_x + tau_y) / 2 + 1.0) / 2.0 * 10.0

    # 5. Compression/expansion (5%)
    sx_r = max(cxs) - min(cxs)
    sy_r = max(cys) - min(cys)
    if sx_r < 2 or sy_r < 1:
        comp_score = 0.0
    elif sx_r < 4 or sy_r < 2:
        comp_score = 2.0
    elif sx_r > 40 or sy_r > 40:
        comp_score = 2.0
    elif sx_r > 28 or sy_r > 28:
        comp_score = 3.5
    else:
        comp_score = 5.0

    total = quad_score + tail_score + coord_score + rank_score + comp_score
    return {
        'total':      round(total, 2),
        'quad_score': round(quad_score, 2),
        'tail_score': round(tail_score, 2),
        'coord_score':round(coord_score, 2),
        'rank_score': round(rank_score, 2),
        'comp_score': round(comp_score, 2),
        'rmse':       round(rmse, 3),
        'tau_x':      round(tau_x, 3),
        'tau_y':      round(tau_y, 3),
        'spread_x':   round(sx_r, 2),
        'spread_y':   round(sy_r, 2),
        'quad_details': qdets,
    }

# ── Candidate factory ─────────────────────────────────────────────────────────
def make_candidates(N, M):
    cands = []
    # A
    cands.append({
        'name': 'A_Kx10_shiftM', 'family': 'A', 'params': f'Kx=10 Ky=10 shift({M})',
        'fn': lambda s, b, _N=N, _M=M: family_a(s, b, _N, _M, 10, 10),
    })
    # B symmetric
    for K in [1, 3, 5]:
        cands.append({
            'name': f'B_Kx{K}', 'family': 'B', 'params': f'Kx={K} Ky={K} shift(1)',
            'fn': (lambda s, b, _N=N, _K=K: family_b(s, b, _N, _K, _K)),
        })
    # B asymmetric
    for Kx, Ky in [(2, 3), (3, 2), (3, 5), (5, 3), (4, 3), (3, 4)]:
        cands.append({
            'name': f'B_Kx{Kx}_Ky{Ky}', 'family': 'B', 'params': f'Kx={Kx} Ky={Ky} shift(1)',
            'fn': (lambda s, b, _N=N, _Kx=Kx, _Ky=Ky: family_b(s, b, _N, _Kx, _Ky)),
        })
    # C
    for sm in [10, 14]:
        for K in [1, 3, 5]:
            cands.append({
                'name': f'C_s{sm}_Kx{K}', 'family': 'C', 'params': f'EMA({sm}) Kx={K} Ky={K}',
                'fn': (lambda s, b, _N=N, _K=K, _sm=sm: family_c(s, b, _N, _K, _K, _sm)),
            })
    # D
    for Nd, Md in [(N, M), (26, 14), (13, 7)]:
        cands.append({
            'name': f'D_N{Nd}_M{Md}', 'family': 'D', 'params': f'N={Nd} M={Md}',
            'fn': (lambda s, b, _N=Nd, _M=Md: family_d(s, b, _N, _M)),
        })
    return cands

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    def _load(sym):
        try:
            return load_daily(sym, lookback_days=2200)
        except TypeError:
            return load_daily(sym)

    print('Loading data...')
    bench_raw = _load(BENCH)
    bench_w   = bench_raw.resample('W-FRI').last().dropna()
    bench_d   = bench_raw.iloc[-LB_DAILY:]
    print(f'  SPY: {len(bench_w)} weekly, {len(bench_d)} daily bars')

    sym_w, sym_d = {}, {}
    for sym in SYMS:
        raw = _load(sym)
        if raw is None:
            print(f'  {sym}: no data')
            continue
        sym_w[sym] = raw.resample('W-FRI').last().dropna()
        sym_d[sym] = raw.iloc[-LB_DAILY:]
        print(f'  {sym}: {len(sym_w[sym])} weekly, {len(sym_d[sym])} daily bars')

    weekly_cands = make_candidates(N_W, M_W)
    daily_cands  = make_candidates(N_D, M_D)

    def run_all(cands, sym_data, bench_close, sc_ref, label):
        print(f'\n=== {label} ===')
        results = []
        for c in cands:
            computed = run_candidate(c['fn'], sym_data, bench_close)
            s = score_result(computed, sc_ref)
            s.update({'name': c['name'], 'family': c['family'], 'params': c['params']})
            s['computed'] = {sym: {'x': round(v[0], 3), 'y': round(v[1], 3)} for sym, v in computed.items()}
            results.append(s)
            if 'quad_score' in s:
                print(f'  {c["name"]:22s}: total={s["total"]:5.1f}  quad={s["quad_score"]:4.1f}'
                      f'  tail={s["tail_score"]:4.1f}  coord={s["coord_score"]:4.1f}'
                      f'  rmse={s["rmse"]:5.2f}  tau=({s.get("tau_x",0):.2f},{s.get("tau_y",0):.2f})')
            else:
                print(f'  {c["name"]:22s}: total={s["total"]:5.1f}  {s.get("error","?")}')

        return results

    wr = run_all(weekly_cands, sym_w, bench_w, SC_WEEKLY, 'Weekly')
    dr = run_all(daily_cands,  sym_d, bench_d, SC_DAILY,  'Daily')

    best_w = max(wr, key=lambda r: r['total'])
    best_d = max(dr, key=lambda r: r['total'])

    # ── Outputs ───────────────────────────────────────────────────────────────
    OUT = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(OUT, exist_ok=True)

    out_json = {
        'generated': datetime.now().isoformat(),
        'weekly': {'best': best_w, 'all': sorted(wr, key=lambda r: r['total'], reverse=True)},
        'daily':  {'best': best_d, 'all': sorted(dr, key=lambda r: r['total'], reverse=True)},
    }
    jp = os.path.join(OUT, 'rrg_reference_study_results.json')
    with open(jp, 'w', encoding='utf-8') as f:
        json.dump(out_json, f, indent=2, ensure_ascii=False)

    # ── MD ────────────────────────────────────────────────────────────────────
    same_fam = best_w['family'] == best_d['family']
    same_name = best_w['name'] == best_d['name']

    top_score = max(best_w['total'], best_d['total'])
    if top_score >= 70 and same_fam:
        verdict = 'RRG_REFERENCE_STUDY_BEST_FOUND'
    elif top_score >= 55:
        verdict = 'RRG_REFERENCE_STUDY_BEST_FOUND'
    elif top_score >= 40:
        verdict = 'RRG_REFERENCE_STUDY_NEEDS_MORE_REFERENCE'
    else:
        verdict = 'RRG_REFERENCE_STUDY_INCONCLUSIVE'

    def sym_table(best, sc_ref, title):
        lines = [f'\n### {title}\n\n']
        lines.append('| Symbol | SC X | SC Y | SC Quad | Comp X | Comp Y | Comp Quad | Pts |\n')
        lines.append('|--------|------|------|---------|--------|--------|-----------|-----|\n')
        for sym in SYMS:
            if sym not in sc_ref: continue
            sx, sy, eq = sc_ref[sym]
            det = best.get('quad_details', {}).get(sym, {})
            cx = best['computed'].get(sym, {}).get('x', '?')
            cy = best['computed'].get(sym, {}).get('y', '?')
            cq = det.get('computed', '?')
            pts = det.get('pts', '?')
            lines.append(f'| {sym:5s} | {sx:5.1f} | {sy:5.1f} | {eq:10s} | {cx!s:6} | {cy!s:6} | {cq:10s} | {pts} |\n')
        return lines

    def rank_table(results):
        lines = ['| Rank | Name | Fam | Total | Quad | Tail | Coord | RMSE | TauX | TauY | SpX | SpY |\n',
                 '|------|------|-----|-------|------|------|-------|------|------|------|-----|-----|\n']
        for i, r in enumerate(sorted(results, key=lambda x: x['total'], reverse=True), 1):
            lines.append(f'| {i:2d} | {r["name"]:22s} | {r["family"]} | {r["total"]:5.1f} '
                         f'| {r["quad_score"]:4.1f} | {r["tail_score"]:4.1f} | {r["coord_score"]:4.1f} '
                         f'| {r["rmse"]:5.2f} | {r.get("tau_x",0):5.2f} | {r.get("tau_y",0):5.2f} '
                         f'| {r.get("spread_x",0):4.1f} | {r.get("spread_y",0):4.1f} |\n')
        return lines

    md = ['# RRG Formula Study vs StockCharts Reference\n\n',
          f'Generated: {datetime.now().strftime("%Y-%m-%d")}\n\n',
          '## Scoring\n',
          '- 40% Quadrant match\n',
          '- 25% Tail direction (position-side agreement + movement)\n',
          '- 20% Coordinate RMSE (0 = max 20pts, 10 units = 0pts)\n',
          '- 10% Relative ordering (Kendall tau X+Y)\n',
          '- 5%  Compression / expansion penalty\n\n',
          '---\n\n## Weekly Results\n\n',
          f'**Best: `{best_w["name"]}` ({best_w["params"]}) — Score {best_w["total"]}**\n\n']
    md += rank_table(wr)
    md += sym_table(best_w, SC_WEEKLY, f'Weekly Best: {best_w["name"]}')

    md += ['\n---\n\n## Daily Results\n\n',
           f'**Best: `{best_d["name"]}` ({best_d["params"]}) — Score {best_d["total"]}**\n\n']
    md += rank_table(dr)
    md += sym_table(best_d, SC_DAILY, f'Daily Best: {best_d["name"]}')

    md += ['\n---\n\n## Analysis\n\n',
           f'- Weekly best: **{best_w["family"]}** `{best_w["name"]}` score={best_w["total"]}\n',
           f'- Daily  best: **{best_d["family"]}** `{best_d["name"]}` score={best_d["total"]}\n',
           f'- Same family: **{"YES" if same_fam else "NO"}**\n',
           f'- Same config: **{"YES" if same_name else "NO"}**\n\n']

    failed_w = [r["name"] for r in wr if r["total"] < 40]
    failed_d = [r["name"] for r in dr if r["total"] < 40]
    if failed_w:
        md.append(f'Failed weekly (<40): {", ".join(failed_w)}\n\n')
    if failed_d:
        md.append(f'Failed daily  (<40): {", ".join(failed_d)}\n\n')

    md += ['\n## Recommendation\n\n',
           f'**MarketFlow RRG v1 formula: Family {best_w["family"]} (`{best_w["params"]}`)**\n\n']
    if same_fam:
        md.append('Single formula family works for both daily and weekly — adjust N/M preset only.\n\n')
    else:
        md.append(f'Weekly: Family {best_w["family"]} ({best_w["params"]})\n')
        md.append(f'Daily:  Family {best_d["family"]} ({best_d["params"]})\n\n')
    md.append('UI must expose Daily / Weekly only. Engine is internal.\n\n')
    md.append(f'`{verdict}`\n')

    mp = os.path.join(OUT, 'RRG_STOCKCHARTS_REFERENCE_STUDY.md')
    with open(mp, 'w', encoding='utf-8') as f:
        f.writelines(md)

    print(f'\nJSON: {jp}')
    print(f'MD:   {mp}')
    print(f'\nWeekly best: {best_w["name"]}  score={best_w["total"]}')
    print(f'Daily  best: {best_d["name"]}  score={best_d["total"]}')
    print(f'Verdict: {verdict}')
    return out_json

if __name__ == '__main__':
    main()
