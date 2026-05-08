# AI Bottleneck Radar — Phase D Implementation Plan

작성일: 2026-05-08  
전제: C-3 완료 전 본개발 금지. 이 문서는 준비 계획이다.

---

## 1. Current Inventory

C-3 이전 현재 상태 전수 조사. 모든 항목은 실재하는 파일이다.

| File / Route | Current Role | Real Data? | Placeholder? | Reusable for Phase D? |
|---|---|---|---|---|
| `components/semiconductor/AIInfrastructureRadarPlaceholder.tsx` (573 lines) | Shell UI — 5개 테마 카드 렌더링, 모멘텀 fetch, 뉴스/워치리스트 표시 | Partial (momentum API hit) | **Yes — UI skeleton** | Yes — 실구현 컴포넌트로 교체, 탭 라우팅은 그대로 유지 |
| `lib/semiconductor/aiInfrastructureRadar.ts` (200 lines) | 5개 테마 정의 (`data_center_power`, `cooling`, `grid_electrical_equipment`, `cloud_capex`, `nuclear_smr`), `AIInfrastructureTheme` 타입, SOXX link 분류 | No — 모두 `dataStatus: 'placeholder'` | **Yes** | Yes — 테마 추가 + `dataStatus` 전환 |
| `lib/semiconductor/aiInfrastructureMomentum.ts` (160 lines) | basket 단위 1D/5D/1M return 계산, `AIInfraThemeMomentum` 타입 | Partial — `ohlcv_daily` 기반이지만 3개 기간만 (`1D/5D/1M`) | Partial | Yes — 3M/6M period 추가 필요 |
| `lib/semiconductor/aiInfrastructureMomentumAdapter.ts` | API fetch wrapper `loadAIInfraThemeMomentum()` | Partial | Partial | Yes — 그대로 재사용 |
| `lib/semiconductor/aiInfrastructureManualData.ts` | 테마별 워치리스트 종목 수동 정의, 뉴스 링크 | No (수동) | Yes | Yes — 버킷 종목 매핑 확장 기반 |
| `lib/semiconductor/aiInfrastructureScorePolicy.ts` | `dataStatus` 단계별 점수 표시 정책 (hidden / qualitative_only / numeric_allowed) | N/A | N/A | Yes — 그대로 재사용 |
| `lib/semiconductor/aiInfrastructureCapex.ts` | Hyperscaler CapEx 데이터 계약 | Manual | Yes | Yes — Cloud CapEx 버킷 데이터 소스로 |
| `lib/semiconductor/aiInfrastructureNews.ts` | 뉴스 fetch 헬퍼 | Partial | Partial | Yes — Narrative Box 레이어용 |
| `app/api/ai-infra/theme-momentum/route.ts` (227 lines) | SQLite `ohlcv_daily`에서 테마별 basket return 계산 API. 현재 5개 테마 × 3개 기간 | **Yes — 실계산** | No | **Yes — 버킷 범위 확장만 필요** |
| `components/semiconductor/SemiconductorIntelligenceShell.tsx` | Tab 라우터: `'lens'` → `TerminalXDashboard`, `'radar'` → `AIInfrastructureRadarPlaceholder` | N/A | N/A | **Yes — 탭 구조 그대로 유지, 내부 컴포넌트만 교체** |
| `components/semiconductor/CustomRRGChart.tsx` | RRG 궤적 차트, basket 데이터 지원 | Yes | No | **Yes — Bottleneck RRG에 직접 재사용** |
| `lib/semiconductor/bucketMapping.ts` | SOXX 내부 4-bucket 매핑 (ai_compute / memory / equipment / foundry_packaging) | Yes | No | Partial — 상위 4개 버킷과 일치. Bottleneck 버킷은 별도 config |
| `config/semiconductor_buckets.json` | SOXX 4-bucket 종목 + 가중치 정의 | Yes | No | Partial — Bottleneck 버킷은 별도 JSON 필요 |
| `components/semiconductor/BucketRSChart.tsx` | SOXX 4-bucket RS 차트 | Yes | No | Yes — Bottleneck RS Panel 기반 |
| `components/semiconductor/BucketPerfChart.tsx` | SOXX 4-bucket 성과 차트 | Yes | No | Yes — Bottleneck Perf Panel 기반 |
| `lib/semiconductor/explanationEngine.ts` | rule-based 해석 문구 생성 | Yes | No | Yes — Bottleneck Narrative Box 템플릿 추가 |
| `lib/semiconductor/signalQuality.ts` | 6-component Signal Quality Score (C-5I 신규) | Yes | No | Partial — `Data Trust` 컴포넌트 로직 참고 |

---

## 2. Phase D Roadmap

