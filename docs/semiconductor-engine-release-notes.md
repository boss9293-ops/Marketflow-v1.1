# Semiconductor Engine — Release Notes
**Version:** Phase K / v1.1 | **Date:** 2026-04-29

---

## Release Summary

The Semiconductor Engine now tracks AI-era semiconductor capital flow using SOXX as the anchor. It shows which semiconductor groups support or weaken SOXX and how capital spreads across AI Compute, Memory, Foundry, Equipment, and broader participation.

---

## What Was Added

| Feature | Description |
|---------|-------------|
| AI Regime Lens | 5-component regime classification (AI Compute, Memory, Foundry, Equipment, Rotation Risk) with regime label and confidence |
| SOXX Relative Spread Chart | Shows each bucket's spread vs SOXX over the zoom window |
| Rebased Bucket Flow Chart | All 5 series (SOXX + 4 buckets) rebased to zero from window start |
| Capital Flow Stage Timeline | Horizontal flow: AI Compute → Memory → Foundry → Equipment → Broad, with color-coded confirmation stages |
| Simplified Interpretation Panel | 5 primary blocks: Summary, What is Leading, What is Lagging, Capital Flow Stage, SOXL Sensitivity |
| SOXL Sensitivity Translation | Sensitivity level (High/Medium/Low–Medium) derived from AI Regime label |
| Data Status Trust Layer | LIVE / SNAPSHOT / FALLBACK / UNAVAILABLE in footer with source and last updated |
| Chart Microcopy | One-sentence user hints below each chart title |
| AI Regime KPI Cell | AI Regime label visible in top KPI strip |

---

## What Was Simplified

| Removed / Reduced | Reason |
|-------------------|--------|
| Complex 8-block interpretation panel | Reduced to 5 focused blocks |
| Legacy historical analog blocks | De-emphasized; playback labeled as stress reference |
| AI Concentration panel (MAP view) | Replaced by AI Regime Lens panel |
| Raw enum labels (e.g., `AI_DISTORTION`) | Replaced with human-readable display names |
| Hardcoded `Liquidity: HIGH` KPI | Replaced with live AI Regime label |
| Alignment text / Historical Context / Confidence paragraph / Delta block | Removed |

---

## API Improvements

| Route | Change |
|-------|--------|
| `/api/interpretation` | Multi-candidate paths, structured error responses, `dataStatus` field |
| `/api/translation` | Same as interpretation |
| `/api/playback` | try/catch wrapper, multi-candidate replay path |

---

## Known Limitations

| Limitation | Note |
|-----------|------|
| Tier2 memory data (Samsung, SK Hynix) may be unavailable | Engine handles gracefully; MU used as primary |
| Cycle Timeline (left panel) uses mock data | Backend wiring deferred |
| Footer ticker prices are mock | Static display; backend wiring deferred |
| Drilldown panel uses mock price data | Static display; backend wiring deferred |
| Local data files not present in serverless deployment | Routes return 503 gracefully; Phase L deployment work required |
| Playback bucket series unavailable | Labeled in `dataStatus.missing` |

---

## Phases Completed

| Phase | Description |
|-------|-------------|
| Phase E | AI Regime Lens wiring + SOXL sensitivity + Playback regime label |
| Phase F | Display cleanup + simplified interpretation panel + chart priority + bucket scope lock + purpose QA |
| Phase G | Relative Spread chart + Rebased Bucket Flow chart + Capital Flow Stage Timeline |
| Phase H | Narrative and product copy finalization |
| Phase I | Layout polish + data trust layer + user guidance microcopy |
| Phase J | Data path audit + API route hardening + frontend defensive rendering + build QA |
| Phase K | Public explanation + user guide + demo script + landing copy + release notes |

---

## Disclaimer

This engine provides structural market context for AI-era semiconductor capital flow. It is not a trading signal, forecast, or investment recommendation.
