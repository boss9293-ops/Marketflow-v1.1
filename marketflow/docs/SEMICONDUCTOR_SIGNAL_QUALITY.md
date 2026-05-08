# Semiconductor Signal Quality Score

## Purpose

Deterministic summary score that answers:

> **How reliable is the current semiconductor cycle signal?**

Not a trading recommendation. Forbidden language: buy / sell / entry / exit / strong buy / take profit.

---

## Inputs

All inputs use existing data already available in the UI. No external APIs added.

| Layer | Source |
|-------|--------|
| Benchmark RS | `/api/semiconductor-benchmark-rs` → `SOXX_vs_QQQ` / `SOXX_vs_SPY` status |
| RRG Rotation | `/api/semiconductor-rrg-paths` → classifyRrgRotation() → leadershipMode |
| Flow / Volume | `/api/semiconductor-flow-proxy` → overallStatus / confirmingBuckets / distributionPressureBuckets |
| Breadth / Momentum | `live.kpis.breadth_pct` / `advancing_pct` (prop from parent) |
| SOXL Decay | `/api/soxl-decay` → summary.status |
| Data Trust | `dataStatusCounts` prop (live / cache / static / pending counts) |

---

## Scoring Weights

| Component | Max Points |
|-----------|-----------|
| Benchmark RS | 20 |
| RRG Rotation | 25 |
| Flow / Volume | 15 |
| Breadth / Momentum | 20 |
| SOXL Decay | 10 |
| Data Trust | 10 |
| **Total** | **100** |

---

## Component Scoring Rules

### Benchmark RS — 20 pts

| Condition | Score | Label |
|-----------|-------|-------|
| SOXX leading QQQ and SPY | 20 | Confirming |
| SOXX leading one, neutral on other | 15 | Confirming |
| Both neutral | 10 | Neutral |
| Lagging one | 7 | Caution |
| Lagging both | 3 | Diverging |
| Any Pending | 0 | Pending |

### RRG Rotation — 25 pts

| `leadershipMode` | Score | Label |
|-----------------|-------|-------|
| Broad Leadership / Rotation Broadening | 25 | Confirming |
| Narrow Leadership | 18 | Neutral |
| High Dispersion | 12 | Neutral |
| Rotation Weakening | 7 | Caution |
| Pending | 0 | Pending |

### Flow / Volume — 15 pts

| Condition | Score | Label |
|-----------|-------|-------|
| 2+ confirming buckets, no distribution | 15 | Confirming |
| 1 confirming bucket | 10 | Neutral |
| Neutral overall | 8 | Neutral |
| Thin Participation | 5 | Caution |
| Distribution Pressure detected | 3 | Diverging |
| Pending | 0 | Pending |

### Breadth / Momentum — 20 pts

| Condition | Score | Label |
|-----------|-------|-------|
| breadth ≥ 65% AND advancing ≥ 55% | 20 | Confirming |
| breadth ≥ 55% | 15 | Neutral |
| breadth ≥ 45% | 10 | Neutral |
| breadth < 45% | 5 | Caution |
| null | 0 | Pending |

### SOXL Decay — 10 pts

| Status | Score | Label |
|--------|-------|-------|
| FAVORABLE | 10 | Confirming |
| NEUTRAL | 8 | Neutral |
| CAUTION | 5 | Caution |
| STRESS | 2 | Diverging |
| PENDING | 0 | Pending |

### Data Trust — 10 pts

Live ratio = (LIVE + CACHE) / total

| Live Ratio | Score | Label |
|-----------|-------|-------|
| ≥ 70% | 10 | Confirming |
| ≥ 50% | 7 | Neutral |
| ≥ 30% | 4 | Caution |
| < 30% | 2 | Diverging |
| total = 0 | 0 | Pending |

---

## Final Label Thresholds

`pct = score / (sum of active component maxScores) × 100`

| Condition | Label |
|-----------|-------|
| ≥ 3 components Pending | Pending |
| pct ≥ 80 | High |
| pct ≥ 60 | Medium |
| pct ≥ 40 | Mixed |
| pct < 40 | Low |

---

## Missing Data Rules

- Pending components contribute 0 to `score` AND are excluded from `maxScore`
- `pct` is computed over the active (non-pending) max only
- Missing data is never silently treated as zero — it reduces or marks the overall quality
- Display: `—` for pending scores, not `0`

---

## UI Placement

**ENGINE right panel** — compact Signal Quality card:
```
SIGNAL QUALITY
72 / 85   Medium
Confirming:
  · SOXX leading QQQ and SPY
  · Breadth 78%, advancing 61%
Caution:
  · Flow proxy Neutral — not confirmed
  · SOXL decay elevated — leverage drag noted
```

**DATA LAB mini (right panel footer)** — component breakdown table:
```
Benchmark RS    20/20  Confirming
RRG Rotation    18/25  Neutral
Flow Volume      8/15  Neutral
Breadth Momentum 15/20 Neutral
SOXL Decay       8/10  Neutral
Data Trust        7/10 Neutral
```

---

## Non-Trading Language Rule

Forbidden: buy / sell / entry / exit / accumulation (as signal) / strong buy / take profit  
Allowed: Confirming / Neutral / Diverging / Caution / Pending / Signal Quality / Participation / Rotation Quality / Data Confidence

---

## Limitations

1. Score is deterministic — it does not use AI or LLM weighting
2. Weights are fixed; no dynamic adjustment for market regime
3. Breadth data depends on `live.kpis` prop being populated from the backend
4. SOXL decay is a 3M window by default (not configurable in Signal Quality layer)
5. Flow proxy uses 5D/20D volume — noisy for sparse-trading tickers (ASML)
6. Do not interpret a High score as a directional signal

---

## TypeScript Contract

**File**: `marketflow/frontend/src/lib/semiconductor/signalQuality.ts`  
**Key exports**:
- `SignalQualityInputs` — input bag passed to `computeSignalQuality()`
- `SemiconductorSignalQuality` — output type
- `computeSignalQuality(inputs)` — pure deterministic function
- `SQ_COLOR`, `SQ_BG`, `COMP_LABEL_COLOR` — design tokens

---

## Relationship to Other Layers

| Layer | Role |
|-------|------|
| Benchmark RS | Absolute performance context |
| RRG Rotation | Relative rotation classification |
| Flow Proxy | Volume participation confirmation |
| Breadth / Momentum | Internal market health |
| SOXL Decay | Leverage environment context |
| **Signal Quality** | Cross-layer agreement summary |

Signal Quality reads from all other layers but does not feed back into any of them. It is read-only aggregation.
