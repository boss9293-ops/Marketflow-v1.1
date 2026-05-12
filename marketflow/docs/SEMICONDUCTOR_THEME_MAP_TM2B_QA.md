# Semiconductor Theme Map TM-2B QA

> Date: 2026-05-12
> Phase: TM-2B
> Status: PASS (minor fixes applied)

---

## Purpose

QA for TM-2 Theme Map MVP.
Verify tab integration, 13-theme render, filter behavior, earnings/risk consistency, responsiveness, and regression.

---

## Tab Integration

**`AIInfrastructureRadar.tsx` tab type:**
```typescript
type ActiveTab = 'ladder' | 'theme' | 'heatmap' | 'earnings' | 'state' | 'rs' | 'rrg'
```

**Tab bar order:**
```
VALUE CHAIN | THEME MAP | HEATMAP | EARNINGS | STATE LABELS | RELATIVE STRENGTH | RRG
```

- THEME MAP tab exists ✅
- Position: after VALUE CHAIN, before HEATMAP ✅
- Tab switching: existing tabs untouched ✅
- Benchmark selector: shared with parent, passes to ThemeMapPanel ✅
- Navigation density: 7 tabs — within navigable range ✅

---

## 13 Theme Count

**Source:** `AI_INFRA_BUCKETS.map(def => ...)` — canonical 13-item list, not from API states array.

| Bucket ID | Display Label |
|-----------|--------------|
| AI_CHIP | AI Compute |
| HBM_MEMORY | HBM / Memory |
| PACKAGING | Foundry / Packaging |
| TEST_EQUIPMENT | Test / Inspection |
| PCB_SUBSTRATE | PCB / Substrate |
| OPTICAL_NETWORK | Optical / Network |
| COOLING | Cooling / Thermal |
| POWER_INFRA | Power Infrastructure |
| DATA_CENTER_INFRA | Data Center Infra |
| CLEANROOM_WATER | Cleanroom / Water |
| SPECIALTY_GAS | Specialty Gas |
| RAW_MATERIAL | Raw Materials |
| GLASS_SUBSTRATE | Glass Substrate |

- Total rendered themes: **13** ✅
- Missing bucket_ids: **none** ✅
- Duplicate bucket_ids: **0** (dedup guard active) ✅
- Order: follows `AI_INFRA_BUCKETS` definition order ✅

---

## Filter QA

| Filter key | Logic | Status |
|-----------|-------|--------|
| all | true | ✅ |
| leading | state_label === LEADING | ✅ |
| improving | state_label === EMERGING \| CONFIRMING | ✅ |
| watch | state_label === LAGGING \| DISTRIBUTION \| DATA_INSUFFICIENT | ✅ |
| crowded | state_label === CROWDED | ✅ |
| confirmed | earnings_level === CONFIRMED \| PARTIAL | ✅ |
| data_limited | earnings_level === DATA_LIMITED \| null | ✅ |
| story_heavy | theme_purity === STORY_HEAVY \| state_label === STORY_ONLY | ✅ |
| indirect | theme_purity === INDIRECT_EXPOSURE | ✅ |

- Default filter on load: **All** (`useState<FilterKey>('all')`) ✅
- Filter resets on benchmark change: `useEffect(() => { setFilter('all'); setSelectedId(null) }, [benchmark])` ✅
- Filter does NOT persist across benchmark switches ✅
- **Benchmark switch filter reset rule confirmed:** switch benchmark while non-All filter active → filter returns to All ✅
- Filter applies to both tile grid AND heatmap ✅
- Empty filter result: renders "No themes match the selected filter." (no crash) ✅
- Filter chip change also clears selectedId (explicit in onChange handler) ✅

---

## Tile Grid QA

Each tile displays:
- Theme label (13px, V.ui) ✅
- State badge (11px, STATE_COLORS background) ✅
- State score (12px, state color) ✅
- RS 3M (12px, rsColFn color-coded) ✅
- Earnings badge (11px, EARN_COLORS) ✅
- Risk markers (up to 3, amber, 10px) ✅
- Coverage label (10px decorative) ✅
- Data quality warning if not REAL/MANUAL ✅

