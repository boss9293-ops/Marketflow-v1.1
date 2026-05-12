# AI Infra Hub E-5B Expanded Earnings Coverage QA

> Date: 2026-05-12
> Type: QA + Minor Fix
> Recommendation: READY_FOR_E6_EARNINGS_MAINTENANCE_WORKFLOW

---

## Purpose

E-5 커버리지 확장이 보수적이고 정확한지 검증합니다. 핵심 질문: APH 추가로 발생한 OPTICAL_NETWORK CONFIRMED → WATCH 전환이 타당한 집계 결과인지 아닌지.

Files inspected: `aiInfraEarningsEvidenceSeed.ts`, `aiInfraEarningsConfirmation.ts`, `aiInfraCompanyPurity.ts`, `aiInfraBucketMap.ts`, `EarningsConfirmationPanel.tsx`, `AIInfrastructureRadar.tsx`, `route.ts`

---

## Seed Expansion Integrity

| 항목 | 결과 |
|------|------|
| 총 seed symbols | 21 |
| E-5 신규 추가 | ASML, APH, TER, ENTG, EQIX, TTMI, FCX (7개) |
| 중복 심볼 | 없음 ✅ |
| Invalid bucket_id | 없음 ✅ |
| Invalid enum values | 없음 ✅ |
| Missing source | 없음 ✅ |
| Empty evidence_notes | 없음 ✅ |
| Non-array notes | 없음 ✅ |
| Empty evidence_types | 없음 ✅ |
| Score 범위 위반 | 없음 ✅ |
| TypeScript | exit 0 ✅ |

`validateAllSeedRecords()` — 위반 없음 ✅

---

## ASML Classification Review

| 필드 | 값 | 판단 |
|------|-----|------|
| primary_bucket | PACKAGING | ✅ EUV 리소그래피 = 첨단 패키징·AI칩 생산 장비 |
| ai_revenue_visibility | PARTIAL | ✅ per Section 4 amendment (VISIBLE 금지 준수) |
| evidence_types | AI_REVENUE + BACKLOG + GUIDANCE + SEGMENT_GROWTH + MARGIN + MGMT | ✅ |
| guidance_tone | RAISED | ✅ EUV 수주잔고 다년 확보 |
| backlog_or_orders | STRONG | ✅ hyperscaler fab 투자 명시 |
| commercialization_status | REVENUE_VISIBLE | ✅ 실제 EUV 장비 판매 중 |
| caution_notes | capex-driven / export restriction 명시 | ✅ |
| evidence_notes | 장비 수요 / capex-driven 서술, AI 직접 매출 주장 없음 | ✅ |
| company score | 95 → CONFIRMED | ✅ 장비 수요 강력, 허용 범위 |

**"ASML is confirmed AI revenue because AI chips need lithography" 해석**: 없음 ✅  
**"ASML has strong semiconductor capex exposure, AI-specific visibility PARTIAL" 해석**: ✅ 적용됨

ASML 분류 — **PASS** ✅

---

## APH / OPTICAL_NETWORK Review

### OPTICAL_NETWORK Aggregation Dilution Test

| 항목 | 값 |
|------|-----|
| APH 없을 때 bucket score | 80 (CONFIRMED) |
| APH 추가 후 bucket score (floor 전) | 55 (WATCH) |
| Dilution test 조건 | without ≥ 80 AND with < 60 → **TRIGGERED** |
| 판정 | **NEEDS_SCORE_TUNING** 플래그 |

**원인 분석:**
- ANET(100) 단독 1/4=25% → penalty 20, score = 80 (CONFIRMED)
- APH(50) 추가 후: universe 5개, avg=(100+50)/2=75, 2/5=40% → penalty 20, score = 55 (WATCH)
- 전환 원인: 평균 희석(100→75) + universe 확장 (coverage 25%→40%)
- 증거 품질 변화 없음 — ANET의 증거는 동일하게 강력

**Aggregation dilution guardrail (Section 8 amendment):**  
CONFIRMED → WATCH 전환이 증거 품질 변화가 아닌 universe 확장으로만 발생 → **aggregation artifact 판정**

