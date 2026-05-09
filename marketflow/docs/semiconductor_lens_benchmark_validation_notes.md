# Benchmark Methodology Validation Layer

## Phase BM1 - SOXX Benchmark Source + Methodology Contract

- Added benchmark methodology validation data contract.
- Added static SOXX benchmark methodology summary.
- Defined benchmark methodology as a validation anchor, not the user-facing anchor.
- Preserved SOXX holdings as the calculation anchor.
- Preserved SOXL as the daily amplification sensitivity layer.
- No new chart, route, or contribution engine was added.

## Guardrails

- SOXX remains the user-facing anchor.
- SOXX holdings remain the calculation anchor.
- Benchmark methodology is used only for structural validation.
- Benchmark validation is not a forecast and not a buy/sell signal.

## Verified Source

- Fund source: Official iShares SOXX fund page.
- Fund ticker: SOXX.
- Fund name: iShares Semiconductor ETF.
- Benchmark name: NYSE Semiconductor Index.
- Benchmark provider: ICE Data Indices, LLC.
- Methodology source: ICE official index-name-change notice plus SEC-filed public methodology description.
- Verification date: 2026-05-01.
- Validation status: partial.

## Source Notes

- The official iShares SOXX fund page lists Benchmark Index as NYSE Semiconductor Index and Bloomberg Index Ticker as ICESEMIT.
- ICE official index-name-change notice confirms ICESEMI and ICESEMIT were renamed to NYSE Semiconductor Index variants effective 2023-11-03.
- Public methodology details describe the benchmark as a modified float-adjusted market capitalization-weighted index of the thirty largest U.S.-listed semiconductor companies.

## Pending Review

- Full ICE methodology rulebook should be manually verified through the ICE Index Platform if access is available.
- Methodology as-of date remains unassigned until the official rulebook is reviewed directly.
