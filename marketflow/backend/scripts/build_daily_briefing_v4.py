"""
build_daily_briefing_v4.py
Daily Briefing Narrative Engine V4 (Market-Reaction-First)

Pipeline:
1) Load multi-source market/news/risk inputs.
2) Build market reaction snapshot from actual price moves.
3) Score event cards with price confirmation and cross-asset reach.
4) Build a driver-first narrative plan (primary/secondary/counter/watchpoints).
5) Generate V4 JSON sections (rule-based fallback, optional LLM refinement).
6) Optional KO->EN fill via DeepL when English fields are missing.
7) Save -> backend/output/cache/daily_briefing_v4.json

Run:
  python backend/scripts/build_daily_briefing_v4.py [--force] [--lang=ko|en] [--slot=preopen|morning|close]
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
CACHE_DIR = BACKEND_DIR / "output" / "cache"
OUTPUT_DIR = BACKEND_DIR / "output"
MARKETFLOW_ROOT = Path(__file__).resolve().parents[2]
for _path in (str(BACKEND_DIR), str(MARKETFLOW_ROOT)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

try:
    from news.news_paths import DAILY_BRIEFING_V4_PATH, MARKET_HEADLINES_HISTORY_PATH
except Exception:
    DAILY_BRIEFING_V4_PATH = CACHE_DIR / "daily_briefing_v4.json"
    MARKET_HEADLINES_HISTORY_PATH = CACHE_DIR / "market-headlines-history.json"

try:
    from news import build_context_news_cache
except Exception:
    try:
        from news.context_news import build_context_news_cache  # type: ignore
    except Exception:
        build_context_news_cache = None  # type: ignore

try:
    from services.release_config import RELEASE_VERSION
except Exception:
    RELEASE_VERSION = "v1.1"

OUT_PATH = DAILY_BRIEFING_V4_PATH


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODEL_ID = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6").strip() or "claude-sonnet-4-6"
PRICE_IN = 3.00 / 1_000_000
PRICE_OUT = 15.00 / 1_000_000

ET_ZONE = ZoneInfo("America/New_York")
MARKET_OPEN_ET = 9 * 60 + 30
MARKET_CLOSE_ET = 16 * 60 + 30

MANDATORY_IMPACT_THRESHOLD = 0.60

SIGNAL_COLOR = {
    "bull": "#22c55e",
    "caution": "#f59e0b",
    "bear": "#ef4444",
    "neutral": "#64748b",
}

REGIME_META = {
    "risk_on": {"ko": "위험선호", "signal": "bull"},
    "risk_off": {"ko": "위험회피", "signal": "bear"},
    "rotation": {"ko": "순환매", "signal": "caution"},
    "mixed": {"ko": "혼조", "signal": "neutral"},
    "crisis": {"ko": "위기", "signal": "bear"},
}

MAJOR_SOURCES = {
    "Reuters": 0.98,
    "Bloomberg": 0.97,
    "Financial Times": 0.95,
    "WSJ": 0.95,
    "CNBC": 0.88,
    "Yahoo Finance": 0.82,
    "MarketWatch": 0.80,
    "Associated Press": 0.78,
}

EVENT_RULES: list[tuple[str, tuple[str, ...], str]] = [
    ("analyst_action", ("price target", "upgrade", "downgrade", "rating", "analyst"), "valuation reset"),
    ("earnings", ("earnings", "guidance", "eps", "revenue", "margin"), "earnings repricing"),
    ("macro_event", ("fed", "powell", "cpi", "ppi", "inflation", "rates", "yield", "treasury"), "rates shock"),
    ("geopolitical", ("iran", "hormuz", "war", "strike", "attack", "tariff", "sanction"), "geopolitical risk premium"),
    ("product_cycle", ("ai", "gpu", "chip", "blackwell", "launch", "data center"), "product cycle"),
    ("watchlist_move", ("watchlist", "badge"), "watchlist momentum"),
    ("risk", ("investigation", "lawsuit", "ban", "recall", "fraud"), "idiosyncratic risk"),
    ("sector_rotation", ("semiconductor", "energy", "utilities", "financial", "software"), "sector rotation"),
]

POSITIVE_HINTS = (
    "beat", "beats", "raise", "raised", "upgrade", "higher", "increase", "surge",
    "rally", "gain", "strong", "approval", "launch", "record", "outperform", "upside",
)
NEGATIVE_HINTS = (
    "miss", "cut", "cuts", "downgrade", "weak", "decline", "slump", "pressure",
    "investigation", "risk", "concern", "tariff", "lawsuit", "recall", "selloff",
    "drop", "fall", "downside", "ban",
)

GEO_KW = ("iran", "hormuz", "middle east", "war", "strike", "attack", "tariff")
POLICY_KW = ("trump", "fed", "powell", "fomc", "speech")
TSLA_KW = ("tesla", "tsla", "deliveries", "cybertruck", "musk")
SEMI_KW = ("semiconductor", "semi", "chip", "soxx", "soxl", "smh", "nvidia", "nvda", "ai")

SECTOR_ETFS = {"XLK", "XLY", "XLE", "XLF", "XLU", "XLV", "XLP", "XLI", "XLB", "XLRE", "XLC"}
INDEX_ASSETS = {"SPY", "QQQ", "IWM", "SPX", "NDX", "RUT", "IXIC"}
MACRO_ASSETS = {"US10Y", "VIX", "DXY"}
COMMODITY_ASSETS = {"WTI", "GOLD", "BTC"}

AI_SEMI_CLUSTER_ASSETS = ("NVDA", "SMH", "SOXL", "TQQQ", "QQQ", "XLK")
ENERGY_CLUSTER_ASSETS = ("WTI", "XLE")
DEFENSIVE_CLUSTER_ASSETS = ("XLRE", "XLP", "XLU")
RATES_CLUSTER_ASSETS = ("US10Y", "DXY", "QQQ", "SPY")

SECTOR_NAME_TO_ETF = {
    "technology": "XLK",
    "consumer cyclical": "XLY",
    "consumer discretionary": "XLY",
    "energy": "XLE",
    "financial": "XLF",
    "financials": "XLF",
    "utilities": "XLU",
    "healthcare": "XLV",
    "health care": "XLV",
    "consumer defensive": "XLP",
    "consumer staples": "XLP",
    "industrials": "XLI",
    "basic materials": "XLB",
    "materials": "XLB",
    "real estate": "XLRE",
    "communication services": "XLC",
}

DRIVER_CLUSTER_DEFS = {
    "ai_semi_profit_taking": {
        "title": "AI/semiconductor high-beta profit taking",
        "title_ko": "AI/반도체 고베타 차익실현",
        "assets": AI_SEMI_CLUSTER_ASSETS,
        "keywords": ("nvidia", "nvda", "semiconductor", "semi", "chip", "gpu", "blackwell", "smh", "soxl", "tqqq", "nasdaq", "high beta", "ai"),
    },
    "oil_energy_strength": {
        "title": "Oil spike and energy strength",
        "title_ko": "유가 급등과 에너지 강세",
        "assets": ENERGY_CLUSTER_ASSETS,
        "keywords": ("oil", "crude", "wti", "energy", "xle", "iran", "hormuz", "middle east"),
    },
    "defensive_real_estate_rotation": {
        "title": "Defensive and real-estate rotation",
        "title_ko": "방어주·부동산 로테이션",
        "assets": DEFENSIVE_CLUSTER_ASSETS,
        "keywords": ("defensive", "consumer defensive", "consumer staples", "utilities", "real estate", "xlp", "xlu", "xlre"),
    },
    "rates_fed_wait": {
        "title": "Rates/Fed waiting mode",
        "title_ko": "금리/Fed 대기",
        "assets": RATES_CLUSTER_ASSETS,
        "keywords": ("fed", "fomc", "powell", "treasury", "yield", "yields", "rates", "us10y", "dxy", "dollar", "cpi", "ppi", "inflation"),
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _norm(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _shorten(text: str, limit: int = 220) -> str:
    value = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _safe_float(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None:
            return default
        text = str(value).strip()
        if not text:
            return default
        return float(text)
    except Exception:
        return default


def _fmt_pct(value: Any, digits: int = 2) -> str:
    num = _safe_float(value, None)
    if num is None:
        return "N/A"
    return f"{num:+.{digits}f}%"


def _fmt_price(value: Any, digits: int = 2) -> str:
    num = _safe_float(value, None)
    if num is None:
        return "N/A"
    return f"{num:.{digits}f}"


def _parse_date_key(value: Any) -> datetime | None:
    text = str(value or "").strip()[:10]
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return None


def _parse_pct_from_text(text: Any) -> float | None:
    raw = str(text or "")
    match = re.search(r"\(([+-]?[0-9]+(?:\.[0-9]+)?)%\)", raw)
    if match:
        return _safe_float(match.group(1), None)
    match = re.search(r"([+-]?[0-9]+(?:\.[0-9]+)?)\s*%", raw)
    if match:
        return _safe_float(match.group(1), None)
    return None


def _current_slot() -> str:
    now = datetime.now(timezone.utc).astimezone(ET_ZONE)
    minutes = now.hour * 60 + now.minute
    if minutes < MARKET_OPEN_ET:
        return "preopen"
    if minutes < MARKET_CLOSE_ET:
        return "morning"
    return "close"


def _slot_label_ko(slot: str) -> str:
    if slot == "preopen":
        return "장전"
    if slot == "morning":
        return "장중"
    if slot == "close":
        return "장마감"
    return slot


def _signal_from_direction(direction: str) -> str:
    if direction == "positive":
        return "bull"
    if direction == "negative":
        return "bear"
    return "neutral"


def _confidence_label(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"


def _asset_bucket(symbol: str) -> str:
    sym = str(symbol or "").upper()
    if sym in INDEX_ASSETS:
        return "index"
    if sym in MACRO_ASSETS:
        return "macro"
    if sym in COMMODITY_ASSETS:
        return "commodity"
    if sym in SECTOR_ETFS:
        return "sector"
    return "single_stock"


def _topic_hit(text: str, keywords: tuple[str, ...]) -> bool:
    lower = _norm(text)
    return any(token in lower for token in keywords)


def _keyword_hit(text: str, keywords: tuple[str, ...]) -> bool:
    lower = _norm(text)
    for token in keywords:
        clean = str(token or "").strip().lower()
        if not clean:
            continue
        if re.search(r"(?<![a-z0-9])" + re.escape(clean) + r"(?![a-z0-9])", lower):
            return True
    return False


def _parse_datetime_any(value: Any, data_date: str | None = None) -> datetime | None:
    text = str(value or "").strip()
    if not text and data_date:
        text = str(data_date or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=ET_ZONE)
        return parsed.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        parsed_date = datetime.strptime(text[:10], "%Y-%m-%d")
        return parsed_date.replace(hour=16, minute=0, tzinfo=ET_ZONE).astimezone(timezone.utc)
    except Exception:
        return None


def _snapshot_timestamp(snapshot: dict[str, Any], data_date: str = "") -> datetime:
    parsed = _parse_datetime_any(snapshot.get("snapshot_timestamp"), data_date)
    if parsed:
        return parsed
    fallback = _parse_datetime_any(data_date)
    if fallback:
        return fallback
    return datetime.now(timezone.utc)


def _move_for_asset(snapshot: dict[str, Any], symbol: str) -> float | None:
    sym = str(symbol or "").upper().strip()
    if not sym:
        return None
    asset_moves = snapshot.get("asset_moves", {}) or {}
    if sym in asset_moves:
        return _safe_float(asset_moves.get(sym), None)
    if sym == "GOLD" and "Gold" in asset_moves:
        return _safe_float(asset_moves.get("Gold"), None)
    return None


def _price_evidence_for_assets(snapshot: dict[str, Any], assets: list[str] | tuple[str, ...]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    seen: set[str] = set()
    for symbol in assets:
        sym = str(symbol or "").upper().strip()
        if not sym or sym in seen:
            continue
        move = _move_for_asset(snapshot, sym)
        if move is None:
            continue
        seen.add(sym)
        evidence.append(
            {
                "symbol": sym,
                "change_pct": round(float(move), 3),
                "change_str": _fmt_pct(move),
                "bucket": _asset_bucket(sym),
            }
        )
    return evidence


def _impact_denominator(symbol: str) -> float:
    sym = str(symbol or "").upper()
    if sym in {"SOXL", "TQQQ"}:
        return 6.0
    if sym in INDEX_ASSETS:
        return 1.5
    if sym in SECTOR_ETFS:
        return 2.0
    if sym in COMMODITY_ASSETS:
        return 3.0
    if sym in MACRO_ASSETS:
        return 1.5
    return 4.0


def _price_impact_score_from_evidence(evidence: list[dict[str, Any]]) -> float:
    if not evidence:
        return 0.05
    scores: list[float] = []
    for row in evidence:
        move = abs(_safe_float(row.get("change_pct"), 0.0) or 0.0)
        denom = _impact_denominator(str(row.get("symbol") or ""))
        scores.append(_clamp(move / denom, 0.0, 1.0))
    return _clamp((sum(scores) / len(scores)) + (0.06 * min(len(scores) - 1, 3)), 0.05, 0.99)


def _dominant_direction_from_evidence(evidence: list[dict[str, Any]]) -> str:
    if not evidence:
        return "neutral"
    weighted = 0.0
    total = 0.0
    for row in evidence:
        move = _safe_float(row.get("change_pct"), 0.0) or 0.0
        weight = max(abs(move), 0.1)
        weighted += weight if move > 0 else -weight if move < 0 else 0.0
        total += weight
    if total <= 0:
        return "neutral"
    ratio = weighted / total
    if ratio > 0.25:
        return "positive"
    if ratio < -0.25:
        return "negative"
    return "neutral"


def _cross_asset_confirmation_score(direction: str, evidence: list[dict[str, Any]]) -> float:
    if not evidence:
        return 0.05
    direction = direction if direction in {"positive", "negative"} else _dominant_direction_from_evidence(evidence)
    if direction == "neutral":
        return 0.45
    wanted = 1 if direction == "positive" else -1
    total = 0.0
    aligned = 0.0
    for row in evidence:
        move = _safe_float(row.get("change_pct"), 0.0) or 0.0
        weight = max(abs(move), 0.1)
        total += weight
        if (move > 0 and wanted > 0) or (move < 0 and wanted < 0):
            aligned += weight
    return _clamp(aligned / total if total else 0.05, 0.05, 0.99)


def _sector_transmission_score_from_evidence(
    assets: list[str] | tuple[str, ...],
    evidence: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> float:
    if not evidence:
        return 0.05
    buckets = {str(row.get("bucket") or "") for row in evidence}
    score = 0.25 + (0.12 * len(buckets))
    if any(str(asset).upper() in SECTOR_ETFS for asset in assets):
        score += 0.18
    if any(str(asset).upper() in INDEX_ASSETS for asset in assets):
        score += 0.10
    if any(str(asset).upper() in {"NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META"} for asset in assets):
        score += 0.08
    leaders = {str(row.get("symbol") or "").upper() for row in (snapshot.get("sector_leaders_raw", []) or [])}
    laggards = {str(row.get("symbol") or "").upper() for row in (snapshot.get("sector_laggards_raw", []) or [])}
    if any(str(asset).upper() in leaders or str(asset).upper() in laggards for asset in assets):
        score += 0.15
    return _clamp(score, 0.05, 0.99)


def _headline_implied_asset_directions(text: str) -> dict[str, int]:
    lower = _norm(text)
    up_words = ("rise", "rises", "rose", "gain", "gains", "jump", "jumps", "surge", "surges", "rally", "higher", "stronger", "up")
    down_words = ("slip", "slips", "fall", "falls", "fell", "drop", "drops", "loss", "losses", "lower", "weaker", "down", "decline")
    implied: dict[str, int] = {}

    def direction_near(asset_terms: tuple[str, ...]) -> int | None:
        if not _keyword_hit(lower, asset_terms):
            return None
        pos = _keyword_hit(lower, up_words)
        neg = _keyword_hit(lower, down_words)
        if pos and not neg:
            return 1
        if neg and not pos:
            return -1
        return None

    for symbol, terms in (
        ("DXY", ("dollar", "dxy")),
        ("GOLD", ("gold",)),
        ("WTI", ("oil", "crude", "wti")),
        ("US10Y", ("yield", "yields", "treasury", "us10y")),
        ("NVDA", ("nvidia", "nvda")),
        ("TSLA", ("tesla", "tsla")),
    ):
        direction = direction_near(terms)
        if direction is not None:
            implied[symbol] = direction
    return implied


def _direction_consistency_score(direction: str, text: str, evidence: list[dict[str, Any]]) -> float:
    if not evidence:
        return 0.20
    implied = _headline_implied_asset_directions(text)
    checked = 0
    aligned = 0
    for row in evidence:
        symbol = str(row.get("symbol") or "").upper()
        if symbol not in implied:
            continue
        move = _safe_float(row.get("change_pct"), 0.0) or 0.0
        if abs(move) < 0.05:
            continue
        checked += 1
        if (move > 0 and implied[symbol] > 0) or (move < 0 and implied[symbol] < 0):
            aligned += 1
    if checked:
        return _clamp(aligned / checked, 0.05, 1.0)
    if direction in {"positive", "negative"}:
        return _cross_asset_confirmation_score(direction, evidence)
    return 0.75


def stale_headline_filter(
    *,
    published: str,
    data_date: str,
    snapshot: dict[str, Any],
    rank: int,
    direction_consistency_score: float,
) -> dict[str, Any]:
    market_ts = _snapshot_timestamp(snapshot, data_date)
    headline_ts = _parse_datetime_any(published, data_date)
    if headline_ts is None:
        fallback = _freshness_score(rank, published, data_date)
        return {
            "freshness_score": _clamp(fallback * 0.75, 0.10, 0.75),
            "headline_age_hours": None,
            "stale": False,
        }

    age_hours = max(0.0, (market_ts - headline_ts).total_seconds() / 3600.0)
    if age_hours <= 6:
        score = 1.0
    elif age_hours <= 18:
        score = 0.82
    elif age_hours <= 36:
        score = 0.58
    elif age_hours <= 72:
        score = 0.34
    else:
        score = 0.16
    if direction_consistency_score < 0.45:
        score *= 0.55
    return {
        "freshness_score": _clamp(score, 0.05, 1.0),
        "headline_age_hours": round(age_hours, 2),
        "stale": age_hours > 36,
    }


# ---------------------------------------------------------------------------
# Freshness / stale
# ---------------------------------------------------------------------------
def build_freshness_meta(
    data_date: Any,
    overview_latest_date: Any = None,
    market_state_generated_at: Any = None,
) -> dict[str, Any]:
    current_et_date = datetime.now(timezone.utc).astimezone(ET_ZONE).date()
    source_dt = _parse_date_key(data_date) or _parse_date_key(overview_latest_date)
    lag_days = (current_et_date - source_dt.date()).days if source_dt else None

    if lag_days is None:
        status = "unknown"
    elif lag_days <= 0:
        status = "fresh"
    elif lag_days <= 3:
        status = "lagging"
    else:
        status = "stale"

    warning = ""
    if status in {"lagging", "stale"} and source_dt is not None:
        warning = (
            f"Source data_date {source_dt.date().isoformat()} is {lag_days} ET day(s) behind "
            f"current ET date {current_et_date.isoformat()}."
        )

    return {
        "status": status,
        "lag_days": lag_days,
        "current_et_date": current_et_date.isoformat(),
        "source_data_date": source_dt.date().isoformat() if source_dt else str(data_date or "")[:10],
        "overview_latest_date": str(overview_latest_date or "")[:10],
        "market_state_generated_at": str(market_state_generated_at or ""),
        "warning": warning,
    }


def is_stale(slot: str | None = None, max_minutes: int = 720) -> bool:
    if not OUT_PATH.exists():
        return True
    try:
        with open(OUT_PATH, encoding="utf-8") as handle:
            payload = json.load(handle)
        generated_at = str(payload.get("generated_at") or "")
        existing_slot = str(payload.get("slot") or "").strip().lower()
        existing_date = str(payload.get("data_date") or "")[:10]
        current_slot = str(slot or _current_slot()).strip().lower()
        current_date = datetime.now(timezone.utc).astimezone(ET_ZONE).strftime("%Y-%m-%d")
        if existing_slot and existing_slot != current_slot:
            return True
        if existing_date and existing_date != current_date:
            return True
        gen = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        age_minutes = (datetime.now(timezone.utc) - gen).total_seconds() / 60.0
        return age_minutes > max_minutes
    except Exception:
        return True


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load(fname: str, dirs: list[Path] | None = None) -> Any:
    for directory in (dirs or [CACHE_DIR, OUTPUT_DIR]):
        path = directory / fname
        if path.exists():
            try:
                with open(path, encoding="utf-8") as handle:
                    return json.load(handle)
            except Exception:
                continue
    return {}


def load_headline_cache() -> list[dict[str, Any]]:
    if not MARKET_HEADLINES_HISTORY_PATH.exists():
        return []
    try:
        with open(MARKET_HEADLINES_HISTORY_PATH, encoding="utf-8") as handle:
            payload = json.load(handle)
        rows = payload.get("headlines", []) if isinstance(payload, dict) else []
        return [row for row in rows if isinstance(row, dict)]
    except Exception:
        return []


def _load_inputs() -> tuple[Any, ...]:
    market_state = load("market_state.json")
    overview = load("overview.json", [CACHE_DIR, OUTPUT_DIR])
    risk_v1 = load("risk_v1.json", [OUTPUT_DIR])
    risk_engine = load("risk_engine.json")
    sector_perf = load("sector_performance.json", [OUTPUT_DIR, CACHE_DIR])
    econ_calendar = load("economic_calendar.json", [OUTPUT_DIR, CACHE_DIR])
    earnings_calendar = load("earnings_calendar.json", [OUTPUT_DIR, CACHE_DIR])
    movers_snapshot = load("movers_snapshot_latest.json")
    context_news = load("context_news.json")
    headline_cache = load_headline_cache()
    core_price_snapshot = load("core_price_snapshot_latest.json")
    action_snapshot = load("action_snapshot.json")
    return (
        market_state,
        overview,
        risk_v1,
        risk_engine,
        sector_perf,
        econ_calendar,
        earnings_calendar,
        movers_snapshot,
        context_news,
        headline_cache,
        core_price_snapshot,
        action_snapshot,
    )


def _refresh_context_news(slot: str) -> dict[str, Any] | None:
    if build_context_news_cache is None:
        return None
    try:
        refreshed = build_context_news_cache(region="us", limit=5, slot=slot)
        if isinstance(refreshed, dict):
            print(
                "[build_daily_briefing_v4] context news "
                f"refreshed date={refreshed.get('date')} status={refreshed.get('news_status')}"
            )
            return refreshed
    except Exception as exc:
        print(f"[build_daily_briefing_v4] WARN context refresh failed: {exc}")
    return None


def _load_api_key() -> str:
    from_env = (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY") or "").strip()
    if from_env:
        return from_env.strip('"').strip("'")

    candidates = [
        BACKEND_DIR / ".env",
        BACKEND_DIR / ".env.local",
        BACKEND_DIR.parent / ".env",
        BACKEND_DIR.parent / ".env.local",
    ]
    for env_path in candidates:
        if not env_path.exists():
            continue
        try:
            with open(env_path, encoding="utf-8", errors="replace") as handle:
                for line in handle:
                    row = line.strip()
                    if not row or row.startswith("#") or "=" not in row:
                        continue
                    key, _, value = row.partition("=")
                    if key.strip() not in {"ANTHROPIC_API_KEY", "CLAUDE_API_KEY"}:
                        continue
                    token = value.strip().strip('"').strip("'")
                    if token:
                        return token
        except Exception:
            continue
    return ""


# ---------------------------------------------------------------------------
# Snapshot builder
# ---------------------------------------------------------------------------
def _build_core_price_map(cps: dict, econ_cal: dict) -> dict[str, dict[str, Any]]:
    price_map: dict[str, dict[str, Any]] = {}

    for row in cps.get("records", []) or []:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        price_map[symbol] = {
            "symbol": symbol,
            "name": row.get("name") or symbol,
            "price": row.get("price"),
            "change_pct": _safe_float(row.get("change_pct"), None),
            "asset_class": row.get("asset_class") or "",
        }

    name_to_symbol = {
        "s&p 500": "SPY",
        "nasdaq 100": "QQQ",
        "russell 2000": "IWM",
        "us 10y treasury": "US10Y",
        "vix": "VIX",
        "dollar index": "DXY",
        "gold": "GOLD",
        "crude oil": "WTI",
        "bitcoin": "BTC",
    }

    for event in econ_cal.get("events", []) or []:
        if not isinstance(event, dict):
            continue
        event_name = _norm(event.get("event"))
        matched_symbol = ""
        for key, symbol in name_to_symbol.items():
            if key in event_name:
                matched_symbol = symbol
                break
        if not matched_symbol:
            continue
        if matched_symbol in price_map and price_map[matched_symbol].get("change_pct") is not None:
            continue

        actual = str(event.get("actual") or "")
        pct = _parse_pct_from_text(actual)
        price_match = re.search(r"([0-9]+(?:\.[0-9]+)?)", actual)
        price_val = _safe_float(price_match.group(1), None) if price_match else None
        price_map[matched_symbol] = {
            "symbol": matched_symbol,
            "name": event.get("event") or matched_symbol,
            "price": price_val,
            "change_pct": pct,
            "asset_class": "macro" if matched_symbol in MACRO_ASSETS else "etf",
        }

    return price_map


def _filter_movers(categories: dict[str, Any]) -> list[dict[str, Any]]:
    real_exchanges = {"NASDAQ", "NYSE", "NYSE ARCA", "AMEX", "BATS"}
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for group in ("gainers", "most_active", "unusual_volume"):
        for row in categories.get(group, []) or []:
            if not isinstance(row, dict):
                continue
            symbol = str(row.get("symbol") or "").upper().strip()
            if not symbol or symbol in seen:
                continue
            exchange = str(row.get("exchange") or "").upper().strip()
            price = _safe_float(row.get("price"), 0.0) or 0.0
            rvol = _safe_float(row.get("relative_volume_10d_calc"), 0.0) or 0.0
            if exchange not in real_exchanges or price < 5.0 or rvol < 0.4:
                continue
            seen.add(symbol)
            output.append({**row, "_group": group})
            if len(output) >= 24:
                return output
    return output


def build_market_reaction_snapshot(
    market_state: dict,
    risk_v1: dict,
    risk_engine: dict,
    sector_perf: dict,
    econ_calendar: dict,
    core_price_snapshot: dict,
    movers_snapshot: dict,
    action_snapshot: dict,
) -> dict[str, Any]:
    price_map = _build_core_price_map(core_price_snapshot, econ_calendar)
    for row in (sector_perf.get("sectors", []) or []):
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        name = str(row.get("name") or symbol).strip()
        if not symbol and name:
            symbol = SECTOR_NAME_TO_ETF.get(_norm(name), "")
        if not symbol:
            continue
        current = price_map.get(symbol, {})
        if current.get("change_pct") is None:
            price_map[symbol] = {
                "symbol": symbol,
                "name": name or symbol,
                "price": row.get("price"),
                "change_pct": _safe_float(row.get("change_1d"), None),
                "asset_class": "sector",
            }
    for row in (action_snapshot.get("watchlist_moves", []) or []):
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        current = price_map.get(symbol, {})
        if current.get("change_pct") is None:
            price_map[symbol] = {
                "symbol": symbol,
                "name": row.get("name") or symbol,
                "price": row.get("price"),
                "change_pct": _safe_float(row.get("chg_pct"), None),
                "asset_class": "watchlist",
            }

    def metric(symbol: str) -> dict[str, Any]:
        row = price_map.get(symbol, {})
        return {
            "symbol": symbol,
            "price": row.get("price"),
            "change_pct": row.get("change_pct"),
            "change_str": _fmt_pct(row.get("change_pct")),
            "price_str": _fmt_price(row.get("price")),
            "name": row.get("name") or symbol,
        }

    indices = {sym: metric(sym) for sym in ("SPY", "QQQ", "IWM")}
    rates_fx_vol = {sym: metric(sym) for sym in ("US10Y", "VIX", "DXY")}
    commodities = {"WTI": metric("WTI"), "Gold": metric("GOLD"), "BTC": metric("BTC")}

    sectors = [row for row in (sector_perf.get("sectors", []) or []) if isinstance(row, dict)]
    sectors_sorted = sorted(sectors, key=lambda row: _safe_float(row.get("change_1d"), 0.0) or 0.0, reverse=True)
    leaders = sectors_sorted[:3]
    laggards = sectors_sorted[-3:] if sectors_sorted else []

    def _sector_line(row: dict[str, Any]) -> str:
        name = str(row.get("name") or row.get("symbol") or "?")
        chg = _safe_float(row.get("change_1d"), None)
        return f"{name} ({_fmt_pct(chg)})"

    movers_candidates: list[dict[str, Any]] = []
    major_symbols = ["TSLA", "NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "SMH", "SOXL", "TQQQ"]
    for symbol in major_symbols:
        row = price_map.get(symbol)
        if not row:
            continue
        movers_candidates.append(
            {
                "symbol": symbol,
                "name": row.get("name") or symbol,
                "change_pct": row.get("change_pct"),
                "price": row.get("price"),
            }
        )

    for row in (action_snapshot.get("watchlist_moves", []) or [])[:8]:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        movers_candidates.append(
            {
                "symbol": symbol,
                "name": symbol,
                "change_pct": _safe_float(row.get("chg_pct"), None),
                "price": None,
            }
        )

    unique_movers: dict[str, dict[str, Any]] = {}
    for row in movers_candidates:
        symbol = str(row.get("symbol") or "").upper()
        if not symbol:
            continue
        if symbol not in unique_movers:
            unique_movers[symbol] = row
    major_movers = sorted(
        unique_movers.values(),
        key=lambda row: abs(_safe_float(row.get("change_pct"), 0.0) or 0.0),
        reverse=True,
    )[:6]

    filtered_movers = _filter_movers(movers_snapshot.get("categories", {}) or {})
    notable_movers = []
    for row in filtered_movers[:8]:
        symbol = str(row.get("symbol") or "").upper().strip()
        notable_movers.append(
            {
                "symbol": symbol,
                "name": str(row.get("name") or symbol),
                "change_pct": _safe_float(row.get("change_pct"), None),
                "rvol": _safe_float(row.get("relative_volume_10d_calc"), None),
            }
        )

    current = risk_v1.get("current", {}) or {}
    mss_score = _safe_float(current.get("score"), 100.0) or 100.0
    mss_level = int(_safe_float(current.get("level"), 0) or 0)
    mss_zone = str(current.get("score_zone") or "")
    vol_pct = _safe_float(current.get("vol_pct"), None)

    spy = _safe_float(indices["SPY"]["change_pct"], 0.0) or 0.0
    qqq = _safe_float(indices["QQQ"]["change_pct"], 0.0) or 0.0
    iwm = _safe_float(indices["IWM"]["change_pct"], 0.0) or 0.0
    vix = _safe_float(rates_fx_vol["VIX"]["change_pct"], 0.0) or 0.0
    breadth = spy + qqq + iwm
    dispersion = 0.0
    if leaders and laggards:
        dispersion = (
            abs(_safe_float(leaders[0].get("change_1d"), 0.0) or 0.0)
            + abs(_safe_float(laggards[-1].get("change_1d"), 0.0) or 0.0)
        )

    if mss_level >= 4 or (qqq <= -2.0 and vix >= 10):
        regime = "crisis"
    elif mss_level >= 3 or (qqq <= -1.0 and spy <= -0.6):
        regime = "risk_off"
    elif spy >= 0.6 and qqq >= 0.8 and (vix <= 0.5):
        regime = "risk_on"
    elif dispersion >= 2.2 and ((leaders and _safe_float(leaders[0].get("change_1d"), 0.0) or 0.0) > 0.5):
        regime = "rotation"
    else:
        regime = "mixed"

    confidence_score = 0.45
    if abs(breadth) > 2.0:
        confidence_score += 0.25
    if dispersion >= 2.0:
        confidence_score += 0.15
    if mss_level >= 3 or mss_level == 0:
        confidence_score += 0.1
    confidence_score = _clamp(confidence_score, 0.25, 0.95)
    confidence = _confidence_label(confidence_score)

    asset_moves = {
        symbol: _safe_float(row.get("change_pct"), None)
        for symbol, row in price_map.items()
    }

    return {
        "snapshot_timestamp": core_price_snapshot.get("as_of") or core_price_snapshot.get("generated_at") or sector_perf.get("timestamp"),
        "regime": regime,
        "regime_ko": REGIME_META.get(regime, {}).get("ko", "혼조"),
        "confidence": confidence,
        "confidence_score": round(confidence_score, 3),
        "indices": indices,
        "rates_fx_vol": rates_fx_vol,
        "commodities": commodities,
        "sector_leaders": [_sector_line(row) for row in leaders],
        "sector_laggards": [_sector_line(row) for row in laggards],
        "sector_leaders_raw": leaders,
        "sector_laggards_raw": laggards,
        "major_movers": major_movers,
        "notable_movers": notable_movers,
        "asset_moves": asset_moves,
        "mss_score": mss_score,
        "mss_level": mss_level,
        "mss_zone": mss_zone,
        "vol_pct": vol_pct,
        "shock_probability": (risk_engine.get("shock_probability", {}) or {}).get("value"),
    }


# ---------------------------------------------------------------------------
# Event cards with price confirmation
# ---------------------------------------------------------------------------
def _event_direction(text: str) -> str:
    lower = _norm(text)
    pos_hits = sum(1 for token in POSITIVE_HINTS if token in lower)
    neg_hits = sum(1 for token in NEGATIVE_HINTS if token in lower)
    if pos_hits > neg_hits + 1:
        return "positive"
    if neg_hits > pos_hits + 1:
        return "negative"
    return "neutral"


def _classify_event_type(text: str) -> tuple[str, str]:
    lower = _norm(text)
    for event_type, keywords, hint in EVENT_RULES:
        if any(token in lower for token in keywords):
            return event_type, hint
    return "market_update", "broad market context"


def _event_source_score(source: str) -> float:
    clean = str(source or "").strip()
    if clean in MAJOR_SOURCES:
        return MAJOR_SOURCES[clean]
    return 0.72


def _event_directness_score(event_type: str, text: str) -> float:
    lower = _norm(text)
    if "schedule" in lower or "calendar" in lower:
        return 0.62
    if event_type in {"analyst_action", "earnings", "macro_event", "geopolitical", "risk"}:
        return 1.0
    if event_type in {"product_cycle", "sector_rotation", "watchlist_move"}:
        return 0.82
    if any(token in lower for token in ("ticker", "price", "guidance", "delivery", "cpi", "fed")):
        return 0.76
    return 0.58


def _infer_assets(
    text: str,
    event_type: str,
    symbols_in_text: list[str],
    known_assets: set[str],
) -> list[str]:
    assets: list[str] = []

    def add(symbol: str) -> None:
        sym = symbol.upper().strip()
        if sym and sym not in assets:
            assets.append(sym)

    for symbol in symbols_in_text:
        if symbol in known_assets or symbol in SECTOR_ETFS or symbol in INDEX_ASSETS or symbol in MACRO_ASSETS or symbol in COMMODITY_ASSETS:
            add(symbol)

    if _keyword_hit(text, ("tesla", "tsla", "musk")):
        for symbol in ("TSLA", "QQQ", "XLY"):
            add(symbol)
    if _keyword_hit(text, ("nvidia", "nvda", "semiconductor", "semi", "soxx", "smh", "soxl", "chip", "gpu", "blackwell", "ai")):
        for symbol in ("NVDA", "SMH", "SOXL", "XLK", "QQQ"):
            add(symbol)
    if _keyword_hit(text, ("fed", "fomc", "powell", "yield", "yields", "rates", "cpi", "ppi", "inflation", "treasury", "us10y")):
        for symbol in ("US10Y", "DXY", "QQQ", "SPY"):
            add(symbol)
    if _keyword_hit(text, ("iran", "hormuz", "middle east", "war", "strike", "attack", "oil", "crude", "wti")):
        for symbol in ("WTI", "XLE", "VIX", "SPY"):
            add(symbol)
    if _keyword_hit(text, ("dollar", "dxy")):
        for symbol in ("DXY", "GOLD"):
            add(symbol)
    if _keyword_hit(text, ("gold",)):
        add("GOLD")
    if _keyword_hit(text, ("bitcoin", "btc")):
        add("BTC")
    if _keyword_hit(text, ("energy", "xle")):
        add("XLE")
    if _keyword_hit(text, ("utilities", "xlu")):
        add("XLU")
    if _keyword_hit(text, ("real estate", "xlre")):
        add("XLRE")
    if _keyword_hit(text, ("consumer defensive", "consumer staples", "xlp")):
        add("XLP")

    if event_type == "sector_rotation":
        for symbol in ("XLK", "XLE", "XLRE", "XLP", "XLU", "SPY", "QQQ"):
            add(symbol)

    if _keyword_hit(text, ("gold",)):
        allowed = {"GOLD", "DXY", "US10Y", "WTI", "XLE", "VIX"}
        assets = [symbol for symbol in assets if symbol in allowed]

    if not assets:
        if event_type in {"macro_event", "geopolitical"}:
            assets = ["SPY", "QQQ", "US10Y", "DXY"]
        else:
            assets = ["SPY", "QQQ"]
    return assets[:8]


def _freshness_score(rank: int, published_text: str, data_date: str) -> float:
    base = _clamp(1.0 - (rank * 0.08), 0.35, 1.0)
    dt_text = str(published_text or "").strip()
    bonus = 0.0
    if data_date and data_date in dt_text:
        bonus = 0.08
    elif dt_text:
        try:
            parsed = datetime.fromisoformat(dt_text.replace("Z", "+00:00"))
            age_hours = max(0.0, (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds() / 3600.0)
            bonus = _clamp(0.2 - (age_hours / 72.0), 0.0, 0.2)
        except Exception:
            bonus = 0.02
    return _clamp(base + bonus, 0.25, 1.0)


def _price_confirmation_score(direction: str, assets: list[str], asset_moves: dict[str, float | None]) -> float:
    moves: list[float] = []
    for symbol in assets:
        value = asset_moves.get(symbol)
        if value is not None:
            moves.append(float(value))
    if not moves:
        return 0.2

    avg_move = sum(moves) / len(moves)
    magnitude = sum(min(abs(value) / 3.0, 1.0) for value in moves) / len(moves)
    consistency = 0.0
    if direction == "positive" and avg_move > 0:
        consistency = 0.18
    elif direction == "negative" and avg_move < 0:
        consistency = 0.18
    elif direction == "neutral":
        consistency = 0.08
    return _clamp(0.25 + (0.62 * magnitude) + consistency, 0.05, 0.99)


def _cross_asset_reach_score(assets: list[str]) -> float:
    if not assets:
        return 0.2
    buckets = {_asset_bucket(symbol) for symbol in assets}
    return _clamp(0.20 + (0.18 * len(buckets)), 0.2, 1.0)


def _extract_symbols(text: str) -> list[str]:
    tokens = re.findall(r"\b[A-Z]{2,5}\b", str(text or ""))
    blocked = {"THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT", "WEEK", "NEXT", "MOVE"}
    return [token for token in tokens if token not in blocked]


def price_event_matcher(
    *,
    text: str,
    event_type: str,
    direction: str,
    symbols_in_text: list[str],
    known_assets: set[str],
    snapshot: dict[str, Any],
    published: str,
    data_date: str,
    rank: int,
) -> dict[str, Any]:
    affected_assets = _infer_assets(text, event_type, symbols_in_text, known_assets)
    evidence = _price_evidence_for_assets(snapshot, affected_assets)
    price_impact = _price_impact_score_from_evidence(evidence)
    direction_consistency = _direction_consistency_score(direction, text, evidence)
    stale_meta = stale_headline_filter(
        published=published,
        data_date=data_date,
        snapshot=snapshot,
        rank=rank,
        direction_consistency_score=direction_consistency,
    )
    freshness = float(stale_meta.get("freshness_score", 0.25) or 0.25)
    cross_asset_confirmation = _cross_asset_confirmation_score(direction, evidence)
    sector_transmission = _sector_transmission_score_from_evidence(affected_assets, evidence, snapshot)

    penalties: list[str] = []
    if not evidence:
        penalties.append("no_price_evidence")
    if direction_consistency < 0.45:
        penalties.append("headline_price_direction_conflict")
    if stale_meta.get("stale"):
        penalties.append("stale_headline")

    event_role = "driver_candidate"
    if "headline_price_direction_conflict" in penalties or freshness < 0.30:
        event_role = "watchpoint"

    return {
        "affected_assets": affected_assets,
        "price_evidence": evidence,
        "price_impact_score": price_impact,
        "cross_asset_confirmation": cross_asset_confirmation,
        "sector_transmission_score": sector_transmission,
        "direction_consistency_score": direction_consistency,
        "freshness_score": freshness,
        "headline_age_hours": stale_meta.get("headline_age_hours"),
        "penalties": penalties,
        "event_role": event_role,
    }


def build_event_cards(
    *,
    data_date: str,
    headline_rows: list[dict[str, Any]],
    context_news: dict[str, Any],
    earnings_calendar: dict[str, Any],
    econ_calendar: dict[str, Any],
    movers_snapshot: dict[str, Any],
    action_snapshot: dict[str, Any],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    def add_candidate(
        *,
        title: str,
        summary: str,
        source: str,
        published: str,
        hint_event_type: str | None = None,
        hint_direction: str | None = None,
    ) -> None:
        clean_title = _shorten(title, 180)
        clean_summary = _shorten(summary, 240)
        if not clean_title:
            return
        candidates.append(
            {
                "title": clean_title,
                "summary": clean_summary,
                "source": source or "Unknown",
                "published": published or "",
                "hint_event_type": hint_event_type or "",
                "hint_direction": hint_direction or "",
            }
        )

    for row in (headline_rows or [])[:24]:
        if not isinstance(row, dict):
            continue
        add_candidate(
            title=str(row.get("headline") or "").strip(),
            summary=str(row.get("summary") or "").strip(),
            source=str(row.get("source") or "Headline Tape"),
            published=str(row.get("publishedAtET") or row.get("dateET") or row.get("timeET") or ""),
        )

    for row in (context_news.get("articles", []) or [])[:12]:
        if not isinstance(row, dict):
            continue
        add_candidate(
            title=str(row.get("title") or row.get("headline") or "").strip(),
            summary=str(row.get("summary") or "").strip(),
            source=str(row.get("publisher") or row.get("source") or "Context News"),
            published=str(row.get("published_at") or row.get("date") or ""),
        )

    for theme in (context_news.get("selected_themes", []) or [])[:6]:
        text = str(theme or "").strip()
        if not text:
            continue
        add_candidate(
            title=text,
            summary=text,
            source="Context Theme",
            published=data_date,
            hint_event_type="market_update",
            hint_direction="neutral",
        )

    for row in (earnings_calendar.get("earnings", []) or [])[:14]:
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker") or row.get("symbol") or "").upper().strip()
        if not ticker:
            continue
        date = str(row.get("date") or "")
        company = str(row.get("name") or ticker)
        add_candidate(
            title=f"{ticker} earnings schedule",
            summary=f"{ticker} ({company}) earnings date={date}",
            source="Earnings Calendar",
            published=date,
            hint_event_type="earnings",
            hint_direction="neutral",
        )

    for row in (econ_calendar.get("events", []) or [])[:20]:
        if not isinstance(row, dict):
            continue
        event_name = str(row.get("event") or "").strip()
        if not event_name:
            continue
        is_market_snapshot = any(
            token in _norm(event_name)
            for token in ("s&p 500", "nasdaq 100", "russell 2000", "vix", "dollar index", "gold", "crude", "bitcoin")
        )
        if is_market_snapshot:
            continue
        actual = str(row.get("actual") or "-")
        forecast = str(row.get("forecast") or "-")
        event_date = str(row.get("date") or data_date)
        add_candidate(
            title=event_name,
            summary=f"{event_name} actual={actual} forecast={forecast}",
            source="Economic Calendar",
            published=event_date,
            hint_event_type="macro_event",
        )

    for row in (action_snapshot.get("watchlist_moves", []) or [])[:8]:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        chg = _safe_float(row.get("chg_pct"), None)
        direction = "neutral"
        if chg is not None and chg > 0:
            direction = "positive"
        elif chg is not None and chg < 0:
            direction = "negative"
        add_candidate(
            title=f"{symbol} watchlist move",
            summary=f"{symbol} {row.get('badge','')} {row.get('badge_reason','')}",
            source="Watchlist",
            published=data_date,
            hint_event_type="watchlist_move",
            hint_direction=direction,
        )

    filtered_movers = _filter_movers((movers_snapshot.get("categories") or {}))
    for row in filtered_movers[:10]:
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        chg = _safe_float(row.get("change_pct"), 0.0) or 0.0
        direction = "positive" if chg > 0 else "negative" if chg < 0 else "neutral"
        add_candidate(
            title=f"{symbol} notable mover",
            summary=f"{symbol} {row.get('name','')} moved {_fmt_pct(chg)} with rvol={_safe_float(row.get('relative_volume_10d_calc'),0.0):.1f}x",
            source=str(row.get("exchange") or "Market Movers"),
            published=data_date,
            hint_event_type="market_mover",
            hint_direction=direction,
        )

    known_assets = {str(symbol).upper() for symbol in snapshot.get("asset_moves", {}).keys()}
    asset_moves: dict[str, float | None] = snapshot.get("asset_moves", {})
    seen_keys: set[str] = set()
    cards: list[dict[str, Any]] = []

    for rank, candidate in enumerate(candidates):
        title = str(candidate.get("title") or "")
        summary = str(candidate.get("summary") or "")
        source = str(candidate.get("source") or "Unknown")
        published = str(candidate.get("published") or "")
        joined = f"{title}. {summary}".strip()
        key = _norm(joined)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)

        event_type, impact_hint = _classify_event_type(joined)
        if candidate.get("hint_event_type"):
            event_type = str(candidate.get("hint_event_type") or event_type)
        direction = _event_direction(joined)
        if candidate.get("hint_direction"):
            direction = str(candidate.get("hint_direction") or direction)

        symbols_in_text = _extract_symbols(title + " " + summary)
        match = price_event_matcher(
            text=joined,
            event_type=event_type,
            direction=direction,
            symbols_in_text=symbols_in_text,
            known_assets=known_assets,
            snapshot=snapshot,
            published=published,
            data_date=data_date,
            rank=rank,
        )
        affected_assets = match["affected_assets"]

        directness = _event_directness_score(event_type, joined)
        freshness = float(match.get("freshness_score", 0.25) or 0.25)
        source_score = _event_source_score(source)
        price_impact = float(match.get("price_impact_score", 0.05) or 0.05)
        cross_asset_confirmation = float(match.get("cross_asset_confirmation", 0.05) or 0.05)
        sector_transmission = float(match.get("sector_transmission_score", 0.05) or 0.05)
        direction_consistency = float(match.get("direction_consistency_score", 0.2) or 0.2)

        lower_text = _norm(joined)
        if event_type == "earnings" and ("schedule" in lower_text or "calendar" in lower_text):
            directness = _clamp(directness * 0.75, 0.2, 1.0)
            price_impact = _clamp(price_impact * 0.78, 0.05, 0.99)

        market_impact = (
            (price_impact * 0.40)
            + (cross_asset_confirmation * 0.20)
            + (sector_transmission * 0.15)
            + (directness * 0.15)
            + (freshness * 0.10)
        )
        penalties = list(match.get("penalties", []) or [])
        if "no_price_evidence" in penalties:
            market_impact *= 0.35
        if "headline_price_direction_conflict" in penalties:
            market_impact *= 0.45
        market_impact = _clamp(market_impact, 0.03, 0.99)

        cards.append(
            {
                "event_type": event_type,
                "title": title,
                "summary": _shorten(summary or title, 220),
                "source": source,
                "published": published,
                "impact_hint": impact_hint,
                "direction": direction,
                "affected_assets": affected_assets,
                "price_evidence": match.get("price_evidence", []),
                "scores": {
                    "directness": round(directness, 3),
                    "freshness": round(freshness, 3),
                    "source_credibility": round(source_score, 3),
                    "price_impact_score": round(price_impact, 3),
                    "cross_asset_confirmation": round(cross_asset_confirmation, 3),
                    "sector_transmission_score": round(sector_transmission, 3),
                    "direction_consistency_score": round(direction_consistency, 3),
                    "headline_age_hours": match.get("headline_age_hours"),
                },
                "penalties": penalties,
                "event_role": match.get("event_role", "driver_candidate"),
                "market_impact_score": round(market_impact, 3),
                "confidence": _confidence_label(market_impact),
            }
        )

    cards.sort(key=lambda row: (-float(row.get("market_impact_score", 0) or 0), str(row.get("title", ""))))
    return cards[:24]


def _cluster_key_for_card(card: dict[str, Any]) -> str:
    text = f"{card.get('title','')} {card.get('summary','')}"
    assets = {str(asset).upper() for asset in (card.get("affected_assets", []) or [])}
    if _keyword_hit(text, DRIVER_CLUSTER_DEFS["rates_fed_wait"]["keywords"]) and not (assets & {"NVDA", "SMH", "SOXL"}):
        return "rates_fed_wait"
    if _keyword_hit(text, DRIVER_CLUSTER_DEFS["oil_energy_strength"]["keywords"]) or assets & set(ENERGY_CLUSTER_ASSETS):
        return "oil_energy_strength"
    if _keyword_hit(text, DRIVER_CLUSTER_DEFS["defensive_real_estate_rotation"]["keywords"]) or assets & set(DEFENSIVE_CLUSTER_ASSETS):
        return "defensive_real_estate_rotation"
    if _keyword_hit(text, DRIVER_CLUSTER_DEFS["ai_semi_profit_taking"]["keywords"]) or assets & {"NVDA", "SMH", "SOXL", "TQQQ"}:
        return "ai_semi_profit_taking"
    if "TSLA" in assets:
        return "single_stock_tsla"
    return ""


def _cluster_price_trigger(cluster_id: str, snapshot: dict[str, Any]) -> bool:
    moves = {symbol: _move_for_asset(snapshot, symbol) for symbol in DRIVER_CLUSTER_DEFS.get(cluster_id, {}).get("assets", ())}
    if cluster_id == "ai_semi_profit_taking":
        return (
            abs(moves.get("SOXL") or 0.0) >= 3.0
            or abs(moves.get("TQQQ") or 0.0) >= 2.0
            or abs(moves.get("SMH") or 0.0) >= 1.2
            or abs(moves.get("NVDA") or 0.0) >= 1.0
            or abs(moves.get("QQQ") or 0.0) >= 0.7
        )
    if cluster_id == "oil_energy_strength":
        return abs(moves.get("WTI") or 0.0) >= 2.0 or abs(moves.get("XLE") or 0.0) >= 0.8
    if cluster_id == "defensive_real_estate_rotation":
        defensive = [(moves.get("XLRE") or 0.0), (moves.get("XLP") or 0.0), (moves.get("XLU") or 0.0)]
        qqq = _move_for_asset(snapshot, "QQQ") or 0.0
        return max(defensive) >= 0.45 or (sum(defensive) > 0 and qqq < 0)
    if cluster_id == "rates_fed_wait":
        return abs(moves.get("US10Y") or 0.0) >= 0.10 or abs(moves.get("DXY") or 0.0) >= 0.10
    return False


def _cluster_transmission_ko(cluster_id: str, direction: str, evidence_text: str) -> str:
    if cluster_id == "ai_semi_profit_taking":
        return f"{evidence_text} 확인으로 AI/반도체와 나스닥 고베타 구간의 변동성이 함께 확대"
    if cluster_id == "oil_energy_strength":
        return f"{evidence_text} 확인으로 원유 민감 섹터가 지수 방어축으로 부상"
    if cluster_id == "defensive_real_estate_rotation":
        return f"{evidence_text} 확인으로 성장주보다 방어주·부동산 쪽 상대강도가 개선"
    if cluster_id == "rates_fed_wait":
        return f"{evidence_text} 확인으로 금리와 달러가 성장주 밸류에이션을 다시 압박"
    if cluster_id == "single_stock_tsla":
        return f"{evidence_text} 확인으로 테슬라 단일종목 리스크가 소비재와 QQQ에 전달"
    return f"{evidence_text} 확인으로 관련 자산군의 상대강도 차별화가 확대"


def _cluster_implication_ko(cluster_id: str, direction: str, risk_level: str) -> str:
    if risk_level in {"High Risk", "Crisis"}:
        return "리스크 레벨이 높아 추격보다 익스포저 축소와 손절 기준 관리가 우선"
    if cluster_id == "ai_semi_profit_taking":
        return "고베타 기술주 비중은 반등 확인 전까지 낮추고, 반도체는 상대강도 회복 여부를 확인"
    if cluster_id == "oil_energy_strength":
        return "에너지는 단기 상대강도 우위지만 유가 급등 지속 여부와 지정학 헤드라인을 함께 점검"
    if cluster_id == "defensive_real_estate_rotation":
        return "지수 방향성이 약할수록 방어주·부동산의 완충 역할을 우선 검토"
    if cluster_id == "rates_fed_wait":
        return "금리와 달러가 되돌림을 보이기 전까지 성장주 밸류에이션 부담을 보수적으로 반영"
    if direction == "positive":
        return "가격 확인이 붙은 강세 테마만 선별적으로 따라가고 과열 구간은 분할 접근"
    if direction == "negative":
        return "가격 확인이 붙은 약세 테마는 반등보다 리스크 관리 우선"
    return "추가 가격 확인 전까지 중립 포지션을 유지"


def _build_driver_cluster(
    cluster_id: str,
    cards: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> dict[str, Any] | None:
    definition = DRIVER_CLUSTER_DEFS.get(cluster_id)
    if not definition:
        if cluster_id == "single_stock_tsla":
            definition = {
                "title": "Tesla single-stock pressure",
                "title_ko": "테슬라 단일종목 압박",
                "assets": ("TSLA", "QQQ", "XLY"),
                "keywords": ("tesla", "tsla"),
            }
        else:
            return None

    assets = tuple(definition.get("assets", ()))
    evidence = _price_evidence_for_assets(snapshot, assets)
    if not cards and not _cluster_price_trigger(cluster_id, snapshot):
        return None
    if not evidence:
        return None

    direction = _dominant_direction_from_evidence(evidence)
    price_impact = _price_impact_score_from_evidence(evidence)
    cross_confirmation = _cross_asset_confirmation_score(direction, evidence)
    sector_transmission = _sector_transmission_score_from_evidence(list(assets), evidence, snapshot)
    if cards:
        directness = max(float((card.get("scores") or {}).get("directness", 0.58) or 0.58) for card in cards)
        freshness = max(float((card.get("scores") or {}).get("freshness", 0.30) or 0.30) for card in cards)
        consistency_values = [
            float((card.get("scores") or {}).get("direction_consistency_score", 0.75) or 0.75)
            for card in cards
        ]
        direction_consistency = sum(consistency_values) / len(consistency_values)
    else:
        directness = 0.62
        freshness = 0.90
        direction_consistency = 0.85

    driver_score = (
        (price_impact * 0.40)
        + (cross_confirmation * 0.20)
        + (sector_transmission * 0.15)
        + (directness * 0.15)
        + (freshness * 0.10)
    )
    if direction_consistency < 0.45:
        driver_score *= 0.55
    driver_score = _clamp(driver_score, 0.03, 0.99)

    evidence_text = ", ".join(f"{row['symbol']} {row['change_str']}" for row in evidence[:5])
    supporting_events = []
    seen_titles: set[str] = set()
    for card in sorted(cards, key=lambda row: -float(row.get("market_impact_score", 0) or 0)):
        title = str(card.get("title") or "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        supporting_events.append(
            {
                "title": title,
                "source": card.get("source"),
                "published": card.get("published"),
                "market_impact_score": card.get("market_impact_score"),
                "event_role": card.get("event_role"),
            }
        )
        if len(supporting_events) >= 4:
            break

    return {
        "driver_kind": "cluster",
        "cluster_id": cluster_id,
        "event_type": "driver_cluster",
        "title": str(definition.get("title") or cluster_id),
        "title_ko": str(definition.get("title_ko") or definition.get("title") or cluster_id),
        "summary": evidence_text,
        "direction": direction,
        "affected_assets": [row["symbol"] for row in evidence],
        "price_evidence": evidence,
        "market_reaction_ko": f"가격 반응: {evidence_text}",
        "market_reaction": f"Price reaction: {evidence_text}",
        "transmission_ko": _cluster_transmission_ko(cluster_id, direction, evidence_text),
        "transmission": _cluster_transmission_ko(cluster_id, direction, evidence_text),
        "investor_implication_ko": _cluster_implication_ko(cluster_id, direction, "Normal"),
        "investor_implication": _cluster_implication_ko(cluster_id, direction, "Normal"),
        "scores": {
            "price_impact_score": round(price_impact, 3),
            "cross_asset_confirmation": round(cross_confirmation, 3),
            "sector_transmission_score": round(sector_transmission, 3),
            "event_directness_score": round(directness, 3),
            "freshness_score": round(freshness, 3),
            "direction_consistency_score": round(direction_consistency, 3),
        },
        "market_impact_score": round(driver_score, 3),
        "driver_score": round(driver_score, 3),
        "confidence": _confidence_label(driver_score),
        "supporting_events": supporting_events,
    }


def driver_cluster_builder(cards: list[dict[str, Any]], snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {cluster_id: [] for cluster_id in DRIVER_CLUSTER_DEFS}
    grouped["single_stock_tsla"] = []
    watchpoint_cards: list[dict[str, Any]] = []

    for card in cards:
        cluster_id = _cluster_key_for_card(card)
        if card.get("event_role") == "watchpoint":
            watchpoint_cards.append(card)
            if cluster_id != "rates_fed_wait":
                continue
        if cluster_id:
            grouped.setdefault(cluster_id, []).append(card)

    clusters: list[dict[str, Any]] = []
    for cluster_id in list(DRIVER_CLUSTER_DEFS.keys()) + ["single_stock_tsla"]:
        cluster = _build_driver_cluster(cluster_id, grouped.get(cluster_id, []), snapshot)
        if cluster:
            clusters.append(cluster)

    used_ids = {str(cluster.get("cluster_id") or "") for cluster in clusters}
    for card in cards:
        if card.get("event_role") == "watchpoint":
            continue
        if _cluster_key_for_card(card) in used_ids:
            continue
        score = float(card.get("market_impact_score", 0) or 0)
        evidence = card.get("price_evidence", []) or []
        if score < 0.65 or not evidence:
            continue
        title = _shorten(str(card.get("title") or card.get("summary") or "Event-driven move"), 90)
        clusters.append(
            {
                "driver_kind": "cluster",
                "cluster_id": f"event_{len(clusters) + 1}",
                "event_type": "driver_cluster",
                "title": title,
                "title_ko": title,
                "summary": str(card.get("summary") or title),
                "direction": card.get("direction"),
                "affected_assets": [row.get("symbol") for row in evidence],
                "price_evidence": evidence,
                "market_reaction_ko": _driver_reaction_ko(card, snapshot),
                "market_reaction": _driver_reaction_ko(card, snapshot),
                "transmission_ko": _driver_transmission_ko(card),
                "transmission": _driver_transmission_ko(card),
                "investor_implication_ko": _driver_implication_ko(card, "Normal"),
                "investor_implication": _driver_implication_ko(card, "Normal"),
                "scores": card.get("scores", {}),
                "market_impact_score": round(score, 3),
                "driver_score": round(score, 3),
                "confidence": _confidence_label(score),
                "supporting_events": [{"title": title, "source": card.get("source"), "published": card.get("published")}],
            }
        )

    clusters.sort(key=lambda row: (-float(row.get("driver_score", row.get("market_impact_score", 0)) or 0), str(row.get("title", ""))))
    for idx, cluster in enumerate(clusters, start=1):
        cluster["rank"] = idx
    return clusters[:8]


def build_driver_plan(
    cards: list[dict[str, Any]],
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clusters = driver_cluster_builder(cards, snapshot or {}) if snapshot is not None else []
    if not cards and not clusters:
        return {
            "top_drivers": [],
            "driver_clusters": [],
            "primary_driver": {},
            "secondary_drivers": [],
            "counter_force": {},
            "watchpoints": [],
            "supporting_events": [],
        }

    strong = [row for row in clusters if float(row.get("driver_score", row.get("market_impact_score", 0)) or 0) >= 0.45]
    top = strong[:5] if len(strong) >= 3 else clusters[:5]
    if len(top) < 3:
        top = clusters[:3]

    primary = top[0] if top else {}
    primary_dir = str(primary.get("direction") or "neutral")
    secondary = top[1:3]
    counter = next(
        (
            row
            for row in clusters
            if row is not primary and str(row.get("direction") or "neutral") not in {"neutral", primary_dir}
        ),
        {},
    )
    watchpoints = [
        row
        for row in cards
        if row.get("event_role") == "watchpoint"
        or str(row.get("event_type") or "") in {"macro_event", "earnings", "geopolitical"}
    ][:4]
    supporting = [row for row in cards if row not in watchpoints][:5]

    return {
        "top_drivers": top,
        "driver_clusters": clusters,
        "primary_driver": primary,
        "secondary_drivers": secondary,
        "counter_force": counter,
        "watchpoints": watchpoints,
        "supporting_events": supporting,
    }


# ---------------------------------------------------------------------------
# Section synthesis
# ---------------------------------------------------------------------------
def _driver_title_ko(card: dict[str, Any]) -> str:
    label_map = {
        "analyst_action": "애널리스트 액션",
        "earnings": "실적/가이던스",
        "macro_event": "거시 이벤트",
        "geopolitical": "지정학 이슈",
        "product_cycle": "제품 사이클",
        "watchlist_move": "관심종목 변동",
        "risk": "개별 리스크",
        "sector_rotation": "섹터 로테이션",
        "market_mover": "수급 급변 종목",
        "market_update": "시장 업데이트",
    }
    event_type = str(card.get("event_type") or "")
    base = label_map.get(event_type, "시장 촉매")
    lead = str(card.get("title") or card.get("summary") or "").strip()
    return _shorten(f"{base}: {lead}", 120)


def _driver_reaction_ko(card: dict[str, Any], snapshot: dict[str, Any]) -> str:
    assets = card.get("affected_assets", []) or []
    asset_moves: dict[str, float | None] = snapshot.get("asset_moves", {})
    chunks: list[str] = []
    for symbol in assets[:4]:
        move = asset_moves.get(symbol)
        if move is None:
            continue
        chunks.append(f"{symbol} {_fmt_pct(move)}")
    if chunks:
        return "가격 반응: " + ", ".join(chunks)
    return "가격 반응: 관련 자산 반응은 제한적이거나 확인 데이터가 부족함"


def _driver_transmission_ko(card: dict[str, Any]) -> str:
    event_type = str(card.get("event_type") or "")
    direction = str(card.get("direction") or "neutral")
    if event_type == "macro_event":
        return "전이 경로: 금리/달러 변화가 밸류에이션에 반영되며 성장주와 방어주 간 자금 재배치 유도"
    if event_type == "geopolitical":
        return "전이 경로: 지정학 불확실성 -> 원자재/변동성 프리미엄 -> 지수 위험자산 디스카운트"
    if event_type == "earnings":
        return "전이 경로: 실적/가이던스 재평가 -> 동종업종 멀티플 조정 -> 지수 기여도 변화"
    if direction == "positive":
        return "전이 경로: 위험선호 확대로 고베타/성장주로 매수 전이"
    if direction == "negative":
        return "전이 경로: 위험회피 강화로 방어섹터 및 현금성 비중 확대"
    return "전이 경로: 방향성보다 종목/섹터별 상대강도 차별화가 주도"


def _driver_implication_ko(card: dict[str, Any], risk_level: str) -> str:
    direction = str(card.get("direction") or "neutral")
    if risk_level in {"High Risk", "Crisis"}:
        return "투자 시사점: 리스크 예산 축소와 손절 기준 명확화가 우선"
    if direction == "positive":
        return "투자 시사점: 추격매수보다는 눌림 구간 분할 접근, 강한 섹터 중심 선별 대응"
    if direction == "negative":
        return "투자 시사점: 고베타 익스포저 점검과 방어주/현금 비중 상향 검토"
    return "투자 시사점: 이벤트 확인 전까지 중립 포지션 유지, 확증 신호 대기"


def _build_market_verdict(snapshot: dict[str, Any], driver_plan: dict[str, Any]) -> dict[str, Any]:
    regime = str(snapshot.get("regime") or "mixed")
    confidence = str(snapshot.get("confidence") or "medium")
    primary = driver_plan.get("primary_driver", {}) or {}
    secondary = (driver_plan.get("secondary_drivers", []) or [{}])[0] or {}
    primary_reason = str(primary.get("title_ko") or primary.get("title") or primary.get("summary") or "핵심 촉매 부재")
    secondary_reason = str(secondary.get("title_ko") or secondary.get("title") or "").strip()

    def move(symbol: str) -> str:
        value = _move_for_asset(snapshot, symbol)
        return _fmt_pct(value) if value is not None else "N/A"

    price_context = f"SPY {move('SPY')}, QQQ {move('QQQ')}, IWM {move('IWM')}, WTI {move('WTI')}, US10Y {move('US10Y')}"

    summary_map_ko = {
        "risk_on": f"{price_context} 기준으로 {primary_reason}이 위험선호를 주도",
        "risk_off": f"{price_context} 기준으로 {primary_reason}이 위험회피를 주도",
        "rotation": f"{price_context} 속 {primary_reason} 중심의 섹터 로테이션 장세",
        "mixed": f"{price_context} 기준으로 {primary_reason}이 장중 방향성을 좌우",
        "crisis": f"{price_context} 기준으로 {primary_reason}과 리스크 오버레이가 방어 우위를 강화",
    }
    summary_map_en = {
        "risk_on": f"Risk-on tape led by {primary.get('title') or primary_reason}; price tape: {price_context}.",
        "risk_off": f"Risk-off tape led by {primary.get('title') or primary_reason}; price tape: {price_context}.",
        "rotation": f"Rotation tape led by {primary.get('title') or primary_reason}; price tape: {price_context}.",
        "mixed": f"Mixed tape led by {primary.get('title') or primary_reason}; price tape: {price_context}.",
        "crisis": f"Defensive crisis tape led by {primary.get('title') or primary_reason}; price tape: {price_context}.",
    }
    if secondary_reason:
        primary_reason = f"{primary_reason} / 보조 동인: {secondary_reason}"

    return {
        "regime": regime,
        "summary_ko": summary_map_ko.get(regime, summary_map_ko["mixed"]),
        "summary": summary_map_en.get(regime, summary_map_en["mixed"]),
        "confidence": confidence,
        "primary_reason": primary_reason,
        "primary_reason_ko": _shorten(f"주요 원인: {primary_reason}", 140),
    }


def _build_price_tape(snapshot: dict[str, Any]) -> dict[str, Any]:
    def value_block(block: dict[str, Any]) -> dict[str, str]:
        output: dict[str, str] = {}
        for symbol, row in block.items():
            if not isinstance(row, dict):
                continue
            output[symbol] = row.get("change_str") or "N/A"
        return output

    major_symbols = [str(row.get("symbol") or "") for row in (snapshot.get("major_movers", []) or [])]
    return {
        "indices": value_block(snapshot.get("indices", {})),
        "rates_fx_vol": value_block(snapshot.get("rates_fx_vol", {})),
        "commodities": value_block(snapshot.get("commodities", {})),
        "sector_leaders": snapshot.get("sector_leaders", []),
        "sector_laggards": snapshot.get("sector_laggards", []),
        "major_movers": major_symbols,
    }


def _build_top_drivers(snapshot: dict[str, Any], driver_plan: dict[str, Any], risk_overlay: dict[str, Any]) -> list[dict[str, Any]]:
    top_cards = driver_plan.get("top_drivers", []) or []
    output: list[dict[str, Any]] = []
    for index, card in enumerate(top_cards, start=1):
        is_cluster = bool(card.get("cluster_id"))
        title_ko = str(card.get("title_ko") or "") if is_cluster else _driver_title_ko(card)
        reaction_ko = str(card.get("market_reaction_ko") or "") if is_cluster else _driver_reaction_ko(card, snapshot)
        transmission_ko = str(card.get("transmission_ko") or "") if is_cluster else _driver_transmission_ko(card)
        if is_cluster:
            implication_ko = _cluster_implication_ko(
                str(card.get("cluster_id") or ""),
                str(card.get("direction") or "neutral"),
                str(risk_overlay.get("risk_level") or "Normal"),
            )
        else:
            implication_ko = _driver_implication_ko(card, str(risk_overlay.get("risk_level") or "Normal"))
        score = float(card.get("driver_score", card.get("market_impact_score", 0)) or 0)
        confidence = str(card.get("confidence") or _confidence_label(score))
        output.append(
            {
                "rank": index,
                "title_ko": title_ko,
                "title": _shorten(str(card.get("title") or card.get("summary") or ""), 120),
                "event_type": card.get("event_type"),
                "direction": card.get("direction"),
                "affected_assets": card.get("affected_assets", []),
                "market_reaction_ko": reaction_ko,
                "market_reaction": reaction_ko,
                "transmission_ko": transmission_ko,
                "transmission": transmission_ko,
                "investor_implication_ko": implication_ko,
                "investor_implication": implication_ko,
                "confidence": confidence,
                "market_impact_score": round(score, 3),
                "cluster_id": card.get("cluster_id"),
                "supporting_events": card.get("supporting_events", []),
                "score_breakdown": card.get("scores", {}),
            }
        )
    return output


def _build_rotation_map(snapshot: dict[str, Any], driver_plan: dict[str, Any]) -> dict[str, Any]:
    leaders_raw = snapshot.get("sector_leaders_raw", []) or []
    laggards_raw = snapshot.get("sector_laggards_raw", []) or []

    evidence: list[str] = []
    for row in leaders_raw[:2]:
        evidence.append(f"{row.get('symbol','?')} {_fmt_pct(row.get('change_1d'))}")
    for row in laggards_raw[:2]:
        evidence.append(f"{row.get('symbol','?')} {_fmt_pct(row.get('change_1d'))}")

    clusters = driver_plan.get("driver_clusters", []) or []
    into_parts: list[str] = []
    out_parts: list[str] = []

    cluster_by_id = {str(row.get("cluster_id") or ""): row for row in clusters}
    oil = cluster_by_id.get("oil_energy_strength")
    defensive = cluster_by_id.get("defensive_real_estate_rotation")
    ai = cluster_by_id.get("ai_semi_profit_taking")
    rates = cluster_by_id.get("rates_fed_wait")

    if oil and str(oil.get("direction")) == "positive":
        into_parts.append(f"유가/에너지 강세 확인으로 Energy 유입({', '.join(oil.get('affected_assets', [])[:2])})")
    if defensive and str(defensive.get("direction")) == "positive":
        into_parts.append("지수 약세 방어 수요로 Real Estate·Consumer Defensive·Utilities 상대강도 개선")
    if ai and str(ai.get("direction")) == "negative":
        out_parts.append("NVDA/SMH/SOXL/TQQQ 약세로 AI·반도체 고베타에서 차익실현")
    if rates and str(rates.get("direction")) != "positive":
        out_parts.append("금리/Fed 대기와 달러 변수로 성장주 밸류에이션 부담 지속")

    if not into_parts:
        into_parts.append(", ".join(str(row.get("name") or row.get("symbol") or "?") for row in leaders_raw[:3]) or "뚜렷한 유입 섹터 없음")
    if not out_parts:
        out_parts.append(", ".join(str(row.get("name") or row.get("symbol") or "?") for row in laggards_raw[:3]) or "뚜렷한 이탈 섹터 없음")

    return {
        "into_ko": " / ".join(into_parts),
        "into": " / ".join(into_parts),
        "out_of_ko": " / ".join(out_parts),
        "out_of": " / ".join(out_parts),
        "key_evidence": evidence,
    }


def _build_next_session_playbook(
    data_date: str,
    econ_calendar: dict[str, Any],
    earnings_calendar: dict[str, Any],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    watchpoints: list[str] = []
    date_ref = _parse_date_key(data_date) or datetime.now(timezone.utc)
    date_plus_2 = (date_ref + timedelta(days=2)).date()

    for row in (econ_calendar.get("events", []) or [])[:24]:
        if not isinstance(row, dict):
            continue
        event_name = str(row.get("event") or "").strip()
        if not event_name:
            continue
        skip_snapshot = any(
            token in _norm(event_name)
            for token in (
                "s&p 500",
                "nasdaq 100",
                "russell 2000",
                "us 10y treasury",
                "vix",
                "dollar index",
                "gold",
                "crude",
                "bitcoin",
            )
        )
        if skip_snapshot:
            continue
        event_date = _parse_date_key(row.get("date"))
        if not event_date or event_date.date() <= date_ref.date() or event_date.date() > date_plus_2:
            continue
        watchpoints.append(f"{row.get('date','?')} {event_name}")
        if len(watchpoints) >= 4:
            break

    for row in (earnings_calendar.get("earnings", []) or [])[:40]:
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker") or "").upper().strip()
        event_date = _parse_date_key(row.get("date"))
        if not ticker or not event_date:
            continue
        if event_date.date() <= date_ref.date() or event_date.date() > date_plus_2:
            continue
        watchpoints.append(f"{event_date.date().isoformat()} {ticker} earnings")
        if len(watchpoints) >= 6:
            break

    spy_price = _safe_float(((snapshot.get("indices") or {}).get("SPY") or {}).get("price"), None)
    qqq_price = _safe_float(((snapshot.get("indices") or {}).get("QQQ") or {}).get("price"), None)
    vix_level = _safe_float(((snapshot.get("rates_fx_vol") or {}).get("VIX") or {}).get("price"), None)

    key_levels: list[str] = []
    if spy_price is not None:
        key_levels.append(f"SPY {_fmt_price(spy_price)}")
    if qqq_price is not None:
        key_levels.append(f"QQQ {_fmt_price(qqq_price)}")
    if vix_level is not None:
        key_levels.append(f"VIX {_fmt_price(vix_level, 1)}")

    regime = str(snapshot.get("regime") or "mixed")
    if not watchpoints:
        bull_case_ko = "확정된 다음 세션 캘린더가 없어 가격 테이프와 실시간 헤드라인 확인이 우선"
        bear_case_ko = "확정 이벤트 부재 속 금리·유가·고베타 가격 반응이 악화되면 방어 우위 지속"
    elif regime in {"risk_off", "crisis"}:
        bull_case_ko = "핵심 지표 서프라이즈와 변동성 완화가 동반되면 단기 숏커버 반등 가능"
        bear_case_ko = "금리/유가/지정학 리스크 재확대 시 리스크오프 연장 가능성 우세"
    elif regime == "risk_on":
        bull_case_ko = "실적/거시 지표가 우호적으로 나오면 상승 추세 연장 가능"
        bear_case_ko = "밸류에이션 부담과 금리 반등이 겹치면 이익실현 매물 출회 가능"
    else:
        bull_case_ko = "섹터 주도주가 확장되면 지수 상방 추세가 재형성될 수 있음"
        bear_case_ko = "촉매 부재 속 매크로 변수 악화 시 재차 하방 압력 확대 가능"

    return {
        "watchpoints": watchpoints,
        "bull_case_ko": bull_case_ko,
        "bull_case": bull_case_ko,
        "bear_case_ko": bear_case_ko,
        "bear_case": bear_case_ko,
        "key_levels": key_levels or ["핵심 레벨 산출 데이터 부족"],
    }


def _build_risk_overlay(risk_v1: dict, risk_engine: dict, snapshot: dict[str, Any]) -> dict[str, Any]:
    current = risk_v1.get("current", {}) or {}
    level = int(_safe_float(current.get("level"), 0) or 0)
    mss_score = _safe_float(current.get("score"), 100.0) or 100.0
    zone = str(current.get("score_zone") or "")
    vol_pct = _safe_float(current.get("vol_pct"), None)
    shock = _safe_float((risk_engine.get("shock_probability", {}) or {}).get("value"), None)
    trigger_active = bool((risk_engine.get("defensive_trigger", {}) or {}).get("active"))

    level_map = {
        0: "Normal",
        1: "Caution",
        2: "Warning",
        3: "High Risk",
        4: "Crisis",
    }
    risk_level = level_map.get(level, "Warning")

    message_parts = [f"MSS {mss_score:.1f} ({zone})", f"Level {level}:{risk_level}"]
    if vol_pct is not None:
        message_parts.append(f"VIX percentile {vol_pct:.1f}th")
    if shock is not None:
        message_parts.append(f"shock probability {shock:.0f}%")
    if trigger_active:
        message_parts.append("defensive trigger ON")
    message_ko = " / ".join(message_parts)

    signal = "bear" if level >= 3 else "caution" if level >= 2 else "neutral"
    return {
        "risk_level": risk_level,
        "mss_score": round(mss_score, 2),
        "mss_level": level,
        "mss_zone": zone,
        "vol_percentile": vol_pct,
        "shock_probability": shock,
        "defensive_trigger": trigger_active,
        "message_ko": message_ko,
        "message": message_ko,
        "signal": signal,
        "color": SIGNAL_COLOR.get(signal, "#64748b"),
    }


def _build_topic_review(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    topics = [
        ("Trump", ("trump", "tariff", "trade policy")),
        ("Iran", ("iran", "hormuz", "middle east")),
        ("TSLA", ("tesla", "tsla", "deliveries", "musk")),
    ]
    reviews: list[dict[str, Any]] = []

    for name, keywords in topics:
        matched_scores: list[float] = []
        for card in cards:
            text = f"{card.get('title','')} {card.get('summary','')}"
            if _topic_hit(text, keywords):
                matched_scores.append(float(card.get("market_impact_score", 0) or 0))
        max_score = max(matched_scores) if matched_scores else 0.0
        include = max_score >= MANDATORY_IMPACT_THRESHOLD
        status = "included" if include else "not_market_moving_today"
        message_ko = (
            f"{name} 관련 이슈는 시장 영향 점수 {max_score:.2f}로 브리핑에 반영"
            if include
            else f"{name} 관련 이슈는 영향 점수 {max_score:.2f}로 관찰 대상이지만 핵심 드라이버 아님"
        )
        reviews.append(
            {
                "topic": name,
                "max_impact_score": round(max_score, 3),
                "status": status,
                "message_ko": message_ko,
                "message": message_ko,
            }
        )
    return reviews


def _build_optional_modules(
    snapshot: dict[str, Any],
    top_drivers: list[dict[str, Any]],
    risk_overlay: dict[str, Any],
) -> tuple[list[str], dict[str, str]]:
    modules: list[str] = []
    details: dict[str, str] = {}

    asset_moves: dict[str, float | None] = snapshot.get("asset_moves", {})

    big_single = None
    for symbol in ("TSLA", "NVDA", "AAPL", "MSFT", "AMZN", "META"):
        move = asset_moves.get(symbol)
        if move is not None and abs(move) >= 4.0:
            big_single = symbol
            break
    if big_single:
        name = f"Single Stock Focus ({big_single})"
        modules.append(name)
        details[name] = f"{big_single} 변동성이 시장 베타를 압도해 단일종목 심층 해석 필요"

    macro_driver = any(
        driver.get("event_type") in {"macro_event", "geopolitical"}
        or str(driver.get("cluster_id") or "") == "rates_fed_wait"
        for driver in top_drivers
    )
    us10y_move = _safe_float(((snapshot.get("rates_fx_vol") or {}).get("US10Y") or {}).get("change_pct"), 0.0) or 0.0
    dxy_move = _safe_float(((snapshot.get("rates_fx_vol") or {}).get("DXY") or {}).get("change_pct"), 0.0) or 0.0
    if macro_driver or abs(us10y_move) >= 0.25 or abs(dxy_move) >= 0.35:
        modules.append("Rates/Macro Pulse")
        details["Rates/Macro Pulse"] = "금리/달러 움직임이 섹터 밸류에이션에 미치는 압력 점검 필요"

    wti_move = _safe_float(((snapshot.get("commodities") or {}).get("WTI") or {}).get("change_pct"), 0.0) or 0.0
    if any(
        driver.get("event_type") == "geopolitical"
        or str(driver.get("cluster_id") or "") == "oil_energy_strength"
        for driver in top_drivers
    ) or abs(wti_move) >= 2.0:
        modules.append("Oil/Geopolitical Risk")
        details["Oil/Geopolitical Risk"] = "유가와 지정학 이슈가 리스크 프리미엄을 재조정하는 구간"

    semi_flag = False
    for driver in top_drivers:
        text = f"{driver.get('title','')} {driver.get('summary','')}"
        if _topic_hit(text, SEMI_KW):
            semi_flag = True
            break
    soxl_move = asset_moves.get("SOXL")
    smh_move = asset_moves.get("SMH")
    if semi_flag or (soxl_move is not None and abs(soxl_move) >= 2.0) or (smh_move is not None and abs(smh_move) >= 1.5):
        modules.append("AI/Semiconductor Watch")
        details["AI/Semiconductor Watch"] = "AI/반도체 베타가 지수 변동성에 미치는 영향 추적"
        modules.append("Korea Market Implication")
        details["Korea Market Implication"] = "반도체/환율 연동을 기준으로 한국 대형주 영향도 점검"

    if str(risk_overlay.get("risk_level") or "") in {"High Risk", "Crisis"}:
        modules.append("Crisis Mode")
        details["Crisis Mode"] = "고위험 구간으로 포지션 축소와 변동성 방어 시나리오 우선"

    unique_modules = []
    for module in modules:
        if module not in unique_modules:
            unique_modules.append(module)
    return unique_modules, details


def _build_hook_and_one_line(
    market_verdict: dict[str, Any],
    top_drivers: list[dict[str, Any]],
    risk_overlay: dict[str, Any],
    slot: str,
) -> tuple[str, str, str, str]:
    regime = str(market_verdict.get("regime") or "mixed")
    regime_ko = REGIME_META.get(regime, {}).get("ko", "혼조")
    primary = top_drivers[0] if top_drivers else {}
    driver_title_ko = str(primary.get("title_ko") or "핵심 촉매 부재")
    risk_level = str(risk_overlay.get("risk_level") or "Normal")

    hook_ko = f"[{_slot_label_ko(slot)}] {regime_ko} 장세 - {driver_title_ko}"
    one_line_ko = (
        f"{market_verdict.get('summary_ko','')} / 핵심 동인: {driver_title_ko} / "
        f"리스크 레벨: {risk_level}"
    )

    hook = f"[{slot}] {regime} regime - {str(primary.get('title') or 'No dominant catalyst')}"
    one_line = (
        f"{market_verdict.get('summary','')} "
        f"Primary driver: {str(primary.get('title') or 'none')}. Risk level: {risk_level}."
    )
    return hook_ko, one_line_ko, hook, one_line


# ---------------------------------------------------------------------------
# LLM refinement (optional)
# ---------------------------------------------------------------------------
LLM_SYSTEM_PROMPT = """\
You are rewriting a market daily briefing in Korean for advanced retail investors.

