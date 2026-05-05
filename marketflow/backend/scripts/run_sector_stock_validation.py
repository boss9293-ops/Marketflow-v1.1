"""
Sector-Level Individual Stock Validation
Validates Family D presets (Weekly N=52 M=5, Daily N=65 M=10)
against representative stocks inside XLK, XLE, XLV sectors.

This is VALIDATION only — no retuning, no new families.

Checks:
  - Coordinate explosion: |X-100| > 30 or |Y-100| > 30
  - Coordinate collapse: X-spread < 3
  - Quadrant distribution
  - Tail direction sanity
  - High-beta vs defensive relative positioning
"""
import sys, os, json, math
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from rrg_calculator import load_daily
from rrg_presets import EPSILON

# ── Presets ────────────────────────────────────────────────────────────────────
WEEKLY_N, WEEKLY_M = 52, 5
DAILY_N,  DAILY_M  = 65, 10
TAIL_N = 7  # tail points = 6 prior + current

# ── Universes ──────────────────────────────────────────────────────────────────
SECTORS = {
    'XLK': ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD', 'QCOM', 'ORCL', 'CRM', 'CSCO', 'ADI'],
    'XLE': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX'],
    'XLV': ['LLY', 'UNH', 'JNJ', 'MRK', 'ABBV', 'TMO', 'ABT', 'ISRG'],
}
BENCH = 'SPY'

# High-beta within each sector (should not be deep lagging if sector is leading)
HIGH_BETA = {'NVDA', 'AMD', 'XOM', 'COP', 'LLY'}
# Defensive within each sector (should not be extreme leading)
DEFENSIVE = {'CSCO', 'ADI', 'MPC', 'PSX', 'JNJ', 'ABBV', 'ABT'}

# ── Thresholds ──────────────────────────────────────────────────────────────────
EXPLOSION_THRESH = 30.0   # |X-100| or |Y-100| beyond this
COLLAPSE_SPREAD  = 3.0    # X-spread below this = collapse

# ── Formula ────────────────────────────────────────────────────────────────────
def prep(sc, bc):
    common = sc.index.intersection(bc.index)
    s, b = sc.loc[common], bc.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    return s[mask], b[mask]

def fam_d(sc, bc, N, M):
    s, b = prep(sc, bc)
    RS  = 100.0 * s / b
    RSR = 100.0 * RS  / RS.rolling(N, min_periods=N).mean()
    RSM = 100.0 * RSR / RSR.rolling(M, min_periods=M).mean()
    return RSR, RSM

def classify(x, y):
    if x >= 100 and y >= 100: return 'leading'
    if x >= 100 and y <  100: return 'weakening'
    if x <  100 and y >= 100: return 'improving'
    return 'lagging'

def tail_direction(trail):
    """Returns (dx, dy) direction from first to last trail point."""
    if len(trail) < 2:
        return 0.0, 0.0
    dx = trail[-1][0] - trail[0][0]
    dy = trail[-1][1] - trail[0][1]
    return dx, dy

# ── Load and compute ────────────────────────────────────────────────────────────
def compute_positions(sym_data, bench_daily, N, M, timeframe):
    """Compute RRG positions for all symbols. Returns list of result dicts."""
    results = []

    # For weekly: resample daily → weekly
    if timeframe == 'weekly':
        bench = bench_daily.resample('W-FRI').last().dropna()
        sym_series = {s: v.resample('W-FRI').last().dropna() for s, v in sym_data.items()}
    else:
        bench = bench_daily
        sym_series = sym_data

    for sym, close in sym_series.items():
        try:
            rsr, rsm = fam_d(close, bench, N, M)
            df = pd.DataFrame({'x': rsr, 'y': rsm}).dropna()
            if len(df) < max(N, M) + TAIL_N:
                results.append({
                    'symbol': sym, 'x': None, 'y': None,
                    'quadrant': 'insufficient_data', 'tail_dx': None, 'tail_dy': None,
                    'warning': 'INSUFFICIENT_DATA'
                })
                continue

            x = float(df['x'].iloc[-1])
            y = float(df['y'].iloc[-1])
            trail = [(float(r['x']), float(r['y'])) for _, r in df.iloc[-(TAIL_N):].iterrows()]
            quad = classify(x, y)
            dx, dy = tail_direction(trail)

            # Checks
            warnings = []
            if abs(x - 100) > EXPLOSION_THRESH:
                warnings.append(f'EXPLOSION_X({x:.1f})')
            if abs(y - 100) > EXPLOSION_THRESH:
                warnings.append(f'EXPLOSION_Y({y:.1f})')

            results.append({
                'symbol': sym,
                'x': round(x, 2),
                'y': round(y, 2),
                'quadrant': quad,
                'tail_dx': round(dx, 3),
                'tail_dy': round(dy, 3),
                'trail': [(round(a, 2), round(b, 2)) for a, b in trail],
                'warning': ', '.join(warnings) if warnings else ''
            })
        except Exception as e:
            results.append({
                'symbol': sym, 'x': None, 'y': None,
                'quadrant': 'error', 'tail_dx': None, 'tail_dy': None,
                'warning': f'ERROR: {e}'
            })
    return results

