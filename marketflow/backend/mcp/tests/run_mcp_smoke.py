"""
Lightweight MCP smoke runner (no pytest dependency).

Run:
  python marketflow/backend/mcp/tests/run_mcp_smoke.py
"""
from __future__ import annotations

import json
import re
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, List

from flask import Flask


MARKETFLOW_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = MARKETFLOW_DIR / "backend"
for _path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from mcp.marketflow_mcp_server import (  # noqa: E402
    call_daily_briefing_context,
    call_event_timeline,
    call_signal_quality,
    call_terminal_event_feed_context,
    call_watchlist_news_context,
    call_watchlist_ranker,
    marketflow_mcp_bp,
)
from mcp.briefing.briefing_matrix_adapter import (  # noqa: E402
    ALLOW_LIVE_BRIEFING_CALLS,
    build_briefing_from_context,
)
from mcp.briefing.briefing_review_pack import generate_briefing_review_pack  # noqa: E402
from mcp.briefing.briefing_test_runner import run_briefing_matrix_test  # noqa: E402
from mcp.briefing.briefing_output_comparator import compare_briefing_outputs  # noqa: E402
from mcp.terminal_watchlist_context_runner import run_terminal_watchlist_context  # noqa: E402
from validate_terminal_watchlist_contract import validate_terminal_watchlist_contract  # noqa: E402
from mcp.services import data_router  # noqa: E402


BANNED_PATTERNS = (
    re.compile(r"\bbuy\b", re.IGNORECASE),
    re.compile(r"\bsell\b", re.IGNORECASE),
    re.compile(r"\bentry\b", re.IGNORECASE),
    re.compile(r"\bexit\b", re.IGNORECASE),
    re.compile(r"\btarget\s+price\b", re.IGNORECASE),
    re.compile(r"\bstrong\s+buy\b", re.IGNORECASE),
    re.compile(r"\btrade\s+setup\b", re.IGNORECASE),
    re.compile(r"\brecommendation\b", re.IGNORECASE),
)