- DATA_LIMITED visually distinct: #8b9098 badge (not green/teal) ✅
- Confirmed evidence: green/teal badge — distinct from DATA_LIMITED ✅
- Story-heavy marker: "Story Heavy" amber risk marker ✅
- Indirect marker: "Indirect" amber risk marker ✅
- No undefined/null/NaN: `fmt()` and null checks applied throughout ✅
- Font size: minimum 10px (decorative coverage label) ✅
- No emoji ✅

---

## Heatmap QA

Columns: THEME | STATE | SCORE | RS 1M | RS 3M | RS 6M | EARNINGS | RISK | COV

- Filter applies to heatmap rows (filteredTiles passed, not full tiles) ✅
- Missing values show `—` (fmt() returns `—` for null) ✅
- No NaN (isFinite check in getBenchmarkRS) ✅
- RS values color-coded by rsColFn ✅
- Risk abbreviated: CR / IN / SH / OH / MS with legend below table ✅
- Earnings abbreviated: CNF / PRT / WCH / N/C / D/L ✅
- minWidth: 640 with overflowX: auto (heatmap scrollable on narrow viewports) ✅
- Column headers at #B8C8DC (V.text2) ✅
- Heatmap rows sorted by state_score descending ✅

---

## Detail Card QA

**Click behavior (amendment QA 6):**
- Click tile: selects theme, shows detail card ✅
- Click same tile again: deselects (toggle pattern: `prev === id ? null : id`) ✅
- Click different tile: updates detail card to new selection ✅
- Click ✕ button: closes detail card ✅
- Click outside (outer div): closes detail card via handleDismiss ✅
- Benchmark switch → detail card resets: `setSelectedId(null)` in benchmark useEffect ✅
- No stale selected theme after benchmark switch ✅

**Content:**
- Theme name ✅
- State badge ✅
- Score + RS 1M/3M/6M + Earnings + Coverage + Confidence ✅
- State reason ✅
- Evidence summary ✅
- Caution summary (amber) ✅
- Top symbols (from AI_INFRA_BUCKETS.symbols) ✅
- Risk flags (all flags displayed) ✅
- Data quality ✅
- "Business evidence only. Not investment advice." footer ✅

---

## Earnings / Risk Consistency

| Theme | Expected Level | Verification |
|-------|---------------|-------------|
| AI_CHIP | CONFIRMED possible (ANET/NVDA strong evidence) | reads from API — not overridden ✅ |
| OPTICAL_NETWORK | **PARTIAL** (E-5B floor rule, not CONFIRMED/WATCH) | reads from `computeAllBucketEarningsConfirmation()` — E-5B floor preserved ✅ |
| GLASS_SUBSTRATE | DATA_LIMITED (GLW PRE_COMMERCIAL, score=0) | `earnings_level: null → DATA_LIMITED display`, story_heavy marker active ✅ |
| RAW_MATERIAL | DATA_LIMITED (FCX INDIRECT, score=0) | `earnings_level: null → DATA_LIMITED display`, indirect_exp marker active ✅ |

**ThemeMapPanel does NOT override earnings levels.** It reads directly from API:
```typescript
earnings_level: e?.confirmation_level ?? null
```

- OPTICAL_NETWORK = PARTIAL: preserved via `computeAllBucketEarningsConfirmation()` + E-5B floor ✅
- E-5B floor rule location: `aiInfraEarningsConfirmation.ts` — not touched by TM-2 ✅
- DATA_LIMITED themes visually distinct from CONFIRMED: different color + label ✅
- Story-heavy theme (GLASS_SUBSTRATE): story_heavy marker + DATA_LIMITED earnings ✅
- Indirect-only theme (RAW_MATERIAL): indirect_exp marker + DATA_LIMITED earnings ✅

---

## Responsive QA

| Width | Tile Grid | Detail Card | Filter Chips |
|-------|-----------|-------------|--------------|
| ≥1024px | 3 columns | Full-width below tiles | Wrapping row |
| ≥768px | 2 columns | Full-width below tiles | Wrapping row |
| <768px | 1 column | Full-width below tiles | Wrapping (no h-scroll) |

- Heatmap: `overflowX: auto` + `minWidth: 640` — scrollable if viewport narrow ✅
- Filter chips: `flexWrap: wrap` — no horizontal scroll ✅
- Detail card: full-width, NOT side-by-side ✅
- Font size: minimum 10px throughout ✅

