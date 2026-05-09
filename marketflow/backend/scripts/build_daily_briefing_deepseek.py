"""
build_daily_briefing_deepseek.py

Generate DeepSeek-flavored daily briefing cache.

Flow:
1) Load the same raw market context used by the Claude V6 briefing
2) Ask DeepSeek to write the briefing directly from that context
3) Save only real DeepSeek output. If DeepSeek is unavailable, exit non-zero
   and keep the previous cache intact.

Output:
  backend/output/cache/daily_briefing_deepseek_v3.json
  backend/output/cache/daily_briefing_deepseek_v6.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
CACHE_DIR = BACKEND_DIR / "output" / "cache"

try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR.parent / ".env")
    load_dotenv(BACKEND_DIR.parent / ".env.local", override=True)
except Exception:
    pass

try:
    from build_daily_briefing_v6 import (
        BRIEFING_MAX_TOKENS_EN,
        BRIEFING_MAX_TOKENS_KO,
        BRIEFING_TEMPERATURE,
        KO_ONLY_SYSTEM_PROMPT,
        KO_ONLY_USER_TEMPLATE,
        RELEASE_VERSION,
        SECTION_META,
        SIGNAL_COLOR,
        _current_briefing_slot,
        _load_inputs,
        _refresh_context_news,
        build_context,
        build_fallback_section_payload,
        build_freshness_meta,
        build_hook,
        build_one_line,
        build_risk_check,
        fill_en_fields_via_deepl,
        prompt_hash,
        resolve_briefing_system_prompt,
    )
except Exception as exc:  # pragma: no cover - fails loudly in CLI usage
    raise RuntimeError(f"Unable to import V6 raw context helpers: {exc}") from exc

DEFAULT_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat"
DEFAULT_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions").strip() or "https://api.deepseek.com/chat/completions"
DEFAULT_TIMEOUT_SEC = max(20, int(os.getenv("DEEPSEEK_TIMEOUT_SEC", "75")))
DEFAULT_RETRIES = max(1, int(os.getenv("DEEPSEEK_RETRIES", "2")))
BASE_REFRESH_TIMEOUT_SEC = max(30, int(os.getenv("DEEPSEEK_BASE_REFRESH_TIMEOUT_SEC", "90")))
SOURCE_CONFIG = {
    "v3": {
        "source_script": "build_daily_briefing_v3.py",
        "base_file": "daily_briefing_v3.json",
        "out_file": "daily_briefing_deepseek_v3.json",
    },
    "v6": {
        "source_script": "build_daily_briefing_v6.py",
        "base_file": "daily_briefing_v6.json",
        "out_file": "daily_briefing_deepseek_v6.json",
    },
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build DeepSeek daily briefing cache")
    parser.add_argument("--source", default="v6", choices=["v3", "v6"], help="Source briefing version.")
    parser.add_argument("--force", action="store_true", help="Force rebuild base source briefing first.")
    parser.add_argument("--lang", default="ko", choices=["ko", "en"], help="Briefing language.")
    parser.add_argument("--slot", default="", help="Briefing slot (preopen|morning|close|manual).")
    return parser.parse_args()


def _run_base_briefing(source: str, force: bool, lang: str, slot: str) -> tuple[bool, str]:
    source_script = str(SOURCE_CONFIG.get(source, SOURCE_CONFIG["v6"])["source_script"])
    script_path = SCRIPT_DIR / source_script
    cmd = [sys.executable, "-X", "utf8", str(script_path), f"--lang={lang}"]
    if force:
        cmd.append("--force")
    if slot:
        cmd.append(f"--slot={slot}")

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(BACKEND_DIR),
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=BASE_REFRESH_TIMEOUT_SEC,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return False, f"timeout>{BASE_REFRESH_TIMEOUT_SEC}s"
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-240:]
        return False, f"rc={proc.returncode} {tail}"
    return True, "ok"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise RuntimeError(f"Missing file: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON at {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid payload type at {path}: {type(payload).__name__}")
    return payload


def _extract_json_block(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, flags=re.IGNORECASE)
    if fenced:
        block = fenced.group(1).strip()
        try:
            parsed = json.loads(block)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

    first = raw.find("{")
    last = raw.rfind("}")
    if first >= 0 and last > first:
        block = raw[first : last + 1]
        try:
            parsed = json.loads(block)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def _safe_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return ""


def _compact_base_summary(base: dict[str, Any]) -> str:
    lines: list[str] = []
    hook_ko = _safe_text(base.get("hook_ko"))
    one_line_ko = _safe_text(base.get("one_line_ko"))
    if hook_ko:
        lines.append(f"- hook_ko: {hook_ko}")
    if one_line_ko:
        lines.append(f"- one_line_ko: {one_line_ko}")
    core_question = _safe_text(base.get("core_question"))
    if core_question:
        lines.append(f"- core_question: {core_question}")
    sections = base.get("sections") if isinstance(base.get("sections"), list) else []
    for sec in sections[:7]:
        if not isinstance(sec, dict):
            continue
        sec_id = _safe_text(sec.get("id")) or "section"
        structural = _safe_text(sec.get("structural_ko") or sec.get("structural"))[:320]
        implication = _safe_text(sec.get("implication_ko") or sec.get("implication"))[:320]
        lines.append(f"- {sec_id}.structural_ko: {structural}")
        lines.append(f"- {sec_id}.implication_ko: {implication}")
    joined = "\n".join(lines)
    return joined[:6000]


def _build_deepseek_messages(base: dict[str, Any], lang: str) -> tuple[str, str]:
    system = (
        "You are a senior U.S. market strategist. "
        "Rewrite the briefing in a distinct, concise, high-signal style for an LLM comparison test. "
        "Preserve facts, but do not reuse full sentences or the same phrasing from the input. "
        "Return JSON only."
    )
    user = f"""