C-3 완료 확인 후 순서대로 진행. 각 단계는 이전 단계 완료 후 시작.

| Phase | Feature | Action | Input | Output | Estimated Effort |
|---|---|---|---|---|---|
| **D-1** | Bucket Map 확장 | 5 → 13 AI Infra 버킷 정의 | `aiInfrastructureRadar.ts` 확장, 새 JSON config | 13개 버킷 타입 + 종목 매핑 | 2~3일 |
| **D-2** | Bucket RS Panel | SOXX/QQQ/SPY 대비 RS + 1M/3M/6M 수익률 | `ohlcv_daily` + theme-momentum API 확장 | Bucket RS 패널 컴포넌트 | 2~3일 |
| **D-3** | Bottleneck RRG | 버킷별 basket index RRG 궤적 | `CustomRRGChart` 재사용 + basket 집계 스크립트 | Bottleneck RRG 뷰 | 3~4일 |
| **D-4** | State Label + Overheat | LEADING/EMERGING/CROWDED 등 rule-based 레이블 + 기본 과열 점수 | RS + Momentum + RSI | State Label 컴포넌트 | 1~2일 |
| **D-5** | Placeholder 교체 | `AIInfrastructureRadarPlaceholder` → 실구현 `AIInfrastructureRadar` | D-1~D-4 완료 결과 | 실동작 Radar 탭 | 1일 |

### Phase D-1 상세: 13개 버킷 정의

현재 5개 테마에서 아래 8개 추가:

```
기존 (유지):
  data_center_power    → 'Power Demand'
  grid_electrical      → 'Power Infrastructure'
  cooling              → 'Data Center Infrastructure'
  cloud_capex          → 'AI Demand Signal'
  nuclear_smr          → 'Long-Term Power Supply'

신규 추가:
  pcb_substrate        → 'Advanced Packaging'
  glass_substrate      → 'Advanced Packaging'
  optical_networking   → 'AI Network Infrastructure'
  test_equipment       → 'Semiconductor Equipment'
  specialty_gas        → 'Semiconductor Materials'
  cleanroom_water      → 'Semiconductor Materials'
  dc_infra_reit        → 'Data Center Infrastructure'
  raw_materials        → 'Upstream Materials'
```

각 버킷에 필요한 필드:
```typescript
{
  id: string                          // snake_case
  name: string                        // display name
  category: string                    // bucket category
  soxxLinkType: 'direct' | 'indirect' | 'outside'
  relatedSoxxBuckets: RelatedSoxxBucket[]
  representativeTickers: string[]     // ohlcv_daily에 있는 종목
  koreanTickers?: string[]            // KIS 별도 수집 (Phase E)
  dataStatus: AIInfrastructureDataStatus
  whyItMatters: string
  risk: string
}
```

### Phase D-2 상세: Bucket RS Panel

`/api/ai-infra/theme-momentum` 확장 포인트:
- 현재: 1D / 5D / 1M (3개 기간)
- 추가: 3M / 6M (2개 기간 추가)
- 추가: `vsSOXX` / `vsQQQ` / `vsSPY` 상대 수익률 필드

계산 방식: `ohlcv_daily`의 `SOXX`, `QQQ`, `SPY` 시계열이 이미 존재함 — 분모로 사용.

### Phase D-3 상세: Bottleneck RRG

필요한 신규 계산:
- 버킷별 basket index 시계열 (가중 평균 close → 주간 return → RS ratio)
- Python 스크립트: `build_bottleneck_rrg.py` (참조: `build_semiconductor_flow_proxy.py` 패턴)
- 출력: `backend/output/cache/bottleneck_rrg_latest.json`
- API: `/api/bottleneck-rrg` → `CustomRRGChart` 에 연결

`CustomRRGChart`는 basket 입력을 이미 지원한다 — 어댑터만 추가.

### Phase D-4 상세: State Label 규칙

```
LEADING       → RS vs SOXX > +5%, 1M momentum > +3%, overheat < 0.7
EMERGING      → RS improving (3M trend positive), 1M > 0%
CONFIRMING    → RS vs SOXX > 0%, breadth > 55%, momentum positive
CROWDED       → overheat > 0.85 (RSI > 75 또는 60D return > 40%)
LAGGING       → RS vs SOXX < -5%, 1M momentum < -2%
STORY_ONLY    → dataStatus = 'placeholder' 또는 대표 종목 없음
DISTRIBUTION  → RS declining, volume ratio > 1.3 but return < 0
DATA_INSUFFICIENT → available ticker count < 2
```

---

## 3. Do Not Build Yet (Deferred List)

아래 기능은 Phase D에서 구현하지 않는다. 이유를 명시한다.

