# AI Bottleneck Radar — Phase E-1: Theme Purity Manual Metadata

Branch: `v1.1` | Frozen: 2026-05-09

---

## 1. Purpose

Phase E-1 adds expert-defined, deterministic theme purity metadata to all 13 AI infrastructure buckets. This metadata drives two outcomes:

1. **UI badges** in the State Labels table — compact visual indicators of how "real" each bucket's AI story is
2. **State Label Engine override** — `PRE_COMMERCIAL + STORY_HEAVY` buckets receive a forced `STORY_ONLY` state regardless of RS/RRG data; `commercialization_risk=true` buckets receive the `COMMERCIALIZATION_UNCERTAINTY` risk flag

No LLM extraction, no earnings calls, no automated inference. All values are manually defined by domain experts.

---

## 2. New File: `aiInfraThemePurity.ts`

Path: `marketflow/frontend/src/lib/ai-infra/aiInfraThemePurity.ts`

### Types

| Type | Values |
|---|---|
| `ThemePurity` | `PURE_PLAY` \| `PARTIAL` \| `STORY_HEAVY` |
| `CommercializationStage` | `COMMERCIAL` \| `SCALING` \| `EARLY` \| `PRE_COMMERCIAL` |
| `AIExposureLevel` | `DIRECT` \| `INDIRECT` \| `EMERGING` |
| `StoryConfidence` | `HIGH` \| `MEDIUM` \| `LOW` |
| `RevenueVisibility` | `VISIBLE` \| `PARTIAL` \| `NOT_YET_VISIBLE` |

### `BucketThemePurity` shape

```ts
{
  theme_purity:            ThemePurity
  commercialization_stage: CommercializationStage
  ai_exposure_level:       AIExposureLevel
  story_confidence:        StoryConfidence
  revenue_visibility:      RevenueVisibility
  commercialization_risk:  boolean
  rationale:               string
}
```

### 13-Bucket Definitions (summary)

| Bucket | theme_purity | comm_stage | revenue_vis | comm_risk |
|---|---|---|---|---|
| AI_CHIP | PURE_PLAY | COMMERCIAL | VISIBLE | false |
| HBM_MEMORY | PURE_PLAY | COMMERCIAL | VISIBLE | false |
| PACKAGING | PARTIAL | COMMERCIAL | VISIBLE | false |
| TEST_EQUIPMENT | PARTIAL | COMMERCIAL | PARTIAL | false |
| DATA_CENTER_INFRA | PARTIAL | SCALING | PARTIAL | false |
| POWER_INFRA | PARTIAL | SCALING | PARTIAL | false |
| COOLING | PARTIAL | SCALING | PARTIAL | false |
| OPTICAL_NETWORK | PARTIAL | SCALING | PARTIAL | false |
| RAW_MATERIAL | **STORY_HEAVY** | EARLY | NOT_YET_VISIBLE | **true** |
| SPECIALTY_GAS | PARTIAL | COMMERCIAL | VISIBLE | false |
| CLEANROOM_WATER | PARTIAL | COMMERCIAL | VISIBLE | false |
| **GLASS_SUBSTRATE** | **STORY_HEAVY** | **PRE_COMMERCIAL** | **NOT_YET_VISIBLE** | **true** |
| PCB_SUBSTRATE | PARTIAL | SCALING | PARTIAL | false |

### Exported helpers

```ts
getThemePurity(bucketId: string): BucketThemePurity | undefined
THEME_PURITY_LABEL: Record<ThemePurity, string>       // 'Pure Play' | 'Partial' | 'Story Heavy'
COMM_STAGE_LABEL:  Record<CommercializationStage, string>
REVENUE_VIS_LABEL: Record<RevenueVisibility, string>
```

---

## 3. Modified File: `aiInfraStateLabels.ts`

Path: `marketflow/frontend/src/lib/ai-infra/aiInfraStateLabels.ts`

### Changes

1. `AIInfraBucketState` interface — added `theme_purity?: BucketThemePurity` field
2. `computeBucketState()` — added **Rule 0** and **Rule 0b** before existing Rule 1:

**Rule 0 — inject purity + risk flag:**
```ts
const purity = getThemePurity(bucket_id)
if (purity?.commercialization_risk) {
  risk_flags.push('COMMERCIALIZATION_UNCERTAINTY')
}
```

