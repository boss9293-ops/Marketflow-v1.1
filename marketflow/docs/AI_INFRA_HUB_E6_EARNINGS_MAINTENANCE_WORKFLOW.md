# AI Infra Hub E-6 Earnings Maintenance Workflow

> Date: 2026-05-12
> Type: Maintenance Workflow
> Status: ACTIVE

---

## Purpose

AI Infra Earnings Confirmation 레이어는 수동 데이터를 기반으로 합니다.
시간이 지나면 데이터는 반드시 낡습니다. E-6은 이 레이어를 분기별로 유지 관리할 수 있는 워크플로를 정의합니다.

핵심 질문: **누가 / 언제 / 무엇을 / 어떤 기준으로 업데이트할 것인가?**

---

## Current Earnings Dataset State

| 항목 | 값 |
|------|-----|
| Dataset version | E5 |
| As of | 2026-Q1 |
| Last updated | 2026-05-12 |
| Update mode | MANUAL |
| Seed symbols | 21 |
| Covered buckets | 9/13 |
| DATA_LIMITED buckets | 4 (GLASS_SUBSTRATE, PCB_SUBSTRATE, CLEANROOM_WATER, RAW_MATERIAL) |

현재 파일 위치:
- Seed data: `src/lib/ai-infra/aiInfraEarningsEvidenceSeed.ts`
- Types + scoring + aggregation: `src/lib/ai-infra/aiInfraEarningsConfirmation.ts`
- Company purity: `src/lib/ai-infra/aiInfraCompanyPurity.ts`
- UI panel: `src/components/ai-infra/EarningsConfirmationPanel.tsx`

---

## Quarterly Update Workflow

분기 결산 후 (일반적으로 분기 말 +3~6주) 아래 절차를 따릅니다.

### Step 1 — 대상 심볼 목록 확인
`AI_INFRA_COMPANY_PURITY`에서 primary_bucket 심볼 목록을 확인합니다.
현재 seed에 없는 심볼은 DATA_LIMITED 상태입니다.

### Step 2 — 기존 시드 레코드 검토
`aiInfraEarningsEvidenceSeed.ts`에서 각 심볼의 `source.quarter`와 `source.as_of`를 확인합니다.
2분기 이상 오래된 레코드는 RECENT 또는 STALE로 분류됩니다.

### Step 3 — 최신 earnings 정보 수동 확인
각 심볼에 대해 아래 소스를 확인합니다:
- 공식 earnings release (SEC 8-K / press release)
- 실적 발표 투자자 프레젠테이션
- 분기 earnings call 핵심 발언 요약
- 10-Q 또는 10-K 관련 세그먼트 공시

### Step 4 — 필드 업데이트
변화가 있는 경우에만 업데이트합니다:
- `evidence_types`
- `ai_revenue_visibility`
- `revenue_trend`
- `guidance_tone`
- `backlog_or_orders`
- `margin_quality`
- `commercialization_status`
- `evidence_notes` (비즈니스 매출 근거, 단문 서술)
- `caution_notes` (희석 요소, 불확실성 서술)
- `source.quarter`, `source.as_of`

### Step 5 — 신규 심볼 추가 (필요 시)
DATA_LIMITED 버킷에서 명확한 후보가 있고, 증거가 충분한 경우에만 추가합니다.
증거가 약하면 DATA_LIMITED 유지가 더 정직한 표현입니다.

### Step 6 — Validation helper 실행
```typescript
import { validateAllSeedRecords } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
const violations = validateAllSeedRecords()
// violations.length === 0 이어야 함
```

### Step 7 — Bucket aggregation 변화 확인
`computeAllBucketEarningsConfirmation()`을 실행하거나 EARNINGS 탭을 통해 확인합니다.
레벨 경계 전환이 있는 경우 → **Step 12** 필수.

### Step 8 — 과잉 확인 검사
- GLW / story-heavy → DATA_LIMITED 유지 확인
- RAW_MATERIAL / INDIRECT-only → DATA_LIMITED 또는 WATCH 이하 확인
- one-name PARTIAL/INDIRECT bucket → WATCH cap 적용 확인

### Step 9 — EARNINGS 탭 렌더링 확인
- Summary Strip: 버킷 수 및 Coverage 업데이트 확인
- Bucket Confirmation Table: 13개 버킷 렌더 확인
- Company Evidence Table: 신규 심볼 포함 확인
- Evidence Gaps: DATA_LIMITED + WATCH 버킷 표시 확인

### Step 10 — Product language 검사
forbidden language 없음 확인 (매수/매도/추천/buy/sell/predicts 등)

### Step 11 — TypeScript build 통과
```
npm run build  또는  tsc --noEmit --skipLibCheck
```

### Step 12 — Bucket aggregation 레벨 전환 문서화 ← MANDATORY
**버킷 레벨이 경계를 넘어 전환된 경우 반드시 change log에 기록해야 합니다.**

