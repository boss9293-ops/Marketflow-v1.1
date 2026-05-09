# -*- coding: utf-8 -*-
"""
Build SOXX holding-weighted contribution history.

Output:
  backend/output/semiconductor/soxx_contribution_history.json

The calculation is historical context only. It does not forecast, simulate
SOXL, or emit trading signals.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
BACKEND_DIR_STR = str(BACKEND_DIR)
if BACKEND_DIR_STR not in sys.path:
    sys.path.insert(0, BACKEND_DIR_STR)

from services.soxx_contribution_history import (  # noqa: E402
    DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS,
    MAX_SOXX_CONTRIBUTION_HISTORY_DAYS,
    MIN_SOXX_CONTRIBUTION_HISTORY_DAYS,
    contribution_history_output_path,
    write_contribution_history,
)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build SOXX contribution history JSON.")
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS,
        help=(
            "Trading-day history window. "
            f"Clamped to {MIN_SOXX_CONTRIBUTION_HISTORY_DAYS}-"
            f"{MAX_SOXX_CONTRIBUTION_HISTORY_DAYS}."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = write_contribution_history(days=args.days)
    path = contribution_history_output_path()

    print(f"[soxx_contribution_history] wrote {path}")
    print(
        "[soxx_contribution_history] "
        f"status={payload['status']} history={len(payload['history'])} "
        f"buckets={len(payload['bucketHistory'])}"
    )
    print(
        "[soxx_contribution_history] "
        f"holdings_as_of={payload.get('holdings_as_of')} "
        f"asOf={payload.get('asOf')} period={payload.get('period')}"
    )
    if payload.get("warnings"):
        print(f"[soxx_contribution_history] warnings={len(payload['warnings'])}")
        for warning in payload["warnings"][:5]:
            print(f"  - {warning}")
    return 0 if payload["history"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
