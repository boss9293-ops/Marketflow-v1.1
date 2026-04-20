from pathlib import Path

import pytest

from backend.news.news_paths import (
    DAILY_BRIEFING_V3_PATH,
    MARKET_HEADLINES_HISTORY_PATH,
    TICKER_NEWS_HISTORY_PATH,
    artifact_file,
)
from backend.services.data_contract import artifact_path
from backend.utils.prompt_loader import canonical_prompt_root, resolve_prompt_path

LEGACY_PROMPT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "prompts"


def test_prompt_loader_prefers_canonical_prompt_root():
    resolved = resolve_prompt_path("auto/today_context/v1.0.0_today_context.md")
    assert resolved.is_relative_to(canonical_prompt_root())
    assert not resolved.is_relative_to(LEGACY_PROMPT_ROOT)


def test_legacy_prompt_root_is_removed():
    assert not LEGACY_PROMPT_ROOT.exists()


def test_artifact_path_rejects_path_traversal():
    with pytest.raises(ValueError):
        artifact_path("../outside.json")


def test_daily_briefing_path_is_canonical():
    expected_root = Path(__file__).resolve().parents[1] / "backend" / "output" / "cache"
    assert DAILY_BRIEFING_V3_PATH == expected_root / "daily_briefing_v3.json"
    assert artifact_file("cache/daily_briefing_v3.json") == DAILY_BRIEFING_V3_PATH


def test_market_headlines_history_path_is_canonical():
    expected_root = Path(__file__).resolve().parents[1] / "backend" / "output" / "cache"
    assert MARKET_HEADLINES_HISTORY_PATH == expected_root / "market-headlines-history.json"


def test_ticker_news_history_path_is_canonical():
    expected_root = Path(__file__).resolve().parents[1] / "backend" / "output" / "cache"
    assert TICKER_NEWS_HISTORY_PATH == expected_root / "ticker-news-history-v2-1630.json"