Target language: {lang}
Task: Rewrite the briefing payload with the same market facts.
Do not invent numbers or events.
Important: This output will be compared against the Claude source.
- Do not copy any full source sentence.
- Change framing, verbs, sentence order, and causal emphasis.
- Keep tickers, numbers, dates, and event facts intact.
- If the source says the same idea in Korean, express it with materially different Korean wording.

Input summary:
{_compact_base_summary(base)}

Output JSON schema:
{{
  "hook_ko": "string",
  "one_line_ko": "string",
  "hook": "string",
  "one_line": "string",
  "core_question": "string",
  "human_commentary": ["string", "string", "string"],
  "market_tension": "string",
  "next_checkpoints": ["string", "string", "string"],
  "sections": {{
    "market_flow": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "event_drivers": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "sector_structure": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "macro_commodities": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "stock_moves": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "economic_data": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}},
    "technical_regime": {{"structural_ko": "string", "implication_ko": "string", "structural": "string", "implication": "string"}}
  }}
}}
""".strip()
    return system, user


def _call_deepseek(
    system: str,
    user: str,
    model: str,
    max_tokens: int,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        return None, None, "missing_key"

    try:
        import requests
    except Exception:
        return None, None, "requests_unavailable"

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": BRIEFING_TEMPERATURE,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_reason = ""
    for attempt in range(1, DEFAULT_RETRIES + 1):
        try:
            resp = requests.post(DEFAULT_API_URL, headers=headers, json=body, timeout=DEFAULT_TIMEOUT_SEC)
        except Exception as exc:
            last_reason = f"request_error_attempt_{attempt}:{exc}"
            continue

        if resp.status_code >= 500 and attempt < DEFAULT_RETRIES:
            last_reason = f"http_{resp.status_code}_attempt_{attempt}:{resp.text[:220]}"
            continue
        if resp.status_code >= 400:
            return None, None, f"http_{resp.status_code}:{resp.text[:220]}"

        try:
            payload = resp.json()
        except Exception as exc:
            return None, None, f"invalid_json:{exc}"

        try:
            content = str((((payload.get("choices") or [{}])[0] or {}).get("message") or {}).get("content") or "")
        except Exception:
            content = ""
        parsed = _extract_json_block(content)
        if not isinstance(parsed, dict):
            return None, payload, "parse_failed"
        return parsed, payload, "ok"

    return None, None, last_reason or "request_failed"


def _normalize_list(value: Any, limit: int = 5) -> list[str]:
    if isinstance(value, list):
        out = [_safe_text(v) for v in value if _safe_text(v)]
        return out[:limit]
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    return []


def _compare_text(value: Any) -> str:
    return re.sub(r"\s+", " ", _safe_text(value)).strip().casefold()


def _rewrite_section_map(rewrite: dict[str, Any]) -> dict[str, dict[str, Any]]:
    sections = rewrite.get("sections")
    out: dict[str, dict[str, Any]] = {}
    if isinstance(sections, dict):
        for sid, row in sections.items():
            if isinstance(row, dict):
                out[_safe_text(sid)] = row
    elif isinstance(sections, list):
        for row in sections:
            if isinstance(row, dict):
                sid = _safe_text(row.get("id"))
                if sid:
                    out[sid] = row
    return out


def _has_material_rewrite(base: dict[str, Any], rewrite: dict[str, Any]) -> bool:
    checked = 0
    changed = 0

    for key in ("hook_ko", "one_line_ko", "core_question", "market_tension"):
        source_text = _compare_text(base.get(key))
        rewrite_text = _compare_text(rewrite.get(key))
        if source_text and rewrite_text:
            checked += 1
            if source_text != rewrite_text:
                changed += 1

    rewrite_sections = _rewrite_section_map(rewrite)
    base_sections = base.get("sections") if isinstance(base.get("sections"), list) else []
    for section in base_sections[:7]:
        if not isinstance(section, dict):
            continue
        sid = _safe_text(section.get("id"))
        rewrite_row = rewrite_sections.get(sid)
        if not rewrite_row:
            continue
        for field in ("structural_ko", "implication_ko"):
            source_text = _compare_text(section.get(field))
            rewrite_text = _compare_text(rewrite_row.get(field))
            if source_text and rewrite_text:
                checked += 1
                if source_text != rewrite_text:
                    changed += 1

    return checked >= 6 and changed >= max(4, checked // 2)


def _merge_payload(
    base: dict[str, Any],
    rewrite: dict[str, Any] | None,
    model: str,
    reason: str,
    source: str,
    base_refresh_ok: bool,
    base_refresh_reason: str,
) -> dict[str, Any]:
    out = dict(base)
    out["generated_at"] = datetime.now(timezone.utc).isoformat()
    out["model"] = model
    out["provider"] = "deepseek"
    out["deepseek_reason"] = reason
    out["deepseek_source"] = source
    out["deepseek_base_refresh_ok"] = base_refresh_ok
    out["deepseek_base_refresh_reason"] = base_refresh_reason
    out["source_model"] = _safe_text(base.get("model"))

    if not isinstance(out.get("tokens"), dict):
        out["tokens"] = {"input": 0, "output": 0, "cost_usd": 0}

    if not isinstance(rewrite, dict):
        out.setdefault("prompt", {})
        if isinstance(out["prompt"], dict):
            out["prompt"]["fallback_used"] = True
            out["prompt"]["source"] = f"{source}_clone"
        return out

    for key in ("hook", "hook_ko", "one_line", "one_line_ko", "core_question", "market_tension"):
        value = _safe_text(rewrite.get(key))
        if value:
            out[key] = value

    human_commentary = _normalize_list(rewrite.get("human_commentary"), limit=4)
    if human_commentary:
        out["human_commentary"] = human_commentary

    checkpoints = _normalize_list(rewrite.get("next_checkpoints"), limit=5)
    if checkpoints:
        out["next_checkpoints"] = checkpoints

    base_sections = out.get("sections") if isinstance(out.get("sections"), list) else []
    rewrite_sections = rewrite.get("sections")
    sec_map: dict[str, dict[str, Any]] = {}
    if isinstance(rewrite_sections, dict):
        for sec_id, sec_payload in rewrite_sections.items():
            if isinstance(sec_payload, dict):
                sec_map[_safe_text(sec_id)] = sec_payload
    elif isinstance(rewrite_sections, list):
        for sec_payload in rewrite_sections:
            if not isinstance(sec_payload, dict):
                continue
            sec_id = _safe_text(sec_payload.get("id"))
            if sec_id:
                sec_map[sec_id] = sec_payload

    merged_sections: list[dict[str, Any]] = []
    for section in base_sections:
        if not isinstance(section, dict):
            continue
        row = dict(section)
        sid = _safe_text(row.get("id"))
        rewrite_row = sec_map.get(sid, {})
        if rewrite_row:
            for field in ("structural", "structural_ko", "implication", "implication_ko"):
                value = _safe_text(rewrite_row.get(field))
                if value:
                    row[field] = value
        merged_sections.append(row)
    if merged_sections:
        out["sections"] = merged_sections

    out.setdefault("prompt", {})
    if isinstance(out["prompt"], dict):
        out["prompt"]["fallback_used"] = False
        out["prompt"]["source"] = "deepseek"
        out["prompt"]["model"] = model

    return out


def _load_raw_context(slot: str) -> tuple[dict[str, str], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    refreshed_news = _refresh_context_news(slot)
    ms, overview, rv1, re_data, sp, econ_cal, earnings, movers, news = _load_inputs()
    if refreshed_news:
        news = refreshed_news

    ctx = build_context(ms, rv1, re_data, sp, econ_cal, earnings, movers, news)
    risk_check = build_risk_check(rv1)
    freshness = build_freshness_meta(
        ctx.get("data_date"),
        overview.get("latest_date") if isinstance(overview, dict) else None,
        ms.get("generated_at") if isinstance(ms, dict) else None,
    )
    return ctx, risk_check, freshness, rv1, re_data


def _build_raw_context_messages(ctx: dict[str, str], lang: str) -> tuple[str, str, dict[str, Any], int]:
    if lang == "ko":
        system, prompt_meta = resolve_briefing_system_prompt()
        return system, KO_ONLY_USER_TEMPLATE.format(**ctx), dict(prompt_meta or {}), BRIEFING_MAX_TOKENS_KO

    system = (
        "You are a senior U.S. market strategist writing independently from raw market data. "
        "Use the evidence pack directly. Return valid JSON only."
    )
    user = f"""
