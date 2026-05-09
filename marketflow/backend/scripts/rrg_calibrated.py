"""
MarketFlow Calibrated RRG (Daily) — Candidate B: Log RS Trend
Universal Kx/Ky calibration via 5th/95th percentile.

Formula:
  logRS          = ln(adjClose_symbol / adjClose_SPY)
  trend          = EMA(logRS, SHORT) - EMA(logRS, LP)
  MF_RS_Ratio    = 100 + Kx * trend
  rawMomentum    = (MF_RS_Ratio / MF_RS_Ratio.shift(M) - 1) * 100
  MF_RS_Momentum = 100 + Ky * rawMomentum

Kx maps p5/p95 of trend to ±6.5 RS-Ratio units.
Ky maps p5/p95 of rawMomentum to ±3.0 RS-Momentum units.
"""
import numpy as np
import pandas as pd
import json
import os
import sqlite3
import math
from datetime import datetime, timedelta
from typing import Optional

# ── Constants ──────────────────────────────────────────────────────────────────
BENCHMARK    = 'SPY'
UNIVERSE     = ['TSLA', 'NVDA', 'AMZN', 'AAPL', 'GOOGL', 'MSFT', 'META', 'AVGO', 'AMD', 'NFLX']
ANCHORS      = {
    'TSLA': {'role': 'deep-left recovery arc',  'min_score': 0.65},
    'AMZN': {'role': 'far-right weakening',     'min_score': 0.70},
    'AAPL': {'role': 'center-hover stability',  'min_score': 0.60},
    'NVDA': {'role': 'leading preservation',    'min_score': 0.70},
}
SHORT        = 10
TAIL_LEN     = 10
X_HALF       = 6.5
Y_HALF       = 3.0
BACKTEST_DAYS = 20
LOOKBACK     = 700    # calendar days to fetch

# ── DB ─────────────────────────────────────────────────────────────────────────
def _db_path() -> str:
    base = os.path.dirname(__file__)
    for p in [
        os.path.join(base, '..', '..', 'data', 'marketflow.db'),
        os.path.join(base, '..', 'data', 'marketflow.db'),
    ]:
        norm = os.path.normpath(p)
        if os.path.exists(norm): return norm
    return os.path.normpath(os.path.join(base, '..', 'data', 'marketflow.db'))

def load_prices(symbol: str, lookback_days: int = LOOKBACK) -> Optional[pd.Series]:
    db = _db_path()
    if not os.path.exists(db): return None
    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    try:
        conn = sqlite3.connect(db)
        df = pd.read_sql_query(
            "SELECT date, COALESCE(adj_close, close) AS close "
            "FROM ohlcv_daily WHERE symbol=? AND date>=? ORDER BY date",
            conn, params=(symbol, cutoff)
        )
        conn.close()
        if df.empty or len(df) < 60: return None
        df['date'] = pd.to_datetime(df['date'])
        return df.set_index('date')['close']
    except Exception as e:
        print(f"  DB error {symbol}: {e}")
        return None

# ── EMA ────────────────────────────────────────────────────────────────────────
def ema(s: pd.Series, span: int) -> pd.Series:
    return s.ewm(span=span, adjust=False).mean()

# ── Formula ────────────────────────────────────────────────────────────────────
def calc_series(sc: pd.Series, bc: pd.Series, LP: int, M: int, Kx: float, Ky: float) -> Optional[pd.DataFrame]:
    common = sc.index.intersection(bc.index)
    min_rows = LP * 3 + TAIL_LEN + BACKTEST_DAYS + 10
    if len(common) < min_rows: return None
    s = sc[common]; b = bc[common]

    logRS   = np.log(s / b)
    trend   = ema(logRS, SHORT) - ema(logRS, LP)
    rs_r    = 100.0 + Kx * trend
    raw_mom = (rs_r / rs_r.shift(M) - 1.0) * 100.0
    rs_m    = 100.0 + Ky * raw_mom

    df = pd.DataFrame({'rs_ratio': rs_r, 'rs_momentum': rs_m,
                       'trend': trend, 'raw_mom': raw_mom}).dropna()
    return df