### E-5B Fix: Minimum Evidence Floor Rule

APH 자체는 올바르게 분류됨. 문제는 집계 함수의 단순 평균.

**수정 내용**: `aggregateBucketEarningsConfirmation`에 최소 증거 바닥(floor) 추가.

```typescript
// E-5B amendment: minimum evidence floor
const maxCompanyScore = Math.max(...scored.map(r => r.score))
const evidenceFloor = Math.max(0, maxCompanyScore - 30)
adjustedScore = Math.max(adjustedScore, evidenceFloor)
```

규칙: 버킷 score는 `(가장 강한 회사 score - 최대 커버리지 페널티 30)` 이하로 내려갈 수 없음.  
이후 INDIRECT-only cap / one-name cap이 이 floor를 override 가능.

**수정 후 OPTICAL_NETWORK:**
- adjustedScore = max(55, 100-30=70) = 70 → **PARTIAL** ✅
- CONFIRMED → PARTIAL (적정 1단계 조정, aggregation artifact 해소)

**APH 분류 검증:**

| 필드 | 값 | 판단 |
|------|-----|------|
| primary_bucket | OPTICAL_NETWORK | ✅ 고속 커넥터/interconnect = 광네트워크 버킷 적합 |
| ai_revenue_visibility | PARTIAL | ✅ datacenter IT segment 성장, AI 전용 미분리 |
| commercialization_status | EARLY_REVENUE | ✅ per Section 4 amendment (REVENUE_VISIBLE 금지 준수) |
| evidence_types | SEGMENT_GROWTH + ORDER_GROWTH + GUIDANCE + MGMT | ✅ revenue-class 포함 |
| caution_notes | AI 전용 미공개 / 산업·자동차 혼재 명시 | ✅ |
| company score | 50 → WATCH | ✅ 보수적 |

**Section 17 Final Report 항목:**
- OPTICAL_NETWORK score without APH: 80 (CONFIRMED) → with APH before fix: 55 (WATCH) → after fix: 70 (PARTIAL)
- Aggregation dilution artifact detected: YES → Fixed by minimum evidence floor rule

APH 분류 — **PASS** ✅  
OPTICAL_NETWORK 전환 — **CONFIRMED → PARTIAL (floor rule 수정 후)** ✅

---

## TEST_EQUIPMENT Review

| 항목 | 값 | 판단 |
|------|-----|------|
| TER primary_bucket | TEST_EQUIPMENT | ✅ |
| coverage | 1/4 = 25% | ✅ |
| penalty | 20 (≥25%) | ✅ |
| TER score | 40 → WATCH | ✅ |
| floor | max(0, 40-30) = 10 | ✅ |
| adjusted | max(20, 10) = 20 | ✅ |
| one-name PARTIAL cap | min(20, 59) = 20 | ✅ |
| bucket level | NOT_CONFIRMED (20) | ✅ |
| evidence notes | AI chip/HBM test demand | ✅ test-specific |
| caution notes | cyclical / industrial dilution 명시 | ✅ |

PARTIAL/CONFIRMED 불가 — ✅ (one-name PARTIAL cap 적용)

TEST_EQUIPMENT — **PASS** ✅

---

## SPECIALTY_GAS Review

| 항목 | 값 | 판단 |
|------|-----|------|
| ENTG primary_bucket | SPECIALTY_GAS | ✅ |
| coverage | 1/3 = 33% | ✅ |
| penalty | 20 (≥25%) | ✅ |
| ENTG score | 65 → PARTIAL | ✅ |
| floor | max(0, 65-30) = 35 | ✅ |
| adjusted | max(45, 35) = 45 | ✅ |
| one-name PARTIAL cap | min(45, 59) = 45 | ✅ cap 적용 |
| bucket level | WATCH (45) | ✅ |
| ai_revenue_visibility | PARTIAL | ✅ capex-driven 서술 |
| caution notes | semiconductor capex / China export restriction | ✅ |

