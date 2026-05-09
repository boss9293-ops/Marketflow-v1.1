# Phase E Step 1 — UX Hardening Notes
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Data Status Behavior by Tab

| Tab | Label | Source | Notes |
|-----|-------|--------|-------|
| Tab 1 ENGINE | `DATA STATUS LIVE` (emerald) or `DATA STATUS UNAVAILABLE` (slate) | `/api/interpretation` | Dynamic — shows LIVE when `interpData` is populated, UNAVAILABLE otherwise |
| Tab 2 STRATEGY | Block ⑥ Data Source note (inline text) | `/api/translation` (same engine) | No separate badge; SOXL-derived disclosure text added |
| Tab 3 PLAYBACK | `DATA STATUS FALLBACK` badge (yellow) | `/api/playback` (static fallback) | Standard format: `DATA STATUS {SOURCE}` in uppercase |

---

## 2. Controlled PARTIAL Items

| Item | Resolution |
|------|-----------|
| Tab 2 no separate data status badge | Added Block ⑥ Data Source with disclosure: "Translation data uses the current engine snapshot. SOXL-specific translation is derived from SOXX structure when separate SOXL engine data is unavailable." |
| Tab 1 footer hardcoded LIVE | Made dynamic: `interpData ? LIVE : UNAVAILABLE` |

---

## 3. Copy Changes Made

### TerminalXDashboard.tsx
- Footer data status: hardcoded `DATA STATUS LIVE` → conditional `DATA STATUS LIVE / DATA STATUS UNAVAILABLE`
- `Confidence` label now uses `LABELS.confidence` constant

### SoxxSoxlTranslationTab.tsx
- Added Block ⑥ Data Source after Watch Conditions block
- Mobile grid: `grid-cols-2` → `grid-cols-1 md:grid-cols-2`

### SemiconductorPlaybackTab.tsx
- Data Status badge: `{dataStatus.source}` → `DATA STATUS {dataStatus.source.toUpperCase()}`
- Added `snapshot` and `unavailable` source color states
- Default fallback note standardized: "Fallback data is used to preserve layout while historical source integration is pending."
- Data Status row: `flex items-center` → `flex flex-wrap items-center` (narrow-width safe)

---

## 4. Label System (Korean-Ready)

Added to `TerminalXDashboard.tsx` (module level, before component):

```ts
// Phase E: labels centralized for future KR/EN toggle.
const LABELS = {
  summary:        'Summary',
  alignment:      'Alignment',
  supporting:     'Supporting',
  weakening:      'Weakening',
  interpretation: 'Interpretation',
  context:        'Historical Context',
  confidence:     'Confidence',
  dataStatus:     'Data Status',
  delta:          'Delta',
  watch:          'Watch',
}
```

`Confidence` section header migrated to `LABELS.confidence`. Remaining labels are ready for migration in Phase E Step 2 or a future i18n pass.

---

## 5. Tooltip Changes Made

### TerminalXDashboard.tsx

| Label | Location | Tooltip Text |
|-------|----------|-------------|
| Center tab buttons (MAP, BREADTH, CORRELATION, MOMENTUM, PERFORMANCE, CYCLE VIEW) | Tab nav bar | Added via `TAB_TIPS` map + `title` attribute |
| AI Concentration | ENGINE panel header | "Measures whether leadership is concentrated in a small group of AI infrastructure names." |
| Confidence | Right panel section header | "Interpretation confidence based on signal alignment and data quality." |

### SoxxSoxlTranslationTab.tsx

| Label | Location | Tooltip Text |
|-------|----------|-------------|
| Structural Delta | Block ④ header | "How SOXX structural conditions translate into SOXL amplification sensitivity." |
| Amplification | Block ④ sub-label | "Measures how strongly SOXL amplifies the base SOXX structural conditions." |

---

## 6. Narrow-Width / Mobile Layout Result

| Area | Change | Result |
|------|--------|--------|
| Tab 2 SOXX/SOXL 2-column grid | `grid-cols-2` → `grid-cols-1 md:grid-cols-2` | Stacks vertically on mobile ✅ |
| Tab 2 Block 6 Data Source | `flex flex-wrap items-start` | Wraps safely on narrow widths ✅ |
| Tab 3 Data Status row | `flex flex-wrap items-center` | Badge + note wrap safely ✅ |
| Tab 1 footer ticker | Existing `overflow-hidden` on ticker | Scrolls off naturally, status stays visible ✅ |

No horizontal overflow issues from label changes.

---

## 7. Forbidden Word Scan

All modified files re-scanned post-edit:

| Word | TerminalXDashboard | SoxxSoxlTranslationTab | SemiconductorPlaybackTab |
|------|--------------------|-----------------------|--------------------------|
| buy  | PASS | PASS | PASS |
| sell | PASS | PASS | PASS |
| entry | PASS | PASS | PASS |
| exit | PASS | PASS | PASS |
| target | PASS | PASS | PASS |
| forecast | PASS | PASS | PASS |
| predict | PASS | PASS | PASS |
| expected | PASS | PASS | PASS |
| will | PASS | PASS | PASS |

---

## 8. TypeScript Compile Result

`tsc --noEmit --skipLibCheck` → **clean (0 errors)**

---

## 9. Validation Checklist

```
[✅] Tab 1 data status clear (LIVE / UNAVAILABLE dynamic)
[✅] Tab 2 data status / derived translation disclosure clear (Block ⑥ added)
[✅] Tab 3 fallback data status clear (DATA STATUS FALLBACK format)
[✅] Interpretation copy concise (no changes required — already terminal-grade)
[✅] Korean-ready labels prepared (LABELS const added, Phase E comment)
[✅] Tooltips added (MAP, BREADTH, CORRELATION, MOMENTUM, PERFORMANCE, CYCLE VIEW, AI Concentration, Confidence, Structural Delta, Amplification)
[✅] Narrow-width layout checked (grid-cols-1 md:grid-cols-2, flex-wrap)
[✅] Forbidden word scan clean
[✅] TypeScript compile clean
[✅] UX hardening notes created (this document)
```

---

## 10. Known Limitations (Accepted)

| Limitation | Decision |
|-----------|---------|
| No full KR/EN i18n system yet | LABELS const ready; toggle deferred to Phase E Step 2 |
| Tooltips are `title` attributes only (no custom UI) | Acceptable for terminal — native browser tooltips sufficient |
| Tab 1 `as_of` timestamp not surfaced in main UI | Low priority — covered by DATA STATUS LIVE label |
| Tab 3 playback still uses fallback data | Disclosed; real data replacement planned for Phase E Step 2 |

---

## 11. Next Step

Phase E Step 2 — Real Data Replacement Plan for Playback and SOXL-Specific Translation
