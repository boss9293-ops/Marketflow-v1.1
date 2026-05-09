# SOXX/SOXL Lens Data Refresh Automation Plan

## Phase DS-6

## Purpose

Define a lightweight, observable, and reversible refresh workflow for SOXX/SOXL Lens data.

## Product Rule

Refresh automation must be observable and reversible.

- Every refresh run logs source, timestamp, status, and warnings.
- Failed refresh does not destroy last usable data.
- Stale data stays visible with warnings.
- Manual fallback remains possible.

## Data Layers

| Layer | Source of truth | Refresh type | MVP frequency | Owner | Output status expectation |
|---|---|---|---|---|---|
| SOXX holdings snapshot | Official iShares SOXX holdings snapshot | Manual/periodic official update | Weekly or monthly, plus known rebalance events | Operator | `available` / `stale` |
| Price history | Local `marketflow.db` `ohlcv_daily` via existing pipeline | Automated | Daily after market close | Pipeline job | `available` / `partial` / `unavailable` |
| Returns (1D/5D/1M) | Derived from price history | Derived | On demand and daily after price refresh | Adapter/runtime | `available` / `partial` / `unavailable` |
| Contribution snapshot | Derived from holdings + returns | Derived | Daily after price refresh and on demand | Lens compute layer | `available` / `partial` / `unavailable` |
| Contribution history | Derived from holdings + historical prices | Generated | Daily after price refresh (last 60 trading days) | History generation job | `available` / `partial` / `unavailable` |
| Freshness metadata | Derived from as-of dates | Derived | Every API response and every Lens load | Frontend/runtime | `fresh` / `delayed` / `stale` / `unknown` |

## Source of Truth

### Holdings

- Canonical source: official iShares SOXX holdings snapshot.
- Current implementation artifacts:
- `backend/data/semiconductor/soxx_holdings_snapshot.json`
- `frontend/src/lib/semiconductor/soxxHoldingsSnapshot.ts`
- Rule: holdings updates are manual and source-backed.

### Price Data

- Canonical source: existing local SQLite market DB.
- Current primary table: `ohlcv_daily` in `marketflow.db`.
- Rule: no manual fabrication of returns.

### Returns

- Canonical source: derived from price history.
- Rule:
- 1D = latest / previous trading observation - 1
- 5D = latest / 5 trading observations ago - 1
- 1M = latest / 21 trading observations ago - 1

### Contribution Snapshot

- Canonical source: derived from holdings + returns.
- Rule: never manually edit contribution values for presentation.

### Contribution History

- Canonical source: generated from holdings + historical prices.
- Rule: missing ticker returns remain visible as partial/unavailable, not silently zero-filled.

## MVP Refresh Frequency

- Holdings snapshot: weekly/monthly manual refresh, and after known SOXX rebalance events.
- Price history: daily after market close using current pipeline.
- Returns: derived after daily price refresh and on request.
- Contribution snapshot: recomputed after returns update.
- Contribution history: regenerate default 60 trading days after price refresh.
- Freshness metadata: recomputed on each API response or page load.

## Refresh Job Contract

The initial contract is defined in:

- `frontend/src/lib/semiconductor/soxxRefreshTypes.ts`

Core log entry fields:

- layer
- status
- startedAt
- finishedAt
- source
- asOf
- recordsProcessed
- missingTickers
- warnings
- error

This contract is additive for DS-6 and does not require persistent storage yet.

## Failure Behavior

### Holdings Refresh Failure

- Keep last official holdings snapshot.
- Mark holdings stale when freshness thresholds are exceeded.
- Show warning.
- Do not clear holdings.

### Price Refresh Failure

- Keep last usable price data.
- Mark returns/history stale or delayed based on as-of.
- Show warnings.
- Do not overwrite with empty payloads.

### Contribution Snapshot Failure

- Preserve holdings and price data.
- Mark contribution unavailable or stale.
- Show warning.
- Do not output fake contribution.

### Contribution History Failure

- Preserve current snapshot if available.
- Mark trend unavailable.
- Show warning.

## Manual Fallback

### Allowed