CONFIRMED 불가 — ✅ (one-name PARTIAL cap으로 최대 WATCH)

SPECIALTY_GAS — **PASS** ✅

---

## DATA_CENTER_INFRA Review

| 항목 | 값 | 판단 |
|------|-----|------|
| EQIX primary_bucket | DATA_CENTER_INFRA | ✅ |
| SMCI primary_bucket | DATA_CENTER_INFRA | ✅ |
| coverage | 2/4 = 50% | ✅ |
| penalty | 10 (≥50%) | ✅ |
| EQIX score | 80 → CONFIRMED | ✅ colocation AI 수요 명시 |
| SMCI score | 40 → WATCH | ✅ 감사 이슈 반영 |
| avg score | 60 | ✅ |
| floor | max(0, 80-30) = 50 | ✅ |
| adjusted | max(50, 50) = 50 | ✅ |
| bucket level | WATCH (50) | ✅ |
| EQIX visibility | PARTIAL (colocation, not direct AI compute) | ✅ |
| SMCI caution | 감사·마진·회계 이슈 반영 | ✅ |

데이터센터 REIT 매출 ≠ AI 반도체 직접 매출: ✅ EQIX evidence_notes에서 colocation 서술 명확.

DATA_CENTER_INFRA — **PASS** ✅

---

## Remaining DATA_LIMITED Buckets

| 버킷 | 이유 |
|------|------|
| GLASS_SUBSTRATE | GLW score=0 (PRE_COMMERCIAL + MGMT_ONLY). 의도적 DATA_LIMITED — glass substrate 상업화 없음. ✅ |
| PCB_SUBSTRATE | TTMI score=25, 1/4 coverage → penalty 20, adjusted=5. 증거 약함. ✅ |
| CLEANROOM_WATER | XYL/ECL/WTS 모두 INDIRECT/INFRASTRUCTURE_ENABLER. AI-specific 증거 없음. "coverage deferred" ✅ |
| RAW_MATERIAL | FCX MANAGEMENT_COMMENTARY only + INDIRECT: score=0. allIndirect cap 추가 적용. ✅ |

4개 모두 의도적 DATA_LIMITED 유지. 증거 부족이 근거. ✅

---

## Guardrail Review

| 가드레일 | 상태 |
|----------|------|
| GLW / story-heavy → DATA_LIMITED | ✅ GLW=0, DATA_LIMITED 유지 |
| INDIRECT-only → cap at WATCH (max 59) | ✅ FCX allIndirect, cap 적용 |
| One-name INDIRECT/PARTIAL → cap at WATCH | ✅ TER(PARTIAL)=20, ENTG(PARTIAL)=45, PWR(PARTIAL)=50 |
| Low coverage penalty 작동 | ✅ 1/3-1/4 coverage → penalty 20 |
| Revenue-class gate (MGMT_ONLY ≤ WATCH) | ✅ FCX(MGMT_ONLY)=0 → DATA_LIMITED |
| Minimum floor이 cap 무력화하지 않음 | ✅ cap이 항상 floor를 override |
| ASML PARTIAL (not VISIBLE) | ✅ |
| APH EARLY_REVENUE (not REVENUE_VISIBLE) | ✅ |

모든 E-4B 가드레일 유지 ✅

---

## API Response Review

| 항목 | 결과 |
|------|------|
| `earnings_confirmation` 필드 존재 | ✅ |
| `buckets[]` | ✅ 13개 |
| `companies[]` | ✅ 21개 |
| `summary` | ✅ |
| `bucket_states` 보존 | ✅ |
| `infra_to_soxx_translation` 보존 | ✅ |
| `infra_historical_analog` 보존 | ✅ |
| `infra_educational_narrative` 보존 | ✅ |
| benchmark 파라미터 전파 | ✅ earnings는 benchmark 무관 |

backward compatibility 파괴 없음 ✅

---

## EARNINGS Tab UI Review

