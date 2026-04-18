"""
Narrative API endpoints for briefing, watchlist, and portfolio generation.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request

from services.narrative_generator import (
    generate_briefing,
    generate_portfolio,
    generate_watchlist,
)

narrative_bp = Blueprint("narrative", __name__)

_WATCHLIST_CACHE_TTL_SEC = 60 * 30
_WATCHLIST_CACHE: Dict[str, Dict[str, Any]] = {}
_PORTFOLIO_NARRATIVE_CACHE_DIR = Path(__file__).resolve().parents[1] / "output" / "cache" / "portfolio_narratives"
_PORTFOLIO_NARRATIVE_VERSION = "news_first_v3"
_TICKER_BRIEF_INDEX_PATH = Path(__file__).resolve().parents[1] / "output" / "cache" / "ticker_brief_index.json"
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


def _portfolio_cache_path(
    tab_name: str,
    cache_date: str,
    positions_hash: str = "",
    narrative_version: str = _PORTFOLIO_NARRATIVE_VERSION,
) -> Path:
    suffix = f"_{positions_hash}" if positions_hash else ""
    version_suffix = f"_{_safe_slug(narrative_version)}" if narrative_version else ""
    return _PORTFOLIO_NARRATIVE_CACHE_DIR / _safe_slug(tab_name) / f"{cache_date}{version_suffix}{suffix}.json"


def _load_portfolio_cache(path: Path) -> Dict[str, Any] | None:
    try:
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _ticker_brief_index_is_fresh() -> bool:
    payload = _load_portfolio_cache(_TICKER_BRIEF_INDEX_PATH)
    if not isinstance(payload, dict):
        return False
    current_date = datetime.now(ET_ZONE).date().isoformat()
    return str(payload.get("date") or "")[:10] == current_date


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
        narrative_version = str(engine_data.get("narrative_version") or payload_dict.get("narrative_version") or _PORTFOLIO_NARRATIVE_VERSION).strip() or _PORTFOLIO_NARRATIVE_VERSION
        cache_date = _portfolio_cache_date(engine_data, portfolio_data)
        analysis_date = _portfolio_analysis_date(engine_data, portfolio_data, cache_date)
        _positions_raw = portfolio_data.get("positions") or []
        _pos_symbols = sorted({str(p.get("symbol","")).upper() for p in _positions_raw if p.get("symbol")})
        positions_hash = hashlib.sha1(json.dumps(_pos_symbols).encode()).hexdigest()[:8]
        cache_path = _portfolio_cache_path(tab_name, cache_date, positions_hash, narrative_version)

        if not force_refresh:
            cached = _load_portfolio_cache(cache_path)
            if isinstance(cached, dict) and str(cached.get("cache_version") or narrative_version) == narrative_version:
                cached = dict(cached)
                cached["cached"] = True
                cached.setdefault("cache_mode", "daily")
                cached.setdefault("cache_date", cache_date)
                cached.setdefault("analysis_date", analysis_date)
                cached.setdefault("cache_tab", tab_name)
                cached.setdefault("cache_version", narrative_version)
                return jsonify(cached), 200

        if force_refresh or not _ticker_brief_index_is_fresh():
            _refresh_ticker_briefs()

        result = generate_portfolio(portfolio_data, engine_data)
        generated_at = datetime.now().isoformat(timespec="seconds")
        response = {
            **result,
            "cached": False,
            "cache_mode": "daily",
            "cache_date": cache_date,
            "cache_tab": tab_name,
            "cache_version": narrative_version,
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
