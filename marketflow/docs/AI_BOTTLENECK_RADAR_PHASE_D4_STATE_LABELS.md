# AI Bottleneck Radar Phase D-4 — State Labels

작성일: 2026-05-08

---

## Purpose

D-2 (Bucket RS)와 D-3 (Bucket RRG) 출력을 결합하여 13개 AI 인프라 버킷 각각에 사용자가 해석 가능한 상태 레이블을 부여한다.

수량 데이터(RS pp, 수익률 %, RRG 사분면)를 다음으로 변환한다.

```
RS +7.2pp / RRG Leading / 3M +31% → LEADING (High confidence)
Coverage 42% / RS null             → DATA_INSUFFICIENT
3M +38% / RS +6pp / RRG Leading    → CROWDED (Overheat risk)
RRG Weakening / 1M -3% / 3M +12%  → DISTRIBUTION
```

이 엔진은 결정론적이다. LLM, 실적 확인, 외부 API를 사용하지 않는다. 투자 권고가 아니다.

---

## Input Sources

| 소스 | Phase | 필드 |
|---|---|---|
| `AIInfraBucketMomentum` | D-2 | returns, relative_strength, coverage, stage |
| `RrgSeries` | D-3 | quadrant, source, points |
| Bucket metadata | D-1 | bucket_id, display_name, benchmark |

D-3 RRG 캐시가 없어도 동작 — RRG 없는 경우 사분면 정보를 null로 처리하고 규칙을 적용한다.

---

## State Labels

| Label | Display | 의미 |
|---|---|---|
| `LEADING` | Leading | 현재 AI 인프라 로테이션에서 가장 강한 구간 중 하나 |
| `EMERGING` | Emerging | RS가 개선 중이며 Leading으로 전환 가능성 있음 |
| `CONFIRMING` | Confirming | RS/수익률 양수이지만 Leading 기준에는 미달 |
| `CROWDED` | Crowded | 성과 강하지만 과열 가능성 — 모멘텀이 크게 확장됨 |
| `DISTRIBUTION` | Distribution | RRG가 Weakening 진입, 이전 강세에서 약화 중 |
| `LAGGING` | Lagging | RS 약세, 현재 로테이션에 미참여 |
| `STORY_ONLY` | Story Only | 테마는 유효하나 가격 확인 제한적 — 데이터 불충분 |
| `DATA_INSUFFICIENT` | Data Insufficient | 분류 불가 — 유효 데이터 없음 |

---

## Rule Priority

규칙은 아래 순서로 우선 적용된다. 상위 규칙이 매칭되면 하위 규칙은 평가하지 않는다.

```
1. DATA_INSUFFICIENT  — coverage < 50% 또는 RS 없음
2. STORY_ONLY         — PARTIAL 데이터, coverage < 75%, RS 미확인
3. CROWDED            — 수익률 과열 (3M ≥ 35% 또는 6M ≥ 60%), RS 강함
4. DISTRIBUTION       — RRG Weakening, 이전 수익률 양수, 1M 마이너스
5. LEADING            — RRG Leading, RS 3M ≥ +5pp, 3M 수익률 양수
6. EMERGING           — RRG Improving, RS 개선 중, 수익률 플러스
7. CONFIRMING         — RS 3M > 0pp, 3M 수익률 양수 (RRG 무관)
8. LAGGING            — RS 3M ≤ -5pp 또는 RRG Lagging (기본값)
```

---

## Thresholds

파일: `lib/ai-infra/aiInfraStateLabels.ts` 상단에 집중 관리

```typescript
const LOW_COVERAGE_THRESHOLD     = 0.50   // DATA_INSUFFICIENT 기준
const PARTIAL_COVERAGE_THRESHOLD = 0.75   // STORY_ONLY 기준

const STRONG_RS_3M   = 5     // pp — LEADING/CROWDED 요건
const POSITIVE_RS_3M = 0     // pp — CONFIRMING/EMERGING 요건
const WEAK_RS_3M     = -5    // pp — LAGGING 명시 기준

const STRETCHED_RETURN_3M = 35  // % — CROWDED 3M 기준
const STRETCHED_RETURN_6M = 60  // % — CROWDED 6M 기준
```

단위: RS는 percentage points (pp), 수익률은 % (백분율).

---

## State Score (0–100)

State Score는 내부 정렬 키다. BTI가 아니다. 최종 투자 점수가 아니다.

UI 표시명: `Rotation Strength` 또는 `State Score`.

```
RS 3M    : 35점 기여 (0pp = 35, 양수 증가, 음수 감소, floor 0)
Return 3M: 25점 기여 (0% = 12.5, ±0.5 per %)
RRG 사분면 : 25점 (Leading=25, Improving=18, Weakening=8, Lagging=0, 없음=12)
Coverage : 15점 (coverage_ratio × 15)
과열 패널티 : -20점 (CROWDED 조건 충족 시)
```

