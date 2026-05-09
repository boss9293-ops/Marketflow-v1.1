# Holding-Weighted Contribution Engine

## Phase C1 - Contribution Data Contract + Calculation Helper

- Added holding return input type.
- Added holding-level contribution calculation.
- Added bucket-level contribution calculation.
- Contribution formula: holding weight percent x holding return percent / 100.
- Contribution output is expressed in percentage points.
- Residual SOXX bucket is included for unmapped holdings.
- Added development-only sample return fixture for helper validation.
- No UI contribution panel or chart was added in this phase.
- Existing relative-strength charts remain unchanged.

## Guardrails

- Contribution is not a forecast.
- Contribution is not a buy/sell signal.
- Selected bucket contribution is not full SOXX attribution unless residual is included.
- SOXL is not calculated as simple multi-day 3x contribution.

## Phase DS-9 — Contribution Snapshot / History Generation Job

Generation script: `backend/scripts/generate_soxx_contribution_outputs.py`

Outputs written to `backend/output/semiconductor/`:
- `soxx_contribution_snapshot_latest.json` — 1D / 5D / 1M multi-period snapshot
- `soxx_contribution_history_60d.json` — 60 trading-day 1D history
- `soxx_contribution_generation_log.json` — run log (status, missing tickers, warnings, error)

Key rules:
- Snapshot uses Nth-observation return: 1D=1, 5D=5, 1M=21 trading days lookback
- History reuses `soxx_contribution_history.py` service (`build_contribution_history`)
- Missing ticker returns are reported as partial, not silently zero-filled
- `soxx_contribution_history.json` (legacy alias) is kept in sync for existing frontend API route
- On generation failure, previous output file is preserved via `.bak.json` backup
- Generation log records status, missing tickers, warnings, error for each output file

## Phase C2 - Compact Contribution Summary Card

- Added compact SOXX Contribution Snapshot UI card.
- Contribution is calculated from official SOXX holdings weights and real holding return inputs when available.
- Added unavailable state when real return inputs are not available.
- Sample fixture data is not used in production UI.
- Residual contribution remains included.
- Existing relative-strength charts remain unchanged.
- No new chart or route was added.

## Guardrails

- Contribution is measured in percentage points.
- Contribution is not a forecast.
- Contribution is not a buy/sell signal.
- Selected bucket contribution must be interpreted alongside residual contribution.

## Phase C3 - Period Selector + Multi-Period Contribution Adapter

- Added multi-period contribution period structure.
- Added 1D / 5D / 1M contribution period support where real return data exists.
- Added adapter to normalize holding-level returns by period.
- Added compact period selector to the SOXX Contribution Snapshot card.
- Added unavailable state for periods without real holding-level return data.
- Sample fixture data remains dev-only and is not used in production UI.
- Existing relative-strength charts remain unchanged.
- No contribution trend chart was added in this phase.

## Guardrails

- Contribution remains holding-weighted and measured in percentage points.
- Contribution is not a forecast.
- Contribution is not a buy/sell signal.
- Selected bucket contribution must be interpreted alongside residual contribution.

## Phase C4 - Contribution History Data Contract + Trend Preparation

- Added contribution history snapshot data contract.
- Added history point data contract for date/period/bucket-level contribution.
- Added trend-series builder for future chart rendering.
- Added validation helper for contribution history snapshots.
- Residual contribution remains included.
- Selected total and residual total are preserved in each snapshot.
- No production contribution trend chart was added in this phase.
- Existing relative-strength charts remain unchanged.

## Guardrails

- Contribution trend is not a forecast.
- Contribution trend is not a buy/sell signal.
- Selected bucket contribution must be read alongside residual contribution.
- Mock/dev history data must not be imported into production UI.

## Phase C5 - Compact Contribution Trend Chart

- Added compact SOXX contribution trend chart component.
- First version focuses on Selected Total vs Residual contribution.
- Chart uses contribution history data when available.
- Added unavailable state when historical holding-level return data is not available.
- Residual contribution remains included.
- Existing relative-strength charts remain unchanged.
- No new route or large dashboard section was added.

## Guardrails

- Contribution trend is holding-weighted and measured in percentage points.
- Contribution trend is not a forecast.
- Contribution trend is not a buy/sell signal.
- Selected contribution must be interpreted alongside residual contribution.
- Dev/mock history data must not be imported into production UI.

## Phase C6 - Real Historical Return Pipeline

