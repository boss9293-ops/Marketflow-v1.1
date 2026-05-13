# Semiconductor Theme Map TM-3B Detail Drawer QA

> Date: 2026-05-12
> Phase: TM-3B
> Status: PASS (2 fixes applied)

---

## Purpose

QA for TM-3 ThemeDetailDrawer.
Verify 6-section render, earnings/risk/symbol/watch-next accuracy, benchmark
switch behavior, responsive layout, and regression against existing tabs.

---

## Tile Selection QA

| Check | Status |
|-------|--------|
| Tile click opens drawer | ✅ |
| Selected tile visually highlighted (teal border) | ✅ |
| Same tile click closes drawer (toggle) | ✅ `prev === id ? null : id` |
| Different tile updates drawer | ✅ selectedTile re-computed from tiles memo |
| Filter change: no invalid stale selected theme | ✅ filteredTiles doesn't contain selectedId if filtered out; drawer still shows (selectedTile from full tiles, not filteredTiles) |
| Benchmark change: drawer updates to new benchmark | ✅ **Fix applied** — see Issue 1 |
| Stale RS/earnings data after benchmark switch | ✅ auto-updates via tiles useMemo dep on benchmark |

**Benchmark switch behavior (TM-3B amendment):**
- `selectedId` is preserved across benchmark change
- Filter resets to All (retained from TM-2B)
- `tiles` memo recalculates with new `benchmark` → new RS values
- `selectedTile` memo re-derives from updated tiles → drawer shows new benchmark RS

---

## Section Rendering QA

| Section | Status |
|---------|--------|
| 1. Theme Header | ✅ name / state / score / bucket_id / benchmark / conf / cov / data / RS row |
| 2. WHY THIS STATE | ✅ **Fix applied** — fallback text when empty |
| 3. EARNINGS CONFIRMATION | ✅ level / score / coverage / evidence / caution / DATA_LIMITED box |
| 4. RISK & DATA QUALITY | ✅ RiskBadge list / "No active risk flags" fallback |
| 5. RELATED SYMBOLS | ✅ sorted by evidence level then purity score, max 6 |
| 6. WATCH NEXT | ✅ priority-ordered, max 3, no trading language |
| Missing data safe fallback | ✅ `fmt()` returns `—`, "No mapped symbols available", bullets truncated |
| No undefined/null/NaN | ✅ `?? null` / `?? 0` / `?? ''` guards throughout |
| Font size ≥ 10px | ✅ minimum 10px (decorative bucket_id label) |
| No emoji | ✅ |

---

## Earnings QA

| Theme | Expected Level | Verified |
|-------|---------------|---------|
| AI_CHIP | CONFIRMED possible (NVDA/AMD strong evidence) | reads `e?.confirmation_level` — not overridden ✅ |
| OPTICAL_NETWORK | PARTIAL (E-5B floor preserved) | reads from `computeAllBucketEarningsConfirmation()` ✅ |
| GLASS_SUBSTRATE | DATA_LIMITED (PRE_COMMERCIAL, score 0) | grey box shown, not green/teal ✅ |
| RAW_MATERIAL | DATA_LIMITED (INDIRECT only, score 0) | grey box shown ✅ |
| TEST_EQUIPMENT | NOT_CONFIRMED expected | conservative badge, not confused with CONFIRMED ✅ |

- DATA_LIMITED visual: grey background `rgba(139,144,152,0.08)`, color V.text3, not green/teal ✅
- CONFIRMED footnote: "Business evidence only. Not a trading signal." ✅
- PARTIAL footnote: same ✅
- DATA_LIMITED/null box: "Insufficient company-level evidence to confirm earnings theme" ✅

---

## Risk / Data Quality QA

