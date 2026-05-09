# Semiconductor Historical Analog Engine — Design Document

**Version:** 1.0  
**Date:** 2026-04-28  
**Status:** Design only — no implementation yet  
**Phase:** P2-6 (Phase A complete)

---

## 1. Purpose

The Historical Analog Engine identifies past semiconductor cycle setups that are **structurally similar** to the current state, then surfaces what followed those setups over 3M / 6M / 12M horizons.

This is a **pattern recognition tool**, not a forecast. All outputs must use language such as:
- "Historically similar setup"
- "In past episodes with this configuration…"
- "What followed in N of M similar periods…"

**Never use:** "will," "forecast," "prediction," "expect," or "same as."

---

## 2. Input Vector

One vector per snapshot date. All fields normalized to [0, 1] before distance calculation.

| Field | Source | Type | Normalization |
|-------|--------|------|---------------|
| `engine_score` | engineScore.ts | 0–100 | ÷ 100 |
| `confidence_score` | confidenceScore.ts | 0–100 | ÷ 100 |
| `breadth_score` | breadth_detail.breadth_history | 0–100 | ÷ 100 |
| `momentum_score` | momentum_detail.momentum_history | 0–100 | ÷ 100 |
| `rsi_14` | momentum_detail.rsi_14 | 0–100 | ÷ 100 |
| `macd_histogram_sign` | momentum_detail.macd.state | {-1, 0, 1} | + 0.5 map |
| `correlation_ai_soxx` | correlation_matrix.values[SOXX][AI Infra] | −1 to 1 | (v + 1) / 2 |
| `ai_concentration` | ai_infra_concentration_history.top5_weight | 40–80% | (v − 40) / 40 |
| `concentration_trend` | top5_weight delta over 20d | signed | sigmoid |
| `ew_vs_cw_spread` | ai_infra_concentration_history.ew_vs_cw_spread | signed % | sigmoid(v / 2) |
| `ai_vs_soxx_spread` | ai_infra_concentration_history.ai_vs_soxx_spread | signed % | sigmoid(v / 2) |
| `cycle_state` | engineScore.state | categorical | one-hot (6 classes) |
| `conflict_type` | engineScore.conflict_type | categorical | one-hot (9 classes) |

**Vector dimension:** 13 scalar fields + 6 cycle state classes + 9 conflict type classes = 28 total dimensions

---

## 3. Historical Database Structure

### Schema

```sql
CREATE TABLE analog_snapshots (
  id             INTEGER PRIMARY KEY,
  snapshot_date  TEXT NOT NULL,          -- YYYY-MM-DD
  -- Scalar fields (normalized 0-1)
  engine_score       REAL,
  confidence_score   REAL,
  breadth_score      REAL,
  momentum_score     REAL,
  rsi_14             REAL,
  macd_hist_sign     REAL,
  corr_ai_soxx       REAL,
  ai_concentration   REAL,
  conc_trend_20d     REAL,
  ew_vs_cw_spread    REAL,
  ai_vs_soxx_spread  REAL,
  -- Categorical (stored as raw string; one-hot at query time)
  cycle_state        TEXT,
  conflict_type      TEXT,
  -- Forward outcomes (filled after N days have passed)
  soxx_fwd_3m   REAL,   -- SOXX % return 63 trading days forward
  soxx_fwd_6m   REAL,   -- SOXX % return 126 trading days forward
  soxx_fwd_12m  REAL,   -- SOXX % return 252 trading days forward
  -- Metadata
  data_source    TEXT,   -- 'computed' | 'backfill'
  created_at     TEXT
);

CREATE INDEX idx_snapshot_date ON analog_snapshots(snapshot_date);
```

### Backfill Range

Initial target: **2015-01-01 to present** (≈ 2,700 trading days)

Data requirements:
- SOXX OHLCV: available in `ohlcv_daily` from ~2010
- Engine scores: must be recomputed backward using v2 pipeline
- breadth_detail: requires 200d history per ticker — available from ~2015 for full universe
- momentum_detail: available immediately
- correlation_matrix: requires 90d window — available from ~2015
- ai_concentration: requires market cap estimates — approximation only pre-2019

