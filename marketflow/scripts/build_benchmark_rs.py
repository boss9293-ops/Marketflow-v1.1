# 벤치마크 상대강도(RS) 캐시를 로컬 DB에서 계산해 JSON으로 저장하는 스크립트
import json
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH   = ROOT / 'marketflow/backend/data/cache.db'
OUT_PATH  = ROOT / 'marketflow/backend/output/cache/benchmark_rs_latest.json'

LEADING_PP  =  1.0
LAGGING_PP  = -1.0


def relative_status(rel: float | None) -> str:
    if rel is None:
        return 'Pending'
    if rel >= LEADING_PP:
        return 'Leading'
    if rel <= LAGGING_PP:
        return 'Lagging'
    return 'Neutral'


def safe_return(current: float | None, past: float | None) -> float | None:
    if current is None or past is None or past == 0:
        return None
    return round((current / past - 1) * 100, 2)


def safe_relative(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    return round(a - b, 2)


def load_latest_snapshots(cur) -> dict[str, dict]:
    cur.execute("""
        SELECT symbol, price, change_pct, as_of
        FROM core_price_snapshot
        WHERE symbol IN ('QQQ','SPY','SMH','SOXL')
        ORDER BY symbol, as_of DESC
    """)
    rows = cur.fetchall()
    latest: dict[str, dict] = {}
    for sym, price, chg, as_of in rows:
        if sym not in latest:
            latest[sym] = {'price': price, 'change_pct': chg, 'as_of': as_of}
    return latest


def load_snapshot_history(cur) -> dict[str, list[tuple[str, float]]]:
    """Return all snapshots per symbol sorted by date asc."""
    cur.execute("""
        SELECT symbol, as_of, price
        FROM core_price_snapshot
        WHERE symbol IN ('QQQ','SPY','SMH','SOXL')
        ORDER BY symbol, as_of ASC
    """)
    rows = cur.fetchall()
    hist: dict[str, list[tuple[str, float]]] = {}
    for sym, as_of, price in rows:
        hist.setdefault(sym, []).append((as_of[:10], price))
    return hist


def find_snapshot_price(hist: list[tuple[str, float]], target_date: str) -> float | None:
    """Return price closest to (but not after) target_date from snapshot history."""
    best = None
    for date_str, price in hist:
        if date_str <= target_date:
            best = price
        else:
            break
    return best


def load_series_price(cur, symbol: str, target_date: str) -> float | None:
    """Return closest series price on or before target_date."""
    cur.execute("""
        SELECT value FROM series_data
        WHERE symbol=? AND date<=?
        ORDER BY date DESC LIMIT 1
    """, (symbol, target_date))
    row = cur.fetchone()
    return row[0] if row else None


def calc_returns(sym: str, cur,
                 latest: dict[str, dict],
                 snap_hist: dict[str, list[tuple[str, float]]]) -> dict[str, float | None]:
    info = latest.get(sym)
    if info is None:
        return {tf: None for tf in ('1D', '5D', '1M', '3M', '6M', '1Y')}

    current = info['price']
    chg_pct = info['change_pct']
    today_str = info['as_of'][:10]
    today = datetime.strptime(today_str, '%Y-%m-%d')
    hist = snap_hist.get(sym, [])

    def date_str(d: datetime) -> str:
        return d.strftime('%Y-%m-%d')

    d5  = date_str(today - timedelta(days=7))    # ~5 trading days
    d1m = date_str(today - timedelta(days=31))
    d3m = date_str(today - timedelta(days=93))
    d6m = date_str(today - timedelta(days=186))
    d1y = date_str(today - timedelta(days=365))

    # 1D from change_pct (most accurate)
    r1d = round(chg_pct, 2) if chg_pct is not None else None

    # 5D / 1M — try snapshot history first (covers the gap period)
    p5d  = find_snapshot_price(hist, d5)
    p1m  = find_snapshot_price(hist, d1m)

    # 3M / 6M / 1Y — use series_data (covers historical period)
    p3m = load_series_price(cur, sym, d3m)
    p6m = load_series_price(cur, sym, d6m)
    p1y = load_series_price(cur, sym, d1y)

    return {
        '1D': r1d,
        '5D': safe_return(current, p5d),
        '1M': safe_return(current, p1m),
        '3M': safe_return(current, p3m),
        '6M': safe_return(current, p6m),
        '1Y': safe_return(current, p1y),
    }


def source_for(ret: float | None, tf: str) -> str:
    if ret is None:
        return 'PENDING'
    if tf == '1D':
        return 'snapshot_change_pct'
    if tf in ('5D', '1M'):
        return 'snapshot_history'
    return 'LOCAL_DB'


def main():
    if not DB_PATH.exists():
        print(f'ERROR: DB not found at {DB_PATH}')
        return

    db  = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()

    latest    = load_latest_snapshots(cur)
    snap_hist = load_snapshot_history(cur)

    symbols = {
        'SOXX': 'SMH',   # SOXX direct not in DB — use SMH as proxy
        'QQQ':  'QQQ',
        'SPY':  'SPY',
    }

    benchmarks: dict = {}
    for bench_id, db_sym in symbols.items():
        ret = calc_returns(db_sym, cur, latest, snap_hist)
        info = latest.get(db_sym, {})
        benchmarks[bench_id] = {
            'symbol':      bench_id,
            'proxy':       db_sym if db_sym != bench_id else None,
            'latestPrice': info.get('price'),
            'asOf':        (info.get('as_of') or '')[:10],
            'returns':     ret,
            'sources':     {tf: source_for(ret[tf], tf) for tf in ret},
        }

    # Relative: SOXX vs QQQ / SOXX vs SPY
    soxx_r = benchmarks['SOXX']['returns']
    qqq_r  = benchmarks['QQQ']['returns']
    spy_r  = benchmarks['SPY']['returns']

    timeframes = ('1D', '5D', '1M', '3M', '6M', '1Y')
    rel_vs_qqq = {tf: safe_relative(soxx_r[tf], qqq_r[tf]) for tf in timeframes}
    rel_vs_spy = {tf: safe_relative(soxx_r[tf], spy_r[tf]) for tf in timeframes}

    summary = {
        'SOXX_vs_QQQ': relative_status(rel_vs_qqq.get('1M')),
        'SOXX_vs_SPY': relative_status(rel_vs_spy.get('1M')),
        'primary_timeframe': '1M',
    }

    payload = {
        'generatedAt':  datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'note':         'SOXX uses SMH as proxy. Bucket-level RS pending.',
        'thresholds':   {'leading_pp': LEADING_PP, 'lagging_pp': LAGGING_PP},
        'benchmarks':   benchmarks,
        'relative': {
            'SOXX_vs_QQQ': rel_vs_qqq,
            'SOXX_vs_SPY': rel_vs_spy,
        },
        'summary': summary,
    }

    db.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = json.dumps(payload, ensure_ascii=False, indent=2)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(out)

    print(f'OK: benchmark RS written → {OUT_PATH}')
    print(f'    SOXX(SMH) 1D: {soxx_r["1D"]}, QQQ 1D: {qqq_r["1D"]}, SPY 1D: {spy_r["1D"]}')
    print(f'    SOXX vs QQQ (1M): {rel_vs_qqq.get("1M")} → {summary["SOXX_vs_QQQ"]}')
    print(f'    SOXX vs SPY (1M): {rel_vs_spy.get("1M")} → {summary["SOXX_vs_SPY"]}')


if __name__ == '__main__':
    main()
