# Semiconductor Fundamentals Data — 운영 가이드

## 목적

`semiconductor_fundamentals_latest.json` 캐시는 반도체 산업 사이클 모니터의
ENGINE 탭이 렌더링하는 펀더멘털 데이터의 단일 소스입니다.

UI는 `/api/semiconductor-fundamentals` 를 통해 이 캐시를 읽습니다.
업데이트는 캐시 파일만 교체하면 됩니다 — UI 코드 변경 불필요.

---

## 캐시 파일 위치

```
marketflow/backend/output/cache/semiconductor_fundamentals_latest.json
```

---

## 데이터 계층 구조

| 계층 | 키 | 설명 |
|------|----|------|
| L1 | `l1Fundamentals` | 반도체 수요 지표 (TSMC, B2B, SIA, NVDA) |
| L2 | `l2CapitalFlow`  | AI 인프라 자본 흐름 (하이퍼스케일러 CapEx) |
| L3 | `l3MarketConfirmation` | 시장 확인 지표 (SOXX Reflection, SOXL Decay) |

---

## 메트릭 정의

### L1 — 반도체 펀더멘털

| 필드 | 설명 | 갱신 주기 |
|------|------|-----------|
| `tsmcRevenueYoY` | TSMC 월간 매출 YoY 성장률 | 월간 |
| `bookToBill` | Book-to-Bill Ratio (SEMI.org) | 월간 / 발표 시 |
| `siaSemiSales` | SIA 글로벌 반도체 판매액 | 월간 |
| `nvdaDataCenterRevenue` | NVDA 데이터센터 분기 매출 | 분기 |

### L2 — 자본 흐름

| 필드 | 설명 | 갱신 주기 |
|------|------|-----------|
| `hyperscalerCapex` | 하이퍼스케일러 CapEx 합산 | 분기 |
| `microsoftCapex` | Microsoft 분기 CapEx | 분기 |
| `amazonCapex` | Amazon 분기 CapEx | 분기 |
| `googleCapex` | Alphabet 분기 CapEx | 분기 |
| `metaCapex` | Meta 분기 CapEx | 분기 |

### L3 — 시장 확인

| 필드 | 설명 | 갱신 주기 |
|------|------|-----------|
| `soxxReflection` | SOXX 내부 반사 점수 | 주간 |
| `soxlDecay` | SOXL 레버리지 감쇠 추정 | 일간 (추후 자동화) |

---

## DataStatus 배지 규칙

| 상태 | 의미 | 색상 |
|------|------|------|
| `LIVE` | 실시간 API 연결됨 | `#22c55e` (green) |
| `CACHE` | 최근 캐시 데이터 | `#22d3ee` (cyan) |
| `STATIC` | 분기/연간 고정값 (수동 확인) | `#fbbf24` (amber) |
| `MANUAL` | 수동 입력값 | `#fbbf24` (amber) |
| `PENDING` | 연결 예정 | `#737880` (muted) |
| `UNAVAILABLE` | 데이터 없음 | `#ef4444` (red) |

---

## 수동 업데이트 워크플로우

### 1. 입력 파일 준비

예시 파일을 복사하고 값을 수정합니다:

```bash
cp marketflow/config/semiconductor_fundamentals_input.example.json \
   marketflow/config/semiconductor_fundamentals_input.json
# 값 수정 후 저장
```

### 2. 업데이터 실행

```bash
python marketflow/scripts/update_semiconductor_fundamentals.py \
  --input marketflow/config/semiconductor_fundamentals_input.json
```

CLI 단일 필드 업데이트:

```bash
python marketflow/scripts/update_semiconductor_fundamentals.py \
  --tsmc-yoy "+39%" \
  --book-to-bill "1.18" \
  --sia-sales "$56.1B" \
  --nvda-dc "$35.6B" \
  --hyperscaler-capex "$78.4B" \
  --as-of "2026-05"
```

### 3. 검증

```bash
python marketflow/scripts/validate_semiconductor_fundamentals.py
```

성공 출력:

```
PASS: semiconductor fundamentals cache is valid
```

### 4. UI 반영

캐시 파일이 업데이트되면 `/api/semiconductor-fundamentals` 가 자동으로
새 데이터를 반환합니다. UI 재배포 불필요.

---

## FundamentalMetric 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 내부 식별자 |
| `label` | string | Y | 표시 레이블 |
| `displayValue` | string | Y | UI에 표시되는 포맷된 값 |
| `value` | number \| string \| null | - | 수치 원본값 |
| `unit` | string | - | `%`, `USD_B` 등 |
| `status` | DataStatus | Y | 배지 상태 |
| `source` | string | Y | 데이터 출처 |
| `asOf` | string | - | 기준 기간 (예: `2026-05`) |
| `updatedAt` | string | - | ISO 타임스탬프 |
| `frequency` | UpdateFrequency | Y | 갱신 주기 |
| `note` | string | - | 추가 설명 |

---

## 비거래 언어 규칙

이 데이터는 산업 사이클 모니터 용도입니다.
Buy / Sell / Entry / Exit / 매수 / 매도 / 진입 / 청산 표현을 사용하지 않습니다.

---

## 향후 자동화 계획

| 단계 | 내용 |
|------|------|
| C-5A | SOXX/QQQ/SPY 기준 RS 실시간 데이터 배선 |
| C-5B | RRG path 실제 데이터 연결 |
| C-5C | SOXL Decay 내부 계산 자동화 |
| C-6  | L1/L2 외부 데이터 자동화 (TSMC, SIA, SEMI.org) |
