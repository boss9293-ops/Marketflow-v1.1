# AI Infra Hub E-4B Earnings Confirmation QA

> Date: 2026-05-12
> Type: QA + Minor Fixes
> Recommendation: READY_FOR_E5_EXPAND_EARNINGS_COVERAGE

---

## Purpose

E-4 Manual Earnings Confirmation MVP가 보수적이고 정확하며 기존 AI Infra Radar와 회귀 없이 동작하는지 검증합니다.

핵심 질문: EARNINGS 탭이 confirmed 비즈니스 증거와 가격/스토리/간접/데이터 부족 신호를 올바르게 구분하는가.

Files inspected: `aiInfraEarningsEvidenceSeed.ts`, `aiInfraEarningsConfirmation.ts`, `EarningsConfirmationPanel.tsx`, `AIInfrastructureRadar.tsx`, `route.ts`

---

## API Response Review

| 항목 | 결과 |
|------|------|
| `earnings_confirmation` 필드 존재 | ✅ `buildResponseFromRows` 반환 포함 |
| `buckets[]` 필드 | ✅ |
| `companies[]` 필드 | ✅ |
| `summary` 필드 | ✅ |
| 기존 `bucket_states` 보존 | ✅ |
| 기존 `infra_to_soxx_translation` 보존 | ✅ |
| 기존 `infra_historical_analog` 보존 | ✅ |
| 기존 `infra_educational_narrative` 보존 | ✅ |
| Benchmark 파라미터 전파 | ✅ SOXX/QQQ/SPY 모두 동일 earnings data (가격 무관) |
| Invalid benchmark | ✅ Next.js API handler에서 default 처리 |

`earnings_confirmation`은 `computeAllBucketEarningsConfirmation()`을 통해 결정론적으로 계산됨 — 시장 가격 데이터와 독립.

---

## Manual Seed Data Integrity

| 항목 | 결과 |
|------|------|
| 총 심볼 수 | 14 |
| 중복 심볼 | 없음 ✅ |
| Invalid bucket id | 없음 ✅ |
| Missing source | 없음 ✅ |
| Non-array notes | 없음 ✅ |
| Empty evidence_types | 없음 ✅ |
| Score 범위 위반 | 없음 ✅ |
| MGMT_COMMENTARY-only PARTIAL/CONFIRMED | 없음 ✅ (GLW = DATA_LIMITED) |
| INDIRECT-only bucket CONFIRMED | 없음 ✅ |

Validation helper `validateAllSeedRecords()` — 위반 없음.

---

## Company-Level Scoring Review

### 5.1 NVDA

| 필드 | 값 | 판단 |
|------|-----|------|
| evidence_types | AI_REVENUE + BACKLOG + GUIDANCE + SEGMENT_GROWTH + MARGIN + MGMT_COMM | ✅ |
| ai_revenue_visibility | VISIBLE | ✅ |
| guidance_tone | RAISED | ✅ |
| backlog_or_orders | STRONG | ✅ |
| commercialization_status | REVENUE_VISIBLE | ✅ |
| computed score | 100 → CONFIRMED | ✅ 허용 — 최강 AI 매출 증거 보유 |
| forbidden language | 없음 | ✅ |
| evidence_notes | 비즈니스 수익 근거 명시 | ✅ |

### 5.2 AVGO / AMD / MU / TSM

| 심볼 | Score | Level | 판단 |
|------|-------|-------|------|
| AVGO | 90 | CONFIRMED | ✅ AI ASIC 매출 명시 + backlog STRONG |
| AMD | 65 | PARTIAL | ✅ MI300 성장하나 CPU 희석 반영 |
| MU | 65 → WATCH (※) | WATCH | ※ E-4B Fix: one-name bucket cap 적용 (HBM_MEMORY) |
| TSM | 90 | CONFIRMED | ✅ CoWoS 매출 직접 확인 |

※ MU는 HBM_MEMORY 버킷의 유일 심볼(PARTIAL exposure) → 버킷 레벨 WATCH 캡 적용.

AI 노출 구분 유지 여부: ✅ NVDA > AVGO > TSM > KLAC/AMD 순서 합리적.

