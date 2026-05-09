# Semiconductor Intelligence Architecture

## Product Split

- SOXX/SOXL Lens: Quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.
- AI Infrastructure Radar: Monitors broader AI infrastructure themes outside direct SOXX attribution.
- SOXX Link Layer: Classifies AI infrastructure themes as Direct SOXX, Indirect SOXX, or Outside SOXX.

## AI Infrastructure Radar - Phase R1

Initial themes:

1. Data Center Power
2. Grid / Electrical Equipment
3. Cooling
4. Cloud CAPEX
5. Nuclear / SMR

All R1 themes are placeholder data unless connected to a real source later.

## Guardrails

- Historical context only. Not a forecast or trading signal.
- Radar themes are not direct SOXX contributors unless classified as Direct SOXX.
- Placeholder data must be clearly labeled.
- Broader AI infrastructure themes should not overload the SOXX/SOXL Lens.

## Phase R2 - AI Infrastructure Radar Placeholder UI

- Added a simple placeholder UI for the AI Infrastructure Radar tab.
- Rendered the initial five AI infrastructure themes:
  - Data Center Power
  - Grid / Electrical Equipment
  - Cooling
  - Cloud CAPEX
  - Nuclear / SMR
- Displayed SOXX Link Type for each theme.
- Displayed placeholder data status clearly.
- Avoided fake live scores or simulated signals.
- Preserved the SOXX/SOXL Lens tab and existing contribution layer.

## Radar UI Guardrails

- Radar themes are exploratory context.
- Radar themes are not trading signals.
- Placeholder themes must not be presented as live data.
- Broader AI infrastructure themes should remain outside the SOXX/SOXL Lens tab.

## Phase L1 - SOXX Link Layer Planning

The SOXX Link Layer connects AI Infrastructure Radar themes back to SOXX/SOXL relevance.

### Link Types

| Link Type | Meaning |
|---|---|
| Direct SOXX | Directly represented inside SOXX holdings |
| Indirect SOXX | Connected through demand, capex, or supply-chain pathways |
| Outside SOXX | Broader AI infrastructure theme outside direct SOXX attribution |

### Initial Theme Mapping

| Theme | Link Type | Related SOXX Buckets |
|---|---|---|
| Data Center Power | Indirect SOXX | AI Compute, Equipment |
| Grid / Electrical Equipment | Outside SOXX | None |
| Cooling | Indirect SOXX | AI Compute |
| Cloud CAPEX | Indirect SOXX | AI Compute, Memory, Equipment |
| Nuclear / SMR | Outside SOXX | None |

### Guardrail

AI Infrastructure Radar themes should not be presented as direct SOXX contributors unless they are classified as Direct SOXX.

## Phase P1 - Product Copy Lock

### Core Tagline

Quantify what moves SOXX. Monitor where AI capital may move next.

### Product Split

- SOXX/SOXL Lens: Quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.
- AI Infrastructure Radar: Monitors broader AI infrastructure themes outside direct SOXX attribution.
- SOXX Link Layer: Classifies AI infrastructure themes as Direct SOXX, Indirect SOXX, or Outside SOXX.

### Link Type Definitions

- Direct SOXX = directly represented inside SOXX holdings.
- Indirect SOXX = connected through demand, capex, or supply-chain pathways.
- Outside SOXX = broader AI infrastructure theme outside direct SOXX attribution.

### Guardrail

Historical context only. Not a forecast or trading signal.

## Phase A1 - Architecture Review / Freeze Point

### Freeze Decisions

- Parent section name: Semiconductor Intelligence
- Tab 1: SOXX/SOXL Lens
- Tab 2: AI Infrastructure Radar
- SOXX/SOXL Lens remains quantitative and SOXX-based.
- AI Infrastructure Radar remains exploratory and broader AI infrastructure-based.
- SOXX Link Layer connects Radar themes back to SOXX/SOXL relevance.
- Broad AI infrastructure themes should not be added directly into the SOXX/SOXL Lens unless explicitly mapped to SOXX/SOXL relevance.

### Product Rule

One screen = one purpose.

- SOXX/SOXL Lens = quantify SOXX internal structure.
- AI Infrastructure Radar = monitor broader AI infrastructure opportunities.
- SOXX Link Layer = explain SOXX/SOXL relevance.

### Release Guardrail

Historical / exploratory context only. Not a forecast or trading signal.

## Phase T1 - SOXX/SOXL Lens Visual Polish

- Polished the SOXX/SOXL Lens for subscriber readability.
- Prioritized a simple story: SOXX structure, selected vs residual, contribution bias, and SOXL daily sensitivity.
- Kept the Lens focused on SOXX/SOXL quantitative structure.
- Preserved existing charts, contribution snapshot, and trend components.
- Removed or reduced repeated trust notes and long explanatory text.
- Did not add new data pipelines, charts, or AI Radar data.

### Visual Rule

One glance = one story.

### Product Rule

SOXX/SOXL Lens = quantitative SOXX structure analysis.
AI Infrastructure Radar = broader AI infrastructure monitoring.

## Phase D1 - AI Infrastructure Radar Real Data Plan

- Added a real data plan for the AI Infrastructure Radar.
- Kept the Radar manual-first and exploratory before any scoring engine.
- Defined candidate data sources for price momentum, news/narrative, CAPEX, and macro/infrastructure context.
- Mapped the initial five Radar themes to exploratory watchlists and SOXX Link Types.
- Preserved Placeholder status in the production UI until real manual, partial, or live data exists.
- Did not add new data pipelines, scores, charts, or AI Radar live data.

