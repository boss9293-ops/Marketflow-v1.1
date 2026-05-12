# Semiconductor Theme Map Design

> Date: 2026-05-12
> Phase: TM-1 — Design / Specification
> Status: APPROVED_FOR_TM2

---

## Purpose

Design a **Semiconductor Theme Map** — a visual rotation board that shows which AI infrastructure themes are leading, improving, fading, or story-heavy, and where momentum is flowing across the semiconductor / AI infrastructure universe.

Questions it answers:
- Which themes have confirmed earnings evidence vs. story-only narratives?
- Which themes are seeing momentum rotation?
- Which themes are data-limited and why?
- Where is the leading edge of the AI infrastructure build cycle now?

This is **not** a buy/sell signal board. It is a business evidence and momentum observation layer.

---

## Relationship to Current AI Infra Hub

The Infrastructure Sector Lens (AIInfrastructureRadar) currently has **6 tabs**:

| Tab key | Label | Component |
|---------|-------|-----------|
| `ladder` | VALUE CHAIN | ValueChainLadder |
| `heatmap` | HEATMAP | BottleneckHeatmap |
| `earnings` | EARNINGS | EarningsConfirmationPanel |
| `state` | STATE LABELS | BucketStateLabelPanel |
| `rs` | RELATIVE STRENGTH | BucketRelativeStrengthPanel |
| `rrg` | RRG | BucketRRGPanel |

Theme Map adds tab #7. This triggers the **navigation density flag** per Section 6 placement constraint (see Placement Options below).

The Theme Map reuses all existing data from these layers:
- State labels → from `aiInfraStateLabels`
- RS / returns → from `aiInfraBucketRS`
- Earnings confirmation → from `aiInfraEarningsConfirmation`
- Theme purity / risk → from `aiInfraThemePurity`
- Company purity → from `aiInfraCompanyPurity`

No new scoring engine required. No new API route required for MVP.

---

## Relationship to Semiconductor Lens

The Semiconductor Lens (`TerminalXDashboard`) has 5 center tabs:

```
MAP | CYCLE VIEW | PERFORMANCE | HEALTH | SOXL ENV
```

These tabs are SOXX/SOXL focused: cycle scores, breadth, environment, and sector-level relative strength.

The Theme Map is **AI infrastructure bucket–level** (finer granularity). It should not replace or merge with the Semiconductor Lens cycle view.

Long-term: a simplified version of the Theme Map (theme summary strip only) could appear as a read-only widget inside the Semiconductor Lens PERFORMANCE tab.

---

## Theme Universe

The Theme Map uses the existing **13 AI Infra bucket IDs** as the theme universe. No new taxonomy.

| Bucket ID | Display Label | Value Chain Stage |
|-----------|--------------|------------------|
| `AI_CHIP` | AI Compute | Stage 1 |
| `HBM_MEMORY` | HBM / Memory | Stage 2 |
| `PACKAGING` | Foundry / Packaging | Stage 2 |
| `TEST_EQUIPMENT` | Test / Inspection | Stage 2 |
| `PCB_SUBSTRATE` | PCB / Substrate | Stage 3 |
| `OPTICAL_NETWORK` | Optical / Network | Stage 3 |
| `COOLING` | Cooling / Thermal | Stage 3 |
| `POWER_INFRA` | Power Infrastructure | Stage 3 |
| `DATA_CENTER_INFRA` | Data Center Infra | Stage 4 |
| `CLEANROOM_WATER` | Cleanroom / Water | Support |
| `SPECIALTY_GAS` | Specialty Gas | Support |
| `RAW_MATERIAL` | Raw Materials | Support |
| `GLASS_SUBSTRATE` | Glass Substrate | Emerging |

---

## Data Inputs

All data sourced from the existing `/api/ai-infra/theme-momentum` route. No new API contract needed for MVP.

