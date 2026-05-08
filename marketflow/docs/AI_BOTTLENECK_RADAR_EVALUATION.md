# AI Bottleneck Radar — 기능 추가 가능성 평가

작성일: 2026-05-08  
작성자: Claude (Builder) — 평가 전용, 구현 없음

---

## 1. Executive Summary

**결론: Adopt after C-3 — 독립 탭 아님, 기존 Placeholder 확장**

AI Bottleneck Radar 인프라는 **이미 앱에 절반 이상 존재**한다.
`AIInfrastructureRadarPlaceholder`, `aiInfrastructureRadar.ts`, `aiInfrastructureMomentum.ts`, `/api/ai-infra/theme-momentum` 등이 구축된 상태이며, 5개 테마(`data_center_power`, `grid`, `cooling`, `cloud_capex`, `nuclear_smr`)는 정의됐지만 모두 `dataStatus: 'placeholder'`다.

**가장 가치 있는 기능 3개:**
1. AI Bottleneck Bucket Map — 기존 placeholder 확장 + 데이터 연결
2. Bucket Relative Strength Panel — 현재 ohlcv_daily 데이터로 즉시 가능
3. Bottleneck State Label — rule-based, 코드 최소

**가장 위험한 중복 3개:**
1. BTI vs Engine Score (`internal_signal`) — 거의 동일 개념, 분리하면 혼란
2. Overheat Score vs 기존 Risk Engine MSS — 이름만 다른 유사 지표
3. AI Value Chain Ladder vs MAP tab — MAP 탭 4-bucket 맥락과 시각적 충돌

**C-3 이후 권장 단계:**
```
Phase D-1: Bucket Map 확장 (placeholder → 데이터 연결, 13개 버킷)
Phase D-2: Bucket RS vs SOXX/QQQ/SPY + Momentum Panel
Phase D-3: Bottleneck RRG (CustomRRGChart 재사용)
Phase D-4: Overheat Score + State Label
Phase D-later: Earnings Confirmation, Theme Purity — LLM 필요
```

---

## 2. Current App Capability Inventory

| Existing Module | What It Already Does | Related to Bottleneck Radar? | Reusable? |
|---|---|---|---|
| `AIInfrastructureRadarPlaceholder.tsx` | 5개 테마 정의, placeholder UI, SOXX link type | **핵심 — 이것이 Radar의 시작점** | Yes — 직접 확장 |
| `aiInfrastructureRadar.ts` | `AIInfrastructureTheme` 타입, 5개 theme 상수, `dataStatus` 상태 | 테마 분류 기반 | Yes |
| `aiInfrastructureMomentum.ts` + `/api/ai-infra/theme-momentum` | basket 종목별 1M/3M/6M return을 ohlcv_daily로 계산 | RS Panel, BTI의 핵심 재료 | **Yes — 그대로 확장** |
| `aiInfrastructureScorePolicy.ts` | dataStatus별 점수 표시 정책 | BTI 표시 정책 기반 | Yes |
| `bucketMapping.ts` | 4-bucket: ai_compute/memory/equipment/foundry_packaging | Radar의 상위 4개 버킷과 일치 | Yes — 하위 버킷 추가 구조 |
| `engineScore.ts` | internal_signal(-100~+100), CycleState, conflict detection | BTI와 개념 중복 | 참고만 — 통합 금지 |
| `sectorTailwind.ts` | Semiconductor → Market Path 어댑터 | Radar → Market Path 연결 경로 참고 | 패턴 참고 |
| `explanationEngine.ts` | rule-based 해석 문구 생성 | Bottleneck Narrative Box 기반 | Yes — 확장 |
| `CustomRRGChart.tsx` + `rrgPathData.ts` | RRG 궤적 차트, basket 지원 | Bottleneck RRG 재사용 가능 | **Yes — 직접 재사용** |
| `BucketRSChart.tsx`, `BucketPerfChart.tsx` | SOXX 4-bucket RS/성과 차트 | Bucket RS Panel 기반 | Yes — 확장 |
| `semiconductor_buckets.json` | aiCompute/memoryHbm/foundryPackaging/equipment 4개 | Radar 상위 4개와 일치 | Yes — 확장 필요 |
| `signalQuality.ts` (C-5I) | 6-component cross-layer 신호 품질 점수 | Radar 데이터 신뢰 레이어와 공유 | Yes — Data Trust 재사용 |
| MAP tab (`AnalysisEngineCoreTab.tsx`) | SOXX 4-bucket breadth/RS/momentum 시각화 | Value Chain Ladder와 시각적 중복 | 흡수 고려 |
| SoxxSoxlDashboard.tsx `SvgRadarChart` | 7축 방사형 차트 (Power Bottleneck 축 포함) | Radar 축 개념과 유사 | 참고 — 중복 주의 |

