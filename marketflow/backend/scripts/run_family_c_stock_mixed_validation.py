"""
Family C Stock + Mixed Universe Validation
Tests EMA-smoothed RS z-score (Family C) with Kx/Ky grid against
individual stocks (XLK/XLE/XLV) and mixed universe.

Thresholds (per WORK ORDER):
  Soft warning : X or Y outside 70~130
  Hard fail    : X or Y outside 60~140
  Product target: most symbols inside 85~115

Grid:
  Daily:  N=65, EMA=10, Kx=[1,2,3], Ky=[1,2,3], shift=1
  Weekly: N=52, EMA=10, Kx=[1,2,3], Ky=[1,2,3], shift=1
"""
import sys, os, json, math
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from rrg_calculator import load_daily
from rrg_presets import EPSILON

# ── Universes ──────────────────────────────────────────────────────────────────
UNIVERSES = {
    'XLK': ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD', 'QCOM', 'ORCL', 'CRM', 'CSCO', 'ADI'],
    'XLE': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX'],
    'XLV': ['LLY', 'UNH', 'JNJ', 'MRK', 'ABBV', 'TMO', 'ABT', 'ISRG'],
    'Mixed': ['TSLA', 'NVDA', 'AMZN', 'AAPL', 'XLK', 'XLE', 'XLV', 'XLF', 'QQQ', 'IWM'],
}
BENCH  = 'SPY'
TAIL_N = 7

# ── Grid ───────────────────────────────────────────────────────────────────────
DAILY_N,  DAILY_EMA  = 65, 10
WEEKLY_N, WEEKLY_EMA = 52, 10
KX_GRID = [1, 2, 3]
KY_GRID = [1, 2, 3]

# ── Thresholds ──────────────────────────────────────────────────────────────────
SOFT_LO, SOFT_HI  = 70.0, 130.0
HARD_LO, HARD_HI  = 60.0, 140.0
TARGET_LO, TARGET_HI = 85.0, 115.0

# ── Formula ────────────────────────────────────────────────────────────────────
def prep(sc, bc):
    common = sc.index.intersection(bc.index)
    s, b = sc.loc[common], bc.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    return s[mask], b[mask]

def fam_c(sc, bc, N, Kx, Ky, smooth=10):
    s, b = prep(sc, bc)
    RS   = 100.0 * s / b
    RSs  = RS.ewm(span=smooth, adjust=False).mean()
    rs_m = RSs.rolling(N, min_periods=N).mean().shift(1)
    rs_s = RSs.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RSs - rs_m) / rs_s
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    return RSR, 100.0 + Ky * (ROC - ro_m) / ro_s

def classify(x, y):
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y >= 100: return 'improving'
    return 'lagging'

def warn_level(x, y):
    if x < HARD_LO or x > HARD_HI or y < HARD_LO or y > HARD_HI:
        return 'HARD'
    if x < SOFT_LO or x > SOFT_HI or y < SOFT_LO or y > SOFT_HI:
        return 'SOFT'
    return ''

# ── Compute positions for one preset ─────────────────────────────────────────
def compute(sym_data, bench_daily, N, Kx, Ky, EMA, timeframe):
    if timeframe == 'weekly':
        bench = bench_daily.resample('W-FRI').last().dropna()
        sdata = {s: v.resample('W-FRI').last().dropna() for s, v in sym_data.items()}
    else:
        bench = bench_daily
        sdata = sym_data

    results = []
    for sym, close in sdata.items():
        try:
            rsr, rsm = fam_c(close, bench, N, Kx, Ky, EMA)
            df = pd.DataFrame({'x': rsr, 'y': rsm}).dropna()
            if len(df) < max(N, TAIL_N) + 5:
                results.append({'symbol': sym, 'x': None, 'y': None,
                                'quadrant': 'insufficient', 'warn': 'NO_DATA'})
                continue
            x = float(df['x'].iloc[-1])
            y = float(df['y'].iloc[-1])
            trail = [(float(r['x']), float(r['y'])) for _, r in df.iloc[-TAIL_N:].iterrows()]
            dx = trail[-1][0] - trail[0][0]
            dy = trail[-1][1] - trail[0][1]
            wl = warn_level(x, y)
            results.append({
                'symbol': sym, 'x': round(x, 2), 'y': round(y, 2),
                'quadrant': classify(x, y),
                'tail_dx': round(dx, 3), 'tail_dy': round(dy, 3),
                'trail': [(round(a, 2), round(b, 2)) for a, b in trail],
                'warn': wl,
            })
        except Exception as e:
            results.append({'symbol': sym, 'x': None, 'y': None,
                            'quadrant': 'error', 'warn': f'ERR:{e}'})
    return results