# ── Calibration ────────────────────────────────────────────────────────────────
def calibrate(prices: dict, bench: pd.Series, LP: int, M: int) -> dict:
    all_trend, all_rmom = [], []
    for sym, sc in prices.items():
        common = sc.index.intersection(bench.index)
        if len(common) < LP * 3 + 30: continue
        s = sc[common]; b = bench[common]
        logRS = np.log(s / b)
        tr = ema(logRS, SHORT) - ema(logRS, LP)
        stable = tr.dropna().iloc[LP * 2:]
        all_trend.extend(stable.tolist())

    if len(all_trend) < 100:
        raise ValueError(f"Only {len(all_trend)} trend values — need 100+")

    p5t  = np.percentile(all_trend, 5)
    p95t = np.percentile(all_trend, 95)
    Kx   = 6.5 / max(abs(p5t), abs(p95t))

    for sym, sc in prices.items():
        common = sc.index.intersection(bench.index)
        if len(common) < LP * 3 + 30: continue
        s = sc[common]; b = bench[common]
        logRS = np.log(s / b)
        tr = ema(logRS, SHORT) - ema(logRS, LP)
        rs_r = 100.0 + Kx * tr
        rm = (rs_r / rs_r.shift(M) - 1.0) * 100.0
        stable = rm.dropna().iloc[LP * 2:]
        all_rmom.extend(stable.tolist())

    if len(all_rmom) < 100:
        raise ValueError(f"Only {len(all_rmom)} momentum values — need 100+")

    p5m  = np.percentile(all_rmom, 5)
    p95m = np.percentile(all_rmom, 95)
    Ky   = 3.0 / max(abs(p5m), abs(p95m))

    warns = []
    if Kx < 50 or Kx > 300: warns.append(f"WARN Kx={Kx:.2f} outside [50,300]")
    if Ky < 0.5 or Ky > 5.0: warns.append(f"WARN Ky={Ky:.4f} outside [0.5,5.0]")

    return {
        'LP': LP, 'M': M, 'Kx': Kx, 'Ky': Ky,
        'p5_trend': p5t, 'p95_trend': p95t,
        'p5_momentum': p5m, 'p95_momentum': p95m,
        'n_trend': len(all_trend), 'n_mom': len(all_rmom),
        'warnings': warns,
    }

# ── Normalise ──────────────────────────────────────────────────────────────────
def norm(x, y):
    return (x - 100) / X_HALF, (y - 100) / Y_HALF

# ── DTW (Sakoe-Chiba band=2) ──────────────────────────────────────────────────
def dtw2d(seq_a, seq_b, band=2):
    n, m = len(seq_a), len(seq_b)
    INF  = float('inf')
    C    = np.full((n, m), INF)
    for i in range(n):
        for j in range(m):
            if abs(i - j) > band: continue
            d = math.sqrt((seq_a[i][0]-seq_b[j][0])**2 + (seq_a[i][1]-seq_b[j][1])**2)
            prev = 0.0
            if i > 0 and j > 0:   prev = min(C[i-1][j-1], C[i-1][j], C[i][j-1])
            elif i > 0:            prev = C[i-1][j]
            elif j > 0:            prev = C[i][j-1]
            C[i][j] = d + prev
    if C[n-1][m-1] == INF: return None, None
    # traceback
    i, j, plen = n-1, m-1, 1
    while i > 0 or j > 0:
        if i == 0:            i, j = i, j-1
        elif j == 0:          i, j = i-1, j
        else:
            best = min((C[i-1][j-1], i-1, j-1), (C[i-1][j], i-1, j), (C[i][j-1], i, j-1))
            i, j = best[1], best[2]
        plen += 1
    return C[n-1][m-1] / plen, plen

