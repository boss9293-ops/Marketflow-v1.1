# AI Bottleneck Radar Phase D-1 — Bucket Map

작성일: 2026-05-08

---

## Purpose

AI 인프라 밸류체인 전반에 걸쳐 자본 흐름과 병목 이동을 추적하기 위한 **13개 버킷 공식 분류 체계**.

이 문서는 투자 추천이 아니다. 버킷은 단계별 상대강도, 모멘텀, 브레드스를 정량화하기 위한 연구 엔진의 분류 단위다.

---

## Why This Starts Now

C-3 / C-4B / C-5A~J 전부 완료됨. Phase D 시작 조건 충족.

기존 조건:
> "AI Bottleneck Radar는 C-3 안정화 이후 시작한다."

현재 상태: C-3은 커밋 `ffc99eb`에서 완료. 이후 C-5J까지 전부 머지됨.

Phase D-1은 **구현 없음 — 타입 계약과 버킷 분류 체계만** 수립한다.

---

## Current Placeholder Migration

기존 5개 placeholder 테마(`aiInfrastructureRadar.ts`)와 신규 13-bucket 매핑.

| Legacy Theme ID | Legacy Category | → New Bucket | 비고 |
|---|---|---|---|
| `data_center_power` | Power Demand | `POWER_INFRA` | 직접 매핑 |
| `grid_electrical_equipment` | Power Infrastructure | `POWER_INFRA` | 직접 매핑 |
| `cooling` | Data Center Infrastructure | `COOLING` | 직접 매핑 |
| `cloud_capex` | AI Demand Signal | `DATA_CENTER_INFRA` | 수요 신호 → DC 인프라로 흡수 |
| `nuclear_smr` | Long-Term Power Supply | `null` | 미래 `ENERGY_INFRA` 확장 후보. 현재 13개 버킷 포함 불가. |

**`nuclear_smr` 처리 방針:**
현재 13-bucket에 강제 포함하지 않는다. 규제 리스크, 타임라인 불확실성, 상용화 거리가 크기 때문이다.
향후 에너지 테마가 구체화되면 `ENERGY_INFRA` 버킷으로 독립 추가한다. `LEGACY_THEME_TO_BUCKET['nuclear_smr'] = null`로 명시.

---

## Official 13 Buckets

| # | Bucket ID | Display Name | Stage | Value Chain | Benchmark | Data Quality |
|---|---|---|---|---|---|---|
| 1 | `AI_CHIP` | AI Chip | Stage 1 | 1 | SOXX | REAL |
| 2 | `HBM_MEMORY` | HBM Memory | Stage 2 | 2 | SOXX | PARTIAL |
| 3 | `PACKAGING` | Advanced Packaging | Stage 2 | 2 | SOXX | REAL |
| 4 | `COOLING` | Cooling | Stage 3 | 3 | SOXX | REAL |
| 5 | `PCB_SUBSTRATE` | PCB & Substrate | Stage 3 | 3 | SOXX | PARTIAL |
| 6 | `TEST_EQUIPMENT` | Test Equipment | Stage 3 | 3 | SOXX | REAL |
| 7 | `GLASS_SUBSTRATE` | Glass Substrate | Stage 3 | 3 | SOXX | PARTIAL |
| 8 | `OPTICAL_NETWORK` | Optical Network | Stage 3 | 3 | QQQ | REAL |
| 9 | `POWER_INFRA` | Power Infrastructure | Stage 4 | 4 | SPY | REAL |
| 10 | `CLEANROOM_WATER` | Cleanroom & Water | Stage 4 | 4 | SPY | PARTIAL |
| 11 | `SPECIALTY_GAS` | Specialty Gas | Stage 4 | 4 | SPY | REAL |
| 12 | `DATA_CENTER_INFRA` | Data Center Infrastructure | Stage 5 | 5 | SPY | REAL |
| 13 | `RAW_MATERIAL` | Raw Material | Stage 5 | 5 | SPY | PARTIAL |

### Bucket Symbols Summary

| Bucket ID | Symbols | Notes |
|---|---|---|
| AI_CHIP | NVDA, AMD, AVGO, MRVL | All US-listed, ohlcv_daily에 있어야 함 |
| HBM_MEMORY | MU | Samsung(005930.KS), SK Hynix(000660.KS) — KR 파이프라인 완성 후 추가 |
| PACKAGING | AMAT, KLAC, ACMR, TSM | AMAT/KLAC은 TEST_EQUIPMENT와 overlap — 의도적 |
| COOLING | VRT, ETN, TT, MOD, NVT | VRT은 POWER_INFRA/DATA_CENTER_INFRA와 중복 — 의도적 |
| PCB_SUBSTRATE | TTM, SANM, CLS, FLEX | 한국 기판주 제외 (KR 파이프라인 필요) |
| TEST_EQUIPMENT | TER, COHU, FORM, KLAC, ONTO | COHU, FORM은 소형주 — 거래량 희박 주의 |
| GLASS_SUBSTRATE | GLW, AMAT | 대부분 story-level. 상용화 타임라인 불확실 |
| OPTICAL_NETWORK | ANET, CIEN, LITE, COHR, AVGO | AVGO는 AI_CHIP과 중복 — 의도적 |
| POWER_INFRA | ETN, PWR, HUBB, GEV, VRT, NVT | 레거시 테마(power, grid) 통합 |
| CLEANROOM_WATER | ACMR, XYL, ECL, WTS | ACMR이 반도체 순도 가장 높음 |
| SPECIALTY_GAS | LIN, APD, ENTG, CCMP | LIN/APD는 diversified; ENTG/CCMP가 반도체 집중 |
| DATA_CENTER_INFRA | EQIX, DLR, IRM, VRT | REIT 포함 — 금리 민감도 있음 |
| RAW_MATERIAL | FCX, SCCO, TECK, COPX | COPX는 ETF 프록시 |

