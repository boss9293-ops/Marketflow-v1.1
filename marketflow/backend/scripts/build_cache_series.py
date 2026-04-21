"""
Collect and update cache.db macro series (standalone — no internal package imports).

Fetches:
  - PUT_CALL  : CBOE put/call ratio via collector fallback (Stooq -> proxy)
  - HY_OAS    : ICE BofA HY OAS via FRED (requires FRED_API_KEY)
  - IG_OAS    : ICE BofA IG OAS via FRED (requires FRED_API_KEY)
  - FSI       : St. Louis Financial Stress Index via FRED (requires FRED_API_KEY)
  - VIX       : CBOE VIX via FRED (requires FRED_API_KEY, fallback to market_daily)

Output:
  backend/output/cache/cache_series.json  (freshness status, used by startup staleness check)
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple

# ── Paths (must match DATA_DIR in build_risk_v1.py) ───────────────────────────
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPTS_DIR)


def _bootstrap_backend_root() -> str:
    search_roots = [
        SCRIPTS_DIR,
        BACKEND_DIR,
        os.path.abspath(os.path.join(SCRIPTS_DIR, "..", "..")),
        os.getcwd(),
    ]
    target_rels = [
        os.path.join("backend", "collectors", "collect_cboe.py"),
        os.path.join("collectors", "collect_cboe.py"),
    ]
    seen: set[str] = set()
    for root in search_roots:
        current = os.path.abspath(root)
        while current and current not in seen:
            seen.add(current)
            for target_rel in target_rels:
                if os.path.exists(os.path.join(current, target_rel)):
                    if current not in sys.path:
                        sys.path.insert(0, current)
                    return current
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent

    # Last-resort fallbacks for local dev / Railway flattening.
    for fallback in (
        os.path.abspath(os.path.join(SCRIPTS_DIR, "..", "..")),
        BACKEND_DIR,
        os.getcwd(),
    ):
        if fallback not in sys.path:
            sys.path.insert(0, fallback)
    return os.path.abspath(os.path.join(SCRIPTS_DIR, "..", ".."))


ROOT_DIR = _bootstrap_backend_root()
DATA_DIR    = os.path.join(ROOT_DIR, "data")
OUTPUT_DIR  = os.path.join(ROOT_DIR, "backend", "output", "cache")

CACHE_DB    = os.path.abspath(os.path.join(DATA_DIR, "cache.db"))
OUTPUT_JSON = os.path.join(OUTPUT_DIR, "cache_series.json")

# ── FRED config ───────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
    load_dotenv(os.path.join(BACKEND_DIR, "..", ".env"))
except ImportError:
    pass

FRED_API_KEY  = os.environ.get("FRED_API_KEY", "")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

FRED_SERIES = {
    "HY_OAS": "BAMLH0A0HYM2",
    "IG_OAS": "BAMLC0A0CM",
    "FSI":    "STLFSI4",
    "VIX":    "VIXCLS",
    "WALCL":  "WALCL",
    "RRP":    "RRPONTSYD",
    "EFFR":   "EFFR",
}

try:
    from backend.collectors.collect_cboe import run as collect_cboe
except ModuleNotFoundError:
    from collectors.collect_cboe import run as collect_cboe


# ── DB helpers ────────────────────────────────────────────────────────────────

def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS series_data (
            symbol  TEXT NOT NULL,
            date    TEXT NOT NULL,
            value   REAL NOT NULL,
            source  TEXT,
            asof    TEXT,
            quality TEXT,
            PRIMARY KEY (symbol, date)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_series_data_sym_date
        ON series_data (symbol, date)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS series_meta (
            symbol       TEXT PRIMARY KEY,
            source       TEXT,
            unit         TEXT,
            freq         TEXT,
            last_updated TEXT,
            quality      TEXT,
            notes        TEXT
        )
    """)
    conn.commit()


def upsert_series(
    conn: sqlite3.Connection,
    symbol: str,
    rows: List[Tuple[str, float]],
    source: str,
    quality: str = "OK",
    notes: str = "",
) -> int:
    if not rows:
        return 0
    asof = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    conn.executemany(
        """
        INSERT INTO series_data (symbol, date, value, source, asof, quality)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol, date) DO UPDATE SET
            value   = excluded.value,
            source  = excluded.source,
            asof    = excluded.asof,
            quality = excluded.quality
        """,
        [(symbol, d, v, source, asof, quality) for d, v in rows],
    )
    conn.execute(
        """
        INSERT INTO series_meta (symbol, source, unit, freq, last_updated, quality, notes)
        VALUES (?, ?, '', '', ?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
            source       = excluded.source,
            last_updated = excluded.last_updated,
            quality      = excluded.quality,
            notes        = excluded.notes
        """,
        (symbol, source, asof, quality, notes),
    )
    conn.commit()
    return len(rows)


# ── FRED fetcher ──────────────────────────────────────────────────────────────

def fetch_fred(series_id: str, start_date: str) -> List[Tuple[str, float]]:
    import time as _time
    try:
        import urllib.request, urllib.parse
    except ImportError:
        import urllib.request
    params = urllib.parse.urlencode({
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    })
    url = f"{FRED_BASE_URL}?{params}"
    last_exc: Exception = RuntimeError("no attempts")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as exc:
            last_exc = RuntimeError(f"FRED request failed for {series_id}: {exc}")
            if "500" in str(exc) and attempt < 2:
                wait = 10 * (attempt + 1)
                print(f"[cache_series] FRED {series_id} 500 error, retry in {wait}s ({attempt+1}/3)", flush=True)
                _time.sleep(wait)
            else:
                raise last_exc
    out: List[Tuple[str, float]] = []
    for obs in data.get("observations", []):
        d = obs.get("date", "")
        v = obs.get("value", "")
        if v in ("", ".", "null"):
            continue
        try:
            out.append((d, float(v)))
        except ValueError:
            continue
    return sorted(out, key=lambda x: x[0])


