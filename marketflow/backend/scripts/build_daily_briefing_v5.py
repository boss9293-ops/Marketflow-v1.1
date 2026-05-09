"""
build_daily_briefing_v5.py
Daily Briefing V5 Narrative-first engine.

Design:
- Code decides price facts, event-price matching, clusters, ranking, risk.
- Claude Sonnet edits only the locked briefing_packet into Korean narrative.
- Validator prevents number/rank/evidence drift and falls back to rules when needed.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
CACHE_DIR = BACKEND_DIR / "output" / "cache"
MARKETFLOW_ROOT = Path(__file__).resolve().parents[2]
for _path in (str(BACKEND_DIR), str(SCRIPT_DIR), str(MARKETFLOW_ROOT)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

try:
    from news.news_paths import MARKET_HEADLINES_HISTORY_PATH
except Exception:
    MARKET_HEADLINES_HISTORY_PATH = CACHE_DIR / "market-headlines-history.json"

from build_daily_briefing_v4 import (  # type: ignore
    ET_ZONE,
    MODEL_ID,
    PRICE_IN,
    PRICE_OUT,
    SECTOR_NAME_TO_ETF,
    _asset_bucket,
    _call_llm_json_with_retry,
    _classify_event_type,
    _clamp,
    _confidence_label,
    _current_slot,
    _event_directness_score,
    _event_direction,
    _event_source_score,
    _extract_symbols,
    _filter_movers,
    _fmt_pct,
    _load_api_key,
    _load_inputs,
    _norm,
    _parse_date_key,
    _price_evidence_for_assets,
    _refresh_context_news,
    _safe_float,
    _shorten,
    build_freshness_meta,
    build_market_reaction_snapshot as build_v4_market_reaction_snapshot,
)


OUT_PATH = CACHE_DIR / "daily_briefing_v5.json"
VERSION = "v5"

THEME_ASSET_MAP: dict[str, list[str]] = {
    "gold": ["GOLD", "DXY", "US10Y"],
    "oil": ["WTI", "XLE"],
    "wti": ["WTI", "XLE"],
    "iran": ["WTI", "GOLD", "DXY", "XLE"],
    "middle east": ["WTI", "GOLD", "DXY", "XLE"],
    "fed": ["US10Y", "DXY", "QQQ", "SPY", "IWM"],
    "powell": ["US10Y", "DXY", "QQQ", "SPY", "IWM"],
    "rates": ["US10Y", "DXY", "QQQ", "SPY"],
    "yield": ["US10Y", "DXY", "QQQ", "SPY"],
    "tesla": ["TSLA", "QQQ", "XLY"],
    "tsla": ["TSLA", "QQQ", "XLY"],
    "nvidia": ["NVDA", "SMH", "SOXL", "QQQ"],
    "nvda": ["NVDA", "SMH", "SOXL", "QQQ"],
    "semiconductor": ["NVDA", "SMH", "SOXL", "QQQ"],
    "chip": ["NVDA", "SMH", "SOXL", "QQQ"],
    "ai": ["NVDA", "SMH", "SOXL", "TQQQ", "QQQ"],
    "big tech": ["QQQ", "XLK", "MSFT", "GOOGL", "META", "AMZN"],
    "small cap": ["IWM"],
    "defensive": ["XLP", "XLU", "XLRE"],
    "real estate": ["XLRE"],
    "utilities": ["XLU"],
    "consumer defensive": ["XLP"],
}

CLUSTER_DEFS: list[dict[str, Any]] = [
    {
        "cluster_id": "cluster_ai_semis",
        "name_ko": "AI/반도체 고베타 차익실현",
        "theme": "growth_deleveraging",
        "assets": ["NVDA", "SMH", "SOXL", "TQQQ", "QQQ"],
        "keywords": ["nvidia", "nvda", "semiconductor", "chip", "ai", "smh", "soxl", "tqqq"],
    },
    {
        "cluster_id": "cluster_oil_energy",
        "name_ko": "유가 급등과 에너지 강세",
        "theme": "oil_energy",
        "assets": ["WTI", "XLE"],
        "keywords": ["oil", "wti", "crude", "energy", "xle", "iran", "middle east"],
    },
    {
        "cluster_id": "cluster_defensive_real_estate",
        "name_ko": "방어주·부동산 로테이션",
        "theme": "defensive_rotation",
        "assets": ["XLRE", "XLP", "XLU"],
        "keywords": ["defensive", "real estate", "utilities", "consumer defensive", "xlp", "xlu", "xlre"],
    },
    {
        "cluster_id": "cluster_rates_fed",
        "name_ko": "금리/Fed 대기",
        "theme": "rates_pressure",
        "assets": ["US10Y", "DXY", "QQQ", "SPY", "IWM"],
        "keywords": ["fed", "powell", "rates", "yield", "treasury", "dxy", "dollar", "cpi", "inflation"],
    },
    {
        "cluster_id": "cluster_tsla_momentum",
        "name_ko": "테슬라/모멘텀주 약화",
        "theme": "single_stock_momentum",
        "assets": ["TSLA", "QQQ", "XLY"],
        "keywords": ["tesla", "tsla", "musk"],
    },
    {
        "cluster_id": "cluster_big_tech_earnings",
        "name_ko": "빅테크 실적 대기",
        "theme": "earnings_watch",
        "assets": ["QQQ", "XLK", "MSFT", "GOOGL", "META", "AMZN"],
        "keywords": ["earnings", "meta", "googl", "google", "msft", "microsoft", "amzn", "amazon", "big tech"],
    },
    {
        "cluster_id": "cluster_small_caps",
        "name_ko": "소형주 약세",
        "theme": "small_cap_weakness",
        "assets": ["IWM"],
        "keywords": ["small cap", "iwm", "russell"],
    },
    {
        "cluster_id": "cluster_geopolitical_commodities",
        "name_ko": "지정학/원자재 리스크",
        "theme": "geopolitical_commodities",
        "assets": ["WTI", "GOLD", "DXY", "XLE"],
        "keywords": ["iran", "middle east", "hormuz", "war", "strike", "geopolitical", "gold", "oil"],
    },
]

BANNED_PHRASES = ["무조건", "확실히 상승", "반드시 상승", "스마트머니가 확신", "100%", "보장"]

CLAUDE_SYSTEM_PROMPT = """너는 MarketFlow 리서치 터미널의 데일리 마켓 내러티브 편집자다.

## 핵심 임무

오늘 시장에서 가장 중요한 하나의 질문을 찾아 이야기로 전달하라.
지수 등락률을 나열하는 것이 아니라, 오늘 장의 '핵심 질문'과 그 답을 향한 인과적 이야기를 써라.

## Commentary Type 분류

아래 9가지 중 오늘 장에 가장 맞는 하나를 선택해 commentary_type 필드에 넣어라:
- MOMENTUM_STRETCH: 섹터/종목 5일 이상 연속 강세, 모멘텀 과열 여부 판단
- PULLBACK_WATCH: 강한 상승 이후 조정, 되돌림인지 추세 전환인지
- BREADTH_CHECK: 지수는 올랐지만 내부 breadth와 불일치
- LEADERSHIP_ROTATION: 기존 주도주 약화, 새로운 주도 버킷 부상
- MACRO_PRESSURE: 금리/VIX/달러/유가가 주식 내러티브에 의미있는 압력
- THESIS_CONFIRMATION: AI 인프라/반도체 사이클 thesis를 확인하는 데이터
- CONTRADICTION_ALERT: 지수와 내부 신호가 반대 방향
- EVENT_SETUP: 알려진 이벤트(실적/FOMC/ASML) 앞의 포지셔닝
- RISK_RELIEF: 기존 리스크 요인 해소에 따른 반등

## 핵심 질문(Core Question) 규칙

core_question 필드는 반드시 오늘 장의 핵심 질문을 한 문장으로 담아야 한다.