| Deferred Feature | Reason | When |
|---|---|---|
| **BTI 독립 점수** | `engineScore.ts` `internal_signal`과 개념 중복. C-3 Engine Score 안정화 전에 분리 설계 불가. 사용자에게 두 점수 동시 표시 시 혼란 | C-3 이후 설계 재검토 |
| **Earnings Confirmation Layer** | FMP earnings 파싱 부분적. AI revenue % 자동 추출은 LLM 필요. 현재 신뢰도 없음 | Phase E (LLM 안정화 후) |
| **Theme Purity Score 자동화** | LLM 기반 분류 필요. 수동 JSON config로만 partial 가능 | Phase E |
| **MOU vs 실계약 분류** | 뉴스 LLM 파싱 필요. 현재 데이터 없음 | Phase E |
| **한국 종목 통합** | KIS API 별도 파이프라인 안정화 필요. 현재 수집 체계 미완 | 별도 KR Pipeline 완성 후 |
| **새 사이드바 라우트 추가** | `SemiconductorIntelligenceShell` 내부 탭으로 충분. 별도 `/ai-bottleneck` 라우트 불필요 | 영구 보류 (탭으로 운영) |
| **LLM 뉴스 추출** | 현재 뉴스 스코어링 엔진과 통합 비용 높음. Rule-based로 충분한지 먼저 검증 | Phase D 검증 후 결정 |

---

## 4. Integration Rule

### 탭 구조 유지 (변경 금지)

```
SemiconductorIntelligenceShell
 ├─ Tab: 'lens'  → TerminalXDashboard       (변경 금지)
 └─ Tab: 'radar' → AIInfrastructureRadarPlaceholder
                   ↓ Phase D-5 교체
                   → AIInfrastructureRadar  (실구현)
```

`SemiconductorIntelligenceShell.tsx`의 탭 라우팅 코드는 그대로 유지한다.
`activeTab === 'radar'` 조건의 렌더 대상 컴포넌트만 교체한다.

### 사이드바 라우트 금지

Phase D 전체 기간 동안 `/ai-bottleneck` 또는 유사한 독립 라우트를 Sidebar에 추가하지 않는다.
Radar는 Semiconductor Intelligence Shell 하위 탭으로만 접근 가능해야 한다.

### SOXX 4-bucket과 경계 유지

```
SOXX Lens (TerminalXDashboard)
  → MAP tab: SOXX 내부 4-bucket (ai_compute, memory, equipment, foundry_packaging)
  → ENGINE: SOXX 사이클 점수, Signal Quality

AI Bottleneck Radar (AIInfrastructureRadar)
  → 13-bucket: SOXX 외부 AI 인프라 테마 포함
  → Bucket RS vs SOXX: SOXX를 benchmark로 사용하되, SOXX 내부 분석과 다름
```

두 레이어는 SOXX를 공유 benchmark로 참조하지만, 분석 대상이 다르다. 코드 경계를 명확히 한다.

---

## 5. Data Rule

### Phase D MVP에서 허용하는 데이터 소스

```
✅ ohlcv_daily (SQLite)        — return 계산, RS, RSI, MA distance
✅ theme-momentum API          — 기존 basket return, 기간 확장 예정
✅ SOXX/QQQ/SPY 시계열         — benchmark 비교 (ohlcv_daily에 존재)
✅ 기존 volume 데이터          — overheat, breadth 계산
✅ aiInfrastructureManualData  — 수동 워치리스트 종목 정의
```

### Phase D에서 사용하지 않는 데이터 소스

```
❌ AI revenue %         — FMP 수동 없이 신뢰 불가
❌ backlog / 수주       — 파싱 체계 없음
❌ earnings call        — LLM 필요
❌ customer confirmation — 외부 소스 필요
❌ MOU 데이터           — 분류 불가
❌ 한국 KIS OHLCV       — 별도 파이프라인 미완성
```

### 데이터 신뢰도 표시 원칙

Phase D에서도 `aiInfrastructureScorePolicy.ts` 정책을 그대로 사용한다:
- `placeholder` → 점수 숨김, 레이블만 표시
- `partial` → qualitative only (State Label만 표시)
- `live` → 수치 점수 표시 허용

---

## 6. Final Deliverable

### 6-1. C-3 이후 수정할 파일

```
lib/semiconductor/aiInfrastructureRadar.ts
  → 5 → 13 버킷 테마 추가, dataStatus 전환

lib/semiconductor/aiInfrastructureMomentum.ts
  → AIInfraMomentumPeriod: '1D'|'5D'|'1M' → '1D'|'5D'|'1M'|'3M'|'6M'
  → vsSOXX / vsQQQ / vsSPY 필드 추가

lib/semiconductor/aiInfrastructureManualData.ts
  → 신규 버킷 종목 매핑 추가

app/api/ai-infra/theme-momentum/route.ts
  → 3M/6M 기간 계산 추가
  → benchmark RS 계산 추가

components/semiconductor/AIInfrastructureRadarPlaceholder.tsx
  → Phase D-5: AIInfrastructureRadar로 교체 (파일명 변경)

lib/semiconductor/explanationEngine.ts
  → Bottleneck 버킷별 Narrative 템플릿 추가
```