# ── Energy zone ───────────────────────────────────────────────────────────────
ZONES = ['Neutral Core', 'Active Rotation', 'High Energy', 'Extreme Corner']
def ez(vd): return 0 if vd < 0.20 else 1 if vd < 0.45 else 2 if vd < 0.75 else 3
ZONE_SC = {0: 1.0, 1: 0.6, 2: 0.2, 3: 0.0}

# ── Quadrant ──────────────────────────────────────────────────────────────────
def quad(x, y): return ('Leading' if x>=100 else 'Improving') if y>=100 else ('Weakening' if x>=100 else 'Lagging')
ADJ = {'Leading':{'Weakening','Improving'}, 'Weakening':{'Leading','Lagging'},
       'Lagging':{'Weakening','Improving'},  'Improving':{'Leading','Lagging'}}

# ── Scoring ────────────────────────────────────────────────────────────────────
def score(mf_norm, mf_raw, ref_norm):
    n = len(mf_norm)
    if n < 2: return None
    ms, me = mf_norm[0], mf_norm[-1]
    rs, re = mf_raw[0], mf_raw[-1]
    has_ref = ref_norm is not None and len(ref_norm) >= 2

    out = {}

    # DTW
    if has_ref:
        davg, plen = dtw2d(mf_norm, ref_norm)
        if davg is not None:
            tier = 'Excellent' if davg<0.20 else 'Good' if davg<0.35 else 'Accept' if davg<0.50 else 'Fail'
            out.update(DTWScore=max(0.0,min(1.0,1-davg/0.50)), dtwAvg=davg, dtwTier=tier, dtwPathLen=plen)
        else:
            out.update(DTWScore=None, dtwAvg=None, dtwTier='N/A', dtwPathLen=None)
    else:
        out.update(DTWScore=None, dtwAvg=None, dtwTier='N/A', dtwPathLen=None)

    # Endpoint
    if has_ref:
        rfs, rfe = ref_norm[0], ref_norm[-1]
        se = math.sqrt((ms[0]-rfs[0])**2+(ms[1]-rfs[1])**2)
        ee = math.sqrt((me[0]-rfe[0])**2+(me[1]-rfe[1])**2)
        epe = 0.4*se + 0.6*ee
        out.update(EndpointScore=max(0.0,min(1.0,1-epe/0.50)), startError=se, endError=ee, endpointError=epe)
    else:
        out.update(EndpointScore=None, startError=None, endError=None, endpointError=None)

    # Direction
    vMF = (me[0]-ms[0], me[1]-ms[1]); nMF = math.sqrt(vMF[0]**2+vMF[1]**2)
    if has_ref:
        rfs, rfe = ref_norm[0], ref_norm[-1]
        vR = (rfe[0]-rfs[0], rfe[1]-rfs[1]); nR = math.sqrt(vR[0]**2+vR[1]**2)
        if nMF < 0.15 and nR < 0.15:
            out.update(DirectionScore=1.0, directionCat='CENTER_HOVER_MATCH', angleDiff=0.0)
        elif nMF < 0.15 or nR < 0.15:
            out.update(DirectionScore=0.3, directionCat='ONE_SIDE_FLAT', angleDiff=None)
        else:
            cos = max(-1.0, min(1.0, (vMF[0]*vR[0]+vMF[1]*vR[1])/(nMF*nR)))
            ad  = math.acos(cos)*180/math.pi
            out.update(DirectionScore=max(0.0,min(1.0,1-ad/35)), directionCat='COMPUTED', angleDiff=ad)
    else:
        out.update(DirectionScore=None, directionCat='NO_REF', angleDiff=None)

    # Energy
    def vdist(p): return math.sqrt(p[0]**2+p[1]**2)
    vd_s  = vdist(ms); vd_e = vdist(me); vd_max = max(vdist(p) for p in mf_norm)
    if has_ref:
        rvd_s = vdist(ref_norm[0]); rvd_e = vdist(ref_norm[-1])
        rvd_max = max(vdist(p) for p in ref_norm)
    else:
        rvd_s, rvd_e, rvd_max = vd_s, vd_e, vd_max
    zsc = lambda a,b: ZONE_SC[min(3, abs(ez(a)-ez(b)))]
    out['EnergyScore'] = 0.30*zsc(vd_s,rvd_s) + 0.40*zsc(vd_e,rvd_e) + 0.30*zsc(vd_max,rvd_max)
    out['energyZone']  = ZONES[ez(vd_e)]
    out['visualDistEnd'] = round(vd_e, 4)

    # Quadrant
    qMF  = quad(re[0], re[1])
    if has_ref:
        rx = ref_norm[-1][0]*X_HALF + 100; ry = ref_norm[-1][1]*Y_HALF + 100
        qRef = quad(rx, ry)
    else:
        qRef = qMF
    near = abs(me[0]) < 0.2 or abs(me[1]) < 0.2
    if qMF == qRef:                     qsc = 1.0
    elif near:                           qsc = 0.7
    elif qRef in ADJ.get(qMF, set()): qsc = 0.3
    else:                                qsc = 0.0
    out.update(QuadrantScore=qsc, quadrantMF=qMF, quadrantRef=qRef, nearBoundary=near)

    # Final
    if out['DTWScore'] is not None:
        final = (0.40*out['DTWScore'] + 0.20*out['EndpointScore'] +
                 0.15*out['DirectionScore'] + 0.15*out['EnergyScore'] + 0.10*out['QuadrantScore'])
    elif out['EndpointScore'] is not None:
        final = (0.30*out['EndpointScore'] + 0.25*out['DirectionScore'] +
                 0.25*out['EnergyScore'] + 0.20*out['QuadrantScore'])
    else:
        final = 0.50*out['EnergyScore'] + 0.50*out['QuadrantScore']

    out['FinalScore']    = round(final, 4)
    out['FinalScore100'] = round(final * 100, 1)
    return out

