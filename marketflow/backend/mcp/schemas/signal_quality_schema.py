"""
Typed schemas for MCP signal quality output.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class SignalQualityComponents:
    event_strength: float
    price_confirmation: float
    sector_confirmation: float
    volume_confirmation: float
    risk_engine_alignment: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "event_strength": self.event_strength,
            "price_confirmation": self.price_confirmation,
            "sector_confirmation": self.sector_confirmation,
            "volume_confirmation": self.volume_confirmation,
            "risk_engine_alignment": self.risk_engine_alignment,
        }


@dataclass
class SignalQualityOutput:
    quality_state: str
    score: float
    components: SignalQualityComponents
    interpretation: str
    warning: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quality_state": self.quality_state,
            "score": self.score,
            "components": self.components.to_dict(),
            "interpretation": self.interpretation,
            "warning": self.warning,
        }
