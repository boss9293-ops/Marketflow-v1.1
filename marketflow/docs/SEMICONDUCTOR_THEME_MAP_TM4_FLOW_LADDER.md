# Semiconductor Theme Map TM-4 Flow Ladder

> Date: 2026-05-12
> Phase: TM-4
> Status: COMPLETE

---

## Purpose

Add a **Theme Flow Ladder** to the THEME MAP tab that visualizes the AI
semiconductor value chain as a directional flow from AI Core → Facility/Materials.
Goal: let users understand where momentum and earnings confirmation are concentrated
without reading numbers.

---

## Data Inputs

No new API routes. All data flows from existing sources.

| Data | Source |
|------|--------|
| state_label, state_score | TileData (from AIInfraBucketState) |
| earnings_level | TileData (from AIInfraBucketEarningsConfirmation) |
| story_heavy, indirect_exp, comm_risk | TileData (derived from AIInfraBucketState.theme_purity) |
| display_name | TileData (from THEME_DISPLAY map in ThemeMapPanel) |

**ThemeMapPanel** passes `tiles: TileData[]` (structurally compatible with
`FlowTileMinimal`) to `ThemeFlowLadder` — no extra API calls.

---

## Flow Groups

6 groups, 13 buckets total, each bucket exactly once.

| # | Group ID | Label | Buckets |
|---|----------|-------|---------|
| 1 | core | AI Core | AI_CHIP |
| 2 | memory | Memory / Supply | HBM_MEMORY |
| 3 | mfg | Mfg / Packaging | PACKAGING, TEST_EQUIPMENT, PCB_SUBSTRATE |
| 4 | net_thermal | Network / Thermal | OPTICAL_NETWORK, COOLING |
| 5 | power_dc | Power / Data Ctr | POWER_INFRA, DATA_CENTER_INFRA |
| 6 | facility | Facility / Matls | CLEANROOM_WATER, SPECIALTY_GAS, RAW_MATERIAL, GLASS_SUBSTRATE |

**Bucket count guard (dev-only):** `console.warn` if total ≠ 13 or unique ≠ 13.

---

## Current Flow Summary Rule

Generated from group status — never hardcoded.

```
1. Identify leading groups (status === 'leading')
2. Identify improving groups (status === 'improving')
3. Identify data_limited groups (status === 'data_limited')

Template:
- If all groups DATA_LIMITED: "Broad infrastructure data coverage is limited."
- If leading groups exist + improving: "[Leading] leadership extending into [Improving]; [DL] remain data-limited."
- If leading only: "[Leading] leadership concentrated; [DL] remain data-limited."
- If improving only: "[Improving] showing participation; [DL] remain data-limited."
- Max 2 clauses joined with "; "
- Fallback: "Flow structure updating."
```

---

## Ladder Layout

### Desktop (≥768px)
- Flex row, `flex: 1 1 0` per card, `minWidth: 100px`
- `overflowX: auto` on container (no layout break)
- `›` separator between groups

### Mobile (<768px)
- Flex column, full-width cards
- `↓` separator between groups
- No horizontal scroll

---

## Status Label Rules

Group status derived from tile data — no new scoring engine.

| Status | Condition | Color |
|--------|-----------|-------|
| leading | any bucket LEADING AND (CONFIRMED or PARTIAL earnings) | `#22c55e` |
| improving | any bucket LEADING (no confirmed earnings), OR any EMERGING/CONFIRMING | `#3FB6A8` |
| watch | any WATCH or NOT_CONFIRMED earnings, not mostly data-limited | `#fbbf24` |
| caution | mostly DATA_LIMITED AND story/indirect/comm risk | `#fbbf24` |
| data_limited | mostly DATA_LIMITED (>50%), no major risk | `#8b9098` |

**Status badge always shown.** Numbers (state_score, RS) shown only at
per-bucket level in ThemeDetailDrawer — not in Flow Ladder cards.

---

## Click Behavior

### Group click → representative bucket selected

**Representative bucket selection priority:**
1. LEADING state bucket in group
2. Highest `state_score` bucket in group (if any score available)
3. First bucket in group definition order

**Why:** Ensures the most meaningful bucket opens in ThemeDetailDrawer first.

### Bucket name click → that bucket directly selected

Individual bucket names within a group card are clickable (`e.stopPropagation()`
prevents group click from also firing).

### All selections update `selectedId` in ThemeMapPanel

ThemeFlowLadder receives `onSelect` callback from ThemeMapPanel. The same
`handleSelect` is used for tile grid, heatmap, and flow ladder — no conflicts.

---