**Realistic backfill start: 2017-01-01** (≈ 2,100 tradable snapshots)

---

## 4. Similarity Method

### Primary: Weighted Euclidean Distance

```python
distance(A, B) = sqrt(sum(w_i * (A_i - B_i)^2 for i in dimensions))
```

**Dimension weights:**

| Dimension group | Weight per field | Rationale |
|-----------------|-----------------|-----------|
| cycle_state (one-hot) | 0.25 each | Structural phase is highest signal |
| conflict_type (one-hot) | 0.10 each | Conflict type drives outcome variance |
| engine_score | 0.15 | Primary composite signal |
| breadth_score | 0.12 | Breadth determines durability |
| momentum_score | 0.10 | Momentum determines near-term direction |
| ai_concentration | 0.08 | AI structure shapes dispersion risk |
| concentration_trend | 0.08 | Trend matters more than level |
| rsi_14 | 0.05 | Overbought/oversold context |
| correlation_ai_soxx | 0.05 | Dependency structure |
| ew_vs_cw_spread | 0.04 | Breadth quality signal |
| ai_vs_soxx_spread | 0.04 | AI leadership context |
| macd_hist_sign | 0.03 | Short-term momentum sign |
| confidence_score | 0.02 | Lower weight — derived field |

Weights sum to 1.00 across the primary scalar fields. One-hot fields are weighted independently.

### Secondary: Cosine Similarity (validation only)

Used to cross-validate the top-3 matches. If cosine ranking contradicts Euclidean top-3, flag for manual review. Not shown in UI output.

### Match Threshold

Only return analogs where distance < 0.35. If no analog meets this threshold, return `null` with message: "No sufficiently similar historical setup found."

---

## 5. Required Historical Labels

Each snapshot in the database must have:

| Label | How computed | Notes |
|-------|-------------|-------|
| `cycle_state` | v2 engine recomputed | Must use same engine version |
| `conflict_type` | v2 engine recomputed | Re-run explanationEngine |
| `breadth_score` | breadth calculator | Requires 200d ticker history |
| `momentum_score` | RSI + MACD → composite | Wilder RSI, 12/26/9 MACD |
| `ai_concentration` | drift-adjusted from current weights | Approximation acceptable pre-2020 |
| `soxx_fwd_3m/6m/12m` | SOXX OHLCV lookforward | Only computable for dates ≥ 12M ago |

**Label quality tiers:**

| Tier | Date range | Quality |
|------|-----------|---------|
| A | 2020-present | Full engine v2, all fields |
| B | 2017–2019 | Engine v2, partial ai_concentration |
| C | 2015–2016 | Incomplete universe, lower reliability |

Tier C snapshots are excluded from analog matching unless no Tier A/B match exists.

---

## 6. Forward Outcome Metrics

For each historical analog, compute:

| Metric | Definition |
|--------|-----------|
| `soxx_fwd_3m` | SOXX price change, +63 trading days |
| `soxx_fwd_6m` | SOXX price change, +126 trading days |
| `soxx_fwd_12m` | SOXX price change, +252 trading days |
| `outcome_direction_3m` | `positive` / `negative` / `flat` (within ±5%) |
| `max_drawdown_3m` | Maximum intraperiod drawdown before recovery |
| `volatility_3m` | Annualized daily return std dev over window |

**Aggregate across top-3 analogs:**

| Output | Calculation |
|--------|------------|
| `median_fwd_3m` | Median of top-3 soxx_fwd_3m |
| `range_fwd_3m` | [min, max] across top-3 |
| `positive_count` | Count of analogs with positive 3M outcome |
| `pattern_note` | Auto-generated: "In N of 3 similar setups, SOXX was positive over 3M" |

---

## 7. Data Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| Engine v2 only exists from 2026 | Historical snapshots require recomputation | Backfill script using v2 engine on historical prices |
| AI concentration pre-2020 requires market cap estimates | Approximation error ±10% | Flag Tier B/C matches in output |
| Backfill = ~2,100 snapshots | Small sample for rare conflict types | Minimum 3 analog requirement; return null if not met |
| Forward outcomes capped at T-252d | Current year snapshots have no 12M outcome | Only return available horizons per analog |
| yfinance market cap is current-only | Historical weights not available | Use price-return drift approximation (see P2-5 method) |
| Universe changes over time (delistings, additions) | Breadth comparisons across eras are noisy | Normalize universe_count as a feature; downweight breadth for pre-2019 |

