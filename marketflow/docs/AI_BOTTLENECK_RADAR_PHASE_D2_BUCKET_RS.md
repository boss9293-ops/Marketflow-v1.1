# AI Bottleneck Radar Phase D-2 — Bucket Relative Strength

작성일: 2026-05-08

---

## Purpose

13개 AI 인프라 버킷 각각에 대해 가격 기반 상대강도와 모멘텀을 정량화한다.

이 패널은 투자 추천이 아니다. 버킷 단위 자본 흐름 방향을 관찰하기 위한 연구 도구다.

---

## Data Contract

**파일:** `lib/semiconductor/aiInfraBucketRS.ts`

```typescript
AIInfraPeriodReturns     // { one_month, three_month, six_month }
AIInfraBucketMomentum    // 버킷별 수익률 + RS + rank + coverage
AIInfraBenchmarkReturns  // { SOXX, QQQ, SPY } 각각 AIInfraPeriodReturns
AIInfraMultiPeriodReturn // 티커별 내부 계산용 (route에서만 사용)
```

**핵심 타입:**
```typescript
interface AIInfraBucketMomentum {
  bucket_id:    AIInfraBucketId
  display_name: string
  stage:        AIInfraStage
  benchmark:    'SOXX' | 'QQQ' | 'SPY'
  returns:      AIInfraPeriodReturns          // 버킷 절대 수익률
  relative_strength: {
    vs_soxx: AIInfraPeriodReturns             // 버킷 - SOXX (pp)
    vs_qqq:  AIInfraPeriodReturns
    vs_spy:  AIInfraPeriodReturns
  }
  rank: {
    one_month / three_month / six_month / composite: number | null
  }
  coverage: {
    symbol_count        // 버킷 정의 종목 수
    priced_symbol_count // 실제 가격 데이터 있는 종목 수
    coverage_ratio      // 0.0–1.0
    data_quality        // REAL | PARTIAL | DATA_INSUFFICIENT
  }
}
```

---

## Calculation Method

**버킷 수익률 = 가용 종목들의 단순 평균 return**

```
validSymbols = bucket.symbols.filter(hasPrice)
basketReturn(period) = average(validSymbols.map(sym => return(sym, period)))
```

**상대강도 = 버킷 수익률 - 벤치마크 수익률 (pp 단위)**

```
RS vs SOXX (3M) = basket 3M return - SOXX 3M return
```

예시:
- Bucket 3M = +18.4%, SOXX 3M = +11.2% → RS = +7.2pp → Leading

**랭킹**: vs SOXX RS 기준 내림차순. 1 = 가장 높은 RS.

---

## Periods & Offsets

| Period | Trading Day Offset | DB Row Count Required |
|---|---|---|
| 1M | 21 | 22 |
| 3M | 63 | 64 |
| 6M | 126 | 127 |

DB LIMIT 변경: 30 → 135 (6M 계산 지원)

---

## Benchmarks

| Benchmark | Ticker | Used For |
|---|---|---|
| SOXX | SOXX | 반도체 섹터 대비 RS |
| QQQ | QQQ | 기술주 전체 대비 RS |
| SPY | SPY | 시장 전체 대비 RS |

3개 모두 동일 `ohlcv_daily` 테이블에서 읽는다. 데이터 없으면 해당 RS는 null.

---

## API Response

**Endpoint:** `GET /api/ai-infra/theme-momentum`

**신규 필드 (D-2 추가, backward compatible):**

```json
{
  "themes": [...],            // 기존 — 변경 없음
  "buckets": [                // D-2 신규
    {
      "bucket_id": "AI_CHIP",
      "display_name": "AI Chip",
      "stage": "STAGE_1_AI_CHIP",
      "benchmark": "SOXX",
      "returns": { "one_month": 4.2, "three_month": 18.4, "six_month": 31.1 },
      "relative_strength": {
        "vs_soxx": { "one_month": 1.1, "three_month": 7.2, "six_month": 12.3 },
        "vs_qqq":  { ... },
        "vs_spy":  { ... }
      },
      "rank": { "one_month": 2, "three_month": 1, "six_month": 1, "composite": 1 },
      "coverage": { "symbol_count": 4, "priced_symbol_count": 4, "coverage_ratio": 1.0, "data_quality": "REAL" }
    },
    ...
  ],
  "benchmarks": {             // D-2 신규
    "SOXX": { "one_month": 3.1, "three_month": 11.2, "six_month": 18.8 },
    "QQQ":  { ... },
    "SPY":  { ... }
  },
  "generated_at": "2026-05-08T...",
  "data_notes": ["Partial coverage: HBM Memory, PCB & Substrate, ..."]
}
```

