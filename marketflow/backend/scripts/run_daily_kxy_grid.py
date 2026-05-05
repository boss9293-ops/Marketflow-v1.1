"""
Family C Daily Kx/Ky Grid — fix X-axis compression vs StockCharts Daily reference.

Family C: RS_smooth = EMA(RS, span=10), then z-score chain, shift(1) ROC.
Grid: Kx=[1,2,3,4]  Ky=[1,2,3]  N=65  EMA=10
"""
import sys, os, json, math
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from rrg_calculator import load_daily
from rrg_presets import EPSILON

SYMS  = ['AAPL', 'GOOGL', 'TSLA', 'AMZN', 'NVDA', 'MSFT', 'AVGO', 'JPM', 'NFLX']
BENCH = 'SPY'
N     = 65
SPAN  = 10

# StockCharts Daily reference
SC = {
    'TSLA':  (98.0,  100.3),
    'AAPL':  (99.5,  100.1),
    'MSFT':  (102.3, 100.2),
    'GOOGL': (105.5, 101.7),
    'NVDA':  (103.2,  99.7),
    'AMZN':  (106.6,  99.7),
    'AVGO':  (108.5,  98.8),
    'JPM':   (98.1,   99.0),
    'NFLX':  (91.8,   96.3),
}
SC_X_SPREAD = max(v[0] for v in SC.values()) - min(v[0] for v in SC.values())  # ~16.7
SC_Y_SPREAD = max(v[1] for v in SC.values()) - min(v[1] for v in SC.values())  # ~5.4

def classify(x, y, bnd=0.5):
    if abs(x-100) < bnd or abs(y-100) < bnd: return 'boundary'
    if x>=100 and y>=100: return 'leading'
    if x>=100 and y<100:  return 'weakening'
    if x<100  and y<100:  return 'lagging'
    return 'improving'

SC_QUAD = {
    'TSLA': 'improving', 'AAPL': 'boundary', 'MSFT': 'leading',
    'GOOGL': 'leading',  'NVDA': 'weakening', 'AMZN': 'weakening',
    'AVGO': 'weakening', 'JPM': 'lagging',   'NFLX': 'lagging',
}

def kendall_x(comp, ref, syms):
    n = len(syms)
    c = d = 0
    for i in range(n):
        for j in range(i+1, n):
            p = (comp[syms[i]] - comp[syms[j]]) * (ref[syms[i]] - ref[syms[j]])
            if p > 0: c += 1
            elif p < 0: d += 1
    return (c - d) / (n*(n-1)/2) if n > 1 else 0.0

def family_c(s_close, b_close, Kx, Ky):
    common = s_close.index.intersection(b_close.index)
    s = s_close.loc[common]
    b = b_close.loc[common]
    mask = s.notna() & b.notna() & (b != 0)
    s, b = s[mask], b[mask]
    RS   = 100.0 * s / b
    RS_s = RS.ewm(span=SPAN, adjust=False).mean()
    rs_m = RS_s.rolling(N, min_periods=N).mean().shift(1)
    rs_s2= RS_s.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSR  = 100.0 + Kx * (RS_s - rs_m) / rs_s2
    ROC  = 100.0 * (RSR / RSR.shift(1) - 1.0)
    ro_m = ROC.rolling(N, min_periods=N).mean().shift(1)
    ro_s = ROC.rolling(N, min_periods=N).std(ddof=0).shift(1).clip(lower=EPSILON)
    RSM  = 100.0 + Ky * (ROC - ro_m) / ro_s
    df = pd.DataFrame({'x': RSR, 'y': RSM}).dropna()
    if len(df) < 2:
        return None
    x = float(df['x'].iloc[-1])
    y = float(df['y'].iloc[-1])
    trail = [(float(r['x']), float(r['y'])) for _, r in df.iloc[-8:].iterrows()]
    return x, y, trail

def _load(sym):
    try:
        return load_daily(sym, lookback_days=700)
    except TypeError:
        return load_daily(sym)

