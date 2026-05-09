# Real SOXX Holdings Data Line Notes

## Phase A1 - Static Holdings Snapshot + Data Contract

- Added TypeScript data contract for SOXX holdings.
- Added static placeholder snapshot for selected SOXX representative holdings.
- Added coverage helper function to prepare future holdings-based coverage calculation.
- Did not replace UI coverage values yet because real official holdings weights are not wired.
- SOXX remains the user-facing anchor.
- Benchmark index remains the validation anchor.
- SOXL remains the daily sensitivity layer.

## Important Guardrail

Placeholder holdings or zero weights must not be displayed as real SOXX data.

## Phase A2 - Official SOXX Holdings Snapshot

- Replaced placeholder SOXX holdings snapshot with real static holdings data from the official iShares SOXX fund data download.
- Used holdings as-of date 2026-04-29 and local download date 2026-04-30.
- Included the 30 equity securities from the official holdings workbook.
- Excluded cash and derivative rows from the equity holdings snapshot.
- Mapped selected internal SOXX drivers to bucket IDs.
- Marked non-selected SOXX holdings as residual.
- Added validation helper for total weight, duplicate tickers, selected coverage, and residual coverage.
- Did not wire holdings-based coverage into the UI yet.

## Guardrails

- SOXX remains the user-facing anchor.
- SOXX holdings are the calculation anchor.
- Benchmark methodology remains the validation anchor.
- SOXL remains the daily amplification sensitivity layer.
- External confirmers are not included in SOXX holdings unless present in the official SOXX holdings file.

## Phase B1 - Holdings-Based Coverage Wiring

- Wired official SOXX holdings-based selected coverage and residual coverage into Lens Trust Notes.
- Replaced static coverage disclosure with calculated values from the official SOXX holdings snapshot.
- Displayed holdings as-of date.
- Preserved the guardrail that coverage is not contribution attribution.
- Existing charts, tabs, route, and chart logic preserved.

## Current Values

- Holdings as-of date: 2026-04-29
- Selected coverage: 48.52120%
- Residual coverage: 51.37114%
- Total equity holdings weight: 99.89234%