---

## 3. Candidate Feature Evaluation

| Candidate Feature | Existing Overlap | Reuse Possible? | New Work Required | Risk of Duplication | Recommended Timing | Verdict |
|---|---|---|---|---|---|---|
| 3.1 AI Value Chain Ladder | MAP tab 4-bucket 시각화와 중복, AIInfrastructureRadar placeholder UI와 겹침 | MAP tab + Radar placeholder 조합으로 커버 가능 | 낮음 — 기존 구조 확장 | 높음 — MAP tab과 UI 충돌 | C-3 AFTER STABILIZATION | MERGE INTO EXISTING (MAP 탭 하단 또는 Radar 탭 상단에 흡수) |
| 3.2 Bottleneck Transfer Index (BTI) | `engineScore.ts`의 `internal_signal`과 거의 동일 개념, `sectorTailwind`와도 겹침 | Engine Score 참고만 가능 — 통합 금지 | 높음 — 새 채점 공식 + 데이터 파이프라인 | **매우 높음** — Engine Score와 명칭/목적 혼동 | PHASE D | DEFER — Engine Score 안정화 후 차별화 설계 필요 |
| 3.3 AI Bottleneck Bucket Map | `AIInfrastructureRadarPlaceholder` 이미 5테마 정의, `bucketMapping.ts` 4-bucket 구조 존재 | **aiInfrastructureRadar.ts 직접 확장** | 낮음 — 테마 추가 + JSON config | 낮음 | C-3 AFTER STABILIZATION | **ADOPT** — Placeholder → 실데이터 연결 |
| 3.4 Bucket Relative Strength Panel | `BucketRSChart.tsx`, `aiInfrastructureMomentum.ts` 이미 존재 | **거의 그대로 재사용** | 낮음 — basket 범위 확장 + API 파라미터 | 낮음 | C-3 AFTER STABILIZATION | **ADOPT** — `/api/ai-infra/theme-momentum` 확장 |
| 3.5 Bottleneck RRG | `CustomRRGChart.tsx` + `rrgPathData.ts` 직접 재사용 가능, Basket RRG 로직 추가 필요 | **CustomRRGChart 재사용** | 중간 — basket index 계산 (시계열 집계) | 낮음 — 역할 분리 명확 (SOXX RRG vs Bottleneck RRG) | C-3 AFTER STABILIZATION | **ADOPT** — Phase D-3 |
| 3.6 Overheat / Crowding Score | 기존 Risk Engine MSS와 유사, `BucketPerfChart` 데이터와 겹침 | RSI/MA distance는 ohlcv_daily로 즉시 계산 | 낮음 — 가격 기반 MVP | 중간 — Risk Engine과 별도 레이어임을 명확히 해야 함 | C-3 AFTER STABILIZATION | ADOPT — State Label과 묶어서 단순 버전 |
| 3.7 Earnings Confirmation Layer | 현재 뉴스 스코어링 엔진 존재하나 earnings call 파싱 없음, FMP 데이터 부분적 | 뉴스 레이어 일부 참고 | **높음** — LLM 추출, FMP 연동, 수주/가이던스 파싱 | 낮음 (별개 레이어) | PHASE D | DEFER — MVP 이후 |
| 3.8 Theme Purity Score | 수동 JSON config로 부분 구현 가능, `aiInfrastructureManualData.ts` 존재 | `aiInfrastructureManualData.ts` 확장 | 낮음 (수동) → 높음 (자동화) | 낮음 | PHASE D | DEFER — 수동 config 먼저, LLM 자동화는 Phase E |
| 3.9 Bottleneck State Label | Market Path regime label과 개념 유사, `engineScore.ts` CycleState와 구분 필요 | `explanationEngine.ts` 패턴 재사용 | 낮음 — rule-based switch | 중간 — CycleState와 혼동 방지 필요 | C-3 AFTER STABILIZATION | **ADOPT** — Bucket Map과 함께 묶어서 |
| 3.10 Bottleneck Narrative Box | `explanationEngine.ts` 이미 rule-based 해석 생성 구조 존재 | **직접 확장** | 낮음 — 새 버킷 규칙 추가 | 낮음 | C-3 AFTER STABILIZATION | MERGE INTO EXISTING (`explanationEngine.ts` 확장) |