### From `bucket_states` (per bucket):
```
bucket_id          — ID
display_name       — display label
state_label        — LEADING / EMERGING / CROWDED / DISTRIBUTION / WATCH / DATA_INSUFFICIENT
state_score        — numeric (0–100)
confidence         — HIGH / MEDIUM / LOW
rs_1m              — RS vs SOXX 1M
rs_3m              — RS vs SOXX 3M
rs_6m              — RS vs SOXX 6M
return_3m          — absolute return 3M
risk_flags         — risk flag array
coverage_ratio     — data coverage (0–1)
data_quality       — LIVE / PARTIAL / STATIC / PENDING
```

### From `earnings_confirmation.buckets` (per bucket):
```
confirmation_level — CONFIRMED / PARTIAL / WATCH / NOT_CONFIRMED / DATA_LIMITED / UNKNOWN
confirmation_score — numeric
evidence_summary   — one-line text
caution_summary    — one-line text
```

### From `aiInfraThemePurity` (per bucket):
```
theme_purity            — PURE_PLAY / MIXED / PROXY
commercialization_risk  — boolean
indirect_exposure       — boolean
story_heavy             — boolean
```

### From `aiInfraCompanyPurity` (per company):
```
symbol
primary_bucket
pure_play_score
ai_infra_relevance_score
```

---

## Visual Components

### A. Theme Filter Chips

**Purpose:** Filter which theme tiles are shown. No page reload — client-side.

**Filter options:**
```
All          — show all 13 themes
Leading      — state_label = LEADING
Improving    — state_label = EMERGING
Watch        — state_label = WATCH or CROWDED
Confirmed    — earnings confirmation_level = CONFIRMED or PARTIAL
Data Limited — confirmation_level = DATA_LIMITED
Story Heavy  — theme_purity.story_heavy = true
Indirect     — theme_purity.indirect_exposure = true
```

**Layout rules:**
- Desktop (≥1024px): top chip row, left-aligned
- Tablet (≥768px): top chip row, wrapping
- Mobile (<768px): top chip row, wrapping — chips must not require horizontal scroll
- Active chip: solid background; inactive: ghost border
- Max 8 chips visible without overflow

---

### B. Theme Tile Grid

**Purpose:** Primary overview — 13 theme tiles showing snapshot status.

**Each tile shows:**
```
[Theme Label]          — display name, 12px, --font-ui
[State Badge]          — LEADING / EMERGING / WATCH / etc., 11px ALL CAPS
RS 3M: [value]         — numeric, 12px, --font-data, color-coded
Earnings: [badge]      — Confirmed / Partial / Watch / Data Limited, 11px
Risk: [marker]         — commercialization risk / indirect / story-heavy if applicable
Coverage: [indicator]  — HIGH / PARTIAL / LOW based on coverage_ratio
```

**Tile width:** 2–3 columns on desktop, 2 on tablet, 1 on mobile.

**Example tiles:**

```
AI Compute
State: LEADING
RS 3M: +18.4%
Earnings: Confirmed
Risk: —
Coverage: High
```

```
Glass Substrate
State: WATCH
RS 3M: —
Earnings: Data Limited
Risk: Commercialization Risk
Coverage: Low
```

```
Raw Materials
State: DATA LIMITED
RS 3M: —
Earnings: Data Limited
Risk: Indirect Exposure
Coverage: —
```

**Color rule:** State badge color uses existing `STATE_COLORS` from `aiInfraStateLabels`. Earnings badge uses `LEVEL_COLORS` from `EarningsConfirmationPanel`.

---

### C. Theme Heatmap

**Purpose:** Show theme momentum intensity across multiple time windows in one compact grid.

**Rows:** 13 themes (sorted by state_score descending)

**Columns:**
```
Theme    | 1W | 1M | 3M | 6M | State | Earnings | Risk
```

**Cell rendering:**
- Return columns (1W/1M/3M/6M): color intensity based on return magnitude (positive = green gradient, negative = red gradient)
- State column: state badge
- Earnings column: earnings level badge (abbreviated: `CNF` / `PRT` / `WCH` / `D/L`)
- Risk column: small marker if risk flag active

**Design rules:**
- Minimum font size: 11px for headers, 12px for data cells
- No text below 11px
- Table must not require horizontal scroll on desktop
- Sticky header row

---

### D. Capital Flow / Theme Flow Ladder