### 5.3 VRT / ETN / PWR — evidence_notes 언어 검사

**Section 5.3 Amendment**: evidence_notes가 "data center / power infrastructure demand"를 명시하는지, "AI revenue" / "AI semiconductor demand" 문구 없는지 확인.

| 심볼 | evidence_notes 언어 | 판단 |
|------|---------------------|------|
| VRT | "Liquid cooling and power management for **AI data centers** driving revenue." | ✅ data center 수요, AI semiconductor 아님 |
| VRT | "Backlog >2x revenue, majority **AI data center**." | ✅ |
| ETN | "Electrical segment **data center** bookings growing significantly." | ✅ |
| ETN | "**AI data center** named as key growth driver in earnings commentary." | ✅ data center demand |
| PWR | "Electric **power infrastructure** contracts for data centers increasing." | ✅ |
| PWR | "Backlog at record levels with **data center** as key driver." | ✅ |

"AI revenue" / "AI semiconductor demand" 문구: **없음** ✅ → NEEDS_DATA_FIX 불필요.

caution_notes에서 "AI revenue not separately disclosed" 문구는 적절한 주의 표현. ✅

| 심볼 | Score | Level | 판단 |
|------|-------|-------|------|
| VRT | 100 | CONFIRMED | ✅ 액체 냉각 매출 직접 확인 — 순수 AI 인프라 기업 |
| ETN | 65 | PARTIAL | ✅ AI_REVENUE PARTIAL + 항공/자동차 희석 반영 |
| PWR | 70 | PARTIAL | ✅ AI_REVENUE PARTIAL + 전력 인프라 EPC 혼재 반영 |

### 5.4 GLW

| 필드 | 값 | 판단 |
|------|-----|------|
| evidence_types | MANAGEMENT_COMMENTARY + COMMERCIALIZATION_PROGRESS only | ✅ 매출 근거 없음 |
| commercialization_status | PRE_COMMERCIAL | ✅ |
| score | +10 (MGMT) - 25 (PRE_COMM) = -15 → clamp 0 | ✅ |
| confirmation_level | DATA_LIMITED | ✅ — CONFIRMED 불가 |
| revenue-class gate | 없음 → max WATCH, score 0 → DATA_LIMITED | ✅ 이중 보호 |

GLW가 GLASS_SUBSTRATE 테마 주목에도 불구하고 DATA_LIMITED 유지: ✅ 올바른 동작.

### 5.5 SMCI

| 필드 | 값 | 판단 |
|------|-----|------|
| evidence_types | AI_REVENUE + SEGMENT_GROWTH + MGMT_COMM | ✅ |
| margin_quality | PRESSURED → -10 | ✅ 압력 반영 |
| caution_notes | 감사 이슈, 마진 압박, 회계 재작성 이력 | ✅ |
| score | +25+15+10-10 = 40 | ✅ |
| level | WATCH | ✅ — 회계 불확실성으로 적절히 WATCH |

---

## Bucket-Level Aggregation Review

### 6.1 Low Coverage Buckets (DATA_LIMITED 유지)

| 버킷 | Coverage | Level | 판단 |
|------|----------|-------|------|
| TEST_EQUIPMENT | 0% | DATA_LIMITED | ✅ |
| PCB_SUBSTRATE | 0% | DATA_LIMITED | ✅ |
| CLEANROOM_WATER | 0% | DATA_LIMITED | ✅ |
| SPECIALTY_GAS | 0% | DATA_LIMITED | ✅ |
| RAW_MATERIAL | 0% | DATA_LIMITED | ✅ |

5개 버킷 모두 의도적 DATA_LIMITED 유지. 누락 데이터로 높은 점수 부여 없음. ✅

### 6.2 Indirect-Only Bucket Cap

현재 시드에서 `ai_revenue_visibility === 'INDIRECT'`인 심볼 없음 → 캡 적용 케이스 없으나 로직 구현 완료. ✅

RAW_MATERIAL 버킷: FCX/SCCO/TECK가 purity 맵에서 `indirect_exposure: true`이나 earnings seed 미포함 → DATA_LIMITED. ✅

