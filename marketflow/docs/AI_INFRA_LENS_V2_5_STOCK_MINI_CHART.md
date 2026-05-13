# AI Infra Lens V2-5 Stock Mini Chart

> Date: 2026-05-13
> Phase: V2-5
> Status: COMPLETE

---

## Purpose

SymbolMiniCard에 90일 가격 추이 차트와 1W/1M/3M/90D 수익률 스트립을 추가.
종목 클릭 시 가격 흐름과 수익률을 한눈에 파악하는 컨텍스트 제공.

---

## V2 Master Plan Reference

`docs/AI_INFRA_LENS_V2_MASTER_PLAN.md`

---

## Components Created

| File | Role |
|------|------|
| `src/lib/ai-infra/v2/buildSymbolChartData.ts` | SVG 경로·색상·수익률 계산 유틸리티 |
| `src/components/ai-infra/v2/SymbolMiniChart.tsx` | 90일 가격 추이 SVG 라인 차트 |
| `src/components/ai-infra/v2/SymbolReturnsStrip.tsx` | 1W/1M/3M/90D 수익률 4열 스트립 |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ai-infra/v2/SymbolMiniCard.tsx` | 차트·스트립 통합, prices/return_1m/return_3m 필드 추가, maxWidth 480px |
| `src/components/ai-infra/v2/LiveFlowMap.tsx` | handleSymbolClick에 prices/return_1m/return_3m 전달 |
| `src/components/ai-infra/v2/SectorPulseCard.tsx` | handleSymbolClick에 prices/return_1m/return_3m 전달 |

---

## Card Layout After V2-5

```
┌──────────────────────────────────────────────┐
│ HEADER                                       │
│ MU   Micron Technology                   [×] │
│ [Story Heavy] [Indirect]                     │
├──────────────────────────────────────────────┤
│ 90D PRICE                        +18.3%      │
│ ╱╲   SVG LINE CHART (120px)                  │
│                      가격 추이 (투자 신호 아님) │
├──────────┬──────────┬──────────┬─────────────┤
│   1W     │   1M     │   3M     │    90D      │
│  +18.3%  │  +80.1%  │  +92.4%  │  +88.2%    │
├──────────┴──────────┴──────────┴─────────────┤
│ 섹터   HBM Memory                            │
│ 실적   확인됨                                 │
│ 근거   ...                                   │
│ 주의   ...                                   │
├──────────────────────────────────────────────┤
│ [Yahoo Finance →]              [닫기]         │
└──────────────────────────────────────────────┘
```

---

## New Fields in SymbolMiniCardData

| Field | Type | Description |
|-------|------|-------------|
| `prices?` | `number[]` | symbol_price_series에서 전달 (90일 가격 배열) |
| `return_1m?` | `number \| null` | 1개월 수익률 |
| `return_3m?` | `number \| null` | 3개월 수익률 |

기존 필드 변경 없음. 하위 호환.

---

## ninety_day 계산

`buildSymbolChartData.ts`의 `computeNinetyDayReturn(prices)`:
```typescript
(prices[last] - prices[0]) / prices[0] * 100
```
API 변경 없음 — 기존 `symbol_price_series` 그대로 사용.

---

## Implementation Notes

- `buildSymbolChartData.ts` 유틸은 `SectorPulseChart`의 인라인 함수와 동일 로직 (공유 유틸 추출).
  V2-6에서 `SectorPulseChart`도 이 유틸로 교체 예정.
- Gradient ID: `mini-grad-${symbol}` — `SectorPulseChart`의 `pulse-gradient-${symbol}`과 분리.
- SymbolMiniChart height: 120px (SectorPulseChart 130px보다 compact).
- Card maxWidth: 480px (V2-3 400px → 확대).

---

## Font Sizes (CLAUDE.md 준수)

| Element | Size |
|---------|------|
| Symbol ticker (header) | 18px |
| Company name | 12px |
| 90D % change (overlay) | 13px |
| Returns strip values | 13px |
| Returns strip labels (1W/1M/3M/90D) | 10px |
| 90D PRICE label | 10px |
| Body row labels (섹터/실적/근거/주의) | 10–11px |
| Body row values | 12px |
| Footer buttons | 12px |

최소 10px 유지 — CLAUDE.md 규칙 준수.

---

## Validation

| Check | Status |
|-------|--------|
| SymbolMiniChart 90D SVG 차트 렌더 | ✅ |
| SymbolMiniChart 데이터 없을 때 placeholder | ✅ |
| SymbolReturnsStrip 4열 표시 | ✅ |
| 90D return computeNinetyDayReturn 계산 | ✅ |
| LiveFlowMap prices/return_1m/return_3m 전달 | ✅ |
| SectorPulseCard prices/return_1m/return_3m 전달 | ✅ |
| SymbolMiniCardData 하위 호환 (기존 필드 optional) | ✅ |
| maxWidth 480px | ✅ |
| 최소 폰트 10px 이상 | ✅ |
| TypeScript exit 0 | ✅ |

---

## Next Step (V2-6)

- URL query param sync (`selectedFlowId` → `?bucket=`)
- SectorPulseChart를 buildSymbolChartData 유틸로 리팩토링
- SectorPulseCard ↔ SymbolMiniCard 차트 공유 컴포넌트 추출

**READY_FOR_V2_6_URL_SYNC**