- Added backend pipeline to generate SOXX holding-weighted contribution history.
- Uses official SOXX holdings snapshot and real historical close prices where available.
- Computes daily holding return and holding contribution in percentage points.
- Aggregates contribution into selected buckets and residual.
- Writes stable contribution history JSON output.
- Preserves residual contribution and selected total.
- Missing price data is handled safely with warnings.
- Added a minimal frontend API loader for the generated contribution history JSON.
- Wired the compact contribution trend chart to real history data when available.
- No forecast, buy/sell signal, or SOXL simulation added.

## Output Contract

- Path: `marketflow/backend/output/semiconductor/soxx_contribution_history.json`
- Generated at: `2026-05-01T05:47:47Z`
- Holdings as-of: `2026-04-29`
- Period: `1D`
- Snapshot count: `20`
- Status: `partial`
- Window: `2026-04-02` to `2026-04-30`

## Guardrails

- Historical contribution is deterministic and backward-looking.
- Historical contribution is not a forecast.
- Historical contribution is not a buy/sell signal.
- Selected contribution must be interpreted alongside residual.

## Phase C7 - Frontend Contribution History Wiring & QA

- Wired real SOXX contribution history JSON into the existing C5 mini chart.
- Added frontend/API loader for contribution history output.
- Preserved unavailable state when output is missing, unavailable, or malformed.
- Added safe handling for ok / partial / unavailable statuses.
- Partial history can render chart with compact warning.
- No dev/mock history data is used in production UI.
- Existing C5 chart component was not recreated.
- Existing relative-strength charts remain unchanged.

## Guardrails

- Contribution history is backward-looking and deterministic.
- Contribution history is not a forecast.
- Contribution history is not a buy/sell signal.
- Selected contribution must be interpreted alongside residual contribution.

## Phase C8 - Contribution QA / Trust Panel Polishing

- Reviewed contribution UI copy and right-panel density.
- Standardized Coverage / Contribution / Trend labels.
- Clarified that coverage means mapped SOXX holdings weight, not return contribution.
- Confirmed contribution values use percentage points (%p).
- Confirmed contribution trend is backward-looking and not a forecast.
- Reviewed ok / partial / unavailable states.
- Confirmed dev/mock fixtures are not imported into production UI.
- Existing charts and tabs remain unchanged.

## Guardrails

- Coverage is not contribution.
- Contribution is measured in percentage points.
- Contribution trend is historical and backward-looking.
- Contribution trend is not a forecast.
- Contribution is not a buy/sell signal.
- Selected contribution must be read alongside residual.

## Phase C9 - User Explanation / Help Copy

- Added reusable user-facing help copy for SOXX contribution concepts.
- Explained Coverage, Contribution, Residual, Relative Strength, Contribution Trend, and SOXL Daily Sensitivity.
- Added compact "How to Read This" guidance and lightweight title-help text.
- Kept explanation short to avoid right-panel crowding.
- Reinforced that contribution is historical context, not a forecast.
- No new chart, route, or data pipeline was added.

## User Explanation Guardrails

- Coverage means mapped SOXX holdings weight.
- Contribution means weight x return, measured in percentage points.
- Residual means other SOXX holdings outside selected buckets.
- Relative strength is not contribution.
- Contribution trend is backward-looking.
- SOXL is daily amplification context, not simple multi-day 3x attribution.

## Phase S2 - SOXX/SOXL Lens Simplification

- Simplified the SOXX/SOXL Lens tab for subscriber readability.
- Replaced the broad engine KPI strip with SOXX/SOXL-specific structure indicators.
- Kept the Lens focused on SOXX structure, holdings coverage, contribution, residual participation, and SOXL daily sensitivity.
- Avoided adding broader AI infrastructure themes into the Lens.
- Reduced repetitive guardrail/help copy where appropriate.
- Preserved existing contribution snapshot and trend chart.
- Preserved the AI Infrastructure Radar placeholder.
- No new data pipeline or chart was added.

## Product Rule

- SOXX/SOXL Lens = quantitative SOXX structure analysis.
- AI Infrastructure Radar = broader AI infrastructure opportunity monitoring.

## Phase SL-2 - Contribution Snapshot Readability Polish

### Purpose

Contribution Snapshot shows holding-weighted contribution by selected SOXX driver buckets.

### Key Definitions

- Contribution = holding weight x return, shown as %p impact.
- Return = bucket or holding return, shown as %.
- Weight = SOXX mapped holding weight, shown as %.
- Residual = other SOXX holdings outside selected buckets.

### Display Rules

- Contribution uses %p.
- Return and weight use %.
- Positive values show `+`.
- Missing values show `Unavailable`.
- Residual must remain visible.
- Selected buckets are sorted by absolute contribution magnitude, with Residual kept visible.

### Context Labels

- Leading
- Supporting
- Lagging
- Mixed
- Unavailable

### Guardrail