### 6.3 Story-Heavy Bucket Handling

GLASS_SUBSTRATE: GLW PRE_COMMERCIAL + STORY_HEAVY → DATA_LIMITED. ✅

Bucket caution_summary에 GLW의 caution_notes 첫 2개 포함:
- "Glass substrate for semiconductors is pre-commercial — no AI substrate revenue."
- "Fiber optic revenue does not confirm glass substrate investment thesis."

✅ 스토리 주의 버킷 표현 적절.

### 6.4 One-Name Bucket Risk — E-4B Fix Applied

**Issue 발견**: HBM_MEMORY 버킷이 MU 단독(PARTIAL exposure)으로 score=65 → PARTIAL이었으나 새 규칙 위반.

**수정**: `aggregateBucketEarningsConfirmation`에 one-name INDIRECT/PARTIAL cap 추가.

```typescript
// Section 6.4 amendment: one-name bucket with INDIRECT or PARTIAL → cap at WATCH
if (covered.length === 1) {
  const vis = covered[0].ai_revenue_visibility
  if (vis === 'INDIRECT' || vis === 'PARTIAL') {
    adjustedScore = Math.min(adjustedScore, 59)
  }
}
```

One-name bucket 현황 (Final Report 항목):

| 버킷 | 단독 심볼 | Coverage | Exposure | Level (수정 후) |
|------|-----------|----------|----------|-----------------|
| HBM_MEMORY | MU | 100% | PARTIAL | WATCH (59) ← fixed |
| GLASS_SUBSTRATE | GLW | 100% | NOT_DISCLOSED | DATA_LIMITED (0) ✅ |
| POWER_INFRA | PWR | 33% | PARTIAL | WATCH (50, coverage penalty 선적용) ✅ |
| OPTICAL_NETWORK | ANET | 25% | VISIBLE | PARTIAL (70, coverage penalty 적용) — cap 해당 없음 ✅ |
| DATA_CENTER_INFRA | SMCI | 25% | VISIBLE | DATA_LIMITED (10 after penalty) ✅ |

HBM_MEMORY: SK Hynix/Samsung US 미상장으로 단독 US proxy → 버킷 PARTIAL 과잉 표현 방지. ✅

---

## Revenue-Class Gate Review

Section 7 amendment: MANAGEMENT_COMMENTARY alone → max WATCH (59).

| 케이스 | evidence_types | score | level | 판단 |
|--------|---------------|-------|-------|------|
| GLW | MGMT_COMM + COMMERCIALIZATION_PROGRESS | 0 (PRE_COMM -25 적용) | DATA_LIMITED | ✅ |
| 가설: MGMT_COMM only, score=10 | No revenue class | min(10, 59)=10 | DATA_LIMITED | ✅ |
| 가설: MGMT_COMM + GUIDANCE_RAISED | No revenue class | min(30, 59)=30 | NOT_CONFIRMED max | ✅ |
| NVDA | AI_REVENUE + 5종 | 100 | CONFIRMED | ✅ revenue class 보유 |

CONFIRMED 도달에 revenue-class 증거 필수: `hasRevenueClassEvidence()` 검증 완료. ✅
MANAGEMENT_COMMENTARY-only PARTIAL/CONFIRMED 없음: ✅

---

## EARNINGS Tab UI Review

| 항목 | 결과 |
|------|------|
| EARNINGS 탭 존재 | ✅ `AIInfrastructureRadar.tsx` |
| 탭 순서 | ✅ VALUE CHAIN / HEATMAP / EARNINGS / STATE LABELS / RS / RRG |
| Section A Summary Strip | ✅ 6개 stat chip |
| Section B Bucket Table | ✅ Bucket / Level / Score / Coverage / Evidence / Caution |
| Section C Company Table | ✅ 상위 14개 score 기준 정렬 |
| Section D Evidence Gaps | ✅ DATA_LIMITED + WATCH + caution 있는 버킷 |
| 폰트 ≥ 10px | ✅ 최소 10px, 헤더 11px |
| 컬럼 헤더 색상 | ✅ #B8C8DC (text2) — navigational minimum 준수 |
| undefined/null/NaN 표시 | ✅ '—' fallback |
| earningsConfirmation null 처리 | ✅ "Earnings confirmation data unavailable." |
| 이모지 없음 | ✅ |
| 면책 텍스트 | ✅ "Business evidence, not investment advice" 성격 disclaimer 존재 |