### 6-2. C-3 완료 전 절대 건드리지 않을 파일

```
components/semiconductor/TerminalXDashboard.tsx    — Lens 탭 핵심
components/semiconductor/AnalysisEngineCoreTab.tsx — ENGINE/DATA LAB 탭
components/semiconductor/SemiconductorIntelligenceShell.tsx — 탭 라우터 구조
lib/semiconductor/engineScore.ts                  — C-3 Engine 핵심
lib/semiconductor/sectorTailwind.ts               — Market Path 어댑터
lib/semiconductor/signalQuality.ts                — C-5I 결과물, 안정화 필요
lib/semiconductor/rrgPathData.ts                  — RRG 데이터 계약
backend/app.py                                    — 기존 API 라우트
config/semiconductor_buckets.json                 — SOXX 4-bucket 설정
```

### 6-3. 재사용 가능한 기존 코드 (수정 없이 사용 가능)

```
CustomRRGChart.tsx                 → Bottleneck RRG 렌더링
BucketRSChart.tsx                  → Bucket RS Panel 기반
BucketPerfChart.tsx                → Bucket 성과 기반
aiInfrastructureScorePolicy.ts     → 점수 표시 정책
aiInfrastructureMomentumAdapter.ts → API fetch 패턴
explanationEngine.ts               → Narrative 생성 패턴
signalQuality.ts → Data Trust      → 데이터 신뢰도 기준 참고
```

### 6-4. 신규 작성이 필요한 코드

```
config/ai_bottleneck_buckets.json              — 13-bucket 종목/가중치 정의
scripts/build_bottleneck_rrg.py                — basket index RRG 계산
app/api/bottleneck-rrg/route.ts                — Bottleneck RRG API
lib/semiconductor/bottleneckStateLabel.ts      — State Label rule-based 함수
lib/semiconductor/bottleneckOverheat.ts        — RSI/MA distance 기반 과열 점수
components/semiconductor/AIInfrastructureRadar.tsx — Placeholder 교체 실구현
```

### 6-5. Phase D-1 첫 번째 태스크

**파일:** `lib/semiconductor/aiInfrastructureRadar.ts`

**작업:** 신규 버킷 8개 추가 (`pcb_substrate`, `glass_substrate`, `optical_networking`, `test_equipment`, `specialty_gas`, `cleanroom_water`, `dc_infra_reit`, `raw_materials`), `dataStatus: 'placeholder'`로 시작.

**병행:** `lib/semiconductor/aiInfrastructureManualData.ts`에 각 버킷 대표 종목 추가 (`AVGO` PCB 노출, `CDNS` 등).

이 작업은 UI 변경 없이 type 확장만이므로 C-3에 영향을 주지 않는다. **단, C-3 완료 확인 후에만 시작한다.**

### 6-6. C-3 이전 시작 시 리스크

| Risk | Description | Impact |
|---|---|---|
| DataStatusCounts 충돌 | C-3이 Engine/DataLab에 `dataStatusCounts` 집계를 변경할 가능성 있음. Radar 버킷을 먼저 추가하면 집계 오염 | Signal Quality Data Trust 점수 오염 |
| API 라우트 충돌 | C-3이 `/api/semiconductor-*` 라우트 구조를 변경할 경우 Radar API 경로와 충돌 가능 | 빌드 실패 |
| 타입 계약 불안정 | C-3 기간 중 `NormalizedMetric`, `EngineOutputV2` 등 core type이 변경되면 Radar 타입도 재작성 필요 | 리팩터 비용 2배 |
| SemiconductorIntelligenceShell 변경 | C-3 중 Shell 구조 변경 시 탭 라우팅 교체 공수 발생 | 통합 충돌 |
| 테스트 혼란 | `__tests__/` 기존 테스트가 Radar 신규 타입으로 인해 실패할 수 있음 | CI 실패 |

---

## Summary Card

```
현재 상태:   인프라 55% 존재 (5 placeholder 테마, API 동작 중)
해야 할 일:  C-3 완료 확인 → D-1부터 순차 실행
금지:        C-3 이전 본개발 시작
첫 태스크:   aiInfrastructureRadar.ts 13-bucket 확장
MVP 범위:    Bucket Map + RS Panel + RRG + State Label
제외:        BTI, Earnings, LLM, 한국 종목, 독립 사이드바 라우트
```