Contribution is historical context only. It is not a forecast, recommendation, or trading signal.

## Phase SL-3 - Selected vs Residual Interpretation Panel

### Purpose

The Selected vs Residual panel explains SOXX participation structure using contribution data.

### Definitions

- Selected Buckets = mapped SOXX holdings inside selected semiconductor driver buckets.
- Residual = other SOXX holdings outside selected buckets.
- Contribution = holding weight x return, shown as %p.

### Interpretation States

- Broad participation = selected and residual contributions are both positive.
- Selected-led = selected contribution is positive while residual contribution is not.
- Residual-led = residual contribution is positive while selected contribution is not.
- Mixed / Diverging = selected and residual contributions move in different directions or are not clearly aligned.
- Unavailable = required contribution data is missing.

### SOXL Context

SOXL context is daily sensitivity interpretation only.
It is not a multi-day forecast.

### Guardrail

Historical participation context only. Not a forecast, recommendation, or trading signal.

## Phase DS-1 - SOXX/SOXL Lens Data Stabilization Review

### Data Chain

Official SOXX holdings snapshot
-> bucket mapping
-> price / return data
-> holding-level contribution
-> bucket-level contribution
-> selected vs residual
-> contribution trend / interpretation

### Holdings QA

- Holdings source: Official iShares SOXX fund data download.
- Holdings as-of date: 2026-04-29.
- Equity holdings count: 30.
- Total weight: 99.89234%.
- Selected coverage: 48.52120%.
- Residual: 51.37114%.
- Duplicate tickers: none found.
- Missing or zero weights: none found.
- Selected coverage and residual are calculated from holdings, not manually hardcoded.

### Bucket Mapping QA

- AI Compute = NVDA / AMD / AVGO.
- Memory / HBM = MU.
- Equipment = AMAT / ASML / LRCX / KLAC.
- Foundry / Packaging = TSM.
- Residual = all other SOXX holdings outside the selected bucket set.
- Every selected ticker exists in the SOXX holdings snapshot.
- No selected ticker is duplicated across selected buckets.

### Price / Return Source QA

- Contribution history source: existing local SQLite `ohlcv_daily` table in `marketflow.db`.
- Contribution history output: `marketflow/backend/output/semiconductor/soxx_contribution_history.json`.
- Current output generated at: 2026-05-01T05:47:47Z.
- Current output status: partial.
- Snapshot contribution panel source: `/api/semiconductor-lens` `market_cap_weights` payload when `semiconductor_weights.json` is available.
- If the holding-level return weights cache is unavailable, the snapshot should remain unavailable instead of using sample values.

### Contribution Formula

Holding contribution %p = holding weight % x holding return % / 100.

Example:

Weight 10%, return +2%, contribution +0.20%p.

### Data Status

- Available = all required data exists.
- Partial = some data missing but enough to calculate with warning.
- Unavailable = not enough data to calculate.
- Sample = dev/demo only and must not be shown as production.

### Stabilization Changes

- Removed mock/sample fallback from the main `/api/semiconductor-lens` UI route.
- The route now returns unavailable when the market data cache or core SOXX row is missing.
- Missing selected ticker market data is reported in route metadata instead of being silently filled.
- Bucket performance averages only available finite return values.
- Unavailable relative-strength values are labeled unavailable instead of being ranked as underperforming.

### Guardrail

Data honesty is more important than screen completeness.
Missing data must be shown as unavailable or partial, not silently replaced with fake zeros.

## Phase DS-3 - Contribution History Auto-Generation

### Purpose

DS-3 generates selected vs residual contribution history from SOXX holdings and historical price data.

### Default Window

The initial history window is 60 trading days.

Supported bounds:

- Minimum: 20 trading days.
- Default: 60 trading days.
- Maximum: 252 trading days.

### Daily Return Formula

Daily return % = close(date) / close(previous trading observation) - 1.

Return values are stored as percent values.

Important data rule:

- The close for `date` must exist for the ticker.
- The previous trading observation is ticker-specific.
- Missing current or previous close produces `null`, not `0`.

### Contribution Formula

Holding contribution %p = holding weight % x daily return % / 100.

### Aggregation

- Bucket contribution = sum of holding contributions inside bucket.
- Selected contribution = sum of selected bucket contributions.
- Residual contribution = sum of unmapped holding contributions.
- Total contribution = selected + residual.
- Residual is holdings-based, not calculated as SOXX return minus selected contribution.

### Output Contract

Daily history records include:

- `selectedContributionPctPoint`
- `residualContributionPctPoint`
- `totalContributionPctPoint`
- `soxxReturnPct`
- `availableTickerCount`
- `totalTickerCount`
- `missingTickers`
- `status`

