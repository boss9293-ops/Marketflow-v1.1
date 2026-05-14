"""
Options pressure adapter placeholder (Phase 2).
"""
from __future__ import annotations

from typing import Any, Dict

from mcp.schemas.options_schema import OptionsPressurePlaceholder
from mcp.services.data_router import normalize_symbol


def build_options_pressure_placeholder(symbol: str) -> Dict[str, Any]:
    normalized = normalize_symbol(symbol) or "UNKNOWN"
    payload = OptionsPressurePlaceholder(
        symbol=normalized,
        status="placeholder",
        pressure_summary="Options pressure adapter is not connected yet for this symbol.",
        watch_zones=["TODO: add gamma concentration zones", "TODO: add open-interest pressure bands"],
    )
    # TODO: wire this function to live options chain snapshots and flow-derived pressure metrics.
    return payload.to_dict()
