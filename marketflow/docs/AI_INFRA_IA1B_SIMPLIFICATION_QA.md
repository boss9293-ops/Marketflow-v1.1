# AI Infra Hub IA-1B Simplification QA

> Date: 2026-05-12
> Phase: IA-1B
> Status: PASS (2 fixes applied)

---

## Purpose

QA for IA-1 Theme Map simplification. Verify heatmap collapse, tile number reduction,
Evidence Gap filter correctness, and regression against all existing tabs.

---

## QA 1 — Default Screen Simplification

| Check | Status |
|-------|--------|
| Current Flow Summary visible at top | ✅ ThemeFlowLadder renders first |
| Theme Flow Ladder visible | ✅ always rendered above filter chips |
| Filter Chips visible | ✅ below Flow Ladder |
| Tile Grid visible (compact form) | ✅ label + state badge + earnings badge |
| Heatmap collapsed by default | ✅ `isHeatmapExpanded` default `false` |
| Detail Drawer not overwhelming | ✅ only opens on tile click; 6 sections but progressive |
| No RS/score/coverage numbers in default tile view | ✅ removed from render |

---

## QA 2 — Advanced Matrix Toggle + Benchmark Behavior

| Check | Status |
|-------|--------|
| Default state collapsed (`isHeatmapExpanded = false`) | ✅ |
| `▸ ADVANCED MATRIX` button opens heatmap | ✅ `setIsHeatmapExpanded(p => !p)` |
| `▾ ADVANCED MATRIX` button closes heatmap | ✅ toggle |
| Benchmark switch while COLLAPSED → remains collapsed | ✅ `isHeatmapExpanded` not in benchmark useEffect |
| Benchmark switch while EXPANDED → **remains expanded** | ✅ same — benchmark useEffect only calls `setFilter('all')` |
| Filter applied to heatmap rows | ✅ `filteredTiles` passed to ThemeHeatmap |
| Layout intact after toggle | ✅ conditional render, no layout shift artifacts |

**Benchmark switch behavior (amendment):**
`isHeatmapExpanded` is a local state that survives benchmark change.
The benchmark `useEffect` only resets filter: `setFilter('all')`.
No `setIsHeatmapExpanded` call exists in the benchmark effect.
→ Heatmap expanded state fully preserved across benchmark switch. ✅

---

## QA 3 — Tile Number Exposure + Mobile Hover Fallback

| Check | Status |
|-------|--------|
| Default tile: Theme label visible | ✅ 13px, V.text |
| Default tile: State badge visible | ✅ StateBadge component |
| Default tile: Earnings badge visible | ✅ EarningsBadge component |
| Default tile: Risk badges visible (if any) | ✅ up to 2 badges |
| Default tile: RS 3M hidden | ✅ only renders on hover |
| Default tile: state_score hidden | ✅ only renders on hover |
| Default tile: coverage/data_quality hidden | ✅ removed entirely (Detail Drawer only) |
| Desktop hover → RS 3M + score visible | ✅ `hovered && !isMobile` guard |
| Mobile tile → numbers NOT visible on tap | ✅ `isMobile = windowWidth < 768`; hover section gated |
| Numbers on mobile available in Detail Drawer only | ✅ drawer renders full RS 1M/3M/6M + score |

**Mobile hover fix (amendment):**
`ThemeTile` receives `isMobile: boolean` prop (`windowWidth < 768` from ThemeMapPanel).
Hover number reveal guarded: `hovered && !isMobile && (...)`.
On mobile, even if `mouseenter` fires on touch, `isMobile` is `true` → numbers stay hidden.
Fail condition (numbers visible on mobile tile) cannot occur. ✅

---

## QA 4 — Filter Order + Evidence Gap

| Check | Status |
|-------|--------|
| Filter order: All first | ✅ |
| Filter order: Leading, Improving, Evidence Gap, Data Limited (primary 5) | ✅ |
| Filter order: Watch, Crowded, Story Heavy, Indirect, Confirmed Evidence (secondary 5) | ✅ |
| Evidence Gap definition: LEADING/EMERGING/CONFIRMING state | ✅ **fixed** |
| Evidence Gap definition: WATCH/NOT_CONFIRMED/DATA_LIMITED/null earnings | ✅ **fixed** |
| Evidence Gap does NOT capture DATA_LIMITED themes only | ✅ requires strong state AND weak earnings |
| Evidence Gap does NOT capture only earnings-weak themes | ✅ requires LEADING/EMERGING/CONFIRMING state |
| All filter resets correctly | ✅ `setFilter('all')` on benchmark change |
| Empty result safe fallback | ✅ "No themes match the selected filter." |

**Evidence Gap fix (amendment):**

IA-1 original used RS > +5% as proxy for "strong state" — too indirect.
Fix: direct `state_label` check.

```
Before: (rs_3m > 5 || rs_6m > 5) && earnings != CONFIRMED/PARTIAL
After:  (state === LEADING | EMERGING | CONFIRMING)
        AND (earnings === WATCH | NOT_CONFIRMED | DATA_LIMITED | null)
```

Captures exactly: momentum-stage themes with unconfirmed earnings —
the highest-priority Watch Next signal.

---

## QA 5 — Flow Ladder Regression