# ── Existing data check ───────────────────────────────────────────────────────

def last_date_in_db(conn: sqlite3.Connection, symbol: str) -> Optional[str]:
    row = conn.execute(
        "SELECT MAX(date) FROM series_data WHERE symbol=?", (symbol,)
    ).fetchone()
    return row[0] if row and row[0] else None


def needs_update(conn: sqlite3.Connection, symbol: str, max_stale_days: int = 3) -> bool:
    last = last_date_in_db(conn, symbol)
    if last is None:
        return True
    try:
        last_dt = date.fromisoformat(last)
        return (date.today() - last_dt).days > max_stale_days
    except ValueError:
        return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CACHE_DB), exist_ok=True)

    print(f"[cache_series] cache.db: {CACHE_DB}", flush=True)

    conn = sqlite3.connect(CACHE_DB)
    ensure_schema(conn)

    results: dict = {}
    generated_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    # ── VIX 먼저 처리 (PUT_CALL VIX proxy 폴백에 필요) ───────────────────────
    if FRED_API_KEY and needs_update(conn, "VIX", max_stale_days=3):
        try:
            start = (date.today() - timedelta(days=365 * 4)).isoformat()
            rows = fetch_fred(FRED_SERIES["VIX"], start)
            upsert_series(conn, "VIX", rows, source="FRED/VIXCLS", notes="FRED VIXCLS pre-fetch for PUT_CALL proxy")
            print(f"[cache_series] VIX pre-fetch: {len(rows)} rows, last={rows[-1][0] if rows else None}", flush=True)
        except Exception as exc:
            print(f"[cache_series] VIX pre-fetch FAILED: {exc}", flush=True)

    # ── PUT_CALL (collector fallback: Stooq -> CBOE CDN -> VIX proxy) ────────
    if needs_update(conn, "PUT_CALL"):
        try:
            collect_result = {}
            conn.close()
            try:
                collect_result = collect_cboe(cache_db_path=CACHE_DB)
            finally:
                conn = sqlite3.connect(CACHE_DB)
                ensure_schema(conn)
            last = last_date_in_db(conn, "PUT_CALL")
            n = int(collect_result.get("written") or 0)
            source = str(collect_result.get("source") or "STOOQ")
            quality = str(collect_result.get("quality") or "NA")
            print(f"[cache_series] PUT_CALL: {n} rows, last={last}, source={source}, quality={quality}", flush=True)
            results["PUT_CALL"] = {
                "ok": quality in ("OK", "PARTIAL"),
                "rows": n,
                "last": last,
                "source": source,
                "quality": quality,
            }
        except Exception as exc:
            print(f"[cache_series] PUT_CALL FAILED: {exc}", flush=True)
            last = last_date_in_db(conn, "PUT_CALL")
            if last:
                print(f"[cache_series] PUT_CALL: using cached data (last={last})", flush=True)
                results["PUT_CALL"] = {"ok": True, "last": last, "source": "cache_fallback", "fallback": True}
            else:
                results["PUT_CALL"] = {"ok": False, "error": str(exc)}
    else:
        last = last_date_in_db(conn, "PUT_CALL")
        print(f"[cache_series] PUT_CALL: skip (last={last})", flush=True)
        results["PUT_CALL"] = {"ok": True, "skipped": True, "last": last}

    # ── FRED series ───────────────────────────────────────────────────────────
    if not FRED_API_KEY:
        print("[cache_series] FRED_API_KEY not set — using cached data for FRED symbols", flush=True)
        for sym in FRED_SERIES:
            last = last_date_in_db(conn, sym)
            if last:
                print(f"[cache_series] {sym}: using cached data (last={last})", flush=True)
                results[sym] = {"ok": True, "last": last, "source": "cache_fallback", "fallback": True}
            else:
                results[sym] = {"ok": False, "error": "FRED_API_KEY not set"}
    else:
        start = (date.today() - timedelta(days=365 * 4)).isoformat()
        fred_stale_days = {"HY_OAS": 3, "IG_OAS": 3, "FSI": 10, "VIX": 3}
        for symbol, series_id in FRED_SERIES.items():
            if symbol == "VIX" and results.get("VIX"):
                continue  # already pre-fetched above
            stale = fred_stale_days.get(symbol, 5)
            if not needs_update(conn, symbol, max_stale_days=stale):
                last = last_date_in_db(conn, symbol)
                print(f"[cache_series] {symbol}: skip (last={last})", flush=True)
                results[symbol] = {"ok": True, "skipped": True, "last": last}
                continue
            try:
                rows = fetch_fred(series_id, start)
                n = upsert_series(conn, symbol, rows, source=f"FRED/{series_id}", notes=f"FRED series {series_id}")
                last = rows[-1][0] if rows else None
                print(f"[cache_series] {symbol}: {n} rows, last={last}", flush=True)
                results[symbol] = {"ok": True, "rows": n, "last": last}
            except Exception as exc:
                print(f"[cache_series] {symbol} FAILED: {exc}", flush=True)
                last = last_date_in_db(conn, symbol)
                if last:
                    print(f"[cache_series] {symbol}: using cached data (last={last})", flush=True)
                    results[symbol] = {"ok": True, "last": last, "source": "cache_fallback", "fallback": True}
                else:
                    results[symbol] = {"ok": False, "error": str(exc)}

    conn.close()

    payload = {
        "generated_at": generated_at,
        "data_date": date.today().isoformat(),
        "cache_db": CACHE_DB,
        "results": results,
    }
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"[OK] {OUTPUT_JSON}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