### D1 Data Rule

Useful context first. Scoring later.

## Phase D2 - AI Infrastructure Radar Manual Data Structure

- Added static/manual Radar data containers for watchlists, manual news notes, and CAPEX notes.
- Extended Radar data status language to include Manual.
- Populated the initial exploratory manual watchlist across the five MVP themes.
- Kept manual news and CAPEX notes empty to avoid fake news or fake company statements.
- Added light Radar placeholder UI integration for manual watchlist chips.
- Did not add automated ingestion, scores, charts, or live Radar data.

### D2 Guardrail

Manual watchlists are exploratory theme baskets, not recommendations or trading signals.

## Phase D3 - AI Infrastructure Radar Theme Basket Momentum

- Added the first theme basket momentum calculation layer for the Radar.
- Built momentum helpers around the D2 manual watchlist.
- Defined 1D, 5D, and 1M momentum periods.
- Used equal-weight basket return logic for the first implementation.
- Added relative-to-SOXX calculation when SOXX return data is supplied.
- Added honest unavailable handling through a not-connected price adapter.
- Added compact Radar placeholder UI status for unavailable theme momentum.
- Did not add fake returns, scores, charts, or live price ingestion.

### D3 Guardrail

Theme momentum is exploratory context, not a trading signal.

## Phase D4 - AI Infrastructure Radar News Intake Prototype

- Added the first curated news structure for AI Infrastructure Radar.
- Extended manual news data with SOXX Link Type and relevance fields.
- Kept manual news empty to avoid fake headlines.
- Added theme-level news filtering, latest-news, count, relevance-label, and status helpers.
- Added compact Radar placeholder UI for manual news context.
- Did not add automated ingestion, news scoring, live feed claims, or trading-signal language.

### D4 Guardrail

Manual news context is not a live feed, forecast, or trading signal.

## Phase D5 - AI Infrastructure Radar Cloud CAPEX Tracker

- Added the first Cloud CAPEX Tracker structure for the Radar.
- Defined the hyperscaler company universe: MSFT, GOOGL, AMZN, META, and ORCL.
- Extended CAPEX note data with ticker, related themes, related SOXX buckets, and source type.
- Kept CAPEX notes empty to avoid fake company statements.
- Added CAPEX helper functions for company universe, ticker/theme lookup, latest notes, and direction labels.
- Added compact Radar placeholder UI for the Cloud CAPEX tracker empty state.
- Did not add automated transcript parsing, scoring, or live CAPEX data.

### D5 Guardrail

CAPEX is a demand signal, not a trading signal.

## Phase D6 - AI Infrastructure Radar Score v0 Planning

- Added Radar Score v0 display policy planning.
- Defined data confidence levels from Placeholder to Live.
- Added a score suppression helper that decides whether score UI should be hidden, qualitative-only, or numeric-allowed.
- Added compact Radar placeholder UI copy for data confidence and score suppression.
- Did not add numeric scores, scoring formulas to production UI, scoring engines, or live data pipelines.

### D6 Core Rule

No score without enough real data.

### Data Confidence Rule

- Placeholder = score hidden.
- Manual = numeric score hidden.
- Partial = qualitative indicator only.
- Live = numeric score may be shown only if the calculation method is documented.

### D6 Guardrail

Radar score is context only, not a forecast or trading signal.

## Phase SL-1 - SOXX/SOXL Lens Core Review

### Product Definition

SOXX/SOXL Lens quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.

Expanded definition:

The SOXX/SOXL Lens uses SOXX holdings, selected bucket contribution, residual participation, and SOXX-relative strength to interpret the internal structure behind SOXX movement and SOXL daily sensitivity.

### Core Concepts

- Relative Strength = bucket performance versus SOXX.
- Contribution = holding weight x return, shown as %p impact.
- Coverage = mapped SOXX holdings weight.
- Residual = other SOXX holdings not in selected buckets.
- SOXL = daily sensitivity context, not a multi-day 3x forecast.

### Product Rule

Lens = SOXX structure quantification.

Radar = broader AI infrastructure exploration.

### Guardrails

- Current buckets represent selected internal SOXX drivers, not the full SOXX index.
- Historical context only. Not a forecast or trading signal.
- Broad AI infrastructure themes belong to AI Infrastructure Radar, not the SOXX/SOXL Lens.

## Phase SL-5 - SOXX/SOXL Lens Beta Release QA

### Final Beta Definition

SOXX/SOXL Lens quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.

### Final Beta Scope

- SOXX holdings basis
- Holdings as-of date
- Selected Coverage
- Residual Participation
- Relative Strength vs SOXX
- Contribution Snapshot
- Contribution Trend Mini Chart
- Selected vs Residual interpretation
- SOXL daily sensitivity context
- Compact how-to-read copy

### Core Definitions

- Relative Strength = bucket performance versus SOXX.
- Contribution = holding weight x return, shown as %p.
- Coverage = mapped SOXX holdings weight.
- Residual = other SOXX holdings outside selected buckets.
- SOXL = daily sensitivity context, not a multi-day 3x forecast.

### Guardrails

- Current buckets represent selected internal SOXX drivers, not the full SOXX index.
- Historical structure context only. Not a forecast, recommendation, or trading signal.
- Broad AI infrastructure themes belong to AI Infrastructure Radar, not the SOXX/SOXL Lens.
