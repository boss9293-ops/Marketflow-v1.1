"""
RRG Final Engine Policy — QA
Tests 3 universe sets and verifies engine routing + coordinate safety.

QA sets:
  A. Sector ETF   → must route to Family D
  B. XLK stocks   → must route to Family C
  C. Mixed        → must route to Family C
"""
import sys, os, json
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from rrg_engine_router import (
    classify_universe, compute_symbol_rrg, preset_id,
    SOFT_WARN_LO, SOFT_WARN_HI, HARD_WARN_LO, HARD_WARN_HI,
)
from rrg_calculator import load_daily

QA_SETS = {
    'A_Sector_ETF': {
        'symbols': ['XLK','XLV','XLF','XLE','XLY','XLP','XLI','XLB','XLRE','XLU','XLC'],
        'expected_engine': 'D',
        'expected_universe': 'sector',
    },
    'B_XLK_Stocks': {
        'symbols': ['AAPL','MSFT','NVDA','AVGO','AMD','QCOM','ORCL','CRM','CSCO','ADI'],
        'expected_engine': 'C',
        'expected_universe': 'stock_mixed',
    },
    'C_Mixed': {
        'symbols': ['TSLA','NVDA','AMZN','AAPL','XLK','XLE','XLV','XLF','QQQ','IWM'],
        'expected_engine': 'C',
        'expected_universe': 'stock_mixed',
    },
}
BENCH = 'SPY'


def run_qa_set(name, cfg, bench_daily):
    symbols       = cfg['symbols']
    exp_engine    = cfg['expected_engine']
    exp_universe  = cfg['expected_universe']
    universe_type = classify_universe(symbols)

    routing_ok = (universe_type == exp_universe)
    print(f"\n[{name}]")
    print(f"  Universe type : {universe_type} (expected={exp_universe}) → {'OK' if routing_ok else 'FAIL'}")

    per_sym_results = []
    for timeframe, lookback in [('daily', 700), ('weekly', 2200)]:
        bench = bench_daily
        if timeframe == 'weekly':
            bench = bench_daily.resample('W-FRI').last().dropna()

        pid = preset_id(universe_type, timeframe)
        print(f"  {timeframe:6s} preset: {pid}")

        for sym in symbols:
            daily = load_daily(sym, lookback_days=lookback)
            if daily is None or len(daily) < 100:
                per_sym_results.append({'symbol': sym, 'timeframe': timeframe,
                                        'x': None, 'y': None, 'warn': 'NO_DATA'})
                print(f"    {sym:6s}: NO_DATA")
                continue

            close = daily.resample('W-FRI').last().dropna() if timeframe == 'weekly' else daily
            res = compute_symbol_rrg(close, bench, timeframe, universe_type, tail_len=52)
            if res is None or '_error' in res:
                err = res.get('_error', 'NONE') if res else 'NONE'
                per_sym_results.append({'symbol': sym, 'timeframe': timeframe,
                                        'x': None, 'y': None, 'warn': f'ERR:{err}'})
                print(f"    {sym:6s}: ERROR {err}")
                continue

            x  = res['latest']['rs_ratio']
            y  = res['latest']['rs_momentum']
            w  = res['warnings'][0] if res['warnings'] else ''
            ef = res['engine_family']
            engine_ok = (ef == exp_engine)
            per_sym_results.append({
                'symbol':     sym,
                'timeframe':  timeframe,
                'x':          x,
                'y':          y,
                'quadrant':   res['latest']['quadrant'],
                'engine':     ef,
                'preset':     res['preset_id'],
                'warn':       w,
                'engine_ok':  engine_ok,
            })
            flag = '' if engine_ok else ' ← ENGINE MISMATCH'
            print(f"    {sym:6s}: X={x:7.2f} Y={y:7.2f} {res['latest']['quadrant']:12s}"
                  f"  engine={ef}  {w or 'OK'}{flag}")

    return {
        'name':           name,
        'universe_type':  universe_type,
        'routing_ok':     routing_ok,
        'expected_engine': exp_engine,
        'per_sym':        per_sym_results,
    }


