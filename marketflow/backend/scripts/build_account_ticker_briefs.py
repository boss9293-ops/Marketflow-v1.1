from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
OUTPUT_DIR = BACKEND_DIR / "output"
CACHE_DIR = OUTPUT_DIR / "cache"
SUMMARY_PATH = CACHE_DIR / "ticker_brief_index.json"
TICKER_BRIEF_SCRIPT = SCRIPT_DIR / "build_ticker_brief.py"
DB_PATH = ROOT_DIR / "marketflow" / "data" / "marketflow.db"
ET_ZONE = ZoneInfo("America/New_York")
CHUNK_SIZE = 20
CHUNK_TIMEOUT_SEC = 1800

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from build_ticker_brief import DEFAULT_WATCHLIST  # type: ignore
except Exception:
    DEFAULT_WATCHLIST = [
        "NVDA",
        "GOOGL",
        "AMZN",
        "INTC",
        "CAT",
        "XOM",
        "AAPL",
        "TSLA",
        "QQQ",
        "SPY",
    ]


def _load_json(path: Path) -> Any:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _normalize_symbol(value: Any) -> str:
    text = str(value or "").strip().upper()
    if not text:
        return ""
    if text in {"-", "—", "N/A", "NA"}:
        return ""
    text = text.strip(".,;:()[]{}")
    if not text:
        return ""
    if not re.match(r"^[A-Z0-9.\-^=]{1,20}$", text):
        return ""
    return text


def _iter_position_rows(payload: Any) -> Iterable[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    rows: list[dict[str, Any]] = []

    tabs = payload.get("tabs")
    if isinstance(tabs, list):
        for tab in tabs:
            if isinstance(tab, dict):
                positions = tab.get("positions")
                if isinstance(positions, list):
                    rows.extend([row for row in positions if isinstance(row, dict)])

    goal = payload.get("goal")
    if isinstance(goal, dict):
        positions = goal.get("positions")
        if isinstance(positions, list):
            rows.extend([row for row in positions if isinstance(row, dict)])

    positions = payload.get("positions")
    if isinstance(positions, list):
        rows.extend([row for row in positions if isinstance(row, dict)])

    return rows


def _extract_positions_from_file(path: Path) -> list[str]:
    payload = _load_json(path)
    if payload is None:
        return []

    symbols: list[str] = []
    seen: set[str] = set()
    for row in _iter_position_rows(payload):
        symbol = _normalize_symbol(
            row.get("symbol")
            or row.get("ticker")
            or row.get("종목")
        )
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        symbols.append(symbol)
    return symbols


def _collect_holdings_symbols() -> list[str]:
    sources = [
        BACKEND_DIR / "output" / "my_holdings_tabs.json",
        BACKEND_DIR / "output" / "my_holdings_ts.json",
    ]
    symbols: list[str] = []
    seen: set[str] = set()
    for source in sources:
        for symbol in _extract_positions_from_file(source):
            if symbol in seen:
                continue
            seen.add(symbol)
            symbols.append(symbol)
    return symbols


def _collect_watchlist_symbols() -> list[str]:
    if not DB_PATH.exists():
        return []

    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            rows = conn.execute(
                "SELECT symbol FROM watchlist_symbols WHERE symbol IS NOT NULL AND TRIM(symbol) <> '' ORDER BY created_at DESC, id DESC"
            ).fetchall()
    except Exception:
        return []

    symbols: list[str] = []
    seen: set[str] = set()
    for row in rows:
        symbol = _normalize_symbol(row[0] if row else "")
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        symbols.append(symbol)
    return symbols


def _merge_symbols(*groups: Iterable[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for symbol in group:
            norm = _normalize_symbol(symbol)
            if not norm or norm in seen:
                continue
            seen.add(norm)
            merged.append(norm)
    return merged


def _chunked(values: list[str], size: int) -> list[list[str]]:
    if size <= 0:
        return [values]
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def _run_ticker_brief_builder(symbols: list[str]) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return subprocess.run(
        [sys.executable, "-X", "utf8", str(TICKER_BRIEF_SCRIPT), *symbols],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=CHUNK_TIMEOUT_SEC,
        env=env,
    )


def _write_summary(symbols: list[str], holdings: list[str], watchlist: list[str]) -> None:
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(tz=ET_ZONE).isoformat(timespec="seconds"),
        "date": datetime.now(tz=ET_ZONE).date().isoformat(),
        "builder": "build_ticker_brief.py",
        "symbol_count": len(symbols),
        "holdings_count": len(holdings),
        "watchlist_count": len(watchlist),
        "symbols": symbols,
        "holdings_symbols": holdings,
        "watchlist_symbols": watchlist,
        "source_files": [
            str(path.relative_to(ROOT_DIR))
            for path in [
                BACKEND_DIR / "output" / "my_holdings_tabs.json",
                BACKEND_DIR / "output" / "my_holdings_ts.json",
                DB_PATH,
            ]
            if path.exists()
        ],
    }
    SUMMARY_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    holdings = _collect_holdings_symbols()
    watchlist = _collect_watchlist_symbols()
    fallback = [sym for sym in DEFAULT_WATCHLIST if _normalize_symbol(sym)]
    symbols = _merge_symbols(holdings, watchlist, fallback)

    if not symbols:
        symbols = _merge_symbols(fallback)

    print("[ticker-brief-pipeline] holdings=", len(holdings), "watchlist=", len(watchlist), "symbols=", len(symbols))
    print("[ticker-brief-pipeline] summary=", SUMMARY_PATH)

    if not symbols:
        print("[ticker-brief-pipeline] no symbols available")
        return 0

    chunks = _chunked(symbols, CHUNK_SIZE)
    all_ok = True
    for idx, chunk in enumerate(chunks, start=1):
        print(f"[ticker-brief-pipeline] chunk {idx}/{len(chunks)}: {', '.join(chunk)}")
        proc = _run_ticker_brief_builder(chunk)
        tail = (proc.stdout or proc.stderr or "").strip()
        if proc.returncode != 0:
            all_ok = False
            print(f"[ticker-brief-pipeline][FAIL] chunk {idx} rc={proc.returncode}")
            if tail:
                print(tail[-4000:])
            break
        if tail:
            print(tail[-4000:])

    if not all_ok:
        return 1

    _write_summary(symbols, holdings, watchlist)
    print(f"[ticker-brief-pipeline][OK] wrote {SUMMARY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
