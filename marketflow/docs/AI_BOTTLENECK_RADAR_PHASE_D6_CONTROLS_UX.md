# AI Bottleneck Radar Phase D-6 — Controls & UX

작성일: 2026-05-08

---

## Purpose

D-5 UI에 경량 컨트롤과 UX 개선을 추가한다. 기능 범위는 변경하지 않는다.

---

## Controls Added

### 1. Benchmark Selector (SOXX / QQQ / SPY)

- 위치: Controls Bar (컴포넌트 상단)
- 기본값: SOXX
- 동작:
  - RS 테이블의 선택 벤치마크 열 강조 (컬럼 헤더 하이라이트)
  - 선택된 RS 벤치마크 기준 Summary Strip 업데이트
  - Data Quality Badges의 BENCHMARK 표시 업데이트
- 제한: State Labels는 SOXX 기준만 지원 (API 변경 없음). QQQ/SPY 선택 시 노트 표시.

**노트 표시 조건:** `benchmark !== 'SOXX'` → "State labels use SOXX benchmark only" 경고 배지

### 2. Stage Grouping Toggle (ON / OFF)

- 기본값: OFF
- 동작:
  - ON: STATE LABELS 탭과 RS 탭에서 AI value-chain Stage별 그루핑
  - OFF: label priority + score 기준 정렬 (기존 동작)

Stage 순서:
```
Stage 1 — AI Chip
Stage 2 — Memory & Packaging
Stage 3 — Server Internal Bottleneck
Stage 4 — External Infrastructure
Stage 5 — Physical Resource
```

### 3. RRG Lookback Selector

`BucketRRGPanel`이 이미 내부 lookback 셀렉터(8W/12W/24W)를 보유하고 있어 D-6에서는 별도 추가 없음.

---

## Summary Strip Refinement

각 항목에 state_score 표시 추가:

```
Leading:      Power Infra · 82
Emerging:     Cooling     · 71
Crowded:      Optical Network · 88
Distribution: PCB/Substrate · 64
Coverage:     13 / 2 partial
              SOXX
              2026-05-08
```

없는 항목은 "None" 표시 (undefined/null 미노출).

---

## Data Quality Badges

컴팩트 배지 행으로 표시:

```
COVERAGE: 13 buckets / 2 partial
STATE METHOD: rule-based
EARNINGS: not included
BENCHMARK: SOXX
```

---

## Benchmark Behavior

| 선택 | 동작 |
|---|---|
| SOXX | 기본 — 모든 기능 정상 |
| QQQ | RS QQQ 열 강조, State Labels는 SOXX 기준 유지 + 노트 |
| SPY | RS SPY 열 강조, State Labels는 SOXX 기준 유지 + 노트 |

State Labels는 D-4 엔진이 SOXX 기준으로 계산 — QQQ/SPY 기준 재계산은 D-7 이후.

---

## API Changes

변경 없음. Benchmark selector는 순수 UI-level state.

기존 `/api/ai-infra/theme-momentum` 응답 그대로 사용.

---

## Limitations

1. State Labels benchmark selector는 UI 표시만 변경 — 실제 상태 계산은 SOXX 기준 유지.
2. Stage grouping에서 빈 스테이지는 헤더 미표시 (자동 필터).
3. RRG lookback은 BucketRRGPanel 내부 제어 — 외부 동기화 없음.

---

## Deferred Items (Phase D-6에서 제외)

| Item | 이유 |
|---|---|
| QQQ/SPY 기준 State Label 재계산 | API 변경 + 엔진 확장 필요 — D-7 |
| Stage grouping → RRG 패널 | RRG 차트 내부 변경 필요 |
| State score tooltip | 구현 범위 초과 |
| Earnings Confirmation | Phase E |
| 독립 대시보드 | 계획 없음 |

---

## Next Phase Recommendation

Phase D-7 (선택):
- `/api/ai-infra/theme-momentum?benchmark=QQQ` query param 지원
- QQQ / SPY 기준 State Label 재계산
- 또는 Phase E: Earnings Confirmation Layer