**Purpose:** Show where momentum is flowing across the AI infrastructure value chain.

**MVP Constraint (TM-2):**
- Use only **static stage positioning** based on value-chain stage order (Stage 1 → 2 → 3 → Support)
- Do NOT attempt dynamic flow thickness from live data in TM-2
- Thickness / color encoding deferred to TM-4
- TM-2 MVP: stage labels + state badges only, no animated flow

**Layout (static):**

```
Stage 1 — AI Compute
    ↓
Stage 2 — HBM / Memory · Foundry / Packaging · Test / Inspection
    ↓
Stage 3 — PCB / Substrate · Optical / Network · Cooling · Power Infra
    ↓
Stage 4 — Data Center Infra
    ↓
Support — Specialty Gas · Cleanroom / Water · Raw Materials
Emerging — Glass Substrate
```

**State badge** on each theme node. No arrows in TM-2 — use indented hierarchy rows.

**TM-4 enhancement:** Add live RS-based thickness encoding and directional arrows.

---

### E. Theme Momentum Curve (deferred to Phase TM-5)

**MVP approach:** Use available 1W/1M/3M/6M return values to construct a simple pseudo-curve using four data points.

**Phase TM-5 full implementation:** Time-series sparkline using historical RS/return data.

**TM-2 and TM-3 do not implement this component.** Show placeholder only.

---

## Layout Options

### Desktop (≥1024px)

```
[Filter Chips]
┌────────────────────────────┬──────────────────┐
│  Theme Tile Grid (left)    │  Heatmap (right) │
│  2–3 columns               │  full width col  │
├────────────────────────────┴──────────────────┤
│  Flow Ladder (full width, below)              │
└───────────────────────────────────────────────┘
```

### Tablet (≥768px, <1024px)

```
[Filter Chips]
[Theme Tile Grid — 2 columns]
[Heatmap — full width]
[Flow Ladder — full width]
```

### Mobile (<768px)

```
[Filter Chips — wrapping]
[Theme Tile Cards — 1 column compact]
[Heatmap — scrollable rows, fixed left column]
[Flow Ladder — stacked stages]
```

---

## Interaction Model

### Theme Tile Click

1. Selected tile highlighted (border + background tint)
2. Heatmap row highlighted
3. **Detail Drawer opens**

### Detail Drawer content:

```
[Theme name + State badge]
Top symbols (from aiInfraCompanyPurity, up to 5)
State reason (from bucket_states.state_reason)
Earnings confirmation (level + evidence_summary + caution_summary)
Risk flags (commercialization_risk / indirect_exposure / story_heavy)
RS summary (1M / 3M / 6M)
Watch Next: [guidance text if available]
```

**Do not show too much text by default.** One-line summaries preferred.

### Mobile exception (<768px):

On mobile, the Detail Drawer **replaces the current view** (full-screen overlay or bottom sheet).
Do NOT attempt side-by-side layout on mobile.
Back / close button returns to tile grid.

### Heatmap Row Click

Opens same detail drawer as tile click.

---

## Placement Options

### Option A — New tab inside Semiconductor Lens (TerminalXDashboard)

Add tab: **THEME MAP**

Suggested tab order:
```
MAP | THEME MAP | CYCLE VIEW | PERFORMANCE | HEALTH | SOXL ENV
```

**Current Semiconductor Lens center tab count:** 5
**After adding THEME MAP:** 6 tabs

**Pros:**
- Fits as sector map for SOXX/SOXL users
- Good entry point for semiconductor cycle context

**Cons:**
- Data contract mismatch — Semiconductor Lens uses SOXX cycle data; Theme Map uses AI Infra bucket data
- Would require new data fetch inside TerminalXDashboard
- Does not reuse existing earnings / purity context naturally

---

### Option B — New tab inside Infrastructure Sector Lens (AIInfrastructureRadar)

Add tab: **THEME MAP**

Suggested tab order:
```
VALUE CHAIN | THEME MAP | HEATMAP | EARNINGS | STATE LABELS | RS | RRG
```

**Current Infrastructure Lens tab count:** 6
**After adding THEME MAP:** 7 tabs

