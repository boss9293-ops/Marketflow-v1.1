# AI Infrastructure Radar - Real Data Plan

## 1. Purpose

AI Infrastructure Radar monitors broader AI infrastructure themes and classifies their relevance to SOXX/SOXL.

The Radar is an exploratory monitoring layer, not a trading signal engine. D1 defines the real data plan before any live pipeline, score, or chart is added.

Core rule:

Useful context first. Scoring later.

## 2. Initial Themes

The MVP theme universe remains limited to five themes:

1. Data Center Power
2. Grid / Electrical Equipment
3. Cooling
4. Cloud CAPEX
5. Nuclear / SMR

Do not add additional themes until the first five have stable manual or partial data coverage.

Future candidates for later phases:

- Cybersecurity
- Copper
- Data Center REITs
- Robotics
- Industrial Automation
- Software Infrastructure

## 3. Theme-by-Theme Data Plan

### 3.1 Data Center Power

Purpose:

Track whether AI data center expansion is creating rising power-demand pressure.

Possible data inputs:

- News mentions of AI data center power constraints
- Utility and power infrastructure company commentary
- Data center electricity demand reports
- Regional power grid constraint reports
- Power-related watchlist basket

MVP data approach:

Manual curated news plus exploratory watchlist basket.

Initial watchlist examples:

- VST
- CEG
- ETR
- D
- NEE
- PWR

SOXX mapping:

- SOXX Link Type: Indirect SOXX
- Related SOXX buckets: AI Compute, Equipment

Data availability:

- Price momentum may be available through the existing local `ohlcv_daily` database if these symbols are present or added to the universe.
- News and data center power commentary should start as manually curated links.
- Regional utility or grid reports should remain manual until source quality is stable.

Do not treat this theme as a direct SOXX contributor.

### 3.2 Grid / Electrical Equipment

Purpose:

Monitor companies and industries benefiting from grid upgrades, transformers, electrical equipment, and power distribution constraints.

Possible data inputs:

- Electrical equipment watchlist basket
- Grid upgrade news
- Utility capex commentary
- Transformer shortage reports
- Infrastructure spending announcements

MVP data approach:

Manual curated watchlist basket plus news monitoring.

Initial watchlist examples:

- ETN
- GEV
- PWR
- HUBB
- EME

SOXX mapping:

- SOXX Link Type: Outside SOXX
- Related SOXX buckets: None

Data availability:

- Price momentum may be available through the existing local `ohlcv_daily` database if these symbols are present or added to the universe.
- News should start as manually curated theme evidence.
- Utility capex commentary should remain manual in MVP.

This theme sits outside direct SOXX attribution.

### 3.3 Cooling

Purpose:

Monitor data center cooling and thermal management as an AI infrastructure bottleneck.

Possible data inputs:

- Cooling company watchlist basket
- Data center thermal management news
- Liquid cooling adoption reports
- Server density and rack power trend commentary

MVP data approach:

Manual curated news plus exploratory watchlist basket.

Initial watchlist examples:

- VRT
- TT
- CARR
- JCI

SOXX mapping:

- SOXX Link Type: Indirect SOXX
- Related SOXX buckets: AI Compute

Data availability:

- Price momentum may be available through the existing local `ohlcv_daily` database if these symbols are present or added to the universe.
- Cooling adoption and thermal management evidence should start as manual news and research notes.
- No direct SOXX contribution should be implied.

### 3.4 Cloud CAPEX

Purpose:

Track hyperscaler AI capital expenditure as a demand signal for AI accelerators, memory, and equipment.

Possible data inputs:

- Quarterly capex commentary from MSFT, GOOGL, AMZN, META, and ORCL
- Earnings transcript snippets
- News mentions of AI capex
- Capex guidance changes
- Hyperscaler watchlist momentum

MVP data approach:

Manual earnings/capex update table plus news monitoring.

Initial watchlist examples:

- MSFT
- GOOGL
- AMZN
- META
- ORCL

SOXX mapping:

- SOXX Link Type: Indirect SOXX
- Related SOXX buckets: AI Compute, Memory, Equipment

Data availability:

- Price momentum may be available through the existing local `ohlcv_daily` database if these symbols are present or added to the universe.
- CAPEX direction should be manual first because earnings language often needs interpretation.
- Transcript snippets can be automated later after a reliable source and citation contract exist.

### 3.5 Nuclear / SMR

