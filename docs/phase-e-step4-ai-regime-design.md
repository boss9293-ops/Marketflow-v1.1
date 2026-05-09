# Phase E Step 4 — AI Regime 기준 재정의 설계
**Date:** 2026-04-29 | **Type:** Architecture Design

---

## 1. 설계 목적

현재 엔진은 Breadth, Momentum, MAP, Correlation, AI Concentration의 5개 신호를 사용한다.
이 신호들은 전통적 반도체 사이클을 잘 설명하지만, **AI 인프라 주도 구조**를 정밀하게 분해하지 못한다.

AI Regime Lens는 버킷별 상대 강도를 분석하는 새로운 해석 레이어다.

목적:
```
현재 구조(Breadth/Momentum 등) → 버킷별 AI 레짐 분해 → Interpretation에 Regime Context 추가
```

---

## 2. 현재 엔진 구조 (기준점)

### 도메인 레이어 (DomainKey)
```
price_trend | leadership | breadth | momentum | macro | fundamentals | ai_infra
```

### 버킷 구조 (SUB_BUCKET_MAP)
```
compute:   NVDA, AMD, AVGO
memory:    MU
foundry:   TSM
equipment: ASML, AMAT, LRCX, KLAC
benchmark: SOXX, QQQ
```

### 현재 ConflictTypeV2
```
AI_DISTORTION | AI_INFRA_SUSTAINABILITY_RISK | BREADTH_DIVERGENCE |
SECTOR_ROTATION | MOMENTUM_DIVERGENCE | MACRO_OVERRIDE | VALUATION_STRETCH
```

### 현재 EngineOutput (해석 레이어 입력)
```ts
{
  breadth:          'strong' | 'neutral' | 'weak'
  momentum:         'strong' | 'neutral' | 'weak'
  correlation:      'rising' | 'stable' | 'falling'
  map:              'strong' | 'neutral' | 'weak'
  ai_concentration: 'high' | 'medium' | 'low'
  cycle_stage:      'expansion' | 'peak' | 'downturn' | 'early'
  conflict_mode:    'none' | 'mild' | 'strong'
  confidence:       'high' | 'medium' | 'low'
}
```

**문제점**: AI Infra vs Memory vs Foundry vs Equipment의 개별 상태를 알 수 없다.
AI_DISTORTION 충돌 신호만으로는 어느 버킷이 주도하고 어느 버킷이 확인하지 않는지 구분 불가.

---

## 3. AI Regime Lens — 5개 컴포넌트 정의

### 컴포넌트 1: AI Infrastructure Leadership

```
신호 목적: AI 인프라 버킷이 SOXX 대비 초과 수익을 창출하는지 여부
소스 티커: NVDA, AMD, AVGO (compute 버킷)
계산 방식: avg(NVDA.r20d, AMD.r20d, AVGO.r20d) − SOXX.r20d
```

| 스프레드 | 상태 | 레이블 |
|---------|------|--------|
| > +5pp | 초과 주도 | `LEADING` |
| −2pp ~ +5pp | 벤치마크 추종 | `IN_LINE` |
| < −2pp | 상대 부진 | `LAGGING` |

해석:
- LEADING: AI 인프라가 반도체 사이클을 주도하는 확장 국면
- IN_LINE: AI 인프라가 지수와 함께 움직이는 중립적 구조
- LAGGING: AI 인프라 주도력 소멸 또는 로테이션 발생

---

### 컴포넌트 2: HBM / Memory Confirmation

```
신호 목적: 메모리 버킷이 AI 수요를 확인하는지 여부
소스 티커: MU (memory 버킷) + Samsung/SK Hynix (tier2)
계산 방식: MU.r20d − SOXX.r20d + tier2 방향성 보정
```

| 기준 | 상태 | 레이블 |
|------|------|--------|
| MU 스프레드 > +3pp + tier2 POSITIVE | 수요 확인됨 | `CONFIRMED` |
| MU 스프레드 ≥ 0 OR tier2 POSITIVE | 부분 확인 | `PARTIAL` |
| MU 스프레드 < 0 AND tier2 FLAT/NEG | 확인 안됨 | `NOT_CONFIRMED` |
| MU 스프레드 < −5pp | 수요 약세 | `WEAK` |

해석:
- HBM 수요 확인은 AI 구조 지속성의 핵심 조건이다.
- Memory 미확인 상태에서 compute 주도 지속 → AI_DISTORTION 충돌 심화

---

### 컴포넌트 3: Foundry / Packaging Support

```
신호 목적: 파운드리 버킷이 AI 수요 흐름을 지원하는지 여부
소스 티커: TSM (foundry 버킷)
계산 방식: TSM.r20d − SOXX.r20d
```

