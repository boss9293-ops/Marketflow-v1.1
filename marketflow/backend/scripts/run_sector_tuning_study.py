"""
Sector-First RRG Tuning Study
Benchmarks 4 formula families (A/B/C/D) against expected sector RRG positions.
Primary target: Weekly sector structure. Secondary: Daily.

Scoring (per WORK ORDER):
  45% quadrant match
  25% tail direction
  15% relative ordering (Kendall tau on X-axis expected rank)
  10% coordinate RMSE (anchor symbols only)
   5% compression/expansion

Output:
  output/rrg/RRG_SECTOR_FIRST_TUNING_STUDY.md
  output/rrg/rrg_sector_first_tuning_results.json
"""
import sys, os, json, math
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from rrg_calculator import load_daily
from rrg_presets import EPSILON

# ── Constants ─────────────────────────────────────────────────────────────────
SYMS  = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC']
BENCH = 'SPY'
N_W, M_W = 52, 5
N_D, M_D = 65, 10
BOUNDARY  = 0.5

# ── Reference: (expected_quad, approx_x or None, approx_y or None) ────────────
# XLE weekly: Y≈100 → accept leading, weakening, or boundary
DAILY_REF = {
    'XLK':  ('leading',    104.0, 100.5),
    'XLE':  ('improving',   94.5, 102.0),
    'XLU':  ('boundary',    None,  None),
    'XLP':  ('boundary',    None,  None),
    'XLV':  ('lagging',     None,  None),
    'XLF':  ('lagging',     None,  None),
    'XLY':  ('lagging',     None,  None),
    'XLI':  ('lagging',     None,  None),
    'XLB':  ('lagging',     None,  None),
    'XLRE': ('lagging',     None,  None),
    'XLC':  ('lagging',     None,  None),
}

WEEKLY_REF = {
    'XLE':  ('right_side', 114.5, 100.0),  # leading/weakening boundary, accept both
    'XLK':  ('leading',    101.0, 102.0),
    'XLU':  ('boundary',    None,  None),
    'XLRE': ('boundary',    None,  None),
    'XLI':  ('weakening',   None,  None),
    'XLP':  ('weakening',   None,  None),
    'XLB':  ('weakening',   None,  None),
    'XLV':  ('lagging',     None,  None),
    'XLY':  ('lagging',     None,  None),
    'XLC':  ('lagging',     None,  None),
    'XLF':  ('lagging',     None,  None),
}

# Expected X-axis ranks (higher = further right) — for Kendall tau
# Tied ranks for uncertain relative ordering within a group
DAILY_RANK  = {'XLE': 1,  'XLU': 5, 'XLP': 5, 'XLV': 5, 'XLF': 5,
               'XLY': 5,  'XLI': 5, 'XLB': 5, 'XLRE': 5, 'XLC': 5, 'XLK': 11}
WEEKLY_RANK = {'XLV': 1,  'XLC': 2, 'XLY': 2, 'XLF': 2, 'XLI': 5,
               'XLP': 5,  'XLB': 5, 'XLU': 7, 'XLRE': 7, 'XLK': 9, 'XLE': 11}

# ── Classification ────────────────────────────────────────────────────────────
def classify(x, y):
    if abs(x - 100) < BOUNDARY or abs(y - 100) < BOUNDARY: return 'boundary'
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y <  100: return 'lagging'
    return 'improving'

def classify_strict(x, y):
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y <  100: return 'lagging'
    return 'improving'

def kendall_tau_ranked(comp_xs, expected_ranks, syms):
    """Kendall tau ignoring tied expected-rank pairs."""
    n = len(syms)
    c = d = t = 0
    for i in range(n):
        for j in range(i + 1, n):
            er_i = expected_ranks.get(syms[i], 5)
            er_j = expected_ranks.get(syms[j], 5)
            if er_i == er_j:
                t += 1
                continue
            p = (comp_xs[i] - comp_xs[j]) * (er_i - er_j)
            if p > 0: c += 1
            elif p < 0: d += 1
    denom = n * (n - 1) / 2 - t
    return (c - d) / denom if denom > 0 else 0.0