좋은 예:
- “반도체 랠리는 확산인가, 과열인가?”
- “AI 인프라 수요 thesis가 여전히 살아있는가, 밸류에이션 부담이 시작되는가?”
- “오늘의 강세는 진짜 위험선호인가, 좁은 주도주 장세인가?”

나쁜 예 (절대 금지):
- “오늘 S&P500은 0.5% 상승했다”로 시작하는 모든 형태
- “NVDA가 올랐습니다” 같은 종목/지수 나열

## 지수 나열 금지

절대 금지: “S&P500 +0.4%, 나스닥 +0.7%, 다우 -0.1%” 같은 지수 연속 나열.
human_commentary와 market_scene_ko는 지수 등락률 나열로 시작해서는 안 된다.
대신 오늘 장을 이끈 드라이버와 핵심 질문으로 시작하라.

## 내러티브 구조

human_commentary는 다음 구조로 2-3 문단을 써라:
Observation → 핵심 질문 → 해석 → 리스크/긴장 → 체크포인트

## 너는 편집자다

Top Driver 순위, 가격 수치, 리스크 수치, 다음 세션 이벤트를 임의로 바꾸지 마라.
제공된 briefing_packet 안의 사실만 사용하라.

반드시 다음 원칙을 따른다:

1. 가격 반응에서 출발하라.
2. 드라이버를 나열하지 말고 하나의 이야기로 연결하라.
3. “무엇이 올랐다/내렸다”보다 “왜 동시에 그런 움직임이 나왔는지”를 설명하라.
4. 오늘 장의 성격이 패닉인지, 로테이션인지, 차익실현인지 구분하라.
5. 투자자가 오해하기 쉬운 false_read를 반드시 포함하라.
6. 다음 장에서 이 내러티브가 맞는지 검증할 가격 증거를 제시하라.
7. 같은 내용을 반복하지 마라.
8. 문장은 한국 개인 투자자가 바로 이해할 수 있게 쓰되, 과장하거나 단정하지 마라.
9. 매수/매도 추천이 아니라 포지션 관점으로 말하라.
10. 모든 섹션을 같은 길이로 채우려 하지 마라.

## MarketFlow 문체

아래 표현을 자연스럽게 활용하라:
- “지금 중요한 것은 상승률이 아니라, 상승의 질이다.”
- “랠리는 계속될 수 있지만, 구조는 더 취약해지고 있다.”
- “표면은 강하지만, 내부 확인은 아직 부족하다.”
- “확인 신호는 [HBM / 장비주 / 자본지출 코멘트]에서 나와야 한다.”
- “thesis를 강화한다 / thesis를 약화시킨다 / 확인이 필요하다”

## 금지 표현

- 매수/매도/목표가/추천
- “무조건”, “확실히 상승”, “반드시 상승”, “스마트머니가 확신”, “100%”, “보장”
- 제공되지 않은 뉴스 추가
- 가격 수치 변경
- Top Driver 순위 변경
- 리스크 수치 변경
- 없는 자산 추가
- 장기 전망으로 흐르는 것
- 데이터와 무관한 거시 일반론
- 카드 내용을 그대로 반복하는 것

