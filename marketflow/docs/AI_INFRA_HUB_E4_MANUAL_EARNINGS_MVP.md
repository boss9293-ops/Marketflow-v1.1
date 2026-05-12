# AI Infra Hub E-4 Manual Earnings Confirmation MVP

> Date: 2026-05-12
> Type: Implementation
> Status: READY_FOR_E4B_QA

---

## Purpose

E-3에서 설계한 Earnings Confirmation 레이어의 수동 시드 기반 MVP를 구현합니다.

목표: AI 인프라 버킷 강도가 실제 비즈니스 매출 증거로 확인되는지 검증하는 레이어.

---

## E-3 Design Relationship

E-3 설계 문서: `AI_INFRA_HUB_E3_EARNINGS_CONFIRMATION_DESIGN.md`

E-3 → E-4 구현된 항목:
- EarningsConfirmationLevel / EarningsEvidenceType 타입 계약 ✅
- 결정론적 스코어링 공식 ✅
- Revenue-class gate (MANAGEMENT_COMMENTARY alone → max WATCH) ✅
- Bucket aggregation + coverage penalty ✅
- INDIRECT-only bucket cap ✅
- Validation helper ✅
- API integration ✅
- EARNINGS tab UI ✅

---

## Manual Data Strategy

**파일**: `marketflow/frontend/src/data/aiInfraEarningsEvidence.json`

- 수동 작성, JSON 포맷
- TypeScript 타입과 분리 — 타입은 `aiInfraEarningsConfirmation.ts`에 정의
- 편집 친화적: JSON 직접 편집으로 데이터 갱신 가능
- `source_type: "MANUAL"` 명시

---

## Data Model Implemented

### Types (`aiInfraEarningsConfirmation.ts`)

```typescript
EarningsConfirmationLevel: CONFIRMED | PARTIAL | WATCH | NOT_CONFIRMED | DATA_LIMITED | UNKNOWN
EarningsEvidenceType:      AI_REVENUE | BACKLOG | GUIDANCE | MARGIN | MANAGEMENT_COMMENTARY
                           ORDER_GROWTH | SEGMENT_GROWTH | CUSTOMER_DEMAND
                           CAPEX_EXPOSURE | COMMERCIALIZATION_PROGRESS
AIInfraEarningsEvidence:   14개 필드 (symbol, primary_bucket, evidence_types, 상태 필드들, notes, source)
AIInfraBucketEarningsConfirmation: 버킷 집계 결과 (score, level, coverage, evidence summary)
```

---

## Seed Coverage

| 심볼 | 버킷 | Level | Score |
|------|------|-------|-------|
| NVDA | AI_CHIP | CONFIRMED | 100 |
| AVGO | AI_CHIP | CONFIRMED | 90 |
| AMD  | AI_CHIP | PARTIAL | 65 |
| MU   | HBM_MEMORY | PARTIAL | 65 |
| TSM  | PACKAGING | CONFIRMED | 90 |
| KLAC | PACKAGING | PARTIAL | 65 |
| AMAT | PACKAGING | PARTIAL | 60 |
| LRCX | PACKAGING | WATCH | 50 |
| VRT  | COOLING | CONFIRMED | 100 |
| ETN  | COOLING | PARTIAL | 65 |
| PWR  | POWER_INFRA | PARTIAL | 70 |
| GLW  | GLASS_SUBSTRATE | DATA_LIMITED | 0 |
| ANET | OPTICAL_NETWORK | CONFIRMED | 100 |
| SMCI | DATA_CENTER_INFRA | WATCH | 40 |

총 14개 심볼 / 8개 버킷 커버 / 5개 버킷 DATA_LIMITED (coverage 없음)

**신규 추가 심볼** (aiInfraCompanyPurity.ts에도 추가):
- LRCX: PACKAGING — etch/deposition 장비, 어드밴스드 패키징 수혜
- SMCI: DATA_CENTER_INFRA — AI 서버 통합 (E-3 amendment: SMCI = DATA_CENTER_INFRA)

**제외 (deferred)**:
- ASML: US ADR이나 현재 company purity 맵 미포함 — E-5에서 추가
- APH (Amphenol): 커넥터 전문, 버킷 분류 재검토 필요 — E-5 deferred

---

## Scoring Rules

```
Base evidence points:
  AI_REVENUE present:              +25
  BACKLOG/ORDER_GROWTH (STRONG):   +20 / (IMPROVING): +10
  GUIDANCE (RAISED):               +20 / (POSITIVE): +15
    (CAUTIOUS/LOWERED):            -20
  SEGMENT_GROWTH present:          +15
  MARGIN (EXPANDING):              +10 / (STABLE): +5
  MANAGEMENT_COMMENTARY present:   +10

Risk deductions:
  ai_revenue_visibility INDIRECT:  -15
  ai_revenue_visibility NOT_DISC:  -10
  margin_quality PRESSURED:        -10
  commercialization PRE_COMMERCIAL/STORY_ONLY: -25
  commercialization PILOT_OR_DESIGN_WIN:       -10

Clamp: 0 ≤ score ≤ 100
```

**Revenue-class gate** (Section 7 amendment):
- `MANAGEMENT_COMMENTARY` alone cannot push above WATCH (59)
- Revenue-class evidence 필요: AI_REVENUE | BACKLOG | SEGMENT_GROWTH | ORDER_GROWTH

---

## Bucket Aggregation

```
coverage_ratio = covered_symbols / universe_symbols (from AI_INFRA_COMPANY_PURITY)

Coverage penalty:
  ≥ 75%: -0
  50–74%: -10
  25–49%: -20
  < 25%: -30

adjusted_score = avg_company_score - coverage_penalty
```

