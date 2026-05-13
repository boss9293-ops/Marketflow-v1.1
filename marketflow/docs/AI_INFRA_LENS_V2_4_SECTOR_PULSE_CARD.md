# AI Infra Lens V2-4 Sector Pulse Card

> Date: 2026-05-13
> Phase: V2-4
> Status: COMPLETE

---

## Purpose

LiveFlowMap 노드 클릭 시 그 섹터의 모든 핵심 정보를 5섹션 카드로 한 번에 노출.
0.5초(차트 방향) → 1초(요약+종목) → 3초(관찰 포인트)의 시각 인지 흐름 구현.

---

## V2 Master Plan Reference

`docs/AI_INFRA_LENS_V2_MASTER_PLAN.md`

---

## Components Created

| File | Role |
|------|------|
| `src/components/ai-infra/v2/SectorPulseCard.tsx` | 메인 컨테이너 (모달 + ESC + 미니카드 stacking) |
| `src/components/ai-infra/v2/SectorPulseHeader.tsx` | Section A — 섹터명 + 상태 뱃지 + Score + Purity 뱃지 + 닫기 |
| `src/components/ai-infra/v2/SectorPulseChart.tsx` | Section B — 90일 가격 SVG 라인 차트 (gradient fill) |
| `src/components/ai-infra/v2/SectorPulseSummary.tsx` | Section C — 한 줄 요약 + 1W/1M/3M 수익률 |
| `src/components/ai-infra/v2/SectorPulseLeadSymbols.tsx` | Section D — 대장 종목 리스트 (티커/회사명/수익률/🔥/실적마커) |
| `src/components/ai-infra/v2/SectorPulseWatchPoints.tsx` | Section E — 관찰 포인트 (최대 3개, ⚠ 헤더) |
| `src/lib/ai-infra/v2/buildSectorPulseSummary.ts` | 룰 기반 한 줄 요약 (state × earnings × purity → tone) |
| `src/lib/ai-infra/v2/buildWatchPoints.ts` | 우선순위 룰 기반 관찰 포인트 (P1 conflict → P9 generic) |
| `src/lib/ai-infra/v2/resolveLeadSymbolsForBucket.ts` | top 3-5 종목 (primary + secondary buckets) |

---

## Files Modified

| File | Changes |
|------|---------|
| `theme-momentum/route.ts` | `symbol_returns.three_month` 추가, `symbol_price_series` (90일 가격 배열) 추가 |
| `src/lib/ai-infra/v2/symbolPriceFetcher.ts` | `SymbolReturn.three_month` 필드 추가 |
| `LiveFlowMap.tsx` | SectorPulseCard 통합 — 노드 클릭 시 카드 열림, V2-3 MiniCard와 분리 |
| `AIInfrastructureRadar.tsx` | RadarApiResponse 타입 확장, props 전달 |

---

## Card Structure (5 Sections)

```
┌──────────────────────────────────────────────┐
│ A · HEADER                                   │
│ HBM Memory   [Leading]  Score 80  · HIGH    │
├──────────────────────┬───────────────────────┤
│ B · 90D CHART        │ C · SUMMARY + RETURNS │
│ ETF: MU              │ HBM 수요 강세 + …    │
│      ╱╲              │ 1W +18%  1M +80%  3M │
├──────────────────────┴───────────────────────┤
│ D · LEAD SYMBOLS                             │
│ MU   Micron        +18.3% 🔥   ● 확인        │
│ WDC  Western Dig.  +12.1%      ◐ 부분        │
│ ...                                          │
│ (SK하이닉스 · 삼성전자 → 미상장)               │
├──────────────────────────────────────────────┤
│ E · ⚠ 지금 봐야 할 것                          │
│ ▸ 단기 과열 + 모멘텀 확장 동시 발생            │
│ ▸ MA50 회복 여부 확인                          │
│ ▸ 다음 분기 실적 가시화 여부 관찰             │
└──────────────────────────────────────────────┘
```

데스크탑 (≥768px): B/C 좌우 분할. 그 외 섹션 풀폭.
모바일 (<768px): 모든 섹션 세로 스택.

---

## Section A — Header

- `SECTOR PULSE` 작은 라벨
- 섹터 한국어명 (18px 굵게)
- StateBadge (배경색 = STATE_COLORS) + Score + 신뢰도
- Story Heavy / Indirect 뱃지 (해당 시)
- `×` 닫기 버튼

---

## Section B — 90 Day Chart

- ETF/lead symbol 1개 기준
- SVG line + area gradient
- Up = 녹색 (`#22c55e`), Down = 적색 (`#ef4444`)
- 우상단에 전체 변화율 % 표시
- 데이터 부족 시 "차트 데이터 준비 중" placeholder
- 푸터 안내: "가격 추이 (투자 신호 아님)"

---

## Section C — Summary + Returns

