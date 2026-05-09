# Phase I Step 3 — User Guidance / Microcopy
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Microcopy Added

| Location | Text |
|----------|------|
| Below "Relative Spread vs SOXX" title | "Shows which groups are stronger or weaker than SOXX." |
| Below "Rebased Bucket Flow" title | "Compares bucket movement from the same starting point." |
| Below "Capital Flow Stage" title | "Shows how far AI-related capital has spread across the semiconductor value chain." |
| Below "⑤ SOXL Sensitivity" label | "Shows how the current SOXX structure may be amplified in SOXL." |

Style: `text-[10px] text-slate-600` — visible but does not compete with data.

---

## 2. Tooltip Coverage (existing)

| Target | Tooltip Source |
|--------|---------------|
| CYCLE VIEW tab | TAB_TIPS['CYCLE VIEW'] — "Semiconductor cycle phase and daily progression across structural stages." |
| PERFORMANCE tab | TAB_TIPS['PERFORMANCE'] — "Relative bucket performance versus SOXX benchmark over the period." |
| BREADTH tab | TAB_TIPS['BREADTH'] — "Measures whether participation is broad across semiconductor buckets." |
| MOMENTUM tab | TAB_TIPS['MOMENTUM'] — "Price strength across semiconductor segments over rolling periods." |
| MAP tab | TAB_TIPS['MAP'] — "Market structure score based on relative trend and stability conditions." |
| CORRELATION tab | TAB_TIPS['CORRELATION'] — "Cross-bucket correlation — rising correlation reduces diversification benefit." |

---

## 3. Copy QA Result

| Rule | Result |
|------|--------|
| Tooltip ≤ 1 sentence | ✅ |
| No jargon without context | ✅ |
| No trading or forecast language | ✅ |
| Microcopy ≤ 1 sentence | ✅ |
| Korean translation not required yet | — |

```
[✅] All 4 microcopy hints added
[✅] All 6 tab tooltips confirmed
[✅] No forbidden words in any microcopy or tooltip
[✅] TypeScript compile passes
```
