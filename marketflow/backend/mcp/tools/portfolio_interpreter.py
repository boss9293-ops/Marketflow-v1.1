"""
Phase 3 placeholder: portfolio risk interpretation.
"""
from __future__ import annotations

from typing import Any, Dict

from mcp.schemas.portfolio_schema import PortfolioInterpretationPlaceholder
from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload


def interpret_portfolio_risk(portfolio_id: str = "default") -> Dict[str, Any]:
    payload = PortfolioInterpretationPlaceholder(
        portfolio_id=str(portfolio_id or "default"),
        status="placeholder",
        risk_pressure="medium",
        confirmation="Portfolio interpretation adapter is pending integration.",
        scenarios=[
            "Scenario A: broad market confirmation remains stable.",
            "Scenario B: risk pressure rises and concentration conflict appears.",
        ],
    ).to_dict()
    # TODO: integrate holdings exposures, factor concentrations, and regime-aware risk interpretation.
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
