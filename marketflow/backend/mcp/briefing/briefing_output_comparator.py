"""
MCP v0.3 briefing output comparator for 2x2 matrix review.
"""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Tuple

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _combined_text(output: Dict[str, Any]) -> str:
    texts: List[str] = []
    texts.append(str(output.get("title") or ""))
    texts.append(str(output.get("script") or ""))
    for section in _as_list(output.get("sections")):
        if isinstance(section, dict):
            texts.append(str(section.get("heading") or ""))
            texts.append(str(section.get("content") or ""))
        elif isinstance(section, str):
            texts.append(section)
    return " ".join(part for part in texts if part).strip()


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", str(text or "").lower())


def _clamp_1_5(value: float) -> int:
    return int(max(1, min(5, round(value))))


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", str(text or "")))


def _sentence_count(text: str) -> int:
    rows = re.split(r"[.!?\n]+", str(text or ""))
    return len([row for row in rows if row.strip()])


def _ticker_candidates(text: str) -> List[str]:
    return re.findall(r"\b[A-Z]{2,5}\b", str(text or ""))


def _score_news_relevance(output: Dict[str, Any], text: str) -> int:
    digest = _as_dict(_as_dict(output.get("_meta")).get("context_digest"))
    story = str(digest.get("top_market_story") or "")
    if not story:
        return 3
    story_tokens = set(_tokenize(story))
    text_tokens = set(_tokenize(text))
    if not story_tokens:
        return 3
    overlap = len(story_tokens.intersection(text_tokens)) / max(1, len(story_tokens))
    return _clamp_1_5(1 + 4 * overlap)


def _score_market_reaction_clarity(text: str) -> int:
    markers = ("up", "down", "flat", "volatility", "momentum", "confirmation", "conflict")
    marker_hits = sum(1 for marker in markers if marker in text.lower())
    has_numbers = bool(re.search(r"\d+(\.\d+)?%?", text))
    base = 2.0 + min(2.0, marker_hits * 0.6) + (0.5 if has_numbers else 0.0)
    return _clamp_1_5(base)


def _score_risk_explanation(text: str) -> int:
    risk_terms = ("risk pressure", "risk", "conflict", "watch zone", "scenario", "caution", "shock")
    hits = sum(1 for marker in risk_terms if marker in text.lower())
    return _clamp_1_5(1.5 + min(3.0, hits * 0.7))


def _score_readability(text: str) -> int:
    words = _word_count(text)
    sentences = max(1, _sentence_count(text))
    avg_len = words / sentences
    if words <= 280 and avg_len <= 22:
        return 5
    if words <= 380 and avg_len <= 27:
        return 4
    if words <= 500 and avg_len <= 32:
        return 3
    if words <= 650 and avg_len <= 38:
        return 2
    return 1


def _score_overcomplexity(text: str) -> int:
    words = _word_count(text)
    sentences = max(1, _sentence_count(text))
    avg_len = words / sentences
    if words > 650 or avg_len > 38:
        return 5
    if words > 500 or avg_len > 32:
        return 4
    if words > 380 or avg_len > 27:
        return 3
    if words > 280 or avg_len > 22:
        return 2
    return 1


def _score_hallucination_risk(output: Dict[str, Any], text: str) -> int:
    digest = _as_dict(_as_dict(output.get("_meta")).get("context_digest"))
    expected_symbols = {
        str(item or "").strip().upper()
        for item in _as_list(digest.get("watchlist_symbols"))
        if str(item or "").strip()
    }
    symbols = [item for item in _ticker_candidates(text) if item not in {"AI", "ETF"}]
    unknown = [item for item in symbols if expected_symbols and item not in expected_symbols]
    ratio = len(unknown) / max(1, len(symbols)) if symbols else 0.0
    return _clamp_1_5(1 + 4 * ratio)


def _score_production_readiness(scores: Dict[str, int]) -> int:
    positive = (
        scores["news_relevance"]
        + scores["market_reaction_clarity"]
        + scores["risk_explanation"]
        + scores["subscriber_readability"]
    ) / 4.0
    penalty = (scores["overcomplexity"] + scores["hallucination_risk"]) / 2.0
    combined = positive - 0.55 * max(0.0, penalty - 2.0)
    return _clamp_1_5(combined)


def _variant_id(output: Dict[str, Any]) -> str:
    version = str(output.get("engine_version") or "unknown").lower()
    renderer = str(output.get("renderer") or "unknown").lower()
    return f"{version}_{renderer}"