| 항목 | 상태 |
|------|------|
| 21개 company rows 처리 | ✅ CompanyTable score 기준 정렬, 상위 14개 기본 표시 |
| 신규 심볼 가시성 | ✅ ASML, APH, TER, ENTG, EQIX, TTMI, FCX |
| Bucket summary 업데이트 | ✅ CONFIRMED=1, PARTIAL=3, WATCH=4, NOT_CONFIRMED=1, DATA_LIMITED=4 |
| Evidence gaps 업데이트 | ✅ PCB_SUBSTRATE/CLEANROOM_WATER/RAW_MATERIAL/GLASS_SUBSTRATE |
| undefined/null/NaN 표시 | ✅ '—' fallback |
| 폰트 ≥ 10px | ✅ |
| 이모지 없음 | ✅ |
| Disclaimer 표시 | ✅ |
| 탭 순서 불변 | ✅ |

---

## Product Language Safety

| 금지 표현 | Seed | Confirmation.ts | Panel |
|-----------|------|-----------------|-------|
| Buy/Sell | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| Entry/Exit/Target | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| predicts/guarantees | 없음 ✅ | 없음 ✅ | 없음 ✅ |
| 매수/매도/추천/목표가 | 없음 ✅ | 없음 ✅ | 없음 ✅ |

---

## Regression Check

| 탭/기능 | 상태 |
|---------|------|
| VALUE CHAIN | ✅ 미변경 |
| HEATMAP | ✅ 미변경 |
| EARNINGS | ✅ 21 symbols, 버킷 업데이트 |
| STATE LABELS | ✅ 미변경 |
| RELATIVE STRENGTH | ✅ 미변경 |
| RRG | ✅ 미변경 |
| Benchmark selector | ✅ 미변경 |
| Compact Bridge Summary | ✅ 미변경 |
| TypeScript | ✅ exit 0 |

---

## Issues Found

### Issue 1: OPTICAL_NETWORK Aggregation Dilution Artifact (FIXED)

**발견**: APH 추가로 OPTICAL_NETWORK가 CONFIRMED(80) → WATCH(55)로 2단계 하락. ANET 증거 품질 변화 없음. universe 확장 + 단순 평균 희석이 원인. Dilution test 조건 충족 (without=80, with=55<60).

**수정**: `aggregateBucketEarningsConfirmation`에 E-5B minimum evidence floor 추가.
```
floor = max(0, maxCompanyScore - 30)
adjustedScore = max(adjustedScore, floor)
```
INDIRECT/one-name cap이 floor를 항상 override.

**결과**: OPTICAL_NETWORK WATCH(55) → PARTIAL(70). Aggregation artifact 해소. ✅

---

## Minor Fixes Applied

1. `aiInfraEarningsConfirmation.ts`: E-5B minimum evidence floor rule 추가 (`aggregateBucketEarningsConfirmation`)

TypeScript: exit 0 (수정 후 재확인) ✅

---

## E-5B 이후 최종 버킷 상태

| 버킷 | Level | Score | 비고 |
|------|-------|-------|------|
| AI_CHIP | CONFIRMED | 85 | NVDA+AMD+AVGO |
| HBM_MEMORY | WATCH | 59 | MU one-name PARTIAL cap |
| PACKAGING | PARTIAL | 72 | 5/6 coverage, ASML 추가 |
| COOLING | PARTIAL | 70 | floor rule로 62→70 |
| POWER_INFRA | WATCH | 50 | PWR one-name PARTIAL cap |
| GLASS_SUBSTRATE | DATA_LIMITED | 0 | GLW PRE_COMMERCIAL 유지 |
| OPTICAL_NETWORK | PARTIAL | 70 | floor rule: 55→70 (artifact 해소) |
| DATA_CENTER_INFRA | WATCH | 50 | EQIX+SMCI 2/4 |
| TEST_EQUIPMENT | NOT_CONFIRMED | 20 | TER 1/4, one-name PARTIAL cap |
| PCB_SUBSTRATE | DATA_LIMITED | 5 | TTMI 증거 약함 |
| CLEANROOM_WATER | DATA_LIMITED | 0 | coverage deferred |
| SPECIALTY_GAS | WATCH | 45 | ENTG 1/3, one-name PARTIAL cap |
| RAW_MATERIAL | DATA_LIMITED | 0 | FCX INDIRECT-only |

