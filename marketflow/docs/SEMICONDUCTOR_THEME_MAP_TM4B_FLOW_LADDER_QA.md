# Semiconductor Theme Map TM-4B Flow Ladder QA

> Date: 2026-05-12
> Phase: TM-4B
> Status: PASS (2 minor label fixes applied)

---

## Purpose

QA for TM-4 ThemeFlowLadder. Verify 6-group mapping, bucket count,
Current Flow Summary rule, status labels, click/filter/responsive behavior,
and regression against existing Theme Map tabs.

---

## Flow Group Mapping QA

### Bucket verification

| Group | Label | Buckets | Count |
|-------|-------|---------|-------|
| core | AI Core | AI_CHIP | 1 |
| memory | Memory / Supply | HBM_MEMORY | 1 |
| mfg | Manufacturing / Pkg | PACKAGING, TEST_EQUIPMENT, PCB_SUBSTRATE | 3 |
| net_thermal | Network / Thermal | OPTICAL_NETWORK, COOLING | 2 |
| power_dc | Power / Data Ctr | POWER_INFRA, DATA_CENTER_INFRA | 2 |
| facility | Facility / Materials | CLEANROOM_WATER, SPECIALTY_GAS, RAW_MATERIAL, GLASS_SUBSTRATE | 4 |
| **Total** | | | **13** |

- Rendered group count: **6** ✅
- Rendered bucket count: **13** ✅
- Missing bucket ids: **none** ✅
- Duplicate bucket ids: **0** ✅
- Dev-time count guard: `if (all.length !== 13 || unique.size !== 13) console.warn(...)` ✅

### WORK_ORDER naming discrepancy (non-issue)

QA 1 expected group map references `FOUNDRY_PACKAGING` as a bucket ID.
The actual `AIInfraBucketId` is `PACKAGING`. The WORK_ORDER document contains
a naming error. Code uses the correct ID `PACKAGING`. No code change required.

---

## Current Flow Summary QA

| Check | Status |
|-------|--------|
| Generated from bucket data, not hardcoded | ✅ `buildFlowSummary(groups)` |
| Maximum 1–2 lines | ✅ `.slice(0, 2)` clauses joined with `"; "` |
| Explains flow direction | ✅ leading → improving → data-limited |
| Avoids numeric scores | ✅ no RS, score, or coverage numbers in summary |
| Avoids trading language | ✅ uses "leadership", "participation", "data-limited" |

**Generation rule:**
1. All DATA_LIMITED → "Broad infrastructure data coverage is limited."
2. Leading + improving → "[Leading] leadership extending into [Improving]; [DL] remain data-limited."
3. Leading only → "[Leading] leadership concentrated; [DL] remain data-limited."
4. Improving only → "[Improving] showing participation; [DL] remain data-limited."

---

## Status Label QA

| Check | Status |
|-------|--------|
| Labels used instead of numeric scores | ✅ no RS/score numbers on ladder cards |
| DATA_LIMITED color conservative (`#8b9098`) | ✅ |
| CONFIRMED/LEADING color distinct (`#22c55e`) | ✅ |
| Facility/Materials shows conservative style if mostly data-limited | ✅ `caution` or `data_limited` status |
| GLASS_SUBSTRATE / RAW_MATERIAL groups not styled as confirmed | ✅ |
| Story-heavy / indirect risk shows RISK badge | ✅ amber `RISK` badge when `hasRisk` true |

---

## Earnings / Risk Overlay QA

| Group | Expected Earnings | Expected Risk | Status |
|-------|------------------|---------------|--------|
| AI Core | CNF (NVDA/AMD confirmed) | none | ✅ `bestEarnings` picks CONFIRMED first |
| Memory / Supply | PRT/WCH expected | none | ✅ |
| Manufacturing / Pkg | WCH/PRT | possible | ✅ |
| Network / Thermal | PRT (OPTICAL_NETWORK E-5B floor) | none | ✅ |
| Power / Data Ctr | WCH/PRT | possible | ✅ |
| Facility / Materials | D/L (GLASS/RAW DATA_LIMITED) | RISK badge | ✅ `hasRisk = story_heavy || indirect_exp || comm_risk` |

- `bestEarnings()` picks highest quality level across group tiles (CONFIRMED first, UNKNOWN last) ✅
- `hasRisk` badge: amber `RISK` compact label ✅
- DATA_LIMITED badge color: `#8b9098` (conservative) ✅

---

## Click Behavior QA

| Check | Status |
|-------|--------|
| Group card click → representative bucket selected | ✅ |
| Bucket name click → direct bucket selected | ✅ `e.stopPropagation()` prevents group click |
| Selected theme updates ThemeDetailDrawer | ✅ `onSelect` → ThemeMapPanel `handleSelect` → `selectedId` → `selectedTile` |
| Tile highlight consistent (flow ladder + tile grid + heatmap) | ✅ same `selectedId` state |
| No stale theme after filter change | ✅ `selectedTile` from full `tiles`, not `filteredTiles` |

**Representative bucket selection priority (documented in TM-4 doc):**
1. LEADING state bucket in group
2. Highest `state_score` bucket (if any non-null score)
3. First bucket in group definition order

---

## Filter Interaction QA