Purpose:

Monitor long-term power supply solutions for AI data center demand.

Possible data inputs:

- Nuclear and SMR news
- Power purchase agreement announcements
- Data center nuclear partnership news
- Nuclear watchlist basket
- Regulatory and funding milestones

MVP data approach:

Manual curated news plus exploratory watchlist basket.

Initial watchlist examples:

- CEG
- OKLO
- SMR
- BWXT
- CCJ

SOXX mapping:

- SOXX Link Type: Outside SOXX
- Related SOXX buckets: None

Data availability:

- Price momentum may be available through the existing local `ohlcv_daily` database if these symbols are present or added to the universe.
- Regulatory and project milestone tracking should remain manual in MVP.
- This is a long-cycle infrastructure theme and should not be treated as current SOXX attribution.

## 4. Data Source Categories

### 4.1 Price / Momentum Data

Purpose:

Show whether an exploratory theme basket is gaining or losing market momentum.

Possible sources:

- Existing local price database: `ohlcv_daily`
- Existing update scripts: `marketflow/backend/scripts/update_ohlcv.py`
- Existing Stooq/yfinance paths where already used
- Existing market data service and OHLCV API patterns
- Manual CSV fallback

Available now:

- The project already has a local OHLCV pattern and scripts for symbol-level price history.
- D1 does not confirm that every Radar watchlist symbol already exists in the universe.
- D2 should verify symbol coverage before any basket calculation is exposed.

Output concept for later phases:

- Theme basket 1D return
- Theme basket 5D return
- Theme basket 1M return
- Theme basket return vs SOXX

Guardrail:

Theme momentum is exploratory context, not a recommendation or trading signal.

### 4.2 News / Narrative Intensity

Purpose:

Track whether a theme is increasingly appearing in AI infrastructure news.

Possible sources:

- Existing news pipeline patterns under `marketflow/backend/news`
- Existing briefing/news synthesis routes where applicable
- Tavily if already provisioned for the project
- Google News RSS or company news RSS
- Manual curated links

MVP recommendation:

Manual or semi-manual first. Do not attempt heavy news scoring yet.

Simple initial fields:

- theme
- headline
- source
- published_date
- why_it_matters
- risk_or_contradiction
- related_theme
- soxx_link_type
- data_status

Available now:

- The project has news synthesis and briefing infrastructure.
- Radar should not consume that pipeline automatically until source attribution, deduplication, and theme mapping are defined.

### 4.3 Fundamental / CAPEX Data

Purpose:

Track capex and investment signals from hyperscalers and infrastructure companies.

Possible sources:

- Earnings releases
- 10-Q / 10-K filings
- Earnings transcripts
- Company investor presentations
- Manual capex table

MVP recommendation:

Manual table first for Cloud CAPEX.

Initial fields:

- company
- quarter
- capex_comment
- capex_direction
- ai_related_comment
- source_link
- last_updated
- data_status

Available now:

- The project has financial analysis patterns, but Radar CAPEX should not rely on broad automated extraction until manual field definitions are stable.

### 4.4 Macro / Infrastructure Data

Purpose:

Add slow-moving context for power, energy, and infrastructure constraints.

Possible sources:

- FRED
- EIA
- DOE
- IEA reports
- Utility load growth reports
- Regional grid operator reports

MVP recommendation:

Do not automate in the first implementation. Document as a future context layer.

Available now:

- The project has macro/FRED-related scripts and cache patterns.
- Radar should defer infrastructure automation because source cadence and theme relevance are slower and less standardized.

## 5. MVP Data Strategy

D1 recommends this sequence:

1. Manual theme watchlist
2. Theme basket price momentum from the existing price DB if symbol coverage exists
3. Manual curated news table
4. Cloud CAPEX manual update table
5. Later automation after manual fields are stable

Why this path:

- It avoids simulated live data.
- It makes the Radar useful before scoring is mature.
- It separates price evidence, narrative evidence, and fundamental/CAPEX evidence.
- It preserves the SOXX/SOXL Lens as the quantitative SOXX structure screen.

## 6. Initial Watchlist Table

These watchlists are exploratory theme baskets, not recommendations.