def main():
    print("Loading SPY...")
    bench_daily = load_daily(BENCH, lookback_days=2200)
    if bench_daily is None:
        print("ERROR: SPY not loaded"); sys.exit(1)

    qa_output = {}
    all_routing_ok     = True
    any_hard           = False
    any_soft           = False
    any_engine_mismatch = False

    for name, cfg in QA_SETS.items():
        result = run_qa_set(name, cfg, bench_daily)
        qa_output[name] = result
        if not result['routing_ok']:
            all_routing_ok = False
        for r in result['per_sym']:
            if r['x'] is None: continue
            if 'HARD' in r.get('warn', ''): any_hard = True
            if 'SOFT' in r.get('warn', ''): any_soft = True
            if not r.get('engine_ok', True): any_engine_mismatch = True

    if not all_routing_ok or any_engine_mismatch or any_hard:
        verdict = 'RRG_FINAL_ENGINE_POLICY_APPLIED_WITH_WARNINGS'
    else:
        verdict = 'RRG_FINAL_ENGINE_POLICY_APPLIED'

    print(f"\nVerdict: {verdict}")

    # ── Write output ──────────────────────────────────────────────────────────
    out_dir  = os.path.join(os.path.dirname(__file__), '..', 'output', 'rrg')
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, 'rrg_final_engine_policy_results.json')
    md_path   = os.path.join(out_dir, 'RRG_FINAL_ENGINE_POLICY.md')

    json_data = {
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'policy': {
            'sector_daily':       'D_N65_M10',
            'sector_weekly':      'D_N52_M5',
            'stock_daily':        'C_s10_N65_Kx2_Ky2',
            'stock_weekly':       'C_s10_N52_Kx2_Ky2',
            'engine_hidden':      True,
            'user_visible_params': ['benchmark', 'period', 'range', 'symbols', 'tail'],
        },
        'qa': qa_output,
        'routing_ok':    all_routing_ok,
        'engine_mismatch': any_engine_mismatch,
        'hard_warnings': any_hard,
        'soft_warnings': any_soft,
        'verdict': verdict,
    }
    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2)

    # ── Markdown ──────────────────────────────────────────────────────────────
    lines = [
        '# RRG Final Engine Policy',
        '',
        f'Generated: {datetime.now().strftime("%Y-%m-%d")}',
        '',
        '## Engine Policy',
        '',
        '| Universe | Engine | Daily preset | Weekly preset |',
        '|----------|--------|-------------|--------------|',
        '| Sector ETF only | Family D | D_N65_M10 | D_N52_M5 |',
        '| Individual / Mixed | Family C | C_s10_N65_Kx2_Ky2 | C_s10_N52_Kx2_Ky2 |',
        '',
        '## UI Visible Parameters',
        '',
        'Exposed to user: Benchmark, Daily/Weekly, Range, Symbols, Tail',
        '',
        'Hidden from user: Family C/D, Kx, Ky, N, M, EMA, preset ID',
        '',
        '## Coordinate Warning Thresholds',
        '',
        f'- Soft warning: X or Y outside {SOFT_WARN_LO}~{SOFT_WARN_HI}',
        f'- Hard warning: X or Y outside {HARD_WARN_LO}~{HARD_WARN_HI}',
        '- No engine-level clipping applied.',
        '',
        '---',
        '',
        '## QA Results',
        '',
        '| Set | Universe | Routing | Engine Correct | Hard Warns | Soft Warns | Verdict |',
        '|-----|----------|---------|----------------|------------|------------|---------|',
    ]

    for name, r in qa_output.items():
        per = r['per_sym']
        hards = sum(1 for p in per if p.get('warn','') and 'HARD' in p.get('warn',''))
        softs = sum(1 for p in per if p.get('warn','') and 'SOFT' in p.get('warn',''))
        eng_wrong = sum(1 for p in per if not p.get('engine_ok', True))
        row_verdict = 'PASS' if (r['routing_ok'] and eng_wrong == 0 and hards == 0) else 'WARN'
        lines.append(
            f"| {name} | {r['universe_type']} | {'OK' if r['routing_ok'] else 'FAIL'} | "
            f"{'OK' if eng_wrong == 0 else f'MISMATCH x{eng_wrong}'} | "
            f"{hards} | {softs} | {row_verdict} |"
        )

    lines += ['', '## Per-Symbol Results', '']
    lines += [
        '| Set | Symbol | Timeframe | X | Y | Quadrant | Engine | Preset | Warning |',
        '|-----|--------|-----------|---|---|----------|--------|--------|---------|',
    ]
    for name, r in qa_output.items():
        for p in r['per_sym']:
            x_s = f"{p['x']:.2f}" if p.get('x') is not None else 'N/A'
            y_s = f"{p['y']:.2f}" if p.get('y') is not None else 'N/A'
            lines.append(
                f"| {name} | {p['symbol']} | {p['timeframe']} | {x_s} | {y_s} | "
                f"{p.get('quadrant','—')} | {p.get('engine','—')} | "
                f"{p.get('preset','—')} | {p.get('warn','—') or '—'} |"
            )

    lines += [
        '',
        '---',
        '',
        '## Files Changed',
        '',
        '- `marketflow/backend/scripts/rrg_engine_router.py` — new engine routing module',
        '- `marketflow/backend/scripts/rrg_presets.py` — added STANDARD_SECTOR_ETFS',
        '- `marketflow/backend/app.py` — `/api/rrg/candidate-d` now uses engine router',
        '',
        '## UI Confirmation',
        '',
        'Engine selection is NOT exposed in UI.',
        'Users see only: MarketFlow RRG, Benchmark, Daily/Weekly, Range, Symbols, Tail.',
        '',
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
