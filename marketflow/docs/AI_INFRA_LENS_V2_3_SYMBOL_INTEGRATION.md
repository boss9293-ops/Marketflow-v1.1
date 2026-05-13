# AI Infra Lens V2-3 Symbol Integration

> Date: 2026-05-13
> Phase: V2-3
> Status: COMPLETE

---

## Purpose

LiveFlowMap 각 노드에 대표 종목(티커 + 1주 수익률 + 🔥 마커) 노출.
티커 클릭 → 미니카드 → Yahoo Finance 외부 링크.

---

## V2 Master Plan Reference

`docs/AI_INFRA_LENS_V2_MASTER_PLAN.md`

---

## Components Created

| File | Role |
|------|------|
| `src/lib/ai-infra/v2/leadSymbolResolver.ts` | 버킷별 대표 종목 결정 (earnings 확인도 > relevance score 우선) |
| `src/lib/ai-infra/v2/symbolPriceFetcher.ts` | symbol_returns 맵에서 1주 수익률 조회 + fmtReturn/returnColor 헬퍼 |
| `src/lib/ai-infra/v2/buildMoversMarker.ts` | `|1W return| ≥ 10% → 🔥`, 그 외 none |
| `src/components/ai-infra/v2/MoversMarker.tsx` | SVG 🔥 렌더러 |
| `src/components/ai-infra/v2/FlowMapNodeSymbol.tsx` | 노드 서브행: 티커 + 수익률 + 마커, stopPropagation 처리 |
| `src/components/ai-infra/v2/SymbolMiniCard.tsx` | 종목 모달: 헤더/섹터/수익률/실적/근거/주의/Yahoo링크 |

---

## Files Modified

| File | Changes |
|------|---------|
| `theme-momentum/route.ts` | `symbol_returns` 필드 추가 (AI_INFRA_COMPANY_PURITY 43개 종목 × five_day/one_month) |
| `src/lib/ai-infra/v2/flowMapLayout.ts` | `NODE_H` 42 → 58 (종목 서브행 공간 확보) |
| `src/components/ai-infra/v2/FlowMapNode.tsx` | `symbolOverlay` + `onSymbolClick` props 추가; 서브행 렌더링 |
| `src/components/ai-infra/v2/LiveFlowMap.tsx` | 종목 데이터 props 추가; leadMap/overlay 계산; 미니카드 상태 관리 |
| `AIInfrastructureRadar.tsx` | `symbol_returns` RadarApiResponse 타입 추가; LiveFlowMap props 전달 |

---

## Lead Symbol Resolution Rules

```
우선순위 (같은 버킷 내):
1. earnings.confirmation_level: CONFIRMED(5) > PARTIAL(4) > WATCH(3) > NOT_CONFIRMED(2) > DATA_LIMITED(1) > UNKNOWN(0)
2. ai_infra_relevance_score DESC (동점 시)
```

결과: `{ symbol, company_name, is_indirect, is_story_heavy, fallback_reason? }`

| fallback_reason | 조건 |
|----------------|------|
| `not-listed` | 버킷에 매핑된 종목 없음 |
| `indirect-only` | indirect_exposure = true |
| `data-limited` | story_risk = true |

---

## Symbol Price Data Source

`theme-momentum` API 응답의 `symbol_returns` 필드.
서버에서 `multiPeriodMap`(기존 인프라)을 이용해 `five_day` + `one_month` 계산 후 포함.
새 API 라우트 불필요.

---

## Movers Marker Rules

| 조건 | 마커 |
|------|------|
| `|return_1w| ≥ 10%` | 🔥 (fire) |
| 그 외 | none |

이진 룰. 과다 마커 방지.

---

## Flow Map Node Integration

노드 높이 42 → 58px.

```
y+0:  node rect top
y+15: display_name 텍스트
y+28: state dot (r=2.5)
y+31: state label
y+38: 구분선 (separator)
y+50: 티커 텍스트 + 수익률 + 🔥 마커
y+58: node rect bottom
```

