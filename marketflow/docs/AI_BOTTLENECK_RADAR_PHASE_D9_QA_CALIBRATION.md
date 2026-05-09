# AI Bottleneck Radar Phase D-9 QA & Calibration

작성일: 2026-05-08

---

## Purpose

D-1~D-8까지의 구현을 검증하고, Phase E 진입 전 프로덕트 준비 상태를 확인한다.
신규 기능 추가 없음. 마이너 수정 2건 포함.

---

## API Test Results

| 호출 | 예상 | 결과 |
|---|---|---|
| `/api/ai-infra/theme-momentum` | SOXX default | ✅ parseBenchmark('null') → 'SOXX' |
| `?benchmark=SOXX` | selected_benchmark='SOXX' | ✅ |
| `?benchmark=QQQ` | selected_benchmark='QQQ' | ✅ |
| `?benchmark=SPY` | selected_benchmark='SPY' | ✅ |
| `?benchmark=INVALID` | SOXX fallback | ✅ parseBenchmark 안전 fallback |
| `/api/ai-infra/bucket-rrg?benchmark=QQQ` | QQQ 캐시 읽기 | ✅ (캐시 파일 없으면 pending 응답) |

응답 구조:
- `buckets`: 13개 ✅
- `bucket_states`: 13개 ✅
- `benchmarks`: SOXX/QQQ/SPY 모두 존재 ✅
- `selected_benchmark`: D-7에서 추가 ✅
- `data_notes`: 최대 2개 inline 노트 (coverage/missing 정보) ✅

---

## Bucket Coverage Review

| Bucket | Symbols | Data Quality | Coverage 비고 |
|---|---|---|---|
| AI_CHIP | NVDA, AMD, AVGO, MRVL | REAL | 4/4 — 주의: NVDA 의존도 높음 |
| HBM_MEMORY | MU | PARTIAL | 1/1 — Samsung/SK Hynix 제외 (한국 상장) |
| PACKAGING | AMAT, KLAC, ACMR, TSM | REAL | 4/4 — AMAT/KLAC는 TEST_EQUIPMENT와 중복 |
| COOLING | VRT, ETN, TT, MOD, NVT | REAL | 5/5 — VRT/ETN은 POWER_INFRA와 중복 |
| PCB_SUBSTRATE | TTM, SANM, CLS, FLEX | PARTIAL | 4/4 — 한국 기판 제외, 순수 노출도 제한 |
| TEST_EQUIPMENT | TER, COHU, FORM, KLAC, ONTO | REAL | 5/5 — COHU/FORM 소형주 유동성 유의 |
| GLASS_SUBSTRATE | GLW, AMAT | PARTIAL | 2/2 — 상업화 불확실성 높음 |
| OPTICAL_NETWORK | ANET, CIEN, LITE, COHR, AVGO | REAL | 5/5 — AVGO는 AI_CHIP과 중복 |
| POWER_INFRA | ETN, PWR, HUBB, GEV, VRT, NVT | REAL | 6/6 — 광범위 산업 노출, AI 순수도 낮음 |
| CLEANROOM_WATER | ACMR, XYL, ECL, WTS | PARTIAL | 4/4 — AI/반도체 노출도 다양 |
| SPECIALTY_GAS | LIN, APD, ENTG, CCMP | REAL | 4/4 — LIN/APD는 분산 산업가스 |
| DATA_CENTER_INFRA | EQIX, DLR, IRM, VRT | REAL | 4/4 — REIT 금리 민감도 유의 |
| RAW_MATERIAL | FCX, SCCO, TECK, COPX | PARTIAL | COPX는 ETF — DB 미수록 가능성 있음 |

플래그된 이슈:
- **HBM_MEMORY**: 1개 종목만 (MU) — coverage 100%이지만 바스켓 대표성 제한
- **GLASS_SUBSTRATE**: 상업화 불확실성 고위험이지만 STORY_ONLY 규칙이 발동하지 않을 수 있음 (coverage 100%)
- **COPX**: ETF이므로 `ohlcv_daily`에 없을 경우 RAW_MATERIAL 3/4 = 75% 커버리지로 하락

---

## State Label Calibration

### 규칙 엔진 점검 (D-4 기준)