| Theme | Example Watchlist | SOXX Link |
|---|---|---|
| Data Center Power | VST, CEG, ETR, D, NEE, PWR | Indirect SOXX |
| Grid / Electrical Equipment | ETN, GEV, PWR, HUBB, EME | Outside SOXX |
| Cooling | VRT, TT, CARR, JCI | Indirect SOXX |
| Cloud CAPEX | MSFT, GOOGL, AMZN, META, ORCL | Indirect SOXX |
| Nuclear / SMR | CEG, OKLO, SMR, BWXT, CCJ | Outside SOXX |

## 7. Data Status Labels

Use four Radar data status labels:

| Status | Meaning |
|---|---|
| Placeholder | Theme exists, but no real theme data is connected. |
| Manual | Data is manually curated and source-linked. |
| Partial | Some data is connected, but coverage is incomplete. |
| Live | Data is connected through a repeatable production pipeline. |

Current D1 status:

- All five Radar themes remain Placeholder in the production UI.
- Manual and Partial are planning states for D2/D3.
- Live should not be used until a repeatable source pipeline exists.

## 8. Proposed Data Model

These models are documentation-only in D1. Add TypeScript files in D2 only if the implementation phase needs them.

```ts
export type AIInfraThemeDataStatus =
  | 'placeholder'
  | 'manual'
  | 'partial'
  | 'live'

export type AIInfraThemeWatchlistItem = {
  ticker: string
  name: string
  role: string
  themeIds: string[]
  soxxLinkType: 'direct' | 'indirect' | 'outside'
}

export type AIInfraThemeNewsItem = {
  id: string
  themeId: string
  headline: string
  source: string
  publishedDate: string
  url?: string
  whyItMatters: string
  riskOrContradiction?: string
  dataStatus: AIInfraThemeDataStatus
}

export type AIInfraThemeCapexItem = {
  company: string
  quarter: string
  capexDirection: 'up' | 'flat' | 'down' | 'unclear'
  aiRelatedComment: string
  source?: string
  lastUpdated: string
  dataStatus: AIInfraThemeDataStatus
}
```

Possible static MVP files for D2:

- `marketflow/frontend/src/lib/semiconductor/aiInfrastructureWatchlist.ts`
- `marketflow/frontend/src/lib/semiconductor/aiInfrastructureManualNews.ts`
- `marketflow/frontend/src/lib/semiconductor/aiInfrastructureCapex.ts`

Do not create these files until D2 unless the UI needs them.

## 9. Guardrails

- Do not simulate live data.
- Do not show invented theme scores.
- Do not show invented news intensity.
- Do not convert Placeholder themes to Live without a repeatable source pipeline.
- Do not present Radar themes as direct SOXX contributors unless classified as Direct SOXX.
- Do not add broad AI infrastructure themes to the SOXX/SOXL Lens.
- Use "exploratory theme basket" language for watchlists.
- Use "Historical / exploratory context only. Not a forecast or trading signal." where a guardrail is needed.

Forbidden until real calculations exist:

- AI Infra Momentum numeric score
- Capital Flow Score
- News Intensity Score
- SOXX Link Strength Score
- Live-style theme signal labels

Acceptable MVP labels:

- Placeholder
- Manual
- Partial
- Live

## 10. Future Automation Roadmap

### D2 - Manual Data Structure

Create static/manual watchlist and manual news/CAPEX tables.

Expected output:

- Theme watchlist data file
- Manual news item data contract
- Manual CAPEX item data contract
- Radar UI still clearly labels manual or placeholder status

### D3 - Theme Basket Momentum

Use the existing price DB to calculate 1D / 5D / 1M theme basket momentum.

Expected output:

- Verify symbol coverage in `ohlcv_daily`
- Calculate equal-weight basket returns
- Compare theme basket returns vs SOXX
- Show Partial status until all required symbols are covered

### D4 - News Intake Prototype

Connect basic RSS/Tavily/manual news input for theme-level narrative.

Expected output:

- Source-linked news items
- Manual review path
- Deduplication rule
- No heavy narrative score yet

### D5 - CAPEX Tracker

Build Cloud CAPEX tracker for MSFT / GOOGL / AMZN / META / ORCL.

Expected output:

- Manual or semi-manual quarterly CAPEX table
- Direction field: up / flat / down / unclear
- Source link and last updated date

### D6 - Radar Score v0

Only after data is stable, create simple momentum / narrative / link confidence indicators.

Expected output:

- Transparent component inputs
- No opaque model score
- Clear data status labels
- Guardrail that Radar is exploratory context, not a forecast or trading signal