| 스프레드 | 상태 | 레이블 |
|---------|------|--------|
| > +3pp | 구조 지지 | `SUPPORTING` |
| −3pp ~ +3pp | 중립 | `NEUTRAL` |
| < −3pp | 지지 없음 | `LAGGING` |

해석:
- TSM은 AI 칩 생산 허브 — TSM 지지는 구조적 확장의 물적 기반 확인
- TSM 부진 + compute 주도 → 공급 병목 또는 생산 지연 신호

---

### 컴포넌트 4: Equipment Follow-through

```
신호 목적: 장비 버킷이 capex 사이클 확장을 따르는지 여부
소스 티커: ASML, AMAT, LRCX, KLAC (equipment 버킷)
계산 방식: avg(equipment 버킷 r20d) − SOXX.r20d
```

| 스프레드 | 상태 | 레이블 |
|---------|------|--------|
| > +3pp | 선행 — capex 사이클 선행 | `LEADING` |
| −2pp ~ +3pp | 추종 | `IN_LINE` |
| < −2pp AND compute LEADING | AI 투자 지연 신호 | `LAGGING_AI_DELAY` |
| < −2pp AND compute NOT LEADING | 사이클 위축 신호 | `LAGGING_CYCLE` |

해석 핵심:
```
장비 버킷 부진 ≠ 사이클 종료 (AI 시대)
장비 부진 + compute 주도 = AI 투자 지연 → "Equipment 이후에 따라올 것"으로 해석
장비 부진 + compute 부진 = 전통적 위축 사이클
```

이 구분은 기존 엔진의 단순 EquipmentState와 달리 **AI 레짐 맥락**을 추가한다.

---

### 컴포넌트 5: Narrowing / Rotation Risk

```
신호 목적: 참여 폭이 좁아지고 있는지, 로테이션이 발생하는지 평가
계산 방식: compute 스프레드 vs (memory + foundry + equipment) 스프레드 비교
```

| 조건 | 상태 | 레이블 |
|------|------|--------|
| compute > +10pp AND others < −2pp | 집중 위험 | `NARROW` |
| compute > +5pp AND others < 0 | 좁아지는 중 | `NARROWING` |
| equipment > +3pp AND compute < 0 | 로테이션 발생 | `ROTATING` |
| all buckets within ±3pp | 광범위 참여 | `BROAD` |

해석:
- NARROW: AI 인프라 집중도 최고 — 구조적 취약성 경고
- NARROWING: 주도력 집중 진행 중 — Confirmation 필요
- ROTATING: 장비/파운드리로 로테이션 — AI 사이클 후기 또는 반도체 회복 구조
- BROAD: 모든 버킷 참여 — 가장 건전한 확장 구조

---

## 4. AI Regime Label — 통합 레짐 분류

5개 컴포넌트를 종합하여 단일 레짐 레이블을 출력한다.

```ts
type AIRegimeLabel =
  | 'AI_LED_BROAD'     // AI 주도 + 모든 버킷 확인 → 최적 확장 구조
  | 'AI_LED_NARROW'    // AI 주도 + 집중 + 메모리/장비 미확인 → 취약한 확장
  | 'ROTATING'         // 장비/파운드리 주도, compute 후퇴 → 로테이션 국면
  | 'BROAD_RECOVERY'   // 전 버킷 회복, AI 집중 없음 → 초기 회복 구조
  | 'CONTRACTION'      // 전 버킷 하락 → 광범위 위축
```

레짐 결정 로직:
```
AI_LED_BROAD    = compute LEADING + memory CONFIRMED + foundry SUPPORTING + rotation BROAD
AI_LED_NARROW   = compute LEADING + (memory NOT_CONFIRMED OR rotation NARROW/NARROWING)
ROTATING        = equipment/foundry LEADING + compute LAGGING
BROAD_RECOVERY  = all IN_LINE/RECOVERING + rotation BROAD + cycle early
CONTRACTION     = compute LAGGING + memory WEAK + foundry LAGGING
```

---

## 5. 새로운 타입 정의

### `AIRegimeComponentState`
```ts
type AIRegimeComponentState = {
  state:   string       // 컴포넌트별 상태 레이블
  signal:  number       // -100 ~ +100 (스프레드 기반 정규화)
  spread:  number       // 원시 스프레드 (pp 단위)
  note:    string       // 1문장 구조 설명 (forbidden word 없음)
  sources: string[]     // 계산에 사용된 티커 목록
}

type AIRegimeLens = {
  ai_infra:      AIRegimeComponentState  // AI Infrastructure Leadership
  memory:        AIRegimeComponentState  // HBM / Memory Confirmation
  foundry:       AIRegimeComponentState  // Foundry / Packaging Support
  equipment:     AIRegimeComponentState  // Equipment Follow-through
  rotation_risk: AIRegimeComponentState  // Narrowing / Rotation Risk
  regime_label:  AIRegimeLabel
  regime_confidence: 'high' | 'medium' | 'low'
  data_mode:     'live' | 'partial' | 'fallback'
}
```