클릭 분리:
- 상단 영역 (rect + name + state) → 노드 하이라이트 (`onClick`)
- 서브행 (separator 이하) → 미니카드 열기 (`stopPropagation` + `onSymbolClick`)

---

## Symbol Mini Card

필드:
| 영역 | 내용 |
|------|------|
| 헤더 | symbol + company_name + Story Heavy / Indirect 뱃지 |
| 섹터 | bucket_label (AIInfraBucketState.display_name) |
| 주가 | 1주 수익률 + 🔥 마커 |
| 실적 | confirmation_level (한국어) |
| 근거 | evidence_notes[0] |
| 주의 | caution_notes[0] → 없으면 purity notes[0] |
| 푸터 | Yahoo Finance 링크 + 닫기 버튼 |

닫기: ✕ 버튼 / 배경 클릭 / ESC 키.

---

## STORY_HEAVY / INDIRECT 시각 구분

| 종목 유형 | 노드 서브행 색상 | 미니카드 뱃지 |
|---------|-------------|------------|
| STORY_HEAVY | `#fbbf24` (amber) | "Story Heavy" (amber 테두리) |
| INDIRECT | `#8b9098` (muted) | "Indirect" (muted 테두리) |
| 일반 | `#B8C8DC` | 없음 |

---

## 미상장 종목 안내

HBM_MEMORY → MU: purity notes[0] 에 "삼성·SK하이닉스 미포함으로 HBM 시장 전체 대표성 제한" 포함.
SymbolMiniCard의 주의(caution_note) 영역에 자동 표시.

---

## Non-Goals (V2-3)

```
90일 차트          → V2-5
1M / 3M / 90D 수익률 → V2-5
Sector Pulse Card   → V2-4
노드 클릭 시 상세    → V2-4
종목 미니카드 내 차트 → V2-5
```

---

## Validation

| Check | Status |
|-------|--------|
| 13개 노드 중 종목 매핑 있는 노드에 티커 표시 | ✅ |
| 종목 매핑 없는 노드는 서브행 없음 (텍스트 없음) | ✅ |
| 수익률 fetch 실패 시 "—" 표시 | ✅ |
| 🔥 마커는 |1W| ≥ 10%만 | ✅ |
| 티커 클릭 → 미니카드 열림 | ✅ |
| 미니카드: 섹터/수익률/실적/근거/주의 | ✅ |
| 미니카드: Yahoo Finance 링크 | ✅ |
| 미니카드: 닫기 (버튼/배경/ESC) | ✅ |
| 노드 자체 클릭 = V2-2 하이라이트만 유지 | ✅ |
| 티커/노드 클릭 충돌 없음 (stopPropagation) | ✅ |
| STORY_HEAVY amber 색상 구분 | ✅ |
| INDIRECT muted 색상 구분 | ✅ |
| 미상장 종목 메모 (MU, SK하이닉스 등) caution_note 표시 | ✅ |
| 기존 7개 탭 회귀 없음 | ✅ |
| Compact Bridge 회귀 없음 | ✅ |
| 전문가 보기 토글 정상 | ✅ |
| API 응답 symbol_returns 추가 (기존 필드 변경 없음) | ✅ |
| TypeScript 통과 | ✅ exit 0 |
| 금지 언어 없음 | ✅ |
| 폰트 10px 이상 | ✅ |
| 노드 위치 깨짐 없음 (NODE_H 변경 반영) | ✅ |

---

## Next Step (V2-4)

V2-4 조건:
- [x] 13개 노드 종목 매핑 일관 적용
- [x] 1주 수익률 정상 표시
- [x] 🔥 마커 룰 작동 (과다 없음)
- [x] 미니카드 정상 작동
- [x] Yahoo Finance 링크 정상
- [x] 기존 7개 탭 회귀 없음
- [x] TypeScript 통과

**READY_FOR_V2_4_SECTOR_PULSE_CARD**