- Manual SOXX holdings snapshot update from official source.
- Running existing local price refresh pipeline manually.
- Regenerating contribution snapshot/history from source data.
- Showing manual/stale/partial states when applicable.

### Not Allowed

- Inventing price returns manually.
- Editing contribution outputs to make charts look complete.
- Removing missing ticker warnings without fixing source data.

## Existing Pipeline Discovery

### Scripts Found

- `backend/scripts/update_ohlcv.py`
- Incremental OHLCV updates into `ohlcv_daily`, with retry and parallel workers.
- `backend/scripts/ingest_prices_stooq.py`
- Stooq CSV ingestion to parquet/CSV workspace outputs.
- `backend/scripts/build_semiconductor_mvp.py`
- Builds `backend/output/cache/semiconductor_market_data.json` from DB (`yfinance` fallback for Tier 2 non-core symbols).
- `backend/scripts/build_soxx_context.py`
- Builds `backend/output/soxx_context.json` from DB and cache inputs.
- `backend/scripts/build_soxx_contribution_history.py`
- Generates `backend/output/semiconductor/soxx_contribution_history.json`.
- `backend/services/soxx_contribution_history.py`
- Holdings-based selected/residual contribution history generator from `ohlcv_daily`.
- `backend/run_all.py`
- Daily orchestration entrypoint with ordered script execution and timeouts.
- `backend/scripts/manage_scheduler.ps1`
- Windows task scheduler helper for daily pipeline task.
- `backend/scripts/manage_validation_guard_scheduler.ps1`
- Windows task scheduler helper for validation guard task.

### Database/Table Found

- Database: `data/marketflow.db`
- Table: `ohlcv_daily`

### Gaps

- No dedicated, persisted refresh log store for Lens layers yet.
- No explicit holdings refresh workflow that synchronizes frontend and backend holdings artifacts in one step.
- `run_all.py` currently includes SOXX context build but not explicit SOXX contribution history generation in the default list.

## Logging Requirements

Every refresh run should produce entries with:

- source
- as-of
- status
- warnings
- missing tickers when partial
- error message when failed

The DS-6 contract is type-first and can be persisted in DS-10.

## Future Automation Phases

- DS-7 - Daily Price Refresh Script Wiring
- Wire existing daily price pipeline to guarantee SOXX and selected holdings ticker coverage.
- DS-8 - SOXX Holdings Refresh Workflow
- Add an explicit official holdings refresh process with validation and sync.
- DS-9 - Contribution Generation Job
- Regenerate contribution snapshot/history after successful price refresh.
- DS-10 - Refresh Log / Data Health Dashboard
- Persist refresh logs and expose Lens data health in the debug panel.

## Guardrail

Stale data must be labeled, not hidden.
The Lens must not present stale, partial, or unavailable data as live.

## Phase DS-7 - Daily Price Refresh Script Wiring

### Purpose

DS-7 wires the SOXX/SOXL Lens ticker universe into the existing daily price refresh pipeline.

### Required Universe

The price refresh must include:

- SOXX
- all current SOXX holdings tickers

### Rule

The SOXX Lens universe must be appended to the existing price universe and deduplicated.
It must not replace existing MarketFlow tickers.

### Residual Requirement

Residual contribution requires price history for unmapped SOXX holdings.
Therefore full SOXX holdings coverage is preferred.

### Missing Tickers

Missing tickers must be logged and surfaced as partial data.
Missing prices must not be replaced with zero.

### Symbol Mapping

Provider-specific symbols may differ from app tickers.
The app ticker should remain stable while provider symbols can be mapped for fetch/ingest.

Current DS-7 mapping artifacts:

- `frontend/src/lib/semiconductor/soxxLensUniverse.ts`
- `backend/services/soxx_lens_universe.py`

### QA

A coverage check should report:

- required tickers
- available tickers
- missing tickers
- latest date per ticker
- stale tickers

Current DS-7 coverage check:

- `backend/scripts/check_soxx_lens_price_coverage.py`

### Pipeline Discovery Snapshot