### `EngineOutput` 확장 (interpretationEngine.ts)
```ts
type EngineOutput = {
  // 기존 필드 유지
  breadth, momentum, correlation, map, ai_concentration,
  cycle_stage, conflict_mode, confidence, data_quality, historical_analog,
  // NEW
  ai_regime?: AIRegimeLens
}
```

### `InterpretationOutput` 확장
```ts
type InterpretationOutput = {
  // 기존 필드 유지
  summary, alignment, support[], weakness[], interpretation, context?, confidence,
  // NEW
  regime_context?: string   // AI Regime Lens 요약 1문장
}
```

---

## 6. 계산 파이프라인 설계

### 새 파일: `lib/semiconductor/aiRegimeLens.ts`

```ts
import { MarketDataInput } from './types'

// 입력: MarketDataInput (semiconductor_market_data.json 구조)
// 출력: AIRegimeLens
export function computeAIRegimeLens(raw: MarketDataInput): AIRegimeLens
```

내부 단계:
```
1. bucketSpread() — 각 버킷의 SOXX 대비 r20d 스프레드 계산
2. computeAIInfra() — compute 버킷 → AI Infra Leadership 상태
3. computeMemory() — MU + tier2 → Memory Confirmation 상태
4. computeFoundry() — TSM → Foundry Support 상태
5. computeEquipment() — 장비 4개 → Equipment Follow-through 상태 (AI 맥락 포함)
6. computeRotationRisk() — 5개 스프레드 조합 → Narrowing/Rotation 평가
7. detectRegimeLabel() — 5개 컴포넌트 → 통합 레짐 레이블
8. computeRegimeConfidence() — 데이터 품질 + 신호 일관성
```

---

## 7. 라우트 통합 계획

### `/api/interpretation/route.ts`

```ts
// 현재: raw → metrics → domains → engine → interpretation → response
// 변경: raw → metrics → domains → engine → aiRegime → interpretation → response

import { computeAIRegimeLens } from '@/lib/semiconductor/aiRegimeLens'

const aiRegime = computeAIRegimeLens(raw)

const engineInput: EngineOutput = {
  ...기존 필드,
  ai_regime: aiRegime,
}

return NextResponse.json({
  ...interpretation,
  ai_regime: aiRegime,
  _meta: { ... }
})
```

### `/api/translation/route.ts`

동일 패턴으로 `ai_regime`을 response에 포함.
SOXL 번역 시 `ai_regime.regime_label`을 활용하여 더 정밀한 amplification 설명 가능.

---

## 8. Interpretation Layer 확장

`interpretationEngine.ts`의 `translateEngineOutput()` 함수에 `regime_context` 생성 로직 추가:

```ts
// AI Regime → Interpretation 언어 맵
const REGIME_CONTEXT_MAP: Record<AIRegimeLabel, string> = {
  AI_LED_BROAD:   'AI infrastructure leadership is confirmed across multiple semiconductor segments, with broad participation supporting the structural advance.',
  AI_LED_NARROW:  'AI infrastructure leadership is sustained but concentrated — memory and equipment confirmation remains incomplete, limiting structural durability.',
  ROTATING:       'Structure is rotating from AI infrastructure toward equipment and foundry segments, consistent with a later-phase semiconductor cycle.',
  BROAD_RECOVERY: 'Participation is broad across all semiconductor segments with no dominant concentration, consistent with an early recovery structure.',
  CONTRACTION:    'Structural weakness is confirmed across all semiconductor segments — no bucket is providing offsetting support.',
}
```

---

## 9. UI 통합 계획

### TerminalXDashboard.tsx — AI Regime Panel

현재 AI Concentration 패널을 확장하여 5개 컴포넌트를 표시하는 AI Regime Panel로 교체.

레이아웃:
```
┌─ AI Regime Lens ──────────────────────────────────────────┐
│ Regime: AI_LED_NARROW (yellow)    Confidence: Medium       │
│                                                            │
│ AI Infra    ████████  LEADING  +8.2pp                      │
│ Memory      ████░░░░  PARTIAL  +1.1pp (MU)                 │
│ Foundry     ███░░░░░  NEUTRAL  -0.8pp (TSM)                │
│ Equipment   ██░░░░░░  LAGGING  -3.2pp (AI DELAY)           │
│ Rotation    ●●○○○○○○  NARROWING                            │
│                                                            │
│ Regime Context:                                            │
│ AI infrastructure leadership is sustained but              │
│ concentrated — memory and equipment confirmation           │
│ remains incomplete.                                        │
└────────────────────────────────────────────────────────────┘
```

