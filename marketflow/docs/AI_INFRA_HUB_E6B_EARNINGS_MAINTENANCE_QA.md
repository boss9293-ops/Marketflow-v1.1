# AI Infra Hub E-6B Earnings Maintenance QA

> Date: 2026-05-12
> Type: QA Report
> Status: PASS

---

## Scope

E-6B validates the maintenance infrastructure added in E-6:
1. Freshness reference date logic (dataset.as_of, not system date)
2. Level transition changelog coverage
3. Existing guardrails preserved post-E-6

---

## Check 1 — Freshness Reference Date

**Rule:** `getDatasetFreshness` and `getEarningsEvidenceFreshness` must use `dataset_meta.as_of` as reference — never `new Date()` or `Date.now()`.

**Evidence (aiInfraEarningsConfirmation.ts):**
- L132: `// E-6 amendment: reference date = dataset_meta.as_of (NOT system current date).`
- L152: `// Use dataset_meta.as_of as referenceDate — never pass new Date() here.`
- Both freshness functions take explicit `referenceDate: string` parameter
- No `new Date()` or `Date.now()` calls in freshness functions

**Panel usage (EarningsConfirmationPanel.tsx):**
```tsx
const freshness = getDatasetFreshness(
  summary.as_of ?? '',
  AI_INFRA_EARNINGS_EVIDENCE_META.as_of,  // ← dataset reference, not system date
)
```

**Result: PASS ✅**

---

## Check 2 — Level Transition Changelog Coverage

**Rule:** Every bucket `confirmation_level` transition must have a corresponding entry in `AI_INFRA_EARNINGS_CHANGELOG` with `level_transition` field populated.

**Changelog entries verified (aiInfraEarningsEvidenceSeed.ts):**

| Date | Version | Bucket / Symbol | Transition | Documented |
|------|---------|-----------------|------------|------------|
| 2026-05-12 | E4 | (Initial seed) | — | ✅ |
| 2026-05-12 | E5 | (7 symbols added) | — | ✅ |
| 2026-05-12 | E5 | OPTICAL_NETWORK | CONFIRMED → PARTIAL | ✅ |
| 2026-05-12 | E5 | TEST_EQUIPMENT | DATA_LIMITED → NOT_CONFIRMED | ✅ |
| 2026-05-12 | E5 | SPECIALTY_GAS | DATA_LIMITED → WATCH | ✅ |
| 2026-05-12 | E5 | DATA_CENTER_INFRA | NOT_CONFIRMED → WATCH | ✅ |

All level transitions from E-5 expansion are documented.
No undocumented transitions detected.

**Result: PASS ✅**

---

## Check 3 — Guardrails Preserved

### G1 — Story-Heavy (GLW / GLASS_SUBSTRATE)

GLW seed record:
- `evidence_types: ['MANAGEMENT_COMMENTARY', 'COMMERCIALIZATION_PROGRESS']`
- `ai_revenue_visibility: 'NOT_DISCLOSED'`
- `commercialization_status: 'PRE_COMMERCIAL'`
- caution_notes confirm: "Glass substrate for semiconductors is pre-commercial — no AI substrate revenue."

Score calculation:
- MANAGEMENT_COMMENTARY: +10
- PRE_COMMERCIAL: -25
- backlog NOT_DISCLOSED: -10
- → raw score ≈ -25, clamped to 0 → DATA_LIMITED ✅

**GLW remains DATA_LIMITED ✅**

### G2 — Indirect Exposure (FCX / RAW_MATERIAL)

FCX seed record:
- `evidence_types: ['MANAGEMENT_COMMENTARY']`
- `ai_revenue_visibility: 'INDIRECT'`

Score calculation:
- MANAGEMENT_COMMENTARY: +10
- INDIRECT: -15
- → raw score = -5, clamped to 0

allIndirect cap (aiInfraEarningsConfirmation.ts L317–318):
```typescript
const allIndirect = covered.every(e => e.ai_revenue_visibility === 'INDIRECT')
if (allIndirect) adjustedScore = Math.min(adjustedScore, 59)
```
- adjustedScore = min(0, 59) = 0 → DATA_LIMITED ✅

**FCX / RAW_MATERIAL remains DATA_LIMITED ✅**

### G3 — One-Name INDIRECT/PARTIAL Cap

Code verified (aiInfraEarningsConfirmation.ts L321–325):
```typescript
const isOneName = covered.length === 1
if (isOneName) {
  const vis = covered[0].ai_revenue_visibility
  if (vis === 'INDIRECT' || vis === 'PARTIAL') adjustedScore = Math.min(adjustedScore, 59)
}
```
Cap in place, applied after E-5B evidence floor ✅

### G4 — Revenue-Class Gate

Code verified (aiInfraEarningsConfirmation.ts L236):
```
// Revenue-class gate: MANAGEMENT_COMMENTARY alone cannot reach PARTIAL or above
```
Validation helper also enforces at L448:
```
// Section 7 amendment: MANAGEMENT_COMMENTARY-only cannot reach PARTIAL or above
```
Gate preserved ✅

### G5 — Aggregation Dilution Floor (E-5B)

Code verified (aiInfraEarningsConfirmation.ts L313–314):
```typescript
const evidenceFloor = Math.max(0, maxCompanyScore - 30)
adjustedScore = Math.max(adjustedScore, evidenceFloor)
```
Floor applied BEFORE safety caps — prevents weak additions from collapsing strong buckets ✅

**Result: PASS ✅**

---

## Check 4 — API Backward Compatibility

New exports in E-6 (aiInfraEarningsConfirmation.ts):
- `EarningsEvidenceFreshness` — new type, additive
- `getDatasetFreshness(asOf, referenceDate)` — new function, additive
- `getEarningsEvidenceFreshness(record, referenceDate)` — new function, additive

New exports in E-6 (aiInfraEarningsEvidenceSeed.ts):
- `AI_INFRA_EARNINGS_EVIDENCE_META` — new const, additive
- `AI_INFRA_EARNINGS_CHANGELOG` — new const, additive

All existing exports unchanged. No breaking changes. ✅

---

## Check 5 — EARNINGS Tab Regression

Summary Strip additions are purely additive:
- Footer row with dataset version, symbol count, freshness label, disclaimer
- Uses `AI_INFRA_EARNINGS_EVIDENCE_META.dataset_version` and `.as_of` (static const)
- `companiesCount` prop added to `SummaryStrip` — called with `companies.length` ✅
- No existing props removed or renamed

BucketTable, CompanyTable, EvidenceGaps — unchanged ✅

---

## Summary

| Check | Status |
|-------|--------|
| 1. Freshness uses dataset.as_of (not system date) | ✅ PASS |
| 2. All level transitions logged in changelog | ✅ PASS |
| 3a. GLW / GLASS_SUBSTRATE → DATA_LIMITED | ✅ PASS |
| 3b. FCX / RAW_MATERIAL → DATA_LIMITED | ✅ PASS |
| 3c. One-name INDIRECT/PARTIAL cap in code | ✅ PASS |
| 3d. Revenue-class gate in code | ✅ PASS |
| 3e. E-5B evidence floor in code | ✅ PASS |
| 4. API backward compatibility | ✅ PASS |
| 5. EARNINGS tab regression | ✅ PASS |

---

## Verdict

**ALL E-6B CHECKS PASS**

Gate condition satisfied per E-6B WORK_ORDER:
> metadata valid ✅ freshness deterministic ✅ reference date = dataset.as_of ✅
> changelog covers level changes ✅ guardrails preserved ✅ EARNINGS tab stable ✅

**→ READY_FOR_THEME_MAP_DESIGN**
