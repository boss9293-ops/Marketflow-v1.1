# AI Infra Hub E-5 Expand Earnings Coverage

> Date: 2026-05-12
> Type: Coverage Expansion
> Status: READY_FOR_E5B_QA

---

## Purpose

E-4 MVP의 14-symbol 시드를 확장하여 DATA_LIMITED 버킷을 줄이고 커버리지를 보수적으로 넓힙니다.
핵심 원칙: 확인되지 않은 것을 확인된 것처럼 만들지 않는다.

---

## E-4 / E-4B Context

E-4 (14 symbols): NVDA, AMD, AVGO, MU, TSM, AMAT, LRCX, KLAC, VRT, ETN, PWR, GLW, ANET, SMCI
E-4B fixes: one-name PARTIAL/INDIRECT bucket cap, empty evidence_types guard

E-4 이후 버킷 상태 (코드 기준 실제 계산값):
| 버킷 | Level | Score |
|------|-------|-------|
| AI_CHIP | CONFIRMED | 85 |
| HBM_MEMORY | WATCH | 59 (one-name PARTIAL cap) |
| PACKAGING | PARTIAL | 66 |
| COOLING | PARTIAL | 62 |
| POWER_INFRA | WATCH | 50 |
| GLASS_SUBSTRATE | DATA_LIMITED | 0 |
| OPTICAL_NETWORK | CONFIRMED | 80 |
| DATA_CENTER_INFRA | NOT_CONFIRMED | 20 |
| TEST_EQUIPMENT | DATA_LIMITED | 0 |
| PCB_SUBSTRATE | DATA_LIMITED | 0 |
| CLEANROOM_WATER | DATA_LIMITED | 0 |
| SPECIALTY_GAS | DATA_LIMITED | 0 |
| RAW_MATERIAL | DATA_LIMITED | 0 |

---

## Symbols Added (7)

### Priority A — 이연 핵심 심볼

| 심볼 | 버킷 | 근거 | 회사 Level | Score |
|------|------|------|------------|-------|
| ASML | PACKAGING | EUV 리소그래피 장비 — AI 칩 첨단 노드 생산 필수 | CONFIRMED | 95 |
| APH | OPTICAL_NETWORK | 고속 커넥터/케이블 어셈블리 — AI 서버 인터커넥트 | WATCH | 50 |

**ASML 분류 규칙** (Section 4 amendment):
- `ai_revenue_visibility` = PARTIAL (반도체 설비투자 의존, direct AI revenue 아님)
- `guidance_tone` = RAISED (EUV 수주 잔고 다년 확보, hyperscaler 팹 투자 명시)
- VISIBLE 금지: ASML을 VISIBLE로 기록하면 NEEDS_DATA_FIX

**APH 분류 규칙** (Section 4 amendment):
- `commercialization_status` = EARLY_REVENUE (AI 데이터센터 커넥터 매출 초기)
- REVENUE_VISIBLE 금지: explicit AI datacenter revenue segment 없음
- IT datacom 세그먼트 성장 근거이나 AI 전용 매출 미공개

### Priority B — DATA_LIMITED 버킷 커버리지

| 심볼 | 버킷 | 회사 Level | Score |
|------|------|------------|-------|
| TER | TEST_EQUIPMENT | WATCH | 40 |
| ENTG | SPECIALTY_GAS | PARTIAL | 65 |
| EQIX | DATA_CENTER_INFRA | CONFIRMED | 80 |
| TTMI | PCB_SUBSTRATE | NOT_CONFIRMED | 25 |
| FCX | RAW_MATERIAL | DATA_LIMITED | 0 (INDIRECT) |

---

## Company Purity Added (2)

| 심볼 | primary_bucket | purity | exposure | pure_play_score |
|------|----------------|--------|----------|-----------------|
| ASML | PACKAGING | MIXED_EXPOSURE | HIGH | 65 |
| APH | OPTICAL_NETWORK | MIXED_EXPOSURE | MEDIUM | 50 |

---

## Buckets Improved