def _assert_no_banned_language(payload: Any) -> None:
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS:
            if pattern.search(payload):
                raise AssertionError(f"Banned term detected: {pattern.pattern} in {payload!r}")
        return
    if isinstance(payload, list):
        for item in payload:
            _assert_no_banned_language(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            _assert_no_banned_language(value)


def _assert_has_keys(actual: Dict[str, Any], required: Iterable[str], title: str) -> None:
    missing = [key for key in required if key not in actual]
    if missing:
        raise AssertionError(f"{title} missing keys: {missing}; keys={list(actual.keys())}")


def _assert_meta(payload: Dict[str, Any], title: str) -> None:
    meta = payload.get("_meta")
    if not isinstance(meta, dict):
        raise AssertionError(f"{title} missing _meta dict")
    source = meta.get("source")
    if source not in {"cache", "fallback"}:
        raise AssertionError(f"{title} _meta.source invalid: {source!r}")


@contextmanager
def _force_missing_cache() -> Any:
    original_output = data_router.OUTPUT_DIR
    original_cache = data_router.CACHE_DIR
    fake_output = BACKEND_DIR / "__missing_mcp_cache_for_smoke__"
    data_router.OUTPUT_DIR = fake_output
    data_router.CACHE_DIR = fake_output / "cache"
    try:
        yield
    finally:
        data_router.OUTPUT_DIR = original_output
        data_router.CACHE_DIR = original_cache


def _assert_tool_output_shapes() -> None:
    event_timeline = call_event_timeline(symbol="NVDA", lookback_days=5, mode="beginner")
    _assert_has_keys(
        event_timeline,
        ["symbol", "lookback_days", "timeline", "summary", "_meta"],
        "event_timeline",
    )
    _assert_has_keys(
        event_timeline["summary"],
        ["top_driver", "price_confirmation", "risk_engine_agreement", "beginner_explanation"],
        "event_timeline.summary",
    )
    if not isinstance(event_timeline.get("timeline"), list):
        raise AssertionError("event_timeline.timeline must be a list")
    _assert_meta(event_timeline, "event_timeline")
    _assert_no_banned_language(event_timeline)

    empty_watchlist = call_watchlist_ranker(symbols=[], lookback_days=3, mode="daily_briefing")
    _assert_has_keys(empty_watchlist, ["ranked_items", "_meta"], "watchlist_empty")
    if empty_watchlist.get("ranked_items") != []:
        raise AssertionError(f"empty_watchlist mismatch: {empty_watchlist}")
    _assert_meta(empty_watchlist, "watchlist_empty")
    _assert_no_banned_language(empty_watchlist)

    ranked_watchlist = call_watchlist_ranker(
        symbols=["NVDA", "TSLA", "AAPL"],
        lookback_days=3,
        mode="daily_briefing",
    )
    _assert_has_keys(ranked_watchlist, ["ranked_items", "_meta"], "watchlist_ranked")
    ranked_items = ranked_watchlist.get("ranked_items")
    if not isinstance(ranked_items, list):
        raise AssertionError("watchlist_ranked.ranked_items must be a list")
    if ranked_items:
        _assert_has_keys(
            ranked_items[0],
            ["symbol", "attention_score", "main_reason", "risk_pressure", "engine_conflict", "briefing_line"],
            "watchlist_ranked.item",
        )
        scores = [int(item.get("attention_score", -1)) for item in ranked_items]
        if scores != sorted(scores, reverse=True):
            raise AssertionError(f"ranked_watchlist not sorted by score desc: {scores}")
    _assert_meta(ranked_watchlist, "watchlist_ranked")
    _assert_no_banned_language(ranked_watchlist)

    strong = call_signal_quality(
        symbol="NVDA",
        event={
            "event_strength": 0.90,
            "price_confirmation": 0.86,
            "sector_confirmation": 0.84,
            "volume_confirmation": 0.72,
            "risk_engine_alignment": 0.80,
        },
        price_context=False,
        sector_context=False,
        risk_context=False,
    )
    if strong.get("quality_state") != "strong_confirmation":
        raise AssertionError(f"expected strong_confirmation, got {strong.get('quality_state')}")
    _assert_has_keys(
        strong,
        ["quality_state", "score", "components", "interpretation", "warning", "_meta"],
        "signal_quality",
    )
    _assert_has_keys(
        strong["components"],
        ["event_strength", "price_confirmation", "sector_confirmation", "volume_confirmation", "risk_engine_alignment"],
        "signal_quality.components",
    )
    _assert_meta(strong, "signal_quality")
    _assert_no_banned_language(strong)

    briefing = call_daily_briefing_context(
        date="2026-05-13",
        universe=["NVDA", "TSLA", "AAPL"],
        mode="midform",
    )
    _assert_has_keys(
        briefing,
        [
            "date",
            "top_market_story",
            "top_events",
            "watchlist_rank",
            "sector_context",
            "risk_context",
            "briefing_outline",
            "_meta",
        ],
        "daily_briefing_context",
    )
    _assert_meta(briefing, "daily_briefing_context")
    _assert_no_banned_language(briefing)

    terminal_context = call_terminal_event_feed_context(
        date="2026-05-13",
        universe=["SPY", "QQQ", "NVDA", "TSLA"],
        lookback_days=3,
        mode="terminal",
    )
    _assert_has_keys(
        terminal_context,
        ["date", "mode", "top_events", "market_context", "risk_context", "_meta"],
        "terminal_event_feed_context",
    )
    if terminal_context.get("mode") != "terminal":
        raise AssertionError("terminal_event_feed_context.mode must be terminal")
    if not isinstance(terminal_context.get("top_events"), list):
        raise AssertionError("terminal_event_feed_context.top_events must be list")
    if terminal_context.get("_meta", {}).get("live_api_call_attempted") is not False:
        raise AssertionError("terminal_event_feed_context must not attempt live API calls")
    _assert_meta(terminal_context, "terminal_event_feed_context")
    _assert_no_banned_language(terminal_context)

    watchlist_news = call_watchlist_news_context(
        symbols=["NVDA", "TSLA", "AMD"],
        lookback_days=3,
        mode="watchlist",
    )
    _assert_has_keys(
        watchlist_news,
        ["mode", "ranked_watchlist_news", "_meta"],
        "watchlist_news_context",
    )
    if watchlist_news.get("mode") != "watchlist":
        raise AssertionError("watchlist_news_context.mode must be watchlist")
    if not isinstance(watchlist_news.get("ranked_watchlist_news"), list):
        raise AssertionError("watchlist_news_context.ranked_watchlist_news must be list")
    if watchlist_news.get("_meta", {}).get("live_api_call_attempted") is not False:
        raise AssertionError("watchlist_news_context must not attempt live API calls")
    if watchlist_news.get("ranked_watchlist_news"):
        first = watchlist_news["ranked_watchlist_news"][0]
        _assert_has_keys(
            first,
            [
                "symbol",
                "attention_score",
                "main_event",
                "related_events",
                "risk_pressure",
                "signal_quality",
                "watchlist_line",
            ],
            "watchlist_news_context.item",
        )
    _assert_meta(watchlist_news, "watchlist_news_context")
    _assert_no_banned_language(watchlist_news)


def _assert_briefing_matrix_harness() -> None:
    context = call_daily_briefing_context(
        date="2026-05-13",
        universe=["NVDA", "TSLA", "AAPL", "MSFT"],
        mode="midform",
    )
    variants = [
        ("v3", "claude"),
        ("v3", "deepseek"),
        ("v6", "claude"),
        ("v6", "deepseek"),
    ]
    outputs: List[Dict[str, Any]] = []
    for version, renderer in variants:
        output = build_briefing_from_context(
            context=context,
            engine_version=version,
            renderer=renderer,
            mode="midform",
        )
        _assert_has_keys(
            output,
            ["engine_version", "renderer", "mode", "title", "sections", "script", "_meta"],
            f"briefing_matrix.{version}_{renderer}",
        )
        meta = output.get("_meta")
        if not isinstance(meta, dict):
            raise AssertionError(f"briefing_matrix {version}_{renderer} missing _meta")
        if meta.get("source_mode") != "placeholder":
            raise AssertionError(f"briefing_matrix {version}_{renderer} default source_mode must be placeholder")
        if "source_mode" not in meta:
            raise AssertionError(f"briefing_matrix {version}_{renderer} _meta.source_mode missing")
        if meta.get("live_api_call_attempted") is not False:
            raise AssertionError(f"briefing_matrix {version}_{renderer} live API call should not be attempted")
        if meta.get("live_api_allowed") != bool(ALLOW_LIVE_BRIEFING_CALLS):
            raise AssertionError(f"briefing_matrix {version}_{renderer} live_api_allowed mismatch")
        if output.get("engine_version") != version:
            raise AssertionError(f"briefing_matrix {version}_{renderer} engine_version mismatch")
        if output.get("renderer") != renderer:
            raise AssertionError(f"briefing_matrix {version}_{renderer} renderer mismatch")
        if not isinstance(output.get("sections"), list):
            raise AssertionError(f"briefing_matrix {version}_{renderer} sections must be list")
        if not isinstance(output.get("script"), str):
            raise AssertionError(f"briefing_matrix {version}_{renderer} script must be string")
        _assert_no_banned_language(output)
        outputs.append(output)

    comparison = compare_briefing_outputs(outputs)
    _assert_has_keys(
        comparison,
        ["matrix_summary", "recommended_for_review", "warnings", "_meta"],
        "briefing_matrix.comparison",
    )
    if not isinstance(comparison.get("matrix_summary"), list):
        raise AssertionError("briefing_matrix.comparison matrix_summary must be list")
    if len(comparison.get("matrix_summary", [])) != 4:
        raise AssertionError("briefing_matrix.comparison matrix_summary must have 4 entries")
    if not isinstance(comparison.get("recommended_for_review"), list):
        raise AssertionError("briefing_matrix.comparison recommended_for_review must be list")
    _assert_no_banned_language(comparison)


def _assert_existing_engine_safe_harness() -> None:
    matrix_result = run_briefing_matrix_test(
        date="2026-05-13",
        universe=["NVDA", "TSLA", "AAPL", "MSFT"],
        mode="midform",
        source_mode="existing_engine_safe",
    )
    matrix_dir = Path(str(matrix_result.get("output_dir") or "")).resolve()
    if not matrix_dir.exists():
        raise AssertionError(f"existing_engine_safe matrix directory missing: {matrix_dir}")

    for variant_name in ("v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"):
        path = matrix_dir / f"{variant_name}.json"
        if not path.exists():
            raise AssertionError(f"{variant_name}.json missing in existing_engine_safe mode")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise AssertionError(f"{variant_name}.json payload must be dict")
        _assert_has_keys(
            payload,
            ["engine_version", "renderer", "mode", "title", "sections", "script", "_meta"],
            f"existing_engine_safe.{variant_name}",
        )
        meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
        if meta.get("source_mode") != "existing_engine_safe":
            raise AssertionError(f"{variant_name} source_mode must be existing_engine_safe")
        if meta.get("live_api_call_attempted") is not False:
            raise AssertionError(f"{variant_name} live API call should not be attempted")
        if meta.get("source") not in {"existing_engine_safe", "disabled", "adapter_placeholder"}:
            raise AssertionError(f"{variant_name} source is unexpected: {meta.get('source')}")
        _assert_no_banned_language(payload)

    comparison_json_path = matrix_dir / "comparison.json"
    if not comparison_json_path.exists():
        raise AssertionError("existing_engine_safe comparison.json missing")
    comparison = json.loads(comparison_json_path.read_text(encoding="utf-8"))
    if not isinstance(comparison, dict):
        raise AssertionError("existing_engine_safe comparison payload must be dict")
    comp_meta = comparison.get("_meta") if isinstance(comparison.get("_meta"), dict) else {}
    if bool(comp_meta.get("production_selected", True)):
        raise AssertionError("existing_engine_safe comparison must not select production")
    _assert_no_banned_language(comparison)


def _assert_review_pack_generation(source_mode: str = "placeholder") -> None:
    matrix_result = run_briefing_matrix_test(
        date="2026-05-13",
        universe=["NVDA", "TSLA", "AAPL", "MSFT"],
        mode="midform",
        source_mode=source_mode,
    )
    matrix_dir = Path(str(matrix_result.get("output_dir") or "")).resolve()
    if not matrix_dir.exists():
        raise AssertionError(f"matrix output directory missing: {matrix_dir}")

    review_result = generate_briefing_review_pack(matrix_dir=str(matrix_dir))
    _assert_has_keys(
        review_result,
        ["review_pack", "review_pack_json_path", "review_pack_md_path", "_meta"],
        "review_pack.result",
    )
    review_pack = review_result.get("review_pack")
    if not isinstance(review_pack, dict):
        raise AssertionError("review_pack.result.review_pack must be dict")
    _assert_has_keys(
        review_pack,
        [
            "context_summary",
            "matrix_overview",
            "side_by_side",
            "comparator_notes",
            "human_review_checklist",
            "decision_placeholder",
            "_meta",
        ],
        "review_pack.payload",
    )
    if not isinstance(review_pack.get("matrix_overview"), list) or len(review_pack.get("matrix_overview", [])) != 4:
        raise AssertionError("review_pack.matrix_overview must have 4 rows")
    if not isinstance(review_pack.get("side_by_side"), list) or len(review_pack.get("side_by_side", [])) != 4:
        raise AssertionError("review_pack.side_by_side must have 4 rows")
    for row in review_pack.get("matrix_overview", []):
        if not isinstance(row, dict):
            continue
        _assert_has_keys(
            row,
            [
                "engine",
                "renderer",
                "source_mode",
                "source",
                "engine_path",
                "safe_wiring",
                "live_api_allowed",
                "live_api_call_attempted",
                "sections",
                "script_length",
                "warnings",
                "variant",
            ],
            f"review_pack.matrix_overview.{row.get('variant', 'row')}",
        )

    review_json_path = Path(str(review_result.get("review_pack_json_path") or ""))
    review_md_path = Path(str(review_result.get("review_pack_md_path") or ""))
    if not review_json_path.exists():
        raise AssertionError(f"review_pack.json missing: {review_json_path}")
    if not review_md_path.exists():
        raise AssertionError(f"review_pack.md missing: {review_md_path}")

    review_json_payload = json.loads(review_json_path.read_text(encoding="utf-8"))
    if not isinstance(review_json_payload, dict):
        raise AssertionError("review_pack.json payload must be dict")
    review_md_text = review_md_path.read_text(encoding="utf-8")
    if not isinstance(review_md_text, str) or not review_md_text.strip():
        raise AssertionError("review_pack.md must contain text")

    _assert_no_banned_language(review_pack)
    _assert_no_banned_language(review_json_payload)
    _assert_no_banned_language(review_md_text)
    review_meta = review_pack.get("_meta") if isinstance(review_pack.get("_meta"), dict) else {}
    if bool(review_meta.get("production_selected", True)):
        raise AssertionError("review_pack must not select production")

    for variant_name in ("v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"):
        path = matrix_dir / f"{variant_name}.json"
        if not path.exists():
            raise AssertionError(f"{variant_name}.json missing for review pack smoke")
        payload = json.loads(path.read_text(encoding="utf-8"))
        meta = payload.get("_meta") if isinstance(payload, dict) else {}
        if not isinstance(meta, dict):
            raise AssertionError(f"{variant_name} _meta missing")
        if meta.get("source_mode") != source_mode:
            raise AssertionError(f"{variant_name} source_mode must be {source_mode}")
        if meta.get("live_api_call_attempted") is not False:
            raise AssertionError(f"{variant_name} live_api_call_attempted must be false")


def _assert_terminal_watchlist_runner() -> None:
    result = run_terminal_watchlist_context(
        date="2026-05-13",
        universe=["SPY", "QQQ", "SOXX", "NVDA", "TSLA", "AMD", "AVGO"],
        lookback_days=3,
    )
    _assert_has_keys(
        result,
        ["output_dir", "date", "universe_size", "files_written", "_meta"],
        "terminal_watchlist_runner.result",
    )
    output_dir = Path(str(result.get("output_dir") or "")).resolve()
    if not output_dir.exists():
        raise AssertionError(f"terminal_watchlist output directory missing: {output_dir}")

    terminal_json = output_dir / "terminal_event_feed_context.json"
    watchlist_json = output_dir / "watchlist_news_context.json"
    summary_md = output_dir / "terminal_watchlist_summary.md"
    for path in (terminal_json, watchlist_json, summary_md):
        if not path.exists():
            raise AssertionError(f"terminal_watchlist output missing: {path.name}")

    terminal_payload = json.loads(terminal_json.read_text(encoding="utf-8"))
    watchlist_payload = json.loads(watchlist_json.read_text(encoding="utf-8"))
    summary_text = summary_md.read_text(encoding="utf-8")

    _assert_has_keys(
        terminal_payload,
        ["date", "mode", "top_events", "market_context", "risk_context", "_meta"],
        "terminal_watchlist_runner.terminal_payload",
    )
    _assert_has_keys(
        watchlist_payload,
        ["mode", "ranked_watchlist_news", "_meta"],
        "terminal_watchlist_runner.watchlist_payload",
    )
    if terminal_payload.get("_meta", {}).get("live_api_call_attempted") is not False:
        raise AssertionError("terminal_payload live_api_call_attempted must be false")
    if watchlist_payload.get("_meta", {}).get("live_api_call_attempted") is not False:
        raise AssertionError("watchlist_payload live_api_call_attempted must be false")
    if "Terminal & Watchlist MCP Context Summary" not in summary_text:
        raise AssertionError("terminal_watchlist_summary.md header missing")

    validation = validate_terminal_watchlist_contract(output_dir=output_dir)
    if not isinstance(validation, dict):
        raise AssertionError("terminal_watchlist contract validation result must be dict")
    if validation.get("ok") is not True:
        raise AssertionError(f"terminal_watchlist contract validation failed: {validation.get('errors')}")
    if validation.get("_meta", {}).get("live_api_call_attempted") is not False:
        raise AssertionError("terminal_watchlist contract validator must not attempt live API calls")

    _assert_no_banned_language(terminal_payload)
    _assert_no_banned_language(watchlist_payload)
    _assert_no_banned_language(summary_text)
    _assert_no_banned_language(validation)


def _assert_route_smoke() -> None:
    app = Flask("mcp_smoke")
    app.register_blueprint(marketflow_mcp_bp)
    client = app.test_client()

    get_cases = [
        ("/api/mcp/event-timeline", {"symbol": "NVDA", "lookback_days": "3", "mode": "beginner"}),
        ("/api/mcp/watchlist-ranker", {"symbols": "NVDA,TSLA,AAPL", "lookback_days": "3", "mode": "daily_briefing"}),
        (
            "/api/mcp/signal-quality",
            {
                "symbol": "NVDA",
                "event": json.dumps({"event_strength": 0.72}),
                "price_context": "true",
                "sector_context": "true",
                "risk_context": "true",
            },
        ),
        ("/api/mcp/daily-briefing-context", {"date": "2026-05-13", "universe": "NVDA,TSLA,AAPL", "mode": "midform"}),
        (
            "/api/mcp/terminal-event-feed-context",
            {"date": "2026-05-13", "universe": "SPY,QQQ,NVDA,TSLA", "lookback_days": "3", "mode": "terminal"},
        ),
        (
            "/api/mcp/watchlist-news-context",
            {"symbols": "NVDA,TSLA,AMD", "lookback_days": "3", "mode": "watchlist"},
        ),
    ]
    for path, query in get_cases:
        response = client.get(path, query_string=query)
        if response.status_code != 200:
            raise AssertionError(f"GET {path} failed: {response.status_code} {response.get_data(as_text=True)}")
        payload = response.get_json(silent=True)
        if not isinstance(payload, dict):
            raise AssertionError(f"GET {path} did not return JSON object")
        _assert_no_banned_language(payload)

    post_cases = [
        (
            "/api/mcp/event-timeline",
            {"symbol": "NVDA", "lookback_days": 3, "mode": "beginner"},
        ),
        (
            "/api/mcp/watchlist-ranker",
            {"symbols": ["NVDA", "TSLA", "AAPL"], "lookback_days": 3, "mode": "daily_briefing"},
        ),
        (
            "/api/mcp/signal-quality",
            {
                "symbol": "NVDA",
                "event": {"event_strength": 0.72, "price_confirmation": 0.64},
                "price_context": True,
                "sector_context": True,
                "risk_context": True,
            },
        ),
        (
            "/api/mcp/daily-briefing-context",
            {"date": "2026-05-13", "universe": ["NVDA", "TSLA", "AAPL"], "mode": "midform"},
        ),
        (
            "/api/mcp/terminal-event-feed-context",
            {"date": "2026-05-13", "universe": ["SPY", "QQQ", "NVDA", "TSLA"], "lookback_days": 3, "mode": "terminal"},
        ),
        (
            "/api/mcp/watchlist-news-context",
            {"symbols": ["NVDA", "TSLA", "AMD"], "lookback_days": 3, "mode": "watchlist"},
        ),
    ]
    for path, body in post_cases:
        response = client.post(path, json=body)
        if response.status_code != 200:
            raise AssertionError(f"POST {path} failed: {response.status_code} {response.get_data(as_text=True)}")
        payload = response.get_json(silent=True)
        if not isinstance(payload, dict):
            raise AssertionError(f"POST {path} did not return JSON object")
        _assert_no_banned_language(payload)


def _assert_missing_cache_no_crash() -> None:
    with _force_missing_cache():
        event_timeline = call_event_timeline(symbol="NVDA", lookback_days=2, mode="beginner")
        watchlist = call_watchlist_ranker(symbols=["NVDA", "TSLA"], lookback_days=2, mode="daily_briefing")
        signal = call_signal_quality(symbol="NVDA", event={}, price_context=True, sector_context=True, risk_context=True)
        briefing = call_daily_briefing_context(date="2026-05-13", universe=["NVDA", "TSLA"], mode="midform")
        terminal_context = call_terminal_event_feed_context(
            date="2026-05-13",
            universe=["SPY", "QQQ", "NVDA"],
            lookback_days=2,
            mode="terminal",
        )
        watchlist_news = call_watchlist_news_context(
            symbols=["NVDA", "TSLA"],
            lookback_days=2,
            mode="watchlist",
        )
        briefing_variants = [
            build_briefing_from_context(context=briefing, engine_version="v3", renderer="claude", mode="midform"),
            build_briefing_from_context(context=briefing, engine_version="v3", renderer="deepseek", mode="midform"),
            build_briefing_from_context(context=briefing, engine_version="v6", renderer="claude", mode="midform"),
            build_briefing_from_context(context=briefing, engine_version="v6", renderer="deepseek", mode="midform"),
        ]
        briefing_comparison = compare_briefing_outputs(briefing_variants)

    for title, payload in (
        ("missing_cache.event_timeline", event_timeline),
        ("missing_cache.watchlist_ranker", watchlist),
        ("missing_cache.signal_quality", signal),
        ("missing_cache.daily_briefing_context", briefing),
        ("missing_cache.terminal_event_feed_context", terminal_context),
        ("missing_cache.watchlist_news_context", watchlist_news),
    ):
        if not isinstance(payload, dict):
            raise AssertionError(f"{title} output must be dict")
        _assert_meta(payload, title)
        _assert_no_banned_language(payload)
    if not isinstance(briefing_comparison, dict):
        raise AssertionError("missing_cache.briefing_matrix_comparison output must be dict")
    _assert_has_keys(
        briefing_comparison,
        ["matrix_summary", "recommended_for_review", "warnings", "_meta"],
        "missing_cache.briefing_matrix_comparison",
    )
    _assert_no_banned_language(briefing_comparison)
    for idx, payload in enumerate(briefing_variants, start=1):
        if not isinstance(payload, dict):
            raise AssertionError(f"missing_cache.briefing_variant_{idx} output must be dict")
        _assert_has_keys(
            payload,
            ["engine_version", "renderer", "mode", "title", "sections", "script", "_meta"],
            f"missing_cache.briefing_variant_{idx}",
        )
        meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
        if meta.get("source_mode") != "placeholder":
            raise AssertionError(f"missing_cache.briefing_variant_{idx} source_mode must be placeholder")
        if meta.get("live_api_call_attempted") is not False:
            raise AssertionError(f"missing_cache.briefing_variant_{idx} live API call should not be attempted")
        _assert_no_banned_language(payload)


def run() -> int:
    _assert_tool_output_shapes()
    _assert_briefing_matrix_harness()
    _assert_existing_engine_safe_harness()
    _assert_review_pack_generation("placeholder")
    _assert_review_pack_generation("existing_engine_safe")
    _assert_terminal_watchlist_runner()
    _assert_route_smoke()
    _assert_missing_cache_no_crash()
    print("MCP smoke PASS: tool-shapes, briefing-matrix-2x2, existing-engine-safe, review-pack, terminal-watchlist-runner, contract-validator, routes-get-post, missing-cache-fallback, banned-language")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except AssertionError as exc:
        print("MCP smoke FAIL:", exc)
        raise SystemExit(2)