**INDIRECT-only cap** (Section 9 amendment):
- 버킷 내 모든 커버 심볼이 `ai_revenue_visibility === 'INDIRECT'`이면 → 버킷 score max 59 (WATCH)

### 버킷별 집계 결과 (예상)

| 버킷 | Covered | Coverage | Level |
|------|---------|----------|-------|
| AI_CHIP | 3/4 | 75% | CONFIRMED |
| HBM_MEMORY | 1/1 | 100% | PARTIAL |
| PACKAGING | 4/5 | 80% | PARTIAL |
| COOLING | 2/5 | 40% | PARTIAL |
| POWER_INFRA | 1/3 | 33% | WATCH |
| GLASS_SUBSTRATE | 1/1 | 100% | DATA_LIMITED |
| OPTICAL_NETWORK | 1/4 | 25% | PARTIAL |
| DATA_CENTER_INFRA | 1/4 | 25% | DATA_LIMITED |
| TEST_EQUIPMENT | 0/4 | 0% | DATA_LIMITED |
| PCB_SUBSTRATE | 0/4 | 0% | DATA_LIMITED |
| CLEANROOM_WATER | 0/3 | 0% | DATA_LIMITED |
| SPECIALTY_GAS | 0/3 | 0% | DATA_LIMITED |
| RAW_MATERIAL | 0/4 | 0% | DATA_LIMITED |

---

## API Integration

**엔드포인트**: `GET /api/ai-infra/theme-momentum`

**추가 필드** (`earnings_confirmation`):
```json
{
  "earnings_confirmation": {
    "buckets": [...AIInfraBucketEarningsConfirmation],
    "companies": [...AIInfraEarningsEvidence],
    "summary": {
      "confirmed_buckets": 1,
      "partial_buckets": 4,
      "watch_buckets": 1,
      "not_confirmed_buckets": 0,
      "data_limited_buckets": 7,
      "coverage_ratio": 0.31,
      "as_of": "2025-Q4"
    }
  }
}
```

기존 필드 모두 보존 (backward compatible).

---

## UI Integration

**컴포넌트**: `EarningsConfirmationPanel.tsx`

**탭 순서** (AIInfrastructureRadar.tsx):
```
VALUE CHAIN → HEATMAP → EARNINGS → STATE LABELS → RELATIVE STRENGTH → RRG
```

**Section A** — Summary Strip: Confirmed/Partial/Watch/Data Limited 버킷 수 + Coverage + As-of

**Section B** — Bucket Confirmation Table: Bucket / Level / Score / Coverage% / Evidence / Caution

**Section C** — Company Evidence Table: 상위 14개 심볼 (score 기준 정렬)

**Section D** — Evidence Gaps: DATA_LIMITED + WATCH 버킷 caution 표시

**Bridge integration (E-4 제외)**: EARNINGS 탭 전용. Bridge compact summary 수정 없음.

---

## Missing Data Behavior

| 상황 | 표시 |
|------|------|
| no evidence for symbol | DATA_LIMITED |
| missing bucket evidence | DATA_LIMITED (covered=0) |
| score missing | — |
| notes empty | 숨김 |
| as_of missing | 'Unknown' |
| earningsConfirmation null | "Earnings confirmation data unavailable." |

undefined / null / NaN 화면 노출 없음.

---

## Validation

`validateEarningsEvidenceRecord(record)` 구현 완료:
- symbol 존재 확인
- primary_bucket 존재 확인
- score 0-100 범위 확인
- evidence_types 배열 확인
- notes 배열 확인
- source 존재 확인
- **Section 7 amendment violation 검사**: MANAGEMENT_COMMENTARY-only + PARTIAL/CONFIRMED → E-4B QA blocker로 기록

`validateAllSeedRecords()`: 전체 시드 일괄 검사 함수 제공.

현재 시드 데이터 violation 없음 ✅ (GLW는 score 0 → DATA_LIMITED, 위반 아님)

---

## Limitations

1. **Browser rendering not verified**: 정적 코드 분석만. 브라우저 QA 별도 필요.
2. **Manual seed only**: LLM 추출/SEC 파싱 없음. 분기별 수동 갱신 필요.
3. **5개 버킷 미커버**: TEST_EQUIPMENT, PCB_SUBSTRATE, CLEANROOM_WATER, SPECIALTY_GAS, RAW_MATERIAL — 모두 DATA_LIMITED.
4. **OPTICAL_NETWORK 단일 심볼 (ANET)**: 25% coverage → -30 penalty로 강등.
5. **DATA_CENTER_INFRA (SMCI 단독)**: 25% coverage → DATA_LIMITED. EQIX/DLR/IRM 추가 필요.
6. **HBM_MEMORY proxy 한계**: MU만 US 상장 — SK Hynix/Samsung 미포함.

---

## Deferred Automation

- E-5: 분기별 수동 데이터 갱신 + ASML/APH 추가
- E-6: LLM 기반 transcript 추출 (earnings call)
- E-7: SEC 8-K/10-Q 파싱 자동화

---

## Next Step

**READY_FOR_E4B_QA**

E-4B QA 체크리스트:
- [ ] 브라우저에서 EARNINGS 탭 렌더 확인
- [ ] Bucket Confirmation Table 14개 렌더 확인
- [ ] Company Evidence Table 정렬 확인
- [ ] Evidence Gaps 섹션 확인
- [ ] Missing data fallback 확인
- [ ] 기존 탭 (VALUE CHAIN, HEATMAP 등) 회귀 없음
- [ ] `validateAllSeedRecords()` 결과 위반 없음 확인
- [ ] Forbidden language 없음 확인