## 11. D1 Decision

D1 freezes the following decisions:

- The first real Radar data layer should be manual-first.
- Price momentum can reuse existing OHLCV infrastructure after symbol coverage is verified.
- News and CAPEX should be manually curated before automation.
- No Radar score should be introduced until source coverage and data status are stable.
- Placeholder themes remain placeholder in the UI until D2/D3 connects real manual or partial data.

## 12. Phase D2 - Manual Radar Data Structure

D2 creates the first static/manual data containers for the AI Infrastructure Radar.

### Manual Data Containers

- `AI_INFRA_THEME_WATCHLIST`
- `AI_INFRA_MANUAL_NEWS`
- `AI_INFRA_CAPEX_NOTES`

### Data Status

- Placeholder = concept only, no real data connected
- Manual = manually curated data exists
- Partial = some connected data exists, but coverage is incomplete
- Live = automated or regularly updated data exists

### D2 Implementation Notes

- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureManualData.ts`.
- Added watchlist, manual news, and CAPEX note data contracts.
- Populated the initial manual watchlist for the five MVP Radar themes.
- Kept manual news empty until real source-linked notes are curated.
- Kept CAPEX notes empty until real earnings releases or transcripts are reviewed.
- Added helper functions for theme watchlists, manual news, and CAPEX notes.
- Added light Radar placeholder UI integration for manual watchlist chips.

### D2 Guardrail

The manual watchlist is an exploratory theme basket, not a recommendation or trading signal.

## 13. Phase D3 - Theme Basket Momentum

D3 introduces the first theme-level momentum layer for AI Infrastructure Radar.

### Method

- Theme baskets are built from the manual D2 watchlist.
- Initial basket return method is equal-weight.
- Periods: 1D, 5D, 1M.
- Relative return is calculated versus SOXX when SOXX return is available.
- Current implementation includes calculation helpers and an honest unavailable adapter.

### Formula

```text
basketReturnPct = average(available ticker returns)
relativeToSoxxPct = basketReturnPct - soxxReturnPct
```

### Data Status

- Available = all tickers have usable returns.
- Partial = some tickers have usable returns.
- Unavailable = no usable price data is connected.

### D3 Implementation Notes

- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureMomentum.ts`.
- Added `AIInfraMomentumPeriod`, `AIInfraTickerReturn`, and `AIInfraThemeMomentum`.
- Added equal-weight basket return calculation.
- Added relative-to-SOXX calculation.
- Added missing ticker handling.
- Added formatting and status-label helpers.
- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureMomentumAdapter.ts`.
- The adapter returns `unavailable` until a real price source is connected.
- Added light Radar placeholder UI showing that theme momentum is unavailable because the price source is not connected yet.

### D3 Guardrail

Theme momentum is exploratory context, not a trading signal.

## 14. Phase D4 - News Intake Prototype

D4 adds the first curated news structure for AI Infrastructure Radar.

### News Layer Purpose

News explains theme context.

News does not create a trading signal.

### Initial Method

- Manual curated news array.
- Theme-level filtering helper.
- Latest-news helper.
- News count/status helper.
- Empty by default unless real curated news is added.
- Radar UI shows manual news context status without claiming a live feed.

### D4 Implementation Notes

- Extended `AIInfraThemeNewsItem` with optional summary, SOXX Link Type, and relevance.
- Added `AIInfraNewsRelevance`.
- Kept `AI_INFRA_MANUAL_NEWS` empty during D4 to avoid invented headlines.
- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureNews.ts`.
- Added `getNewsByTheme`, `getLatestThemeNews`, `getThemeNewsCount`, `getThemeNewsRelevanceLabel`, and `getThemeNewsStatus`.
- Added a compact Radar card news section that displays `No curated news yet` while the manual array is empty.

### Future Sources

- Google News RSS
- Tavily
- Company press releases
- Earnings transcripts
- SEC filings
- FMP news
- Manual admin input

### D4 Guardrail

Manual news context is not a live feed, forecast, or trading signal.

## 15. Phase D5 - Cloud CAPEX Tracker

D5 adds the first Cloud CAPEX Tracker structure for AI Infrastructure Radar.

### Covered Companies

- MSFT
- GOOGL
- AMZN
- META
- ORCL

### Purpose

Cloud CAPEX is treated as an indirect demand signal for:

- AI Compute
- Memory
- Equipment

### Method

- Manual CAPEX notes first.
- No automated filing or transcript parser yet.
- No invented company statements.
- Empty by default until real source-backed notes are added.
- Radar UI shows company universe and manual note count only.

### D5 Implementation Notes

- Extended `AIInfraThemeCapexItem` with ticker, related themes, related SOXX buckets, and source type.
- Added `AIInfraCapexDirection` and `AIInfraCapexSourceType`.
- Added `AI_INFRA_CAPEX_COMPANIES` for MSFT, GOOGL, AMZN, META, and ORCL.
- Kept `AI_INFRA_CAPEX_NOTES` empty during D5 to avoid invented company statements.
- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureCapex.ts`.
- Added helpers for CAPEX company universe, ticker/theme note lookup, latest notes, direction labels, and direction tone.

### CAPEX Direction Labels

- Up = Increasing
- Flat = Stable
- Down = Slowing
- Unclear = Unclear

### D5 Guardrail

CAPEX is a demand signal, not a trading signal.

## 16. Phase D6 - Radar Score v0 Planning

D6 defines when Radar scores may be shown.

### Core Rule

No score without enough real data.

Show confidence first, score later.

### Data Confidence Levels

| Level | Label | Meaning | Score allowed? |
|---|---|---|---|
| 0 | Placeholder | Concept only, no real data | No |
| 1 | Manual | Curated watchlist / notes only | No numeric score |
| 2 | Partial | Some price/news/CAPEX data connected | Qualitative only |
| 3 | Live | Regular connected data source | Numeric score may be shown if documented |

### Score Visibility Rules

1. If `dataStatus = placeholder`, do not show a score. Show "Data not connected yet."
2. If `dataStatus = manual`, do not show a numeric score. Show "Manual context available."
3. If `dataStatus = partial`, do not show an exact numeric score by default. Show qualitative context only.
4. If `dataStatus = live`, a numeric score may be shown only if the calculation method is documented.

### Allowed v0 Indicators

- Watch
- Improving
- Weakening
- Mixed
- Unavailable
- Manual context
- Partial data

### Future Score Components

Future Radar Score v0 may combine:

1. Theme basket momentum
2. Relative-to-SOXX momentum
3. News context availability
4. CAPEX direction
5. SOXX link confidence

Documentation-only candidate formula:

```text
Radar Score v0 =
  35% Theme Basket Momentum