# ── Score a preset across all universes ───────────────────────────────────────
def score_preset(universe_results):
    """
    Returns (score, metrics_dict).
    Higher = better.
    Penalties: hard fails > soft warns > not in 85~115.
    """
    total, hard, soft, in_target, n_valid = 0, 0, 0, 0, 0
    xs = []
    for results in universe_results.values():
        for r in results:
            if r['x'] is None: continue
            n_valid += 1
            xs.append(r['x'])
            wl = r['warn']
            if wl == 'HARD': hard += 1
            elif wl == 'SOFT': soft += 1
            if TARGET_LO <= r['x'] <= TARGET_HI and TARGET_LO <= r['y'] <= TARGET_HI:
                in_target += 1

    x_spread = (max(xs) - min(xs)) if len(xs) >= 2 else 0
    collapse = x_spread < 3.0

    score = 100.0
    score -= hard * 15.0
    score -= soft * 5.0
    score += (in_target / n_valid * 20.0) if n_valid else 0
    if collapse: score -= 20.0

    return round(score, 2), {
        'n_valid': n_valid, 'hard': hard, 'soft': soft,
        'in_target': in_target, 'x_spread': round(x_spread, 2), 'collapse': collapse,
    }

# ── Main ────────────────────────────────────────────────────────────────────────
def main():
    all_syms = set(s for syms in UNIVERSES.values() for s in syms) | {BENCH}
    print(f"Loading {len(all_syms)} symbols...")
    bench = load_daily(BENCH, lookback_days=2200)
    if bench is None:
        print("ERROR: SPY not found"); sys.exit(1)

    sym_data = {}
    failed = []
    for sym in all_syms - {BENCH}:
        d = load_daily(sym, lookback_days=2200)
        if d is not None and len(d) >= 300:
            sym_data[sym] = d
        else:
            failed.append(sym)
    print(f"  OK: {len(sym_data)} | Failed: {failed or 'none'}")

    best = {}   # keyed by timeframe
    grid_results = {}

    for timeframe, N, EMA in [('weekly', WEEKLY_N, WEEKLY_EMA), ('daily', DAILY_N, DAILY_EMA)]:
        print(f"\n=== {timeframe.upper()} (N={N}, EMA={EMA}) ===")
        grid_results[timeframe] = []
        best_score, best_cfg, best_universe_results = -999, None, None

        for Kx in KX_GRID:
            for Ky in KY_GRID:
                cfg_name = f"C_s{EMA}_N{N}_Kx{Kx}_Ky{Ky}"
                universe_results = {}
                for uni, symbols in UNIVERSES.items():
                    udata = {s: sym_data[s] for s in symbols if s in sym_data}
                    universe_results[uni] = compute(udata, bench, N, Kx, Ky, EMA, timeframe)

                sc, metrics = score_preset(universe_results)
                grid_results[timeframe].append({
                    'name': cfg_name, 'Kx': Kx, 'Ky': Ky, 'score': sc, 'metrics': metrics,
                })
                print(f"  {cfg_name:30s} score={sc:6.1f}  "
                      f"hard={metrics['hard']} soft={metrics['soft']} "
                      f"target={metrics['in_target']}/{metrics['n_valid']} "
                      f"spread={metrics['x_spread']:.1f}")

                if sc > best_score:
                    best_score, best_cfg = sc, cfg_name
                    best_universe_results = universe_results

        best[timeframe] = {
            'name': best_cfg, 'score': best_score,
            'universe_results': best_universe_results,
        }
        print(f"\n  Best {timeframe}: {best_cfg} (score={best_score})")
        for uni, results in best_universe_results.items():
            print(f"    [{uni}]")
            for r in results:
                if r['x'] is None:
                    print(f"      {r['symbol']:6s}  NO DATA"); continue
                w = f"  [{r['warn']}]" if r['warn'] else ''
                print(f"      {r['symbol']:6s}  X={r['x']:7.2f}  Y={r['y']:7.2f}"
                      f"  {r['quadrant']:12s}{w}")

    # ── Overall verdict ──────────────────────────────────────────────────────────
    total_hard = sum(best[tf]['score'] for tf in best)   # actually we check metrics
    any_hard = any(
        r['warn'] == 'HARD'
        for tf in best
        for uni_res in best[tf]['universe_results'].values()
        for r in uni_res if r['x'] is not None
    )
    any_soft = any(
        r['warn'] == 'SOFT'
        for tf in best
        for uni_res in best[tf]['universe_results'].values()
        for r in uni_res if r['x'] is not None
    )

    if any_hard:
        verdict = 'FAMILY_C_STOCK_MIXED_FAIL'
    elif any_soft:
        verdict = 'FAMILY_C_STOCK_MIXED_PASS_WITH_WARNINGS'
    else:
        verdict = 'FAMILY_C_STOCK_MIXED_PASS'

    print(f"\nVerdict: {verdict}")

    # ── Write output ─────────────────────────────────────────────────────────────
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, 'rrg_family_c_stock_mixed_validation.json')
    md_path   = os.path.join(out_dir, 'RRG_FAMILY_C_STOCK_MIXED_VALIDATION.md')

    json_out = {
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'grid': grid_results,
        'best': {
            tf: {
                'name': best[tf]['name'],
                'score': best[tf]['score'],
                'universe_results': {
                    uni: res for uni, res in best[tf]['universe_results'].items()
                }
            } for tf in best
        },
        'verdict': verdict,
    }
    with open(json_path, 'w') as f:
        json.dump(json_out, f, indent=2)

    # ── Markdown ─────────────────────────────────────────────────────────────────
    lines = [
        '# RRG Family C — Stock + Mixed Universe Validation',
        '',
        f'Generated: {datetime.now().strftime("%Y-%m-%d")}',
        '',
        '## Policy',
        '- Sector ETFs: Family D (D_N65_M10 daily, D_N52_M5 weekly)',
        '- Individual stocks / mixed: Family C (EMA z-score, Kx/Ky control)',
        '',
        '## Thresholds',
        '- Soft warning: X or Y outside 70~130',
        '- Hard fail: X or Y outside 60~140',
        '- Product target: most symbols inside 85~115',
        '',
        '## Grid Results',
        '',
    ]

    for timeframe in ['weekly', 'daily']:
        lines.append(f'### {timeframe.capitalize()} Grid')
        lines.append('')
        lines.append('| Config | Score | Hard | Soft | In-target | X-spread | Collapse |')
        lines.append('|--------|-------|------|------|-----------|----------|----------|')
        for row in grid_results[timeframe]:
            m = row['metrics']
            lines.append(
                f"| {row['name']} | {row['score']} | {m['hard']} | {m['soft']} | "
                f"{m['in_target']}/{m['n_valid']} | {m['x_spread']:.1f} | {'YES' if m['collapse'] else 'NO'} |"
            )
        lines.append('')

    lines += ['## Best Presets', '']
    for timeframe in ['weekly', 'daily']:
        b = best[timeframe]
        lines.append(f'- **{timeframe.capitalize()}**: `{b["name"]}` score={b["score"]}')
    lines.append('')

    lines += ['## Per-Symbol Detail (Best Preset)', '']
    lines += ['| Universe | Symbol | Timeframe | X | Y | Quadrant | Warn |',
              '|----------|--------|-----------|---|---|----------|------|']
    for timeframe in ['weekly', 'daily']:
        for uni, results in best[timeframe]['universe_results'].items():
            for r in results:
                x_s = f"{r['x']:.2f}" if r['x'] is not None else 'N/A'
                y_s = f"{r['y']:.2f}" if r['y'] is not None else 'N/A'
                lines.append(
                    f"| {uni} | {r['symbol']} | {timeframe} | {x_s} | {y_s} | "
                    f"{r['quadrant']} | {r['warn'] or '—'} |"
                )
    lines.append('')

    # Analysis
    lines += ['## Analysis', '']
    for timeframe in ['weekly', 'daily']:
        b = best[timeframe]
        lines.append(f'### {timeframe.capitalize()} — {b["name"]}')
        for uni, results in b['universe_results'].items():
            valid = [r for r in results if r['x'] is not None]
            if not valid: continue
            xs = [r['x'] for r in valid]
            hards = [r['symbol'] for r in valid if r['warn'] == 'HARD']
            softs = [r['symbol'] for r in valid if r['warn'] == 'SOFT']
            in_t  = sum(1 for r in valid
                        if TARGET_LO <= r['x'] <= TARGET_HI and TARGET_LO <= r['y'] <= TARGET_HI)
            quads = {}
            for r in valid:
                quads[r['quadrant']] = quads.get(r['quadrant'], 0) + 1
            lines.append(
                f'- **{uni}**: spread={max(xs)-min(xs):.1f} | '
                f'in-target={in_t}/{len(valid)} | quads={quads}'
            )
            if hards: lines.append(f'  - HARD: {hards}')
            if softs: lines.append(f'  - SOFT: {softs}')
        lines.append('')

    # Recommendation
    lines += ['## Recommendation', '']
    if verdict == 'FAMILY_C_STOCK_MIXED_PASS':
        lines.append('Family C is suitable for individual stocks and mixed universe.')
        lines.append(f'- Daily preset: `{best["daily"]["name"]}`')
        lines.append(f'- Weekly preset: `{best["weekly"]["name"]}`')
        lines.append('- No display clipping required.')
    elif verdict == 'FAMILY_C_STOCK_MIXED_PASS_WITH_WARNINGS':
        lines.append('Family C is acceptable with soft-range warnings.')
        lines.append(f'- Daily preset: `{best["daily"]["name"]}`')
        lines.append(f'- Weekly preset: `{best["weekly"]["name"]}`')
        lines.append('- Consider display-only clipping to 70~130 for UX polish.')
        lines.append('- Do NOT engine-level clip; let data speak.')
    else:
        lines.append('Family C at current Kx/Ky cannot contain individual stock RS extremes.')
        lines.append('Options:')
        lines.append('  1. Lower Kx further (Kx=0.5?) — test in next iteration')
        lines.append('  2. Display-only clipping to 70~130 with annotation for extreme symbols')
        lines.append('  3. Accept hard-fail symbols as legitimate outliers (AMD is genuinely extreme)')

    lines += ['', '---', '', f'## Verdict', '', f'`{verdict}`']

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"JSON: {os.path.abspath(json_path)}")
    print(f"MD:   {os.path.abspath(md_path)}")

if __name__ == '__main__':
    main()