| Flag | Display | Status |
|------|---------|--------|
| story_heavy | "Story Heavy" amber badge | ✅ |
| comm_risk | "Comm. Risk" amber badge | ✅ |
| indirect_exp | "Indirect" amber badge | ✅ |
| coverage_ratio < 0.5 (and > 0) | "Low Coverage" amber badge | ✅ |
| state_label === DATA_INSUFFICIENT | "Data Insufficient" amber badge | ✅ |
| risk_flags: OVERHEAT_RISK | "Overheat" amber badge | ✅ |
| risk_flags: MOMENTUM_STRETCH | "Momentum Stretch" amber badge | ✅ |
| No flags | "No active risk flags" text (V.text3) | ✅ |
| GLASS_SUBSTRATE / RAW_MATERIAL not over-stated | DATA_LIMITED + relevant badges only, not "strong" | ✅ |

---

## Related Symbols QA

**Sort order verification (TM-3B amendment):**
```
EARN_RANK = { CONFIRMED: 0, PARTIAL: 1, WATCH: 2, NOT_CONFIRMED: 3, DATA_LIMITED: 4, UNKNOWN: 5 }
No evidence record → rank 6 (sorted last)

Primary: ev_rank ascending (CONFIRMED first)
Secondary: ai_infra_relevance_score descending
Slice: .slice(0, 6)
```

| Check | Status |
|-------|--------|
| Source: AI_INFRA_COMPANY_PURITY.filter(primary_bucket === bucket_id) | ✅ |
| CONFIRMED evidence symbols sort first | ✅ EARN_RANK[CONFIRMED] = 0 |
| DATA_LIMITED / UNKNOWN sort last | ✅ rank 4/5 |
| No evidence → sorted after DATA_LIMITED | ✅ rank 6 |
| Tiebreaker: ai_infra_relevance_score descending | ✅ |
| Maximum 6 symbols | ✅ `.slice(0, 6)` |
| Per row: ticker · company · purity label · evidence badge | ✅ |
| Missing evidence: badge not shown | ✅ `sym.ev_level != null` guard |
| Fallback: "No mapped symbols available" | ✅ |
| No secondary_buckets included | intended — primary_bucket match only |

---

## Watch Next QA

| Item type | Trigger condition | Text | Trading language? |
|-----------|------------------|------|------------------|
| Evidence gap | RS 3M or 6M > +5% AND not CONFIRMED/PARTIAL | "Evidence gap: RS outpacing earnings confirmation. Watch for revenue visibility improvement." | ✅ none |
| Commercialization risk | story_heavy OR comm_risk | "Commercialization risk: Monitor whether design activity converts to confirmed revenue." | ✅ none |
| Data limited | DATA_LIMITED or null or coverage < 50% | "Data limited: More company-level evidence needed before confirmation level improves." | ✅ none |
| Indirect exposure | indirect_exp | "Indirect exposure: Sector benefit depends on downstream AI infrastructure adoption." | ✅ none |
| Default | None of the above | "Confirmation quality: Watch for broadening evidence across covered companies next quarter." | ✅ none |
| Maximum 3 items | `.slice(0, 3)` | — | ✅ |
| Priority order applied | First matching conditions win | — | ✅ |

Forbidden words absent: buy / sell / entry / exit / target / 매수 / 매도 / 진입 / 추천 / predicts / guarantees ✅

---

## Responsive QA

| Width | Drawer | Status |
|-------|--------|--------|
| ≥1024px | Full-width below 3-col tile grid | ✅ |
| ≥768px | Full-width below 2-col tile grid | ✅ |
| <768px | Full-width, single column | ✅ |
| All | No horizontal scroll on drawer | ✅ flexWrap on all rows |
| All | No side-by-side mobile layout | ✅ |
| All | Font ≥ 10px | ✅ |

---

## Regression

| Component | Status |
|-----------|--------|
| THEME MAP tab renders | ✅ |
| 13 themes exactly once | ✅ AI_INFRA_BUCKETS canonical list |
| Filter chips work | ✅ unchanged logic |
| Tile grid works | ✅ |
| Heatmap respects filter | ✅ filteredTiles passed |
| EARNINGS tab | ✅ existing code untouched |
| VALUE CHAIN / HEATMAP / STATE / RS / RRG | ✅ all untouched |
| API unchanged | ✅ |
| TypeScript tsc --noEmit --skipLibCheck | ✅ exit 0 |
| Forbidden language | ✅ absent |

