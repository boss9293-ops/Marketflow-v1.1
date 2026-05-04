"""
Candidate F QA script — Steps 4-6 of WORK_ORDER.

Step 4: SPY self-test (should be 100.0 ±0.01)
Step 5: Phase 1 — megacap daily (TSLA, NVDA, AAPL, AMZN, GOOGL, MSFT, META)
Step 6: Phase 2 — sector weekly (XLK, XLV, XLF, XLE, XLY, XLP, XLI, XLU, XLC)
        Phase 3 — mixed daily (TSLA, NVDA, AAPL, XLK, XLE, XLV, XLF)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from rrg_calculator import load_daily
from rrg_candidate_f import calc_rrg_candidate_f, run_self_test

MEGACAP = ['TSLA', 'NVDA', 'AAPL', 'AMZN', 'GOOGL', 'MSFT', 'META']
SECTORS  = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLU', 'XLC']
MIXED    = ['TSLA', 'NVDA', 'AAPL', 'XLK', 'XLE', 'XLV', 'XLF']

COORD_FLOOR = 80.0
COORD_CEIL  = 120.0


def _check_bounds(df, sym):
    issues = []
    latest = df.iloc[-1]
    for col in ('rs_ratio', 'rs_momentum'):
        v = float(latest[col])
        if not (COORD_FLOOR <= v <= COORD_CEIL):
            issues.append(f"{col}={v:.2f} out of [{COORD_FLOOR},{COORD_CEIL}]")
    if df[['rs_ratio', 'rs_momentum']].isna().any().any():
        issues.append("NaN in output")
    return issues


def run_phase(name, symbols, benchmark, timeframe):
    print(f"\n--- {name} (bench={benchmark}, tf={timeframe}) ---")
    bench = load_daily(benchmark, lookback_days=900)
    if bench is None:
        print(f"  FAIL: cannot load benchmark {benchmark}")
        return
    if timeframe == 'weekly':
        bench = bench.resample('W-FRI').last().dropna()

    ok = 0
    for sym in symbols:
        raw = load_daily(sym, lookback_days=900)
        if raw is None:
            print(f"  {sym}: FAIL load")
            continue
        close = raw.resample('W-FRI').last().dropna() if timeframe == 'weekly' else raw
        try:
            df = calc_rrg_candidate_f(close, bench, timeframe=timeframe)
        except Exception as e:
            print(f"  {sym}: EXCEPTION {e}")
            continue
        if len(df) == 0:
            print(f"  {sym}: empty output")
            continue
        latest = df.iloc[-1]
        issues = _check_bounds(df, sym)
        status = "OK" if not issues else f"WARN {issues}"
        print(f"  {sym}: ratio={latest['rs_ratio']:.3f} mom={latest['rs_momentum']:.3f} "
              f"quad={latest['quadrant']!s:12s} rows={len(df)} {status}")
        if not issues:
            ok += 1
    print(f"  => {ok}/{len(symbols)} clean")


def main():
    # Step 4: SPY self-test
    print("=== Step 4: SPY self-test ===")
    result = run_self_test(lambda sym: load_daily(sym, lookback_days=500))
    if result.get('pass'):
        print(f"  PASS  max_x_err={result['max_x_err']}  max_y_err={result['max_y_err']}")
    else:
        print(f"  FAIL  {result}")
        sys.exit(1)

    # Step 5: Phase 1 megacap daily
    run_phase("Phase 1 - Megacap Daily", MEGACAP, 'SPY', 'daily')

    # Step 6: Phase 2 sector weekly
    run_phase("Phase 2 - Sector Weekly", SECTORS, 'SPY', 'weekly')

    # Step 6 cont: Phase 3 mixed daily
    run_phase("Phase 3 - Mixed Daily", MIXED, 'SPY', 'daily')

    print("\n=== QA complete ===")


if __name__ == '__main__':
    main()