- Refresh script entry: `backend/scripts/update_ohlcv.py`
- Data sources: yfinance primary, Stooq fallback, local Spooq daily backfill fallback.
- Destination: SQLite `ohlcv_daily` table in `marketflow.db`.
- Existing universe source: `universe_symbols` active rows.
- DS-7 wiring: append SOXX Lens universe from `backend/data/semiconductor/soxx_holdings_snapshot.json`, then deduplicate.
- SOXX included: yes (required benchmark ticker).
- SOXX holdings tickers included: yes (appended from holdings snapshot).
- Limitations:
- Partial results may occur due to provider availability/delays.
- Provider ticker format may vary by source; mapping layer is supported.

## Phase DS-8 — SOXX Holdings Refresh Workflow

### Purpose

DS-8 establishes the official process for refreshing the SOXX holdings snapshot that drives all contribution math.

### Holdings Snapshot Files

| Layer | File |
|---|---|
| Backend | `backend/data/semiconductor/soxx_holdings_snapshot.json` |
| Frontend | `frontend/src/lib/semiconductor/soxxHoldingsSnapshot.ts` |

Both files must be updated together on every holdings refresh.

### Validation

Run after every holdings refresh:

```bash
cd marketflow/backend
python scripts/check_soxx_holdings.py
```

Full procedure: `docs/soxx_holdings_refresh_procedure.md`

### DS-8 Artifacts

- `backend/scripts/check_soxx_holdings.py` — validation script (PASS/PARTIAL/FAIL)
- `frontend/src/lib/semiconductor/soxxHoldingsValidation.ts` — frontend validation helper
- `docs/soxx_holdings_refresh_procedure.md` — refresh procedure and data contract

## Phase DS-9 — Contribution Snapshot / History Generation Job

### Purpose

DS-9 generates derived SOXX/SOXL Lens contribution outputs from holdings and price history.

### Generated Outputs

| File | Description |
|---|---|
| `backend/output/semiconductor/soxx_contribution_snapshot_latest.json` | 1D / 5D / 1M contribution snapshot |
| `backend/output/semiconductor/soxx_contribution_history_60d.json` | 60 trading-day 1D contribution history |
| `backend/output/semiconductor/soxx_contribution_generation_log.json` | Generation run log |

### Generation Command

```bash
cd marketflow/backend
python scripts/generate_soxx_contribution_outputs.py
```

### Return Period Definitions

| Period | Lookback |
|---|---|
| 1D | latest close / 1 trading observation ago |
| 5D | latest close / 5 trading observations ago |
| 1M | latest close / 21 trading observations ago |

### Rules

- Contribution outputs are derived data. Do not manually edit output files.
- Missing ticker returns must be reported. Do not silently replace with zero.
- On generation failure, previous output is preserved via `.bak.json` backup.
- The generation log records status, missing tickers, warnings, and error for each output file.
- `soxx_contribution_history.json` (legacy alias) is kept in sync for the existing frontend contribution-history API route.

### Failure Behavior

If generation fails, the previous usable output remains in place.
The generation log records the failure status, warning, and error message.

## Phase DS-10 — Data Health / Refresh Status

### Purpose

DS-10 adds a lightweight internal data health view for SOXX/SOXL Lens generated outputs.

### Checks

- Contribution snapshot output file status
- Contribution history output file status
- Generation log status
- Last run time
- Missing tickers
- Warnings
- Failure state and error message

### Implementation

- API route: `frontend/src/app/api/semiconductor-lens/generation-log/route.ts`
  Reads `backend/output/semiconductor/soxx_contribution_generation_log.json` and returns JSON.
- Debug section: `Contribution Output Health` in `soxxDataDebug.ts`
  Added to `buildSoxxDataDebugSummary` as `generationLog` input param.
- Panel wiring: `TerminalXDashboard.tsx`
  Fetches generation log only when `?debug=1` is active. Result is passed to `buildSoxxDataDebugSummary`.

### Access

Internal QA only. Hidden unless `?debug=1` is present in the URL.
Do not expose generation log to normal users.

### Note

This panel is not a live dashboard. It reflects the last generation run.
To refresh, run `generate_soxx_contribution_outputs.py` and reload the page with `?debug=1`.