# ── Fail gates ────────────────────────────────────────────────────────────────
def fail_gates(sc: dict, n_rows: int, tail_len: int) -> dict:
    crit, warn = [], []
    if n_rows < 250:        crit.append(f"insufficient rows {n_rows}<250")
    if tail_len < TAIL_LEN: crit.append(f"tail too short {tail_len}<{TAIL_LEN}")
    d = sc.get('dtwAvg')
    if d is not None:
        if d > 0.70:   crit.append(f"dtwAvg={d:.3f}>0.70")
        elif d > 0.50: warn.append(f"dtwAvg={d:.3f} in (0.50,0.70]")
    a = sc.get('angleDiff')
    if a is not None:
        if a > 50:   crit.append(f"angleDiff={a:.1f}>50")
        elif a > 35: warn.append(f"angleDiff={a:.1f} in (35,50]")
    e = sc.get('endError')
    if e is not None:
        if e > 1.0:   crit.append(f"endError={e:.3f}>1.0")
        elif e > 0.75: warn.append(f"endError={e:.3f} in (0.75,1.0]")
    return {'critical': crit, 'warnings': warn, 'is_critical': bool(crit)}

# ── Backtest ──────────────────────────────────────────────────────────────────
def run_backtest(prices, bench, LP, M, Kx, Ky, reference_paths=None):
    all_scores, crit_fails, sym_results = [], [], {}

    for sym in UNIVERSE:
        if sym not in prices: continue
        df = calc_series(prices[sym], bench, LP, M, Kx, Ky)
        if df is None or len(df) < TAIL_LEN + BACKTEST_DAYS:
            print(f"  {sym}: skip (insufficient rows)")
            continue

        ref_raw = (reference_paths or {}).get(sym, {}).get('points')
        ref_norm = [norm(p['x'], p['y']) for p in ref_raw] if ref_raw and len(ref_raw) >= 2 else None

        day_scores = []
        for offset in range(BACKTEST_DAYS):
            end_i   = len(df) - offset
            start_i = end_i - TAIL_LEN
            if start_i < 0: break
            tail = df.iloc[start_i:end_i]
            if len(tail) < TAIL_LEN: break

            mf_raw  = [(r['rs_ratio'], r['rs_momentum']) for _, r in tail.iterrows()]
            mf_norm_pts = [norm(x, y) for x, y in mf_raw]

            # Only use external reference on latest day (offset=0)
            ref = ref_norm if offset == 0 else None
            sc  = score(mf_norm_pts, mf_raw, ref)
            if sc is None: continue

            gates = fail_gates(sc, len(df), len(tail))
            if gates['is_critical']:
                crit_fails.append({'symbol': sym, 'dayOffset': offset, 'issues': gates['critical']})

            day_scores.append(sc['FinalScore'])
            all_scores.append(sc['FinalScore'])

        if day_scores:
            sym_results[sym] = {
                'avgScore':   round(float(np.mean(day_scores)), 4),
                'worstScore': round(float(np.min(day_scores)), 4),
                'scores':     [round(s, 4) for s in day_scores],
            }
            a_tag = f" [{ANCHORS[sym]['role']}]" if sym in ANCHORS else ''
            print(f"  {sym}{a_tag}: avg={sym_results[sym]['avgScore']:.3f}  worst={sym_results[sym]['worstScore']:.3f}")

    if not all_scores:
        return None

    med = float(np.median(all_scores))
    p10 = float(np.percentile(all_scores, 10))

    anchor_pass = {}
    for sym, info in ANCHORS.items():
        sr = sym_results.get(sym)
        if sr:
            ok = sr['avgScore'] >= info['min_score']
            anchor_pass[sym] = {'pass': ok, 'avgScore': sr['avgScore'], 'required': info['min_score']}
        else:
            anchor_pass[sym] = {'pass': False, 'avgScore': None, 'required': info['min_score']}

    n_anchor_pass = sum(1 for v in anchor_pass.values() if v['pass'])
    print(f"  Median={med:.3f}  P10={p10:.3f}  CritFails={len(crit_fails)}  AnchorPass={n_anchor_pass}/4")

    return {
        'LP': LP, 'M': M, 'Kx': round(Kx, 4), 'Ky': round(Ky, 6),
        'medianScore': round(med, 4), 'p10Score': round(p10, 4),
        'criticalFails': len(crit_fails), 'criticalFailDetails': crit_fails[:10],
        'anchorPass': anchor_pass, 'anchorsPassingCount': n_anchor_pass,
        'symbolResults': sym_results,
        'allScoreCount': len(all_scores),
    }

