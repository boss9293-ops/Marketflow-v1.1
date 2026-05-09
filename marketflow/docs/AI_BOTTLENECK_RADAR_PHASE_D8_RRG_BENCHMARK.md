# AI Bottleneck Radar Phase D-8 — RRG Benchmark-Aware

작성일: 2026-05-08

---

## Purpose

D-7까지 bucket-level RRG (`BucketRRGPanel`)은 항상 SOXX 기준 캐시만 읽었다.
D-8에서 Python 스크립트가 SOXX/QQQ/SPY 3개 캐시를 생성하고, API와 UI가 선택한 benchmark 기준의 RRG 데이터를 제공한다.

---

## Python Script Changes — `build_bottleneck_rrg.py`

출력 파일 3개 생성 (단일 DB 로드 → 3회 계산):

| 파일 | Benchmark |
|---|---|
| `bottleneck_rrg_latest.json` | SOXX (레거시 backward compat) |
| `bottleneck_rrg_qqq_latest.json` | QQQ |
| `bottleneck_rrg_spy_latest.json` | SPY |

`build_payload(series_map, selected_bm)` — 선택된 benchmark를 모든 버킷에 균일 적용 (per-bucket 기본값 override).

---

## API Changes — `/api/ai-infra/bucket-rrg`

**Endpoint:** `GET /api/ai-infra/bucket-rrg`

| 호출 | 동작 |
|---|---|
| `/api/ai-infra/bucket-rrg` | SOXX 기본값 |
| `/api/ai-infra/bucket-rrg?benchmark=SOXX` | SOXX 캐시 |
| `/api/ai-infra/bucket-rrg?benchmark=QQQ` | QQQ 캐시 |
| `/api/ai-infra/bucket-rrg?benchmark=SPY` | SPY 캐시 |
| `/api/ai-infra/bucket-rrg?benchmark=INVALID` | SOXX fallback |

응답에 `selected_benchmark` 필드 추가 (캐시 파일 부재 시 pending 응답에도 포함).

---

## Component Changes — `BucketRRGPanel`

```typescript
export function BucketRRGPanel({ benchmark = 'SOXX' }: { benchmark?: 'SOXX' | 'QQQ' | 'SPY' })
```

- `useEffect` dependency: `[benchmark]` — benchmark 변경 시 자동 refetch
- fetch URL: `/api/ai-infra/bucket-rrg?benchmark=${benchmark}`
- 헤더에 `vs {benchmark}` 표시

---

## Radar Integration — `AIInfrastructureRadar`

```tsx
{tab === 'rrg' && <BucketRRGPanel benchmark={benchmark} />}
```

컨트롤바에서 선택한 benchmark가 RRG 탭에도 그대로 전달된다.

---

## Backward Compatibility

- `bottleneck_rrg_latest.json` 경로 유지 → `/api/ai-infra/bucket-rrg` 기본 동작 변경 없음
- `theme-momentum` API는 여전히 SOXX 캐시 읽음 (D-4 loadRRGCache — State Labels용, 변경 없음)

---

## Limitations

1. 캐시 파일이 없으면 (QQQ/SPY 스크립트 미실행) pending 응답 반환 — UI에서 "RRG cache not yet generated" 표시
2. 버킷 per-symbol 구성은 동일 — benchmark만 변경, 바스켓 구성 변경 없음
3. Python 스크립트는 수동 실행 필요 (`marketflow/scripts/build_bottleneck_rrg.py`)

---

## Next Phase

Phase E: Earnings Confirmation Layer — 실적/수주 이벤트를 State Label에 반영.
