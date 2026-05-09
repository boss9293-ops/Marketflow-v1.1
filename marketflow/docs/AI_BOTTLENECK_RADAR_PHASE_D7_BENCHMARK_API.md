# AI Bottleneck Radar Phase D-7 — Benchmark-Aware API

작성일: 2026-05-08

---

## Purpose

D-6까지의 benchmark selector는 UI-only였다 (RS 컬럼 강조만 변경). D-7에서 API가 benchmark query param을 지원하고, State Labels가 선택된 benchmark 기준으로 재계산된다.

---

## API Query Param

**Endpoint:** `GET /api/ai-infra/theme-momentum`

| 호출 | 동작 |
|---|---|
| `/api/ai-infra/theme-momentum` | SOXX 기본값 |
| `/api/ai-infra/theme-momentum?benchmark=SOXX` | SOXX 기준 |
| `/api/ai-infra/theme-momentum?benchmark=QQQ` | QQQ 기준 |
| `/api/ai-infra/theme-momentum?benchmark=SPY` | SPY 기준 |
| `/api/ai-infra/theme-momentum?benchmark=INVALID` | SOXX fallback |

응답에 `selected_benchmark` 필드 추가:

```json
{
  "benchmark": "SOXX",           // 레거시 필드 (변경 없음 — backward compat)
  "selected_benchmark": "QQQ",   // D-7 신규 — 실제 사용된 benchmark
  "bucket_states": [...],
  ...
}
```

---

## Supported Benchmarks

| Benchmark | 의미 |
|---|---|
| SOXX | 반도체 섹터 ETF (기본값) |
| QQQ | 나스닥 100 ETF |
| SPY | S&P 500 ETF |

유효하지 않은 벤치마크는 SOXX로 fallback.

---

## State Label Recalculation

`computeBucketState(bucket, rrgSeries, benchmark)` 시그니처 변경:

```typescript
export function computeBucketState(
  bucket:    AIInfraBucketMomentum,
  rrgSeries: RrgSeries | null | undefined,
  benchmark: AIInfraBenchmarkKey = 'SOXX',
): AIInfraBucketState
```

- `benchmark = 'SOXX'` → `relative_strength.vs_soxx` 사용
- `benchmark = 'QQQ'`  → `relative_strength.vs_qqq` 사용
- `benchmark = 'SPY'`  → `relative_strength.vs_spy` 사용

`source.benchmark`에 실제 사용 benchmark 반영.
`state_reason`과 `state_drivers`의 "vs SOXX" 하드코딩 → `vs ${benchmark}` 동적 변경.

---

## RS Helper Added

```typescript
export function getRSForBenchmark(
  bucket: AIInfraBucketMomentum,
  benchmark: AIInfraBenchmarkKey,
) {
  if (benchmark === 'QQQ') return bucket.relative_strength.vs_qqq
  if (benchmark === 'SPY') return bucket.relative_strength.vs_spy
  return bucket.relative_strength.vs_soxx
}
```

---

## UI Behavior

- `AIInfrastructureRadar.tsx`: `useEffect`가 `[benchmark]`에 의존 → benchmark 선택 시 자동 refetch
- URL: `fetch(\`/api/ai-infra/theme-momentum?benchmark=${benchmark}\`)`
- 경고 표시: `data.selected_benchmark !== benchmark`인 경우만 표시 (API fallback 발생 시)
- 정상 선택 시 경고 미표시

---

## Backward Compatibility

| 필드 | D-6 이전 | D-7 이후 |
|---|---|---|
| `benchmark` | `"SOXX"` (고정) | `"SOXX"` (고정, 레거시 유지) |
| `selected_benchmark` | 없음 | 선택한 benchmark 반영 |
| `bucket_states[].source.benchmark` | bucket 기본값 | 선택한 benchmark |

기존 `benchmark: "SOXX"` 필드는 변경 없음 — 기존 클라이언트 코드 영향 없음.

---

## Data Notes

```
State labels are recalculated using the ${benchmark} benchmark. Rule-based and price/RRG-driven. Earnings confirmation not included.
```

---

## RRG Benchmark

`BucketRRGPanel`은 자체 fetch (`/api/ai-infra/bucket-rrg`)를 사용하며, 현재 SOXX 기준. D-7에서는 변경 없음. 필요 시 별도 phase에서 확장 가능.

---

## Limitations

1. RRG 계산은 여전히 SOXX 기준 캐시 파일에 의존 — State Labels만 benchmark-aware.
2. QQQ/SPY 선택 시 AI_CHIP, PACKAGING 등 일부 버킷의 `vs_qqq`, `vs_spy` RS 값이 null일 수 있음.
3. State engine에서 null RS는 BENCHMARK_MISSING 처리.

---

## Deferred Items

| Item | 이유 |
|---|---|
| RRG benchmark-aware 재계산 | Python 스크립트 확장 필요 |
| QQQ/SPY 기준 basket index | build_bottleneck_rrg.py 수정 필요 |
| Earnings Confirmation | Phase E |
| Standalone dashboard | 계획 없음 |

---

## Next Phase Recommendation

Phase E: Earnings Confirmation Layer — 실적/수주 확인이 State Label에 미치는 영향 추가.  
또는 Phase D-8: RRG benchmark API 확장 (QQQ/SPY 기준 RRG 경로 제공).