### 룰 기반 한 줄 요약 (`buildSectorPulseSummary.ts`)

우선순위:
1. STORY_ONLY/STORY_HEAVY → "가격 흐름 활발하나 상업화 미확인"
2. DATA_INSUFFICIENT → "가격 데이터 부족, 신호 미확정"
3. INDIRECT + 강세 → "간접 수혜 가능성, 직접 AI 매출 미확인"
4. CROWDED → "단기 과열 + 모멘텀 확장 동시 발생"
5. DISTRIBUTION → "분배 국면, 강세 후 약화 신호"
6. LEADING + CONFIRMED → "수요 강세 + 실적 확인"
7. LEADING + PARTIAL → "가격 주도, 실적 일부 확인"
8. LEADING + 기타 → "가격 주도, 실적 확인 부족"
9. EMERGING/CONFIRMING + CONFIRMED/PARTIAL → "확산 + 실적 확인 진행"
10. EMERGING/CONFIRMING + 기타 → "가격 확산 시작, 실적 미진"
11. LAGGING → "약세 지속"
12. else → "혼재 구간"

### Tone Color
positive #22c55e / caution #fbbf24 / neutral #B8C8DC / warning #f97316 / data #8b9098

### 1W / 1M / 3M Returns
lead symbol 기준. 데이터 없으면 "—".

---

## Section D — Lead Symbols

### Sorting (`resolveLeadSymbolsForBucket.ts`)
1. earnings.confirmation_level: CONFIRMED > PARTIAL > WATCH > NOT_CONFIRMED > DATA_LIMITED
2. ai_infra_relevance_score DESC

primary + secondary bucket 매핑 모두 포함. top 3-5개 노출.

