# AI Infra Hub IA-1 Lens Simplification

> Date: 2026-05-12
> Phase: IA-1
> Status: COMPLETE

---

## Purpose

Reduce information density in the THEME MAP tab so the Flow Ladder is the
dominant visual element. Numbers, RS values, and the advanced matrix are
progressive-disclosure: hidden by default, revealed on hover or explicit toggle.

---

## Changes Applied

### Section A — Default view order (unchanged, already correct)

Flow Ladder → Filter Chips → Tile Grid → [Detail Drawer if open] → [Heatmap toggle]

### Section B — Heatmap collapsed by default

- `isHeatmapExpanded` state added to `ThemeMapPanel` (default `false`)
- Heatmap wrapped behind `▸ ADVANCED MATRIX` toggle button
- Collapsed state persists across benchmark switch (not in benchmark useEffect)
- Resets on tab navigation (component unmounts on tab change — expected)
- When expanded, internal "THEME HEATMAP" header still shows (harmless)

### Section C — Tile Grid number visibility

Default tile shows:
- Theme label (13px, V.text)
- State badge
- Earnings badge + up to 2 risk badges (same row)

Hidden by default (revealed on hover):
- State score (12px, state color)
- RS 3M (12px, RS color)

Hover implemented via `useState(false)` + `onMouseEnter` / `onMouseLeave`.
Removed from default: state_score, RS 3M, Coverage + data quality line.

### Section D — Detail Drawer (already compliant, no changes)

- state_reason truncated at 140 chars → max ~2 visual lines
- Related symbols: `.slice(0, 6)` already in place
- Watch Next: `.slice(0, 3)` already in place

### Section E — Filter chip reordering + Evidence Gap filter

New primary 5: All, Leading, Improving, Evidence Gap, Data Limited
Secondary 5: Watch, Crowded, Story Heavy, Indirect, Confirmed Evidence

Evidence Gap filter added:
```
case 'evidence_gap': tiles where (RS 3M > +5% OR RS 6M > +5%)
                     AND earnings NOT CONFIRMED/PARTIAL
```

Rationale: highlights themes where momentum outpaces earnings confirmation —
the most actionable signal for Watch Next monitoring.

---

## Files Modified

| File | Change |
|------|--------|
| ThemeMapPanel.tsx | Section B: isHeatmapExpanded + toggle; Section C: ThemeTile hover; Section E: FilterKey + FILTER_OPTIONS + applyFilter |

---

## QA

| Check | Status |
|-------|--------|
| Flow Ladder remains dominant default view | ✅ heatmap collapsed |
| Default tile: no RS/score/coverage numbers | ✅ removed from default render |
| Hover: RS 3M + score visible | ✅ conditional on `hovered` state |
| Evidence Gap filter: correct logic | ✅ RS > +5% AND earnings weak |
| Filter chip order: primary 5 first | ✅ |
| Heatmap toggle persists benchmark switch | ✅ not in benchmark useEffect |
| Heatmap resets on tab navigation | ✅ component unmount |
| TypeScript exit 0 | ✅ |
| Forbidden language absent | ✅ |
| No new API routes | ✅ |
| Existing tabs unaffected | ✅ |

---

## Remaining Limitations

- Hover RS 3M reveal is desktop-only (no touch equivalent on mobile)
- ADVANCED MATRIX label does not indicate row count when collapsed
- Filter chip count at 10 may still feel dense on very narrow mobile; IA-2 can add "More" drawer if needed

---

## Next Step

**READY_FOR_TM5_MOMENTUM_CURVE** or **IA-2** (More Filters drawer + mobile filter UX)