---

## 8. UI Usage (Future — Phase E)

### Placement

Two locations (neither modifies existing Phase 1/2 panels):

1. **MASTER tab** — new "HISTORICAL ANALOG" section below existing KPI strip
2. **Strategy Layer** — "Historical Context" subsection at the bottom (non-blocking)

### MASTER Tab Card Layout

```
┌─ HISTORICAL ANALOG ─────────────────────────────────────────┐
│ Similarity threshold: 3 setups found within distance 0.28    │
│                                                              │
│ Closest analog: 2021-11-15  (distance: 0.21)                │
│ State: LATE EXPANSION · AI_DISTORTION                        │
│ Key match: engine_score, breadth_score, ai_concentration     │
│ Key diff:  rsi was lower (54 vs 78 now)                      │
│                                                              │
│ What followed (SOXX):                                        │
│   3M  │  6M  │ 12M                                          │
│  -8%  │ -22% │ -35%  (analog 1)                             │
│  +3%  │  -9% │  -7%  (analog 2)                             │
│  -5%  │ -14% │ -18%  (analog 3)                             │
│                                                              │
│ Pattern: In 0 of 3 similar setups, SOXX was positive over 3M│
│ ⚠ Not a forecast — historically similar structural setup only│
└──────────────────────────────────────────────────────────────┘
```

### Display Rules

- Never show forward outcome as a number alone — always show range
- Always show the disclaimer: "Not a forecast — historically similar structural setup only"
- If top5_weight approximation is used (Tier B/C), add: "Some historical fields are approximated"
- Disable the card entirely if match count < 3

---

## 9. Implementation Phases

### Phase A — Design (complete)
- This document

### Phase B — Historical Label DB
**Target:** Build `analog_snapshots` table from 2017-present

```
File: marketflow/backend/scripts/build_analog_backfill.py

Steps:
1. Load all SOXX trading dates from 2017-01-01
2. For each date, load ticker prices up to that date
3. Rerun v2 engine pipeline (normalizeMetrics → engineScore → confidence)
4. Rerun breadth / momentum calculators at that date
5. Estimate ai_concentration using price-drift method
6. Store snapshot row in SQLite analog_snapshots table
7. Post-process: fill soxx_fwd_3m/6m/12m for all eligible dates

Estimated rows: ~2,100
Estimated runtime: 30–60 min (bulk DB reads, no yfinance)
```

### Phase C — Offline Similarity Test
**Target:** Validate matching quality before wiring to API

```
File: marketflow/backend/scripts/test_analog_similarity.py

Steps:
1. Load today's current vector
2. Run distance search against analog_snapshots
3. Print top-10 matches with distances
4. Review: are matches structurally sensible?
5. Tune weights if needed
6. Establish match threshold (target: 3–10 matches within 0.35)
```

### Phase D — API Output
**Target:** Add `historical_analogs` field to `/api/semiconductor-lens`

```ts
// Additive field — nullable
historical_analogs: {
  match_count: number
  threshold_used: number
  analogs: Array<{
    date: string
    distance: number
    cycle_state: string
    conflict_type: string
    key_similarities: string[]
    key_differences: string[]
    soxx_fwd_3m:  number | null
    soxx_fwd_6m:  number | null
    soxx_fwd_12m: number | null
  }>
  aggregate: {
    median_fwd_3m:   number | null
    range_fwd_3m:    [number, number] | null
    positive_count:  number
    pattern_note:    string
  }
} | null
```

### Phase E — UI Card
**Target:** MASTER tab card + Strategy Layer context

Files to modify:
- `TerminalXDashboard.tsx` — MASTER tab section
- Strategy Layer — append Historical Context subsection

Dependency: Phase D must be complete and tested.

---

## Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-28 | 1.0 | Initial design document — Phase A complete |
