# AI Bottleneck Radar Phase F-2 Bottleneck Heatmap

Branch: `v1.1` | Date: 2026-05-11

---

## Purpose

Phase F-2 adds a Bottleneck Heatmap tab to the AI Bottleneck Radar. It enables fast cross-bucket comparison of all 13 AI infrastructure buckets across State, RS, Return, Purity, Risk, and Coverage in a single compact table.

F-2 adds a comparison visualization layer only. It does not add earnings confirmation, create a standalone dashboard, or produce investment recommendations.

---

## Why Heatmap Is Needed

The Value Chain Ladder (F-1) shows flow and structure — 1차→5차 sequencing with bucket-level detail.

The Bottleneck Heatmap answers a different question: **which buckets are strongest right now, and which carry risk?**

```
Ladder  = structural flow / stage understanding
Heatmap = fast cross-bucket comparison / strength scan
```

---

## Component Structure

File: `marketflow/frontend/src/components/ai-infra/BottleneckHeatmap.tsx`

```ts
export type BottleneckHeatmapProps = {
  bucketStates:       AIInfraBucketState[]
  buckets?:           AIInfraBucketMomentum[]
  selectedBenchmark?: 'SOXX' | 'QQQ' | 'SPY'
  compact?:           boolean
}
```

Internal structure:
- `stateMap`: `Map<bucket_id, AIInfraBucketState>` for O(1) state lookup
- `momentumMap`: `Map<bucket_id, AIInfraBucketMomentum>` for O(1) momentum lookup
- Row order: follows `AI_INFRA_BUCKETS` array order (stage-ordered by definition)
- Stage header rows: inserted between stage groups (same pattern as StateLabelsTable)

---

## Row / Column Definitions

### Rows

13 buckets in value-chain stage order:

| Stage | Buckets |
|---|---|
| Stage 1 | AI_CHIP |
| Stage 2 | HBM_MEMORY, PACKAGING |
| Stage 3 | COOLING, PCB_SUBSTRATE, TEST_EQUIPMENT, GLASS_SUBSTRATE, OPTICAL_NETWORK |
| Stage 4 | POWER_INFRA, CLEANROOM_WATER, SPECIALTY_GAS |
| Stage 5 | DATA_CENTER_INFRA, RAW_MATERIAL |

Stage header rows are inserted between groups with accent color per stage.

### Columns

| Column | Source | Format |
|---|---|---|
| BUCKET | `state.display_name` | Text + stage accent bar |
| STATE | `state.state_label` | Colored badge |
| SCORE | `state.state_score` | Integer |
| 1M RS | `getRSForBenchmark(bucket, bm).one_month` | +/− % |
| 3M RS | `getRSForBenchmark(bucket, bm).three_month` | +/− % |
| 6M RS | `getRSForBenchmark(bucket, bm).six_month` | +/− % |
| RET 3M | `bucket.returns.three_month` | +/− % |
| PURITY | `state.theme_purity?.theme_purity` | Label |
| RISK | `state.risk_flags` | Condensed badges |
| COV | `state.source.coverage_ratio` | % |

RS columns are highlighted (teal underline in header) to signal benchmark dependency.

---

## Data Sources

All data from the existing `/api/ai-infra/theme-momentum` response:

| Field | Used For |
|---|---|
| `bucket_states[]` | State label, score, risk flags, theme purity, coverage ratio |
| `buckets[]` | RS vs benchmarks, absolute returns |
| `selected_benchmark` | RS column header + helper lookup |

Uses existing helpers:
- `getRSForBenchmark(bucket, benchmark)` from `aiInfraStateLabels.ts`
- `fmtRS(v)` and `rsColor(v)` from `aiInfraBucketRS.ts`

No new API route created.

---

## Color Encoding

### RS / Return cells

| Threshold | Color |
|---|---|
| ≥ +10 | #22c55e (strong positive) |
| ≥ +3 | #3FB6A8 (teal) |
| > −3 | #B8C8DC (neutral) |
| > −10 | #F2A93B (amber) |
| ≤ −10 | #E55A5A (red) |

### State cells

Uses `STATE_COLORS` map (consistent with all other panels).

### Purity cells

| Purity | Color |
|---|---|
| PURE_PLAY | #3FB6A8 (teal) |
| PARTIAL | #B8C8DC (text2) |
| STORY_HEAVY | #F2A93B (amber) |

### Coverage cells

| Coverage | Color |
|---|---|
| ≥ 80% | teal |
| ≥ 50% | amber |
| < 50% | red |

### Risk badges

| Flag | Label | Color |
|---|---|---|
| COMMERCIALIZATION_UNCERTAINTY | Comm.Risk | red |
| OVERHEAT_RISK | Overheat | amber |
| LOW_COVERAGE | LowCov | text3 |
| BENCHMARK_MISSING | NoBM | text3 |

---

## Integration Location

Tab added to `AIInfrastructureRadar.tsx` tab bar:

```
VALUE CHAIN | HEATMAP | STATE LABELS | RELATIVE STRENGTH | RRG
```

HEATMAP is the second tab (after VALUE CHAIN). Default tab remains VALUE CHAIN (`useState<ActiveTab>('ladder')`).

No existing tabs removed or modified.

---

## Missing Data Behavior

| Missing Data | Display |
|---|---|
| No `bucketStates` | Full empty state with explanatory text |
| Missing RS | `—` |
| Missing return | `—` |
| Missing theme purity | `—` |
| Missing risk flags | `—` |
| Missing coverage | 0% (ratio = 0) |
| State not in STATE_COLORS map | Falls back to V.text3 |

No undefined, null, or NaN shown to user.

---

## Limitations

1. No sort toggle — rows always in stage/value-chain order (sort by score deferred to F-2B or later)
2. No hover details — tooltips not implemented (no existing tooltip pattern in this UI)
3. No benchmark-vs-benchmark comparison in heatmap — only selected benchmark RS shown (RS vs all three available in RELATIVE STRENGTH tab)
4. Horizontal scroll on narrow viewports — 10 columns may require scroll on mobile
5. STORY_ONLY buckets show `—` for RS/Return when data is absent (GLASS_SUBSTRATE expected)

---

## Deferred Items

| Item | Phase |
|---|---|
| Sort by score / RS column | F-2B or later |
| Hover tooltip per cell | Future |
| Export to CSV | Future |
| Color threshold customization | Future |
| Per-bucket trend sparkline | Future |

---

## Next Phase Recommendation

**F-2B UI QA / Density Review**

The heatmap is 10 columns wide. Verify that:
- Font sizes are 10px minimum throughout
- Row heights are not cramped
- Stage header rows are clearly visible
- Benchmark switching visually updates RS columns
- Missing data cells don't look like errors
- No forbidden language
- TypeScript build passes

After F-2B QA passes → **F-3** (TBD by Architect).