| 버킷 | Before | After | 변화 |
|------|--------|-------|------|
| PACKAGING | PARTIAL (66) | PARTIAL (72) | score 개선 (ASML 추가) |
| OPTICAL_NETWORK | CONFIRMED (80) | WATCH (55) | ↓ universe 확장으로 희석 (아래 설명) |
| TEST_EQUIPMENT | DATA_LIMITED (0) | NOT_CONFIRMED (20) | ↑ DATA_LIMITED 해소 |
| SPECIALTY_GAS | DATA_LIMITED (0) | WATCH (45) | ↑ DATA_LIMITED 해소 |
| DATA_CENTER_INFRA | NOT_CONFIRMED (20) | WATCH (50) | ↑ coverage 50%로 상승 |

### OPTICAL_NETWORK 변화 설명

APH 추가 전: ANET(100) 단독, 1/4=25% → penalty 20, bucket score = 80 (CONFIRMED)
APH 추가 후: universe 5개, 2/5=40% → penalty 20, avg=(100+50)/2=75, bucket score = 55 (WATCH)

ANET 단독 CONFIRMED은 1-symbol 집중 과잉 표현이었습니다.
APH 추가로 더 정확한 bucket 수준으로 재평가됩니다.

---

## Buckets Still DATA_LIMITED (4)

| 버킷 | 이유 |
|------|------|
| GLASS_SUBSTRATE | GLW PRE_COMMERCIAL, score=0 — 의도적 DATA_LIMITED 유지 |
| PCB_SUBSTRATE | TTMI score=25, penalty=20, adjusted=5 — 증거 부족 |
| CLEANROOM_WATER | XYL/ECL/WTS 전부 INDIRECT/INFRA_ENABLER — coverage deferred |
| RAW_MATERIAL | FCX INDIRECT-only, score=0 after deductions — 구리 수요 서사만 존재 |

**CLEANROOM_WATER 지연 사유**: XYL(수처리), ECL(산업위생), WTS(배관)는 universe에 있으나 AI-specific 매출 증거가 없음. "coverage deferred — no suitable listed symbol with direct AI evidence."

---

## Conservative Evidence Rules Applied

1. **ASML**: ai_revenue_visibility = PARTIAL (capex-driven, not AI inference revenue)
2. **APH**: commercialization_status = EARLY_REVENUE (AI datacenter connector 초기 단계)
3. **FCX**: MANAGEMENT_COMMENTARY only + INDIRECT → score 0, DATA_LIMITED 유지
4. **TTMI**: SEGMENT_GROWTH + MGMT only, guidance NEUTRAL → low score, DATA_LIMITED 유지
5. **GLW**: PRE_COMMERCIAL 유지, DATA_LIMITED 유지

---

## Scoring / Aggregation Impact

### E-5 이후 전체 버킷 예상

| 버킷 | Covered | Coverage | Penalty | Avg Score | Adj Score | Level |
|------|---------|----------|---------|-----------|-----------|-------|
| AI_CHIP | 3/4 | 75% | 0 | 85 | 85 | CONFIRMED |
| HBM_MEMORY | 1/1 | 100% | 0 | 65→59 | 59 (one-name cap) | WATCH |
| PACKAGING | 5/6 | 83% | 0 | 72 | 72 | PARTIAL |
| COOLING | 2/5 | 40% | 20 | 82.5 | 62 | PARTIAL |
| POWER_INFRA | 1/3 | 33% | 20 | 70→50 | 50 (one-name PARTIAL cap) | WATCH |
| GLASS_SUBSTRATE | 1/1 | 100% | 0 | 0 | 0 | DATA_LIMITED |
| OPTICAL_NETWORK | 2/5 | 40% | 20 | 75 | 55 | WATCH |
| DATA_CENTER_INFRA | 2/4 | 50% | 10 | 60 | 50 | WATCH |
| TEST_EQUIPMENT | 1/4 | 25% | 20 | 40 | 20 | NOT_CONFIRMED |
| PCB_SUBSTRATE | 1/4 | 25% | 20 | 25 | 5 | DATA_LIMITED |
| CLEANROOM_WATER | 0/3 | 0% | — | — | 0 | DATA_LIMITED |
| SPECIALTY_GAS | 1/3 | 33% | 20 | 65 | 45 | WATCH |
| RAW_MATERIAL | 1/4 | 25% | 20 | 0 | 0 | DATA_LIMITED |

