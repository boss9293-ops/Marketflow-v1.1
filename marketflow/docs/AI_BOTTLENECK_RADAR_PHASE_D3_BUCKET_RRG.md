# AI Bottleneck Radar Phase D-3 — Bucket RRG

작성일: 2026-05-08

---

## Purpose

13개 AI 인프라 버킷 각각의 basket index를 Candidate-D 공식으로 계산해 RRG 궤적을 생성한다.

Leading / Weakening / Lagging / Improving 4-사분면 위치로 버킷의 상대강도 로테이션을 추적한다.

이 패널은 투자 추천이 아니다. 로테이션 관찰 도구다.

---

## Existing RRG Infrastructure Reused

| Component | 재사용 여부 | 비고 |
|---|---|---|
| `rrg_candidate_d.py` | **직접 재사용** — `import` | 동일 공식, 동일 파라미터 |
| `rrgPathData.ts` — `RrgPathPayload / RrgSeries / RrgPoint` | **타입 그대로 재사용** | 신규 타입 불필요 |
| `semiconductor-rrg-paths/route.ts` 패턴 | API 구조 복제 | cache 파일 서빙 패턴 동일 |
| `SemiconductorRRGCard` SVG 렌더 패턴 | 참고하여 `BucketRRGPanel` 구현 | AnalysisEngineCoreTab은 수정 안 함 |
| `CustomRRGChart.tsx` | **사용 안 함** | 자체 fetch 독립형 — 커스텀 데이터 주입 불가 |

---

## Basket Index Calculation

```
1. 각 버킷의 symbols 목록에서 ohlcv_daily 데이터 로드 (최대 전체 기간)
2. 가용 종목만으로 aligned DataFrame 구성 (ffill → dropna)
3. 각 종목 첫 날 기준 100으로 정규화 (equal-weight normalized index)
4. 종목 평균 → basket index series
5. calc_rrg_candidate_d(basket, benchmark) 호출 (동일 Candidate-D 파라미터)
6. 주간 리샘플링 (W-FRI 기준 last close)
7. 최근 24W 경로 출력
```

최소 데이터 요건: 252 trading days (≥ 1년). 미달 시 PENDING.

```
bucket_index_t = average(sym_price_t / sym_price_0 × 100)
RS_Ratio_t, RS_Momentum_t = calc_rrg_candidate_d(bucket_index_t, benchmark_t)
```

---

## Benchmark Handling

각 버킷은 `aiInfraBucketMap.ts`의 `default_benchmark`를 따른다:
- Stage 1–3 → SOXX
- Stage 4 (External Infra) → SPY
- OPTICAL_NETWORK → QQQ

현재 `build_bottleneck_rrg.py`는 각 버킷의 `default_benchmark`만 사용한다.
QQQ/SPY benchmark 선택 UI는 추후 D-5에서 추가 가능.

---

## Script Execution

```bash
python marketflow/scripts/build_bottleneck_rrg.py
```

**입력:** `marketflow/data/marketflow.db` (ohlcv_daily)  
**출력:** `marketflow/backend/output/cache/bottleneck_rrg_latest.json`  
**의존성:** `marketflow/backend/scripts/rrg_candidate_d.py` (기존 그대로)

실행 결과 (2026-05-08 기준):
- 13/13 버킷 live
- Leading: HBM_MEMORY, PCB_SUBSTRATE
- Weakening: POWER_INFRA, DATA_CENTER_INFRA
- Lagging: AI_CHIP, PACKAGING, COOLING, TEST_EQUIPMENT, GLASS_SUBSTRATE, OPTICAL_NETWORK, CLEANROOM_WATER, SPECIALTY_GAS, RAW_MATERIAL
- 0 Pending

---

## API Response Contract

**Endpoint:** `GET /api/ai-infra/bucket-rrg`

**Type:** `RrgPathPayload` (기존 `rrgPathData.ts` 타입 그대로)