---

## 4. Recommended Integration Architecture

**기존 Shell 유지, Placeholder → 실데이터로 전환:**

```
SemiconductorIntelligenceShell
 ├─ Tab 1: Semiconductor Lens (TerminalXDashboard — 현재 위치)
 │   ├─ ENGINE tab (SOXX Cycle, Signal Quality, RRG, Flow Proxy)
 │   ├─ DATA LAB tab
 │   └─ (기타 탭)
 └─ Tab 2: AI Bottleneck Radar (AIInfrastructureRadarPlaceholder → 실구현)
     ├─ Value Chain Ladder (상단 — 5→13 버킷 시각화)
     ├─ Bucket RS Panel (vs SOXX/QQQ/SPY, 1M/3M/6M)
     ├─ Bottleneck RRG (CustomRRGChart 재사용)
     ├─ Overheat / State Label (버킷별)
     └─ Narrative Box (explanationEngine 확장)
```

MAP 탭 내부 흡수는 **권장하지 않는다.** MAP 탭은 SOXX 4-bucket 내부 구조 분석이고, Bottleneck Radar는 SOXX 외부 AI 인프라 테마까지 포함한다. 역할이 다르다.

독립 탭으로 두되, 기존 `AIInfrastructureRadarPlaceholder` 컴포넌트를 직접 실구현으로 교체한다.

---

## 5. MVP Scope (C-3 이후 Phase D-1~D-4)

**Must include (가격 기반 MVP):**
- Bucket Map: 13개 버킷 정의 (`aiInfrastructureRadar.ts` 확장), JSON config 관리
- Bucket RS vs SOXX/QQQ/SPY: `/api/ai-infra/theme-momentum` 확장, ohlcv_daily 활용
- 1M/3M/6M Momentum: 이미 `aiInfrastructureMomentum.ts`에 구현됨 — 버킷 확장만
- Bucket Breadth: 버킷 내 상승 종목 비율 (ohlcv_daily 기반)
- Bottleneck State Label: rule-based, RS + Momentum + Overheat 조합
- Basic Overheat (RSI, 52W 거리): 가격 기반

**Must NOT include yet:**
- AI revenue % — FMP 수동 없이 자동화 불가
- Backlog / 수주 추적 — earnings call LLM 파싱 필요
- MOU vs 실계약 분류 — 뉴스 LLM 분류 필요
- BTI 공식 — Engine Score 안정화 후 별도 설계
- 새 전체 대시보드 — 기존 Radar tab 껍데기에 채워넣는 방식으로 충분

---

## 6. Data Availability Assessment