**Summary 변화:**
| 레벨 | E-4 | E-5 |
|------|-----|-----|
| CONFIRMED | 2 (AI_CHIP, OPTICAL) | 1 (AI_CHIP) |
| PARTIAL | 2 (PACKAGING, COOLING) | 2 |
| WATCH | 2 (HBM, POWER) | 5 (HBM, POWER, OPTICAL, DC_INFRA, SPECIALTY_GAS) |
| NOT_CONFIRMED | 1 (DC_INFRA) | 1 (TEST_EQUIP) |
| DATA_LIMITED | 6 | 4 |

OPTICAL_NETWORK CONFIRMED → WATCH: APH 추가로 universe 확장, 1-symbol 과잉 표현 해소.
DATA_LIMITED 6개 → 4개: TEST_EQUIPMENT와 SPECIALTY_GAS 해소.

---

## Section 16 Final Report Checklist

| 항목 | 결과 |
|------|------|
| ASML ai_revenue_visibility PARTIAL or below? | ✅ PARTIAL (capex-driven, not inference revenue) |
| APH commercialization_status EARLY_REVENUE or below? | ✅ EARLY_REVENUE |

---

## UI Impact

EARNINGS 탭 자동 업데이트 (EarningsConfirmationPanel.tsx 수정 없음):
- Section A Summary Strip: CONFIRMED=1, PARTIAL=2, WATCH=5, NOT_CONFIRMED=1, DATA_LIMITED=4
- Section B Bucket Table: 13개 버킷 업데이트
- Section C Company Table: 21 symbols (14 + 7 신규), score 기준 정렬
- Section D Evidence Gaps: PCB_SUBSTRATE/CLEANROOM_WATER/RAW_MATERIAL/GLASS_SUBSTRATE 4개

---

## Validation

| 항목 | 결과 |
|------|------|
| 총 seed symbols | 21 |
| 중복 심볼 | 없음 |
| Invalid bucket_id | 없음 |
| ASML ai_revenue_visibility | PARTIAL ✅ |
| APH commercialization_status | EARLY_REVENUE ✅ |
| GLW story-heavy 유지 | DATA_LIMITED ✅ |
| RAW_MATERIAL INDIRECT cap | DATA_LIMITED ✅ |
| one-name bucket PARTIAL/INDIRECT cap | HBM(MU/PARTIAL)=WATCH, POWER(PWR/PARTIAL)=WATCH ✅ |
| CLEANROOM_WATER coverage | deferred — no suitable symbol ✅ |
| TypeScript | exit 0 ✅ |
| Forbidden language | 없음 ✅ |

---

## Remaining Limitations

1. **OPTICAL_NETWORK 재확인**: 2/5 커버리지, APH 증거 PARTIAL — 추가 심볼(CIEN/COHR/LITE) seed 추가 시 개선 가능
2. **PCB_SUBSTRATE 여전히 DATA_LIMITED**: TTMI 증거 약함 — 한국 기판 심볼 미상장 구조적 한계
3. **CLEANROOM_WATER**: XYL/ECL/WTS 간접 노출만 존재, E-6으로 지연
4. **RAW_MATERIAL**: 구리 수요 서사만, INDIRECT-only cap으로 DATA_LIMITED 영구적일 가능성
5. **분기별 수동 갱신**: LLM 추출 미구현 — E-6 이후 자동화 필요

---

## Deferred Automation

- E-6: CLEANROOM_WATER 대안 탐색 / PCB_SUBSTRATE 추가 심볼 (SANM/CLS)
- E-7: LLM 기반 earnings call transcript 추출
- E-8: SEC 8-K/10-Q 파싱 자동화

---

## Next Step

**READY_FOR_E5B_QA**

E-5B QA 체크리스트:
- [ ] ASML ai_revenue_visibility = PARTIAL (VISIBLE 금지 위반 없음)
- [ ] APH commercialization_status = EARLY_REVENUE (REVENUE_VISIBLE 금지 위반 없음)
- [ ] OPTICAL_NETWORK CONFIRMED → WATCH 전환이 올바른지 확인
- [ ] DATA_LIMITED 버킷 4개만 남음 확인
- [ ] GLW DATA_LIMITED 유지 확인
- [ ] RAW_MATERIAL DATA_LIMITED 유지 확인
- [ ] validateAllSeedRecords() 위반 없음 확인
- [ ] TypeScript exit 0 확인
- [ ] EARNINGS 탭 21개 심볼 렌더 확인