def evaluate_sector(results, sector_etf):
    """Evaluate structural sanity for a sector's results."""
    valid = [r for r in results if r['x'] is not None]
    if not valid:
        return {'verdict': 'NO_DATA', 'explosions': [], 'collapse': False, 'warnings': []}

    xs = [r['x'] for r in valid]
    x_spread = max(xs) - min(xs)

    explosions = [r['symbol'] for r in valid
                  if abs(r['x'] - 100) > EXPLOSION_THRESH or abs(r['y'] - 100) > EXPLOSION_THRESH]
    collapse = x_spread < COLLAPSE_SPREAD

    sector_warnings = []

    # High-beta should not be deep lagging (x < 90) while sector is not in lagging
    for r in valid:
        sym = r['symbol']
        if sym in HIGH_BETA and r['quadrant'] == 'lagging' and r['x'] < 90:
            sector_warnings.append(f'{sym}: high-beta deep lagging (x={r["x"]:.1f})')
        if sym in DEFENSIVE and r['quadrant'] == 'leading' and r['x'] > 115:
            sector_warnings.append(f'{sym}: defensive extreme leading (x={r["x"]:.1f})')

    quad_counts = {}
    for r in valid:
        quad_counts[r['quadrant']] = quad_counts.get(r['quadrant'], 0) + 1

    # If ALL symbols in same quadrant → potential collapse/formula issue
    if len(quad_counts) == 1:
        sector_warnings.append(f'ALL in {list(quad_counts.keys())[0]} — no differentiation')

    return {
        'x_spread': round(x_spread, 2),
        'explosions': explosions,
        'collapse': collapse,
        'quad_distribution': quad_counts,
        'warnings': sector_warnings,
    }