| Check | Status |
|-------|--------|
| Flow structure preserved under all filters | ✅ opacity mute, NOT display:none |
| Non-matching group opacity 0.4 | ✅ `opacity: isFiltered && !highlighted ? 0.4 : 1` |
| Matching groups at full opacity with status-color border | ✅ `highlighted ? statusColor + '44' : V.border` |
| Individual bucket name opacity 0.45 if not in filteredIds | ✅ per-bucket opacity in names list |
| `filter === 'all'` → all groups full opacity | ✅ `isFiltered = filter !== 'all'` |
| Empty filter result safe | ✅ no buckets match → all groups muted, structure visible |

---

## Responsive QA

| Width | Layout | Status |
|-------|--------|--------|
| ≥768px | Flex row, equal-width cards, `overflowX: auto` | ✅ |
| <768px | Flex column, full-width cards, no scroll | ✅ |
| ≥768px separator | `›` horizontal arrow | ✅ |
| <768px separator | `↓` vertical arrow | ✅ |
| Mobile side-by-side | Absent | ✅ |
| Mobile horizontal scroll | Absent | ✅ |
| Font ≥ 10px | ✅ minimum 10px (group label) | ✅ |

---

## Theme Map Regression

| Component | Status |
|-----------|--------|
| THEME MAP tab renders | ✅ |
| 13 themes in tile grid | ✅ unchanged |
| Filter chips work | ✅ unchanged |
| Tile grid works | ✅ unchanged |
| Heatmap works | ✅ unchanged |
| ThemeDetailDrawer works | ✅ unchanged |
| Earnings badges correct | ✅ unchanged |
| Risk markers correct | ✅ unchanged |

---

## Existing Tabs Regression

| Tab | Status |
|-----|--------|
| VALUE CHAIN | ✅ unchanged |
| HEATMAP | ✅ unchanged |
| EARNINGS | ✅ unchanged |
| STATE LABELS | ✅ unchanged |
| RELATIVE STRENGTH | ✅ unchanged |
| RRG | ✅ unchanged |
| Compact Bridge Summary | ✅ rendered before tab bar, unaffected |
| Benchmark selector | ✅ unchanged |
| API loading/error state | ✅ ThemeMapPanel unchanged except render additions |
| API unchanged | ✅ |

---

## Issues Found

### Issue 1 — LABEL (Fixed): Group labels abbreviated, less readable in flow summary

**Description:** Groups 3 and 6 used abbreviated labels ("Mfg / Packaging",
"Facility / Matls") which appeared in the Current Flow Summary text:
"…leadership extending into Mfg / Packaging; Facility / Matls remain data-limited."

These read unnaturally. Labels are also the source for summary text, so
readability matters.

**Fix:**
```
Group 3: 'Mfg / Packaging' → 'Manufacturing / Pkg'
Group 6: 'Facility / Matls' → 'Facility / Materials'
```

**Alignment:** Matches WORK_ORDER TM-4 group naming ("Manufacturing / Packaging",
"Facility / Materials") while remaining compact for horizontal card display.

---

## Minor Fixes Applied

| Fix | File | Description |
|-----|------|-------------|
| Group 3 label | ThemeFlowLadder.tsx | 'Mfg / Packaging' → 'Manufacturing / Pkg' |
| Group 6 label | ThemeFlowLadder.tsx | 'Facility / Matls' → 'Facility / Materials' |

---

## Final Report

| Item | Result |
|------|--------|
| Files inspected | ThemeFlowLadder.tsx, ThemeMapPanel.tsx, aiInfraBucketMap.ts, aiInfraStateLabels.ts, aiInfraEarningsConfirmation.ts |
| Files created | SEMICONDUCTOR_THEME_MAP_TM4B_FLOW_LADDER_QA.md |
| Files modified | ThemeFlowLadder.tsx (2 label fixes) |
| Flow Ladder QA status | ✅ PASS |
| Rendered group count | ✅ 6 |
| Rendered bucket count | ✅ 13 |
| Missing bucket ids | ✅ none |
| Duplicate bucket ids | ✅ 0 |
| Current Flow Summary status | ✅ rule-based, not hardcoded |
| Status labels vs numeric exposure | ✅ labels dominant, no numeric scores in cards |
| Earnings/risk overlay status | ✅ best-earnings badge + RISK badge per group |
| Click behavior status | ✅ priority-based representative + direct bucket, no conflicts |
| Filter interaction status | ✅ muted not hidden, flow structure preserved |
| Responsive status | ✅ horizontal ≥768px, vertical <768px, no mobile horizontal scroll |
| Mobile horizontal scroll absent? | ✅ |
| Theme Map regression | ✅ none |
| Existing tabs regression | ✅ none |
| API unchanged? | ✅ |
| TypeScript status | ✅ exit 0 |
| Forbidden language check | ✅ no buy/sell/매수/매도/predicts |
| Issues found | 1 (label abbreviation, fixed) |
| Minor fixes applied | 2 (label cleanup) |
| Remaining limitations | Flow summary labels in English only; group card labels may truncate on very narrow (<900px) desktop viewports if all 6 groups compressed; secondary_bucket membership not reflected in flow grouping |
| Recommended next step | **READY_FOR_IA1_SIMPLIFICATION** |

---

## Recommendation

**READY_FOR_IA1_SIMPLIFICATION**

The Theme Map now has 4 layers (Flow Ladder → Filter Chips → Tile Grid → Heatmap →
Detail Drawer). Before adding TM-5 Momentum Curve, recommend IA-1 to audit and
reduce visual density — remove or collapse redundant numeric displays, consolidate
badges, and ensure the flow-first reading order is clean.
