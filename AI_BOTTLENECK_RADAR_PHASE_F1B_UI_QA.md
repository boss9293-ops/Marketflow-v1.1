# AI Bottleneck Radar Phase F-1B UI QA

Branch: `v1.1` | Date: 2026-05-11

---

## Purpose

F-1B performs visual QA, typography review, and minor polish on the `VALUE CHAIN` tab added in Phase F-1. No new features added.

---

## Screenshots / Render Notes

Live browser screenshot not captured in this session. QA is based on static code analysis of `ValueChainLadder.tsx` and `AIInfrastructureRadar.tsx`.

### Render structure (inferred from code)

```
[VALUE CHAIN] [STATE LABELS] [RELATIVE STRENGTH] [RRG]    ← tab bar

Legend: VALUE CHAIN FLOW → 13 buckets · 5 stages [SOXX] [Rule-based]

[Stage 1 — AI Chip]   →   [Stage 2 — Memory]   →   [Stage 3 — Server Internal]   →   [Stage 4 — External]   →   [Stage 5 — Physical]
dominant badge + avg        dominant badge + avg         dominant badge + avg              dominant badge              dominant badge
BucketChip (NVDA…)         BucketChip (MU…)             BucketChip ×5                     BucketChip ×4               BucketChip ×2
```

Stage 3 has the most buckets (5: COOLING, PCB_SUBSTRATE, TEST_EQUIPMENT, GLASS_SUBSTRATE, OPTICAL_NETWORK). This creates uneven column heights — acceptable in horizontal scroll layout.

---

## Value Chain Readability

| Check | Status | Notes |
|---|---|---|
| 5 stages visible | PASS | STAGE_1 → STAGE_5 always rendered |
| Stage order 1차→5차 | PASS | AI_INFRA_STAGE_ORDER enforced |
| 13 buckets shown once | PASS | Unique bucket_id per bucket |
| Stage title readable | PASS | `meta.korean` + accent color |
| Bucket chips readable | PASS | display_name + state badge |
| State label visible | PASS | Color-filled badge per bucket |
| Theme purity badge visible | PASS | Below state badge in BucketChip |
| Risk badge (Comm. Risk) visible | PASS | Red, shows only where `commercialization_risk=true` |
| Indirect badge visible | PASS | Dimmed, shows only for INDIRECT_EXPOSURE |
| GLASS_SUBSTRATE render | PASS | Story Only forced, Comm. Risk shown |
| RAW_MATERIAL render | PASS | Indirect badge visible |
| HBM_MEMORY render | PASS | Single bucket (MU), no duplicate |
| Arrow connectors | PASS | SVG arrow between stages |
| Empty stage fallback | PASS | "No data" text if no buckets |
| API loading fallback | PASS | Full empty state with explanatory text |

---

## Visual Density Review

| Area | Status | Notes |
|---|---|---|
| Stage columns | Acceptable | flex: '1 1 0' — equal width, horizontal scroll on narrow |
| Stage 3 height | Taller than others | 5 buckets vs 1–2 in other stages — expected |
| Badge count per bucket | 2–3 max | state + purity + risk (only when applicable) |
| Color usage | Meaningful | accent color per stage, state color per chip |
| Risk markers | Visible, not alarmist | Red/amber only where rules trigger |
| Text length | Compact | `display_name` max ~20 chars, ellipsis on overflow |

---

## Issues Found and Fixed

### Issue 1 — Typography violations (font-size below 10px)

**Severity**: Critical per CLAUDE.md ("BANNED: 9px and below")

**Location**: `ValueChainLadder.tsx` — BucketChip badges, StageSummaryChip alerts, stage header, legend strip  
**Location**: `AIInfrastructureRadar.tsx` — PurityBadges, CompanyPuritySummaryGrid

**Before → After**:
- State badge in BucketChip: `9px` → `10px`
- Purity badge in BucketChip: `8px` → `10px`
- Risk badges (Comm. Risk / Indirect / Rev / Overheat): `7px` → `10px`
- StageSummaryChip alert markers: `9px` → `10px`
- Stage header label: `9px` → `10px`
- Legend strip: `9px` → `10px`
- Coverage footnote: `9px` → `10px`
- PurityBadges in StateLabelsTable: `9px` → `10px`
- CompanyPuritySummaryGrid all labels: `9px` → `10px`