---

## Regression

- Compact Bridge Summary: rendered before tab bar — unaffected ✅
- VALUE CHAIN (`tab === 'ladder'`): existing code, not modified ✅
- HEATMAP (`tab === 'heatmap'`): existing code, not modified ✅
- EARNINGS (`tab === 'earnings'`): existing code, not modified ✅
- STATE LABELS (`tab === 'state'`): existing code, not modified ✅
- RELATIVE STRENGTH (`tab === 'rs'`): existing code, not modified ✅
- RRG (`tab === 'rrg'`): existing code, not modified ✅
- Benchmark selector: unchanged behavior, passes to ThemeMapPanel as prop ✅
- API route: not modified ✅
- `computeAllBucketEarningsConfirmation()`: not modified ✅

---

## Issues Found

### Issue 1 — CRITICAL (Fixed): RS fields using wrong key names
**Description:** Original `safeNum(m, 'rel_1m', 'rs_1m', 'return_1m')` tried flat keys that don't exist on `AIInfraBucketMomentum`. Actual structure is nested: `m.relative_strength.vs_soxx.three_month`.
**Fix:** Replaced `safeNum` with `getBenchmarkRS(m, benchmark)` which correctly accesses `m.relative_strength[benchmarkKey].{one_month|three_month|six_month}`.
**Also:** `buildTileData` now accepts `benchmark` param; `useMemo` passes benchmark in deps.

### Issue 2 — Bug (Fixed): Heatmap row click immediately dismissed by outer div
**Description:** `ThemeHeatmap` row `onClick={() => onSelect(id)}` had no `stopPropagation`. The event bubbled to the outer `<div onClick={handleDismiss}>`, immediately setting `selectedId = null` after selection.
**Fix:** Wrapped `<ThemeHeatmap>` in `<div onClick={e => e.stopPropagation()}>`.

### Issue 3 — UX (Fixed): Filter chip click could dismiss detail via bubble
**Description:** Filter chip click event bubbled to outer div → `handleDismiss` → clears selectedId.
**Fix:** Wrapped `<FilterChips>` in `<div onClick={e => e.stopPropagation()}>`. Filter change also explicitly clears `selectedId` via `onChange={(k) => { setFilter(k); setSelectedId(null) }}`.

---

## Minor Fixes Applied

| Fix | File | Description |
|-----|------|-------------|
| RS nested field access | ThemeMapPanel.tsx | `getBenchmarkRS` replaces `safeNum` flat-key approach |
| Heatmap bubble bug | ThemeMapPanel.tsx | `stopPropagation` wrapper on ThemeHeatmap |
| FilterChips bubble + explicit deselect | ThemeMapPanel.tsx | `stopPropagation` wrapper + clear selectedId on change |

---

## Final Report QA Checklist

| Item | Result |
|------|--------|
| THEME MAP tab QA status | ✅ PASS |
| 13 themes exactly once | ✅ 13 |
| Missing bucket_ids | ✅ none |
| Duplicate bucket_ids | ✅ 0 |
| Filter chips status | ✅ all 9 working |
| Benchmark switch while non-All filter: filter reset confirmed | ✅ |
| Detail card dismissed/updated correctly on benchmark switch | ✅ |
| Tile grid status | ✅ |
| Heatmap status | ✅ (RS fix applied) |
| Detail card status | ✅ (bubble fix applied) |
| Earnings/risk consistency | ✅ OPTICAL_NETWORK = PARTIAL preserved |
| Responsive status | ✅ |
| Mobile horizontal scroll absent | ✅ |
| Existing tabs regression | ✅ none |
| API unchanged | ✅ |
| TypeScript tsc --noEmit --skipLibCheck | ✅ exit 0 |
| Forbidden language absent | ✅ |
| Issues found | 3 (all fixed) |
| Remaining limitations | RS shows `—` if API returns no momentum data (graceful) |

---

## Recommendation

**READY_FOR_TM3_DETAIL_DRAWER**

TM-3 target: enhance Detail Drawer with richer content, related-theme navigation, and inline evidence notes from earnings seed data.