# ── Main ────────────────────────────────────────────────────────────────────────
def main():
    all_syms = [s for syms in SECTORS.values() for s in syms]
    all_syms_set = set(all_syms)

    print(f"Loading data (lookback: daily=700, weekly via resample)...")
    bench = load_daily(BENCH, lookback_days=2200)
    if bench is None:
        print("ERROR: Cannot load SPY")
        sys.exit(1)

    sym_data = {}
    failed = []
    for sym in all_syms_set:
        d = load_daily(sym, lookback_days=2200)
        if d is not None and len(d) >= 300:
            sym_data[sym] = d
        else:
            failed.append(sym)

    print(f"  Loaded {len(sym_data)}/{len(all_syms_set)} symbols" +
          (f" | Failed: {failed}" if failed else ""))

    output = {}
    summary_rows = []

    for timeframe, N, M in [('weekly', WEEKLY_N, WEEKLY_M), ('daily', DAILY_N, DAILY_M)]:
        preset = f"D_N{N}_M{M}"
        print(f"\n=== {timeframe.upper()} ({preset}) ===")
        output[timeframe] = {'preset': preset, 'sectors': {}}

        for sector_etf, symbols in SECTORS.items():
            sect_data = {s: sym_data[s] for s in symbols if s in sym_data}
            if not sect_data:
                print(f"  {sector_etf}: no data")
                continue

            results = compute_positions(sect_data, bench, N, M, timeframe)
            eval_ = evaluate_sector(results, sector_etf)

            ok_count = sum(1 for r in results if not r['warning'])
            total = len(results)

            print(f"  {sector_etf}: {ok_count}/{total} OK | "
                  f"spread={eval_.get('x_spread','?'):.1f} | "
                  f"explode={eval_['explosions']} | "
                  f"collapse={eval_['collapse']}")

            if eval_['warnings']:
                for w in eval_['warnings']:
                    print(f"    WARN: {w}")

            # Per-symbol print
            for r in results:
                x_s = f"{r['x']:7.2f}" if r['x'] is not None else "    N/A"
                y_s = f"{r['y']:7.2f}" if r['y'] is not None else "    N/A"
                print(f"    {r['symbol']:6s} X={x_s} Y={y_s} {r['quadrant']:12s} {r['warning']}")

            output[timeframe]['sectors'][sector_etf] = {
                'preset': preset,
                'results': results,
                'eval': eval_,
                'ok_count': ok_count,
                'total': total,
            }

            explosions = eval_['explosions']
            warnings_count = len(eval_['warnings'])
            if explosions:
                row_verdict = 'WARN'
            elif eval_['collapse']:
                row_verdict = 'FAIL'
            else:
                row_verdict = 'OK'

            summary_rows.append({
                'sector': sector_etf,
                'timeframe': timeframe,
                'ok_total': f"{ok_count}/{total}",
                'explosion': ', '.join(explosions) if explosions else '—',
                'collapse': 'YES' if eval_['collapse'] else 'NO',
                'x_spread': eval_.get('x_spread', 0),
                'major_warnings': warnings_count,
                'verdict': row_verdict,
            })

    # ── Overall verdict ──────────────────────────────────────────────────────────
    has_fail     = any(r['verdict'] == 'FAIL' for r in summary_rows)
    has_warn     = any(r['verdict'] == 'WARN' for r in summary_rows)
    all_explosions = [r for r in summary_rows if r['explosion'] != '—']

    if has_fail or len(all_explosions) >= 3:
        verdict = 'SECTOR_STOCK_VALIDATION_FAIL'
    elif has_warn or all_explosions:
        verdict = 'SECTOR_STOCK_VALIDATION_PASS_WITH_WARNINGS'
    else:
        verdict = 'SECTOR_STOCK_VALIDATION_PASS'

    print(f"\nVerdict: {verdict}")

    # ── Write output ─────────────────────────────────────────────────────────────
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(out_dir, exist_ok=True)

    json_path = os.path.join(out_dir, 'rrg_sector_stock_validation_results.json')
    md_path   = os.path.join(out_dir, 'RRG_SECTOR_STOCK_VALIDATION.md')

    json_data = {
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'presets': {'weekly': f'D_N{WEEKLY_N}_M{WEEKLY_M}', 'daily': f'D_N{DAILY_N}_M{DAILY_M}'},
        'summary': summary_rows,
        'detail': output,
        'verdict': verdict,
    }

    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2)

    # ── Markdown ─────────────────────────────────────────────────────────────────
    lines = [
        '# RRG Sector-Level Individual Stock Validation',
        '',
        f'Generated: {datetime.now().strftime("%Y-%m-%d")}',
        '',
        '## Presets Used',
        f'- Weekly: Family D, N={WEEKLY_N}, M={WEEKLY_M}',
        f'- Daily:  Family D, N={DAILY_N}, M={DAILY_M}',
        '',
        '## Summary Table',
        '',
        '| Sector | Timeframe | OK/Total | Explosion | Collapse | X-Spread | Warnings | Row |',
        '|--------|-----------|----------|-----------|----------|----------|----------|-----|',
    ]

    for r in summary_rows:
        lines.append(
            f"| {r['sector']} | {r['timeframe']} | {r['ok_total']} | "
            f"{r['explosion']} | {r['collapse']} | {r['x_spread']:.1f} | "
            f"{r['major_warnings']} | {r['verdict']} |"
        )

    lines += ['', '---', '', '## Per-Symbol Detail', '']
    lines += ['| Symbol | Timeframe | X | Y | Quadrant | Tail dX | Tail dY | Warning |',
              '|--------|-----------|---|---|----------|---------|---------|---------|']

    for timeframe in ['weekly', 'daily']:
        for sector_etf in SECTORS:
            sect = output.get(timeframe, {}).get('sectors', {}).get(sector_etf)
            if not sect:
                continue
            for r in sect['results']:
                x_s = f"{r['x']:.2f}" if r['x'] is not None else 'N/A'
                y_s = f"{r['y']:.2f}" if r['y'] is not None else 'N/A'
                dx_s = f"{r['tail_dx']:.3f}" if r['tail_dx'] is not None else 'N/A'
                dy_s = f"{r['tail_dy']:.3f}" if r['tail_dy'] is not None else 'N/A'
                lines.append(
                    f"| {r['symbol']} | {timeframe} | {x_s} | {y_s} | "
                    f"{r['quadrant']} | {dx_s} | {dy_s} | {r['warning'] or '—'} |"
                )

    lines += ['', '---', '', '## Analysis', '']

    # Structural analysis paragraphs
    for timeframe in ['weekly', 'daily']:
        lines.append(f'### {timeframe.capitalize()}')
        for sector_etf, symbols in SECTORS.items():
            sect = output.get(timeframe, {}).get('sectors', {}).get(sector_etf)
            if not sect:
                continue
            e = sect['eval']
            lines.append(f'**{sector_etf}**: spread={e.get("x_spread",0):.1f}'
                         f' | quads={e["quad_distribution"]}'
                         f' | explosions={e["explosions"] or "none"}'
                         f' | collapse={e["collapse"]}')
            for w in e['warnings']:
                lines.append(f'  - WARN: {w}')
        lines.append('')

    lines += [
        '---',
        '',
        f'## Verdict',
        '',
        f'`{verdict}`',
    ]

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"JSON: {os.path.abspath(json_path)}")
    print(f"MD:   {os.path.abspath(md_path)}")

if __name__ == '__main__':
    main()
