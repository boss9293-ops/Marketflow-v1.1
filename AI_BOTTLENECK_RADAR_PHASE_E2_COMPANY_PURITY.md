# AI Bottleneck Radar Phase E-2 — Company-Level Theme Purity

Branch: `v1.1` | Frozen: 2026-05-10

---

## Purpose

Phase E-2 adds company-level (symbol-level) theme purity metadata for all symbols in the 13 AI infrastructure buckets. This is the second layer of the Theme Purity system, below the bucket-level metadata added in E-1.

E-2 is manually curated and deterministic. It does not include earnings extraction, LLM analysis, or investment recommendations.

---

## Why Company-Level Metadata Is Needed

Symbols inside the same bucket can have very different exposure purity.

Examples:

| Symbol | Bucket | Exposure |
|---|---|---|
| VRT | COOLING | Pure data center — AI infra direct |
| ETN | COOLING | Broad electrification — AI is important but not pure |
| TT | COOLING | HVAC primary — AI server cooling is secondary |
| MU | HBM_MEMORY | US proxy — real HBM leaders (Samsung/SK Hynix) not priced |
| GLW | GLASS_SUBSTRATE | Story-level — AI glass substrate revenue not yet visible |
| FCX | RAW_MATERIAL | Commodity copper — AI narrative exists but not revenue-linked |

Without symbol-level metadata, a bucket RS signal may overstate or understate actual AI infrastructure relevance.

---

## Metadata Schema

```ts
type AIInfraCompanyPurityMetadata = {
  symbol:                   string
  company_name?:            string
  primary_bucket:           AIInfraBucketId
  secondary_buckets?:       AIInfraBucketId[]
  company_theme_purity:     AIInfraCompanyPurity        // PURE_PLAY | HIGH_EXPOSURE | MIXED_EXPOSURE | INDIRECT_EXPOSURE | STORY_HEAVY | DATA_INSUFFICIENT
  ai_infra_exposure_level:  AIInfraCompanyExposureLevel // HIGH | MEDIUM | LOW | INDIRECT
  commercial_stage:         AIInfraCompanyCommercialStage
  revenue_visibility:       AIInfraCompanyRevenueVisibility
  pure_play_score:          number   // 0–100, manual
  ai_infra_relevance_score: number   // 0–100, manual
  commercialization_risk:   boolean
  indirect_exposure:        boolean
  story_risk:               boolean
  notes:                    string[]
}
```

### Score Guidance

| Score | Meaning |
|---|---|
| 80–100 | Direct, confirmed AI infra revenue |
| 60–79 | Material AI exposure with some dilution |
| 40–59 | Mixed; AI is a meaningful segment but not dominant |
| 20–39 | Indirect or story-level; AI narrative drives interest, not revenue |
| 0–19 | Negligible direct AI infrastructure connection |

---

## Symbol Coverage

43 unique symbols across 13 buckets.

| Bucket | Symbols |
|---|---|
| AI_CHIP | NVDA, AMD, AVGO, MRVL |
| HBM_MEMORY | MU |
| PACKAGING | AMAT, KLAC, ACMR, TSM |
| COOLING | VRT, ETN, TT, MOD, NVT |
| PCB_SUBSTRATE | TTMI, SANM, CLS, FLEX |
| TEST_EQUIPMENT | TER, COHU, FORM, KLAC, ONTO |
| GLASS_SUBSTRATE | GLW, AMAT |
| OPTICAL_NETWORK | ANET, CIEN, LITE, COHR, AVGO |
| POWER_INFRA | ETN, PWR, HUBB, GEV, VRT, NVT |
| CLEANROOM_WATER | ACMR, XYL, ECL, WTS |
| SPECIALTY_GAS | LIN, APD, ENTG |
| DATA_CENTER_INFRA | EQIX, DLR, IRM, VRT |
| RAW_MATERIAL | FCX, SCCO, TECK, COPX |

All bucket symbols from `aiInfraBucketMap.ts` are covered.

---

## Duplicate Symbol Handling

One record per symbol. Symbols appearing in multiple buckets use:
- `primary_bucket`: the bucket where they are most relevant
- `secondary_buckets`: additional buckets where they appear

Multi-bucket symbols:

| Symbol | Primary | Secondary |
|---|---|---|
| AVGO | AI_CHIP | OPTICAL_NETWORK, PACKAGING |
| VRT | COOLING | POWER_INFRA, DATA_CENTER_INFRA |
| ETN | COOLING | POWER_INFRA |
| NVT | COOLING | POWER_INFRA |
| KLAC | PACKAGING | TEST_EQUIPMENT |
| AMAT | PACKAGING | GLASS_SUBSTRATE |
| ACMR | PACKAGING | CLEANROOM_WATER |
| MRVL | AI_CHIP | OPTICAL_NETWORK |

---

## API Response

`/api/ai-infra/theme-momentum` now returns `company_purity: AIInfraCompanyPurityMetadata[]` alongside existing `bucket_states`, `buckets`, etc. Backward compatible — no existing fields removed.

---

## UI Display

A **Company Purity Summary Grid** is rendered below the State Labels table in the STATE LABELS tab.

Per-bucket compact card shows:
- `AI <score>` — average `ai_infra_relevance_score` across bucket companies
- `Purity <score>` — average `pure_play_score`
- `Hi×N` — count of HIGH exposure companies (teal)
- `Story×N` — count of story_risk companies (amber)
- `Ind×N` — count of indirect_exposure companies (dimmed)

Cards appear only if companies exist for the bucket. Score fields appear only if computable.

---

## Validation

`validateAIInfraCompanyPurity()` checks:

- No duplicate symbols
- Score values 0–100
- STORY_HEAVY purity → story_risk or commercialization_risk must be set
- INDIRECT_EXPOSURE purity → indirect_exposure must be true
- Every symbol in `aiInfraBucketMap.ts` has a company purity record

Returns `{ valid, errors, warnings }`. Does not fail runtime UI.

---

## Limitations

1. **Scores are manual** — no automatic calculation from financial data
2. **No earnings confirmation** — E-2 does not parse earnings calls or SEC filings
3. **No LLM analysis** — all values are expert-defined
4. **KR symbols excluded** — Samsung, SK Hynix not US-priced; only MU as HBM proxy
5. **CCMP excluded** — CMC Materials acquired by Entegris 2022, delisted
6. **ETF in symbol list** — COPX is an ETF (copper miners basket), not a single company
7. **Score drift** — manual scores need periodic review as company business mix evolves

---

## Deferred Items

| Item | Reason |
|---|---|
| Earnings confirmation layer | E-3 or later |
| LLM earnings extraction | Out of scope — data quality risk |
| MOU vs actual revenue classifier | Requires earnings parsing |
| Automatic SEC/transcript extraction | Future pipeline phase |
| Per-symbol trend overlay in SelectedLayerTrendChart | E-3 candidate |
| Korean-listed HBM symbols (Samsung/SK Hynix) | Requires KIS pipeline |

---

## Next Phase Recommendation

**E-3: Per-Symbol Trend Overlay in Selected Layer Trend Chart**

Add individual symbol lines behind the basket index in `SelectedLayerTrendChart`, colored by `ai_infra_exposure_level` from E-2 metadata. High-exposure symbols shown prominently, indirect/story symbols shown dimmed.

Prerequisite: E-2 frozen ✅
No new DB tables required.
