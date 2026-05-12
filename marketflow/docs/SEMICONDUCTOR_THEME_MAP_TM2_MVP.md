# Semiconductor Theme Map TM-2 MVP

> Date: 2026-05-12
> Phase: TM-2
> Status: COMPLETE

---

## Purpose

Add THEME MAP tab to Infrastructure Sector Lens (AIInfrastructureRadar).
Provides a visual rotation board for 13 AI infrastructure themes using existing data layers.
No new API. No new scoring engine. Reuses `/api/ai-infra/theme-momentum`.

---

## Data Inputs

Source: `/api/ai-infra/theme-momentum` (existing route, unchanged)

| Field | Source object | Usage |
|-------|--------------|-------|
| state_label, state_score | AIInfraBucketState | tile + heatmap state |
| confidence, state_reason | AIInfraBucketState | detail card |
| risk_flags | AIInfraBucketState | risk markers |
| theme_purity | AIInfraBucketState.theme_purity | story_heavy / indirect / comm_risk flags |
| source.coverage_ratio, data_quality | AIInfraBucketState.source | coverage display |
| confirmation_level | AIInfraBucketEarningsConfirmation | earnings badge |
| evidence_summary, caution_summary | AIInfraBucketEarningsConfirmation | detail card |
| rs_1m / rs_3m / rs_6m (safeNum) | AIInfraBucketMomentum | RS display |
| symbols | AI_INFRA_BUCKETS (static) | top symbols in detail |

RS field access uses `safeNum()` with fallback keys: `rel_Xm`, `rs_Xm`, `return_Xm`. Shows `—` if unavailable.

---

## Components Created

### `src/components/ai-infra/ThemeMapPanel.tsx`

Sub-components:
- `FilterChips` — 9 filter buttons, wrapping, default = All
- `ThemeTile` — individual bucket tile (name / state / RS 3M / earnings / risk / cov)
- `DetailCard` — selected theme detail (KPI row + state reason + evidence + caution + symbols + risk flags)
- `ThemeHeatmap` — 9-column table (theme / state / score / RS 1M / RS 3M / RS 6M / earnings / risk / cov)
- `ThemeMapPanel` — orchestrates all sub-components

---

## Tab Integration

**File modified:** `src/components/ai-infra/AIInfrastructureRadar.tsx`

```
type ActiveTab = 'ladder' | 'theme' | 'heatmap' | 'earnings' | 'state' | 'rs' | 'rrg'
```

Tab order (7 tabs total):
```
VALUE CHAIN | THEME MAP | HEATMAP | EARNINGS | STATE LABELS | RELATIVE STRENGTH | RRG
```

Navigation density: 7 tabs. Flagged per TM-1 design doc — within navigable range on desktop. Monitor at ≥8.

---

## Filters

| Filter key | Logic |
|-----------|-------|
| all | show all |
| leading | state_label === LEADING |
| improving | state_label === EMERGING \| CONFIRMING |
| watch | state_label === LAGGING \| DISTRIBUTION \| DATA_INSUFFICIENT |
| crowded | state_label === CROWDED |
| confirmed | earnings_level === CONFIRMED \| PARTIAL |
| data_limited | earnings_level === DATA_LIMITED \| null |
| story_heavy | theme_purity === STORY_HEAVY \| state_label === STORY_ONLY |
| indirect | theme_purity === INDIRECT_EXPOSURE |

**Default on load: All** (amendment)
**Reset on benchmark change:** `useEffect(() => { setFilter('all'); setSelectedId(null) }, [benchmark])` (amendment)
**Does not persist across benchmark switches.** (amendment)

---

## Tile Grid

- 3 columns ≥1024px, 2 columns ≥768px, 1 column <768px
- Each tile: theme label / state badge / state score / RS 3M / earnings badge / risk markers (max 3) / coverage
- Tile click: toggles selection (click same tile again to deselect)
- Filter applied: heatmap also respects active filter
- No horizontal scroll on mobile (single column, wrapping chips)

---

## Heatmap

Columns: THEME | STATE | SCORE | RS 1M | RS 3M | RS 6M | EARNINGS | RISK | COV

- Rows sorted by state_score descending
- Respects active filter
- Click row = toggle detail card
- RS values color-coded: >5% green, >0% teal, >-5% amber, ≤-5% red
- Earnings abbreviated: CNF / PRT / WCH / N/C / D/L
- Risk abbreviated: CR=Comm.Risk IN=Indirect SH=Story Heavy OH=Overheat MS=Momentum Stretch
- `minWidth: 640` with `overflowX: auto` — no scroll on desktop, scroll available on mobile

---

## Detail Card

Appears full-width below tile grid on tile or heatmap row click.
Mobile (<768px): same position — full-width card below tile grid. (amendment)
No side-by-side layout on mobile. (amendment)
Dismiss: click ✕ button, click outside card, or click same tile again.

Content: theme name / state badge / score / RS 1M+3M+6M / earnings badge / coverage / confidence / state reason / evidence summary / caution / top symbols / risk flags / data quality

---

## Deduplication Rule

`buildTileData()` deduplicates `bucket_states` by `bucket_id`:
- First occurrence kept
- Duplicates logged via `console.warn` (dev only)
- Duplicate count tracked and displayed as dev-only warning banner
- Final tile list always based on canonical `AI_INFRA_BUCKETS` (13 items)

---

## Responsive Rules

| Width | Layout |
|-------|--------|
| ≥1024px | 3-column tile grid |
| ≥768px | 2-column tile grid |
| <768px | 1-column tile grid |
| All | Filter chips wrap (no horizontal scroll) |
| Mobile | Detail card below tile grid, full-width |
| All | Heatmap: overflowX auto, minWidth 640 |

---

## Non-Goals (TM-2)

- Flow Ladder → TM-4
- Momentum Curve sparklines → TM-5
- Full Sankey → deferred
- LLM narrative → deferred
- New API route → not created
- New scoring engine → not created
- Portfolio linkage → not in scope

---

## QA Result

| Check | Result |
|-------|--------|
| 13 themes render exactly once | ✅ (AI_INFRA_BUCKETS canonical list, deduplicated states) |
| Duplicate bucket_id entries in bucket_states? | 0 detected at build time |
| Default filter state on load confirmed as "All" | ✅ useState('all') |
| Filter reset on benchmark change | ✅ useEffect on benchmark |
| Filters work (all 9 options) | ✅ |
| Tile click selects / deselects theme | ✅ toggle pattern |
| Detail card updates on selection | ✅ |
| Heatmap respects filter | ✅ filteredTiles passed to ThemeHeatmap |
| Earnings badges render correctly (6 levels) | ✅ |
| DATA_LIMITED not shown as Confirmed | ✅ separate color + EARN_SHORT text |
| Story-heavy / indirect risk visible | ✅ risk markers on tile + heatmap RISK column |
| Mobile: no horizontal scroll on tile grid | ✅ 1-column + filter chips wrap |
| Mobile: detail card full-width below grid | ✅ |
| Mobile: no side-by-side detail | ✅ |
| Existing tabs unaffected | ✅ additive-only tab addition |
| API unchanged | ✅ no new routes |
| TypeScript tsc --noEmit --skipLibCheck | ✅ exit 0 |
| Font ≥10px everywhere | ✅ min 10px used for decorative labels |
| Column headers ≥ #B8C8DC | ✅ V.text2 = #B8C8DC |
| Forbidden language absent | ✅ no buy/sell/매수/매도/추천/predicts |

---

## Next Step

**READY_FOR_TM2B_QA**

TM-3 target: Theme Detail Drawer with richer content and navigation from detail → related themes.