| Data Item | Available Now? | Source | Quality | Notes |
|---|---|---|---|---|
| Ticker OHLCV (1M/3M/6M return) | Yes | `ohlcv_daily` SQLite | High | `aiInfrastructureMomentum.ts` 이미 계산 |
| RS vs SOXX/QQQ/SPY | Yes | `ohlcv_daily` 계산 | High | Benchmark series 필요, 이미 수집 중 |
| Volume (5D/20D ratio) | Yes | `ohlcv_daily` | High | Flow proxy 스크립트에서 패턴 재사용 |
| RSI / MA distance (Overheat) | Yes | `ohlcv_daily` 계산 | High | 추가 스크립트 필요 |
| Bucket Breadth | Yes | `ohlcv_daily` 집계 | Medium | 버킷 종목 정의 필요 |
| Basket index series (RRG용) | Partial | `ohlcv_daily` + 가중 평균 | Medium | 집계 로직 추가 필요 |
| AI revenue % | No | FMP / 실적 LLM | Low | 수동 config로만 partial 가능 |
| Backlog / 수주 | No | 뉴스/실적 LLM | None | Phase D 이후 |
| Earnings surprise | Partial | FMP | Medium | 이미 일부 수집 여부 확인 필요 |
| Theme Purity | No | 수동 JSON | Manual | `aiInfrastructureManualData.ts` 패턴 |
| Korean tickers (한국 종목) | Partial | KIS API 별도 | Low | 한국 종목은 별도 수집 파이프라인 필요 |

---

## 7. Duplication / Collision Risks

| Risk | Affected Modules | Severity | Mitigation |
|---|---|---|---|
| BTI vs Engine Score | `engineScore.ts` `internal_signal` | **High** | BTI를 SOXX 외부 테마 전용으로 명확히 제한. SOXX 사이클과는 별도 채점 |
| Bottleneck RRG vs 기존 RRG | `AnalysisEngineCoreTab.tsx` RRG section | Medium | 대상 명확히: 기존 RRG = SOXX 4-bucket / Bottleneck RRG = AI Infra 테마 basket |
| Overheat Score vs MSS (Risk Engine) | `build_risk_v1.py` MSS | Medium | Overheat = 버킷/테마 단위. MSS = 전체 시장 구조. 명칭 충돌 방지 |
| Value Chain Ladder vs MAP tab | `AnalysisEngineCoreTab.tsx` MAP section | Medium | MAP = SOXX 내부. Ladder = 외부 밸류체인. 탭 분리로 충분 |
| State Label vs CycleState | `engineScore.ts` CycleState | Low | CycleState = SOXX 사이클 위치. Bottleneck State = 테마 자본 흐름 위치. 네이밍 구분 |
| C-3 진행 중 병행 개발 | 전체 Semiconductor Lens | **High** | C-3 완료 전 절대 본개발 금지 |

---

## 8. Final Recommendation

**→ Adopt after C-3, as direct expansion of existing AIInfrastructureRadarPlaceholder**

새 대시보드를 만들지 않는다. 기존 `AIInfrastructureRadarPlaceholder` 컴포넌트를 Phase D에서 실구현으로 교체하는 방식이 올바르다.

인프라는 이미 절반 이상 구축됐다. 데이터 연결과 버킷 범위 확장만 필요하다.

---

## Final Questions

**1. AI Bottleneck Radar는 독립 탭이 필요한가, 아니면 기존 MAP/RRG 탭에 흡수해야 하는가?**

독립 탭이 맞다. 다만 `SemiconductorIntelligenceShell`에 이미 두 번째 탭으로 자리가 예약돼 있다 (현재 Placeholder). 새 탭을 만들 필요 없이 그 자리를 채우면 된다.

MAP 탭 흡수는 부적절하다. MAP은 SOXX 내부 4-bucket 이고, Radar는 SOXX 외부 AI 인프라 테마를 다룬다. 역할이 다르다.

**2. 현재 C-3 완료 전 작업하면 위험한가?**

위험하다. C-3의 Engine / Data Lab 구조가 확정되기 전에 Bottleneck Radar를 붙이면 데이터 파이프라인 충돌과 DataStatusCounts 집계 중복이 발생할 수 있다. Signal Quality 레이어(C-5I)도 Radar 데이터를 참조하게 될 수 있는데, 이 의존성 방향이 C-3 이후에야 확정된다.