# ── Quadrant match (45%) ──────────────────────────────────────────────────────
def quad_pts(sym, cx, cy, ref_dict):
    eq, ax, ay = ref_dict[sym]
    cq = classify(cx, cy)
    if eq == 'boundary':
        return 1.0 if (abs(cx - 100) <= 1.5 or abs(cy - 100) <= 1.5) else \
               0.5 if cq == classify_strict(ax or 100, ay or 100) else 0.0
    if eq == 'right_side':
        return 1.0 if cq in ('leading', 'weakening', 'boundary') else 0.0
    if cq == eq: return 1.0
    if cq == 'boundary': return 0.5
    return 0.0

# ── Tail direction (25%) ──────────────────────────────────────────────────────
def tail_pts(sym, cx, cy, trail, ref_dict):
    eq, ax, ay = ref_dict[sym]
    # Expected side from anchor or quad
    if eq == 'right_side':
        exp_x_right, exp_y_right = True, None  # x > 100 expected
    elif eq == 'leading':
        exp_x_right, exp_y_right = True, True
    elif eq == 'weakening':
        exp_x_right, exp_y_right = True, False
    elif eq == 'improving':
        exp_x_right, exp_y_right = False, True
    elif eq == 'lagging':
        exp_x_right, exp_y_right = False, False
    else:  # boundary
        exp_x_right, exp_y_right = None, None

    x_ok = (exp_x_right is None) or ((cx >= 100) == exp_x_right)
    y_ok = (exp_y_right is None) or ((cy >= 100) == exp_y_right)

    if x_ok and y_ok: return 1.0
    if x_ok or y_ok:
        bonus = 0.0
        if len(trail) >= 2:
            dx = trail[-1][0] - trail[-2][0]
            dy = trail[-1][1] - trail[-2][1]
            if not x_ok and exp_x_right is not None:
                bonus = 0.2 if (exp_x_right and dx > 0) or (not exp_x_right and dx < 0) else 0.0
            elif not y_ok and exp_y_right is not None:
                bonus = 0.2 if (exp_y_right and dy > 0) or (not exp_y_right and dy < 0) else 0.0
        return 0.7 + bonus
    # wrong on both axes
    if len(trail) >= 2:
        dx = trail[-1][0] - trail[-2][0]
        dy = trail[-1][1] - trail[-2][1]
        xm = exp_x_right is None or (exp_x_right and dx > 0) or (not exp_x_right and dx < 0)
        ym = exp_y_right is None or (exp_y_right and dy > 0) or (not exp_y_right and dy < 0)
        return 0.3 if (xm and ym) else 0.15 if (xm or ym) else 0.0
    return 0.0

# ── Full scorer ───────────────────────────────────────────────────────────────
def score_all(computed, ref_dict, rank_dict):
    syms = [s for s in SYMS if s in computed and s in ref_dict]
    n = len(syms)
    if n == 0: return {'total': 0, 'error': 'no_syms'}

    xs = {s: computed[s][0] for s in syms}
    ys = {s: computed[s][1] for s in syms}

    # 1. Quadrant (45%)
    qsum = sum(quad_pts(s, xs[s], ys[s], ref_dict) for s in syms)
    quad_score = qsum / n * 45.0

    # 2. Tail direction (25%)
    tsum = sum(tail_pts(s, xs[s], ys[s], computed[s][2], ref_dict) for s in syms)
    tail_score = tsum / n * 25.0

    # 3. Relative ordering (15%) — Kendall tau on X ranks
    comp_xs_list = [xs[s] for s in syms]
    tau = kendall_tau_ranked(comp_xs_list, rank_dict, syms)
    ord_score = (tau + 1.0) / 2.0 * 15.0

    # 4. Coordinate RMSE (10%) — anchor symbols only
    anchors = [(s, ref_dict[s][1], ref_dict[s][2]) for s in syms
               if ref_dict[s][1] is not None and ref_dict[s][2] is not None]
    if anchors:
        errs = [(xs[s] - ax)**2 + (ys[s] - ay)**2 for s, ax, ay in anchors]
        rmse = math.sqrt(sum(errs) / len(errs))
        coord_score = max(0.0, 10.0 - 1.0 * rmse)
    else:
        rmse, coord_score = 0.0, 10.0  # no anchors → full credit

    # 5. Compression/expansion (5%)
    x_spread = max(xs.values()) - min(xs.values())
    comp_score = 0.0 if x_spread < 2 else 2.0 if x_spread < 4 else \
                 3.5 if x_spread > 40 else 5.0

    total = quad_score + tail_score + ord_score + coord_score + comp_score

    qdets = {s: {
        'computed': classify(xs[s], ys[s]),
        'expected': ref_dict[s][0],
        'cx': round(xs[s], 2), 'cy': round(ys[s], 2),
        'pts': round(quad_pts(s, xs[s], ys[s], ref_dict), 2)
    } for s in syms}

    return {
        'total':      round(total, 2),
        'quad_score': round(quad_score, 2),
        'tail_score': round(tail_score, 2),
        'ord_score':  round(ord_score, 2),
        'coord_score':round(coord_score, 2),
        'comp_score': round(comp_score, 2),
        'rmse':       round(rmse, 3),
        'tau_x':      round(tau, 3),
        'x_spread':   round(x_spread, 2),
        'quad_details': qdets,
    }

