"""
Phase 2 placeholder: sector peer context.
"""
from __future__ import annotations

from typing import Any, Dict

from mcp.services.ai_interpretation_adapter import ensure_no_banned_language, sanitize_payload
from mcp.services.data_router import normalize_symbol


def build_sector_peer_context(symbol: str = "") -> Dict[str, Any]:
    symbol = normalize_symbol(symbol) or "UNKNOWN"
    payload = {
        "symbol": symbol,
        "status": "placeholder",
        "peer_context": [],
        "summary": "Sector peer context adapter is not connected yet.",
        "todo": "TODO: integrate sector baskets and peer-relative confirmation metrics.",
    }
    # TODO: add live sector-basket and peer attribution adapter integration.
    payload = sanitize_payload(payload)
    ensure_no_banned_language(payload)
    return payload