기존 `themes`, `source`, `asOf`, `benchmark`, `status`, `warnings` 필드는 변경 없음.

---

## UI Integration

**파일:** `components/semiconductor/BucketRelativeStrengthPanel.tsx`

- 자체 fetch (`/api/ai-infra/theme-momentum`)
- composite rank 기준 오름차순 정렬
- 테이블: Bucket | Stage | 1M | 3M | 6M | RS SOXX 3M | RS QQQ 3M | Coverage | Signal
- Signal 레이블: Leading / Improving / Mixed / Lagging / Data Missing (D-2 임시, D-4에서 교체 예정)
- 하단 SOXX / QQQ / SPY 벤치마크 행 참조값 표시

**현재 통합 상태:** 컴포넌트 준비 완료, `AIInfrastructureRadarPlaceholder` 교체는 D-5에서 수행.

---

## Temporary Signal Labels (D-2)

| Condition (rs_3m_vs_soxx) | Label | Color |
|---|---|---|
| > +5pp | Leading | #3FB6A8 (teal) |
| > 0pp | Improving | #5DCFB0 (mint) |
| > -5pp | Mixed | #D4B36A (gold) |
| ≤ -5pp | Lagging | #E55A5A (red) |
| null | Data Missing | #6B7B95 (gray) |

이 레이블은 임시 D-2 디스플레이다. 최종 D-4 State Engine에서 LEADING / EMERGING / CROWDED / LAGGING / STORY_ONLY / DISTRIBUTION 체계로 교체된다.

---

## Limitations

1. Equal-weight 평균 — 시가총액 가중치 아님. NVDA 같은 대형주와 소형주가 동일 비중.
2. 한국 상장 종목 (Samsung 005930.KS, SK Hynix 000660.KS) 제외 — HBM_MEMORY 버킷 커버리지 낮음.
3. 동일 티커의 복수 버킷 중복 (예: VRT ∈ COOLING + POWER_INFRA + DATA_CENTER_INFRA) — 의도적.
4. 6M 계산이 되려면 DB에 126거래일 이상 데이터 필요. 신규 상장주나 데이터 미수집 종목은 null.
5. ETF 프록시 (COPX) 포함됨 — RAW_MATERIAL 버킷 해석 시 주의.
6. 가격 기반 RS는 valuation, 실적, 수주를 반영하지 않는다. D-4 이후 레이어 추가 예정.

---

## Deferred Items (Phase D-2에서 제외)

| Item | 이유 |
|---|---|
| BTI 독립 점수 | Engine Score와 중복 위험 — D-4 이후 설계 분리 |
| Earnings Confirmation | LLM 필요 |
| AI revenue % | FMP 자동화 필요 |
| Theme Purity 자동화 | Phase E |
| 최종 State Label (D-4 체계) | LEADING/EMERGING/CROWDED — D-4에서 구현 |
| 독립 사이드바 라우트 | 영구 제외 |
| AIInfrastructureRadarPlaceholder 교체 | D-5에서 수행 |

---

## Next: Phase D-3 — Bottleneck RRG

D-3 대상:
- `CustomRRGChart` 재사용
- 버킷별 basket index 주간 RS 시계열 계산
- Python 스크립트: `build_bottleneck_rrg.py`
- API: `/api/bottleneck-rrg`
- 입력: SOXX 대비 각 버킷 basket의 JdK RS Ratio + RS Momentum
- 출력: Leading / Weakening / Lagging / Improving 위치 × 궤적

D-3 시작 조건: D-2 merge 완료 후.