**3. 가격 기반 MVP는 현재 데이터 구조로 가능한가?**

가능하다. `ohlcv_daily` 테이블에 이미 AI Infra 테마 종목들이 포함돼 있고, `/api/ai-infra/theme-momentum`이 1M/3M/6M return을 이미 계산한다. RS vs SOXX/QQQ/SPY와 RSI 기반 Overheat는 같은 테이블로 계산 가능하다.

**4. 기존 Semiconductor Lens의 Engine Score와 BTI가 중복되는가?**

중복된다. Engine Score의 `internal_signal`은 SOXX 사이클 상태를 -100~+100으로 점수화한다. BTI도 결국 "버킷 강도 합산 → 점수" 구조다. 동일 사용자에게 두 점수를 보여주면 혼란을 야기한다.

해결책: BTI를 Engine Score의 "외부 확장 레이어"로 위치시켜라. BTI = SOXX 외부 AI 인프라 테마 전용 강도 지수, Engine Score = SOXX 사이클 내부 상태. 명칭과 설명에서 구분을 명확히 해야 한다.

**5. 가장 먼저 구현할 가치가 있는 최소 기능 3개는 무엇인가?**

1. **Bucket Map 확장** — 기존 5 placeholder 테마를 실데이터(최소 8~10개 버킷)로 연결. Cooling, PCB/Substrate, Test Equipment, Glass Substrate 추가. `/api/ai-infra/theme-momentum` 범위 확장.
2. **Bucket RS Panel** — 버킷별 vs SOXX/QQQ/SPY 1M/3M/6M 수익률. `BucketPerfChart` 패턴 재사용. 데이터는 이미 있다.
3. **Bottleneck State Label** — LEADING/EMERGING/CONFIRMING/CROWDED/LAGGING/STORY_ONLY. rule-based. RS + Momentum 기준. 코드 최소.

**6. 구현하지 말아야 할 기능은 무엇인가?**

- **BTI 독립 점수** — C-3 이후 Engine Score와 공존 가능성 설계가 완료된 후에만.
- **Earnings Confirmation Layer** — LLM 추출 없이는 신뢰도가 없다. MOU vs 실계약 구분은 현재 데이터로 불가.
- **Theme Purity Score 자동화** — 수동 JSON config로 시작하되, LLM 자동화는 Phase E 이후.
- **한국 종목 통합** — KIS API 별도 수집 파이프라인이 안정화되기 전에는 추가 금지.

**7. C-3 이후 Phase D로 넘긴다면 작업 순서는 어떻게 되는가?**

```
Phase D-1: Bucket Map 확장 (2~3일)
  - aiInfrastructureRadar.ts: 5 → 12개 테마 추가 (Cooling, PCB, Glass, Test, Optical, Power, Cleanroom, Gas, DC Infra)
  - aiInfrastructureManualData.ts: 버킷별 대표 종목 매핑
  - dataStatus: 'placeholder' → 'partial' / 'live' 전환

Phase D-2: Bucket RS + Momentum Panel (2~3일)
  - /api/ai-infra/theme-momentum 확장 (기존 코드 거의 재사용)
  - BucketRSChart 버킷 범위 확장

Phase D-3: Bottleneck RRG (3~4일)
  - basket index 시계열 계산 스크립트 추가
  - CustomRRGChart 재사용, 데이터 어댑터만 추가

Phase D-4: Overheat Score + State Label (1~2일)
  - RSI, MA distance 계산 스크립트
  - rule-based State Label 함수 (explanationEngine 확장)

Phase D-5: Narrative Box (1일)
  - explanationEngine.ts 버킷별 템플릿 추가

Phase E (별도): Earnings Confirmation, Theme Purity 자동화
  - FMP 연동 안정화 후
  - LLM 뉴스/실적 파싱 후
```

총 Phase D MVP 예상: 10~15일 (C-3 완료 후)

---

*이 문서는 평가 보고서다. 구현 지시서가 아니다.*
*C-3 완료 전 AI Bottleneck Radar 본개발을 시작하지 말 것.*