# ── Formula families ──────────────────────────────────────────────────────────
def prep(sc, bc):
    common = sc.index.intersection(bc.index)
    s, b = sc.loc[common], bc.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    return s[mask], b[mask]

def fam_a(sc, bc, N, M, Kx=10.0, Ky=10.0):
    s, b = prep(sc, bc)
    RS = 100.0 * s / b
    rs_m = RS.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RS.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR = 100.0 + Kx * (RS - rs_m) / rs_s
    ROC = 100.0 * (RSR / RSR.shift(M) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    return RSR, 100.0 + Ky * (ROC - ro_m) / ro_s

def fam_b(sc, bc, N, Kx, Ky):
    s, b = prep(sc, bc)
    RS = 100.0 * s / b
    rs_m = RS.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RS.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR = 100.0 + Kx * (RS - rs_m) / rs_s
    ROC = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    return RSR, 100.0 + Ky * (ROC - ro_m) / ro_s

def fam_c(sc, bc, N, Kx, Ky, smooth):
    s, b = prep(sc, bc)
    RS  = 100.0 * s / b
    RSs = RS.ewm(span=smooth, adjust=False).mean()
    rs_m = RSs.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RSs.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RSs - rs_m) / rs_s
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    return RSR, 100.0 + Ky * (ROC - ro_m) / ro_s

def fam_d(sc, bc, N, M):
    s, b = prep(sc, bc)
    RS  = 100.0 * s / b
    RSR = 100.0 * RS  / RS.rolling(N, min_periods=N).mean()
    return RSR, 100.0 * RSR / RSR.rolling(M, min_periods=M).mean()

# ── Runner ────────────────────────────────────────────────────────────────────
def run_cand(fn, sym_data, bench, tail_n=8):
    out = {}
    for sym, close in sym_data.items():
        try:
            rsr, rsm = fn(close, bench)
            df = pd.DataFrame({'x': rsr, 'y': rsm}).dropna()
            if len(df) < 2: continue
            x = float(df['x'].iloc[-1])
            y = float(df['y'].iloc[-1])
            trail = [(float(r['x']), float(r['y'])) for _, r in df.iloc[-(tail_n+1):].iterrows()]
            out[sym] = (x, y, trail)
        except Exception:
            pass
    return out

# ── Candidate factory ─────────────────────────────────────────────────────────
def build_candidates(N, M):
    cands = []
    # A
    cands.append({'name': 'A_Kx10', 'family': 'A', 'params': f'Kx=10 shift({M})',
                  'fn': lambda s, b, _N=N, _M=M: fam_a(s, b, _N, _M, 10, 10)})
    # B
    for K in [1, 3, 5]:
        cands.append({'name': f'B_Kx{K}', 'family': 'B', 'params': f'Kx={K} Ky={K} shift(1)',
                      'fn': (lambda s, b, _N=N, _K=K: fam_b(s, b, _N, _K, _K))})
    # C — primary grid
    kx_grid = [1, 2, 3, 4, 5] if N == N_W else [1, 2, 3, 4]
    for sm in [10, 14]:
        for Kx in kx_grid:
            for Ky in [1, 2, 3]:
                cands.append({
                    'name': f'C_s{sm}_Kx{Kx}_Ky{Ky}', 'family': 'C',
                    'params': f'EMA({sm}) Kx={Kx} Ky={Ky}',
                    'fn': (lambda s, b, _N=N, _Kx=Kx, _Ky=Ky, _sm=sm:
                           fam_c(s, b, _N, _Kx, _Ky, _sm))
                })
    # D
    for Nd, Md in [(N, M), (26, 14)]:
        cands.append({'name': f'D_N{Nd}_M{Md}', 'family': 'D', 'params': f'N={Nd} M={Md}',
                      'fn': (lambda s, b, _N=Nd, _M=Md: fam_d(s, b, _N, _M))})
    return cands