+ 25% Relative to SOXX
+ 20% News Context
+ 15% CAPEX Direction
+ 5% SOXX Link Confidence
```

This formula is not active until real or partial data is available and validated.

### D6 Implementation Notes

- Added `marketflow/frontend/src/lib/semiconductor/aiInfrastructureScorePolicy.ts`.
- Added a display-policy helper that controls whether Radar score UI should be hidden, qualitative-only, or numeric-allowed.
- Added compact Radar card copy showing data confidence and why score display is suppressed.
- Did not add a numeric score, scoring engine, chart, or live data source.

### D6 Guardrail

Radar score is context only, not a forecast or trading signal.

## 17. Phase R-QA1 - AI Radar MVP QA / Freeze

### Frozen MVP Definition

AI Infrastructure Radar monitors broader AI infrastructure themes and classifies their relevance to SOXX/SOXL.

Internal rule:

Radar = exploratory context, not attribution engine.

### Frozen Initial Themes

- Data Center Power
- Grid / Electrical Equipment
- Cooling
- Cloud CAPEX
- Nuclear / SMR

### Frozen Link Types

- Direct SOXX = directly represented inside SOXX holdings.
- Indirect SOXX = connected through demand, capex, or supply-chain pathways.
- Outside SOXX = broader AI infrastructure theme outside direct SOXX attribution.

### Frozen Data Status Labels

- Placeholder = concept only, no real data
- Manual = manually curated watchlist / notes
- Partial = some connected data exists
- Live = regularly connected data source

### Frozen Score Policy

No score without enough real data.

- Placeholder = score hidden
- Manual = score hidden
- Partial = qualitative only
- Live = numeric score allowed only if method is documented

### R-QA1 QA Findings

- Manual news array remains empty unless real curated news is added.
- CAPEX notes array remains empty unless real source-backed notes are added.
- Theme momentum remains unavailable when no price source is connected.
- Radar cards show data confidence and score-suppression copy instead of numeric scores.
- Manual watchlists are labeled exploratory and not recommendations.
- The SOXX/SOXL Lens remains separate from the Radar and continues to render through the Lens tab.

### Release Guardrail

AI Infrastructure Radar is exploratory context only. It is not a forecast, recommendation, or trading signal.

## 18. Phase D7 - Theme Basket Momentum Price Connection

D7 connects the first real price data source to AI Infrastructure Radar theme basket momentum.

### Source Investigation

Selected source:

- `marketflow/data/marketflow.db`
- Table: `ohlcv_daily`
- Price field priority: `adj_close` when available, otherwise `close`
- API source label: `local_price_db:ohlcv_daily`

The local DB contains usable rows through 2026-04-30 for SOXX and most D2 watchlist tickers.

Current missing local price rows:

- VRT
- OKLO
- SMR
- BWXT
- CCJ

### Method

- Uses the D2 manual watchlist.
- Uses SOXX as the benchmark.
- Calculates equal-weight basket returns.
- Periods: 1D, 5D, 1M.
- Relative return = basket return - SOXX return.

### Return Calculation

- 1D = latest close / previous close - 1
- 5D = latest close / close 5 trading observations ago - 1
- 1M = latest close / close 21 trading observations ago - 1

Returns are displayed in percent.

### Data Status

- Available = all tickers have usable prices
- Partial = some tickers have usable prices
- Unavailable = no usable price source

### D7 Implementation Notes

- Added `/api/ai-infra/theme-momentum`.
- The endpoint reads local SQLite only; it does not call a new external API.
- The endpoint returns theme-level 1D, 5D, and 1M equal-weight basket momentum.
- The endpoint returns 1M relative-to-SOXX momentum.
- Radar cards display real theme momentum when available.
- Radar cards show partial coverage and missing tickers when data is incomplete.
- Radar score remains hidden; this is not a score engine.

### Guardrail

Theme momentum is market context only, not a forecast, recommendation, or trading signal.

## 19. Phase D8 - Partial Data QA & Display Polish

D8 reviews the Radar after theme basket momentum price connection.

### Display Rules

- Show 1D / 5D / 1M theme basket momentum when available.
- Show vs SOXX using the 1M relative return by default.
- Show partial data count when some tickers are missing.
- Show unavailable state when no usable price data exists.
- Do not show numeric Radar Score unless live data and documented methodology exist.

### Data Confidence

If price momentum is connected but news and CAPEX are not connected, the Radar should be treated as Partial Data.

Current D8 state:

- Price momentum is connected through local `ohlcv_daily`.
- News context remains manual / not live.
- CAPEX notes remain empty unless source-backed notes are added.
- Radar score remains hidden.

### D8 UI Polish

- Kept 1D, 5D, 1M, and vs SOXX (1M) labels compact.
- Changed missing ticker display to a compact partial count in the main card.
- Kept missing ticker detail in hover/title text where available.
- Added a compact section-level momentum guardrail.

### Guardrail

Theme momentum is market context only, not a forecast, recommendation, or trading signal.

## 20. Phase D9 - Manual News & CAPEX Source-Backed Fill

D9 adds a small number of source-backed manual context notes to the AI Infrastructure Radar.

### Rules

- No invented news.
- No invented CAPEX comments.
- Every enabled item must include a clear source.
- Every enabled news item must include a published date.
- Every enabled CAPEX item must include a quarter and last-updated date.
- Manual notes are context only, not trading signals.

### Initial Manual News Fill

Added source-backed manual news context for:

- Data Center Power: IEA Energy and AI report.
- Grid / Electrical Equipment: Eaton switchgear capacity news release.
- Cooling: Vertiv / NVIDIA Vera Rubin DSX infrastructure news release.
- Nuclear / SMR: Google / Kairos Power nuclear energy agreement.

### Initial CAPEX Notes Fill

Added source-backed manual CAPEX notes for:

- MSFT
- GOOGL
- AMZN
- META
- ORCL

### Data Confidence

Manual news and CAPEX notes improve the Radar context layer but do not make the Radar live.

Current D9 state:

- Price momentum remains Partial when local price data is connected.
- Manual news and CAPEX notes are source-backed manual context.
- Radar score remains hidden.
- Radar data confidence should remain Partial when price momentum is connected and Manual when only source-backed notes are available.

### Guardrail

Manual context only. Not a forecast, recommendation, or trading signal.

## 21. Phase D10 - Radar Beta Release Polish

D10 prepares the AI Infrastructure Radar for beta presentation.

### Beta Definition

AI Infrastructure Radar is a beta monitoring layer for broader AI infrastructure themes.

It combines theme watchlists, SOXX relevance, market momentum, and curated manual context.

Short version:

Beta radar for AI infrastructure themes and SOXX/SOXL relevance.

### Data Status

- Data Not Connected = no real source connected.
- Manual Context = curated manual watchlist or source-backed notes.
- Partial Data = price momentum or limited source-backed context connected.
- Live = reserved for regular automated data only.

### Display Rules

- Use beta, partial, manual, and price-momentum status badges.
- Keep theme cards short and useful.
- Show honest empty states instead of harsh placeholder language.
- Do not show numeric Radar Score until enough connected data and documented methodology exist.
- Keep one compact guardrail near the section.

### D10 UI Polish

- Reframed the Radar header as a beta monitoring layer.
- Replaced placeholder-style header copy with status badges.
- Kept the Link Type legend compact.
- Polished empty states for momentum, news, and CAPEX notes.
- Kept score display suppressed with a short confidence explanation.
- Preserved the existing theme, watchlist, momentum, news, and CAPEX structures.

### Guardrail

Beta context only. Not a forecast, recommendation, or trading signal.

## 22. Phase D11 - Radar Beta Release Note / Help Copy

D11 adds concise user-facing help copy for the AI Infrastructure Radar Beta.

### Beta Explanation

AI Infrastructure Radar is a beta monitoring layer for broader AI infrastructure themes.

It combines theme watchlists, SOXX relevance, market momentum, and curated manual context.

Short version:

Beta radar for AI infrastructure themes and SOXX/SOXL relevance.

### How to Read

- Theme = broader AI infrastructure area being monitored.
- SOXX Link = how the theme relates to SOXX/SOXL.
- Watchlist = exploratory basket, not recommendations.
- Momentum = market context, not a trading signal.
- Data Confidence = how much real data is connected.

### Link Types

- Direct SOXX = directly represented in SOXX holdings.
- Indirect SOXX = connected through demand, capex, or supply-chain pathways.
- Outside SOXX = broader AI infrastructure theme outside direct SOXX attribution.

### Data Confidence

- Data Not Connected = no usable source connected yet.
- Manual Context = curated manual watchlist or notes.
- Partial Data = price momentum or limited source-backed context connected.
- Live = reserved for regular automated data only.

### D11 UI Notes

- Added a compact How-to-read panel near the Radar header.
- Added a compact Data Confidence panel near the Radar header.
- Preserved the existing Link Type legend.
- Did not add new data, themes, scores, charts, or pipelines.

### Guardrail

Beta context only. Not a forecast, recommendation, or trading signal.

## 23. R-Release QA - AI Infrastructure Radar Beta Final QA

### Final Beta Definition

AI Infrastructure Radar is a beta monitoring layer for broader AI infrastructure themes.

It combines theme watchlists, SOXX relevance, market momentum, and curated manual context.

Short definition:

Beta radar for AI infrastructure themes and SOXX/SOXL relevance.

### Final Beta Scope

- Five initial AI infrastructure themes.
- SOXX Link Type.
- Manual watchlist.
- Theme basket momentum.
- Manual news context.
- Cloud CAPEX notes.
- Data confidence policy.
- Score hidden policy.
- Beta help copy.

### Release Guardrail

Beta context only. Not a forecast, recommendation, or trading signal.

### Release Decision Criteria

The Radar Beta may be released if:

- Data status is honest.
- No simulated live data is shown.
- No numeric score is shown without documented live methodology.
- Watchlists are clearly exploratory.
- Momentum is clearly market context.
- Manual news/CAPEX items are source-backed or empty.
- SOXX/SOXL Lens remains unchanged.

### R-Release QA Notes

- Navigation remains split between SOXX/SOXL Lens and AI Infrastructure Radar.
- Radar header shows beta product copy and honest status badges.
- Five theme cards remain the frozen MVP universe.
- Theme momentum uses connected price data when available and honest unavailable/partial states otherwise.
- Manual news and CAPEX notes remain source-backed.
- Radar score remains hidden.
- Help copy explains Theme, SOXX Link, Watchlist, Momentum, and Data Confidence.
