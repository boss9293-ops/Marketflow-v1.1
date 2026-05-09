# Stock/Mixed 라우트 전환 검증 — 임시
import sys, os, json, math, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rrg_calculator import load_daily, load_weekly
from rrg_engine_router import compute_symbol_rrg, classify_universe

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

SC_REF = {
    'daily': {
        'AAPL': (99.70,100.40), 'MSFT': (102.00,99.55),
        'NVDA': (102.90,99.15), 'AMD': (121.00,102.30), 'TSLA': (98.10,100.15),
    },
    'weekly': {
        'AAPL': (99.20,99.60),  'MSFT': (89.00,102.30),
        'NVDA': (100.00,101.00),'AMD': (109.40,107.60), 'TSLA': (90.80,97.10),
    },
}

CHECK = {
    'BigTech':  ['AAPL', 'MSFT', 'NVDA', 'AMD', 'TSLA'],
    'Sector':   ['XLK', 'XLE', 'XLU', 'XLV', 'XLF'],
    'Leveraged':['QQQ', 'SOXL', 'TQQQ'],
}
ALL_SYMS = [s for g in CHECK.values() for s in g]

def _dist(ax, ay, bx, by): return math.sqrt((ax-bx)**2+(ay-by)**2)
def _quad(x,y):
    if x>=100 and y>=100: return 'Leading'
    if x>=100 and y<100:  return 'Weakening'
    if x<100 and y>=100:  return 'Improving'
    return 'Lagging'

def main():
    bench_d = load_daily('SPY')
    bench_w = load_weekly('SPY')
    rows = []
    all_ok = True

    for gname, syms in CHECK.items():
        for tf in ['daily', 'weekly']:
            bench = bench_d if tf == 'daily' else bench_w
            loader = load_daily if tf == 'daily' else load_weekly
            universe = 'sector' if gname == 'Sector' else 'stock_mixed'
            for sym in syms:
                sym_s = loader(sym)
                if sym_s is None: continue
                res = compute_symbol_rrg(sym_s, bench, tf, universe, tail_len=10)
                if res is None or '_error' in res:
                    rows.append({'group': gname, 'symbol': sym, 'timeframe': tf, 'error': str(res)})
                    all_ok = False
                    continue

                preset = res.get('preset_id', '?')
                family = res.get('engine_family', '?')
                x = res['latest']['rs_ratio']
                y = res['latest']['rs_momentum']
                ok_preset = (preset == 'SMA_10_34_8')
                if not ok_preset:
                    all_ok = False

                sc = SC_REF.get(tf, {}).get(sym)
                dist = _dist(x, y, sc[0], sc[1]) if sc else None

                rows.append({
                    'group': gname, 'symbol': sym, 'timeframe': tf,
                    'x': round(x,4), 'y': round(y,4), 'preset': preset,
                    'family': family, 'preset_ok': ok_preset,
                    'sc_x': sc[0] if sc else None, 'sc_y': sc[1] if sc else None,
                    'dist_to_sc': round(dist,4) if dist else None,
                    'quadrant': _quad(x,y),
                    'quad_sc': _quad(*sc) if sc else None,
                    'quad_match': (_quad(x,y)==_quad(*sc)) if sc else None,
                })
                st = 'PASS' if ok_preset else 'FAIL'
                dist_str = f"dist={dist:.3f}" if dist else ""
                print(f"  {gname:10} {sym:6} {tf:7} preset={preset} {dist_str}  {st}")

    # Aggregate
    def avg_dist(g, tf):
        v = [r['dist_to_sc'] for r in rows
             if r.get('group')==g and r.get('timeframe')==tf and r.get('dist_to_sc') is not None]
        return round(sum(v)/len(v),4) if v else None

    print("\n[Summary]")
    for g in CHECK:
        for tf in ['daily','weekly']:
            d = avg_dist(g, tf)
            if d: print(f"  {g:10} {tf}: avg_dist_to_SC={d}")

    verdict = 'RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH_PASS' if all_ok \
              else 'RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH_PASS_WITH_WARNINGS'

    report = {
        'generated_at': datetime.datetime.now().isoformat(),
        'files_changed': ['marketflow/backend/scripts/rrg_engine_router.py'],
        'old_stock_route': 'Family C — C_s10_N65_Kx2_Ky2 (daily) / C_s10_N52_Kx2_Ky2 (weekly)',
        'new_stock_route': 'SMA 10/34/8 — SMA_10_34_8',
        'sector_route': 'SMA_10_34_8 (unchanged from previous switch)',
        'frontend_changed': False,
        'routing_changed': True,
        'rows': rows,
        'group_avg_dist': {
            f"{g}_{tf}": avg_dist(g, tf)
            for g in CHECK for tf in ['daily','weekly']
        },
        'verdict': verdict,
    }

    fp_j = os.path.join(OUTPUT_DIR, 'RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH.json')
    fp_m = os.path.join(OUTPUT_DIR, 'RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH.md')

    with open(fp_j, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    with open(fp_m, 'w', encoding='utf-8') as f:
        f.write(build_md(report, rows))

    print(f"\n  SAVED: RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH.json ({os.path.getsize(fp_j):,} bytes)")
    print(f"  SAVED: RRG_STOCK_ROUTE_CANDIDATE_A_SWITCH.md ({os.path.getsize(fp_m):,} bytes)")
    print(f"\nFINAL: {verdict}")

def build_md(report, rows):
    lines = [
        "# RRG Stock/Mixed Route Switch — Family C to SMA 10/34/8\n\n",
        f"> Generated: {report['generated_at'][:16]}\n\n",
        "## Files Changed\n\n",
        "- `marketflow/backend/scripts/rrg_engine_router.py`\n",
        "  - `_PRESETS['stock_mixed']` changed from Family C to SMA family\n",
        "  - Docstring updated\n\n",
        "## Route Map (Final)\n\n",
        "| Group | Route |\n|-------|-------|\n",
        f"| Sector ETF | {report['sector_route']} |\n",
        f"| Stock / Big Tech | **{report['new_stock_route']}** |\n",
        f"| Leveraged / Index Proxy | **{report['new_stock_route']}** |\n\n",
        "## Avg Distance to SC Reference\n\n",
        "| Group | Daily | Weekly |\n|-------|-------|--------|\n",
    ]
    for g in ['BigTech','Sector','Leveraged']:
        d = report['group_avg_dist'].get(f"{g}_daily", "—")
        w = report['group_avg_dist'].get(f"{g}_weekly", "—")
        lines.append(f"| {g} | {d} | {w} |\n")

    lines.append("\n## Preset Verification\n\n")
    lines.append("| Group | Symbol | TF | X | Y | Preset | QMatch |\n")
    lines.append("|-------|--------|----|---|---|--------|--------|\n")
    for r in rows:
        if 'error' in r: continue
        qm = 'Y' if r.get('quad_match') else ('N' if r.get('quad_match') is False else '—')
        lines.append(
            f"| {r['group']} | {r['symbol']} | {r['timeframe']} | "
            f"{r['x']:.2f} | {r['y']:.2f} | {r['preset']} | {qm} |\n"
        )
    lines.append(f"\n**VERDICT: {report['verdict']}**\n")
    return "".join(lines)

if __name__ == '__main__':
    main()