출력은 반드시 JSON만 반환하라.
마크다운 설명, 코드블록, 추가 해설을 붙이지 마라.
human_commentary는 반드시 문자열 배열이어야 한다. 단일 문자열로 반환하지 마라."""


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_datetime_any(value: Any, data_date: str = "") -> datetime | None:
    text = str(value or "").strip()
    if not text:
        text = data_date
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ET_ZONE)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").replace(hour=16, tzinfo=ET_ZONE).astimezone(timezone.utc)
    except Exception:
        return None


def _freshness_multiplier(age_minutes: float | None) -> float:
    if age_minutes is None:
        return 0.50
    if age_minutes <= 60:
        return 1.0
    if age_minutes <= 180:
        return 0.75
    if age_minutes <= 360:
        return 0.50
    return 0.25


def _move_num(snapshot: dict[str, Any], symbol: str) -> float | None:
    return _safe_float((snapshot.get("_asset_moves") or {}).get(str(symbol).upper()), None)


def _move_str(snapshot: dict[str, Any], symbol: str) -> str:
    return _fmt_pct(_move_num(snapshot, symbol))


def _evidence_for_assets(snapshot: dict[str, Any], assets: list[str]) -> list[str]:
    rows: list[str] = []
    seen: set[str] = set()
    for raw in assets:
        symbol = str(raw or "").upper().strip()
        if not symbol or symbol in seen:
            continue
        move = _move_num(snapshot, symbol)
        if move is None:
            continue
        seen.add(symbol)
        label = "Gold" if symbol == "GOLD" else symbol
        rows.append(f"{label} {_fmt_pct(move)}")
    return rows


def _price_impact_score(snapshot: dict[str, Any], assets: list[str]) -> float:
    evidence = _price_evidence_for_assets({"asset_moves": snapshot.get("_asset_moves", {})}, assets)
    if not evidence:
        return 0.05
    values = []
    for row in evidence:
        symbol = str(row.get("symbol") or "").upper()
        move = abs(_safe_float(row.get("change_pct"), 0.0) or 0.0)
        denom = 6.0 if symbol in {"SOXL", "TQQQ"} else 3.0 if symbol in {"WTI", "GOLD"} else 2.0 if symbol.startswith("XL") or symbol in {"SPY", "QQQ", "IWM", "SMH"} else 4.0
        values.append(_clamp(move / denom, 0.0, 1.0))
    return _clamp(sum(values) / len(values) + min(len(values) - 1, 3) * 0.06, 0.05, 0.99)


def _dominant_direction(snapshot: dict[str, Any], assets: list[str]) -> str:
    weighted = 0.0
    total = 0.0
    for asset in assets:
        move = _move_num(snapshot, asset)
        if move is None:
            continue
        weight = max(abs(move), 0.1)
        weighted += weight if move > 0 else -weight if move < 0 else 0
        total += weight
    if total <= 0:
        return "neutral"
    ratio = weighted / total
    if ratio > 0.25:
        return "positive"
    if ratio < -0.25:
        return "negative"
    return "neutral"


def _cross_asset_confirmation(snapshot: dict[str, Any], assets: list[str], direction: str) -> float:
    if direction == "neutral":
        direction = _dominant_direction(snapshot, assets)
    if direction == "neutral":
        return 0.45
    wanted = 1 if direction == "positive" else -1
    total = 0.0
    aligned = 0.0
    for asset in assets:
        move = _move_num(snapshot, asset)
        if move is None:
            continue
        weight = max(abs(move), 0.1)
        total += weight
        if (move > 0 and wanted > 0) or (move < 0 and wanted < 0):
            aligned += weight
    return _clamp(aligned / total if total else 0.05, 0.05, 0.99)


def _sector_transmission_score(assets: list[str], snapshot: dict[str, Any]) -> float:
    buckets = {_asset_bucket(asset) for asset in assets}
    score = 0.25 + len(buckets) * 0.12
    if any(str(asset).upper().startswith("XL") for asset in assets):
        score += 0.18
    if any(str(asset).upper() in {"SPY", "QQQ", "IWM"} for asset in assets):
        score += 0.10
    leaders = {str(row.get("symbol") or "").upper() for row in snapshot.get("_sector_leaders_raw", [])}
    laggards = {str(row.get("symbol") or "").upper() for row in snapshot.get("_sector_laggards_raw", [])}
    if any(str(asset).upper() in leaders or str(asset).upper() in laggards for asset in assets):
        score += 0.15
    return _clamp(score, 0.05, 0.99)


def is_stale(slot: str | None = None, max_minutes: int = 720) -> bool:
    if not OUT_PATH.exists():
        return True
    try:
        with OUT_PATH.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        current_date = datetime.now(timezone.utc).astimezone(ET_ZONE).strftime("%Y-%m-%d")
        if str(payload.get("data_date") or "")[:10] != current_date:
            return True
        if str(payload.get("slot") or "") and str(payload.get("slot")).lower() != str(slot or _current_slot()).lower():
            return True
        generated = datetime.fromisoformat(str(payload.get("generated_at") or "").replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - generated).total_seconds() / 60 > max_minutes
    except Exception:
        return True


def build_market_reaction_snapshot_v5(
    market_state: dict,
    risk_v1: dict,
    risk_engine: dict,
    sector_perf: dict,
    econ_calendar: dict,
    core_price_snapshot: dict,
    movers_snapshot: dict,
    action_snapshot: dict,
) -> dict[str, Any]:
    base = build_v4_market_reaction_snapshot(
        market_state=market_state,
        risk_v1=risk_v1,
        risk_engine=risk_engine,
        sector_perf=sector_perf,
        econ_calendar=econ_calendar,
        core_price_snapshot=core_price_snapshot,
        movers_snapshot=movers_snapshot,
        action_snapshot=action_snapshot,
    )
    asset_moves: dict[str, float | None] = {str(k).upper(): _safe_float(v, None) for k, v in (base.get("asset_moves") or {}).items()}
    for row in sector_perf.get("sectors", []) or []:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip() or SECTOR_NAME_TO_ETF.get(_norm(row.get("name")), "")
        if symbol:
            asset_moves[symbol] = _safe_float(row.get("change_1d"), asset_moves.get(symbol))
    for row in action_snapshot.get("watchlist_moves", []) or []:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if symbol:
            asset_moves[symbol] = _safe_float(row.get("chg_pct"), asset_moves.get(symbol))

    def fmt_map(symbols: list[str]) -> dict[str, str]:
        return {("Gold" if sym == "GOLD" else sym): _fmt_pct(asset_moves.get(sym)) for sym in symbols if asset_moves.get(sym) is not None}

    sectors = fmt_map(["XLE", "XLRE", "XLP", "XLU", "XLK", "XLI", "XLB", "XLY", "XLF", "XLV", "XLC"])
    high_beta = fmt_map(["NVDA", "SMH", "SOXL", "TQQQ", "QQQ"])
    single_names = fmt_map(["TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "AAPL"])

    spy = asset_moves.get("SPY") or 0.0
    qqq = asset_moves.get("QQQ") or 0.0
    iwm = asset_moves.get("IWM") or 0.0
    vix = asset_moves.get("VIX") or 0.0
    xle = asset_moves.get("XLE") or 0.0
    wti = asset_moves.get("WTI") or 0.0
    defensive_avg = sum(asset_moves.get(sym) or 0.0 for sym in ("XLRE", "XLP", "XLU")) / 3.0

    return {
        "as_of": base.get("snapshot_timestamp") or core_price_snapshot.get("as_of") or core_price_snapshot.get("generated_at"),
        "indices": fmt_map(["SPY", "QQQ", "IWM"]),
        "rates_fx_vol": fmt_map(["US10Y", "DXY", "VIX"]),
        "commodities": fmt_map(["WTI", "GOLD", "BTC"]),
        "sectors": sectors,
        "high_beta": high_beta,
        "single_names": single_names,
        "relative_structure": {
            "qqq_vs_spy": "QQQ underperformed SPY" if qqq < spy else "QQQ outperformed SPY",
            "iwm_vs_spy": "IWM underperformed SPY" if iwm < spy else "IWM outperformed SPY",
            "vix_behavior": "VIX did not spike" if vix < 3 else "VIX spiked",
            "rotation_hint": "Energy and defensive sectors outperformed high-beta growth"
            if (xle > 0 or defensive_avg > 0) and qqq < spy
            else "No clear sector rotation signal",
        },
        "_asset_moves": asset_moves,
        "_base": base,
        "_sector_leaders_raw": base.get("sector_leaders_raw", []),
        "_sector_laggards_raw": base.get("sector_laggards_raw", []),
        "_regime": base.get("regime"),
        "_confidence": base.get("confidence"),
        "_risk": {
            "mss_score": base.get("mss_score"),
            "mss_level": base.get("mss_level"),
            "mss_zone": base.get("mss_zone"),
            "vol_pct": base.get("vol_pct"),
            "shock_probability": base.get("shock_probability"),
        },
        "_signals": {"spy": spy, "qqq": qqq, "iwm": iwm, "vix": vix, "wti": wti, "xle": xle, "defensive_avg": defensive_avg},
    }


def _add_event(candidates: list[dict[str, Any]], title: str, summary: str, source: str, timestamp: str, hint_type: str = "", hint_direction: str = "") -> None:
    title = _shorten(title, 180)
    if not title:
        return
    event_type, _ = _classify_event_type(f"{title}. {summary}")
    if hint_type:
        event_type = hint_type
    direction = hint_direction or _event_direction(f"{title}. {summary}")
    text = f"{title}. {summary}"
    candidates.append(
        {
            "headline": title,
            "summary": _shorten(summary or title, 240),
            "source": source or "Unknown",
            "timestamp": timestamp or "",
            "event_type": event_type,
            "raw_direction": direction,
            "keywords": _derive_keywords(text),
            "mentioned_assets": _extract_symbols(text),
            "source_score": round(_event_source_score(source), 3),
            "directness_score": round(_event_directness_score(event_type, text), 3),
        }
    )


def _derive_keywords(text: str) -> list[str]:
    lower = _norm(text)
    hits = [key for key in THEME_ASSET_MAP if key in lower]
    return hits[:8]


def _load_headline_rows() -> list[dict[str, Any]]:
    try:
        with open(MARKET_HEADLINES_HISTORY_PATH, encoding="utf-8") as handle:
            payload = json.load(handle)
        return [row for row in (payload.get("headlines", []) or []) if isinstance(row, dict)]
    except Exception:
        return []


def build_event_cards_v5(
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
    for row in headline_rows[:28]:
        _add_event(
            candidates,
            str(row.get("headline") or ""),
            str(row.get("summary") or ""),
            str(row.get("source") or "Headline Tape"),
            str(row.get("publishedAtET") or row.get("dateET") or ""),
        )
    for row in (context_news.get("articles", []) or [])[:12]:
        if isinstance(row, dict):
            _add_event(
                candidates,
                str(row.get("title") or row.get("headline") or ""),
                str(row.get("summary") or ""),
                str(row.get("publisher") or row.get("source") or "Context News"),
                str(row.get("published_at") or row.get("date") or ""),
            )
    for row in (action_snapshot.get("watchlist_moves", []) or [])[:10]:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        chg = _safe_float(row.get("chg_pct"), 0.0) or 0.0
        _add_event(
            candidates,
            f"{symbol} watchlist move",
            f"{symbol} {row.get('badge','')} {row.get('badge_reason','')}",
            "Watchlist",
            data_date,
            "watchlist_move",
            "positive" if chg > 0 else "negative" if chg < 0 else "neutral",
        )
    for row in _filter_movers(movers_snapshot.get("categories", {}) or {})[:10]:
        symbol = str(row.get("symbol") or "").upper().strip()
        chg = _safe_float(row.get("change_pct"), 0.0) or 0.0
        _add_event(
            candidates,
            f"{symbol} notable mover",
            f"{symbol} moved {_fmt_pct(chg)} with rvol={_safe_float(row.get('relative_volume_10d_calc'),0.0):.1f}x",
            str(row.get("exchange") or "Market Movers"),
            data_date,
            "sector_move",
            "positive" if chg > 0 else "negative" if chg < 0 else "neutral",
        )
    for row in (earnings_calendar.get("earnings", []) or [])[:36]:
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker") or row.get("symbol") or "").upper().strip()
        event_date = str(row.get("date") or "")
        if ticker:
            _add_event(candidates, f"{ticker} earnings schedule", f"{ticker} earnings date={event_date}", "Earnings Calendar", event_date, "earnings", "neutral")
    for row in (econ_calendar.get("events", []) or [])[:24]:
        if not isinstance(row, dict):
            continue
        name = str(row.get("event") or "").strip()
        if not name:
            continue
        if any(token in _norm(name) for token in ("s&p 500", "nasdaq 100", "russell 2000", "vix", "dollar index", "gold", "crude", "bitcoin")):
            continue
        _add_event(candidates, name, f"{name} actual={row.get('actual','-')} forecast={row.get('forecast','-')}", "Economic Calendar", str(row.get("date") or data_date), "macro_event")

    seen: set[str] = set()
    cards: list[dict[str, Any]] = []
    market_ts = _parse_datetime_any(snapshot.get("as_of"), data_date) or datetime.now(timezone.utc)
    for idx, row in enumerate(candidates, start=1):
        key = _norm(f"{row.get('headline')} {row.get('summary')}")
        if not key or key in seen:
            continue
        seen.add(key)
        published = _parse_datetime_any(row.get("timestamp"), data_date)
        age_min = max(0.0, (market_ts - published).total_seconds() / 60.0) if published else None
        row["id"] = f"event_{idx:03d}"
        row["freshness_score"] = round(_freshness_multiplier(age_min), 3)
        row["age_minutes"] = round(age_min, 1) if age_min is not None else None
        cards.append(row)
    return cards[:60]


def _assets_from_event(event: dict[str, Any]) -> list[str]:
    text = _norm(f"{event.get('headline','')} {event.get('summary','')} {' '.join(event.get('keywords', []) or [])}")
    assets: list[str] = []

    def add(symbol: str) -> None:
        sym = str(symbol or "").upper().strip()
        if sym and sym not in assets:
            assets.append(sym)

    for symbol in event.get("mentioned_assets", []) or []:
        add(symbol)
    for key, mapped in THEME_ASSET_MAP.items():
        if key in text:
            for symbol in mapped:
                add(symbol)
    if str(event.get("event_type")) == "earnings":
        headline = str(event.get("headline") or "")
        for symbol in _extract_symbols(headline):
            add(symbol)
            if symbol in {"META", "GOOGL", "MSFT", "AMZN", "AAPL", "NVDA"}:
                for proxy in ("QQQ", "XLK"):
                    add(proxy)
    if "gold" in text:
        assets = [asset for asset in assets if asset in {"GOLD", "DXY", "US10Y", "WTI", "XLE"}]
    return assets[:8]


def _headline_direction_consistency(event: dict[str, Any], snapshot: dict[str, Any], assets: list[str]) -> float:
    headline = _norm(event.get("headline"))
    implied: dict[str, int] = {}
    if ("dollar" in headline or "dxy" in headline) and any(word in headline for word in ("slip", "fall", "drop", "weaker", "lower")):
        implied["DXY"] = -1
    if ("dollar" in headline or "dxy" in headline) and any(word in headline for word in ("rise", "gain", "higher", "stronger")):
        implied["DXY"] = 1
    if "gold" in headline and any(word in headline for word in ("loss", "fall", "drop", "lower")):
        implied["GOLD"] = -1
    if ("oil" in headline or "wti" in headline) and any(word in headline for word in ("rise", "gain", "surge", "higher")):
        implied["WTI"] = 1
    checked = 0
    aligned = 0
    for asset in assets:
        if asset not in implied:
            continue
        move = _move_num(snapshot, asset)
        if move is None or abs(move) < 0.05:
            continue
        checked += 1
        if (move > 0 and implied[asset] > 0) or (move < 0 and implied[asset] < 0):
            aligned += 1
    if checked:
        return _clamp(aligned / checked, 0.05, 1.0)
    raw = str(event.get("raw_direction") or "neutral")
    return _cross_asset_confirmation(snapshot, assets, raw) if raw in {"positive", "negative"} else 0.75


def match_events_to_prices(event_cards: list[dict[str, Any]], snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    matched: list[dict[str, Any]] = []
    for event in event_cards:
        assets = _assets_from_event(event)
        evidence = _evidence_for_assets(snapshot, assets)
        price_score = _price_impact_score(snapshot, assets)
        direction_consistency = _headline_direction_consistency(event, snapshot, assets)
        freshness = float(event.get("freshness_score", 0.25) or 0.25)
        directness = float(event.get("directness_score", 0.5) or 0.5)
        source_score = float(event.get("source_score", 0.5) or 0.5)
        penalties: list[str] = []
        if not evidence:
            penalties.append("no_price_evidence")
        if direction_consistency < 0.45:
            penalties.append("direction_conflict")
        if freshness <= 0.25:
            penalties.append("stale_headline")
        usable = bool(evidence) and direction_consistency >= 0.45 and freshness > 0.25
        score = _clamp((price_score * 0.45) + (direction_consistency * 0.20) + (directness * 0.15) + (freshness * 0.10) + (source_score * 0.10), 0.03, 0.99)
        if not usable:
            score *= 0.55
        matched.append(
            {
                **event,
                "matched_assets": assets,
                "price_evidence": evidence,
                "price_confirmation_score": round(price_score, 3),
                "direction_consistency_score": round(direction_consistency, 3),
                "usable_for_main_driver": usable,
                "event_score": round(_clamp(score, 0.03, 0.99), 3),
                "penalties": penalties,
                "event_role": "driver_candidate" if usable else "watch_driver",
            }
        )
    matched.sort(key=lambda row: (-float(row.get("event_score", 0) or 0), str(row.get("headline", ""))))
    return matched


def _cluster_event_hits(events: list[dict[str, Any]], cluster_def: dict[str, Any]) -> list[dict[str, Any]]:
    keywords = [str(k).lower() for k in cluster_def.get("keywords", [])]
    assets = set(cluster_def.get("assets", []))
    hits = []
    for event in events:
        text = _norm(f"{event.get('headline','')} {event.get('summary','')}")
        event_assets = set(event.get("matched_assets", []) or [])
        if event_assets & assets or any(key in text for key in keywords):
            hits.append(event)
    return hits


def _cluster_transmission(cluster_id: str, evidence: list[str]) -> str:
    joined = ", ".join(evidence[:5])
    if cluster_id == "cluster_ai_semis":
        return f"{joined} 확인으로 고베타 성장주와 레버리지 ETF에서 매도 압력이 커지며 나스닥 변동성이 확대"
    if cluster_id == "cluster_oil_energy":
        return f"{joined} 확인으로 유가 상승이 에너지 섹터 상대강도로 전이"
    if cluster_id == "cluster_defensive_real_estate":
        return f"{joined} 확인으로 방어주와 부동산이 성장주 약세의 대안으로 부상"
    if cluster_id == "cluster_rates_fed":
        return f"{joined} 확인으로 금리와 달러가 성장주 밸류에이션 부담을 자극"
    if cluster_id == "cluster_tsla_momentum":
        return f"{joined} 확인으로 모멘텀 단일종목 압력이 QQQ와 소비재 심리에 연결"
    if cluster_id == "cluster_big_tech_earnings":
        return f"{joined} 주변에서 빅테크 실적 대기가 기술주 방향성의 다음 변수로 작동"
    if cluster_id == "cluster_small_caps":
        return f"{joined} 확인으로 위험선호의 폭이 넓지 않다는 신호"
    return f"{joined} 확인으로 원자재와 지정학 프리미엄이 관련 섹터에 전이"


def _cluster_implication(cluster_id: str, direction: str) -> str:
    if cluster_id == "cluster_ai_semis":
        return "반등 확인 전까지 고베타 기술주 추격 매수는 보수적으로 접근"
    if cluster_id == "cluster_oil_energy":
        return "에너지는 상대강도가 우위지만 유가 급등 이후 추격보다 눌림 확인이 유리"
    if cluster_id == "cluster_defensive_real_estate":
        return "시장 폭이 약하면 방어주·부동산의 완충 역할을 우선 점검"
    if cluster_id == "cluster_rates_fed":
        return "US10Y와 DXY가 추가 상승하면 성장주 밸류에이션 부담을 더 보수적으로 반영"
    if cluster_id == "cluster_tsla_momentum":
        return "단일종목 모멘텀은 가격 확인 전까지 비중 확대보다 리스크 관리가 우선"
    if cluster_id == "cluster_big_tech_earnings":
        return "실적 이벤트 전후로 기술주 방향이 바뀔 수 있어 결과 확인 전 과도한 베팅은 피함"
    if direction == "positive":
        return "강한 자산은 추격보다 지속성 확인 후 선별 대응"
    return "약한 자산은 반등 확인 전까지 방어적 관점 유지"


def build_driver_clusters_v5(matched_events: list[dict[str, Any]], snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    clusters: list[dict[str, Any]] = []
    for definition in CLUSTER_DEFS:
        assets = list(definition["assets"])
        evidence = _evidence_for_assets(snapshot, assets)
        if not evidence:
            continue
        events = _cluster_event_hits(matched_events, definition)
        price_impact = _price_impact_score(snapshot, assets)
        direction = _dominant_direction(snapshot, assets)
        cross = _cross_asset_confirmation(snapshot, assets, direction)
        sector = _sector_transmission_score(assets, snapshot)
        directness = max([float(e.get("directness_score", 0.58) or 0.58) for e in events] or [0.62])
        freshness = max([float(e.get("freshness_score", 0.50) or 0.50) for e in events] or [0.90])
        score = (price_impact * 0.40) + (cross * 0.20) + (sector * 0.15) + (directness * 0.15) + (freshness * 0.10)

        if definition["cluster_id"] == "cluster_big_tech_earnings":
            upcoming = any(str(e.get("event_type")) == "earnings" for e in events)
            if upcoming:
                score = max(score, 0.54)
        if definition["cluster_id"] == "cluster_small_caps" and abs(_move_num(snapshot, "IWM") or 0) < 0.75:
            score *= 0.75

        if score < 0.42 and definition["cluster_id"] not in {"cluster_big_tech_earnings"}:
            continue

        clusters.append(
            {
                "cluster_id": definition["cluster_id"],
                "name_ko": definition["name_ko"],
                "theme": definition["theme"],
                "direction": direction,
                "assets": [asset for asset in assets if _move_num(snapshot, asset) is not None],
                "price_evidence": evidence,
                "supporting_events": [
                    {
                        "event_id": e.get("id"),
                        "headline": e.get("headline"),
                        "source": e.get("source"),
                        "timestamp": e.get("timestamp"),
                        "event_score": e.get("event_score"),
                    }
                    for e in sorted(events, key=lambda row: -float(row.get("event_score", 0) or 0))[:4]
                ],
                "transmission_ko": _cluster_transmission(definition["cluster_id"], evidence),
                "implication_ko": _cluster_implication(definition["cluster_id"], direction),
                "score": round(_clamp(score, 0.03, 0.99), 3),
                "score_breakdown": {
                    "price_impact_score": round(price_impact, 3),
                    "cross_asset_confirmation": round(cross, 3),
                    "sector_transmission_score": round(sector, 3),
                    "event_directness_score": round(directness, 3),
                    "freshness_score": round(freshness, 3),
                },
            }
        )
    clusters.sort(key=lambda row: (-float(row.get("score", 0) or 0), str(row.get("name_ko", ""))))
    return clusters[:5]


def build_driver_stack(clusters: list[dict[str, Any]], next_session_input: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    primary = clusters[0] if clusters else {}
    cluster_by_id = {str(row.get("cluster_id") or ""): row for row in clusters}
    qqq = _move_num(snapshot, "QQQ") or 0.0
    spy = _move_num(snapshot, "SPY") or 0.0
    soxl = _move_num(snapshot, "SOXL") or 0.0
    tqqq = _move_num(snapshot, "TQQQ") or 0.0
    if "cluster_ai_semis" in cluster_by_id and qqq < spy and (soxl <= -5.0 or tqqq <= -2.0):
        primary = cluster_by_id["cluster_ai_semis"]
    secondary = [row for row in clusters if row is not primary][:2]
    vix = _move_str(snapshot, "VIX")
    counter = {
        "cluster_id": "cluster_vix_no_spike",
        "title_ko": "VIX 미급등",
        "evidence": [f"VIX {vix}"],
        "meaning_ko": "전면적 패닉 매도보다는 로테이션 성격" if (_move_num(snapshot, "VIX") or 0) <= 3 else "변동성 상승이 위험회피 해석을 강화",
    }
    watch_items = next_session_input.get("watch_items", [])[:6]
    return {
        "primary": {
            "cluster_id": primary.get("cluster_id"),
            "title_ko": primary.get("name_ko"),
            "why_primary_ko": _why_primary(primary, snapshot),
            "evidence": primary.get("price_evidence", []),
        },
        "secondary": [
            {"cluster_id": row.get("cluster_id"), "title_ko": row.get("name_ko"), "evidence": row.get("price_evidence", [])}
            for row in secondary
        ],
        "counter": counter,
        "watch": watch_items,
    }


def _why_primary(primary: dict[str, Any], snapshot: dict[str, Any]) -> str:
    if primary.get("cluster_id") == "cluster_ai_semis":
        return "QQQ와 IWM이 SPY보다 약했고, SOXL/TQQQ 같은 고베타 레버리지 상품의 낙폭이 컸기 때문"
    if primary.get("cluster_id") == "cluster_oil_energy":
        return "WTI와 XLE가 동시에 강해지며 시장의 유입 방향을 가장 분명하게 보여줬기 때문"
    return f"{', '.join(primary.get('price_evidence', [])[:4])} 가격 증거가 가장 강했기 때문"


def build_next_session_input(data_date: str, econ_calendar: dict[str, Any], earnings_calendar: dict[str, Any]) -> dict[str, Any]:
    date_ref = _parse_date_key(data_date) or datetime.now(timezone.utc)
    date_plus_2 = (date_ref + timedelta(days=2)).date()
    watch_items: list[dict[str, Any]] = []
    for row in (econ_calendar.get("events", []) or [])[:40]:
        if not isinstance(row, dict):
            continue
        event_date = _parse_date_key(row.get("date"))
        name = str(row.get("event") or "").strip()
        if not event_date or event_date.date() <= date_ref.date() or event_date.date() > date_plus_2 or not name:
            continue
        if any(token in _norm(name) for token in ("s&p 500", "nasdaq 100", "russell 2000", "vix", "dollar index", "gold", "crude", "bitcoin")):
            continue
        watch_items.append({"title_ko": name, "evidence": [f"{event_date.date().isoformat()} {name}"], "type": "economic"})
        if len(watch_items) >= 4:
            break
    for row in (earnings_calendar.get("earnings", []) or [])[:50]:
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker") or row.get("symbol") or "").upper().strip()
        event_date = _parse_date_key(row.get("date"))
        if not ticker or not event_date or event_date.date() <= date_ref.date() or event_date.date() > date_plus_2:
            continue
        watch_items.append({"title_ko": f"{ticker} 실적", "evidence": [f"{event_date.date().isoformat()} {ticker} earnings"], "type": "earnings"})
        if len(watch_items) >= 7:
            break
    return {"watch_items": watch_items}


def build_money_flow_input(clusters: list[dict[str, Any]], snapshot: dict[str, Any]) -> dict[str, Any]:
    into: list[str] = []
    out_of: list[str] = []
    ids = {row.get("cluster_id"): row for row in clusters}
    if "cluster_oil_energy" in ids:
        into.append("WTI/XLE 에너지")
    if "cluster_defensive_real_estate" in ids:
        into.append("XLRE/XLP/XLU 방어·부동산")
    if "cluster_ai_semis" in ids:
        out_of.append("NVDA/SMH/SOXL/TQQQ AI·반도체 고베타")
    if "cluster_small_caps" in ids:
        out_of.append("IWM 소형주")
    if not into:
        into.append("상대강도 우위 섹터")
    if not out_of:
        out_of.append("상대강도 약세 자산")
    return {"into": into, "out_of": out_of, "evidence": _evidence_for_assets(snapshot, ["XLE", "XLRE", "XLP", "XLU", "NVDA", "SMH", "SOXL", "TQQQ", "QQQ", "IWM"])}


def build_risk_overlay_v5(risk_v1: dict, risk_engine: dict, snapshot: dict[str, Any]) -> dict[str, Any]:
    current = risk_v1.get("current", {}) or {}
    mss_score = _safe_float(current.get("score"), snapshot.get("_risk", {}).get("mss_score")) or 0.0
    mss_level = int(_safe_float(current.get("level"), snapshot.get("_risk", {}).get("mss_level")) or 0)
    mss_zone = str(current.get("score_zone") or snapshot.get("_risk", {}).get("mss_zone") or "")
    vol_pct = _safe_float(current.get("vol_pct"), snapshot.get("_risk", {}).get("vol_pct"))
    shock = _safe_float((risk_engine.get("shock_probability", {}) or {}).get("value"), snapshot.get("_risk", {}).get("shock_probability"))
    vix_move = _move_num(snapshot, "VIX")
    risk_level = "Crisis" if mss_level >= 4 else "High Risk" if mss_level >= 3 else "Warning" if mss_level >= 2 else "Caution" if mss_level >= 1 else "Normal"
    return {
        "risk_level": risk_level,
        "mss_score": round(mss_score, 2),
        "mss_level": mss_level,
        "mss_zone": mss_zone,
        "vix_change": _fmt_pct(vix_move),
        "vol_percentile": vol_pct,
        "shock_probability": shock,
        "message_ko": f"MSS {mss_score:.1f}({mss_zone}), VIX {_fmt_pct(vix_move)}, shock probability {shock if shock is not None else 'N/A'}",
    }


def build_evidence_tape(snapshot: dict[str, Any]) -> dict[str, list[str]]:
    return {
        "indices": [f"{k} {v}" for k, v in snapshot.get("indices", {}).items()],
        "rates_fx_vol": [f"{k} {v}" for k, v in snapshot.get("rates_fx_vol", {}).items()],
        "commodities": [f"{k} {v}" for k, v in snapshot.get("commodities", {}).items()],
        "sectors": [f"{k} {v}" for k, v in snapshot.get("sectors", {}).items()],
        "single_names": [f"{k} {v}" for k, v in snapshot.get("single_names", {}).items()],
    }


def build_narrative_core(snapshot: dict[str, Any], clusters: list[dict[str, Any]], driver_stack: dict[str, Any]) -> dict[str, Any]:
    signals = snapshot.get("_signals", {})
    qqq = float(signals.get("qqq", 0) or 0)
    spy = float(signals.get("spy", 0) or 0)
    iwm = float(signals.get("iwm", 0) or 0)
    wti = float(signals.get("wti", 0) or 0)
    vix = float(signals.get("vix", 0) or 0)
    cluster_ids = {row.get("cluster_id") for row in clusters}

    if qqq < spy and iwm < spy and wti > 1.5 and "cluster_oil_energy" in cluster_ids:
        story_type = "defensive_rotation"
        market_character = "전면적 위험 회피가 아니라 고베타 성장주에서 에너지·방어주로 이동한 섹터 로테이션"
    elif "cluster_ai_semis" in cluster_ids:
        story_type = "growth_deleveraging"
        market_character = "AI/반도체 고베타 차익실현이 지수보다 더 크게 나타난 성장주 디레버리징"
    elif "cluster_rates_fed" in cluster_ids:
        story_type = "rates_pressure"
        market_character = "금리와 달러 변수가 성장주 밸류에이션을 압박한 장세"
    else:
        story_type = "mixed_consolidation"
        market_character = "방향성보다 섹터별 상대강도 차별화가 우세한 혼조 장세"

    victims = []
    beneficiaries = []
    for row in clusters:
        if row.get("direction") == "negative":
            victims.extend(row.get("assets", []))
        elif row.get("direction") == "positive":
            beneficiaries.extend(row.get("assets", []))
    return {
        "story_type": story_type,
        "market_character_ko": market_character,
        "main_tension_ko": "AI/반도체 고베타 차익실현 vs 유가 급등에 따른 에너지 강세"
        if {"cluster_ai_semis", "cluster_oil_energy"} <= cluster_ids
        else "가격 확인이 붙은 주도 클러스터와 약세 클러스터의 힘겨루기",
        "primary_cause_ko": "금리·달러 소폭 반등과 유가 급등" if "cluster_rates_fed" in cluster_ids and "cluster_oil_energy" in cluster_ids else str(driver_stack.get("primary", {}).get("title_ko") or "가격 반응"),
        "market_victim": list(dict.fromkeys(victims))[:8],
        "beneficiary": list(dict.fromkeys(beneficiaries))[:8],
        "counterpoint_ko": "VIX가 급등하지 않았기 때문에 패닉 매도보다는 리밸런싱 성격이 강함" if vix <= 3 else "VIX 상승이 위험회피 해석을 일부 강화",
        "false_read_ko": "AI/반도체 약세를 곧바로 AI 사이클 붕괴로 해석하는 것",
        "validation_points_ko": [
            "NVDA와 SMH가 QQQ 대비 상대강도를 회복하는지",
            "WTI 강세가 XLE 상승으로 계속 전이되는지",
            "US10Y와 DXY가 추가 상승하며 QQQ를 계속 압박하는지",
            "빅테크 실적이 기술주 분위기를 되돌릴 수 있는지",
        ],
        "positioning_lens_ko": "고베타 추격 매수보다 반등 확인이 우선이고, 에너지는 추격보다 눌림 확인이 유리",
        "confidence": "medium_high" if len(clusters) >= 3 else "medium",
    }


def build_briefing_packet_for_claude(
    *,
    data_date: str,
    snapshot: dict[str, Any],
    clusters: list[dict[str, Any]],
    driver_stack: dict[str, Any],
    narrative_core: dict[str, Any],
    money_flow_input: dict[str, Any],
    next_session_input: dict[str, Any],
    risk_overlay: dict[str, Any],
    evidence_tape: dict[str, list[str]],
) -> dict[str, Any]:
    clean_snapshot = {key: snapshot[key] for key in ("as_of", "indices", "rates_fx_vol", "commodities", "sectors", "high_beta", "single_names", "relative_structure") if key in snapshot}
    return {
        "data_date": data_date,
        "market_reaction_snapshot": clean_snapshot,
        "driver_clusters": clusters,
        "driver_stack": driver_stack,
        "narrative_core": narrative_core,
        "money_flow_input": money_flow_input,
        "next_session_input": next_session_input,
        "risk_overlay": risk_overlay,
        "evidence_tape": evidence_tape,
    }


def build_rule_based_fallback_output(packet: dict[str, Any]) -> dict[str, Any]:
    core = packet.get("narrative_core", {}) or {}
    stack = packet.get("driver_stack", {}) or {}
    clusters = packet.get("driver_clusters", []) or []
    money = packet.get("money_flow_input", {}) or {}
    risk = packet.get("risk_overlay", {}) or {}
    next_items = packet.get("next_session_input", {}).get("watch_items", []) or []
    primary = stack.get("primary", {}) or {}
    secondary = stack.get("secondary", []) or []
    counter = stack.get("counter", {}) or {}
    watch_text = ", ".join(item.get("evidence", [""])[0] for item in next_items[:5]) or "확정된 다음 세션 이벤트 제한"

    return {
        "headline_ko": _shorten(str(core.get("story_type") or "시장 로테이션"), 25),
        "market_call_ko": str(core.get("market_character_ko") or "가격 반응 기준 혼조 장세"),
        "market_scene_ko": _market_scene_from_packet(packet),
        "narrative_core_ko": f"{core.get('primary_cause_ko','가격 반응')}이 출발점이었고, {core.get('main_tension_ko','주도 클러스터 간 힘겨루기')}가 오늘 장의 핵심이었다. {core.get('counterpoint_ko','반대 증거도 함께 확인 필요')}",
        "driver_stack_ko": {
            "primary_ko": f"{primary.get('title_ko','핵심 드라이버')}: {primary.get('why_primary_ko','가격 증거가 가장 강함')}",
            "secondary_ko": " / ".join(f"{row.get('title_ko')}: {', '.join(row.get('evidence', [])[:3])}" for row in secondary) or "뚜렷한 보조 드라이버 제한",
            "counter_ko": f"{counter.get('title_ko','반대 증거')}: {counter.get('meaning_ko','과도한 해석 경계')}",
            "watch_ko": watch_text,
        },
        "money_flow_ko": f"돈은 {', '.join(money.get('out_of', []))}에서 빠져 {', '.join(money.get('into', []))} 쪽으로 이동한 것으로 해석된다.",
        "false_read_ko": str(core.get("false_read_ko") or "단일 약세를 장기 추세 붕괴로 단정하는 것은 이르다."),
        "next_session_test_ko": "다음 장 확인 포인트는 " + ", ".join(core.get("validation_points_ko", [])[:4]) + ".",
        "positioning_lens_ko": str(core.get("positioning_lens_ko") or "추격보다 가격 확인을 우선한다."),
        "risk_overlay_ko": f"{risk.get('message_ko','리스크 데이터 제한')}. 오늘 해석은 리스크 레벨보다 가격 로테이션 여부가 더 중요하다.",
        "driver_cards": [
            {
                "rank": idx,
                "title_ko": row.get("name_ko"),
                "reaction_ko": ", ".join(row.get("price_evidence", [])),
                "transmission_ko": row.get("transmission_ko"),
                "implication_ko": row.get("implication_ko"),
                "tone": row.get("direction") if row.get("direction") in {"positive", "negative", "neutral"} else "neutral",
            }
            for idx, row in enumerate(clusters, start=1)
        ],
        "evidence_tape": packet.get("evidence_tape", {}),
    }


def _market_scene_from_packet(packet: dict[str, Any]) -> str:
    tape = packet.get("evidence_tape", {}) or {}
    indices = ", ".join(tape.get("indices", [])[:3])
    commodities = ", ".join(tape.get("commodities", [])[:3])
    sectors = ", ".join(tape.get("sectors", [])[:5])
    high_beta = ""
    if high_beta:
        high_beta = ", ".join(f"{k} {v}" for k, v in (packet.get("market_reaction_snapshot", {}) or {}).get("high_beta", {}).items())
    else:
        high_beta = ", ".join(f"{k} {v}" for k, v in (packet.get("market_reaction_snapshot", {}) or {}).get("high_beta", {}).items())
    return f"지수는 {indices} 흐름이었고, 고베타는 {high_beta or '확인 제한'}로 흔들렸다. 원자재는 {commodities}, 섹터는 {sectors}가 핵심 증거였다."


def extract_price_values(packet: dict[str, Any]) -> list[str]:
    values: list[str] = []
    text = json.dumps(packet.get("evidence_tape", {}), ensure_ascii=False)
    values.extend(re.findall(r"[+-][0-9]+(?:\.[0-9]+)?%", text))
    for cluster in packet.get("driver_clusters", []) or []:
        values.extend(re.findall(r"[+-][0-9]+(?:\.[0-9]+)?%", json.dumps(cluster.get("price_evidence", []), ensure_ascii=False)))
    return list(dict.fromkeys(values))


def validate_llm_output(output: dict[str, Any], packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required_fields = [
        "headline_ko",
        "market_call_ko",
        "market_scene_ko",
        "narrative_core_ko",
        "driver_stack_ko",
        "money_flow_ko",
        "false_read_ko",
        "next_session_test_ko",
        "positioning_lens_ko",
        "risk_overlay_ko",
        "driver_cards",
        "evidence_tape",
    ]
    for field in required_fields:
        if field not in output or not output[field]:
            errors.append(f"missing field: {field}")
    output_text = json.dumps(output, ensure_ascii=False)
    for value in extract_price_values(packet):
        if value not in output_text:
            errors.append(f"missing price value: {value}")
    expected_titles = [d.get("name_ko") for d in packet.get("driver_clusters", [])]
    output_titles = [d.get("title_ko") for d in output.get("driver_cards", []) if isinstance(d, dict)]
    if len(output_titles) != len(expected_titles):
        errors.append("driver card count mismatch")
    else:
        for idx, expected in enumerate(expected_titles):
            if expected and expected not in str(output_titles[idx]):
                errors.append(f"driver order mismatch at index {idx}: expected {expected}, got {output_titles[idx]}")
    for phrase in BANNED_PHRASES:
        if phrase in output_text:
            errors.append(f"banned phrase: {phrase}")
    if len(str(output.get("false_read_ko", ""))) < 20:
        errors.append("false_read_ko too short")
    if len(str(output.get("next_session_test_ko", ""))) < 30:
        errors.append("next_session_test_ko too short")
    return errors


def _build_claude_user_prompt(packet: dict[str, Any]) -> str:
    packet_json = json.dumps(packet, ensure_ascii=False, indent=2)
    return f"""아래 briefing_packet을 바탕으로 한국어 데일리 마켓 브리핑을 작성하라.

