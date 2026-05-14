"""
MCP Tool 3: Signal Quality
"""
from __future__ import annotations

from typing import Any, Dict, Tuple

from mcp.schemas.signal_quality_schema import SignalQualityComponents, SignalQualityOutput
from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload
from mcp.services.data_router import clamp01, normalize_symbol
from mcp.services.market_snapshot_adapter import (
    get_risk_context,
    get_sector_confirmation,
    get_symbol_price_context,
    get_volume_confirmation,
)


def _component_or_default(event: Dict[str, Any], key: str, default: float) -> float:
    if key in event:
        return clamp01(event.get(key), default=default)
    return default


def _resolve_components(
    symbol: str,
    event: Dict[str, Any],
    price_context: bool,
    sector_context: bool,
    risk_context: bool,
) -> Tuple[SignalQualityComponents, Dict[str, Any]]:
    event_strength = _component_or_default(event, "event_strength", default=0.45)

    price_component = _component_or_default(event, "price_confirmation", default=0.50)
    price_ctx: Dict[str, Any] = {"_meta": {"source": "fallback", "loaded_files": [], "missing_files": []}}
    if "price_confirmation" not in event and price_context:
        price_ctx = get_symbol_price_context(symbol)
        price_component = clamp01(price_ctx.get("confirmation_score"), default=0.50)

    sector_component = _component_or_default(event, "sector_confirmation", default=0.50)
    sector_ctx: Dict[str, Any] = {"_meta": {"source": "fallback", "loaded_files": [], "missing_files": []}}
    if "sector_confirmation" not in event and sector_context:
        sector_ctx = get_sector_confirmation(symbol)
        sector_component = clamp01(sector_ctx.get("score"), default=0.50)

    volume_component = _component_or_default(event, "volume_confirmation", default=0.50)
    volume_ctx: Dict[str, Any] = {"_meta": {"source": "fallback", "loaded_files": [], "missing_files": []}}
    if "volume_confirmation" not in event:
        volume_ctx = get_volume_confirmation(symbol)
        volume_component = clamp01(volume_ctx.get("score"), default=0.50)

    risk_component = _component_or_default(event, "risk_engine_alignment", default=0.50)
    risk_ctx: Dict[str, Any] = {"_meta": {"source": "fallback", "loaded_files": [], "missing_files": []}}
    if "risk_engine_alignment" not in event and risk_context:
        risk_ctx = get_risk_context()
        risk_component = clamp01(risk_ctx.get("alignment_score"), default=0.50)

    components = SignalQualityComponents(
        event_strength=round(event_strength, 3),
        price_confirmation=round(price_component, 3),
        sector_confirmation=round(sector_component, 3),
        volume_confirmation=round(volume_component, 3),
        risk_engine_alignment=round(risk_component, 3),
    )
    meta = {
        "price": price_ctx.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
        "sector": sector_ctx.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
        "volume": volume_ctx.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
        "risk": risk_ctx.get("_meta", {"source": "fallback", "loaded_files": [], "missing_files": []}),
    }
    return components, meta


def _state_from_components(components: SignalQualityComponents, event: Dict[str, Any]) -> str:
    if bool(event.get("force_conflict")):
        return "conflict"
    if components.event_strength >= 0.75 and components.price_confirmation < 0.35:
        return "conflict"
    if components.event_strength >= 0.70 and components.risk_engine_alignment < 0.30:
        return "conflict"
    weighted = (
        0.30 * components.event_strength
        + 0.20 * components.price_confirmation
        + 0.20 * components.sector_confirmation
        + 0.15 * components.volume_confirmation
        + 0.15 * components.risk_engine_alignment
    )
    if weighted >= 0.78:
        return "strong_confirmation"
    if weighted >= 0.62:
        return "weak_confirmation"
    if weighted < 0.32 and components.event_strength < 0.35:
        return "noise"
    return "unclear"


def _interpretation_for_state(state: str) -> str:
    if state == "strong_confirmation":
        return "Attention Level is elevated with broad confirmation across event, price, and context engines."
    if state == "weak_confirmation":
        return "Confirmation is present but partial; keep the watch zone active for follow-through quality."
    if state == "conflict":
        return "Conflict is active between event narrative and confirmation engines; prioritize risk pressure awareness."
    if state == "noise":
        return "Signal profile is mostly noise; confirmation quality is currently limited."
    return "Signal state remains unclear; wait for additional confirmation or conflict resolution."


def _warning_for_state(state: str) -> str:
    if state == "strong_confirmation":
        return "Low warning: continue confirmation tracking as context evolves."
    if state == "weak_confirmation":
        return "Moderate warning: avoid overconfidence while confirmation breadth remains partial."
    if state == "conflict":
        return "High warning: conflict pressure is elevated and scenario paths can diverge quickly."
    if state == "noise":
        return "Watch warning: noise regime detected with low interpretation reliability."
    return "Caution warning: clarity is limited and requires fresh context."


def evaluate_signal_quality(
    symbol: str,
    event: dict,
    price_context: bool = True,
    sector_context: bool = True,
    risk_context: bool = True,
) -> dict:
    symbol = normalize_symbol(symbol)
    event = event or {}

    components, component_meta = _resolve_components(
        symbol=symbol,
        event=event,
        price_context=price_context,
        sector_context=sector_context,
        risk_context=risk_context,
    )
    score = (
        0.30 * components.event_strength
        + 0.20 * components.price_confirmation
        + 0.20 * components.sector_confirmation
        + 0.15 * components.volume_confirmation
        + 0.15 * components.risk_engine_alignment
    )
    quality_state = _state_from_components(components=components, event=event)
    payload = SignalQualityOutput(
        quality_state=quality_state,
        score=round(score, 3),
        components=components,
        interpretation=_interpretation_for_state(quality_state),
        warning=_warning_for_state(quality_state),
    ).to_dict()
    sources = [str(row.get("source", "fallback")) for row in component_meta.values() if isinstance(row, dict)]
    payload["_meta"] = {
        "source": "cache" if "cache" in sources else "fallback",
        "components": component_meta,
    }

    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
