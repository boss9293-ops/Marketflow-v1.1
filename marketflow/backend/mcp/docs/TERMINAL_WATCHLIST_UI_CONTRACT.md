# Terminal & Watchlist UI Contract

## Purpose
This document defines the stable JSON contract for future read-only UI integration of:

- `terminal_event_feed_context`
- `watchlist_news_context`

The MCP layer remains backend-only in v0.8. No production UI wiring is selected here, and no live LLM API calls are allowed.

## Terminal Event Feed Context
Top-level shape:

```json
{
  "date": "YYYY-MM-DD",
  "mode": "terminal",
  "top_events": [],
  "market_context": {},
  "risk_context": {},
  "_meta": {
    "source": "cache",
    "live_api_call_attempted": false
  }
}
```

Required top-level fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `date` | string | yes | ISO date string preferred. |
| `mode` | string | yes | Expected value: `terminal`. |
| `top_events` | array | yes | Stable list; may be empty only if fallback generation changes later. |
| `market_context` | object | yes | Compact index/ETF/mega-cap/sector context. |
| `risk_context` | object | yes | Compact risk state context. |
| `_meta` | object | yes | Must include `source` and `live_api_call_attempted`. |

Terminal event item:

```json
{
  "rank": 1,
  "symbol": "NVDA",
  "event_type": "news",
  "headline": "Headline text",
  "event_strength": 0.72,
  "price_confirmation": "confirmed",
  "risk_context": "Risk Pressure medium; phase UNKNOWN.",
  "why_it_matters": "Interpretation text",
  "terminal_line": "NVDA: Attention Level Elevated | Confirmation confirmed | Risk Pressure medium"
}
```

Required item fields:

| Field | Type | Required | Allowed values |
|---|---|---:|---|
| `rank` | number | yes | 1-based display order. |
| `symbol` | string | yes | Uppercase ticker or `MARKET`. |
| `event_type` | string | yes | `news`, `price_move`, `sector_move`, `risk_signal`; UI should tolerate unknown strings. |
| `headline` | string | yes | Display headline. |
| `event_strength` | number | yes | Range: `0.0` to `1.0`. |
| `price_confirmation` | string | yes | `confirmed`, `weak`, `conflict`, `unclear`. |
| `risk_context` | string | yes | Short interpretation text. |
| `why_it_matters` | string | yes | Explanation for display expansion. |
| `terminal_line` | string | yes | Compact one-line display text. |

Optional terminal fields:

- Additional `_meta` fields may be present.
- `market_context` subsections may include `indices`, `etfs`, `mega_caps`, and `sectors`.
- `risk_context` may include `risk_label`, `phase`, `shock_probability`, `risk_pressure`, and `alignment_score`.

## Watchlist News Context
Top-level shape:

```json
{
  "mode": "watchlist",
  "ranked_watchlist_news": [],
  "_meta": {
    "source": "cache",
    "live_api_call_attempted": false
  }
}
```

Required top-level fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `mode` | string | yes | Expected value: `watchlist`. |
| `ranked_watchlist_news` | array | yes | Stable list; can be empty for empty input. |
| `_meta` | object | yes | Must include `source` and `live_api_call_attempted`. |

Watchlist news item:

```json
{
  "symbol": "TSLA",
  "attention_score": 74,
  "main_event": "Main event text",
  "related_events": [],
  "risk_pressure": "medium",
  "signal_quality": "weak_confirmation",
  "watchlist_line": "TSLA: Attention Level Elevated; Signal quality is weak confirmation; Risk Pressure medium."
}
```

Required item fields:

| Field | Type | Required | Allowed values |
|---|---|---:|---|
| `symbol` | string | yes | Uppercase ticker. |
| `attention_score` | number | yes | Integer-like score from `0` to `100`. |
| `main_event` | string | yes | Primary context line. |
| `related_events` | array | yes | List of supporting event strings. |
| `risk_pressure` | string | yes | `low`, `medium`, `high`, `unclear`. |
| `signal_quality` | string | yes | `strong_confirmation`, `weak_confirmation`, `conflict`, `noise`, `unclear`. |
| `watchlist_line` | string | yes | Compact one-line display text. |

Optional watchlist fields:

- Additional `_meta` fields may be present.
- `related_events` can be an empty array when event detail is unavailable.

## Fallback Behavior
- Missing cache must not crash the MCP tools.
- Missing data must return stable top-level objects and stable list fields.
- `_meta.source` must be either `cache` or `fallback`.
- `_meta.live_api_call_attempted` must remain `false`.
- UI should treat `fallback` as valid context with lower confidence, not as an error state.

## Language Guardrail
The UI must treat MCP output as interpretation context only. It must not present action instructions or direct trade wording.

Banned emitted terms:

- `Buy`
- `Sell`
- `Entry`
- `Exit`
- `Target Price`
- `Strong Buy`
- `Trade Setup`
- `Recommendation`

Preferred display vocabulary:

- `Attention Level`
- `Risk Pressure`
- `Confirmation`
- `Conflict`
- `Watch Zone`
- `Reference Level`
- `Scenario`
- `Interpretation`

## Frontend Display Rules
- Render `terminal_line` and `watchlist_line` as compact summaries.
- Use `headline`, `main_event`, `why_it_matters`, and `related_events` for expanded detail views.
- Preserve exact enum values in data models; map labels at the UI layer if needed.
- Clamp visual progress bars to the documented score ranges.
- Show `_meta.source` only in debug surfaces, not primary subscriber-facing copy.
- Do not infer production status from this contract. v0.8 is contract validation only.

## v0.9 Read-only UI Wiring
v0.9 adds a development-only read-only preview surface. It does not replace the production Terminal, Watchlist, Dashboard, Semiconductor, or Daily Briefing UI.

Reader path:

- `frontend/src/lib/mcp/terminalWatchlistReader.ts`

Preview component path:

- `frontend/src/components/mcp/McpTerminalWatchlistPreview.tsx`

Internal route path:

- `frontend/src/app/dev/mcp-terminal-watchlist/page.tsx`
- URL: `/dev/mcp-terminal-watchlist`

Data source:

- `GET /api/mcp/terminal-event-feed-context`
- `GET /api/mcp/watchlist-news-context`
- Browser clients use the existing `clientApiUrl()` backend routing helper.

Fallback behavior:

- Reader functions normalize missing fields into frontend-safe objects.
- Failed endpoint fetches return local fallback context from `frontend/src/lib/mcp/terminalWatchlistContract.ts`.
- The preview shows `MCP context is not available yet.` when fallback data is active.
- UI rendering must not crash on missing endpoint, missing cache, or malformed response.

Production replacement status:

- `false`

Safety status:

- No live LLM API call is made by the reader or preview component.
- No Daily Briefing production version is selected.
- No visible production Terminal or Watchlist component is removed or replaced.

## Validation
Run:

```bash
python marketflow/backend/mcp/tests/validate_terminal_watchlist_contract.py
```

The validator checks required keys, enum values, score ranges, language guardrails, and `live_api_call_attempted=false`.