| 우선순위 | Rule | 조건 | 결과 |
|---|---|---|---|
| 1 | DATA_INSUFFICIENT | coverage < 50% 또는 RS 없음 | ✅ 올바름 |
| 2 | STORY_ONLY | PARTIAL + coverage < 75% + RS inconclusive | ✅ 올바름 |
| 3 | CROWDED | 과열 (3M +35% or 6M +60%) + RS 강함 | ✅ 올바름 |
| 4 | DISTRIBUTION | RRG Weakening + 1M 마이너스 + 과거 수익 양호 | ✅ 올바름 |
| 5 | LEADING | RRG Leading + RS 3M ≥ +5pp + 3M return > 0 | ✅ 올바름 |
| 6 | EMERGING | RRG Improving + RS improving + return 회복 | ✅ 올바름 |
| 7 | CONFIRMING | RS 3M > 0 + 3M return > 0 + RRG 무난 | ✅ 올바름 |
| 8 | LAGGING | 나머지 | ✅ 올바름 |

### 알려진 보정 이슈

1. **GLASS_SUBSTRATE 레이블 과강 위험**: `data_quality='PARTIAL'`이지만 coverage=100%이므로 STORY_ONLY 규칙 미발동. 상업화 불확실성이 높은 버킷이나 CONFIRMING/LEADING으로 분류될 수 있음.
   - 현황: `COMMERCIALIZATION_UNCERTAINTY` 리스크 플래그 타입은 정의되어 있으나 규칙 엔진에서 미사용.
   - 권장: Phase E에서 bucket metadata 기반 flag 추가.

2. **rankBuckets는 항상 SOXX 기준**: `aiInfraBucketRS.ts`의 `rankBuckets()`는 `vs_soxx` 3M으로 rank를 계산. QQQ/SPY 선택 시 RSTable 정렬 순서가 state label 기준과 다를 수 있음.
   - **Fix Applied (D-9)**: RSTable 정렬을 `rsOf()` (선택된 benchmark 기준 RS)로 변경. `rank.composite` 필드는 API 응답에 여전히 SOXX 기준으로 포함 — 이는 API 계약 변경 없이 허용.

3. **HBM_MEMORY**: 단일 종목(MU) — 수율이 높아 보이지만 실제 HBM 바스켓을 대표하지 못함. confidence=LOW 또는 MEDIUM이 적절.
   - 현황: coverage=1/1=100%, data_quality='PARTIAL' → STORY_ONLY 규칙 미발동.
   - 권장: D-9에서는 변경 없음. Phase E에서 symbol 다양성 위험 반영 고려.

---

## RRG / RS Alignment

| 케이스 | 기대 레이블 | 실제 규칙 | 정합성 |
|---|---|---|---|
| RS +5pp 이상 + RRG Leading | LEADING | 규칙 5 | ✅ |
| RRG Improving + RS turning positive | EMERGING | 규칙 6 | ✅ |
| RS -5pp 이하 + RRG Lagging | LAGGING | 규칙 8 | ✅ |
| RRG Weakening + 1M 마이너스 + 과거 수익 | DISTRIBUTION | 규칙 4 | ✅ |
| PARTIAL coverage + RS inconclusive | STORY_ONLY | 규칙 2 | ✅ |

특이사항:
- RRG 캐시가 없으면 `hasRRG=false`, `rrgQ=null` → RRG 의존 규칙(DISTRIBUTION, LEADING 일부) 미발동. 이 경우 CONFIRMING/LAGGING으로 fallback. 적절함.
- RRG 캐시와 RS가 상충하는 경우(예: RRG Lagging이나 RS 양호) — 규칙 5(LEADING)는 `rrgQ === 'Leading'` 필수이므로 RRG Lagging 버킷은 LEADING이 될 수 없음. 정합성 유지됨.

---

## UI Readability Review

- **Summary Strip**: 4개 핵심 상태(Leading/Emerging/Crowded/Distribution) + Coverage 즉시 파악 ✅
- **Benchmark Selector**: 컨트롤바에서 명확하게 선택 가능 ✅
- **State Labels**: 색상 배지 + 텍스트 조합, 가독성 양호 ✅
- **RS Table**: 3 benchmark 컬럼 동시 표시 — 선택된 benchmark 컬럼 강조(teal 테두리) ✅
- **Stage Grouping**: AI_INFRA_STAGE_ORDER 기반 논리적 그룹핑 ✅
- **Data Quality Badges**: COVERAGE / STATE METHOD / EARNINGS / BENCHMARK 4개 배지 ✅
- **RRG Tab**: 자체 로딩, benchmark 전환 시 자동 refetch ✅
- **Shell 통합**: `SemiconductorIntelligenceShell.tsx:79` — `AIInfrastructureRadar` 정상 연결 ✅
- **레이아웃 깨짐**: 확인되지 않음 — maxWidth 1440px 제한 ✅