대상 전환:
- WATCH → PARTIAL
- PARTIAL → CONFIRMED
- CONFIRMED → WATCH 또는 PARTIAL
- DATA_LIMITED → 어떤 레벨
- 어떤 레벨 → DATA_LIMITED

기록 형식: `AI_INFRA_EARNINGS_CHANGELOG` 배열에 항목 추가 (아래 Change Log 형식 참조).

**문서화되지 않은 레벨 전환은 merge 차단 조건입니다.**

### Step 13 — Dataset metadata 버전 업데이트
`AI_INFRA_EARNINGS_EVIDENCE_META`의 `dataset_version`, `as_of`, `last_updated`, `seed_count`를 업데이트합니다.

### Step 14 — Commit
```
feat: E-N Quarterly Update — {as_of} seed refresh
```
또는
```
fix: E-N seed correction — {symbol} {field} 수정
```

---

## Evidence Review Checklist (심볼별)

각 심볼을 검토할 때 아래 항목을 확인합니다:

```
[ ] AI 관련 매출 가시성 변화 여부 (ai_revenue_visibility)
[ ] 가이던스 상향/하향/중립 여부 (guidance_tone)
[ ] 수주 잔고 / 주문 변화 (backlog_or_orders)
[ ] 마진 압박 / 확대 여부 (margin_quality)
[ ] 상업화 단계 변화 (commercialization_status)
[ ] evidence_notes가 비즈니스 매출 근거를 서술하는가
[ ] caution_notes가 희석 요소 / 불확실성을 명시하는가
[ ] source.quarter, source.as_of 업데이트 여부
[ ] 금지 언어 없음 (buy/sell/추천/매수/매도 등)
```

---

## Seed Record Required Fields

모든 seed 레코드는 아래 필드를 포함해야 합니다:

```typescript
{
  symbol: string                       // 필수
  company_name?: string                // 선택 (표시용)
  primary_bucket: AIInfraBucketId      // 필수
  secondary_buckets?: AIInfraBucketId[] // 선택

  evidence_types: EarningsEvidenceType[]  // 필수, 비어있으면 DATA_LIMITED
  ai_revenue_visibility: ...           // 필수
  revenue_trend: ...                   // 필수
  guidance_tone: ...                   // 필수
  backlog_or_orders: ...               // 필수
  margin_quality: ...                  // 필수
  commercialization_status: ...        // 필수

  evidence_notes: string[]             // 필수 (비어있어도 됨)
  caution_notes:  string[]             // 필수 (비어있어도 됨)

  source: {
    quarter?: string                   // e.g. "Q3 2024"
    source_type: 'MANUAL' | ...        // 필수
    as_of?: string                     // 'YYYY-QN' 형식 권장 (freshness 계산 기준)
  }
}
```

---

## Conservative Classification Rules

### R1 — AI Revenue Visibility

| 값 | 사용 조건 |
|----|-----------|
| VISIBLE | AI 관련 매출 세그먼트가 명확히 공개됨 |
| PARTIAL | 데이터센터/AI 인프라 기여 가시적이나 AI 전용 미분리 |
| INDIRECT | AI 수요 서사 있으나 직접 AI 매출 없음 |
| NOT_DISCLOSED | 공시 없음 |
| UNKNOWN | 정보 불충분 |

### R2 — Commercialization Status

| 값 | 사용 조건 |
|----|-----------|
| REVENUE_VISIBLE | 실제 매출 가시적 |
| EARLY_REVENUE | 초기 상업화, 규모 불명확 |
| PILOT_OR_DESIGN_WIN | 설계 승인 또는 파일럿 단계 |
| PRE_COMMERCIAL | 상업화 미시작 |
| STORY_ONLY | 서사만 존재, 매출 근거 없음 |

### R3 — Story-Heavy 보호

아래는 CONFIRMED 불가:
- GLASS_SUBSTRATE / GLW
- PRE_COMMERCIAL 심볼
- 매출 증거 없는 테마주

### R4 — Indirect Exposure 보호

INDIRECT-only 버킷은 CONFIRMED 불가.
RAW_MATERIAL, 전력/유틸리티/원자재 proxy는 최대 WATCH.

### R5 — One-Name Bucket Cap

단독 심볼 버킷에서 ai_revenue_visibility가 INDIRECT 또는 PARTIAL이면:
→ 버킷 score 최대 59 (WATCH)

---

## Freshness / Staleness Rules

**기준일: `dataset_meta.as_of` — 시스템 현재 날짜가 아님**

이유: 시스템 날짜는 매일 바뀌지만 데이터셋은 분기별로만 갱신됩니다.  
Freshness는 데이터셋 버전의 나이를 반영해야 하며, 마지막 페이지 로드 시간이 아닙니다.

| 레이블 | 조건 (quarters behind referenceDate) |
|--------|---------------------------------------|
| CURRENT | diff ≤ 1 (당분기 또는 직전 분기) |
| RECENT | diff 2–3 (2–3분기 전) |
| STALE | diff ≥ 4 (4분기 이상 경과) |
| UNKNOWN | as_of 없음 또는 파싱 불가 |