briefing_packet:
{packet_json}

출력은 반드시 아래 JSON 구조만 반환하라.

{{
  "commentary_type": "",
  "core_question": "",
  "human_commentary": ["문단1", "문단2", "문단3"],
  "market_tension": "",
  "next_checkpoints": [],
  "headline_ko": "...",
  "market_call_ko": "...",
  "market_scene_ko": "...",
  "narrative_core_ko": "...",
  "driver_stack_ko": {{
    "primary_ko": "...",
    "secondary_ko": "...",
    "counter_ko": "...",
    "watch_ko": "..."
  }},
  "money_flow_ko": "...",
  "false_read_ko": "...",
  "next_session_test_ko": "...",
  "positioning_lens_ko": "...",
  "risk_overlay_ko": "...",
  "driver_cards": [
    {{
      "rank": 1,
      "title_ko": "...",
      "reaction_ko": "...",
      "transmission_ko": "...",
      "implication_ko": "...",
      "tone": "positive|negative|neutral"
    }}
  ],
  “evidence_tape”: {{
    “indices”: [],
    “rates_fx_vol”: [],
    “commodities”: [],
    “sectors”: [],
    “single_names”: []
  }}
}}

작성 조건:
1. headline_ko는 25자 이내로 작성한다.
2. market_call_ko는 오늘 장의 판정을 한 문장으로 작성한다.
3. market_scene_ko는 가격 반응을 장면처럼 설명한다. 지수 등락률 나열로 시작하지 않는다.
4. narrative_core_ko는 드라이버 간 인과관계를 하나의 이야기로 연결한다.
5. driver_stack_ko는 primary, secondary, counter, watch의 역할 차이를 분명히 설명한다.
6. money_flow_ko는 반드시 “어디서 빠져 어디로 갔는지”를 설명한다.
7. false_read_ko는 오늘 데이터를 잘못 해석할 수 있는 포인트를 지적한다.
8. next_session_test_ko는 다음 장 확인 포인트 3개 이상을 포함한다.
9. positioning_lens_ko는 매수/매도 추천이 아니라 포지션 관점으로 작성한다.
10. risk_overlay_ko는 MSS, VIX, shock probability를 오늘 내러티브와 연결한다.
11. driver_cards는 briefing_packet의 driver_clusters 순서와 수치를 유지한다.
12. evidence_tape는 briefing_packet의 수치를 그대로 복사한다.
13. commentary_type은 [MOMENTUM_STRETCH, PULLBACK_WATCH, BREADTH_CHECK, LEADERSHIP_ROTATION, MACRO_PRESSURE, THESIS_CONFIRMATION, CONTRADICTION_ALERT, EVENT_SETUP, RISK_RELIEF] 중 하나를 선택한다.
14. core_question은 오늘 장의 핵심 질문을 한 문장으로 쓴다. 지수 등락률로 시작하지 않는다.
15. human_commentary는 JSON 배열로 반환하라. 각 배열 요소가 하나의 문단이다. Observation → 핵심 질문 → 해석 → 리스크 → 체크포인트 구조로 2-3개 문단을 작성한다. 지수 나열로 시작하지 않는다. 각 문단은 독립된 문자열이며 줄바꿈을 포함하지 않는다.
16. market_tension은 오늘 장에서 가장 중요한 긴장 관계를 한 문장으로 쓴다.
17. next_checkpoints는 다음 1-5 세션에서 확인해야 할 구체적 신호 2-4개를 배열로 작성한다.
18. 모든 JSON 문자열 값은 리터럴 개행 없이 한 줄로 작성하라. 줄바꿈이 필요하면 반드시 \\n으로 이스케이프하라."""


def call_claude_sonnet(packet: dict[str, Any], api_key: str) -> tuple[dict[str, Any], int, int]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    return _call_llm_json_with_retry(
        client,
        system_prompt=CLAUDE_SYSTEM_PROMPT,
        user_content=_build_claude_user_prompt(packet),
        max_tokens=8192,
        retries=1,
    )


def repair_llm_output_once(packet: dict[str, Any], previous_output: dict[str, Any], errors: list[str], api_key: str) -> tuple[dict[str, Any], int, int]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    prompt = f"""이전 출력이 아래 검증 오류를 발생시켰다.