Rules:
1) Market-first: start from observed price reaction, then explain causes.
2) No filler, no vague "smart money" claims without evidence.
3) Do not repeat same information across sections.
4) Every claim must map to evidence from price tape or event cards.
5) Maintain concise institutional tone.

Return JSON only (no markdown) using this schema:
{
  "hook_ko": "...",
  "one_line_ko": "...",
  "market_verdict": {
    "summary_ko": "...",
    "primary_reason": "...",
    "confidence": "low|medium|high"
  },
  "top_drivers": [
    {
      "rank": 1,
      "title_ko": "...",
      "market_reaction_ko": "...",
      "transmission_ko": "...",
      "investor_implication_ko": "...",
      "confidence": "low|medium|high"
    }
  ],
  "rotation_map": {
    "into_ko": "...",
    "out_of_ko": "..."
  },
  "next_session_playbook": {
    "watchpoints": ["..."],
    "bull_case_ko": "...",
    "bear_case_ko": "...",
    "key_levels": ["..."]
  },
  "risk_overlay": {
    "message_ko": "..."
  },
  "optional_modules": ["..."]
}
"""


def _strip_json_comments(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    i = 0
    while i < len(text):
        c = text[i]
        if escaped:
            result.append(c)
            escaped = False
        elif c == "\\" and in_string:
            result.append(c)
            escaped = True
        elif c == '"':
            result.append(c)
            in_string = not in_string
        elif not in_string and c == "/" and i + 1 < len(text) and text[i + 1] == "/":
            while i < len(text) and text[i] != "\n":
                i += 1
            continue
        else:
            result.append(c)
        i += 1
    return "".join(result)


def _escape_literal_newlines_in_strings(s: str) -> str:
    """Replace bare newlines inside JSON string values with \\n escape sequences."""
    result: list[str] = []
    in_string = False
    escaped = False
    for ch in s:
        if escaped:
            result.append(ch)
            escaped = False
        elif ch == '\\' and in_string:
            result.append(ch)
            escaped = True
        elif ch == '"':
            in_string = not in_string
            result.append(ch)
        elif ch == '\n' and in_string:
            result.append('\\n')
        elif ch == '\r' and in_string:
            result.append('\\r')
        else:
            result.append(ch)
    return ''.join(result)


def _parse_json_from_llm(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("Empty LLM output")

    candidates = [text]
    fenced = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text, re.IGNORECASE)
    if fenced:
        candidates.append(fenced.group(1).strip())
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last > first:
        candidates.append(text[first:last + 1].strip())

    # Also try with JS-style // comments stripped
    stripped = _strip_json_comments(text)
    if stripped != text:
        candidates.append(stripped)
        s_first = stripped.find("{")
        s_last = stripped.rfind("}")
        if s_first != -1 and s_last > s_first:
            candidates.append(stripped[s_first:s_last + 1].strip())

    # Also try with literal newlines inside strings escaped
    fixed = _escape_literal_newlines_in_strings(text)
    if fixed != text:
        candidates.append(fixed)
        f_first = fixed.find("{")
        f_last = fixed.rfind("}")
        if f_first != -1 and f_last > f_first:
            candidates.append(fixed[f_first:f_last + 1].strip())

    last_error: Exception | None = None
    seen: set[str] = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
            raise ValueError("Not a JSON object")
        except Exception as exc:
            last_error = exc

    raise ValueError(f"LLM output parse failed: {last_error}")


def _call_llm_json_with_retry(
    client: Any,
    *,
    system_prompt: str,
    user_content: str,
    max_tokens: int,
    retries: int = 1,
) -> tuple[dict[str, Any], int, int]:
    in_tokens = 0
    out_tokens = 0
    for attempt in range(retries + 1):
        strict_tail = ""
        if attempt > 0:
            strict_tail = (
                "\n\nFORMAT FIX: Return only one valid JSON object. "
                "No prose. No markdown."
            )
        response = client.messages.create(
            model=MODEL_ID,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content + strict_tail}],
        )
        text = response.content[0].text.strip()
        in_tokens += int(getattr(response.usage, "input_tokens", 0) or 0)
        out_tokens += int(getattr(response.usage, "output_tokens", 0) or 0)
        try:
            return _parse_json_from_llm(text), in_tokens, out_tokens
        except Exception as exc:
            print(f"[build_daily_briefing_v4] WARN LLM parse failed ({attempt + 1}/{retries + 1}): {exc}")
            if attempt >= retries:
                raise
    raise ValueError("Unexpected retry loop exit")


def _apply_llm_patch(output: dict[str, Any], patch: dict[str, Any]) -> None:
    if not isinstance(patch, dict):
        return

    hook_ko = str(patch.get("hook_ko") or "").strip()
    one_line_ko = str(patch.get("one_line_ko") or "").strip()
    if hook_ko:
        output["hook_ko"] = hook_ko
    if one_line_ko:
        output["one_line_ko"] = one_line_ko

    verdict_patch = patch.get("market_verdict", {})
    if isinstance(verdict_patch, dict):
        if verdict_patch.get("summary_ko"):
            output["market_verdict"]["summary_ko"] = str(verdict_patch.get("summary_ko"))
        if verdict_patch.get("primary_reason"):
            output["market_verdict"]["primary_reason"] = str(verdict_patch.get("primary_reason"))
        if verdict_patch.get("confidence"):
            output["market_verdict"]["confidence"] = str(verdict_patch.get("confidence"))

    drivers_patch = patch.get("top_drivers", [])
    if isinstance(drivers_patch, list):
        for row in drivers_patch:
            if not isinstance(row, dict):
                continue
            rank = int(_safe_float(row.get("rank"), 0) or 0)
            if rank < 1 or rank > len(output.get("top_drivers", [])):
                continue
            target = output["top_drivers"][rank - 1]
            for key in ("title_ko", "market_reaction_ko", "transmission_ko", "investor_implication_ko", "confidence"):
                value = str(row.get(key) or "").strip()
                if value:
                    target[key] = value

    rotation_patch = patch.get("rotation_map", {})
    if isinstance(rotation_patch, dict):
        for key in ("into_ko", "out_of_ko"):
            value = str(rotation_patch.get(key) or "").strip()
            if value:
                output["rotation_map"][key] = value

    playbook_patch = patch.get("next_session_playbook", {})
    if isinstance(playbook_patch, dict):
        for key in ("bull_case_ko", "bear_case_ko"):
            value = str(playbook_patch.get(key) or "").strip()
            if value:
                output["next_session_playbook"][key] = value
        watchpoints = playbook_patch.get("watchpoints")
        if isinstance(watchpoints, list) and watchpoints:
            output["next_session_playbook"]["watchpoints"] = [str(item) for item in watchpoints[:8]]
        levels = playbook_patch.get("key_levels")
        if isinstance(levels, list) and levels:
            output["next_session_playbook"]["key_levels"] = [str(item) for item in levels[:8]]

    risk_patch = patch.get("risk_overlay", {})
    if isinstance(risk_patch, dict):
        value = str(risk_patch.get("message_ko") or "").strip()
        if value:
            output["risk_overlay"]["message_ko"] = value

    modules = patch.get("optional_modules")
    if isinstance(modules, list) and modules:
        merged = list(output.get("optional_modules", []))
        for module in modules:
            label = str(module).strip()
            if label and label not in merged:
                merged.append(label)
        output["optional_modules"] = merged[:8]


# ---------------------------------------------------------------------------
# Optional DeepL fill for missing EN fields
# ---------------------------------------------------------------------------
def _deepl_translate_batch(texts: list[str], api_key: str) -> list[str]:
    if not api_key or not texts:
        return texts
    try:
        payload = json.dumps({"text": texts, "source_lang": "KO", "target_lang": "EN"}).encode("utf-8")
        request = urllib.request.Request(
            "https://api-free.deepl.com/v2/translate",
            data=payload,
            headers={
                "Authorization": f"DeepL-Auth-Key {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
        translated = [item.get("text", "") for item in (data.get("translations", []) or [])]
        if len(translated) == len(texts):
            return translated
    except Exception as exc:
        print(f"[build_daily_briefing_v4] WARN DeepL translation failed: {exc}")
    return texts


def fill_english_fields(output: dict[str, Any], deepl_key: str) -> dict[str, Any]:
    targets: list[tuple[dict[str, Any], str, str]] = []
    targets.append((output, "hook", "hook_ko"))
    targets.append((output, "one_line", "one_line_ko"))
    targets.append((output.get("market_verdict", {}), "summary", "summary_ko"))
    targets.append((output.get("market_verdict", {}), "primary_reason", "primary_reason_ko"))
    targets.append((output.get("rotation_map", {}), "into", "into_ko"))
    targets.append((output.get("rotation_map", {}), "out_of", "out_of_ko"))
    targets.append((output.get("next_session_playbook", {}), "bull_case", "bull_case_ko"))
    targets.append((output.get("next_session_playbook", {}), "bear_case", "bear_case_ko"))
    targets.append((output.get("risk_overlay", {}), "message", "message_ko"))

    for row in output.get("top_drivers", []) or []:
        if not isinstance(row, dict):
            continue
        targets.append((row, "title", "title_ko"))
        targets.append((row, "market_reaction", "market_reaction_ko"))
        targets.append((row, "transmission", "transmission_ko"))
        targets.append((row, "investor_implication", "investor_implication_ko"))

    ko_texts: list[str] = []
    index_map: list[tuple[dict[str, Any], str]] = []
    for container, en_key, ko_key in targets:
        if not isinstance(container, dict):
            continue
        current_en = str(container.get(en_key) or "").strip()
        ko_text = str(container.get(ko_key) or "").strip()
        if current_en or not ko_text:
            continue
        ko_texts.append(ko_text)
        index_map.append((container, en_key))

    if not ko_texts:
        return output

    translated = _deepl_translate_batch(ko_texts, deepl_key) if deepl_key else ko_texts
    for (container, en_key), translated_text in zip(index_map, translated):
        container[en_key] = translated_text
    return output


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    os.environ["PYTHONUTF8"] = "1"
    os.environ["PYTHONIOENCODING"] = "utf-8"

    force = "--force" in sys.argv
    lang = "ko"
    slot = _current_slot()
    args = sys.argv[1:]
    idx = 0
    while idx < len(args):
        arg = args[idx]
        if arg.startswith("--lang="):
            lang = arg.split("=", 1)[1].strip().lower()
        elif arg == "--lang" and idx + 1 < len(args):
            lang = args[idx + 1].strip().lower()
            idx += 1
        elif arg.startswith("--slot="):
            slot = arg.split("=", 1)[1].strip().lower() or _current_slot()
        elif arg == "--slot" and idx + 1 < len(args):
            slot = args[idx + 1].strip().lower() or _current_slot()
            idx += 1
        idx += 1

    if not force and not is_stale(slot=slot):
        print("[build_daily_briefing_v4] output is fresh, skipping (use --force to override)")
        return

    refreshed_news = _refresh_context_news(slot)
    (
        market_state,
        overview,
        risk_v1,
        risk_engine,
        sector_perf,
        econ_calendar,
        earnings_calendar,
        movers_snapshot,
        context_news,
        headline_cache,
        core_price_snapshot,
        action_snapshot,
    ) = _load_inputs()
    if refreshed_news:
        context_news = refreshed_news

    data_date = (
        str(market_state.get("data_date") or "").strip()
        or str((risk_v1.get("current", {}) or {}).get("date") or "").strip()
        or str(context_news.get("date") or "").strip()
        or datetime.now(timezone.utc).astimezone(ET_ZONE).strftime("%Y-%m-%d")
    )[:10]

    freshness = build_freshness_meta(data_date, overview.get("latest_date"), market_state.get("generated_at"))

    snapshot = build_market_reaction_snapshot(
        market_state=market_state,
        risk_v1=risk_v1,
        risk_engine=risk_engine,
        sector_perf=sector_perf,
        econ_calendar=econ_calendar,
        core_price_snapshot=core_price_snapshot,
        movers_snapshot=movers_snapshot,
        action_snapshot=action_snapshot,
    )
    event_cards = build_event_cards(
        data_date=data_date,
        headline_rows=headline_cache,
        context_news=context_news,
        earnings_calendar=earnings_calendar,
        econ_calendar=econ_calendar,
        movers_snapshot=movers_snapshot,
        action_snapshot=action_snapshot,
        snapshot=snapshot,
    )
    driver_plan = build_driver_plan(event_cards, snapshot)
    risk_overlay = _build_risk_overlay(risk_v1, risk_engine, snapshot)
    market_verdict = _build_market_verdict(snapshot, driver_plan)
    price_tape = _build_price_tape(snapshot)
    top_drivers = _build_top_drivers(snapshot, driver_plan, risk_overlay)
    rotation_map = _build_rotation_map(snapshot, driver_plan)
    next_session_playbook = _build_next_session_playbook(data_date, econ_calendar, earnings_calendar, snapshot)
    topic_review = _build_topic_review(event_cards)
    optional_modules, optional_details = _build_optional_modules(snapshot, top_drivers, risk_overlay)
    hook_ko, one_line_ko, hook, one_line = _build_hook_and_one_line(market_verdict, top_drivers, risk_overlay, slot)

    output: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_date": data_date,
        "slot": slot,
        "model": "rules",
        "lang": lang,
        "release": RELEASE_VERSION,
        "tokens": {"input": 0, "output": 0, "cost_usd": 0.0},
        "freshness": freshness,
        "prompt": {
            "page": "briefing_v4",
            "version": RELEASE_VERSION,
            "source": "rule_based_fallback",
            "fallback_used": True,
        },
        "hook": hook,
        "hook_ko": hook_ko,
        "one_line": one_line,
        "one_line_ko": one_line_ko,
        "market_verdict": market_verdict,
        "price_tape": price_tape,
        "top_drivers": top_drivers,
        "rotation_map": rotation_map,
        "next_session_playbook": next_session_playbook,
        "risk_overlay": risk_overlay,
        "optional_modules": optional_modules,
        "optional_details": optional_details,
        "topic_review": topic_review,
        "event_cards": event_cards[:12],
        "driver_clusters": driver_plan.get("driver_clusters", [])[:8],
        "driver_plan": {
            "primary_driver": driver_plan.get("primary_driver", {}),
            "secondary_drivers": driver_plan.get("secondary_drivers", []),
            "counter_force": driver_plan.get("counter_force", {}),
            "watchpoints": driver_plan.get("watchpoints", []),
        },
    }

    api_key = _load_api_key()
    if api_key:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            evidence_payload = {
                "data_date": data_date,
                "slot": slot,
                "snapshot": snapshot,
                "top_event_cards": event_cards[:10],
                "driver_plan": driver_plan,
                "driver_clusters": driver_plan.get("driver_clusters", [])[:8],
                "draft_output": {
                    "market_verdict": market_verdict,
                    "price_tape": price_tape,
                    "top_drivers": top_drivers,
                    "rotation_map": rotation_map,
                    "next_session_playbook": next_session_playbook,
                    "risk_overlay": risk_overlay,
                    "optional_modules": optional_modules,
                    "topic_review": topic_review,
                },
                "hard_constraints": [
                    "price reaction first",
                    "top drivers must use driver clusters, not raw event cards",
                    "no filler prose",
                    "no repeated claims",
                    "every claim evidence-linked",
                ],
            }
            user_msg = json.dumps(evidence_payload, ensure_ascii=False)
            parsed, in_tok, out_tok = _call_llm_json_with_retry(
                client,
                system_prompt=LLM_SYSTEM_PROMPT,
                user_content=user_msg,
                max_tokens=4096,
                retries=1,
            )
            _apply_llm_patch(output, parsed)
            cost = (in_tok * PRICE_IN) + (out_tok * PRICE_OUT)
            output["tokens"] = {
                "input": in_tok,
                "output": out_tok,
                "cost_usd": round(cost, 6),
            }
            output["model"] = MODEL_ID
            output["prompt"] = {
                "page": "briefing_v4",
                "version": RELEASE_VERSION,
                "source": "llm_refine",
                "fallback_used": False,
            }
            print(f"[build_daily_briefing_v4] llm refine tokens in={in_tok} out={out_tok} cost=${cost:.5f}")
        except Exception as exc:
            print(f"[build_daily_briefing_v4] WARN LLM refinement failed; keeping rule output: {exc}")
    else:
        print("[build_daily_briefing_v4] ANTHROPIC_API_KEY not found; using rule-based output")

    deepl_key = (os.environ.get("DEEPL_API_KEY") or "").strip()
    output = fill_english_fields(output, deepl_key)

    if lang == "en":
        # English request prefers EN lead fields but retains KO mirrors.
        output["lang"] = "en"
    else:
        output["lang"] = "ko"

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)

    print(f"[build_daily_briefing_v4] saved -> {OUT_PATH} lang={lang} slot={slot}")
    print(
        "[build_daily_briefing_v4] regime="
        f"{output.get('market_verdict', {}).get('regime')} "
        f"risk={output.get('risk_overlay', {}).get('risk_level')} "
        f"drivers={len(output.get('top_drivers', []))}"
    )
    if freshness.get("warning"):
        print(f"[build_daily_briefing_v4] freshness warning: {freshness['warning']}")


if __name__ == "__main__":
    main()