Summary: CONFIRMED=1 / PARTIAL=3 / WATCH=4 / NOT_CONFIRMED=1 / DATA_LIMITED=4

---

## Section 17 Final Report

| 항목 | 상태 |
|------|------|
| Files inspected | 9 |
| Files created | `AI_INFRA_HUB_E5B_EXPANDED_EARNINGS_COVERAGE_QA.md` |
| Files modified | `aiInfraEarningsConfirmation.ts` (minimum floor rule) |
| Total seed symbols | 21 |
| Newly added (E-5) | ASML, APH, TER, ENTG, EQIX, TTMI, FCX |
| Duplicate records | 없음 |
| Invalid seed records | 0 |
| ASML classification | ✅ PARTIAL visibility, capex-driven 명시 |
| APH classification | ✅ EARLY_REVENUE, mixed exposure 명시 |
| OPTICAL_NETWORK transition | CONFIRMED → PARTIAL (aggregation artifact → floor rule 수정) ✅ |
| TEST_EQUIPMENT | NOT_CONFIRMED (20) — 보수적 ✅ |
| SPECIALTY_GAS | WATCH (45) — 보수적 ✅ |
| DATA_CENTER_INFRA | WATCH (50) — EQIX+SMCI ✅ |
| DATA_LIMITED 잔존 버킷 | GLASS_SUBSTRATE(PRE_COMM), PCB_SUBSTRATE(약한 증거), CLEANROOM_WATER(deferred), RAW_MATERIAL(INDIRECT-only) |
| GLW story-heavy 유지 | ✅ DATA_LIMITED |
| INDIRECT-only cap | ✅ FCX allIndirect |
| One-name bucket cap | ✅ TER/ENTG/MU/PWR |
| Revenue-class gate | ✅ FCX(MGMT_ONLY)=DATA_LIMITED |
| Minimum floor 가드레일 간섭 없음 | ✅ cap이 floor override |
| API backward compatibility | ✅ |
| EARNINGS tab | ✅ 21 symbols |
| TypeScript | ✅ exit 0 |
| Forbidden language | 없음 ✅ |
| Issues found | 1 (OPTICAL_NETWORK dilution — 수정됨) |
| Minor fixes applied | 1 (minimum evidence floor rule) |
| ASML ai_revenue_visibility PARTIAL or below? | ✅ PARTIAL |
| APH commercialization_status EARLY_REVENUE or below? | ✅ EARLY_REVENUE |
| Aggregation dilution artifact detected? | YES → Fixed ✅ |
| OPTICAL_NETWORK score with/without APH | without=80(CONFIRMED), with before fix=55(WATCH), with after fix=70(PARTIAL) |

---

## Remaining Limitations

1. **OPTICAL_NETWORK 여전히 4개 미커버**: CIEN/LITE/COHR seed 추가 시 PARTIAL → CONFIRMED 회복 가능
2. **PCB_SUBSTRATE DATA_LIMITED**: TTMI 증거 약함, 한국 기판 기업 US 미상장 구조적 한계
3. **CLEANROOM_WATER**: XYL/ECL/WTS 간접 노출만, AI-specific 증거 미존재
4. **RAW_MATERIAL**: 구리 수요 서사 외 근거 없음, INDIRECT-only cap으로 DATA_LIMITED 영구적 가능
5. **Browser rendering not verified**: 정적 코드 분석만

---

## Recommendation

**READY_FOR_E6_EARNINGS_MAINTENANCE_WORKFLOW**

E-5B QA 통과. 이슈 1건(OPTICAL_NETWORK 집계 희석 아티팩트) 발견·수정.  
ASML/APH 분류 보수 기준 준수. 가드레일 전체 유지. TypeScript exit 0.  
DATA_LIMITED 4개 잔존은 증거 부족 기반 의도적 결과.  
다음 단계: E-6 Earnings Maintenance Workflow 또는 Theme Map Design 진행.
