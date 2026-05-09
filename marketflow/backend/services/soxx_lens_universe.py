from __future__ import annotations

import json
from pathlib import Path
from typing import Any


SOXX_LENS_BENCHMARK_TICKER = "SOXX"
SOXX_PRICE_SYMBOL_MAP: dict[str, str] = {
    "SOXX": "SOXX",
    "ASML": "ASML",
    "TSM": "TSM",
}


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def default_soxx_holdings_path() -> Path:
    return _backend_dir() / "data" / "semiconductor" / "soxx_holdings_snapshot.json"


def load_soxx_holdings_payload(path: Path | None = None) -> dict[str, Any]:
    payload_path = path or default_soxx_holdings_path()
    if not payload_path.exists():
        return {}
    try:
        return json.loads(payload_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_soxx_lens_tickers(path: Path | None = None) -> list[str]:
    """
    Return SOXX + all current SOXX holdings tickers from the official snapshot.
    """
    payload = load_soxx_holdings_payload(path)
    holdings = payload.get("holdings")
    if not isinstance(holdings, list):
        return [SOXX_LENS_BENCHMARK_TICKER]

    tickers: list[str] = []
    for row in holdings:
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker") or "").strip().upper()
        if ticker:
            tickers.append(ticker)

    return sorted({SOXX_LENS_BENCHMARK_TICKER, *tickers})


def map_soxx_provider_symbol(ticker: str) -> str:
    normalized = ticker.strip().upper()
    return SOXX_PRICE_SYMBOL_MAP.get(normalized, normalized)
