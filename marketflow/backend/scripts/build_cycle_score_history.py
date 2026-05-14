# cycle_score_history 테이블 생성 + 90일 백필 스크립트 (1회 실행 후 매일 cron)
import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DB_PATH = ROOT / 'marketflow' / 'data' / 'marketflow.db'

SYMBOLS = {
    'soxx':      'SOXX',
    'compute':   ['NVDA', 'AMD'],
    'memory':    ['MU'],
    'equipment': ['AMAT', 'LRCX', 'KLAC', 'ASML'],
}

PHASE_LABELS = {
    'PEAK':        'PEAK',
    'EXPANSION':   'EXPANSION',
    'EARLY_CYCLE': 'EARLY_CYCLE',
    'CONTRACTION': 'CONTRACTION',
}

def to_phase(score: float) -> str:
    if score >= 72: return 'PEAK'
    if score >= 48: return 'EXPANSION'
    if score >= 28: return 'EARLY_CYCLE'
    return 'CONTRACTION'

def composite(soxx_rebased, rel_compute, rel_memory, rel_equipment) -> float:
    soxx_pct    = soxx_rebased - 100
    ai_lead     = (rel_compute   - 1) * 40
    mem_penalty = (rel_memory    - 1) * -15
    eq_penalty  = (rel_equipment - 1) * -10
    raw = 50 + soxx_pct * 0.5 + ai_lead + mem_penalty + eq_penalty
    return round(min(100, max(0, raw)) * 10) / 10

def fetch_prices(conn, symbols: list[str], limit: int = 160) -> dict[str, list[tuple]]:
    result = {}
    for sym in symbols:
        rows = conn.execute(
            "SELECT date, adj_close FROM ohlcv_daily "
            "WHERE symbol=? AND adj_close IS NOT NULL AND adj_close > 0 "
            "ORDER BY date DESC LIMIT ?",
            (sym, limit)
        ).fetchall()
        result[sym] = list(reversed(rows))  # 오래된 순서로
    return result

def avg_price(price_map: dict, syms: list[str], date: str) -> float | None:
    vals = [price_map[s].get(date) for s in syms if s in price_map and date in price_map[s]]
    return sum(vals) / len(vals) if vals else None

def build_price_map(prices: dict, syms: list[str]) -> dict[str, dict[str, float]]:
    return {sym: {row[0]: row[1] for row in prices.get(sym, [])} for sym in syms}

def create_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cycle_score_history (
            date        TEXT PRIMARY KEY,
            score       REAL NOT NULL,
            phase       TEXT NOT NULL,
            source      TEXT DEFAULT 'backfill',
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cycle_score_date ON cycle_score_history(date DESC)")
    conn.commit()

def backfill(conn, trading_days: int = 90):
    all_syms = [SYMBOLS['soxx']] + SYMBOLS['compute'] + SYMBOLS['memory'] + SYMBOLS['equipment']
    prices_raw = fetch_prices(conn, all_syms, limit=160)

    soxx_map   = {row[0]: row[1] for row in prices_raw.get('SOXX', [])}
    compute_map = build_price_map(prices_raw, SYMBOLS['compute'])
    memory_map  = build_price_map(prices_raw, SYMBOLS['memory'])
    equip_map   = build_price_map(prices_raw, SYMBOLS['equipment'])

    # SOXX 거래일 기준 마지막 N일
    soxx_dates = sorted(soxx_map.keys())
    window_dates = soxx_dates[-trading_days:]

    if len(window_dates) < 5:
        print(f"데이터 부족: {len(window_dates)}일")
        return 0

    base_date   = window_dates[0]
    base_soxx   = soxx_map[base_date]
    base_compute  = avg_price(compute_map, SYMBOLS['compute'], base_date)
    base_memory   = avg_price(memory_map,  SYMBOLS['memory'],  base_date)
    base_equip    = avg_price(equip_map,   SYMBOLS['equipment'], base_date)

    if not all([base_soxx, base_compute, base_memory, base_equip]):
        print("기준일 데이터 누락")
        return 0

    count = 0
    for date in window_dates:
        s_soxx    = soxx_map.get(date)
        s_compute = avg_price(compute_map, SYMBOLS['compute'],   date)
        s_memory  = avg_price(memory_map,  SYMBOLS['memory'],    date)
        s_equip   = avg_price(equip_map,   SYMBOLS['equipment'], date)

        if not all([s_soxx, s_compute, s_memory, s_equip]):
            continue

        soxx_rebased   = (s_soxx    / base_soxx)    * 100
        rel_compute    = (s_compute / base_compute)  / (s_soxx / base_soxx)
        rel_memory     = (s_memory  / base_memory)   / (s_soxx / base_soxx)
        rel_equipment  = (s_equip   / base_equip)    / (s_soxx / base_soxx)

        score = composite(soxx_rebased, rel_compute, rel_memory, rel_equipment)
        phase = to_phase(score)

        conn.execute(
            "INSERT OR REPLACE INTO cycle_score_history (date, score, phase, source) VALUES (?,?,?,?)",
            (date, score, phase, 'backfill')
        )
        count += 1

    conn.commit()
    return count

def save_today(conn, score: float, phase: str):
    today = datetime.utcnow().strftime('%Y-%m-%d')
    conn.execute(
        "INSERT OR REPLACE INTO cycle_score_history (date, score, phase, source) VALUES (?,?,?,?)",
        (today, score, phase, 'live')
    )
    conn.commit()

if __name__ == '__main__':
    print(f"DB: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    create_table(conn)
    n = backfill(conn, trading_days=90)
    print(f"백필 완료: {n}일")

    # 샘플 출력
    rows = conn.execute(
        "SELECT date, score, phase FROM cycle_score_history ORDER BY date DESC LIMIT 5"
    ).fetchall()
    for r in rows:
        print(f"  {r[0]}: score={r[1]:.1f} phase={r[2]}")
    conn.close()
