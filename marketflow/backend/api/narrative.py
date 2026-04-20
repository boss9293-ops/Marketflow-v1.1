"""
Narrative API endpoints for briefing, watchlist, and portfolio generation.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request

try:
    from backend.news.news_paths import TICKER_BRIEF_INDEX_PATH
except Exception:
    from news.news_paths import TICKER_BRIEF_INDEX_PATH  # type: ignore
try:
    from backend.services.release_config import RELEASE_VERSION
except Exception:
    from services.release_config import RELEASE_VERSION  # type: ignore
from services.narrative_generator import (
    generate_briefing,
    generate_portfolio,
    generate_watchlist,
)

narrative_bp = Blueprint("narrative", __name__)
logger = logging.getLogger(__name__)

_WATCHLIST_CACHE_TTL_SEC = 60 * 30
_WATCHLIST_CACHE: Dict[str, Dict[str, Any]] = {}
_TICKER_BRIEF_REFRESH_LOCK = threading.Lock()
_TICKER_BRIEF_REFRESH_IN_FLIGHT = False
_PORTFOLIO_NARRATIVE_CACHE_DIR = Path(__file__).resolve().parents[1] / "output" / "cache" / "portfolio_narratives"
_PORTFOLIO_NARRATIVE_VERSION = RELEASE_VERSION
_TICKER_BRIEF_BUILDER = Path(__file__).resolve().parents[1] / "scripts" / "build_account_ticker_briefs.py"
ET_ZONE = ZoneInfo("America/New_York")


def _json_body() -> Any:
    payload = request.get_json(silent=True)
    if payload is None:
        raise ValueError("Request body must be JSON")
    return payload


def _extract_engine_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    engine_data = payload.get("engine_data")
    if isinstance(engine_data, dict):
        return engine_data
    engine = payload.get("engine")
    if isinstance(engine, dict):
        return engine
    # When the caller sends engine fields at the top level, use the payload itself.
    return {k: v for k, v in payload.items() if k not in {"engine_data", "engine"}}


def _extract_stock_data(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("stock_data", "stocks", "watchlist", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _extract_portfolio_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    for key in ("portfolio_data", "account_data", "account", "portfolio"):
        value = payload.get(key)
        if isinstance(value, dict):
            return value

    return {
        k: v
        for k, v in payload.items()
        if k not in {"engine_data", "engine", "portfolio_data", "account_data", "account", "portfolio"}
    }


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "refresh", "force"}
    return False


def _safe_slug(value: Any) -> str:
    text = str(value or "").strip().lower()
    # Preserve unicode tab names so "미국1" and "한국1" do not collapse to the same cache folder.
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]+', "_", text)
    text = re.sub(r"\s+", "_", text)
    text = text.strip("._-")
    return text or "portfolio"


def _extract_portfolio_cache_owner(
    payload: Dict[str, Any],
    engine_data: Dict[str, Any],
    portfolio_data: Dict[str, Any],
) -> str:
    keys = (
        "subscriber_key",
        "cache_namespace",
        "sheet_id",
        "sheetId",
        "account_id",
        "user_id",
        "member_id",
    )
    for source in (engine_data, payload, portfolio_data):
        if not isinstance(source, dict):
            continue
        for key in keys:
            value = source.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
    header_value = str(request.headers.get("X-Subscriber-Key") or "").strip()
    if header_value:
        return header_value
    return "global"


def _portfolio_cache_namespace(owner: str) -> str:
    raw = str(owner or "global").strip().lower() or "global"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    return f"sub_{digest}"


def _portfolio_cache_date(engine_data: Dict[str, Any], portfolio_data: Dict[str, Any]) -> str:
    return datetime.now().date().isoformat()


def _portfolio_analysis_date(engine_data: Dict[str, Any], portfolio_data: Dict[str, Any], fallback_date: str) -> str:
    for key in ("analysis_date", "as_of_date", "today", "date"):
        value = engine_data.get(key) if isinstance(engine_data, dict) else None
        if value:
            return str(value).strip()
    for key in ("as_of_date", "date"):
        value = portfolio_data.get(key) if isinstance(portfolio_data, dict) else None
        if value:
            return str(value).strip()
    return fallback_date


def _load_ticker_brief_index() -> Dict[str, Any] | None:
    payload = _load_portfolio_cache(TICKER_BRIEF_INDEX_PATH)
    return payload if isinstance(payload, dict) else None


def _ticker_brief_index_is_fresh() -> bool:
    payload = _load_ticker_brief_index()
    if not isinstance(payload, dict):
        return False
    current_date = datetime.now(ET_ZONE).date().isoformat()
    return str(payload.get("date") or "")[:10] == current_date


def _portfolio_news_signature() -> str:
    payload = _load_ticker_brief_index()
    if not isinstance(payload, dict):
        return "missing"
    bits = [
        str(payload.get("generated_at") or "")[:19],
        str(payload.get("date") or "")[:10],
        str(payload.get("symbol_count") or ""),
        str(payload.get("holdings_count") or ""),
    ]
    try:
        bits.append(str(int(TICKER_BRIEF_INDEX_PATH.stat().st_mtime)))
    except OSError:
        pass
    signature = "|".join(bit for bit in bits if bit)
    return signature or "missing"


def _portfolio_cache_path(
    cache_namespace: str,
    tab_name: str,
    cache_date: str,
    positions_hash: str = "",
    narrative_version: str = _PORTFOLIO_NARRATIVE_VERSION,
    news_signature: str = "",
) -> Path:
    raw_tab_name = str(tab_name or "portfolio").strip() or "portfolio"
    tab_folder = f"{_safe_slug(raw_tab_name)}_{hashlib.sha1(raw_tab_name.encode('utf-8')).hexdigest()[:8]}"
    version_suffix = f"_{_safe_slug(narrative_version)}" if narrative_version else ""
    positions_suffix = f"_{_safe_slug(positions_hash)}" if positions_hash else ""
    news_suffix = f"_{_safe_slug(news_signature)}" if news_signature else ""
    return (
        _PORTFOLIO_NARRATIVE_CACHE_DIR
        / _safe_slug(cache_namespace)
        / tab_folder
        / f"{cache_date}{version_suffix}{positions_suffix}{news_suffix}.json"
    )


def _load_latest_portfolio_cache_for_tab(
    cache_namespace: str,
    tab_name: str,
    positions_hash: str = "",
    narrative_version: str = _PORTFOLIO_NARRATIVE_VERSION,
    news_signature: str = "",
) -> Dict[str, Any] | None:
    sample_path = _portfolio_cache_path(cache_namespace, tab_name, "1970-01-01", positions_hash, narrative_version, news_signature)
    tab_dir = sample_path.parent
    if not tab_dir.exists() or not tab_dir.is_dir():
        return None
    pattern = "*.json"
    candidates = sorted(tab_dir.glob(pattern), key=lambda p: p.name, reverse=True)
    for path in candidates:
        cached = _load_portfolio_cache(path)
        if not isinstance(cached, dict):
            continue
        if positions_hash and str(cached.get("positions_hash") or "") != positions_hash:
            continue
        if narrative_version and str(cached.get("cache_version") or "") != narrative_version:
            continue
        if news_signature and str(cached.get("news_signature") or "") != news_signature:
            continue
        return cached
    return None


def _load_portfolio_cache(path: Path) -> Dict[str, Any] | None:
    try:
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _refresh_ticker_briefs() -> None:
    if not _TICKER_BRIEF_BUILDER.exists():
        return
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    try:
        proc = subprocess.run(
            [sys.executable, "-X", "utf8", str(_TICKER_BRIEF_BUILDER)],
            cwd=str(Path(__file__).resolve().parents[1]),
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=1800,
            env=env,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip()
            if tail:
                print(f"[narrative] ticker brief refresh failed rc={proc.returncode}: {tail[-2000:]}")
    except Exception as exc:
        print(f"[narrative] ticker brief refresh error: {exc}")


def _kickoff_ticker_brief_refresh_async(reason: str) -> None:
    global _TICKER_BRIEF_REFRESH_IN_FLIGHT
    with _TICKER_BRIEF_REFRESH_LOCK:
        if _TICKER_BRIEF_REFRESH_IN_FLIGHT:
            return
        _TICKER_BRIEF_REFRESH_IN_FLIGHT = True

    def _runner() -> None:
        global _TICKER_BRIEF_REFRESH_IN_FLIGHT
        try:
            print(f"[narrative] ticker brief refresh scheduled ({reason})")
            _refresh_ticker_briefs()
        finally:
            with _TICKER_BRIEF_REFRESH_LOCK:
                _TICKER_BRIEF_REFRESH_IN_FLIGHT = False

    threading.Thread(target=_runner, daemon=True).start()


def _save_portfolio_cache(path: Path, payload: Dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception:
        return


def _watchlist_cache_key(stock_data: List[Dict[str, Any]], engine_data: Dict[str, Any]) -> str:
    canonical = json.dumps(
        {"stock_data": stock_data, "engine_data": engine_data},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def _watchlist_cache_get(key: str) -> Any:
    now = time.monotonic()
    hit = _WATCHLIST_CACHE.get(key)
    if not hit:
        return None
    if hit["expires_at"] <= now:
        _WATCHLIST_CACHE.pop(key, None)
        return None
    return hit["value"]


def _watchlist_cache_set(key: str, value: Any) -> Any:
    _WATCHLIST_CACHE[key] = {
        "expires_at": time.monotonic() + _WATCHLIST_CACHE_TTL_SEC,
        "value": value,
    }
    return value


@narrative_bp.route("/api/narrative/briefing", methods=["POST"])
def narrative_briefing():
    try:
        payload = _json_body()
        engine_data = _extract_engine_data(payload if isinstance(payload, dict) else {})
        result = generate_briefing(engine_data)
        return jsonify(result), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except (KeyError, TypeError) as exc:
        return jsonify({"error": "Invalid input", "details": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": "Narrative briefing failed", "details": str(exc)}), 502


@narrative_bp.route("/api/narrative/watchlist", methods=["POST"])
def narrative_watchlist():
    try:
        payload = _json_body()
        stock_data = _extract_stock_data(payload)
        engine_data = _extract_engine_data(payload if isinstance(payload, dict) else {})
        key = _watchlist_cache_key(stock_data, engine_data)
        cached = _watchlist_cache_get(key)
        if cached is not None:
            return jsonify(cached), 200

        result = generate_watchlist(stock_data, engine_data)
        _watchlist_cache_set(key, result)
        return jsonify(result), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except (KeyError, TypeError) as exc:
        return jsonify({"error": "Invalid input", "details": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": "Narrative watchlist failed", "details": str(exc)}), 502


@narrative_bp.route("/api/narrative/portfolio", methods=["POST"])
def narrative_portfolio():
    try:
        payload = _json_body()
        payload_dict = payload if isinstance(payload, dict) else {}
        portfolio_data = _extract_portfolio_data(payload_dict)
        engine_data = _extract_engine_data(payload_dict)
        force_refresh = _coerce_bool(payload_dict.get("force_refresh") or payload_dict.get("refresh") or engine_data.get("force_refresh") or engine_data.get("refresh"))
        tab_name = str(engine_data.get("tab_name") or portfolio_data.get("tab_name") or portfolio_data.get("name") or "portfolio").strip() or "portfolio"
        client_narrative_version = str(engine_data.get("narrative_version") or payload_dict.get("narrative_version") or "").strip()
        narrative_version = _PORTFOLIO_NARRATIVE_VERSION
        if client_narrative_version and client_narrative_version != narrative_version:
            logger.info(
                "narrative_portfolio ignoring client narrative_version=%s; using server narrative_version=%s",
                client_narrative_version,
                narrative_version,
            )
        cache_owner = _extract_portfolio_cache_owner(payload_dict, engine_data, portfolio_data)
        cache_owner_namespace = _portfolio_cache_namespace(cache_owner)
        cache_namespace = RELEASE_VERSION
        cache_date = _portfolio_cache_date(engine_data, portfolio_data)
        analysis_date = _portfolio_analysis_date(engine_data, portfolio_data, cache_date)
        _positions_raw = portfolio_data.get("positions") or []
        _pos_symbols = sorted({str(p.get("symbol","")).upper() for p in _positions_raw if p.get("symbol")})
        positions_hash = hashlib.sha1(json.dumps(_pos_symbols).encode()).hexdigest()[:8]
        if force_refresh or not _ticker_brief_index_is_fresh():
            _refresh_ticker_briefs()
        ticker_brief_index = _load_ticker_brief_index() or {}
        ticker_brief_prompt_version = str(ticker_brief_index.get("prompt_version") or "").strip() or "unknown"
        news_signature = _portfolio_news_signature()
        cache_path = _portfolio_cache_path(cache_owner_namespace, tab_name, cache_date, positions_hash, narrative_version, news_signature)

        if not force_refresh:
            cached_today = _load_portfolio_cache(cache_path)
            if isinstance(cached_today, dict) and str(cached_today.get("cache_version") or narrative_version) == narrative_version:
                cached_today = dict(cached_today)
                cached_today["cached"] = True
                cached_today.setdefault("cache_mode", "daily")
                cached_today.setdefault("cache_date", cache_date)
                cached_today.setdefault("analysis_date", analysis_date)
                cached_today.setdefault("cache_tab", tab_name)
                cached_today.setdefault("cache_version", narrative_version)
                cached_today.setdefault("cache_scope", "subscriber_daily")
                cached_today.setdefault("cache_namespace", cache_namespace)
                cached_today.setdefault("cache_owner_namespace", cache_owner_namespace)
                cached_today.setdefault("release", RELEASE_VERSION)
                cached_today.setdefault("positions_hash", positions_hash)
                cached_today.setdefault("news_signature", news_signature)
                cached_today.setdefault("ticker_brief_prompt_version", ticker_brief_prompt_version)
                return jsonify(cached_today), 200

        try:
            result = generate_portfolio(portfolio_data, engine_data)
        except Exception:
            rescue = _load_portfolio_cache(cache_path) or _load_latest_portfolio_cache_for_tab(cache_owner_namespace, tab_name, positions_hash, narrative_version, news_signature)
            if isinstance(rescue, dict):
                rescue = dict(rescue)
                rescue["cached"] = True
                rescue["cache_mode"] = "rescue"
                rescue.setdefault("cache_tab", tab_name)
                rescue.setdefault("cache_version", narrative_version)
                rescue.setdefault("cache_scope", "subscriber_daily")
                rescue.setdefault("cache_namespace", cache_namespace)
                rescue.setdefault("cache_owner_namespace", cache_owner_namespace)
                rescue.setdefault("release", RELEASE_VERSION)
                rescue.setdefault("positions_hash", positions_hash)
                rescue.setdefault("news_signature", news_signature)
                rescue.setdefault("ticker_brief_prompt_version", ticker_brief_prompt_version)
                rescue.setdefault("analysis_date", analysis_date)
                return jsonify(rescue), 200
            raise
        generated_at = datetime.now().isoformat(timespec="seconds")
        response = {
            **result,
            "cached": False,
            "cache_mode": "daily",
            "cache_date": cache_date,
            "cache_tab": tab_name,
            "cache_version": narrative_version,
            "cache_scope": "subscriber_daily",
            "cache_namespace": cache_namespace,
            "cache_owner_namespace": cache_owner_namespace,
            "release": RELEASE_VERSION,
            "positions_hash": positions_hash,
            "news_signature": news_signature,
            "ticker_brief_prompt_version": ticker_brief_prompt_version,
            "analysis_date": analysis_date,
            "generated_at": generated_at,
            "saved_at": generated_at,
        }
        _save_portfolio_cache(cache_path, response)
        return jsonify(response), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except (KeyError, TypeError) as exc:
        return jsonify({"error": "Invalid input", "details": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": "Narrative portfolio failed", "details": str(exc)}), 502