**Navigation density flag:**
> Tab count = 7 after THEME MAP addition. If Infrastructure Sector Lens tab count exceeds 7 at any future phase, reconsider consolidation or moving lower-priority tabs to a secondary menu.
> Current 7 tabs remain within navigable range on desktop. Monitor for overflow on 768px viewports.

**Pros:**
- Direct reuse of all existing AI Infra data layers
- Earnings confirmation, purity, RS, state labels all available immediately
- Zero additional API contract changes for MVP

**Cons:**
- Infrastructure Lens already has 6 tabs — adding #7 increases navigation density
- Power users of Semiconductor Lens may not discover it here

---

### Recommendation

**Option B — Infrastructure Sector Lens, tab #2 (THEME MAP)**

**Reason:**
- The existing 13-bucket system, earnings confirmation, theme purity, RS, and state labels already live in AI Infra. Theme Map reuses this data immediately with zero API changes.
- The natural user journey is: VALUE CHAIN → THEME MAP → HEATMAP → EARNINGS
- 7 tabs is navigable. If future phases push beyond 7, consolidate RELATIVE STRENGTH and RRG into a single RS/RRG tab.

**Later phase:** Add a simplified Theme Summary Strip widget (tile grid read-only, no drawer) inside the Semiconductor Lens PERFORMANCE tab as a secondary exposure point.

---

## Scoring / Status Rules

The Theme Map derives visual status from existing layers only. No new score invented.

| Visual label | Source | Logic |
|---|---|---|
| LEADING | `state_label` | state_label = LEADING |
| IMPROVING | `state_label` | state_label = EMERGING |
| CROWDED | `state_label` | state_label = CROWDED |
| WATCH | `state_label` | state_label = WATCH or DISTRIBUTION |
| FRAGILE | `risk_flags` | risk_flags contains fragility indicator |
| DATA LIMITED | `earnings.confirmation_level` | confirmation_level = DATA_LIMITED |
| EVIDENCE CONFIRMED | `earnings.confirmation_level` | CONFIRMED or PARTIAL |
| EVIDENCE GAP | `earnings.confirmation_level` | WATCH + high RS (price ahead of confirmation) |
| STORY HEAVY | `theme_purity.story_heavy` | story_heavy = true |
| INDIRECT EXPOSURE | `theme_purity.indirect_exposure` | indirect_exposure = true |

**Forbidden derived labels:**
- Theme Buy Score
- Entry Signal
- Opportunity Score
- Strong Buy

---

## Earnings Confirmation Integration

Earnings confirmation appears as a visual badge per theme. It does not dominate the tile — RS / state context shown first.

**Badge rendering:**

| Level | Badge text | Color |
|-------|-----------|-------|
| CONFIRMED | Confirmed | #22c55e |
| PARTIAL | Partial | #3FB6A8 |
| WATCH | Watch | #fbbf24 |
| NOT_CONFIRMED | Not Confirmed | #ef4444 |
| DATA_LIMITED | Data Limited | #8b9098 |

**Evidence gap signal:**

A theme can be price-strong (RS high) but earnings-weak (DATA_LIMITED or WATCH). This is displayed as:

```
Optical / Network
RS 3M: +12.2%
Earnings: Partial
→ Price strength has partial business confirmation.
```

```
Glass Substrate
RS 3M: —
Earnings: Data Limited
→ Commercial confirmation not yet visible.
```

**Interpretation text is descriptive only.** No buy/sell language.

---

## Non-Goals

Not implemented in design phase or TM-2 MVP:

- New scoring engine
- New API route (MVP reuses `/api/ai-infra/theme-momentum`)
- Trading signal or recommendation layer
- LLM-generated theme commentary
- Full D3 Sankey graph (deferred to TM-4+)
- Portfolio linkage
- Price alerts
- Animated flow lines (deferred to TM-4)
- Full time-series sparklines (deferred to TM-5)
- Semiconductor Lens Theme Strip (deferred post-TM-3)

---

## Product Language Rules

### Allowed