---

## 10. Playback 연동 계획

### AI Regime Playback

`replay/2022_tightening.json`, `replay/2020_covid.json`의 일별 스냅샷에서 `regime`, `state`, `mss`를 읽어 AI Regime 레이블을 역산한다.

매핑:
```
regime=Expansion + state=Normal → BROAD_RECOVERY 또는 AI_LED_BROAD (시기에 따라)
regime=Liquidity Crisis + state=Warning → CONTRACTION
```

단, 2022/2020 리플레이 데이터에는 버킷별 스프레드가 없으므로:
- Timeline만 실데이터 사용
- AI Regime 컴포넌트 상태는 fallback 사용 (정적)

### Legacy Stress Reference (기존 3개 시나리오)

`contraction_2022` → `CONTRACTION` 레짐 레이블로 레이블링
`recovery_2020` → `BROAD_RECOVERY` 레짐 레이블로 레이블링
`ai_expansion_2024` → `AI_LED_NARROW` 레짐 레이블로 레이블링 (역사적 근거)

---

## 11. 구현 단계 (Phase E Step 5-7)

### Phase E Step 5 — AI Regime Lens 컴퓨터 구현

대상 파일 (신규):
```bash
lib/semiconductor/aiRegimeLens.ts
```

대상 파일 (수정):
```bash
lib/semiconductor/interpretationEngine.ts   # ai_regime 필드 추가
app/api/interpretation/route.ts             # aiRegime 계산 + 응답 포함
```

성공 기준:
- TypeScript compile clean
- SOXX 데이터에서 5개 컴포넌트 정상 계산
- regime_label 정상 출력
- 기존 interpretation API 응답 형식 유지

---

### Phase E Step 6 — AI Regime Playback Adapter

대상 파일 (수정):
```bash
app/api/playback/route.ts   # 각 기간에 regime_label 추가
```

성공 기준:
- 3개 기간에 regime_label 정상 표시
- Phase E2-B 타임라인 어댑터와 함께 동작
- TypeScript compile clean

---

### Phase E Step 7 — AI Regime Interpretation Tuning

대상 파일 (수정):
```bash
lib/semiconductor/interpretationEngine.ts   # regime_context 생성 로직 추가
components/semiconductor/TerminalXDashboard.tsx  # AI Regime Panel UI 구현
components/semiconductor/SoxxSoxlTranslationTab.tsx  # regime 기반 amplification 개선
```

성공 기준:
- 우측 패널에 regime_context 표시
- ENGINE 탭에 AI Regime Panel 표시
- Tab 2 SOXL 번역에 regime 기반 sensitivity 개선
- 금지어 스캔 통과
- TypeScript compile clean

---

## 12. Forbidden Language 규칙 (AI Regime 텍스트)

AI Regime 컴포넌트 note 필드 및 regime_context는 이 언어를 사용한다:

사용 가능:
```
"AI infrastructure leadership is sustained..."
"Memory confirmation remains incomplete..."
"Structure is rotating toward equipment segments..."
"Participation is broad across all semiconductor segments..."
"Narrowing participation limits structural durability..."
```

금지:
```
buy / sell / entry / exit / target / forecast / predict / expected / will
상승 / 하락 / 매수 / 매도
```

---

## 13. 우선순위 결정 기준

| 항목 | 우선순위 | 근거 |
|------|---------|------|
| `aiRegimeLens.ts` 신규 작성 | 높음 | 모든 다운스트림 의존 |
| `/api/interpretation` 통합 | 높음 | UI 데이터 소스 |
| `regime_context` 해석 텍스트 | 높음 | 사용자 가치 직접 |
| AI Regime Panel UI | 중간 | 엔진 완성 후 진행 |
| Playback regime 레이블 | 낮음 | Phase E Step 6 |
| SOXL translation 개선 | 낮음 | Phase E Step 6 |

---

## 14. 완료 기준

```
✅ 5개 컴포넌트 정의 확정
✅ AIRegimeLens 타입 정의 완성
✅ 레짐 레이블 5종 정의 완성
✅ 계산 파이프라인 설계 완성
✅ 라우트 통합 계획 확정
✅ Interpretation 확장 계획 확정
✅ UI 패널 레이아웃 확정
✅ Playback 연동 계획 확정
✅ Phase E Step 5-7 범위 확정
```

---

## 15. 다음 단계

**Phase E Step 5 — AI Regime Lens 컴퓨터 구현**

구현 대상:
1. `lib/semiconductor/aiRegimeLens.ts` — 신규 생성
2. `interpretationEngine.ts` — `ai_regime?` 필드 추가
3. `/api/interpretation/route.ts` — `computeAIRegimeLens()` 연결
