"""
Turso incremental sync (HTTP API 방식).
- 전체 DB 대신 ohlcv_daily / market_daily의 새 행만 업로드
- run_pipeline_scheduled.py 에서 파이프라인 성공 후 자동 호출됨
- 직접 실행도 가능: python sync_marketflow_to_turso.py
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services.data_contract import live_db_path  # noqa: E402

# ── Turso 설정
DEFAULT_TURSO_URL = "https://marketos-boss9293.aws-us-east-1.turso.io"

# 업로드 대상 심볼 (macro LiveTimeline + 주요 ETF)
TARGET_SYMBOLS = ["QQQ", "TQQQ", "SPY", "IWM", "TLT", "GLD", "VXX", "SOXL", "SOXS"]

# HTTP 배치 크기 (Turso 파이프라인은 요청당 최대 ~100 statements 권장)
BATCH_SIZE = 100


def _env(*names: str) -> str:
    for name in names:
        v = os.environ.get(name, "").strip()
        if v:
            return v
    return ""


def _turso_pipeline(pipe_url: str, token: str, statements: list[dict]) -> dict:
    body = json.dumps({"requests": statements}).encode()
    req = urllib.request.Request(
        pipe_url,
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def _scalar(pipe_url: str, token: str, sql: str):
    res = _turso_pipeline(pipe_url, token, [
        {"type": "execute", "stmt": {"sql": sql}},
        {"type": "close"},
    ])
    try:
        return res["results"][0]["response"]["result"]["rows"][0][0]["value"]
    except (KeyError, IndexError, TypeError):
        return None


def _insert_batch(pipe_url: str, token: str, sql: str, rows: list[tuple]) -> None:
    if not rows:
        return
    stmts = []
    for row in rows:
        args = [
            {"type": "null"} if v is None else {"type": "text", "value": str(v)}
            for v in row
        ]
        stmts.append({"type": "execute", "stmt": {"sql": sql, "args": args}})
    stmts.append({"type": "close"})
    _turso_pipeline(pipe_url, token, stmts)


def main() -> int:
    turso_url = _env("TURSO_DATABASE_URL", "LIBSQL_URL", "TURSO_URL") or DEFAULT_TURSO_URL
    token = _env("TURSO_AUTH_TOKEN", "LIBSQL_AUTH_TOKEN", "TURSO_TOKEN")

    if not token:
        print("[TURSO-SYNC] Skipped: TURSO_AUTH_TOKEN not set.", flush=True)
        return 0

    # https:// URL로 정규화
    http_url = turso_url.replace("libsql://", "https://").rstrip("/")
    pipe_url = f"{http_url}/v2/pipeline"

    local_db = str(live_db_path())
    if not os.path.exists(local_db):
        print(f"[TURSO-SYNC] Skipped: local DB not found: {local_db}", flush=True)
        return 0

    print(f"[TURSO-SYNC] Target: {http_url}", flush=True)
    print(f"[TURSO-SYNC] Source: {local_db}", flush=True)
    t0 = time.time()

    # ── 1. Turso 현재 최신 날짜 확인
    try:
        qqq_latest = _scalar(pipe_url, token,
                             "SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'")
        mkt_latest = _scalar(pipe_url, token,
                             "SELECT MAX(date) FROM market_daily WHERE vix IS NOT NULL")
    except Exception as exc:
        print(f"[TURSO-SYNC][FAIL] Cannot reach Turso: {exc}", flush=True)
        return 1

    ohlcv_cutoff = qqq_latest or "2020-01-01"
    mkt_cutoff = mkt_latest or "2020-01-01"
    print(f"[TURSO-SYNC] ohlcv cutoff={ohlcv_cutoff}  market cutoff={mkt_cutoff}", flush=True)

    # ── 2. 로컬 DB에서 신규 데이터만 읽기
    src = sqlite3.connect(local_db)
    src.row_factory = sqlite3.Row

    ph = ",".join("?" for _ in TARGET_SYMBOLS)
    ohlcv_rows = src.execute(
        f"""SELECT date, symbol, open, high, low, close, volume
            FROM ohlcv_daily
            WHERE symbol IN ({ph}) AND date > ?
            ORDER BY date""",
        [*TARGET_SYMBOLS, ohlcv_cutoff],
    ).fetchall()

    market_rows = src.execute(
        """SELECT date, spy, qqq, iwm, vix, us10y, us2y, dxy, oil, gold
           FROM market_daily
           WHERE date > ? AND vix IS NOT NULL
           ORDER BY date""",
        [mkt_cutoff],
    ).fetchall()
    src.close()

    print(f"[TURSO-SYNC] New ohlcv rows: {len(ohlcv_rows)}", flush=True)
    print(f"[TURSO-SYNC] New market rows: {len(market_rows)}", flush=True)

    if not ohlcv_rows and not market_rows:
        print(f"[TURSO-SYNC] Already up-to-date. ({time.time()-t0:.1f}s)", flush=True)
        return 0

    # ── 3. ohlcv_daily upsert
    if ohlcv_rows:
        sql = (
            "INSERT OR IGNORE INTO ohlcv_daily "
            "(date, symbol, open, high, low, close, volume) VALUES (?,?,?,?,?,?,?)"
        )
        uploaded = 0
        for i in range(0, len(ohlcv_rows), BATCH_SIZE):
            batch = [
                (r["date"], r["symbol"], r["open"], r["high"], r["low"], r["close"], r["volume"])
                for r in ohlcv_rows[i : i + BATCH_SIZE]
            ]
            _insert_batch(pipe_url, token, sql, batch)
            uploaded += len(batch)
            print(f"[TURSO-SYNC] ohlcv: {uploaded}/{len(ohlcv_rows)}", flush=True)
        print(f"[TURSO-SYNC] ohlcv_daily: {uploaded} rows OK", flush=True)

    # ── 4. market_daily upsert
    if market_rows:
        sql = (
            "INSERT OR IGNORE INTO market_daily "
            "(date, spy, qqq, iwm, vix, us10y, us2y, dxy, oil, gold) VALUES (?,?,?,?,?,?,?,?,?,?)"
        )
        batch = [
            (r["date"], r["spy"], r["qqq"], r["iwm"], r["vix"],
             r["us10y"], r["us2y"], r["dxy"], r["oil"], r["gold"])
            for r in market_rows
        ]
        _insert_batch(pipe_url, token, sql, batch)
        print(f"[TURSO-SYNC] market_daily: {len(batch)} rows OK", flush=True)

    # ── 5. 검증
    qqq_new = _scalar(pipe_url, token,
                      "SELECT MAX(date) FROM ohlcv_daily WHERE symbol='QQQ'")
    total = _scalar(pipe_url, token, "SELECT COUNT(*) FROM ohlcv_daily")
    print(
        f"[TURSO-SYNC] Done in {time.time()-t0:.1f}s | "
        f"ohlcv total={total} QQQ latest={qqq_new}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
