"""
MCP v0.7 terminal/watchlist context output runner.

Run:
  python marketflow/backend/mcp/terminal_watchlist_context_runner.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


MARKETFLOW_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = MARKETFLOW_DIR / "backend"
for _path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language  # noqa: E402
from mcp.tools.terminal_event_feed_context import (  # noqa: E402
    build_terminal_event_feed_context,
)
from mcp.tools.watchlist_news_context import build_watchlist_news_context  # noqa: E402


OUTPUT_DIR = BACKEND_DIR / "output" / "mcp" / "terminal_watchlist"
DEFAULT_UNIVERSE = ["SPY", "QQQ", "SOXX", "NVDA", "TSLA", "AMD", "AVGO"]


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


def _truncate(text: Any, limit: int = 180) -> str:
    value = str(text or "").strip()
    if len(value) <= limit:
        return value
    return value[: max(0, limit - 3)].rstrip() + "..."


def _escape_cell(value: Any) -> str:
    return str(value if value is not None else "").replace("|", "\\|").replace("\n", " ").strip()


def _build_summary_markdown(terminal_payload: Dict[str, Any], watchlist_payload: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("# Terminal & Watchlist MCP Context Summary")
    lines.append("")
    lines.append("## Terminal Top Events")
    lines.append("| Rank | Symbol | Event Type | Strength | Price Confirmation | Why It Matters |")
    lines.append("|---|---|---|---:|---|---|")
    top_events = terminal_payload.get("top_events", []) if isinstance(terminal_payload, dict) else []
    if not isinstance(top_events, list):
        top_events = []
    for row in top_events[:10]:
        if not isinstance(row, dict):
            continue
        lines.append(
            f"| {_escape_cell(row.get('rank'))} | {_escape_cell(row.get('symbol'))} | "
            f"{_escape_cell(row.get('event_type'))} | {_escape_cell(row.get('event_strength'))} | "
            f"{_escape_cell(row.get('price_confirmation'))} | {_escape_cell(_truncate(row.get('why_it_matters'), 140))} |"
        )
    if not top_events:
        lines.append("| - | - | - | - | - | No event rows |")

    lines.append("")
    lines.append("## Watchlist News Ranking")
    lines.append("| Rank | Symbol | Attention Score | Risk Pressure | Signal Quality | Main Event |")
    lines.append("|---|---|---:|---|---|---|")
    ranked = watchlist_payload.get("ranked_watchlist_news", []) if isinstance(watchlist_payload, dict) else []
    if not isinstance(ranked, list):
        ranked = []
    for idx, row in enumerate(ranked[:15], start=1):
        if not isinstance(row, dict):
            continue
        lines.append(
            f"| {idx} | {_escape_cell(row.get('symbol'))} | {_escape_cell(row.get('attention_score'))} | "
            f"{_escape_cell(row.get('risk_pressure'))} | {_escape_cell(row.get('signal_quality'))} | "
            f"{_escape_cell(_truncate(row.get('main_event'), 120))} |"
        )
    if not ranked:
        lines.append("| - | - | - | - | - | No watchlist rows |")

    lines.append("")
    lines.append("## Safety")
    lines.append("- live_api_call_attempted=false")
    lines.append("- no production UI wiring")
    lines.append("- no trading directive language")
    lines.append("")
    return "\n".join(lines)


def run_terminal_watchlist_context(
    date: str | None = None,
    universe: List[str] | None = None,
    lookback_days: int = 3,
) -> Dict[str, Any]:
    target_date = str(date or _utc_today())
    target_universe = list(universe or DEFAULT_UNIVERSE)

    terminal_payload = build_terminal_event_feed_context(
        date=target_date,
        universe=target_universe,
        lookback_days=lookback_days,
        mode="terminal",
    )
    watchlist_payload = build_watchlist_news_context(
        symbols=target_universe,
        lookback_days=lookback_days,
        mode="watchlist",
    )
    summary_md = _build_summary_markdown(terminal_payload, watchlist_payload)

    ensure_no_banned_language(terminal_payload)
    ensure_no_banned_language(watchlist_payload)
    ensure_no_banned_language(summary_md)

    _write_json(OUTPUT_DIR / "terminal_event_feed_context.json", terminal_payload)
    _write_json(OUTPUT_DIR / "watchlist_news_context.json", watchlist_payload)
    _write_text(OUTPUT_DIR / "terminal_watchlist_summary.md", summary_md)

    return {
        "output_dir": str(OUTPUT_DIR),
        "date": target_date,
        "universe_size": len(target_universe),
        "files_written": [
            "terminal_event_feed_context.json",
            "watchlist_news_context.json",
            "terminal_watchlist_summary.md",
        ],
        "_meta": {
            "source": "mcp_terminal_watchlist_runner",
            "live_api_call_attempted": False,
            "production_ui_wired": False,
        },
    }


def main() -> int:
    result = run_terminal_watchlist_context(
        date=_utc_today(),
        universe=DEFAULT_UNIVERSE,
        lookback_days=3,
    )
    print("MCP v0.7 terminal/watchlist context completed.")
    print(f"Output directory: {result.get('output_dir')}")
    print(f"Files: {', '.join(result.get('files_written', []))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