DATA DATE: {ctx.get("data_date", "")}

MANDATORY NARRATIVE DRIVERS:
{ctx.get("mandatory_drivers", "")}

LIVE HEADLINE TAPE:
{ctx.get("headline_tape", "")}

WATCHLIST FOCUS:
{ctx.get("watchlist_focus", "")}

EVENT CARDS:
{ctx.get("event_cards_json", "")}

NARRATIVE PLAN:
{ctx.get("narrative_plan_json", "")}

SECTION 1 - THE BATTLEGROUND
{ctx.get("market_flow", "")}

SECTION 2 - LIVE TRIGGERS & TRANSMISSION
{ctx.get("event_drivers", "")}

SECTION 3 - MONEY VELOCITY & ROTATION
{ctx.get("sector_structure", "")}

SECTION 4 - MACRO TREMORS
{ctx.get("macro_commodities", "")}

SECTION 5 - THE HOTZONES
{ctx.get("stock_moves", "")}

SECTION 6 - NEXT 24H RADAR
{ctx.get("economic_data", "")}

SECTION 7 - SYSTEM DEFCON
{ctx.get("technical_regime", "")}

Generate the same JSON schema as the Korean briefing, but fill English fields too:
{{
  "commentary_type": "MOMENTUM_STRETCH|PULLBACK_WATCH|BREADTH_CHECK|LEADERSHIP_ROTATION|MACRO_PRESSURE|THESIS_CONFIRMATION|CONTRADICTION_ALERT|EVENT_SETUP|RISK_RELIEF",
  "core_question": "one question",
  "human_commentary": ["observation", "interpretation", "outlook"],
  "market_tension": "one sentence",
  "next_checkpoints": ["indicator/ticker — what to check"],
  "hook": "...",
  "hook_ko": "...",
  "one_line": "...",
  "one_line_ko": "...",
  "sections": {{
    "market_flow": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "event_drivers": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "sector_structure": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "macro_commodities": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "stock_moves": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "economic_data": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}},
    "technical_regime": {{"structural": "...", "structural_ko": "...", "implication": "...", "implication_ko": "...", "signal": "..."}}
  }}
}}
""".strip()
    return system, user, {"source": "deepseek_inline_en", "version": RELEASE_VERSION}, BRIEFING_MAX_TOKENS_EN


def _merge_raw_context_payload(
    ctx: dict[str, str],
    rewrite: dict[str, Any],
    *,
    model: str,
    reason: str,
    source: str,
    slot: str,
    risk_check: dict[str, Any],
    freshness: dict[str, Any],
    rv1: dict[str, Any],
    re_data: dict[str, Any],
    prompt_meta: dict[str, Any],
    prompt_hash_value: str,
    max_tokens: int,
) -> dict[str, Any]:
    try:
        narrative_plan = json.loads(ctx.get("narrative_plan_json", "{}"))
        if not isinstance(narrative_plan, dict):
            narrative_plan = {}
    except Exception:
        narrative_plan = {}

    section_map = _rewrite_section_map(rewrite)
    sections: list[dict[str, Any]] = []
    for sid, title in SECTION_META:
        raw_sec = section_map.get(sid, {})
        fallback_sec = build_fallback_section_payload(sid, ctx.get(sid, ""), rv1)
        signal = _safe_text(raw_sec.get("signal")).lower()
        if signal not in SIGNAL_COLOR:
            signal = fallback_sec["signal"]
        structural_ko = _safe_text(raw_sec.get("structural_ko"))
        implication_ko = _safe_text(raw_sec.get("implication_ko"))
        structural = _safe_text(raw_sec.get("structural"))
        implication = _safe_text(raw_sec.get("implication"))
        sections.append({
            "id": sid,
            "title": title,
            "structural": structural,
            "structural_ko": structural_ko or fallback_sec["structural"],
            "implication": implication,
            "implication_ko": implication_ko or fallback_sec["implication"],
            "signal": signal,
            "color": SIGNAL_COLOR.get(signal, "#64748b"),
        })

    hook_ko = _safe_text(rewrite.get("hook_ko"))
    one_line_ko = _safe_text(rewrite.get("one_line_ko"))
    hook = _safe_text(rewrite.get("hook"))
    one_line = _safe_text(rewrite.get("one_line"))
    if not hook_ko and not hook:
        hook_ko = build_hook(ctx, rv1, re_data, narrative_plan)
    if not one_line_ko and not one_line:
        one_line_ko = build_one_line(sections, rv1)

    resolved_prompt_meta = dict(prompt_meta or {})
    resolved_prompt_meta["registry_version"] = resolved_prompt_meta.get("registry_version") or resolved_prompt_meta.get("version", "unknown")
    resolved_prompt_meta["version"] = RELEASE_VERSION
    resolved_prompt_meta["release"] = RELEASE_VERSION
    resolved_prompt_meta["prompt_hash"] = prompt_hash_value
    resolved_prompt_meta["temperature"] = BRIEFING_TEMPERATURE
    resolved_prompt_meta["max_tokens"] = max_tokens
    resolved_prompt_meta["provider"] = "deepseek"
    resolved_prompt_meta["fallback_used"] = False

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_date": ctx.get("data_date", ""),
        "slot": slot,
        "model": model,
        "lang": "ko",
        "release": RELEASE_VERSION,
        "tokens": {"input": 0, "output": 0, "cost_usd": 0.0},
        "freshness": freshness,
        "prompt": resolved_prompt_meta,
        "commentary_type": _safe_text(rewrite.get("commentary_type")),
        "core_question": _safe_text(rewrite.get("core_question")),
        "human_commentary": _normalize_list(rewrite.get("human_commentary"), limit=3),
        "market_tension": _safe_text(rewrite.get("market_tension")),
        "next_checkpoints": _normalize_list(rewrite.get("next_checkpoints"), limit=3),
        "hook": hook,
        "hook_ko": hook_ko,
        "sections": sections,
        "risk_check": risk_check,
        "one_line": one_line,
        "one_line_ko": one_line_ko,
        "provider": "deepseek",
        "deepseek_reason": reason,
        "deepseek_source": f"{source}_raw_context",
        "deepseek_input_source": "raw_market_context",
        "deepseek_base_refresh_ok": True,
        "deepseek_base_refresh_reason": "not_used_raw_context",
        "source_model": None,
    }
    return fill_en_fields_via_deepl(out, os.environ.get("DEEPL_API_KEY", "").strip(), out.get("data_date", ""))


def main() -> None:
    args = _parse_args()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    source = str(args.source or "v6").strip().lower()
    cfg = SOURCE_CONFIG.get(source, SOURCE_CONFIG["v6"])
    out_path = CACHE_DIR / str(cfg["out_file"])
    slot = str(args.slot or "").strip().lower() or _current_briefing_slot()

    ctx, risk_check, freshness, rv1, re_data = _load_raw_context(slot)
    system, user, prompt_meta, max_tokens = _build_raw_context_messages(ctx, str(args.lang))
    prompt_hash_value = prompt_hash(system, user)

    model = DEFAULT_MODEL
    rewrite, deepseek_raw, reason = _call_deepseek(
        system=system,
        user=user,
        model=model,
        max_tokens=max_tokens,
    )
    if not isinstance(rewrite, dict):
        print(
            f"[build_daily_briefing_deepseek] ERROR DeepSeek generation failed; "
            f"not saving stale output. reason={reason}",
            file=sys.stderr,
        )
        raise SystemExit(2)

    out = _merge_raw_context_payload(
        ctx=ctx,
        rewrite=rewrite,
        model=model,
        reason=reason,
        source=source,
        slot=slot,
        risk_check=risk_check,
        freshness=freshness,
        rv1=rv1,
        re_data=re_data,
        prompt_meta=prompt_meta,
        prompt_hash_value=prompt_hash_value,
        max_tokens=max_tokens,
    )

    if isinstance(deepseek_raw, dict):
        usage = deepseek_raw.get("usage") if isinstance(deepseek_raw.get("usage"), dict) else {}
        input_tok = int(usage.get("prompt_tokens") or 0)
        output_tok = int(usage.get("completion_tokens") or 0)
        price_in = float(os.getenv("DEEPSEEK_PRICE_IN_PER_TOKEN", "0") or 0)
        price_out = float(os.getenv("DEEPSEEK_PRICE_OUT_PER_TOKEN", "0") or 0)
        out["tokens"] = {
            "input": input_tok,
            "output": output_tok,
            "cost_usd": round(input_tok * price_in + output_tok * price_out, 6),
        }

    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[build_daily_briefing_deepseek] saved -> {out_path}")
    print(f"[build_daily_briefing_deepseek] reason={reason} model={model} source={source}_raw_context")


if __name__ == "__main__":
    main()