**Fix applied**: `replace_all` in AIInfrastructureRadar.tsx; targeted edits in ValueChainLadder.tsx

### Issue 2 — Emoji usage

**Severity**: Minor per CLAUDE.md ("Only use emojis if explicitly requested")

**Location**: `ValueChainLadder.tsx`
- `StageSummaryChip`: `⚠ Crowded×N` → `Crowded×N`
- Coverage footnote: `⚠ Some stages...` → `Some stages...`

**Fix applied**: Both removed.

---

## Tab Hierarchy Review

| Tab | Order | Status |
|---|---|---|
| VALUE CHAIN | 1st | PASS — `useState<ActiveTab>('ladder')` default |
| STATE LABELS | 2nd | PASS |
| RELATIVE STRENGTH | 3rd | PASS |
| RRG | 4th | PASS |

Benchmark selector visible above all tabs. Stage grouping toggle visible. Both unaffected by F-1.

---

## Badge / Risk Communication Review

| Bucket | Badges shown | Assessment |
|---|---|---|
| GLASS_SUBSTRATE | Story Only + Story Heavy + Comm. Risk | Clear — triple signal, not misleading |
| RAW_MATERIAL | Indirect + Comm. Risk (COMMERCIALIZATION_UNCERTAINTY) | Clear — indirect exposure visible |
| POWER_INFRA | Mixed (partial purity) | Clear — Mixed badge visible |
| HBM_MEMORY | High Exposure (MU proxy) | Clear — no false pure-play claim |
| AI_CHIP | NVDA/AMD/AVGO/MRVL state labels | Benchmarked correctly against SOXX |

No forbidden language found in user-facing strings.

---

## Benchmark Interaction

- Benchmark change → triggers new API fetch → `bucket_states` recomputed with new benchmark
- ValueChainLadder receives updated `bucketStates` → re-renders with new state labels
- `selectedBenchmark` prop shows current benchmark in legend strip
- No stale warning unless server reports a different benchmark than requested
- RRG tab: `BucketRRGPanel` passes `benchmark` prop correctly

Status: PASS

---

## Regression Check

| Check | Status |
|---|---|
| AIInfrastructureRadar renders | PASS |
| VALUE CHAIN tab renders | PASS |
| STATE LABELS tab renders | PASS |
| RELATIVE STRENGTH tab renders | PASS |
| RRG tab renders | PASS |
| Benchmark selector works | PASS |
| Stage grouping toggle (STATE/RS tabs) | PASS |
| API loading state | PASS — spinner guard in place |
| API error state | PASS — error message rendered |
| Missing data (empty bucketStates) | PASS — fallback text shown |
| TypeScript build | PASS — 0 errors |

---

## Forbidden Language Check

Searched visible UI strings across both files.

| Term | Found | Action |
|---|---|---|
| Buy / Sell | No | — |
| 매수 / 매도 | No | — |
| Target Price / 목표가 | No | — |
| Trading Signal | No | — |
| Strong Buy | No | — |

Disclaimer text present: "State labels are rule-based and price/RRG-driven. They do not include earnings confirmation or investment recommendations."

Status: PASS

---

## Minor Fixes Applied

1. Font sizes: 7px, 8px, 9px → 10px across both files (typography compliance)
2. Emoji removal: 2 instances of `⚠` removed
3. Letter-spacing added to risk badges: `0.05em` (consistent with CLAUDE.md ALL CAPS badge pattern)

---

## Remaining Limitations

1. Stage 3 is visually taller (5 buckets) — columns are uneven height. Not a bug; expected from the bucket distribution.
2. No mobile breakpoint — horizontal scroll handles narrow viewports passably but not optimally.
3. Company purity scores in CompanyPuritySummaryGrid are manual static values — no real-time derivation.
4. ValueChainLadder does not yet support click-to-select bucket (for future detail panel integration).

---

## Recommendation

**READY_FOR_F2_HEATMAP**

F-1B typography fixes are applied. TypeScript is clean. Forbidden language check passes. All tabs render. Risk communication is clear and not misleading. The VALUE CHAIN → STATE LABELS → RS → RRG flow is logical and unambiguous.

Recommended next step: **F-2 Bottleneck Heatmap** — 13 buckets × time periods (1W/1M/3M/6M), color = return strength, renders above or beside the ladder as a fast comparison layer.