# ── Recommend ──────────────────────────────────────────────────────────────────
def recommend(results: list) -> tuple:
    approved = [(r['medianScore'], r) for r in results
                if r['medianScore'] >= 0.70 and r['p10Score'] >= 0.55
                and r['criticalFails'] == 0 and r['anchorsPassingCount'] >= 3]
    if approved:
        best = max(approved, key=lambda x: x[0])[1]
        return best['LP'], best['M'], 'APPROVE'
    warned = [(r['medianScore'], r) for r in results
              if r['medianScore'] >= 0.65 and r['p10Score'] >= 0.50]
    if warned:
        best = max(warned, key=lambda x: x[0])[1]
        return best['LP'], best['M'], 'APPROVE_WITH_WARNING'
    best = max(results, key=lambda r: r['medianScore'])
    return best['LP'], best['M'], 'REJECT'

# ── Reports ────────────────────────────────────────────────────────────────────
def write_outputs(cal_results, bt_results, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    btr_list = [r for r in bt_results if r is not None]
    best_LP, best_M, rec = recommend(btr_list) if btr_list else (None, None, 'REJECT')

    # calibration.json
    json.dump({
        'generatedAt': datetime.now().isoformat(),
        'universe': UNIVERSE, 'benchmark': BENCHMARK,
        'formula': 'Candidate B: logRS EMA trend + ROC momentum',
        'calibrations': [{
            'LP': c['LP'], 'M': c['M'],
            'Kx': round(c['Kx'], 4), 'Ky': round(c['Ky'], 6),
            'p5_trend': round(c['p5_trend'], 8), 'p95_trend': round(c['p95_trend'], 8),
            'p5_momentum': round(c['p5_momentum'], 6), 'p95_momentum': round(c['p95_momentum'], 6),
            'warnings': c['warnings'],
        } for c in cal_results]
    }, open(os.path.join(out_dir, 'rrg_calibration.json'), 'w'), indent=2)

    # backtest.json
    json.dump({
        'generatedAt': datetime.now().isoformat(),
        'recommendation': rec, 'bestLP': best_LP, 'bestM': best_M,
        'results': [{k: v for k, v in r.items() if k != 'criticalFailDetails'} | {'criticalFailSummary': r['criticalFailDetails'][:5]}
                    for r in btr_list],
    }, open(os.path.join(out_dir, 'rrg_final_backtest.json'), 'w'), indent=2, default=str)

    # calibration report
    lines = [
        "# RRG Calibration Report — Candidate B (Log RS Trend)",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Universe: {', '.join(UNIVERSE)}",
        f"Benchmark: {BENCHMARK}",
        "",
        "## Formula",
        "```",
        "logRS          = ln(adjClose_symbol / adjClose_SPY)",
        "trend          = EMA(logRS, 10) - EMA(logRS, LP)",
        "MF_RS_Ratio    = 100 + Kx * trend",
        "rawMomentum    = (MF_RS_Ratio / MF_RS_Ratio.shift(M) - 1) * 100",
        "MF_RS_Momentum = 100 + Ky * rawMomentum",
        "```",
        "",
        "## Calibration Table",
        "| LP | M | Kx | Ky | p5_trend | p95_trend | p5_mom | p95_mom | Warnings |",
        "|----|---|-------|--------|----------|-----------|--------|---------|----------|",
    ]
    for c in sorted(cal_results, key=lambda x: (x['LP'], x['M'])):
        w = 'YES' if c['warnings'] else 'none'
        lines.append(
            f"| {c['LP']} | {c['M']} | {c['Kx']:.2f} | {c['Ky']:.4f} "
            f"| {c['p5_trend']:.6f} | {c['p95_trend']:.6f} "
            f"| {c['p5_momentum']:.4f} | {c['p95_momentum']:.4f} | {w} |"
        )
    for c in cal_results:
        if c['warnings']:
            lines += [f"\n### Warnings LP={c['LP']}/M={c['M']}"] + [f"- {w}" for w in c['warnings']]
    open(os.path.join(out_dir, 'RRG_CALIBRATION_REPORT.md'), 'w', encoding='utf-8').write('\n'.join(lines))

    # backtest report
    lines = [
        "# RRG Final Backtest Report — Candidate B",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Backtest days: {BACKTEST_DAYS}  |  Universe: {', '.join(UNIVERSE)}",
        "",
        f"## Recommendation: **{rec}**",
        f"Best parameters: LP={best_LP}, M={best_M}",
        "",
        "## Formula Score Table",
        "| LP | M | Median | P10 | CritFails | AnchorPass | Status |",
        "|----|---|--------|-----|-----------|------------|--------|",
    ]
    for r in sorted(btr_list, key=lambda x: (x['LP'], x['M'])):
        ok = r['medianScore']>=0.70 and r['p10Score']>=0.55 and r['criticalFails']==0 and r['anchorsPassingCount']>=3
        lines.append(f"| {r['LP']} | {r['M']} | {r['medianScore']:.3f} | {r['p10Score']:.3f} "
                     f"| {r['criticalFails']} | {r['anchorsPassingCount']}/4 | {'APPROVE' if ok else 'FAIL'} |")

    if best_LP and any(r['LP']==best_LP and r['M']==best_M for r in btr_list):
        best = next(r for r in btr_list if r['LP']==best_LP and r['M']==best_M)
        lines += ["", "## Per Symbol Score Table (Best Combo)",
                  "| Symbol | Avg Score | Worst | Anchor Role |",
                  "|--------|-----------|-------|-------------|"]
        for sym in UNIVERSE:
            sr = best['symbolResults'].get(sym)
            if sr:
                role = ANCHORS.get(sym, {}).get('role', '-')
                lines.append(f"| {sym} | {sr['avgScore']:.3f} | {sr['worstScore']:.3f} | {role} |")

        lines += ["", "## Anchor Table",
                  "| Symbol | Role | Required | Actual | Pass/Fail |",
                  "|--------|------|----------|--------|-----------|"]
        for sym, info in ANCHORS.items():
            ap = best['anchorPass'].get(sym, {})
            actual = f"{ap['avgScore']:.3f}" if ap.get('avgScore') is not None else 'N/A'
            pf = 'PASS' if ap.get('pass') else 'FAIL'
            lines.append(f"| {sym} | {info['role']} | {info['min_score']} | {actual} | {pf} |")

        if best['criticalFailDetails']:
            lines += ["", "## Critical Fails", "| Symbol | Day Offset | Issue |",
                      "|--------|------------|-------|"]
            for cf in best['criticalFailDetails']:
                lines.append(f"| {cf['symbol']} | {cf['dayOffset']} | {'; '.join(cf['issues'])} |")

    open(os.path.join(out_dir, 'RRG_FINAL_BACKTEST_REPORT.md'), 'w', encoding='utf-8').write('\n'.join(lines))
    return rec, best_LP, best_M

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=== MarketFlow Calibrated RRG (Daily) - Candidate B ===\n")

    # Load reference paths
    cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'rrg_reference_paths.json')
    ref_paths = json.load(open(cfg)).get('symbols', {}) if os.path.exists(cfg) else {}
    if ref_paths: print(f"Reference paths loaded: {list(ref_paths.keys())}\n")

    print("Loading price data...")
    bench = load_prices(BENCHMARK)
    if bench is None: raise RuntimeError("Cannot load SPY")
    print(f"  SPY: {len(bench)} rows  {bench.index[0].date()} to {bench.index[-1].date()}")

    prices = {}
    for sym in UNIVERSE:
        s = load_prices(sym)
        if s is not None:
            prices[sym] = s
            print(f"  {sym}: {len(s)} rows")
        else:
            print(f"  {sym}: SKIP")

    grid    = [(28, 10), (28, 14), (35, 10), (35, 14)]
    cal_all, bt_all = [], []

    for LP, M in grid:
        print(f"\n--- Calibrating LP={LP}, M={M} ---")
        try:
            c = calibrate(prices, bench, LP, M)
            cal_all.append(c)
            print(f"  Kx={c['Kx']:.4f}  Ky={c['Ky']:.6f}")
            for w in c['warnings']: print(f"  {w}")
        except Exception as e:
            print(f"  ERROR: {e}"); continue

        print(f"  Running backtest...")
        bt = run_backtest(prices, bench, LP, M, c['Kx'], c['Ky'], ref_paths)
        if bt: bt_all.append(bt)

    out_dir = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    rec, best_LP, best_M = write_outputs(cal_all, bt_all, out_dir)

    print(f"\n{'='*55}")
    print(f"RECOMMENDATION : {rec}")
    print(f"Best params    : LP={best_LP}, M={best_M}")
    print(f"Outputs        : {out_dir}")
    print(f"{'='*55}")

if __name__ == '__main__':
    main()
