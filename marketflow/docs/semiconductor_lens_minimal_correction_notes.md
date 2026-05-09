# Semiconductor Lens Minimal Correction Notes

## Scope
- Work order: Semiconductor Lens Minimal Data-Line Correction, Phase 0-1.
- Goal: preserve the current UI and chart layout while clarifying anchor, benchmark, bucket coverage, and SOXL interpretation language.
- Layout redesign: not performed.

## File Paths Touched
- `marketflow/frontend/src/components/semiconductor/TerminalXDashboard.tsx`
- `marketflow/frontend/src/components/semiconductor/SemiconductorPlaybackTab.tsx`
- `marketflow/frontend/src/lib/semiconductor/bucketMapping.ts`
- `marketflow/frontend/src/lib/semiconductor/aiRegimeLens.ts`
- `marketflow/frontend/src/lib/semiconductor/interpretationEngine.ts`
- `marketflow/frontend/src/lib/semiconductor/explanationEngine.ts`
- `marketflow/frontend/src/lib/semiconductor/engineScore.ts`
- `marketflow/frontend/src/lib/semiconductor/normalizeMetrics.ts`
- `marketflow/frontend/src/lib/semiconductor/translationEngine.ts`
- `marketflow/frontend/src/app/api/semiconductor-lens/history/route.ts`
- `marketflow/frontend/src/components/semiconductor/SoxxSoxlTranslationTab.tsx`
- `marketflow/frontend/src/app/api/translation/route.ts`
- `marketflow/docs/semiconductor_lens_minimal_correction_notes.md`

## Components Identified
- Route entry: `marketflow/frontend/src/app/semiconductor-lens/page.tsx`
- Main UI shell: `marketflow/frontend/src/components/semiconductor/TerminalXDashboard.tsx`
- Page title/subtitle area: `TerminalXDashboard` header (`TERMINAL X`, `SEMICONDUCTOR ANALYSIS ENGINE`)
- Top KPI strip / summary cards: `TerminalXDashboard` KPI strip directly below the header
- Relative Spread vs SOXX chart: `TerminalXDashboard`, `CYCLE VIEW`, chart section `[1]`
- Rebased Bucket Flow chart: `TerminalXDashboard`, `CYCLE VIEW`, chart section `[2]`
- Right interpretation panel: `TerminalXDashboard`, right aside `Panel title="Interpretation"`
- SOXL sensitivity card: `TerminalXDashboard`, inside the Interpretation panel under `SOXL Sensitivity`
- Strategy tab SOXX/SOXL translation: `marketflow/frontend/src/components/semiconductor/SoxxSoxlTranslationTab.tsx`
- Playback tab: `marketflow/frontend/src/components/semiconductor/SemiconductorPlaybackTab.tsx`

## Phase 1 Changes
- Added a compact `Lens Anchors` trust-map card inside the existing KPI strip.
- Added the anchor roles:
  - Primary Anchor: SOXX
  - Benchmark Validation: NYSE Semiconductor Index
  - SOXL: Daily 3x sensitivity layer
- Updated helper copy for `Relative Spread vs SOXX` to state it is a relative-strength view of selected SOXX internal-driver buckets, not full holding-weighted attribution.
- Updated helper copy for `Rebased Bucket Flow` to state residual/other holdings are not decomposed.
- Updated the right-panel `SOXL Sensitivity` wording to frame SOXL as a daily 3x sensitivity layer, not a long-term 3x contribution model.

## Phase 2 - Coverage / Residual Card
- Added compact `Selected Driver Coverage` disclosure.
- Clarified that current buckets are selected internal SOXX drivers, not full SOXX decomposition.
- Displayed modeled coverage (`~51.5%`) and residual SOXX (`~48.5%`) values.
- Existing charts and layout preserved.

## Phase 3 - Signal Confidence / Driver Classification
- Added compact signal confidence / driver classification disclosure.
- Clarified High / Medium / Low trust hierarchy.
- Clarified Internal Driver vs External Confirmer vs AI Theme.
- Confirmed external signals are context only, not direct SOXX attribution.
- Existing charts, tabs, and layout preserved.

## Phase 4 - Chart Copy Correction
- Updated chart helper copy to clarify relative-strength interpretation.
- Removed or replaced causality language such as support/weaken/drive where applicable.
- Clarified that current charts are not full holding-weighted SOXX attribution.
- Existing charts, tabs, and layout preserved.

## Phase 5 - Right Panel Interpretation Rewrite
- Rewrote right-side interpretation panel copy to align with SOXX-relative framing.
- Replaced unsupported causality language with relative-strength language.
- Clarified internal driver vs external confirmer interpretation.
- Clarified SOXL as daily amplification sensitivity.
- Existing layout, charts, and tabs preserved.

## Phase 6 - SOXL Sensitivity Copy Correction
- Updated SOXL-specific UI copy to daily amplification / daily 3x sensitivity framing.
- Removed or replaced language implying simple multi-day 3x contribution.
- Added path-dependency note where appropriate.
- Existing charts, tabs, and layout preserved.

## Phase 7 - Bucket Mapping Config
- Added lightweight bucket mapping config for selected semiconductor buckets.
- Mapped buckets to representative tickers and driver classifications.
- Distinguished internal drivers from external confirmers.
- Prepared the UI for future SOXX holdings-based contribution work without implementing contribution attribution now.
- Existing charts, tabs, and layout preserved.

## Phase 8 - Final QA / Trust Language Scan
- Performed final trust-language scan across Semiconductor Lens UI copy.
- Replaced or confirmed potentially unsafe causality and attribution language.
- Verified SOXX anchor, benchmark validation, coverage/residual, signal confidence, and SOXL daily sensitivity framing.
- Verified external confirmers are context only.
- Confirmed no buy/sell recommendation language is introduced.
- Existing charts, tabs, and layout preserved.

## Preserved
- Existing tabs were preserved.
- Existing `Relative Spread vs SOXX` chart was preserved.
- Existing `Rebased Bucket Flow` chart was preserved.
- Existing right interpretation panel was preserved.
- No full holding-weighted contribution engine was added.
- No AI Industry Flow room was added.
- No route rename was performed.
- No large new chart module was introduced.

## UI Recovery Patch - Trust Cards Repositioned
- Moved long trust/disclosure content out of the top KPI strip.
- Restored the top KPI strip to short numeric/status indicators.
- Added compact Lens Trust Notes inside the right-side interpretation panel.
- Preserved SOXX anchor, benchmark validation, coverage/residual, signal confidence, and SOXL daily sensitivity disclosures.
- Existing charts, tabs, route, and chart logic preserved.