### Row Display
- 티커 + STORY/INDIRECT 뱃지 + 회사명
- 1주 수익률 + 🔥 마커 (V2-3 룰 재사용)
- Earnings marker:
  - ● 확인 (#22c55e)
  - ◐ 부분 (#5DCFB0)
  - ◯ 관찰 (#fbbf24)
  - ✕ 미확인 (#f97316)
  - — 제한 (#8b9098)
- 행 호버 시 배경 강조
- 행 클릭 → SymbolMiniCard 오버레이 (zIndex 1001)

### 미상장 메모 (`NOT_LISTED_NOTES`)
- HBM_MEMORY: "SK하이닉스 · 삼성전자 → 미상장"
- PACKAGING: "TSMC 외 주요 파운드리 미상장"
- TEST_EQUIPMENT: "디스코 / 일본 후공정 장비 → 미상장"
- GLASS_SUBSTRATE: "국내 SKC / 삼성전기 → 미상장"

---

## Section E — Watch Points

### Priority Rules (`buildWatchPoints.ts`)

| Priority | Trigger | Sample Point |
|---------|---------|--------------|
| P1 | conflict flag | 사이클 맥락과 인프라 신호 불일치 |
| P2 | STORY_HEAVY | 상업화 미확인 — 매출 인식 시점 관찰 |
| P3 | CROWDED/OVERHEAT | 단기 과열 + 모멘텀 확장 동시 발생 |
| P4 | DISTRIBUTION | 강세 후 약화 — 추세 이탈 여부 점검 |
| P5 | Strong RS + Weak earnings | 가격 강세 대비 실적 확인 부족 |
| P6 | INDIRECT | 직접 AI 매출 미확인 — 간접 수혜 경로 점검 |
| P7 | DATA_LIMITED | 가격/실적 데이터 부족 |
| P8 | LAGGING | 약세 지속 |
| P9 | Generic | 추세 지속 여부 점검 |

최대 3개. 중복 제거.

---

## Open / Close Behavior

### Open
- LiveFlowMap 노드 본체 클릭 → `selectedId` 설정 → 카드 렌더링
- 노드의 종목 티커 클릭은 V2-3 MiniCard로 분기 (stopPropagation)

### Close
- `×` 닫기 버튼
- 배경(backdrop) 클릭
- ESC 키 (MiniCard가 열려있으면 MiniCard만 닫음)
- 다른 노드 클릭 → `selectedId` 변경 → 새 카드 렌더링

---

## State Management

LiveFlowMap이 단일 진실 공급원:
- `selectedFlowId` (AIInfrastructureRadar) → `selectedId` (LiveFlowMap) → SectorPulseCard
- SectorPulseCard 내부에서 `miniCard` 상태 자체 관리 (Section D 클릭)
- LiveFlowMap의 `activeMiniCard` (V2-3 직접 티커 클릭)는 카드와 독립

URL query param sync는 V2-6로 연기.

---

## Responsive Rules

| Width | Layout |
|-------|--------|
| ≥1024px | Card 800px max, B/C 좌우 분할 |
| 768-1023px | Card 90vw, B/C 좌우 분할 |
| <768px | Card 100vw, 모든 섹션 세로 스택 |

가로 스크롤 절대 금지. max-height 90vh + overflow-y auto.

---

## Critical Cases

### STORY_HEAVY (GLW 등)
- Header: Story Heavy 뱃지 (amber)
- Chart: GLW 차트 (가용 시)
- Summary: "가격 흐름 활발하나 상업화 미확인"
- Lead symbols: STORY 뱃지 (amber)
- Watch points: 상업화 미확인 / 매출 인식 시점 / 양산 일정

### INDIRECT (RAW_MATERIAL 등)
- Summary: "간접 수혜 가능성, 직접 AI 매출 미확인"
- Lead symbols: INDIRECT 뱃지 (muted)
- Watch points: 데이터센터 / 인프라 수요 지속 여부

### DATA_LIMITED (CLEANROOM_WATER 등)
- Summary: "가격 데이터 부족, 신호 미확정"
- Chart: "차트 데이터 준비 중"
- Watch points: "데이터 보강 대기"
- 추측성 추천 절대 금지

---

## Data Inputs

| Source | Fields |
|--------|--------|
| `theme-momentum` API | bucket_states, earnings_confirmation, symbol_returns, symbol_price_series, asOf |
| V2-3 재사용 | leadSymbolResolver, symbolPriceFetcher, buildMoversMarker, SymbolMiniCard |

API 응답 추가 필드:
- `symbol_returns[symbol].three_month` (1W/1M에 더해 3M)
- `symbol_price_series: Record<string, number[]>` (43종목 × 최대 90개 가격)

기존 필드 변경 없음. 하위 호환.

---

## Non-Goals (V2-4)

- 종목별 90일 차트 → V2-5
- 차트 실적 발표일 / 최고최저 / 갭 마커 → V2-5
- 차트 hover 툴팁 → V2-5
- 종목 1M/3M 별도 표시 → V2-5 (Section D는 1W만)
- URL query param sync → V2-6

---

## Validation

| Check | Status |
|-------|--------|
| 노드 클릭 시 SectorPulseCard 열림 | ✅ |
| 종목 티커 클릭은 V2-3 MiniCard (구분) | ✅ stopPropagation |
| Section A: 섹터명 + 상태 뱃지 + Score | ✅ |
| Section A: 닫기 버튼 | ✅ |
| Section B: 90일 SVG 라인 차트 | ✅ |
| Section B: ETF 매핑 없거나 데이터 없으면 placeholder | ✅ |
| Section C: 룰 기반 한 줄 요약 | ✅ 12개 case |
| Section C: 1W/1M/3M 표시 | ✅ |
| Section C: 결손 시 "—" | ✅ |
| Section D: top 3-5 정렬 (CONFIRMED first) | ✅ |
| Section D: 1W 수익률 + 🔥 마커 | ✅ |
| Section D: 실적 마커 (●/◐/◯/✕/—) | ✅ |
| Section D: 미상장 메모 표시 | ✅ HBM 등 |
| Section D: 행 클릭 → MiniCard 오버레이 | ✅ zIndex 1001 |
| Section E: 관찰 포인트 최대 3개 | ✅ |
| Section E: 우선순위 룰 적용 | ✅ P1-P9 |
| 카드 닫기: 버튼 / 배경 / ESC | ✅ |
| 다른 노드 클릭 시 카드 전환 | ✅ |
| STORY_HEAVY 보수적 표시 | ✅ |
| INDIRECT 보수적 표시 | ✅ |
| DATA_LIMITED fallback | ✅ |
| 모바일 풀스크린 (반응형) | ✅ isWide < 768 |
| 모바일 가로 스크롤 없음 | ✅ max-height 90vh |
| 폰트 10px 이상 | ✅ |
| 색상 일관성 (LiveFlowMap) | ✅ STATE_COLORS 재사용 |
| 기존 7개 탭 회귀 없음 | ✅ |
| V2-3 SymbolMiniCard 회귀 없음 | ✅ |
| LiveFlowMap 회귀 없음 | ✅ 직접 티커 클릭 유지 |
| API 응답 변경: 추가만 (기존 필드 무변경) | ✅ |
| TypeScript 통과 | ✅ exit 0 |
| 금지 언어 없음 | ✅ |

---

## Next Step (V2-5)

V2-5 조건:
- [x] SectorPulseCard 정상 열림/닫힘
- [x] 5개 Section 모두 정상 렌더
- [x] 90일 차트 데이터 흐름 작동
- [x] 한 줄 요약 룰 기반 작동
- [x] 관찰 포인트 우선순위 룰 작동
- [x] Critical Cases 보수적 표시
- [x] 종목 클릭 → MiniCard 정상 오버레이
- [x] TypeScript 통과
- [x] 금지 언어 없음

**READY_FOR_V2_5_STOCK_MINI_CHART**