---

## Product Language Safety

Forbidden language 검색 결과:

| 금지 표현 | EarningsConfirmationPanel | Seed data | Confirmed.ts |
|-----------|--------------------------|-----------|--------------|
| Buy/Sell | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| Strong Buy/Entry/Exit | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| predicts/guarantees | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| 매수/매도/진입/청산 | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| 추천/목표가 | 없음 ✅ | 없음 ✅ | 없음 ✅ |

사용된 허용 표현:
- Earnings Confirmation, Business Evidence, Revenue Visibility
- Guidance Tone, Backlog / Orders, Commercialization Status
- Confirmed, Partial, Watch, Data Limited

Disclaimer: "Earnings Confirmation is a business evidence layer only... not a stock rating or trading signal." ✅

---

## Integration With Existing Layers

**Theme Purity 연동**: GLW = STORY_HEAVY + PRE_COMMERCIAL → earnings DATA_LIMITED. 두 레이어 일관성 ✅

**State Labels 연동**: LEADING/CROWDED 버킷이 earnings DATA_LIMITED라면 Evidence Gap 섹션에 노출. ✅

**Bridge Summary**: E-4에서 Bridge Summary 미수정. EARNINGS 탭 전용. ✅

**기존 탭 회귀**:
| 탭 | 상태 |
|----|------|
| VALUE CHAIN | ✅ 미변경 |
| HEATMAP | ✅ 미변경 |
| STATE LABELS | ✅ 미변경 |
| RELATIVE STRENGTH | ✅ 미변경 |
| RRG | ✅ 미변경 |
| Benchmark selector | ✅ 미변경 |
| Compact Bridge Summary | ✅ 미변경 |

---

## Missing Data Behavior

| 상황 | 동작 |
|------|------|
| empty evidence_types | score=0 (early return) → DATA_LIMITED ✅ |
| symbol not in seed | getCompanyEarningsEvidence → undefined (safe) ✅ |
| bucket no coverage | DATA_LIMITED + "No coverage in current seed data." ✅ |
| missing notes | flatMap 빈 배열 → evidence_summary='' ✅ |
| missing source.as_of | `as_of` = undefined → "Unknown" in UI ✅ |
| earningsConfirmation null | "Earnings confirmation data unavailable." ✅ |
| undefined/null/NaN | '—' fallback in all td renderers ✅ |

---

## Regression Check

| 항목 | 상태 |
|------|------|
| Compact bridge summary | ✅ 미변경 |
| VALUE CHAIN 탭 | ✅ |
| HEATMAP 탭 | ✅ |
| EARNINGS 탭 | ✅ 신규 — EarningsConfirmationPanel |
| STATE LABELS 탭 | ✅ |
| RELATIVE STRENGTH 탭 | ✅ |
| RRG 탭 | ✅ |
| Benchmark selector | ✅ earnings는 벤치마크 무관 |
| TypeScript | ✅ exit 0 (수정 후 재확인) |

---

## Issues Found

### Issue 1: HBM_MEMORY PARTIAL 과잉 표현 (FIXED)

**발견**: HBM_MEMORY 버킷이 단일 심볼 MU(PARTIAL)로 coverage=100%이지만 score=65 → PARTIAL. MU는 US-only proxy로 SK Hynix/Samsung 미포함. One-name PARTIAL 버킷이 PARTIAL 수준을 받는 것은 과잉.

**수정**: `aggregateBucketEarningsConfirmation`에 Section 6.4 cap 추가. HBM_MEMORY → WATCH (59).

### Issue 2: 빈 evidence_types 방어 코드 없음 (FIXED)

**발견**: `computeCompanyEarningsScore`에 `evidence_types = []` 케이스 명시적 처리 없음. 수학적으로는 0이 나오나 코드 의도가 불명확.

**수정**: 함수 시작부에 early return `if (length === 0) return 0` 추가.

