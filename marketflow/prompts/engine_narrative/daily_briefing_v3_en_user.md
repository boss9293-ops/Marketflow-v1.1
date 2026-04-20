---
type: auto
page: briefing_en
version: v1.1
created: 2026-04-19
updated: 2026-04-19
author: system
status: active
lang: [en]
---

DATA DATE: {data_date}

MANDATORY NARRATIVE DRIVERS:
{mandatory_drivers}

LIVE HEADLINE TAPE (prioritized):
{headline_tape}

WATCHLIST FOCUS:
{watchlist_focus}

EVENT CARDS (Layer 1-2, scored evidence pack):
{event_cards_json}

NARRATIVE PLAN (Layer 3-4, storyline spine):
{narrative_plan_json}

SECTION 1 - THE BATTLEGROUND
{market_flow}

SECTION 2 - LIVE TRIGGERS & TRANSMISSION
{event_drivers}

SECTION 3 - MONEY VELOCITY & ROTATION
{sector_structure}

SECTION 4 - MACRO TREMORS
{macro_commodities}

SECTION 5 - THE HOTZONES
{stock_moves}

SECTION 6 - NEXT 24H RADAR
{economic_data}

SECTION 7 - SYSTEM DEFCON
{technical_regime}

Generate a JSON object with ONLY English fields:
{
  "hook": "short headline",
  "one_line": "dense one-line market summary",
  "sections": {
    "market_flow": {"structural": "...", "implication": "...", "signal": "..."},
    "event_drivers": {"structural": "...", "implication": "...", "signal": "..."},
    "sector_structure": {"structural": "...", "implication": "...", "signal": "..."},
    "macro_commodities": {"structural": "...", "implication": "...", "signal": "..."},
    "stock_moves": {"structural": "...", "implication": "...", "signal": "..."},
    "economic_data": {"structural": "...", "implication": "...", "signal": "..."},
    "technical_regime": {"structural": "...", "implication": "...", "signal": "..."}
  }
}
