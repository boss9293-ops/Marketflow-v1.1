"""
MCP v0.6 Daily Briefing 2x2 test runner.

Run:
  python marketflow/backend/mcp/briefing/briefing_test_runner.py
  python marketflow/backend/mcp/briefing/briefing_test_runner.py --source-mode placeholder
  python marketflow/backend/mcp/briefing/briefing_test_runner.py --source-mode existing_engine_safe
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


MARKETFLOW_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = MARKETFLOW_DIR / "backend"
for _path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from mcp.briefing.briefing_matrix_adapter import (  # noqa: E402
    ALLOWED_SOURCE_MODES,
    build_briefing_from_context,
)
from mcp.briefing.briefing_output_comparator import (  # noqa: E402
    compare_briefing_outputs,
    render_comparison_markdown,
)
from mcp.tools.daily_briefing_context import build_daily_briefing_context  # noqa: E402


OUTPUT_DIR = BACKEND_DIR / "output" / "mcp" / "briefing_matrix"
DEFAULT_UNIVERSE = ["NVDA", "MSFT", "AAPL", "TSLA", "AMZN", "AVGO", "AMD"]


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _variant_pairs() -> List[Tuple[str, str]]:
    return [
        ("v3", "claude"),
        ("v3", "deepseek"),
        ("v6", "claude"),
        ("v6", "deepseek"),
    ]


def run_briefing_matrix_test(
    date: str | None = None,
    universe: List[str] | None = None,
    mode: str = "midform",
    source_mode: str = "placeholder",
) -> Dict[str, Any]:
    target_date = str(date or _utc_today())
    target_universe = list(universe or DEFAULT_UNIVERSE)

    context = build_daily_briefing_context(date=target_date, universe=target_universe, mode=mode)
    outputs: List[Dict[str, Any]] = []
    for engine_version, renderer in _variant_pairs():
        output = build_briefing_from_context(
            context=context,
            engine_version=engine_version,
            renderer=renderer,
            mode=mode,
            source_mode=source_mode,
        )
        outputs.append(output)

    comparison = compare_briefing_outputs(outputs)
    comparison_md = render_comparison_markdown(outputs, comparison)

    by_variant = {
        f"{item.get('engine_version')}_{item.get('renderer')}": item
        for item in outputs
        if isinstance(item, dict)
    }

    _write_json(OUTPUT_DIR / "latest_context.json", context)
    _write_json(OUTPUT_DIR / "v3_claude.json", by_variant.get("v3_claude", {}))
    _write_json(OUTPUT_DIR / "v3_deepseek.json", by_variant.get("v3_deepseek", {}))
    _write_json(OUTPUT_DIR / "v6_claude.json", by_variant.get("v6_claude", {}))
    _write_json(OUTPUT_DIR / "v6_deepseek.json", by_variant.get("v6_deepseek", {}))
    _write_json(OUTPUT_DIR / "comparison.json", comparison)
    _write_text(OUTPUT_DIR / "comparison.md", comparison_md)

    return {
        "output_dir": str(OUTPUT_DIR),
        "date": target_date,
        "universe_size": len(target_universe),
        "source_mode": source_mode,
        "variants": sorted(by_variant.keys()),
        "files_written": [
            "latest_context.json",
            "v3_claude.json",
            "v3_deepseek.json",
            "v6_claude.json",
            "v6_deepseek.json",
            "comparison.json",
            "comparison.md",
        ],
        "_meta": {
            "source": "mcp_briefing_test_runner",
            "production_selected": False,
        },
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run MCP Daily Briefing 2x2 matrix test.")
    parser.add_argument("--date", default="", help="Date for context (YYYY-MM-DD). Defaults to UTC today.")
    parser.add_argument(
        "--source-mode",
        default="placeholder",
        choices=sorted(ALLOWED_SOURCE_MODES),
        help="Briefing adapter source mode. Default is placeholder.",
    )
    parser.add_argument("--mode", default="midform", help="Narrative mode. Default: midform.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    result = run_briefing_matrix_test(
        date=str(args.date or "").strip() or None,
        universe=DEFAULT_UNIVERSE,
        mode=str(args.mode or "midform"),
        source_mode=str(args.source_mode or "placeholder"),
    )
    print("MCP v0.6 briefing matrix test completed.")
    print(f"Output directory: {result.get('output_dir')}")
    print(f"Variants: {', '.join(result.get('variants', []))}")
    print(f"Source mode: {result.get('source_mode')}")
    print("Production choice: not selected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
