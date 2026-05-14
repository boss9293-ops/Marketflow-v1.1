"""
MCP v0.5 Daily Briefing 2x2 review pack generator.

Run:
  python marketflow/backend/mcp/briefing/briefing_review_pack.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


MARKETFLOW_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = MARKETFLOW_DIR / "backend"
for _path in (MARKETFLOW_DIR, BACKEND_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload


DEFAULT_MATRIX_DIR = "marketflow/backend/output/mcp/briefing_matrix"

BANNED_PATTERNS_V05 = (
    re.compile(r"\bbuy\b", re.IGNORECASE),
    re.compile(r"\bsell\b", re.IGNORECASE),
    re.compile(r"\bentry\b", re.IGNORECASE),
    re.compile(r"\bexit\b", re.IGNORECASE),
    re.compile(r"\btarget\s+price\b", re.IGNORECASE),
    re.compile(r"\bstrong\s+buy\b", re.IGNORECASE),
    re.compile(r"\btrade\s+setup\b", re.IGNORECASE),
    re.compile(r"\brecommendation\b", re.IGNORECASE),
)

EXTRA_REPLACEMENTS = (
    (re.compile(r"\bstrong\s+buy\b", re.IGNORECASE), "high attention level"),
    (re.compile(r"\btrade\s+setup\b", re.IGNORECASE), "scenario structure"),
    (re.compile(r"\brecommendation\b", re.IGNORECASE), "interpretation guidance"),
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _sanitize_text_v05(text: str) -> str:
    output = str(text or "")
    for pattern, replacement in EXTRA_REPLACEMENTS:
        output = pattern.sub(replacement, output)
    return output


def _sanitize_payload_v05(payload: Any) -> Any:
    payload = sanitize_payload(payload)
    if isinstance(payload, str):
        return _sanitize_text_v05(payload)
    if isinstance(payload, list):
        return [_sanitize_payload_v05(item) for item in payload]
    if isinstance(payload, dict):
        return {key: _sanitize_payload_v05(value) for key, value in payload.items()}
    return payload


def _ensure_no_banned_language_v05(payload: Any) -> None:
    ensure_no_banned_language(payload)
    if isinstance(payload, str):
        for pattern in BANNED_PATTERNS_V05:
            if pattern.search(payload):
                raise ValueError(f"Banned language found: {payload}")
        return
    if isinstance(payload, list):
        for item in payload:
            _ensure_no_banned_language_v05(item)
        return
    if isinstance(payload, dict):
        for value in payload.values():
            _ensure_no_banned_language_v05(value)


def _resolve_matrix_dir(matrix_dir: str) -> Path:
    candidate = Path(str(matrix_dir or DEFAULT_MATRIX_DIR).strip())
    if candidate.is_absolute():
        return candidate
    cwd_candidate = Path.cwd() / candidate
    if cwd_candidate.exists():
        return cwd_candidate
    project_root = Path(__file__).resolve().parents[4]
    return project_root / candidate


def _safe_read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _variant_label(engine: str, renderer: str) -> str:
    return f"{engine.upper()} / {renderer.title()}"


def _collect_row_warnings(payload: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    if not isinstance(payload.get("title"), str) or not str(payload.get("title")).strip():
        warnings.append("title_missing")
    if not isinstance(payload.get("script"), str) or not str(payload.get("script")).strip():
        warnings.append("script_missing")
    sections = payload.get("sections")
    if not isinstance(sections, list):
        warnings.append("sections_not_list")
    meta = _as_dict(payload.get("_meta"))
    if not meta:
        warnings.append("meta_missing")
    elif str(meta.get("source_mode") or "").strip() == "":
        warnings.append("source_mode_missing")
    return warnings


def _first_n_section_headings(payload: Dict[str, Any], limit: int = 3) -> List[str]:
    out: List[str] = []
    for row in _as_list(payload.get("sections")):
        if not isinstance(row, dict):
            continue
        heading = str(row.get("heading") or "").strip()
        if heading:
            out.append(heading)
        if len(out) >= limit:
            break
    return out


def _script_preview(payload: Dict[str, Any], char_limit: int = 500) -> str:
    script = str(payload.get("script") or "")
    if len(script) <= char_limit:
        return script
    return script[:char_limit].rstrip() + "..."


def _matrix_payloads(matrix_dir_path: Path) -> Dict[str, Dict[str, Any]]:
    return {
        "v3_claude": _safe_read_json(matrix_dir_path / "v3_claude.json"),
        "v3_deepseek": _safe_read_json(matrix_dir_path / "v3_deepseek.json"),
        "v6_claude": _safe_read_json(matrix_dir_path / "v6_claude.json"),
        "v6_deepseek": _safe_read_json(matrix_dir_path / "v6_deepseek.json"),
    }


def _build_context_summary(context: Dict[str, Any], matrix_payloads: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    first_meta = {}
    for key in ("v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"):
        meta = _as_dict(_as_dict(matrix_payloads.get(key)).get("_meta"))
        if meta:
            first_meta = meta
            break
    return {
        "date": context.get("date"),
        "source_mode": first_meta.get("source_mode") or "unknown",
        "live_api_allowed": bool(first_meta.get("live_api_allowed", False)),
        "top_market_story": context.get("top_market_story"),
        "event_count": len(_as_list(context.get("top_events"))),
        "watchlist_count": len(_as_list(context.get("watchlist_rank"))),
    }


def _build_matrix_overview(matrix_payloads: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    order = [
        ("v3", "claude", "v3_claude"),
        ("v3", "deepseek", "v3_deepseek"),
        ("v6", "claude", "v6_claude"),
        ("v6", "deepseek", "v6_deepseek"),
    ]
    rows: List[Dict[str, Any]] = []
    for engine, renderer, key in order:
        payload = _as_dict(matrix_payloads.get(key))
        meta = _as_dict(payload.get("_meta"))
        warnings = _collect_row_warnings(payload)
        rows.append(
            {
                "engine": engine.upper(),
                "renderer": renderer.title(),
                "source_mode": meta.get("source_mode") or "unknown",
                "source": meta.get("source") or "unknown",
                "engine_path": meta.get("engine_path"),
                "safe_wiring": bool(meta.get("safe_wiring", False)),
                "live_api_allowed": bool(meta.get("live_api_allowed", False)),
                "live_api_call_attempted": bool(meta.get("live_api_call_attempted", False)),
                "sections": len(_as_list(payload.get("sections"))),
                "script_length": len(str(payload.get("script") or "")),
                "warnings": warnings,
                "variant": key,
            }
        )
    return rows


def _build_side_by_side(matrix_payloads: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    order = ["v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"]
    items: List[Dict[str, Any]] = []
    for key in order:
        payload = _as_dict(matrix_payloads.get(key))
        version = str(payload.get("engine_version") or key.split("_")[0]).lower()
        renderer = str(payload.get("renderer") or key.split("_")[1]).lower()
        items.append(
            {
                "variant": key,
                "engine": version.upper(),
                "renderer": renderer.title(),
                "title": str(payload.get("title") or ""),
                "top_section_headings": _first_n_section_headings(payload, limit=3),
                "script_preview": _script_preview(payload, char_limit=500),
                "warnings": _collect_row_warnings(payload),
            }
        )
    return items


def _build_comparator_notes(comparison: Dict[str, Any]) -> Dict[str, Any]:
    matrix_summary = _as_list(comparison.get("matrix_summary"))
    notes_by_variant: Dict[str, Any] = {}
    for row in matrix_summary:
        if not isinstance(row, dict):
            continue
        variant = str(row.get("variant") or "").strip().lower()
        scores = _as_dict(row.get("scores"))
        notes_by_variant[variant] = {
            "news_relevance": scores.get("news_relevance"),
            "market_reaction_clarity": scores.get("market_reaction_clarity"),
            "risk_explanation": scores.get("risk_explanation"),
            "subscriber_readability": scores.get("subscriber_readability"),
            "overcomplexity": scores.get("overcomplexity"),
            "hallucination_risk": scores.get("hallucination_risk"),
            "production_readiness": scores.get("production_readiness"),
        }
    return {
        "by_variant": notes_by_variant,
        "warnings": _as_list(comparison.get("warnings")),
        "review_queue": _as_list(comparison.get("recommended_for_review")),
    }


def _checklist_items() -> List[str]:
    return [
        "Does it identify the true top story?",
        "Does it explain why the market moved?",
        "Does it avoid generic index narration?",
        "Does it connect news + price reaction + risk context?",
        "Is it understandable to regular subscribers?",
        "Is it not too long?",
        "Does it avoid trading advice language?",
        "Would this be acceptable as the daily production briefing?",
    ]


def _build_review_pack_markdown(review_pack: Dict[str, Any]) -> str:
    context = _as_dict(review_pack.get("context_summary"))
    matrix_overview = _as_list(review_pack.get("matrix_overview"))
    side_by_side = _as_list(review_pack.get("side_by_side"))
    comparator = _as_dict(review_pack.get("comparator_notes"))
    by_variant = _as_dict(comparator.get("by_variant"))
    checklist = _as_list(review_pack.get("human_review_checklist"))
    decision = str(review_pack.get("decision_placeholder") or "")

    lines: List[str] = []
    lines.append("# Daily Briefing 2x2 Review Pack")
    lines.append("")
    lines.append("## 1. Context Summary")
    lines.append(f"- date: {context.get('date')}")
    lines.append(f"- source mode: {context.get('source_mode')}")
    lines.append(f"- live API allowed: {context.get('live_api_allowed')}")
    lines.append(f"- top market story: {context.get('top_market_story')}")
    lines.append(f"- number of events: {context.get('event_count')}")
    lines.append(f"- number of ranked watchlist items: {context.get('watchlist_count')}")
    lines.append("")
    lines.append("## 2. Matrix Overview")
    lines.append("")
    lines.append("| Engine | Renderer | Source Mode | Source | Engine Path | Safe Wiring | Live API Allowed | Live API Attempted | Sections | Script Length | Warnings |")
    lines.append("|---|---|---|---|---|---:|---:|---:|---:|---:|---|")
    for row in matrix_overview:
        if not isinstance(row, dict):
            continue
        warnings = ", ".join(_as_list(row.get("warnings"))) or "-"
        engine_path = str(row.get("engine_path") or "-")
        lines.append(
            f"| {row.get('engine')} | {row.get('renderer')} | {row.get('source_mode')} | "
            f"{row.get('source')} | {engine_path} | {row.get('safe_wiring')} | "
            f"{row.get('live_api_allowed')} | {row.get('live_api_call_attempted')} | "
            f"{row.get('sections', 0)} | {row.get('script_length', 0)} | {warnings} |"
        )

    lines.append("")
    lines.append("## 3. Side-by-Side Summary")
    lines.append("")
    for row in side_by_side:
        if not isinstance(row, dict):
            continue
        lines.append(f"### {_variant_label(str(row.get('engine') or ''), str(row.get('renderer') or ''))}")
        lines.append(f"- Title: {row.get('title')}")
        headings = _as_list(row.get("top_section_headings"))
        lines.append(f"- Top 3 section headings: {', '.join(str(item) for item in headings) if headings else '-'}")
        lines.append("- Script preview (first 500 chars):")
        lines.append("")
        lines.append("```text")
        lines.append(str(row.get("script_preview") or ""))
        lines.append("```")
        warnings = _as_list(row.get("warnings"))
        lines.append(f"- Warnings: {', '.join(str(item) for item in warnings) if warnings else '-'}")
        lines.append("")

    lines.append("## 4. Comparator Notes")
    lines.append("")
    for variant in ("v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"):
        scores = _as_dict(by_variant.get(variant))
        lines.append(f"### {variant}")
        lines.append(f"- news relevance: {scores.get('news_relevance')}")
        lines.append(f"- market reaction clarity: {scores.get('market_reaction_clarity')}")
        lines.append(f"- risk explanation: {scores.get('risk_explanation')}")
        lines.append(f"- subscriber readability: {scores.get('subscriber_readability')}")
        lines.append(f"- overcomplexity: {scores.get('overcomplexity')}")
        lines.append(f"- hallucination risk: {scores.get('hallucination_risk')}")
        lines.append(f"- production readiness: {scores.get('production_readiness')}")
        lines.append("")

    lines.append("## 5. Human Review Checklist")
    lines.append("")
    for item in checklist:
        lines.append(f"- [ ] {item}")
    lines.append("")

    lines.append("## 6. Decision Placeholder")
    lines.append("")
    lines.append(decision)
    lines.append("")
    return "\n".join(lines)


def generate_briefing_review_pack(
    matrix_dir: str = DEFAULT_MATRIX_DIR,
) -> dict:
    matrix_dir_path = _resolve_matrix_dir(matrix_dir)
    context = _safe_read_json(matrix_dir_path / "latest_context.json")
    comparison = _safe_read_json(matrix_dir_path / "comparison.json")
    matrix_payloads = _matrix_payloads(matrix_dir_path)

    context_summary = _build_context_summary(context=context, matrix_payloads=matrix_payloads)
    matrix_overview = _build_matrix_overview(matrix_payloads)
    side_by_side = _build_side_by_side(matrix_payloads)
    comparator_notes = _build_comparator_notes(comparison)
    checklist = _checklist_items()
    decision_text = "Final production selection is intentionally deferred until human review."

    review_pack = {
        "context_summary": context_summary,
        "matrix_overview": matrix_overview,
        "side_by_side": side_by_side,
        "comparator_notes": comparator_notes,
        "human_review_checklist": checklist,
        "decision_placeholder": decision_text,
        "_meta": {
            "source": "mcp_briefing_review_pack",
            "matrix_dir": str(matrix_dir_path),
            "generated_at": _utc_now_iso(),
            "production_selected": False,
            "required_inputs": [
                "latest_context.json",
                "v3_claude.json",
                "v3_deepseek.json",
                "v6_claude.json",
                "v6_deepseek.json",
                "comparison.json",
            ],
        },
    }
    review_pack = _sanitize_payload_v05(review_pack)
    _ensure_no_banned_language_v05(review_pack)

    review_pack_md = _build_review_pack_markdown(review_pack)
    review_pack_md = _sanitize_text_v05(review_pack_md)
    _ensure_no_banned_language_v05(review_pack_md)

    review_pack_json_path = matrix_dir_path / "review_pack.json"
    review_pack_md_path = matrix_dir_path / "review_pack.md"
    _write_json(review_pack_json_path, review_pack)
    _write_text(review_pack_md_path, review_pack_md)

    return {
        "review_pack": review_pack,
        "review_pack_json_path": str(review_pack_json_path),
        "review_pack_md_path": str(review_pack_md_path),
        "_meta": {
            "source": "mcp_briefing_review_pack_runner",
            "production_selected": False,
        },
    }


def main() -> int:
    result = generate_briefing_review_pack()
    print("MCP v0.5 briefing review pack generated.")
    print(f"JSON: {result.get('review_pack_json_path')}")
    print(f"Markdown: {result.get('review_pack_md_path')}")
    print("Production choice: not selected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
