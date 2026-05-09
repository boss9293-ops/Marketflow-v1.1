"""
Validate the SOXX holdings snapshot file for the SOXX/SOXL Lens engine.

Checks:
  - as-of date present
  - holding count > 0
  - total weight 98%–101%
  - no duplicate tickers
  - no zero/missing weights
  - no ticker assigned to multiple buckets
  - selected-bucket tickers exist in holdings

Usage:
  cd marketflow/backend
  python scripts/check_soxx_holdings.py
  python scripts/check_soxx_holdings.py --path data/semiconductor/soxx_holdings_snapshot.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_HOLDINGS_PATH = BACKEND_DIR / "data" / "semiconductor" / "soxx_holdings_snapshot.json"

SELECTED_BUCKET_IDS = {"ai_compute", "memory", "equipment", "foundry_packaging"}
WEIGHT_MIN = 98.0
WEIGHT_MAX = 101.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate SOXX holdings snapshot.")
    parser.add_argument(
        "--path",
        type=Path,
        default=DEFAULT_HOLDINGS_PATH,
        help="Path to soxx_holdings_snapshot.json",
    )
    return parser.parse_args()


def main(path: Path) -> int:
    print("SOXX Holdings Validation")
    print(f"File: {path}")

    if not path.exists():
        print("Status: FAIL")
        print("  FAIL: holdings snapshot file not found.")
        return 1

    try:
        payload: dict = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print("Status: FAIL")
        print(f"  FAIL: cannot parse JSON — {exc}")
        return 1

    issues: list[str] = []
    warnings: list[str] = []

    as_of = payload.get("as_of_date") or ""
    if not as_of:
        issues.append("as_of_date missing")

    holdings = payload.get("holdings")
    if not isinstance(holdings, list) or len(holdings) == 0:
        issues.append("holdings list is empty or missing")
        print(f"As-of date: {as_of or 'n/a'}")
        print("Status: FAIL")
        for msg in issues:
            print(f"  FAIL: {msg}")
        return 1

    holding_count = len(holdings)
    total_weight = sum(float(h.get("weightPct") or 0) for h in holdings if isinstance(h, dict))

    if not (WEIGHT_MIN <= total_weight <= WEIGHT_MAX):
        issues.append(
            f"total weight {total_weight:.5f}% outside expected range "
            f"({WEIGHT_MIN}%–{WEIGHT_MAX}%)"
        )

    ticker_list: list[str] = []
    for h in holdings:
        if not isinstance(h, dict):
            continue
        t = str(h.get("ticker") or "").strip().upper()
        if t:
            ticker_list.append(t)

    seen: set[str] = set()
    dupes: list[str] = []
    for t in ticker_list:
        if t in seen:
            if t not in dupes:
                dupes.append(t)
        seen.add(t)
    if dupes:
        issues.append(f"duplicate tickers: {', '.join(sorted(dupes))}")

    zero_weight = [
        str(h.get("ticker") or "n/a")
        for h in holdings
        if isinstance(h, dict) and not h.get("weightPct")
    ]
    if zero_weight:
        warnings.append(f"zero/missing weight tickers: {', '.join(sorted(zero_weight))}")

    ticker_buckets: dict[str, list[str]] = {}
    for h in holdings:
        if not isinstance(h, dict):
            continue
        t = str(h.get("ticker") or "").strip().upper()
        b = str(h.get("bucketId") or "").strip()
        if t and b:
            ticker_buckets.setdefault(t, []).append(b)

    multi_bucket = {t: bs for t, bs in ticker_buckets.items() if len(bs) > 1}
    if multi_bucket:
        detail = ", ".join(
            f"{t}→[{','.join(bs)}]" for t, bs in sorted(multi_bucket.items())
        )
        issues.append(f"tickers in multiple buckets: {detail}")

    selected_tickers = {
        t for t, bs in ticker_buckets.items()
        if any(b in SELECTED_BUCKET_IDS for b in bs)
    }

    status = "FAIL" if issues else ("PARTIAL" if warnings else "PASS")

    print(f"As-of date: {as_of or 'n/a'}")
    print(f"Holdings count: {holding_count}")
    print(f"Total weight: {total_weight:.5f}%")
    print(f"Selected bucket tickers: {len(selected_tickers)}")
    print(f"Status: {status}")

    for msg in issues:
        print(f"  FAIL: {msg}")
    for msg in warnings:
        print(f"  WARN: {msg}")
    if not issues and not warnings:
        print("  All checks passed.")

    return 0 if status in {"PASS", "PARTIAL"} else 1


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(main(args.path))
