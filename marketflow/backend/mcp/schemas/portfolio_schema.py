"""
Typed placeholder schema for portfolio interpretation output (Phase 3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class PortfolioInterpretationPlaceholder:
    portfolio_id: str
    status: str
    risk_pressure: str
    confirmation: str
    scenarios: List[str] = field(default_factory=list)
    todo: str = "TODO: connect holdings exposure maps and factor-risk interpretation."

    def to_dict(self) -> Dict[str, Any]:
        return {
            "portfolio_id": self.portfolio_id,
            "status": self.status,
            "risk_pressure": self.risk_pressure,
            "confirmation": self.confirmation,
            "scenarios": self.scenarios,
            "todo": self.todo,
        }
