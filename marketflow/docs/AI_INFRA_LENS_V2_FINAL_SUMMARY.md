# AI Infra Lens V2 Final Summary

> 시작일: 2026-05-13
> 완료일: 2026-05-13
> 단계: V2-1 ~ V2-6 (6단계)
> 사용 모델: Sonnet 4.6 (V2-1/2/3/5/6) + Opus 4.7 (V2-4)

---

## V2 시리즈 개요

AI Infrastructure Lens v2 = **AI 인프라 밸류체인 흐름 시각화 시스템**.

기존 "인프라섹터렌즈" (13버킷 헤일맵/리스트)를 완전 재설계:
- 5단계 밸류체인 LiveFlowMap (SVG)
- 노드 클릭 → SectorPulseCard (5섹션 분석)
- 종목 클릭 → SymbolMiniCard (90일 차트 + 4기간 수익률)
- 언어 안전성 + 데이터 누락 fallback 완비

---

## 구현된 컴포넌트

```
src/components/ai-infra/v2/
├── LiveFlowMap.tsx              — 5단계 SVG 흐름 시각화
├── FlowMapNode.tsx              — 버킷 노드 (상태색/선택)
├── FlowMapNodeSymbol.tsx        — 종목 오버레이 서브로우
├── FlowMapConnector.tsx         — 단계 간 연결선 + 화살표
├── OneLineConclusion.tsx        — 상태 분포 기반 한 줄 결론 배너
├── ExpertModeToggle.tsx         — 전문가 탭 토글 버튼
├── SectorPulseCard.tsx          — 섹터 분석 모달 (5섹션)
├── SectorPulseHeader.tsx        — Section A: 섹터명/상태/Score
├── SectorPulseChart.tsx         — Section B: 90일 ETF 차트
├── SectorPulseSummary.tsx       — Section C: 한 줄 요약 + 수익률
├── SectorPulseLeadSymbols.tsx   — Section D: 대장 종목 3-5개
├── SectorPulseWatchPoints.tsx   — Section E: 관찰 포인트 최대 3개
├── SymbolMiniCard.tsx           — 종목 미니카드 (90일 차트 포함)
├── SymbolMiniChart.tsx          — 90일 SVG 라인 차트
├── SymbolReturnsStrip.tsx       — 1W/1M/3M/90D 4열 수익률
└── MoversMarker.tsx             — 🔥 마커 SVG
```

---

## 구현된 라이브러리

```
src/lib/ai-infra/v2/
├── buildOneLineConclusion.ts    — 버킷 상태 분포 → 한 줄 결론 (8 케이스)
├── flowMapLayout.ts             — LiveFlowMap 노드/스테이지 위치 계산
├── leadSymbolResolver.ts        — 버킷별 대표 종목 결정
├── symbolPriceFetcher.ts        — 종목 수익률 조회 (1W/1M/3M)
├── buildMoversMarker.ts         — 🔥 마커 규칙 (|1W| ≥ 10%)
├── resolveLeadSymbolsForBucket.ts — 버킷별 종목 리스트 (primary + secondary)
├── buildSectorPulseSummary.ts   — 12케이스 섹터 한 줄 요약
├── buildWatchPoints.ts          — P1-P9 관찰 포인트 우선순위 룰
└── buildSymbolChartData.ts      — SVG 경로/색상/90D 수익률 계산
```

---

## 사용된 데이터

| 소스 | 필드 |
|------|------|
| `/api/ai-infra/theme-momentum` | bucket_states, earnings_confirmation, symbol_returns (1W/1M/3M), symbol_price_series (90일 × 43종목), asOf |
| `/api/semiconductor` | cycle_context, conflict_flags, infra_to_soxx_translation, infra_historical_analog, infra_educational_narrative |

---

## 핵심 사용자 시나리오

1. **초기 화면**: OneLineConclusion 한 줄 결론 + LiveFlowMap 5단계 흐름 한눈에 파악
2. **노드 클릭 → SectorPulseCard**: 섹터별 90일 차트, 한 줄 요약, 대장 종목, 관찰 포인트
3. **종목 클릭 → SymbolMiniCard**: 90일 가격 차트, 1W/1M/3M/90D 수익률, 실적 상태
4. **Yahoo Finance 이동**: MiniCard 하단 링크로 직접 이동
5. **전문가 모드**: 기존 7개 탭 (VALUE CHAIN / THEME MAP / HEATMAP / EARNINGS / STATE LABELS / RS / RRG)

---

## 핵심 안전성 원칙

| 원칙 | 구현 |
|------|------|
| 금지 언어 | 매수/매도/추천/진입/청산 사용 금지. 면책 문구 내 부정형만 허용 |
| 투자 신호 금지 | 모든 차트에 "가격 추이 (투자 신호 아님)" 디스클레이머 |
| STORY_HEAVY 보수 | 가격 흐름 활발 + 상업화 미확인 명시 |
| INDIRECT 보수 | 간접 수혜 가능성 + 직접 AI 매출 미확인 명시 |
| DATA_LIMITED fallback | 추측성 표현 금지, 데이터 보강 대기 표시 |
| 미상장 메모 | HBM Memory (SK하이닉스/삼성전자 등) 명시 |

---

## 보존된 자산

- 기존 7개 탭 전부 유지 (전문가 모드 토글 뒤)
- BR/E/TM/IA 시리즈 모든 인프라 컨텍스트 패널
- RS / RRG / Earnings 데이터
- API 응답 구조 하위 호환 (기존 필드 변경 없음)

---

## 다음 단계 (V2-7 또는 별도 작업)

| 항목 | 우선순위 |
|------|---------|
| URL 동기화 (?bucket=&symbol=) | 중 |
| 모바일 LiveFlowMap 세로 레이아웃 | 중 |
| 차트 툴팁 (SectorPulseChart/SymbolMiniChart) | 중 |
| 차트 마커 (최고/최저/갭/실적일) | 낮 |
| 키보드 탐색 (Tab/Enter 노드 이동) | 낮 |
| _legacy 폴더 삭제 | 낮 (1-2개월 후) |
| 사용자 피드백 기반 미세 조정 | 낮 |

---

## 결론

```
V2_SERIES_COMPLETE
```

AI Infra Lens v2는 정식 서비스 가능 상태입니다.