---

## Product Language Review

검색 대상: `components/ai-infra/**/*.tsx`, `lib/ai-infra/**/*.ts`

| 금지어 | 발견 | 결과 |
|---|---|---|
| Buy / Sell | 없음 | ✅ |
| Strong Buy | 없음 | ✅ |
| Entry / Exit | 없음 | ✅ |
| Target Price | 없음 | ✅ |
| Trading Signal | 없음 | ✅ |
| 매수 / 매도 / 진입 / 목표가 / 강력매수 | 없음 | ✅ |

허용 용어만 사용:
Leading, Emerging, Confirming, Crowded, Lagging, Story Only, Distribution, Data Insufficient, Relative Strength, Momentum, Rotation, Coverage, Benchmark.

---

## Issues Found

| # | 심각도 | 설명 |
|---|---|---|
| 1 | Minor | `dataNotes` 필터 문자열이 실제 API 응답 문자열과 불일치 ('rule-based' vs 'recalculated') — 필터가 작동하지 않아 benchmark 노트가 inline에 표시됨 |
| 2 | Minor | `RSTable` 정렬이 항상 SOXX composite rank 기준 — QQQ/SPY 선택 시 선택된 RS 기준으로 정렬되어야 함 |
| 3 | Known | `GLASS_SUBSTRATE`: 상업화 불확실성 높지만 STORY_ONLY 미발동 (coverage 100%) |
| 4 | Known | `HBM_MEMORY`: 단일 종목으로 HBM 섹터 대표성 제한 |
| 5 | Known | `rankBuckets()` SOXX 고정 — `rank.composite` 필드는 benchmark-aware 아님 |
| 6 | Known | `COMMERCIALIZATION_UNCERTAINTY` 플래그 타입 정의됨 but 미사용 |
| 7 | Known | `BucketStateLabelPanel` — benchmark param 없이 fetch, Shell 미연결 (standalone only) |

---

## Minor Fixes Applied (D-9)

| Fix | 파일 | 변경 내용 |
|---|---|---|
| F-1 | `AIInfrastructureRadar.tsx:540` | `dataNotes` 필터 수정: `'State labels are rule-based'` → `'State labels are recalculated'` |
| F-2 | `AIInfrastructureRadar.tsx:374,461` | `RSTable` 정렬 기준: `rank.composite(SOXX)` → `rsOf()(선택된 benchmark RS 3M)` |

TypeScript check: ✅ clean (0 errors)

---

## Remaining Risks

1. **QQQ/SPY RRG 캐시 미생성**: `build_bottleneck_rrg.py` 실행 전까지 QQQ/SPY RRG 탭은 pending 표시.
2. **COPX 미수록 가능성**: RAW_MATERIAL 4번째 심볼이 ETF — DB 없으면 3/4 커버리지.
3. **GLASS_SUBSTRATE 레이블 신뢰도**: 상업화 스토리 버킷이 CONFIRMING 이상으로 분류될 수 있음 — Phase E calibration 대상.
4. **Korean 종목 미포함**: HBM, PCB 등 핵심 한국 상장 종목 데이터 없음 — 장기적 커버리지 한계.

---

## Recommendation for Next Phase

**→ READY_FOR_PHASE_E**

Phase E 시작 권장:

**E-1 Theme Purity Manual JSON**

이유:
- LLM 추출보다 결정적이고 안전
- GLASS_SUBSTRATE 등 상업화 불확실성 버킷에 `story_confidence` 필드 수동 설정 가능
- COMMERCIALIZATION_UNCERTAINTY 플래그를 메타데이터 기반으로 활성화할 수 있는 구조 마련
- 실적/수주 확인(Phase E-2)보다 빠른 배포 가능

E-1 완료 후 E-2 Earnings Confirmation.
