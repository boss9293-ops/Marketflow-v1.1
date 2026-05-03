from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    from backend.services.data_contract import artifact_path as contract_artifact_path
except Exception:
    try:
        from services.data_contract import artifact_path as contract_artifact_path
    except Exception:
        contract_artifact_path = None  # type: ignore[assignment]


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
OUTPUT_ROOT = BACKEND_DIR / "output"
CACHE_ROOT = OUTPUT_ROOT / "cache"
NEWS_HISTORY_ROOT = OUTPUT_ROOT / "news_cache"

CONTEXT_NEWS_PATH = CACHE_ROOT / "context_news.json"
CONTEXT_NARRATIVE_CACHE_PATH = CACHE_ROOT / "context_narrative_cache.json"
CONTEXT_NARRATIVE_OUTPUT_PATH = CACHE_ROOT / "context_narrative.json"
CONTEXT_NARRATIVE_USAGE_PATH = CACHE_ROOT / "context_narrative_usage.json"
DAILY_BRIEFING_V3_PATH = CACHE_ROOT / "daily_briefing_v3.json"
DAILY_BRIEFING_V4_PATH = CACHE_ROOT / "daily_briefing_v4.json"
DAILY_BRIEFING_V5_PATH = CACHE_ROOT / "daily_briefing_v5.json"
MARKET_HEADLINES_HISTORY_PATH = CACHE_ROOT / "market-headlines-history.json"
LEGACY_MARKET_HEADLINES_HISTORY_PATH = REPO_ROOT / "frontend" / ".cache" / "market-headlines-history.json"
TICKER_NEWS_HISTORY_PATH = CACHE_ROOT / "ticker-news-history-v2-1630.json"
LEGACY_TICKER_NEWS_HISTORY_PATH = REPO_ROOT / "frontend" / ".cache" / "ticker-news-history-v2-1630.json"
TICKER_BRIEF_INDEX_PATH = CACHE_ROOT / "ticker_brief_index.json"


def _resolve_output_artifact_path(relative_path: str) -> Path:
    rel = str(relative_path or "").replace("\\", "/").strip()
    root = OUTPUT_ROOT.resolve()
    if not rel:
        return root
    candidate = (root / Path(rel)).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Artifact path escapes output root: {relative_path!r}") from exc
    return candidate


def artifact_file(relative_path: str) -> Path:
    rel = str(relative_path or "").replace("\\", "/").strip("/")
    if contract_artifact_path is not None:
        try:
            candidate = Path(contract_artifact_path(rel)).resolve()
            candidate.relative_to(OUTPUT_ROOT.resolve())
            return candidate
        except Exception:
            pass
    return _resolve_output_artifact_path(rel)


def read_json_file(path: Path | str) -> Any | None:
    try:
        p = Path(path)
        if not p.exists():
            return None
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def write_json_file(path: Path | str, payload: Any) -> None:
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception:
        return


def news_history_dir(date_str: str) -> Path:
    date_value = str(date_str or "").strip()
    return (NEWS_HISTORY_ROOT / date_value).resolve()


def news_history_file(date_str: str, region: str) -> Path:
    safe_region = (region or "us").strip().lower() or "us"
    return (news_history_dir(date_str) / f"{safe_region}.json").resolve()


def news_last_good_file(region: str) -> Path:
    safe_region = (region or "us").strip().lower() or "us"
    return (NEWS_HISTORY_ROOT / f"last_good_{safe_region}.json").resolve()
