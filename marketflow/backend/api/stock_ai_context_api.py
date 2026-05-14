from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.stock_ai_context_builder import build_stock_ai_context


stock_ai_context_bp = Blueprint("stock_ai_context", __name__)


@stock_ai_context_bp.route("/api/stock-ai-context", methods=["GET"])
def get_stock_ai_context():
    ticker = str(request.args.get("ticker", "") or "").strip().upper()
    mode = str(request.args.get("mode", "near") or "near").strip().lower()
    if ":" in ticker:
        ticker = ticker.split(":")[-1]
    if not ticker:
        return jsonify({"error": "ticker query parameter is required"}), 400

    try:
        payload = build_stock_ai_context(ticker, mode=mode)
        return jsonify(payload), 200
    except Exception as exc:
        return jsonify(
            {
                "ticker": ticker,
                "valuation_summary": None,
                "financial_summary": None,
                "technical_summary": None,
                "options_summary": None,
                "peer_summary": None,
                "ai_research_context": {
                    "one_line_context": "",
                    "key_questions": [],
                    "risk_flags": [],
                    "data_quality": "limited",
                },
                "missing_data_warnings": [f"stock_ai_context_failed: {exc}"],
            }
        ), 200