```
Theme Map · Theme Flow · Relative Strength · Momentum
Evidence Confirmed · Evidence Gap · Data Limited
Commercialization Risk · Indirect Exposure · Watch Next
Leading · Improving · Crowded · Fragile · Emerging
```

### Forbidden (user-facing)

```
Buy · Sell · Strong Buy · Entry · Exit · Target Price
Trading Signal · 매수 · 매도 · 진입 · 청산 · 목표가
강력매수 · 강력매도 · 추천 · predicts · guarantees · will happen
```

---

## MVP Proposal

**TM-2 MVP — Theme Map tab inside Infrastructure Sector Lens**

### Components included in TM-2:
1. **Theme Filter Chips** — client-side filter rail
2. **Theme Tile Grid** — 13 theme tiles with state/earnings/risk summary
3. **Theme Heatmap** — 13 rows × 7 columns (1W/1M/3M/6M/State/Earnings/Risk)

### Deferred from TM-2:
- Detail Drawer (TM-3)
- Flow Ladder (TM-4)
- Momentum Curve (TM-5)

### API:
- Reuses existing `/api/ai-infra/theme-momentum`
- No new backend work

### File to create:
```
src/components/ai-infra/ThemeMapPanel.tsx
```

### Tab registration:
```
AIInfrastructureRadar.tsx
type ActiveTab = 'ladder' | 'theme' | 'heatmap' | 'earnings' | 'state' | 'rs' | 'rrg'
```

---

## Implementation Phases

| Phase | Scope | QA |
|-------|-------|-----|
| **TM-1** | Design document (this) | — |
| **TM-2** | Theme Map MVP — Filter Chips + Tile Grid + Heatmap | **TM-2B: QA after MVP** |
| **TM-3** | Theme Detail Drawer (tile click → side panel or overlay) | **TM-3B: QA after Drawer** |
| **TM-4** | Flow Ladder (static stage hierarchy → live RS thickness) | TM-4B: QA |
| **TM-5** | Momentum Curve (sparkline from RS time series) | TM-5B: QA |
| **TM-6** | Responsive polish + final regression | TM-6B: Full QA |

QA step follows each implementation phase. Pattern consistent with BR-1B / BR-2B / E-4B.

---

## QA Checklist (for future implementation phases)

```
[ ] 13 theme tiles render exactly once
[ ] No duplicate bucket_id in tile grid
[ ] Earnings badges render correctly for all 6 levels
[ ] DATA_LIMITED themes do not render as Confirmed
[ ] Story-heavy themes show commercialization risk marker
[ ] Filter chips filter correctly (All / Leading / Confirmed / Data Limited)
[ ] Heatmap rows sorted by state_score descending
[ ] Heatmap cell colors reflect return intensity correctly
[ ] Theme tile click highlights heatmap row
[ ] Detail Drawer opens on click (TM-3)
[ ] Mobile (<768px): detail drawer replaces view (full-screen or bottom sheet)
[ ] Mobile: no side-by-side detail layout
[ ] No horizontal scroll on mobile tile grid
[ ] Filter chips wrap correctly on mobile (no horizontal scroll)
[ ] Flow Ladder shows static stage hierarchy (TM-4)
[ ] Flow Ladder: no live data in thickness until TM-4
[ ] Existing AI Infra tabs (VALUE CHAIN / HEATMAP / EARNINGS / STATE / RS / RRG) unaffected
[ ] No forbidden language (buy/sell/매수/매도/추천/predicts)
[ ] Font size >= 11px for all navigational labels
[ ] Font size >= 10px for all decorative labels
[ ] TypeScript tsc --noEmit --skipLibCheck: exit 0
[ ] Column headers at #B8C8DC or brighter (not #8b9098)
```

---

## Recommended Next Step

**READY_FOR_TM2_THEME_MAP_MVP**

TM-2 target files:
- Create: `src/components/ai-infra/ThemeMapPanel.tsx`
- Modify: `src/components/ai-infra/AIInfrastructureRadar.tsx` (add `theme` to `ActiveTab`, register tab)

TM-2 scope: Filter Chips + Theme Tile Grid + Theme Heatmap only.
Detail Drawer deferred to TM-3. Flow Ladder deferred to TM-4.