Bucket history records include:

- `bucketId`
- `bucketName`
- `contributionPctPoint`
- `returnPct`
- `weightPct`
- `availableTickerCount`
- `totalTickerCount`
- `missingTickers`
- `status`

### Missing Data

Missing ticker returns must be reported per date.
Missing values must not be silently replaced with zero.

Status logic:

- Available = all holdings have usable daily returns.
- Partial = at least one holding has a usable daily return, but some are missing.
- Unavailable = no usable holding returns for the date.

### Diagnostic

Total contribution may differ from SOXX ETF return due to holdings coverage, stale weights, missing tickers, fees, and ETF mechanics.
Large differences above 1.00%p are reported as warnings, not hidden.

### Implementation

- Backend service: `marketflow/backend/services/soxx_contribution_history.py`.
- Build script: `marketflow/backend/scripts/build_soxx_contribution_history.py`.
- Frontend route: `/api/semiconductor-lens/contribution-history`.
- Frontend adapter: `marketflow/frontend/src/lib/semiconductor/soxxContributionHistoryApi.ts`.
- Trend component: `marketflow/frontend/src/components/semiconductor/SoxxContributionTrendMiniChart.tsx`.

### Guardrail

Contribution history is historical context only. It is not a forecast, recommendation, or trading signal.

## Phase DS-4 - Data QA / Debug Panel

### Purpose

DS-4 adds an internal debug panel for SOXX/SOXL Lens data QA.

The panel helps verify:

- SOXX holdings source and as-of date
- selected bucket mapping
- price / return adapter status
- contribution status
- contribution history status
- missing tickers
- source / as-of dates
- warnings

### Visibility

The panel is hidden by default and shown only in debug mode with `?debug=1`.

### Status Rules

- PASS = data exists and has no critical warnings.
- PARTIAL = some data exists but some tickers or fields are missing.
- FAIL = required data is missing or unusable.
- UNKNOWN = debug panel cannot access the section yet.

### Guardrail

The debug panel is for internal QA only.
It is not a user-facing trading signal or product feature.

## Phase DS-5 - Data Source Reliability / Refresh Workflow

### Purpose

DS-5 defines how SOXX/SOXL Lens data freshness and reliability are labeled.

### Data Layers

- SOXX holdings snapshot
- Price / return adapter
- Current contribution snapshot
- Contribution history
- Debug / QA summary

### Required Metadata

Each data layer should expose:

- source
- as-of date
- status
- warnings

### Freshness Rules

- Fresh = today or previous trading day.
- Delayed = 2-3 calendar days old.
- Stale = more than 3 calendar days old.
- Unknown = no as-of date.

Weekend handling may treat Friday data as acceptable during Saturday/Sunday.

### Refresh Failure Behavior

- If price refresh fails, keep the last available payload when safe, mark stale if old, and show warnings.
- If holdings refresh fails, keep the last official holdings snapshot, show holdings as-of date, and warn when outdated.
- If contribution history generation fails, show trend unavailable, preserve current snapshot when available, and warn.

### Guardrail

Stale data must be labeled, not hidden.
The Lens must not present stale, partial, or unavailable data as live.

## Phase DS-6 - Data Refresh Automation Plan

### Purpose

DS-6 defines the refresh workflow for SOXX/SOXL Lens data.

### Refresh Principle

Refresh automation must be observable and reversible.

### MVP Refresh Schedule

- SOXX holdings: weekly/monthly manual official snapshot refresh.
- Price history: daily after market close using existing price pipeline.
- Returns: derived from price history.
- Contribution snapshot: regenerated after price refresh.
- Contribution history: regenerate last 60 trading days after price refresh.
- Freshness metadata: computed on every load.

### Failure Behavior

Failed refresh must not destroy last usable data.
Stale data must be labeled.
Missing data must remain visible.

### Manual Fallback

Manual holdings refresh is allowed.
Manual price or contribution fabrication is not allowed.

### Future Phases

- DS-7 - Daily Price Refresh Script Wiring
- DS-8 - SOXX Holdings Refresh Workflow
- DS-9 - Contribution Generation Job
- DS-10 - Refresh Log / Data Health Dashboard

## Phase DS-7 - Daily Price Refresh Script Wiring

- Wired SOXX Lens required universe into the existing daily price refresh path.
- Required universe is SOXX plus all tickers from current SOXX holdings snapshot.
- SOXX Lens universe is appended to existing refresh symbols and deduplicated.
- Missing SOXX Lens tickers are logged and surfaced as partial coverage.
- Added price coverage QA script for required/available/missing/stale visibility.
- Missing price data is not replaced with zero.