**구현:**
```typescript
// src/lib/ai-infra/aiInfraEarningsConfirmation.ts
export function getDatasetFreshness(asOf: string, referenceDate: string): EarningsEvidenceFreshness
export function getEarningsEvidenceFreshness(record: AIInfraEarningsEvidence, referenceDate: string): EarningsEvidenceFreshness

// referenceDate = AI_INFRA_EARNINGS_EVIDENCE_META.as_of (항상 이 값 사용)
// referenceDate = new Date().toISOString() 금지
```

**UI 표시:** EARNINGS 탭 Summary Strip 하단에 표시됨
```
Manual Dataset · E5 · 21 symbols | Freshness: CURRENT | Business evidence only — not investment advice
```

---

## Change Log Format

`AI_INFRA_EARNINGS_CHANGELOG` 배열 (`aiInfraEarningsEvidenceSeed.ts`에 위치):

### 필수 기록 조건:
- 특정 심볼의 `confirmation_level` 변경
- 특정 버킷의 `confirmation_level` 변경
- 신규 심볼 추가
- 심볼 제거

### 선택 기록 조건:
- `evidence_notes` / `caution_notes` 문구 정리
- `source.as_of` 날짜 갱신 (레벨 변화 없음)

### 형식:
```typescript
{
  date: 'YYYY-MM-DD',        // 필수
  version: 'EN',             // 필수 (e.g. 'E5')
  symbol?: string,           // 심볼 레벨 변경 시
  bucket?: string,           // 버킷 레벨 변경 시
  change: string,            // 무엇이 바뀌었는가
  level_transition?: string, // e.g. 'DATA_LIMITED → WATCH' — 레벨 전환 시 필수
  reason: string,            // 왜 바뀌었는가
}
```

**문서화되지 않은 레벨 전환은 merge 차단 조건 (Step 12).**

---

## Pre-Merge QA Checklist

분기 업데이트 전 아래 체크리스트를 통과해야 합니다:

```
[ ] Seed validation passes (validateAllSeedRecords() = [])
[ ] 중복 심볼 없음
[ ] Invalid bucket_id 없음
[ ] Missing source metadata 없음
[ ] GLW / story-heavy → DATA_LIMITED 유지
[ ] RAW_MATERIAL / INDIRECT-only → DATA_LIMITED 또는 WATCH 이하
[ ] one-name PARTIAL/INDIRECT bucket → WATCH cap 유지
[ ] revenue-class gate 유지 (MGMT_ONLY → PARTIAL/CONFIRMED 불가)
[ ] minimum evidence floor rule 작동 확인 (E-5B)
[ ] Evidence gaps 표시 확인 (DATA_LIMITED + WATCH 버킷)
[ ] 금지 언어 없음 (buy/sell/추천/매수/매도/predicts 등)
[ ] EARNINGS 탭 렌더링 정상
[ ] TypeScript exit 0
[ ] 레벨 전환 있으면 CHANGELOG 항목 추가
[ ] AI_INFRA_EARNINGS_EVIDENCE_META 업데이트 (version, as_of, last_updated, seed_count)
```

---

## Update Guardrails

### G1 — Story-Heavy Guardrail
매출 증거 없는 테마 (GLW, PRE_COMMERCIAL, STORY_ONLY)는 CONFIRMED 불가.

### G2 — Indirect Exposure Guardrail
INDIRECT-only exposure (RAW_MATERIAL, 유틸리티, 원자재 proxy)는 강한 CONFIRMED 불가.

### G3 — One-Name Bucket Guardrail
단독 심볼 버킷의 INDIRECT/PARTIAL exposure는 WATCH cap 필수.
예외: ai_revenue_visibility = VISIBLE이고 직접적·구조적 대표성 명확할 때.

### G4 — Revenue-Class Gate
MANAGEMENT_COMMENTARY 단독으로는 PARTIAL 또는 CONFIRMED 불가.
Revenue-class evidence 필요: AI_REVENUE, SEGMENT_GROWTH, ORDER_GROWTH, BACKLOG.

### G5 — Aggregation Dilution Guardrail (E-5B)
새로운 약한 심볼 추가로 기존 강한 버킷이 붕괴되어서는 안 됨.
`floor = max(0, maxCompanyScore - 30)` 규칙이 코드에 이미 구현됨.
CONFIRMED → WATCH 전환이 증거 품질 변화가 아닌 universe 확장만으로 발생 시 → aggregation artifact 검토.

---

## Deferred Automation

| 단계 | 내용 |
|------|------|
| E-7 | LLM 기반 earnings call transcript 핵심 발언 추출 |
| E-8 | SEC 8-K/10-Q 파싱 자동화 |
| E-9 | 분기 자동 freshness 알림 (STALE 심볼 목록 생성) |

---

## Next Step

**READY_FOR_E6B_MAINTENANCE_QA**

또는, earnings 커버리지가 안정적이라 판단될 경우:  
**READY_FOR_THEME_MAP_DESIGN** — AI 인프라 허브의 시각적 섹터/테마 흐름 설계로 전환.
