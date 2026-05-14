"""
Typed schemas for MCP watchlist ranking output.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class RankedWatchlistItem:
    symbol: str
    attention_score: int
    main_reason: str
    risk_pressure: str
    engine_conflict: bool
    briefing_line: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "attention_score": self.attention_score,
            "main_reason": self.main_reason,
            "risk_pressure": self.risk_pressure,
            "engine_conflict": self.engine_conflict,
            "briefing_line": self.briefing_line,
        }


@dataclass
class WatchlistRankOutput:
    ranked_items: List[RankedWatchlistItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ranked_items": [item.to_dict() for item in self.ranked_items],
        }