---

## Data Quality Notes

| Data Quality | 의미 | Phase D-1 처리 |
|---|---|---|
| `REAL` | US 상장, ohlcv_daily에 존재, 계산 가능 | D-2에서 RS/모멘텀 즉시 계산 가능 |
| `PARTIAL` | 일부 종목만 US 상장. 한국/OTC 종목 제외됨 | 가용 종목으로 partial 계산, 주의 표시 |
| `PLACEHOLDER` | 종목 미정 또는 데이터 없음 | 레이블만 표시, 수치 숨김 |
| `MANUAL` | 수동 입력 데이터만 | qualitative only |
| `DATA_INSUFFICIENT` | 대표 종목 없음 | 레이블만, 계산 제외 |

현재 Phase D-1 기준:
- `REAL` 7개 버킷: AI_CHIP, PACKAGING, COOLING, TEST_EQUIPMENT, OPTICAL_NETWORK, POWER_INFRA, SPECIALTY_GAS, DATA_CENTER_INFRA
- `PARTIAL` 5개 버킷: HBM_MEMORY, PCB_SUBSTRATE, GLASS_SUBSTRATE, CLEANROOM_WATER, RAW_MATERIAL
- `DATA_INSUFFICIENT` 0개

---

## Deferred Items

Phase D-1에서 의도적으로 제외한 항목:

| Item | 이유 |
|---|---|
| BTI 점수 공식 | Engine Score(internal_signal)와 중복 위험. 설계 분리 필요 |
| Earnings Confirmation | FMP + LLM 필요. 신뢰도 없음 |
| AI revenue % 추출 | LLM 파싱 필요 |
| Theme Purity Score 자동화 | Phase E |
| 한국 종목 (Samsung, SK Hynix 등) | KIS 파이프라인 안정화 후 |
| nuclear_smr 버킷 포함 | 상용화 불확실 — 별도 ENERGY_INFRA로 향후 추가 |
| State Label 계산 | Phase D-4 |
| RRG basket 계산 | Phase D-3 |
| 독립 사이드바 라우트 | 영구 제외 — SemiconductorIntelligenceShell 내 탭으로만 운영 |

---

## Next: Phase D-2

Phase D-2 대상:

1. `/api/ai-infra/theme-momentum` 확장
   - 현재: 1D / 5D / 1M
   - 추가: 3M / 6M
   - 추가: `vsSOXX`, `vsQQQ`, `vsSPY` 상대 수익률 (benchmark는 `default_benchmark` 필드 참조)
2. Bucket RS Panel 컴포넌트
   - `BucketRSChart.tsx` 패턴 재사용
   - 입력: `AIInfraBucket[]` + momentum API 응답
3. TypeScript 타입 확장
   - `AIInfraThemeMomentum`에 `vsSOXX / vsQQQ / vsSPY` 필드 추가

D-2 시작 조건: D-1 merge 완료 후.

---

## File Created

`marketflow/frontend/src/lib/semiconductor/aiInfraBucketMap.ts`

**Exports:**
- `AIInfraBucketId` — 13개 버킷 ID 유니온 타입
- `AIInfraStage` — 5단계 밸류체인 스테이지
- `AIInfraDataQuality` — REAL / PARTIAL / PLACEHOLDER / MANUAL / DATA_INSUFFICIENT
- `AIInfraBucket` — 버킷 계약 인터페이스
- `AI_INFRA_STAGE_ORDER` — 단계 정렬 배열
- `AI_INFRA_STAGE_LABEL` — 단계 표시명 레코드
- `AI_INFRA_BUCKETS` — 13개 버킷 정의 배열
- `AI_INFRA_BUCKET_IDS` — ID 배열
- `AI_INFRA_BUCKET_BY_ID` — ID → 버킷 레코드
- `getAIInfraBucket(id)` — 단일 버킷 조회
- `getAIInfraBucketsByStage(stage)` — 스테이지별 필터
- `LEGACY_THEME_TO_BUCKET` — 구 placeholder → 신규 버킷 마이그레이션 맵
- `validateAIInfraBucketMap()` — 내부 검증 함수