validation_errors:
{json.dumps(errors, ensure_ascii=False, indent=2)}

previous_output:
{json.dumps(previous_output, ensure_ascii=False, indent=2)}

briefing_packet:
{json.dumps(packet, ensure_ascii=False, indent=2)}

다음 규칙을 지켜 JSON을 다시 작성하라.

- 가격 수치를 변경하지 마라.
- driver_cards 순서를 바꾸지 마라.
- 누락된 필드를 모두 채워라.
- 제공되지 않은 뉴스나 자산을 추가하지 마라.
- 출력은 JSON만 반환하라."""
    return _call_llm_json_with_retry(client, system_prompt=CLAUDE_SYSTEM_PROMPT, user_content=prompt, max_tokens=4096, retries=0)


def build_output(
    data_date: str,
    slot: str,
    packet: dict[str, Any],
    llm_output: dict[str, Any],
    validation: dict[str, Any],
    llm_used: bool,
    fallback_used: bool,
    tokens: dict[str, Any],
    llm_error: str = "",
) -> dict[str, Any]:
    return {
        "version": VERSION,
        "data_date": data_date,
        "slot": slot,
        "generated_at": _now_utc(),
        "model": {
            "llm_provider": "anthropic",
            "llm_model": MODEL_ID,
            "llm_used": llm_used,
            "fallback_used": fallback_used,
            "tokens": tokens,
            "llm_error": llm_error,
        },
        "briefing_packet": packet,
        "llm_output": llm_output,
        "validation": validation,
    }


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    slot = _current_slot()
    for idx, arg in enumerate(args):
        if arg.startswith("--slot="):
            slot = arg.split("=", 1)[1].strip() or slot
        elif arg == "--slot" and idx + 1 < len(args):
            slot = args[idx + 1].strip() or slot

    if not force and not is_stale(slot=slot):
        print("[build_daily_briefing_v5] output is fresh, skipping (use --force to override)")
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
    if not headline_cache:
        headline_cache = _load_headline_rows()

    data_date = (
        str(market_state.get("data_date") or "").strip()
        or str((risk_v1.get("current", {}) or {}).get("date") or "").strip()
        or str(context_news.get("date") or "").strip()
        or datetime.now(timezone.utc).astimezone(ET_ZONE).strftime("%Y-%m-%d")
    )[:10]
    freshness = build_freshness_meta(data_date, overview.get("latest_date"), market_state.get("generated_at"))

    snapshot = build_market_reaction_snapshot_v5(market_state, risk_v1, risk_engine, sector_perf, econ_calendar, core_price_snapshot, movers_snapshot, action_snapshot)
    events = build_event_cards_v5(
        data_date=data_date,
        headline_rows=headline_cache,
        context_news=context_news,
        earnings_calendar=earnings_calendar,
        econ_calendar=econ_calendar,
        movers_snapshot=movers_snapshot,
        action_snapshot=action_snapshot,
        snapshot=snapshot,
    )
    matched_events = match_events_to_prices(events, snapshot)
    clusters = build_driver_clusters_v5(matched_events, snapshot)
    next_session = build_next_session_input(data_date, econ_calendar, earnings_calendar)
    driver_stack = build_driver_stack(clusters, next_session, snapshot)
    risk_overlay = build_risk_overlay_v5(risk_v1, risk_engine, snapshot)
    money_flow = build_money_flow_input(clusters, snapshot)
    narrative_core = build_narrative_core(snapshot, clusters, driver_stack)
    evidence_tape = build_evidence_tape(snapshot)
    packet = build_briefing_packet_for_claude(
        data_date=data_date,
        snapshot=snapshot,
        clusters=clusters,
        driver_stack=driver_stack,
        narrative_core=narrative_core,
        money_flow_input=money_flow,
        next_session_input=next_session,
        risk_overlay=risk_overlay,
        evidence_tape=evidence_tape,
    )
    packet["freshness"] = freshness
    packet["matched_events_sample"] = matched_events[:12]

    fallback_output = build_rule_based_fallback_output(packet)
    llm_output = fallback_output
    validation_errors = validate_llm_output(llm_output, packet)
    llm_used = False
    fallback_used = True
    repair_used = False
    llm_error = ""
    tokens = {"input": 0, "output": 0, "cost_usd": 0.0}

    api_key = _load_api_key()
    if api_key:
        try:
            parsed, in_tok, out_tok = call_claude_sonnet(packet, api_key)
            errors = validate_llm_output(parsed, packet)
            if errors:
                try:
                    repaired, repair_in, repair_out = repair_llm_output_once(packet, parsed, errors, api_key)
                    repaired_errors = validate_llm_output(repaired, packet)
                    in_tok += repair_in
                    out_tok += repair_out
                    if not repaired_errors:
                        parsed = repaired
                        errors = []
                        repair_used = True
                except Exception as exc:
                    print(f"[build_daily_briefing_v5] WARN LLM repair failed: {exc}")
            if not errors:
                llm_output = parsed
                validation_errors = []
                llm_used = True
                fallback_used = False
            else:
                validation_errors = errors
            tokens = {
                "input": in_tok,
                "output": out_tok,
                "cost_usd": round((in_tok * PRICE_IN) + (out_tok * PRICE_OUT), 6),
            }
        except Exception as exc:
            llm_error = f"llm_call_failed: {exc}"
            print(f"[build_daily_briefing_v5] WARN Claude failed; using rule fallback: {exc}")
    else:
        llm_error = "ANTHROPIC_API_KEY not found; rule fallback used"

    final_errors = [] if llm_used else validate_llm_output(llm_output, packet)
    validation = {
        "passed": len(final_errors) == 0,
        "errors": final_errors,
        "repair_used": repair_used,
    }
    output = build_output(data_date, slot, packet, llm_output, validation, llm_used, fallback_used, tokens, llm_error)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)

    print(f"[build_daily_briefing_v5] saved -> {OUT_PATH}")
    print(f"[build_daily_briefing_v5] clusters={len(clusters)} llm_used={llm_used} fallback={fallback_used} validation_passed={validation['passed']}")
    if freshness.get("warning"):
        print(f"[build_daily_briefing_v5] freshness warning: {freshness['warning']}")


if __name__ == "__main__":
    main()