**Rule 0b — PRE_COMMERCIAL + STORY_HEAVY → force STORY_ONLY:**
```ts
if (purity?.theme_purity === 'STORY_HEAVY' && purity?.commercialization_stage === 'PRE_COMMERCIAL') {
  return { state_label: 'STORY_ONLY', state_score: null, confidence: 'LOW', ... }
}
```

3. All 8 remaining return statements — added `theme_purity: purity` field

### Affected Buckets

| Bucket | Rule 0 (risk flag) | Rule 0b (force STORY_ONLY) |
|---|---|---|
| GLASS_SUBSTRATE | ✅ COMMERCIALIZATION_UNCERTAINTY | ✅ forced STORY_ONLY |
| RAW_MATERIAL | ✅ COMMERCIALIZATION_UNCERTAINTY | — (EARLY, not PRE_COMMERCIAL) |

---

## 4. Modified File: `AIInfrastructureRadar.tsx`

Path: `marketflow/frontend/src/components/ai-infra/AIInfrastructureRadar.tsx`

### Changes

1. Added imports:
```ts
import { THEME_PURITY_LABEL, REVENUE_VIS_LABEL } from '@/lib/ai-infra/aiInfraThemePurity'
import type { BucketThemePurity } from '@/lib/ai-infra/aiInfraThemePurity'
```

2. Added `PurityBadges` component (near `StateBadge`, line ~105):
   - Shows `ThemePurity` label in color (teal = PURE_PLAY, amber = STORY_HEAVY, text2 = PARTIAL)
   - Shows `미확인` badge (amber) only when `revenue_visibility === 'NOT_YET_VISIBLE'`
   - Shows `상용화 불확실` badge (red) only when `commercialization_risk === true`

3. State Labels table — added **Purity** column (5th column, between Confidence and Reason):
```tsx
<td style={{ padding: '7px 8px' }}>
  {s.theme_purity && <PurityBadges purity={s.theme_purity} />}
</td>
```

---

## 5. Data Flow

```
aiInfraThemePurity.ts (BUCKET_THEME_PURITY)
  ↓ getThemePurity(bucket_id)
computeBucketState() in aiInfraStateLabels.ts
  ↓ Rule 0: COMMERCIALIZATION_UNCERTAINTY flag
  ↓ Rule 0b: STORY_ONLY override for PRE_COMMERCIAL + STORY_HEAVY
  ↓ theme_purity field injected into AIInfraBucketState
/api/ai-infra/theme-momentum
  ↓ bucket_states[] (includes theme_purity)
AIInfrastructureRadar.tsx
  ↓ PurityBadges rendered per row in State Labels tab
```

---

## 6. Design Decisions

**Why manual metadata, not automated?**
AI theme exposure cannot be extracted reliably from earnings calls or SEC filings without hallucination risk. Expert judgment ensures consistency and auditability.

**Why Rule 0b forces STORY_ONLY regardless of RS?**
A PRE_COMMERCIAL + STORY_HEAVY bucket (e.g., GLASS_SUBSTRATE) has no revenue to validate. An RS-derived state label (LEADING, LAGGING, etc.) would be misleading — price momentum may reflect narrative, not fundamentals.

**Why only `NOT_YET_VISIBLE` revenue badge is shown (not all)?**
`VISIBLE` and `PARTIAL` are the default/expected states. Only `NOT_YET_VISIBLE` warrants a visual warning.

---

## 7. QA Results

| Check | Result |
|---|---|
| TypeScript | 0 errors |
| GLASS_SUBSTRATE state | STORY_ONLY (forced by Rule 0b) |
| GLASS_SUBSTRATE risk flags | includes COMMERCIALIZATION_UNCERTAINTY |
| RAW_MATERIAL risk flags | includes COMMERCIALIZATION_UNCERTAINTY |
| All other buckets | Rule 0b not triggered (not PRE_COMMERCIAL + STORY_HEAVY) |
| Purity column renders | PASS |
| `theme_purity` undefined guard | `{s.theme_purity && <PurityBadges ... />}` |
| Deep Dive system | Unchanged |

---

## 8. Phase E-2 Backlog Item

**E-2: AI Theme Price Momentum Pipeline (per-symbol return grid)**

Proposed inputs: same `ohlcv_daily`, same 10-layer basket definitions
Proposed output: per-symbol weekly return heatmap inside each layer
Placement: SelectedLayerDetailPanel expansion or new tab
Prerequisite: E-1 frozen ✅