```json
{
  "generatedAt": "2026-05-08T...",
  "benchmark": "SOXX",
  "lookback": "24W",
  "series": [
    {
      "id": "AI_CHIP",
      "label": "AI Chip",
      "benchmark": "SOXX",
      "source": "LOCAL_DB",
      "quadrant": "Lagging",
      "direction": "Pending",
      "points": [
        { "date": "2025-11-07", "rsRatio": 98.2, "rsMomentum": 101.1 },
        ...
      ],
      "note": "Candidate-D basket index. Coverage: 4/4 symbols. Benchmark: SOXX."
    },
    ...
  ],
  "dataStatus": {
    "hasBenchmarkPath": true,
    "hasBucketPath": true,
    "pendingReason": null
  },
  "note": "AI Bottleneck Radar bucket-level RRG. Candidate-D formula. Equal-weight basket index."
}
```

**기존 `/api/semiconductor-rrg-paths` 영향:** 없음 (별도 라우트).

---

## Component Preparation

**파일:** `components/semiconductor/BucketRRGPanel.tsx`

- Self-fetch `/api/ai-infra/bucket-rrg`
- `RrgPathPayload` 타입 직접 사용
- Compact SVG 산포도 + 8W tail 경로
- 사분면별 bucket 목록 테이블
- Lookback selector: 4W / 8W / 12W
- Cache 없으면 스크립트 실행 안내 표시

현재 통합 상태: 컴포넌트 준비 완료, `AIInfrastructureRadarPlaceholder` 교체는 D-5에서.

---

## Data Quality Behavior

| Condition | 처리 |
|---|---|
| 종목 데이터 없음 (ACMR, COPX 등) | 가용 종목만으로 basket 계산, coverage note |
| basket 행 수 < 252 | `PENDING` source, 빈 points[] |
| benchmark 데이터 부족 | `PENDING` |
| 계산 예외 | `PENDING` + error note |
| coverage < 50% | basket 계산은 하되 note에 경고 |

Coverage 현황 (2026-05-08):
- Full coverage: AI_CHIP(4/4), HBM_MEMORY(1/1), GLASS_SUBSTRATE(2/2)
- Partial: COOLING(2/5), PCB_SUBSTRATE(1/4), TEST_EQUIPMENT(2/5), POWER_INFRA(4/6), CLEANROOM_WATER(2/4), RAW_MATERIAL(1/4)
- 0 DATA_INSUFFICIENT

---

## Limitations

1. `direction` 필드는 현재 모두 `'Pending'` — D-4에서 rule-based direction 계산 추가 예정.
2. Coverage가 낮은 버킷 (PCB_SUBSTRATE 1/4, COOLING 2/5)은 basket이 해당 종목에만 의존 — 결과 해석 주의.
3. Equal-weight: NVDA 같은 대형주와 소형주 동일 비중.
4. 한국 상장 종목 (Samsung HBM 등) 제외.
5. 6M 미만 데이터 보유 종목은 basket에서 제외됨 (ffill 후 dropna).
6. OPTICAL_NETWORK는 QQQ 기준, POWER_INFRA/CLEANROOM/GAS/DC/RAW는 SPY 기준 — 사분면 비교 시 benchmark가 다름을 인지해야 함.

---

## Deferred Items (Phase D-3에서 제외)

| Item | 이유 |
|---|---|
| `direction` 계산 | D-4에서 rule-based 추가 |
| D-4 최종 State Label | D-4 |
| QQQ/SPY benchmark UI 선택 | D-5 통합 시 |
| BTI 독립 점수 | 영구 보류 (Engine Score 중복) |
| Earnings Confirmation | Phase E |
| AIInfrastructureRadarPlaceholder 교체 | D-5 |

---

## Next: Phase D-4 — State Label + Overheat

D-4 대상:
1. **Bottleneck State Label**: LEADING / EMERGING / CONFIRMING / CROWDED / LAGGING / STORY_ONLY / DISTRIBUTION — D-2 RS + D-3 RRG quadrant 조합으로 rule-based 계산
2. **Direction**: RRG 궤적 기울기로 Accelerating / Sustaining / Flattening / Rolling Over / Recovering 계산
3. **Basic Overheat Score**: RSI + 60D return + MA distance (ohlcv_daily 기반)

D-4 시작 조건: D-3 merge 완료 후.
