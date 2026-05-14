# MarketFlow MCP Layer v0.7

## Purpose
MarketFlow MCP is a backend-only interpretation/context layer.  
It is not a trading signal engine and does not emit action instructions.

## Phase Scope
Implemented tools (Phase 1):
1. `event_timeline.build_event_timeline`
2. `watchlist_ranker.rank_watchlist`
3. `signal_quality.evaluate_signal_quality`
4. `daily_briefing_context.build_daily_briefing_context`

Implemented tools (v0.7 context outputs):
1. `terminal_event_feed_context.build_terminal_event_feed_context`
2. `watchlist_news_context.build_watchlist_news_context`

Placeholder tools (Phase 2/3 stubs):
1. `sector_peer_context.build_sector_peer_context`
2. `options_pressure.build_options_pressure`
3. `portfolio_interpreter.interpret_portfolio_risk`

## v0.2 Cache-Aware Behavior
- Adapters read existing backend artifacts first (cache-first).
- Primary cache root: `backend/output/cache/`.
- Additional output artifacts are read when available (for example pipeline and risk outputs).
- Tools never crash on missing cache; deterministic fallback payloads are returned.
- Every Phase 1 tool now includes `_meta` with:
  - `source`: `cache` or `fallback`
  - adapter-level loaded/missing file context where relevant

## Language and Policy Guardrails
- No FinStack installation/imports.
- Interpretation vocabulary only:
  - Attention Level
  - Risk Pressure
  - Confirmation
  - Conflict
  - Watch Zone
  - Reference Level
  - Scenario

Banned output terms:
- `Buy`
- `Sell`
- `Entry`
- `Exit`
- `Target Price`
- `Strong Buy`
- `Trade Setup`
- `Recommendation`

All tool outputs pass through sanitizer and banned-language guardrails.

## Flask Debug Endpoints
Registered via `marketflow_mcp_server.py`:
- `GET|POST /api/mcp/event-timeline`
- `GET|POST /api/mcp/watchlist-ranker`
- `GET|POST /api/mcp/signal-quality`
- `GET|POST /api/mcp/daily-briefing-context`
- `GET|POST /api/mcp/terminal-event-feed-context`
- `GET|POST /api/mcp/watchlist-news-context`

## Local Smoke Runner (No pytest)
Run:

`python marketflow/backend/mcp/tests/run_mcp_smoke.py`

Smoke covers:
- direct tool output shape + `_meta`
- Daily Briefing 2x2 matrix adapter/comparator shape checks
- Terminal/Watchlist context tools + output runner checks
- Terminal/Watchlist UI contract validation
- GET/POST debug route responses
- missing-cache fallback safety
- banned language guardrails

## Terminal & Watchlist Context
Run:

`python marketflow/backend/mcp/terminal_watchlist_context_runner.py`

Outputs:

`backend/output/mcp/terminal_watchlist/`

Generated files:
- `terminal_event_feed_context.json`
- `watchlist_news_context.json`
- `terminal_watchlist_summary.md`

Validate the UI contract:

`python marketflow/backend/mcp/tests/validate_terminal_watchlist_contract.py`

Contract docs:
- `backend/mcp/docs/TERMINAL_WATCHLIST_UI_CONTRACT.md`

Frontend type contract:
- `frontend/src/lib/mcp/terminalWatchlistContract.ts`

Read-only preview wiring (v0.9):
- Reader: `frontend/src/lib/mcp/terminalWatchlistReader.ts`
- Component: `frontend/src/components/mcp/McpTerminalWatchlistPreview.tsx`
- Internal route: `/dev/mcp-terminal-watchlist`
- Production replacement status: `false`

## Daily Briefing 2x2 Test Matrix (v0.6)
Test-only matrix combinations:
- `V3 + Claude`
- `V3 + DeepSeek`
- `V6 + Claude`
- `V6 + DeepSeek`

Run:

`python marketflow/backend/mcp/briefing/briefing_test_runner.py --source-mode placeholder`

`python marketflow/backend/mcp/briefing/briefing_test_runner.py --source-mode existing_engine_safe`

Then generate a review-friendly report pack:

`python marketflow/backend/mcp/briefing/briefing_review_pack.py`

Output folder:

`backend/output/mcp/briefing_matrix/`

Generated files:
- `latest_context.json`
- `v3_claude.json`
- `v3_deepseek.json`
- `v6_claude.json`
- `v6_deepseek.json`
- `comparison.json`
- `comparison.md`
- `review_pack.json`
- `review_pack.md`

Important:
- v0.7 does not select a final production briefing version.
- Matrix output is for human review ordering only.

Terminal/Watchlist note:
- v0.7 remains backend-only context output with no UI wiring.
- No live LLM API call is made by default.
- No production Daily Briefing selection is made in this phase.

## v0.4 Safe Wiring Policy
- `briefing_matrix_adapter` supports `source_mode`:
  - `placeholder` (default, offline)
  - `existing_engine_safe` (cache-read only)
  - `disabled`
- Live briefing API calls are blocked by default:
  - `MARKETFLOW_MCP_ALLOW_LIVE_BRIEFING_CALLS=false`
- Adapter emits guard metadata:
  - `_meta.source_mode`
  - `_meta.live_api_allowed`
  - `_meta.live_api_call_attempted`

## Discovery and Wiring Docs
- `backend/mcp/docs/DAILY_BRIEFING_ENGINE_DISCOVERY.md`
- `backend/mcp/docs/DAILY_BRIEFING_MATRIX_WIRING_PLAN.md`
- `backend/mcp/docs/DAILY_BRIEFING_MATRIX_PLAN.md`

## Future Integration Points
- richer event NLP weighting and classification
- deeper intraday sequencing in timelines
- live options pressure adapter
- portfolio factor/risk interpretation adapter