def _entry_from_output(output: Dict[str, Any]) -> Dict[str, Any]:
    text = _combined_text(output)
    scores = {
        "news_relevance": _score_news_relevance(output, text),
        "market_reaction_clarity": _score_market_reaction_clarity(text),
        "risk_explanation": _score_risk_explanation(text),
        "subscriber_readability": _score_readability(text),
        "overcomplexity": _score_overcomplexity(text),
        "hallucination_risk": _score_hallucination_risk(output, text),
    }
    scores["production_readiness"] = _score_production_readiness(scores)
    review_score = round(
        (
            1.3 * scores["news_relevance"]
            + 1.2 * scores["market_reaction_clarity"]
            + 1.2 * scores["risk_explanation"]
            + 1.0 * scores["subscriber_readability"]
            - 0.8 * scores["overcomplexity"]
            - 1.0 * scores["hallucination_risk"]
        ),
        3,
    )
    return {
        "variant": _variant_id(output),
        "engine_version": str(output.get("engine_version") or ""),
        "renderer": str(output.get("renderer") or ""),
        "scores": scores,
        "review_score": review_score,
        "review_note": "Review candidate only. Final production choice remains pending.",
    }


def _recommend_for_review(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sorted_entries = sorted(entries, key=lambda item: (-float(item.get("review_score", 0.0)), item.get("variant", "")))
    picked = sorted_entries[:2]
    out: List[Dict[str, Any]] = []
    for row in picked:
        out.append(
            {
                "variant": row.get("variant"),
                "engine_version": row.get("engine_version"),
                "renderer": row.get("renderer"),
                "review_score": row.get("review_score"),
                "reason": "Balanced interpretation quality for human review queue.",
            }
        )
    return out


def compare_briefing_outputs(outputs: list[dict]) -> dict:
    """
    Compare 2x2 briefing outputs and provide human-review ordering only.
    No final production selection is made in this function.
    """
    normalized_outputs = [row for row in _as_list(outputs) if isinstance(row, dict)]
    matrix_summary = [_entry_from_output(item) for item in normalized_outputs]
    warnings: List[str] = []

    required_variants = {"v3_claude", "v3_deepseek", "v6_claude", "v6_deepseek"}
    present_variants = {str(item.get("variant") or "") for item in matrix_summary}
    missing = sorted(required_variants - present_variants)
    if missing:
        warnings.append(f"Some matrix variants are missing: {', '.join(missing)}")

    warnings.append("This harness does not make a final production choice.")
    warnings.append("Comparator scores are heuristic and require human review.")

    output = {
        "matrix_summary": matrix_summary,
        "recommended_for_review": _recommend_for_review(matrix_summary),
        "warnings": warnings,
        "_meta": {
            "source": "mcp_briefing_output_comparator",
            "output_count": len(matrix_summary),
            "production_selected": False,
            "generated_at": _utc_now_iso(),
        },
    }
    output = sanitize_payload(output)
    ensure_no_banned_language(output)
    return output


def render_comparison_markdown(outputs: list[dict], comparison: dict) -> str:
    """
    Render a concise markdown summary for matrix review.
    """
    _ = outputs  # reserved for future richer markdown output
    comp = _as_dict(comparison)
    matrix = _as_list(comp.get("matrix_summary"))
    recs = _as_list(comp.get("recommended_for_review"))
    warnings = _as_list(comp.get("warnings"))

    lines: List[str] = []
    lines.append("# Daily Briefing 2x2 Matrix Review")
    lines.append("")
    lines.append("## Matrix Scores")
    lines.append("| Variant | News | Reaction | Risk | Readability | Overcomplexity | Hallucination | Production Readiness | Review Score |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for item in matrix:
        if not isinstance(item, dict):
            continue
        scores = _as_dict(item.get("scores"))
        lines.append(
            "| "
            f"{item.get('variant', '')} | "
            f"{scores.get('news_relevance', '')} | "
            f"{scores.get('market_reaction_clarity', '')} | "
            f"{scores.get('risk_explanation', '')} | "
            f"{scores.get('subscriber_readability', '')} | "
            f"{scores.get('overcomplexity', '')} | "
            f"{scores.get('hallucination_risk', '')} | "
            f"{scores.get('production_readiness', '')} | "
            f"{item.get('review_score', '')} |"
        )

    lines.append("")
    lines.append("## Review Queue")
    for row in recs:
        if not isinstance(row, dict):
            continue
        lines.append(
            f"- `{row.get('variant', '')}` score={row.get('review_score', '')}: "
            f"{row.get('reason', '')}"
        )
    if not recs:
        lines.append("- No review candidates were produced.")

    lines.append("")
    lines.append("## Warnings")
    for warning in warnings:
        lines.append(f"- {warning}")

    lines.append("")
    lines.append("## Note")
    lines.append("- Final production choice is intentionally not selected in v0.3.")
    return "\n".join(lines).strip() + "\n"

