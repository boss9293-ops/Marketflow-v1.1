# AI Bottleneck Radar Phase D-5 — UI Integration

작성일: 2026-05-08

---

## Purpose

`AIInfrastructureRadarPlaceholder`를 D-1~D-4에서 구축한 실제 AI Bottleneck Radar 컴포넌트로 교체한다.

기존 placeholder는 manual context + 5개 테마 navigator 기반의 Beta UI였다. D-5 이후에는 13개 AI 인프라 버킷 기반의 가격/RRG 데이터 구동 Radar로 대체된다.

---

## What Was Replaced

| Before | After |
|---|---|
| `AIInfrastructureRadarPlaceholder` | `AIInfrastructureRadar` |
| 5개 수동 테마 navigator | 13개 버킷 상태 레이블 테이블 |
| manual news / CAPEX notes | 가격 기반 RS + RRG + 상태 엔진 |
| Beta 표시 | D-4 Rule-based engine |

교체 위치: `SemiconductorIntelligenceShell.tsx` — `activeTab === 'radar'` 분기

---

## Component Structure

```
SemiconductorIntelligenceShell (기존 shell — 수정 없음)
└── AIInfrastructureRadar          ← D-5 신규 메인 컴포넌트
    ├── fetch /api/ai-infra/theme-momentum
    ├── SummaryStrip                ← top signals: Leading / Emerging / Crowded / Coverage
    ├── TabBar                      ← STATE LABELS | RELATIVE STRENGTH | RRG
    ├── StateLabelsTable            ← bucket_states (D-4)
    ├── RSTable                     ← buckets + benchmarks (D-2)
    └── BucketRRGPanel              ← self-fetch /api/ai-infra/bucket-rrg (D-3)
```

---

## API Dependency

**Primary:** `GET /api/ai-infra/theme-momentum`

소비 필드:
- `bucket_states` → D-4 상태 레이블 (optional — fallback 있음)
- `buckets` → D-2 상대강도 데이터 (optional — fallback 있음)
- `benchmarks` → SOXX / QQQ / SPY 벤치마크 수익률
- `asOf` → 데이터 기준일
- `data_notes` → 데이터 품질 노트

**Secondary:** `GET /api/ai-infra/bucket-rrg` (BucketRRGPanel 자체 fetch)

---

## Displayed Sections

### 1. Header
- "AI BOTTLENECK RADAR" 태그라인
- D-4 / SOXX BENCHMARK 배지

### 2. Summary Strip
- Leading: 최상위 LEADING 버킷
- Emerging: 최상위 EMERGING 버킷
- Crowded: 최상위 CROWDED 버킷
- Distribution: 최상위 DISTRIBUTION 버킷
- Coverage: 유효 버킷 수 / 전체
- Benchmark: SOXX
- asOf 날짜

### 3. Tabs
- **STATE LABELS**: 13개 버킷 상태 레이블 테이블 (Bucket | State | Score | Confidence | Reason)
- **RELATIVE STRENGTH**: 1M / 3M / 6M 수익률 + RS vs SOXX / QQQ / SPY 테이블
- **RRG**: BucketRRGPanel (Candidate-D 기반 RRG 산포도 + 경로)

### 4. Disclaimer
Rule-based / 투자 권고 아님 고지.

---

## Data Quality Behavior

| 조건 | 처리 |
|---|---|
| `bucket_states` 없음 | STATE LABELS 탭 — "데이터 미사용" 안내 |
| `buckets` 없음 | RS 탭 — 폴백 안내 |
| RRG 캐시 없음 | BucketRRGPanel 자체 처리 (PENDING 상태 표시) |
| API 오류 | 에러 메시지 표시, shell crash 없음 |

---

## Limitations

1. Summary strip은 `bucket_states` 의존 — D-4 엔진 출력 없으면 모두 '—'.
2. RRG 탭은 Python 스크립트(`build_bottleneck_rrg.py`) 실행 후 캐시가 있어야 정상 표시.
3. RS 테이블은 equal-weight 기준 — 시가총액 가중치 아님.
4. 투자 권고 언어 없음 — 로테이션 관찰 도구로만 사용.

---

## Deferred Items (Phase D-5에서 제외)

| Item | 이유 |
|---|---|
| Benchmark selector UI (SOXX/QQQ/SPY) | D-6에서 추가 |
| Stage grouping 뷰 옵션 | D-6 |
| RRG lookback selector (4W/8W/12W) | D-6 |
| BTI / Earnings Confirmation | 영구 보류 / Phase E |
| 새 사이드바 라우트 | 계획 없음 |
| 독립 대시보드 | 계획 없음 |
| Export 기능 | 계획 없음 |

---

## Next Phase D-6

- Benchmark selector (SOXX / QQQ / SPY) — 패널별 또는 전체 전환
- Stage grouping toggle (Stage 1 → Stage 5 view)
- RRG lookback 선택 (4W / 8W / 12W)
- State score 컬럼 인터랙션 (tooltip)
- `direction` 필드 계산 후 EMERGING/DISTRIBUTION 분류 정밀화