범위: 0–100. 높을수록 로테이션 강도 강함.

---

## Confidence Logic

| 조건 | Confidence |
|---|---|
| coverage ≥ 80%, RS 있음, RRG 있음, data_quality = REAL | HIGH |
| coverage ≥ 50%, RS 있음 | MEDIUM |
| 나머지 | LOW |

---

## Risk Flags

| Flag | 의미 |
|---|---|
| `OVERHEAT_RISK` | 수익률 과열 임계값 초과 |
| `LOW_COVERAGE` | coverage_ratio < 75% |
| `PARTIAL_DATA` | data_quality = PARTIAL |
| `RRG_WEAKENING` | RRG 사분면 = Weakening 또는 Lagging |
| `RS_UNDERPERFORMANCE` | RS vs SOXX 3M ≤ -5pp |
| `MOMENTUM_STRETCH` | 3M 수익률 과도한 확장 |
| `COMMERCIALIZATION_UNCERTAINTY` | 상업화 초기 단계 (수동 지정 가능) |
| `BENCHMARK_MISSING` | RS 계산에 필요한 벤치마크 데이터 없음 |

---

## API Contract

**Endpoint:** `GET /api/ai-infra/theme-momentum`

D-4 신규 필드 `bucket_states` 추가 (기존 필드 변경 없음):

```json
{
  "themes": [...],
  "buckets": [...],
  "benchmarks": {...},
  "bucket_states": [
    {
      "bucket_id": "AI_CHIP",
      "display_name": "AI Chip",
      "stage": "STAGE_1_AI_CHIP",
      "state_label": "LEADING",
      "state_score": 74,
      "confidence": "HIGH",
      "state_reason": "AI Chip is classified as Leading because its 3M relative strength vs SOXX is positive (+6.2pp) and its RRG position is in the Leading quadrant.",
      "state_drivers": ["RS vs SOXX 3M +6.2pp", "RRG quadrant = Leading", "3M return +24.5%"],
      "risk_flags": [],
      "source": {
        "has_rs": true,
        "has_rrg": true,
        "benchmark": "SOXX",
        "coverage_ratio": 1.0,
        "data_quality": "REAL"
      }
    },
    ...
  ],
  "generated_at": "2026-05-08T...",
  "data_notes": [
    "...",
    "State labels are rule-based and price/RRG-driven. They do not include earnings confirmation or investment recommendations."
  ]
}
```

**기존 `/api/ai-infra/theme-momentum` 영향:** 없음 (additive only).

---

## Component Prepared

**파일:** `components/ai-infra/BucketStateLabelPanel.tsx`

- Self-fetch `/api/ai-infra/theme-momentum`
- 테이블: Bucket | State | Score | Confidence | Reason | Risk Flags
- 정렬: SCORE / LABEL / STAGE 전환
- 상단 Summary chips (레이블별 버킷 수)
- Risk flags: 작은 chip으로 표시
- 투자 언어 없음

현재 통합 상태: 컴포넌트 준비 완료, `AIInfrastructureRadarPlaceholder` 교체는 D-5에서.

---

## Limitations

1. Rule-based — 실적, 수주, AI revenue %, 기업 펀더멘털 미반영.
2. Equal-weight 버킷 평균 기반 — NVDA와 소형주 동일 비중.
3. `direction` 필드는 D-3에서 모두 'Pending' — EMERGING/DISTRIBUTION 분류 시 RRG 방향성 정밀도 제한.
4. CROWDED 기준(35%/60%)은 현재 시장 환경 기준 — 강세장에서는 과도하게 CROWDED를 발생시킬 수 있음.
5. STORY_ONLY는 데이터 품질 기반 분류 — 실제 상업화 단계 판단 불포함.

---

## Deferred Items (Phase D-4에서 제외)

| Item | 이유 |
|---|---|
| BTI 독립 점수 | Engine Score와 중복 — 영구 보류 |
| Earnings Confirmation | LLM 필요 — Phase E |
| Theme Purity Score | 자동화 미완성 — Phase E |
| MOU vs real revenue 분류 | 수동 데이터 필요 |
| direction 기반 EMERGING 정밀화 | D-3 direction = Pending 해소 후 |
| AIInfrastructureRadarPlaceholder 교체 | D-5 |
| 독립 사이드바 라우트 | 영구 제외 |

---

## Next: Phase D-5 — Full Radar Integration

D-5 대상:
1. `AIInfrastructureRadarPlaceholder` → 실제 Radar 컴포넌트 교체
2. `BucketRelativeStrengthPanel`, `BucketRRGPanel`, `BucketStateLabelPanel` 통합 레이아웃
3. Stage grouping 뷰 옵션
4. Radar 탭 최종 UI 확정

D-5 시작 조건: D-4 merge 완료 후.