# ── Tail count verification ───────────────────────────────────────────────────
def verify_tail(computed, tail_n=7):
    issues = []
    for sym, (x, y, trail) in computed.items():
        # trail = last tail_n+1 raw points; displayed trail = trail[:-1] (6 historical) + current (1)
        visible = len(trail) - 1  # previous points (excluding latest)
        if visible < tail_n - 1:
            issues.append(f'{sym}: only {visible} trail points (want {tail_n-1})')
    return issues

# ── Helpers ───────────────────────────────────────────────────────────────────
def _load(sym, days=2200):
    try:
        return load_daily(sym, lookback_days=days)
    except TypeError:
        return load_daily(sym)

def fmt_row(sym, cx, cy, ref, trail):
    eq, ax, ay = ref.get(sym, ('?', None, None))
    cq = classify(cx, cy)
    dx = f'{cx - ax:+.1f}' if ax else '  n/a'
    dy = f'{cy - ay:+.1f}' if ay else '  n/a'
    pts = quad_pts(sym, cx, cy, ref) if sym in ref else '?'
    match = 'OK' if pts == 1.0 else ('~' if pts >= 0.5 else '--')
    return (f'  {sym:4s} | {cx:7.2f} {cy:7.2f} | '
            f'{ax or "  n/a":>7} {ay or "  n/a":>7} | '
            f'{dx:>6} {dy:>6} | {cq:10s} {eq:11s} | {match}')

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print('Loading data (lookback=2200 days for weekly, slice -700 for daily)...')
    bench_raw = _load(BENCH, 2200)
    bench_w   = bench_raw.resample('W-FRI').last().dropna()
    bench_d   = bench_raw.iloc[-700:]
    print(f'  SPY: {len(bench_w)} weekly, {len(bench_d)} daily bars')

    sym_w, sym_d = {}, {}
    for sym in SYMS:
        raw = _load(sym, 2200)
        if raw is None:
            print(f'  {sym}: no data')
            continue
        sym_w[sym] = raw.resample('W-FRI').last().dropna()
        sym_d[sym] = raw.iloc[-700:]
    print(f'  Loaded {len(sym_w)} symbols')

    w_cands = build_candidates(N_W, M_W)
    d_cands = build_candidates(N_D, M_D)

    def run_all(cands, sym_data, bench_close, ref_dict, rank_dict, label):
        print(f'\n=== {label} ({len(cands)} candidates) ===')
        results = []
        for c in cands:
            computed = run_cand(c['fn'], sym_data, bench_close)
            s = score_all(computed, ref_dict, rank_dict)
            s.update({'name': c['name'], 'family': c['family'], 'params': c['params']})
            s['computed'] = {sym: {'x': round(v[0], 3), 'y': round(v[1], 3)} for sym, v in computed.items()}
            results.append(s)
            if 'quad_score' in s:
                print(f'  {c["name"]:22s}: {s["total"]:5.1f}  Q={s["quad_score"]:4.1f}'
                      f'  T={s["tail_score"]:4.1f}  O={s["ord_score"]:4.1f}'
                      f'  C={s["coord_score"]:4.1f}  Sp={s.get("x_spread",0):.1f}')
            else:
                print(f'  {c["name"]:22s}: failed')
        return results

    wr = run_all(w_cands, sym_w, bench_w, WEEKLY_REF, WEEKLY_RANK, 'Weekly')
    dr = run_all(d_cands, sym_d, bench_d, DAILY_REF,  DAILY_RANK,  'Daily')

    best_w = max(wr, key=lambda r: r.get('total', 0))
    best_d = max(dr, key=lambda r: r.get('total', 0))

    print(f'\nWeekly best: {best_w["name"]}  score={best_w["total"]}')
    print(f'Daily  best: {best_d["name"]}  score={best_d["total"]}')

    # ── Tail verification ─────────────────────────────────────────────────────
    computed_best_w = run_cand(
        next(c['fn'] for c in w_cands if c['name'] == best_w['name']),
        sym_w, bench_w)
    computed_best_d = run_cand(
        next(c['fn'] for c in d_cands if c['name'] == best_d['name']),
        sym_d, bench_d)

    tail_issues_w = verify_tail(computed_best_w)
    tail_issues_d = verify_tail(computed_best_d)

    # ── Family comparison (best per family) ───────────────────────────────────
    fam_best_w = {}
    for r in wr:
        fam = r.get('family', '?')
        if fam not in fam_best_w or r.get('total', 0) > fam_best_w[fam].get('total', 0):
            fam_best_w[fam] = r
    fam_best_d = {}
    for r in dr:
        fam = r.get('family', '?')
        if fam not in fam_best_d or r.get('total', 0) > fam_best_d[fam].get('total', 0):
            fam_best_d[fam] = r

    # ── Verdict ───────────────────────────────────────────────────────────────
    same_fam  = best_w.get('family') == best_d.get('family')
    same_name = best_w.get('name')   == best_d.get('name')
    top_score = max(best_w.get('total', 0), best_d.get('total', 0))
    min_score = min(best_w.get('total', 0), best_d.get('total', 0))

    issues = tail_issues_w + tail_issues_d
    if top_score >= 75 and min_score >= 65:
        verdict = 'SECTOR_FIRST_TUNING_PASS' if not issues else 'SECTOR_FIRST_TUNING_PASS_WITH_WARNINGS'
    elif top_score >= 60:
        verdict = 'SECTOR_FIRST_TUNING_PASS_WITH_WARNINGS'
    else:
        verdict = 'SECTOR_FIRST_TUNING_FAIL'

    # ── Write outputs ─────────────────────────────────────────────────────────
    OUT = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(OUT, exist_ok=True)

    # JSON
    out_json = {
        'generated': datetime.now().isoformat(),
        'weekly': {
            'best': best_w,
            'family_best': {k: {'name': v['name'], 'total': v['total'], 'params': v['params']}
                            for k, v in fam_best_w.items()},
            'all': sorted(wr, key=lambda r: r.get('total', 0), reverse=True)[:20],
        },
        'daily': {
            'best': best_d,
            'family_best': {k: {'name': v['name'], 'total': v['total'], 'params': v['params']}
                            for k, v in fam_best_d.items()},
            'all': sorted(dr, key=lambda r: r.get('total', 0), reverse=True)[:20],
        },
        'same_family': same_fam,
        'same_preset': same_name,
        'tail_issues': {'weekly': tail_issues_w, 'daily': tail_issues_d},
        'verdict': verdict,
    }
    jp = os.path.join(OUT, 'rrg_sector_first_tuning_results.json')
    with open(jp, 'w', encoding='utf-8') as f:
        json.dump(out_json, f, indent=2, ensure_ascii=False)

    # MD
    hdr = f'{"Sym":4s} | {"X":>7} {"Y":>7} | {"SC_X":>7} {"SC_Y":>7} | {"dX":>6} {"dY":>6} | {"Computed":10s} {"Expected":11s} | M'

    def residual_block(comp_data, ref, title):
        lines = [f'\n### {title}\n\n', f'  {hdr}\n', '  ' + '-'*88 + '\n']
        for sym in SYMS:
            if sym not in comp_data: continue
            cx, cy, trail = comp_data[sym]
            lines.append(fmt_row(sym, cx, cy, ref, trail) + '\n')
        return lines

    md = ['# RRG Sector-First Tuning Study\n\n',
          f'Generated: {datetime.now().strftime("%Y-%m-%d")}\n\n',
          '## Scoring Weights\n',
          '- 45% Quadrant match\n',
          '- 25% Tail direction (position-side + movement)\n',
          '- 15% Relative ordering (Kendall tau, expected X ranks)\n',
          '- 10% Coordinate RMSE (anchor symbols: XLK, XLE)\n',
          '- 5%  Compression/expansion\n\n',
          '---\n\n## Weekly Results\n\n',
          f'**Best: `{best_w["name"]}` ({best_w["params"]}) — Score {best_w["total"]}**\n\n',
          '### Family Comparison (Weekly)\n\n',
          '| Family | Best Config | Total | Quad | Tail | Ord | Coord |\n',
          '|--------|------------|-------|------|------|-----|-------|\n']
    for fam in ['A', 'B', 'C', 'D']:
        r = fam_best_w.get(fam, {})
        md.append(f'| {fam} | {r.get("name","n/a")} | {r.get("total","?")}'
                  f' | {r.get("quad_score","?")} | {r.get("tail_score","?")}'
                  f' | {r.get("ord_score","?")} | {r.get("coord_score","?")} |\n')

    md.append('\n### Top 10 Weekly\n\n')
    md.append('| Rank | Name | Total | Quad | Tail | Ord | Coord | X-Spread |\n')
    md.append('|------|------|-------|------|------|-----|-------|----------|\n')
    for i, r in enumerate(sorted(wr, key=lambda x: x.get('total', 0), reverse=True)[:10], 1):
        md.append(f'| {i:2d} | {r["name"]:25s} | {r.get("total","?")} '
                  f'| {r.get("quad_score","?")} | {r.get("tail_score","?")} '
                  f'| {r.get("ord_score","?")} | {r.get("coord_score","?")} '
                  f'| {r.get("x_spread","?")} |\n')
    md += residual_block(computed_best_w, WEEKLY_REF, f'Weekly Best Residuals: {best_w["name"]}')

    if tail_issues_w:
        md.append(f'\n**Tail Issues:** {"; ".join(tail_issues_w)}\n')

    md += ['\n---\n\n## Daily Results\n\n',
           f'**Best: `{best_d["name"]}` ({best_d["params"]}) — Score {best_d["total"]}**\n\n',
           '### Family Comparison (Daily)\n\n',
           '| Family | Best Config | Total | Quad | Tail | Ord | Coord |\n',
           '|--------|------------|-------|------|------|-----|-------|\n']
    for fam in ['A', 'B', 'C', 'D']:
        r = fam_best_d.get(fam, {})
        md.append(f'| {fam} | {r.get("name","n/a")} | {r.get("total","?")}'
                  f' | {r.get("quad_score","?")} | {r.get("tail_score","?")}'
                  f' | {r.get("ord_score","?")} | {r.get("coord_score","?")} |\n')

    md.append('\n### Top 10 Daily\n\n')
    md.append('| Rank | Name | Total | Quad | Tail | Ord | Coord | X-Spread |\n')
    md.append('|------|------|-------|------|------|-----|-------|----------|\n')
    for i, r in enumerate(sorted(dr, key=lambda x: x.get('total', 0), reverse=True)[:10], 1):
        md.append(f'| {i:2d} | {r["name"]:25s} | {r.get("total","?")} '
                  f'| {r.get("quad_score","?")} | {r.get("tail_score","?")} '
                  f'| {r.get("ord_score","?")} | {r.get("coord_score","?")} '
                  f'| {r.get("x_spread","?")} |\n')
    md += residual_block(computed_best_d, DAILY_REF, f'Daily Best Residuals: {best_d["name"]}')

    if tail_issues_d:
        md.append(f'\n**Tail Issues:** {"; ".join(tail_issues_d)}\n')

    md += ['\n---\n\n## Analysis\n\n',
           f'- Weekly best: **{best_w["family"]}** `{best_w["name"]}` score={best_w["total"]}\n',
           f'- Daily  best: **{best_d["family"]}** `{best_d["name"]}` score={best_d["total"]}\n',
           f'- Same family: **{"YES" if same_fam else "NO"}**\n',
           f'- Same config: **{"YES" if same_name else "NO"}**\n\n']

    # Family C winner?
    c_is_best_w = best_w.get('family') == 'C'
    c_is_best_d = best_d.get('family') == 'C'
    md.append(f'Family C best for weekly: **{"YES" if c_is_best_w else "NO"}**\n')
    md.append(f'Family C best for daily:  **{"YES" if c_is_best_d else "NO"}**\n\n')

    if same_fam and same_name:
        md.append('Single preset works for both daily and weekly.\n\n')
    elif same_fam:
        md.append(f'Same formula family ({best_w["family"]}); separate N/Kx/Ky presets per timeframe.\n\n')
    else:
        md.append('Different formula families for daily vs weekly.\n\n')

    md += ['\n## Recommendation (before individual stock tuning)\n\n',
           f'Weekly preset: `{best_w["name"]}` — {best_w["params"]}\n',
           f'Daily  preset: `{best_d["name"]}` — {best_d["params"]}\n\n',
           '`{}`\n'.format(verdict)]

    mp = os.path.join(OUT, 'RRG_SECTOR_FIRST_TUNING_STUDY.md')
    with open(mp, 'w', encoding='utf-8') as f:
        f.writelines(md)

    print(f'\nJSON: {jp}')
    print(f'MD:   {mp}')
    print(f'Verdict: {verdict}')
    return out_json

if __name__ == '__main__':
    main()