| Check | Status |
|-------|--------|
| 6 groups render | ✅ ThemeFlowLadder unchanged |
| 13 buckets exactly once | ✅ dev-time guard active |
| Current Flow Summary rule-based | ✅ `buildFlowSummary()` |
| Group click selects representative bucket | ✅ |
| Bucket name click selects directly | ✅ |
| Filter mute behavior (opacity 0.4) | ✅ `filteredIds` passed from ThemeMapPanel |
| Mobile vertical layout | ✅ `flexDirection: column` when `windowWidth < 768` |
| `↓` separator on mobile | ✅ |

---

## QA 6 — Detail Drawer Regression

| Check | Status |
|-------|--------|
| Selected theme drawer opens | ✅ |
| All 6 sections render | ✅ Header / WHY / EARNINGS / RISK / SYMBOLS / WATCH NEXT |
| state_reason truncated at 140 chars | ✅ max ~2 visual lines |
| Related symbols max 6 | ✅ `.slice(0, 6)` |
| Watch Next max 3 | ✅ `.slice(0, 3)` |
| Earnings/risk/symbol/watch next correct | ✅ |
| No overflow horizontal scroll | ✅ `flexWrap` on all rows |

---

## QA 7 — Responsive

| Width | Status |
|-------|--------|
| ≥1024px — 3-col tile grid | ✅ |
| ≥768px — 2-col tile grid | ✅ |
| <768px — 1-col tile grid | ✅ |
| <768px — Flow Ladder vertical | ✅ |
| All widths — no horizontal scroll | ✅ |
| All widths — font ≥ 10px | ✅ |
| Mobile tile: no RS/score numbers | ✅ `isMobile` guard |

---

## QA 8 — Existing Tabs Regression

| Tab | Status |
|-----|--------|
| VALUE CHAIN | ✅ unchanged |
| THEME MAP | ✅ simplified + fixes applied |
| HEATMAP | ✅ unchanged (separate tab) |
| EARNINGS | ✅ unchanged |
| STATE LABELS | ✅ unchanged |
| RELATIVE STRENGTH | ✅ unchanged |
| RRG | ✅ unchanged |
| Benchmark selector | ✅ unchanged |
| API unchanged | ✅ |

---

## Forbidden Language Check

Absent: buy / sell / strong buy / entry / exit / target price / trading signal /
매수 / 매도 / 진입 / 청산 / 목표가 / 추천 / predicts / guarantees / will happen ✅

---

## Issues Found + Fixes Applied

### Issue 1 — QA 4: Evidence Gap filter definition incorrect (FIXED)

**Description:** IA-1 implemented Evidence Gap using `RS > +5%` as proxy for strong state.
This can capture LAGGING/WATCH buckets with momentarily high RS, and misses LEADING
buckets with RS < +5% (data gaps, null RS).

**Fix:**
```
Before: (rs_3m > 5 || rs_6m > 5) AND earnings != CONFIRMED/PARTIAL
After:  state IN (LEADING, EMERGING, CONFIRMING)
        AND earnings IN (WATCH, NOT_CONFIRMED, DATA_LIMITED, null)
```

**File:** ThemeMapPanel.tsx `applyFilter` case `'evidence_gap'`

---

### Issue 2 — QA 3: Mobile hover fallback missing (FIXED)

**Description:** `ThemeTile` had no guard against mobile touch triggering hover reveal.
On some mobile browsers, `mouseenter` fires on first tap, making RS/score briefly visible
before `onClick` opens the Detail Drawer. Amendment requires numbers invisible on mobile
tile without tap/detail interaction.

**Fix:**
- `ThemeTile` receives `isMobile: boolean` prop
- `isMobile = windowWidth < 768` passed from `ThemeMapPanel`
- Hover number reveal guarded: `hovered && !isMobile && (...)`

**Files:** ThemeMapPanel.tsx `ThemeTile` component + render call

---

## Minor Fixes Applied

| Fix | File | Description |
|-----|------|-------------|
| Evidence Gap filter | ThemeMapPanel.tsx | RS-based → state_label + earnings_level based |
| Mobile hover guard | ThemeMapPanel.tsx | `isMobile` prop + `!isMobile` guard in hover reveal |

---

## Final Report

| Item | Result |
|------|--------|
| Files inspected | ThemeMapPanel.tsx, ThemeFlowLadder.tsx, AI_INFRA_IA1_SIMPLIFICATION.md |
| Files created | AI_INFRA_IA1B_SIMPLIFICATION_QA.md |
| Files modified | ThemeMapPanel.tsx (2 fixes) |
| Heatmap collapsed by default? | ✅ |
| Advanced Matrix toggle status | ✅ opens/closes; persists across benchmark switch |
| Benchmark switch while expanded: remained expanded? | ✅ `isHeatmapExpanded` not in benchmark useEffect |
| Tile numeric exposure reduced? | ✅ RS/score/coverage removed from default |
| Evidence Gap filter: captures LEADING/IMPROVING + weak earnings correctly? | ✅ fixed to state_label + earnings_level |
| Flow Ladder regression | ✅ none |
| Detail Drawer regression | ✅ none |
| Responsive status | ✅ all breakpoints clean |
| Mobile tile numbers absent? | ✅ `isMobile` guard applied |
| Existing tabs regression | ✅ none |
| API unchanged? | ✅ |
| TypeScript status | ✅ exit 0 |
| Forbidden language check | ✅ clean |
| Issues found | 2 (both fixed) |
| Minor fixes applied | 2 |
| Remaining limitations | Hover reveal desktop-only (correct by design); tile shows `—` for earnings when null (acceptable); ADVANCED MATRIX toggle doesn't show row count when collapsed |
| Recommended next step | **READY_FOR_IA2_MORE_FILTERS_DRAWER** |