## Filter Behavior

Filter mutes non-matching groups/buckets but does NOT hide them.

```
isFiltered = filter !== 'all'

Group card: opacity 0.4 if isFiltered AND no bucket in group matches filteredIds
Bucket name: opacity 0.45 if isFiltered AND this bucket not in filteredIds
Group card: full opacity if any bucket matches (highlighted with status-color border)
```

**Reason:** Flow structure must remain visible even under filter. The ladder
shows the full value chain; filtering is an overlay, not a destruction.

---

## Responsive Rules

| Width | Layout | Scroll |
|-------|--------|--------|
| ≥768px | Flex row, cards share equal width | overflowX auto |
| <768px | Flex column, full-width cards | No horizontal scroll |
| All | No side-by-side detail drawer | — |
| All | Font ≥ 10px | — |

---

## Non-Goals (TM-4)

- D3 Sankey — deferred
- Animated flow — deferred
- Thickness-encoded capital flow — TM-5 or later
- Momentum Curve sparklines — TM-5
- LLM narrative — deferred
- Portfolio linkage — not in scope
- New API routes — not created
- New scoring engine — not created

---

## QA Result

| Check | Result |
|-------|--------|
| Flow Ladder renders | ✅ |
| 6 groups render | ✅ |
| 13 buckets included exactly once | ✅ (dev-time guard active) |
| Duplicate bucket ids | ✅ 0 |
| Missing bucket ids | ✅ none |
| Current Flow Summary appears | ✅ generated from rule, not hardcoded |
| Current Flow Summary generated from rule, not hardcoded? | ✅ `buildFlowSummary()` |
| Group click representative bucket selection rule documented? | ✅ Priority 1→2→3 |
| Group status labels readable | ✅ Leading/Improving/Watch/Data Limited/Caution |
| Earnings/risk badges appear | ✅ best-earnings badge + RISK badge per group |
| DATA_LIMITED groups conservative | ✅ grey status color `#8b9098` |
| Flow card click updates selected theme/detail | ✅ via `handleSelect` |
| Filters highlight/mute but do not destroy flow | ✅ opacity 0.4, not display:none |
| Mobile vertical layout works | ✅ flexDirection column |
| No horizontal scroll on mobile | ✅ overflowX visible on column layout |
| Theme Tile Grid still works | ✅ unchanged |
| Heatmap still works | ✅ unchanged |
| Detail Drawer still works | ✅ unchanged |
| Existing tabs unaffected | ✅ |
| API unchanged | ✅ |
| TypeScript tsc --noEmit --skipLibCheck | ✅ exit 0 |
| Forbidden language absent | ✅ |

---

## Final Report

| Item | Result |
|------|--------|
| Files inspected | ThemeMapPanel.tsx, aiInfraBucketMap.ts, aiInfraStateLabels.ts, aiInfraEarningsConfirmation.ts |
| Files created | ThemeFlowLadder.tsx, SEMICONDUCTOR_THEME_MAP_TM4_FLOW_LADDER.md |
| Files modified | ThemeMapPanel.tsx |
| Flow Ladder created? | ✅ ThemeFlowLadder.tsx |
| 6 groups rendered? | ✅ |
| 13 buckets included exactly once? | ✅ |
| Duplicate bucket ids? | ✅ 0 |
| Missing bucket ids? | ✅ none |
| Current Flow Summary implemented? | ✅ rule-based, not hardcoded |
| Status labels used instead of excessive numbers? | ✅ no RS/score numbers in ladder cards |
| Earnings/risk overlay status | ✅ best-earnings badge + RISK badge per group |
| Click behavior status | ✅ priority-based representative + direct bucket click |
| Group click representative bucket selection rule documented? | ✅ |
| Filter interaction status | ✅ muted state (opacity 0.4), flow structure preserved |
| Responsive status | ✅ horizontal ≥768px, vertical <768px |
| Mobile horizontal scroll absent? | ✅ |
| Theme Map regression | ✅ none |
| Existing tabs regression | ✅ none |
| API unchanged? | ✅ |
| TypeScript status | ✅ exit 0 |
| Forbidden language check | ✅ no buy/sell/매수/매도/predicts |
| Remaining limitations | Flow summary labels use English (not Korean); secondary bucket membership not shown in ladder; group label text truncated on narrow desktop viewports |
| Recommended next step | **READY_FOR_TM4B_QA** |

---

## Next Step

**READY_FOR_TM4B_QA**

TM-5 target: Momentum Curve — per-theme RS sparkline overlaid on ladder cards
to show trend direction beyond current state snapshot.