def score(results, Kx, Ky):
    syms = [s for s in SYMS if s in results]
    n = len(syms)
    if n == 0: return 0, {}

    xs = {s: results[s][0] for s in syms}
    ys = {s: results[s][1] for s in syms}

    # 1. X-spread match (35%) — penalize if our spread < SC spread
    our_x_spread = max(xs.values()) - min(xs.values())
    # ideal: match SC_X_SPREAD (~16.7). Penalty scales with deficit.
    x_spread_ratio = our_x_spread / SC_X_SPREAD  # 1.0 = perfect
    x_spread_score = min(1.0, x_spread_ratio) * 35.0  # cap at 35 if over-expanded

    # 2. Quadrant match (30%)
    qpts = 0.0
    for s in syms:
        cq = classify(xs[s], ys[s])
        eq = SC_QUAD.get(s, '')
        if eq == 'boundary':
            qpts += 1.0 if (abs(xs[s]-100) <= 1.5 or abs(ys[s]-100) <= 1.5) else 0.5
        elif cq == eq:
            qpts += 1.0
        elif cq == 'boundary':
            qpts += 0.5
    quad_score = qpts / n * 30.0

    # 3. Y RMSE (20%)
    y_errs = [(ys[s] - SC[s][1])**2 for s in syms if s in SC]
    y_rmse = math.sqrt(sum(y_errs)/len(y_errs)) if y_errs else 0
    y_score = max(0.0, 20.0 - 4.0 * y_rmse)

    # 4. X Kendall tau (15%)
    tau_x = kendall_x(xs, {s: SC[s][0] for s in SYMS}, syms)
    tau_score = (tau_x + 1.0) / 2.0 * 15.0

    total = x_spread_score + quad_score + y_score + tau_score
    return total, {
        'total': round(total, 2),
        'x_spread_score': round(x_spread_score, 2),
        'quad_score':     round(quad_score, 2),
        'y_score':        round(y_score, 2),
        'tau_score':      round(tau_score, 2),
        'our_x_spread':   round(our_x_spread, 2),
        'y_rmse':         round(y_rmse, 3),
        'tau_x':          round(tau_x, 3),
    }

