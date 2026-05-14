"""
Typed schemas for MCP event timeline output.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class TimelineEvent:
    event_date: str
    event_type: str
    headline: str
    source: str
    event_strength: float
    attention_level: str
    confirmation: str
    conflict: str
    watch_zone: str
    reference_level: str
    scenario: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_date": self.event_date,
            "event_type": self.event_type,
            "headline": self.headline,
            "source": self.source,
            "event_strength": self.event_strength,
            "attention_level": self.attention_level,
            "confirmation": self.confirmation,
            "conflict": self.conflict,
            "watch_zone": self.watch_zone,
            "reference_level": self.reference_level,
            "scenario": self.scenario,
        }


@dataclass
class TimelineSummary:
    top_driver: str
    price_confirmation: str
    risk_engine_agreement: str
    beginner_explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "top_driver": self.top_driver,
            "price_confirmation": self.price_confirmation,
            "risk_engine_agreement": self.risk_engine_agreement,
            "beginner_explanation": self.beginner_explanation,
        }


@dataclass
class EventTimelineOutput:
    symbol: str
    lookback_days: int
    timeline: List[TimelineEvent] = field(default_factory=list)
    summary: TimelineSummary = field(default_factory=lambda: TimelineSummary("", "", "", ""))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "lookback_days": self.lookback_days,
            "timeline": [item.to_dict() for item in self.timeline],
            "summary": self.summary.to_dict(),
        }