### Issue 3: 검증 함수 빈 evidence_types 체크 누락 (FIXED)

**발견**: `validateEarningsEvidenceRecord`가 `evidence_types`의 배열 여부만 확인하고 빈 배열 케이스를 별도 경고 없이 통과.

**수정**: 빈 배열일 때 "evidence_types is empty" 경고 메시지 추가.

---

## Minor Fixes Applied

1. `computeCompanyEarningsScore`: empty evidence_types early return 추가 (`aiInfraEarningsConfirmation.ts`)
2. `aggregateBucketEarningsConfirmation`: Section 6.4 one-name INDIRECT/PARTIAL cap 추가
3. `validateEarningsEvidenceRecord`: empty evidence_types 경고 추가

TypeScript: exit 0 (수정 후 재확인) ✅

---

## Remaining Limitations

1. **Browser rendering not verified**: 정적 코드 분석만. 브라우저 QA 별도 필요.
2. **5개 미커버 버킷**: TEST_EQUIPMENT, PCB_SUBSTRATE, CLEANROOM_WATER, SPECIALTY_GAS, RAW_MATERIAL — DATA_LIMITED 유지.
3. **OPTICAL_NETWORK 단일 심볼**: ANET VISIBLE이라 캡 없으나 coverage=25% → -30 penalty. 결과 PARTIAL(70-30=40→WATCH). 실제 ANET 비즈니스 증거는 강력하나 1개 심볼 한계.
4. **DATA_CENTER_INFRA 단일 심볼**: SMCI(VISIBLE, score=40) + -30 penalty = 10 → DATA_LIMITED. EQIX/DLR/IRM 시드 추가 시 개선 가능.
5. **분기별 갱신 수동**: LLM 추출 없음 — E-5 이후 과제.
6. **HBM_MEMORY US-only proxy**: 삼성·SK하이닉스 미포함으로 구조적 한계. 영구 주의 사항.

---

## Final Report

| 항목 | 상태 |
|------|------|
| Files inspected | 5개 (seed + confirmation + panel + radar + route) |
| Files created | `AI_INFRA_HUB_E4B_EARNINGS_CONFIRMATION_QA.md` |
| Files modified | `aiInfraEarningsConfirmation.ts` (3 minor fixes) |
| API response verified | ✅ |
| Seed validation passed | ✅ 위반 없음 |
| Seed symbols | 14 |
| Buckets covered | 8/13 |
| Invalid seed records | 0 |
| Duplicate symbols | 없음 |
| Company-level scoring | ✅ 보수적, GLW=DATA_LIMITED, SMCI=WATCH |
| Bucket aggregation | ✅ (HBM fix 후) |
| Revenue-class gate | ✅ |
| Indirect-only cap | ✅ 구현 (현 시드 INDIRECT 없음) |
| Story-heavy bucket | ✅ GLASS_SUBSTRATE = DATA_LIMITED |
| One-name bucket list | HBM(MU/100%/PARTIAL), GLASS(GLW/100%/NOT_DISCLOSED), POWER(PWR/33%/PARTIAL), OPTICAL(ANET/25%/VISIBLE), DC_INFRA(SMCI/25%/VISIBLE) |
| VRT/ETN/PWR evidence language | ✅ "data center/power infra demand" — "AI revenue" 문구 없음 |
| EARNINGS tab UI | ✅ 4 sections 렌더 |
| Product language | ✅ forbidden language 없음 |
| Missing data behavior | ✅ |
| Regression | ✅ |
| TypeScript | ✅ exit 0 |
| Issues found | 3 (모두 수정) |
| Minor fixes applied | 3 |

---

## Recommendation

**READY_FOR_E5_EXPAND_EARNINGS_COVERAGE**

E-4B QA 체크 통과. 이슈 3건 발견·수정. TypeScript exit 0.
GLW/story-heavy → DATA_LIMITED 보존. HBM one-name PARTIAL과잉 → WATCH 수정.
다음 단계: E-5 Expand Earnings Coverage (EQIX/DLR/IRM/TER/ASML 등 추가, 5개 미커버 버킷 해소).