def main():
    print('Loading...')
    bench = _load(BENCH).iloc[-700:]
    sym_data = {}
    for s in SYMS:
        raw = _load(s)
        if raw is not None:
            sym_data[s] = raw.iloc[-700:]
    print(f'  SPY: {len(bench)} daily bars, {len(sym_data)} symbols loaded')

    KX_GRID = [1, 2, 3, 4]
    KY_GRID = [1, 2, 3]

    print(f'\n{"Kx":>3} {"Ky":>3} | {"Total":>6} {"XSpread":>7} {"Quad":>5} {"Y_RMSE":>6} {"Tau-X":>6} | OurXSp SC_XSp')
    print('-' * 75)

    all_results = []
    for Kx in KX_GRID:
        for Ky in KY_GRID:
            computed = {}
            for sym, close in sym_data.items():
                r = family_c(close, bench, Kx, Ky)
                if r is not None:
                    computed[sym] = r
            total, sc = score(computed, Kx, Ky)
            sc['Kx'] = Kx
            sc['Ky'] = Ky
            sc['computed'] = {s: {'x': round(computed[s][0], 2), 'y': round(computed[s][1], 2)} for s in computed}
            all_results.append(sc)
            print(f'  {Kx:>1}   {Ky:>1} | {total:>6.2f} {sc["x_spread_score"]:>7.2f} {sc["quad_score"]:>5.2f} '
                  f'{sc["y_rmse"]:>6.3f} {sc["tau_x"]:>6.3f} | {sc["our_x_spread"]:>5.2f}  {SC_X_SPREAD:.2f}')

    best = max(all_results, key=lambda r: r['total'])
    print(f'\nBest: Kx={best["Kx"]} Ky={best["Ky"]}  score={best["total"]}')

    # Per-symbol residual table for best config
    comp = best['computed']
    print(f'\n=== Per-Symbol Residual: Kx={best["Kx"]} Ky={best["Ky"]} ===')
    print(f'{"Symbol":>6} | {"SC_X":>6} {"My_X":>6} {"dX":>6} | {"SC_Y":>6} {"My_Y":>6} {"dY":>6} | {"SC_Q":>10} {"My_Q":>10} | Match')
    print('-' * 88)
    quad_hits = 0
    for sym in SYMS:
        if sym not in comp or sym not in SC: continue
        sx, sy = SC[sym]
        mx = comp[sym]['x']
        my = comp[sym]['y']
        dx = mx - sx
        dy = my - sy
        sq = SC_QUAD.get(sym, '?')
        mq = classify(mx, my)
        hit = 'OK' if mq == sq or (sq == 'boundary' and (abs(mx-100) <= 1.5 or abs(my-100) <= 1.5)) else \
              '~' if mq == 'boundary' else '--'
        if hit in ('✓', '~'): quad_hits += 1
        print(f'  {sym:>5} | {sx:>6.1f} {mx:>6.2f} {dx:>+6.2f} | {sy:>6.1f} {my:>6.2f} {dy:>+6.2f} | {sq:>10} {mq:>10} | {hit}')
    print(f'\nQuadrant hits: {quad_hits}/{len([s for s in SYMS if s in comp])}')

    # Print Kx=3 Ky=1 as alternative
    alt = next((r for r in all_results if r['Kx'] == 3 and r['Ky'] == 1), None)
    if alt:
        print(f'\n=== Residual: Kx=3 Ky=1 (alternative) ===')
        print(f'{"Symbol":>6} | {"SC_X":>6} {"My_X":>6} {"dX":>6} | {"SC_Y":>6} {"My_Y":>6} {"dY":>6} | Match')
        print('-' * 65)
        for sym in SYMS:
            if sym not in alt['computed'] or sym not in SC: continue
            sx, sy = SC[sym]
            mx = alt['computed'][sym]['x']
            my = alt['computed'][sym]['y']
            sq = SC_QUAD.get(sym, '?')
            mq = classify(mx, my)
            hit = 'OK' if mq == sq or (sq == 'boundary' and (abs(mx-100) <= 1.5 or abs(my-100) <= 1.5)) else \
                  '~' if mq == 'boundary' else '--'
            print(f'  {sym:>5} | {sx:>6.1f} {mx:>6.2f} {mx-sx:>+6.2f} | {sy:>6.1f} {my:>6.2f} {my-sy:>+6.2f} | {sq} -> {mq} {hit}')

    # Also print Kx=1 baseline for comparison
    base = next((r for r in all_results if r['Kx'] == 1 and r['Ky'] == 1), None)
    if base:
        print(f'\n--- Baseline Kx=1 Ky=1 (current) ---')
        print(f'{"Symbol":>6} | {"SC_X":>6} {"My_X":>6} {"dX":>6} | {"SC_Y":>6} {"My_Y":>6} {"dY":>6}')
        print('-' * 55)
        for sym in SYMS:
            if sym not in base['computed'] or sym not in SC: continue
            sx, sy = SC[sym]
            mx = base['computed'][sym]['x']
            my = base['computed'][sym]['y']
            print(f'  {sym:>5} | {sx:>6.1f} {mx:>6.2f} {mx-sx:>+6.2f} | {sy:>6.1f} {my:>6.2f} {my-sy:>+6.2f}')

    # JSON output
    OUT = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(OUT, exist_ok=True)
    out = {
        'generated': __import__('datetime').datetime.now().isoformat(),
        'family': 'C', 'N': N, 'EMA_span': SPAN,
        'SC_x_spread': round(SC_X_SPREAD, 2),
        'best': best,
        'all': sorted(all_results, key=lambda r: r['total'], reverse=True),
    }
    jp = os.path.join(OUT, 'rrg_daily_kxy_grid.json')
    with open(jp, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    print(f'\nJSON: {jp}')
    return best

if __name__ == '__main__':
    main()
