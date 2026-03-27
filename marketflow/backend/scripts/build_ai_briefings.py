"""
Build cached AI briefings for the MarketFlow AI layer.

Writes:
  backend/output/ai/std_risk/latest.json
  backend/output/ai/macro/latest.json
  backend/output/ai/integrated/latest.json
  backend/output/briefing.json
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv


if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
OUTPUT_DIR = BACKEND_DIR / "output"
AI_DIR = OUTPUT_DIR / "ai"
ET_ZONE = ZoneInfo("America/New_York")

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
LAYERS = ("std_risk", "macro", "integrated")
LAYER_TITLES = {
    "std_risk": {"ko": "표준 리스크 브리프", "en": "Standard Risk Brief"},
    "macro": {"ko": "매크로 브리프", "en": "Macro Brief"},
    "integrated": {"ko": "통합 브리프", "en": "Integrated Brief"},
}


def _bootstrap() -> None:
    backend_path = str(BACKEND_DIR)
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    for candidate in [
        ROOT_DIR / ".env",
        ROOT_DIR / ".env.local",
        BACKEND_DIR / ".env",
        BACKEND_DIR / ".env.local",
    ]:
        load_dotenv(candidate)


_bootstrap()

from ai.providers import AIProvider, get_api_key, get_model, get_timeout_sec  # noqa: E402


def _text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(int(value)) if float(value).is_integer() else str(value)
    return default


def _num(value: Any, digits: int = 1) -> str:
    if isinstance(value, bool):
        return "--"
    try:
        num = float(value)
    except Exception:
        return "--"
    if digits == 0:
        return str(int(round(num)))
    return f"{num:.{digits}f}"


def _pct(value: Any, digits: int = 1) -> str:
    if isinstance(value, bool):
        return "--"
    try:
        num = float(value)
    except Exception:
        return "--"
    return f"{'+' if num > 0 else ''}{num:.{digits}f}%"


def _pick(data: Any, *path: str, default: Any = None) -> Any:
    cur = data
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
    return default if cur is None else cur


def _read_json(name: str) -> Tuple[Optional[Dict[str, Any]], Optional[Path]]:
    for candidate in [OUTPUT_DIR / name, OUTPUT_DIR / "cache" / name]:
        if not candidate.exists():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON in {candidate}: {exc}") from exc
        if isinstance(data, dict):
            return data, candidate
    return None, None


def _load_context() -> Dict[str, Any]:
    market_state, market_state_path = _read_json("market_state.json")
    health_snapshot, health_snapshot_path = _read_json("health_snapshot.json")
    overview, overview_path = _read_json("overview.json")
    macro_summary, macro_summary_path = _read_json("macro_summary.json")
    macro_detail, macro_detail_path = _read_json("macro_detail.json")
    risk_v1, risk_v1_path = _read_json("risk_v1.json")
    vr_survival, vr_survival_path = _read_json("vr_survival.json")
    action_snapshot, action_snapshot_path = _read_json("action_snapshot.json")
    daily_briefing, daily_briefing_path = _read_json("daily_briefing.json")
    daily_report, daily_report_path = _read_json("daily_report.json")

    asof_day = (
        _text(_pick(market_state, "data_date"))
        or _text(_pick(health_snapshot, "data_date"))
        or _text(_pick(overview, "latest_date"))
        or _text(_pick(macro_summary, "asof_date"))
        or _text(_pick(macro_detail, "asof_date"))
        or _text(_pick(risk_v1, "data_as_of"))
        or _text(_pick(risk_v1, "current", "date"))
        or _text(_pick(vr_survival, "current", "date"))
        or _text(_pick(daily_briefing, "data_date"))
        or datetime.now(ET_ZONE).strftime("%Y-%m-%d")
    )

    source_files = [
        str(path.relative_to(OUTPUT_DIR))
        for path in [
            market_state_path,
            health_snapshot_path,
            overview_path,
            macro_summary_path,
            macro_detail_path,
            risk_v1_path,
            vr_survival_path,
            action_snapshot_path,
            daily_briefing_path,
            daily_report_path,
        ]
        if path is not None
    ]

    return {
        "asof_day": asof_day,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "slot": "manual",
        "source_files": source_files,
        "market_state": {
            "data_date": _text(_pick(market_state, "data_date") or asof_day),
            "generated_at": _text(_pick(market_state, "generated_at")),
            "phase": _pick(market_state, "phase", "label"),
            "phase_detail": _pick(market_state, "phase", "detail"),
            "gate": _pick(market_state, "gate", "label"),
            "gate_value": _pick(market_state, "gate", "value"),
            "gate_avg10d": _pick(market_state, "gate", "avg10d"),
            "gate_delta5d": _pick(market_state, "gate", "delta5d"),
            "risk": _pick(market_state, "risk", "label"),
            "risk_detail": _pick(market_state, "risk", "detail"),
            "trend": _pick(market_state, "trend", "label"),
            "trend_detail": _pick(market_state, "trend", "detail"),
        },
        "health": {
            "data_date": _text(_pick(health_snapshot, "data_date") or asof_day),
            "trend_dist_pct": _pick(health_snapshot, "trend", "dist_pct"),
            "risk_cvar95_1d": _pick(health_snapshot, "risk", "cvar95_1d"),
            "risk_var95_1d": _pick(health_snapshot, "risk", "var95_1d"),
            "breadth_label": _pick(health_snapshot, "breadth_greed", "label"),
            "breadth_explain": _pick(health_snapshot, "breadth_greed", "explain"),
        },
        "overview": {
            "latest_date": _text(_pick(overview, "latest_date") or asof_day),
            "gate_score": _pick(overview, "gate_score"),
            "risk_level": _pick(overview, "risk_level"),
            "risk_trend": _pick(overview, "risk_trend"),
            "gate_status": _pick(overview, "gate_status"),
        },
        "macro": {
            "policy_version": _pick(macro_summary, "policy_version"),
            "asof_date": _text(_pick(macro_summary, "asof_date") or asof_day),
            "score": _pick(macro_summary, "macro_pressure", "score"),
            "state": _pick(macro_summary, "macro_pressure", "state"),
            "confidence": _pick(macro_summary, "macro_pressure", "confidence"),
            "series_status": _pick(macro_summary, "series_status"),
            "exposure_modifier": _pick(macro_summary, "exposure_modifier"),
        },
        "macro_detail": {
            "policy_version": _pick(macro_detail, "policy_version"),
            "asof_date": _text(_pick(macro_detail, "asof_date") or asof_day),
            "formula": _pick(macro_detail, "macro_pressure_explain", "formula"),
            "inputs": _pick(macro_detail, "macro_pressure_explain", "inputs"),
            "layers": _pick(macro_detail, "layers"),
        },
        "risk": {
            "run_id": _pick(risk_v1, "run_id"),
            "current": {
                "date": _pick(risk_v1, "current", "date"),
                "score": _pick(risk_v1, "current", "score"),
                "score_zone": _pick(risk_v1, "current", "score_zone"),
                "level_label": _pick(risk_v1, "current", "level_label"),
                "exposure_pct": _pick(risk_v1, "current", "exposure_pct"),
                "brief": _pick(risk_v1, "current", "brief"),
                "context": _pick(risk_v1, "current", "context"),
            },
        },
        "vr": {
            "run_id": _pick(vr_survival, "run_id"),
            "current": {
                "date": _pick(vr_survival, "current", "date"),
                "score": _pick(vr_survival, "current", "score"),
                "level_label": _pick(vr_survival, "current", "level_label"),
                "state": _pick(vr_survival, "current", "state"),
                "exposure_pct": _pick(vr_survival, "current", "exposure_pct"),
                "brief": _pick(vr_survival, "current", "brief"),
            },
        },
        "action": {
            "data_date": _text(_pick(action_snapshot, "data_date") or asof_day),
            "action_label": _pick(action_snapshot, "exposure_guidance", "action_label"),
            "exposure_band": _pick(action_snapshot, "exposure_guidance", "exposure_band"),
            "reason": _pick(action_snapshot, "exposure_guidance", "reason"),
        },
        "briefing": {
            "data_date": _text(_pick(daily_briefing, "data_date") or asof_day),
            "headline": _pick(daily_briefing, "headline"),
            "paragraphs": _pick(daily_briefing, "paragraphs"),
            "bullets": _pick(daily_briefing, "bullets"),
            "stance": _pick(daily_briefing, "stance"),
        },
        "report": {
            "generated_at": _pick(daily_report, "generated_at"),
            "market_lines": _pick(daily_report, "market_summary", "lines"),
            "market_bullets": _pick(daily_report, "market_summary", "bullets"),
            "action_hint": _pick(daily_report, "market_summary", "action_hint"),
            "sector_interp": _pick(daily_report, "sector_brief", "interp"),
            "risk_lines": _pick(daily_report, "risk_brief", "lines"),
            "narratives": _pick(daily_report, "narratives"),
        },
    }


def _listify(value: Any, lang: str) -> List[str]:
    if isinstance(value, dict):
        if lang in value:
            return _listify(value[lang], lang)
        for key in ("en", "ko", "text", "summary", "title", "label", "value"):
            if key in value:
                return _listify(value[key], lang)
        return []
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
            elif isinstance(item, dict):
                text = _text(item.get(lang) or item.get("en") or item.get("ko") or item.get("text") or item.get("value") or item.get("label"))
            else:
                text = _text(item)
            if text:
                items.append(text)
        return items
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return []


def _section_defaults(layer: str, context: Dict[str, Any]) -> Dict[str, Any]:
    gate_value = _num(context["market_state"]["gate_value"], 0)
    risk_level = _text(context["overview"]["risk_level"], "medium")
    risk_zone = _text(context["risk"]["current"]["score_zone"], "")
    risk_score = _num(context["risk"]["current"]["score"], 0)
    action_band = _text(context["action"]["exposure_band"], "--")
    action_label = _text(context["action"]["action_label"], "Hold")
    action_reason = _text(context["action"]["reason"], "Mixed trend/risk signals")
    macro_state = _text(context["macro"]["state"], "unknown")
    macro_score = _num(context["macro"]["score"], 0)
    macro_conf = _num(context["macro"]["confidence"], 0)
    macro_formula = _text(context["macro_detail"]["formula"], "0.4*LPI + 0.3*RPI + 0.3*VRI")
    phase_label = _text(context["market_state"]["phase"], "Phase")
    trend_label = _text(context["market_state"]["trend"], "Trend")
    risk_label = _text(context["market_state"]["risk"], "Risk")
    daily_headline = _text(
        context["briefing"]["headline"].get("en") if isinstance(context["briefing"]["headline"], dict) else context["briefing"]["headline"]
    )
    daily_paragraphs_en = _listify(context["briefing"]["paragraphs"], "en")
    report_lines_en = _listify(context["report"]["market_lines"], "en")
    sector_interp = _text(context["report"]["sector_interp"], "")
    narrative_market = _text(_pick(context["report"], "narratives", "market"), "")
    narrative_sector = _text(_pick(context["report"], "narratives", "sector"), "")
    narrative_risk = _text(_pick(context["report"], "narratives", "risk"), "")

    if layer == "std_risk":
        return {
            "title": LAYER_TITLES[layer],
            "summary": {
                "ko": f"{phase_label} 구간에서 Gate {gate_value}, {risk_label}, {trend_label}를 함께 확인하는 방어적 구간입니다.",
                "en": f"Transition phase with Gate {gate_value}, {risk_label}, and {trend_label} still argues for a defensive posture.",
            },
            "paragraphs": {
                "ko": [
                    f"현재 상태는 {phase_label}이며 Gate {gate_value}, 리스크 {risk_level}, 추세 {trend_label}가 함께 보입니다.",
                    "변동성과 브레드스는 혼조라서 단기 방향은 가격보다 압력 완화 여부에 더 민감합니다.",
                    f"노출은 {action_band} 정도를 유지하고, {action_reason}를 확인할 때까지 선택적으로 대응하세요.",
                ],
                "en": [
                    f"The current state is {phase_label} with Gate {gate_value}, risk {risk_level}, and trend {trend_label} still in view.",
                    "Volatility and breadth are mixed, so the near-term path is more sensitive to pressure relief than to headline trend alone.",
                    f"Keep exposure around {action_band} and stay selective until the gate and risk picture improve together.",
                ],
            },
            "warnings": {
                "ko": [
                    "Gate가 50 아래로 내려가면 현재 균형이 약해집니다.",
                    "VIX 가속이나 브레드스 악화는 추세보다 빠르게 체감될 수 있습니다.",
                    f"200일선 이탈은 {action_label}보다 더 방어적인 전환이 필요할 수 있습니다.",
                ],
                "en": [
                    "A drop of Gate below 50 would weaken the current balance.",
                    "A sharper VIX move or breadth deterioration can matter faster than the trend line itself.",
                    "A loss of the 200-day trend would call for a more defensive shift than the current stance.",
                ],
            },
            "highlights": {
                "ko": [f"Gate {gate_value}", f"Risk {risk_level}", f"Exposure {action_band}"],
                "en": [f"Gate {gate_value}", f"Risk {risk_level}", f"Exposure {action_band}"],
            },
        }

    if layer == "macro":
        inputs = _listify(context["macro_detail"]["inputs"], "en")
        return {
            "title": LAYER_TITLES[layer],
            "summary": {
                "ko": f"매크로 압력은 {macro_state}로 보이며, 정책/유동성/변동성 입력은 아직 확정적이지 않습니다.",
                "en": f"Macro pressure sits in a {macro_state} state, and the policy/liquidity/volatility blend is still incomplete.",
            },
            "paragraphs": {
                "ko": [
                    f"매크로 압력은 {macro_state}이며 점수 {macro_score}, 신뢰도 {macro_conf}로 읽힙니다.",
                    f"공식은 {macro_formula}이고, 현재 입력은 {', '.join(inputs[:3]) if inputs else 'partial inputs'} 상태입니다.",
                    "정책/유동성/변동성 입력이 안정될 때까지는 매크로 신호를 보수적으로 해석하세요.",
                ],
                "en": [
                    f"Macro pressure is reading as {macro_state} with score {macro_score} and confidence {macro_conf}.",
                    f"The working formula is {macro_formula}, and the current inputs are still partial.",
                    "Treat the macro layer conservatively until the policy, liquidity, and volatility inputs settle into a stable score.",
                ],
            },
            "warnings": {
                "ko": [
                    "점수가 비어 있거나 부분 입력이면 해석 강도를 낮추세요.",
                    "부분 입력이 지속되면 다음 노출 조정은 지연될 수 있습니다.",
                    "정책과 변동성이 동시에 흔들리면 추세보다 빠르게 체감될 수 있습니다.",
                ],
                "en": [
                    "If the score is partial or missing, lower the confidence in the macro read.",
                    "Persistent partial inputs can delay the next exposure adjustment.",
                    "Policy and volatility can reprice risk faster than the trend if they move together.",
                ],
            },
            "highlights": {
                "ko": [f"Macro score {macro_score}", f"Macro state {macro_state}", f"Confidence {macro_conf}"],
                "en": [f"Macro score {macro_score}", f"Macro state {macro_state}", f"Confidence {macro_conf}"],
            },
        }

    briefing_lines = daily_paragraphs_en[:3] or report_lines_en[:3] or [
        f"Trend intact; risk level {risk_level}.",
        f"Keep exposure aligned with {action_band}.",
        f"Watch Gate {gate_value} and macro confirmation.",
    ]
    return {
        "title": LAYER_TITLES[layer],
        "summary": {
            "ko": daily_headline or f"{phase_label} / {risk_zone or risk_level}를 다시 확인하는 통합 브리프입니다.",
            "en": daily_headline or f"Integrated brief rechecking the {phase_label} / {risk_zone or risk_level} combination.",
        },
        "paragraphs": {
            "ko": [
                daily_headline or f"오늘 브리프는 {phase_label} / {risk_zone or risk_level} 조합을 다시 확인합니다.",
                briefing_lines[0],
                briefing_lines[1] if len(briefing_lines) > 1 else f"노출은 {action_band} 정도를 유지하세요.",
                f"기술/매크로/리스크가 함께 정렬될 때만 {action_label} 쪽으로 확장하세요.",
            ],
            "en": [
                daily_headline or f"Today’s brief rechecks the {phase_label} / {risk_zone or risk_level} combination.",
                briefing_lines[0],
                briefing_lines[1] if len(briefing_lines) > 1 else f"Keep exposure around {action_band}.",
                f"Only widen risk when the technical, macro, and risk layers improve together.",
            ],
        },
        "warnings": {
            "ko": [
                "트렌드가 유지돼도 매크로 입력이 흔들리면 노출 확장은 보류하세요.",
                "브레드스 악화가 먼저 나오면 통합 브리프가 방어적으로 바뀔 수 있습니다.",
            ],
            "en": [
                "Even if trend holds, pause any exposure increase when the macro layer is still unstable.",
                "If breadth deteriorates first, the integrated brief should turn more defensive.",
            ],
        },
        "highlights": {
            "ko": [phase_label, f"Gate {gate_value} / {risk_zone or risk_level}", f"Macro {macro_state}"],
            "en": [phase_label, f"Gate {gate_value} / {risk_zone or risk_level}", f"Macro {macro_state}"],
        },
    }


def _provider_choice() -> Optional[AIProvider]:
    forced = os.getenv("AI_BRIEF_PROVIDER", "auto").strip().lower()
    if forced in {"fallback", "none", "static"}:
        return None
    if forced in {"gpt", "openai"}:
        try:
            get_api_key(AIProvider.GPT)
            return AIProvider.GPT
        except Exception:
            return None
    if forced == "gemini":
        try:
            get_api_key(AIProvider.GEMINI)
            return AIProvider.GEMINI
        except Exception:
            return None
    for provider in (AIProvider.GPT, AIProvider.GEMINI):
        try:
            get_api_key(provider)
            return provider
        except Exception:
            continue
    return None


def _build_prompt(context: Dict[str, Any]) -> Tuple[str, str]:
    system = "\n".join(
        [
            "You are the cached MarketFlow briefing engine.",
            "Return JSON only and do not wrap it in markdown fences.",
            "Use the supplied context as facts and do not invent contradictory values.",
            "Write parallel Korean and English fields for every user-facing section.",
            "Keep each paragraph short and practical.",
            "The three outputs are for separate UI layers: std_risk, macro, and integrated.",
        ]
    )
    user = "\n".join(
        [
            "Generate this JSON object exactly:",
            "{",
            '  "std_risk": { "layer": "std_risk", "title": {"ko": "...", "en": "..."}, "summary": {"ko": "...", "en": "..."}, "paragraphs": {"ko": ["..."], "en": ["..."]}, "warnings": {"ko": ["..."], "en": ["..."]}, "highlights": {"ko": ["..."], "en": ["..."]}, "sources": [] },',
            '  "macro": { "layer": "macro", "title": {"ko": "...", "en": "..."}, "summary": {"ko": "...", "en": "..."}, "paragraphs": {"ko": ["..."], "en": ["..."]}, "warnings": {"ko": ["..."], "en": ["..."]}, "highlights": {"ko": ["..."], "en": ["..."]}, "sources": [] },',
            '  "integrated": { "layer": "integrated", "title": {"ko": "...", "en": "..."}, "summary": {"ko": "...", "en": "..."}, "paragraphs": {"ko": ["..."], "en": ["..."]}, "warnings": {"ko": ["..."], "en": ["..."]}, "highlights": {"ko": ["..."], "en": ["..."]}, "sources": [] }',
            "}",
            "",
            "Rules:",
            "- Each layer should have 2 to 4 short paragraphs.",
            "- Each layer should have 2 to 3 warnings and 2 to 4 highlights.",
            "- Keep Korean and English aligned in meaning.",
            "- Do not add extra top-level keys.",
            "",
            "Context JSON:",
            json.dumps(context, ensure_ascii=False, indent=2),
        ]
    )
    return system, user


def _call_openai(system: str, user: str) -> Tuple[str, str]:
    model = get_model(AIProvider.GPT)
    api_key = get_api_key(AIProvider.GPT)
    timeout_sec = get_timeout_sec()
    res = requests.post(
        OPENAI_CHAT_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.2,
            "max_tokens": 2500,
        },
        timeout=timeout_sec,
    )
    res.raise_for_status()
    data = res.json()
    text = _text(_pick(data, "choices", 0, "message", "content"))
    if not text:
        raise RuntimeError("OpenAI returned an empty response")
    return text, model


def _call_gemini(system: str, user: str) -> Tuple[str, str]:
    model = get_model(AIProvider.GEMINI)
    api_key = get_api_key(AIProvider.GEMINI)
    timeout_sec = get_timeout_sec()
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 2500,
            "responseMimeType": "application/json",
        },
    }
    res = requests.post(f"{GEMINI_BASE_URL}/{model}:generateContent?key={api_key}", json=payload, timeout=timeout_sec)
    res.raise_for_status()
    data = res.json()
    text = _text(_pick(data, "candidates", 0, "content", "parts", 0, "text"))
    if not text:
        parts = _pick(data, "candidates", 0, "content", "parts")
        if isinstance(parts, list):
            text = "\n".join(_text(part.get("text")) for part in parts if isinstance(part, dict)).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text, model


def _extract_json(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("AI response did not contain valid JSON")


def _normalized_layer(raw: Optional[Dict[str, Any]], layer: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    title = raw.get("title") or fallback["title"]
    summary = raw.get("summary") or fallback["summary"]
    paragraphs = raw.get("paragraphs") or fallback["paragraphs"]
    warnings = raw.get("warnings") or fallback["warnings"]
    highlights = raw.get("highlights") or fallback["highlights"]
    return {
        "layer": layer,
        "title": {
            "ko": _text(_pick(title, "ko")) or fallback["title"]["ko"],
            "en": _text(_pick(title, "en")) or fallback["title"]["en"],
        },
        "summary": {
            "ko": _text(_pick(summary, "ko")) or fallback["summary"]["ko"],
            "en": _text(_pick(summary, "en")) or fallback["summary"]["en"],
        },
        "paragraphs": {
            "ko": _listify(_pick(paragraphs, "ko") if isinstance(paragraphs, dict) else paragraphs, "ko") or fallback["paragraphs"]["ko"],
            "en": _listify(_pick(paragraphs, "en") if isinstance(paragraphs, dict) else paragraphs, "en") or fallback["paragraphs"]["en"],
        },
        "warnings": {
            "ko": _listify(_pick(warnings, "ko") if isinstance(warnings, dict) else warnings, "ko") or fallback["warnings"]["ko"],
            "en": _listify(_pick(warnings, "en") if isinstance(warnings, dict) else warnings, "en") or fallback["warnings"]["en"],
        },
        "highlights": {
            "ko": _listify(_pick(highlights, "ko") if isinstance(highlights, dict) else highlights, "ko") or fallback["highlights"]["ko"],
            "en": _listify(_pick(highlights, "en") if isinstance(highlights, dict) else highlights, "en") or fallback["highlights"]["en"],
        },
        "sources": raw.get("sources") if isinstance(raw.get("sources"), list) else [],
        "provider": _text(raw.get("provider") or fallback["provider"], fallback["provider"]),
        "model": _text(raw.get("model") or fallback["model"], fallback["model"]),
        "generated_at": _text(raw.get("generated_at") or fallback["generated_at"], fallback["generated_at"]),
        "asof_day": _text(raw.get("asof_day") or raw.get("asof_date") or fallback["asof_day"], fallback["asof_day"]),
        "_meta": raw.get("_meta") if isinstance(raw.get("_meta"), dict) else {"fallback": False},
    }


def _default_output(layer: str, context: Dict[str, Any]) -> Dict[str, Any]:
    defaults = _section_defaults(layer, context)
    return {
        "layer": layer,
        "title": defaults["title"],
        "summary": defaults["summary"],
        "paragraphs": defaults["paragraphs"],
        "warnings": defaults["warnings"],
        "highlights": defaults["highlights"],
        "sources": [],
        "provider": "fallback",
        "model": "rules",
        "generated_at": context["generated_at"],
        "asof_day": context["asof_day"],
        "_meta": {
            "slot": context["slot"],
            "generated_at": context["generated_at"],
            "asof_day": context["asof_day"],
            "provider": "fallback",
            "model": "rules",
            "input_files": context["source_files"],
            "fallback": True,
        },
    }


def _legacy_briefing(integrated: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    content_lines = [
        "# Integrated Briefing",
        "",
        "## Summary",
        integrated["summary"]["en"] or integrated["summary"]["ko"],
        "",
        "## Key Points",
        *[f"- {line}" for line in integrated["paragraphs"]["en"]],
        "",
        "## Warnings",
        *[f"- {line}" for line in integrated["warnings"]["en"]],
    ]
    return {
        "timestamp": context["generated_at"],
        "summary": integrated["summary"]["en"] or integrated["summary"]["ko"],
        "content": "\n".join(content_lines).strip() + "\n",
        "model": integrated["model"],
        "api_used": integrated["provider"],
        "title": integrated["title"]["en"] or integrated["title"]["ko"],
        "paragraphs": integrated["paragraphs"],
        "warnings": integrated["warnings"],
        "highlights": integrated["highlights"],
        "layer": "integrated",
    }


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f"{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.remove(tmp_name)
            except Exception:
                pass


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build cached AI briefings.")
    parser.add_argument("--slot", default="manual", help="Schedule label: morning, close, or manual.")
    args = parser.parse_args(argv)

    context = _load_context()
    context["slot"] = args.slot
    provider_choice = _provider_choice()
    system, user = _build_prompt(context)

    print(f"[AIBriefings] slot={args.slot} asof={context['asof_day']} files={len(context['source_files'])}", flush=True)

    parsed: Optional[Dict[str, Any]] = None
    provider_name = "fallback"
    model_name = "rules"
    fallback_reason: Optional[str] = None

    try:
        if provider_choice == AIProvider.GPT:
            text, model_name = _call_openai(system, user)
            provider_name = "gpt"
        elif provider_choice == AIProvider.GEMINI:
            text, model_name = _call_gemini(system, user)
            provider_name = "gemini"
        else:
            text = ""
            fallback_reason = "No provider key found"
        if text:
            parsed = _extract_json(text)
    except Exception as exc:
        parsed = None
        fallback_reason = str(exc)

    if fallback_reason:
        print(f"[AIBriefings] fallback: {fallback_reason}", flush=True)
        provider_name = "fallback"
        model_name = "rules"
    else:
        print(f"[AIBriefings] provider={provider_name} model={model_name}", flush=True)

    outputs: Dict[str, Dict[str, Any]] = {}
    for layer in LAYERS:
        fallback = _default_output(layer, context)
        raw = parsed.get(layer) if isinstance(parsed, dict) else None
        outputs[layer] = _normalized_layer(raw if isinstance(raw, dict) else None, layer, fallback)
        outputs[layer]["provider"] = provider_name
        outputs[layer]["model"] = model_name
        outputs[layer]["generated_at"] = context["generated_at"]
        outputs[layer]["asof_day"] = context["asof_day"]
        outputs[layer]["_meta"] = {
            "slot": args.slot,
            "generated_at": context["generated_at"],
            "asof_day": context["asof_day"],
            "provider": provider_name,
            "model": model_name,
            "input_files": context["source_files"],
            "fallback": provider_name == "fallback",
        }
        if fallback_reason:
            outputs[layer]["_meta"]["fallback_reason"] = fallback_reason

    for layer in LAYERS:
        _write_json(AI_DIR / layer / "latest.json", outputs[layer])
    _write_json(OUTPUT_DIR / "briefing.json", _legacy_briefing(outputs["integrated"], context))

    print("[AIBriefings] wrote ai/std_risk/latest.json, ai/macro/latest.json, ai/integrated/latest.json, briefing.json", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