---

## Issues Found

### Issue 1 — BEHAVIOR FIX: Benchmark switch reset selectedId (TM-3B amendment)

**Description:** TM-2B required `setSelectedId(null)` on benchmark change (close drawer). TM-3B
amends this: drawer should UPDATE with new benchmark data, not close.

**Root cause:** Old `useEffect` ran `setFilter('all'); setSelectedId(null)` on benchmark change.
This closed the drawer. But `tiles` memo already has `benchmark` as a dep — so RS values
auto-refresh when benchmark changes. The selected theme always exists (all 13 buckets
always present in tiles regardless of benchmark).

**Fix:**
```typescript
// Before (TM-2B behavior)
useEffect(() => {
  setFilter('all')
  setSelectedId(null)  // ← removed
}, [benchmark])

// After (TM-3B behavior)
useEffect(() => {
  setFilter('all')
  // selectedId preserved — drawer auto-updates via tiles useMemo dep on benchmark
}, [benchmark])
```

**Result:** Benchmark switch while drawer open → filter resets to All, drawer stays
open and immediately shows new benchmark RS values (from `getBenchmarkRS` with updated
benchmark key). Stale data impossible — tiles memo recalculates on every benchmark change.

---

### Issue 2 — UX FIX: WHY THIS STATE blank when state_reason and state_drivers empty

**Description:** Section 2 used conditional rendering `{(tile.state_reason || tile.state_drivers.length > 0) && ...}`.
When both are empty (placeholder/new bucket), the section was entirely hidden — blank gap
in drawer.

**Fix:** Section always renders. When empty, shows fallback:
```
• State classification based on RS and RRG signals.
```

---

## Minor Fixes Applied

| Fix | File | Description |
|-----|------|-------------|
| Benchmark switch: preserve selectedId | ThemeMapPanel.tsx | Remove `setSelectedId(null)` from benchmark useEffect |
| WHY THIS STATE fallback text | ThemeMapPanel.tsx | Always render section; show fallback when reason + drivers empty |

---

## Final Report

| Item | Result |
|------|--------|
| Files inspected | ThemeMapPanel.tsx, aiInfraEarningsConfirmation.ts, aiInfraCompanyPurity.ts |
| Files created | SEMICONDUCTOR_THEME_MAP_TM3B_DETAIL_DRAWER_QA.md |
| Files modified | ThemeMapPanel.tsx (2 minor fixes) |
| Tile click status | ✅ PASS |
| Selected theme validity | ✅ correct theme always shown |
| Benchmark switch: drawer data updated? | ✅ auto-update via tiles useMemo |
| WHY THIS STATE empty state handled with fallback text? | ✅ |
| 6 sections render? | ✅ all 6 |
| Earnings integration status | ✅ level / score / coverage consistent with EARNINGS tab |
| Risk/data quality status | ✅ all flags covered |
| Related symbols status | ✅ sorted by evidence level → purity score, max 6 |
| Watch Next language status | ✅ no trading language, max 3, priority-ordered |
| Responsive status | ✅ full-width all breakpoints |
| Existing Theme Map regression | ✅ none |
| Existing tabs regression | ✅ none |
| API unchanged? | ✅ |
| TypeScript status | ✅ exit 0 |
| Forbidden language check | ✅ clean |
| Issues found | 2 (both fixed) |
| Minor fixes applied | 2 |
| Remaining limitations | Related symbols: secondary_bucket matches not included; state_drivers may be empty for PLACEHOLDER data quality buckets |
| Recommended next step | **READY_FOR_TM4_FLOW_LADDER** |

---

## Recommendation

**READY_FOR_TM4_FLOW_LADDER**

TM-4 target: Flow Ladder — static value chain stage flow visualization with
upstream/downstream linkage between the 13 buckets across 5 stages.
