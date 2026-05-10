# AI Investment Tower — MVP v1 Reference

Status: **FROZEN** (2026-05-09)
Branch: `v1.1`

---

## 1. Product Purpose

AI Investment Tower is a user-facing research panel that maps the AI infrastructure investment cycle across 10 thematic layers. It answers the question: **"Which part of the AI cycle is leading, which is rotating, and which is at risk?"**

It is not a trading recommendation engine. It is an observation and interpretation layer built on top of the existing 13-bucket RRG engine.

---

## 2. User-Facing Structure (Page Hierarchy)

```
AI Tower Summary Cards        ← 5-second overview of current cycle state
↓
Report Mode Toggle            ← Beginner / Pro
↓
Beginner Report               ← Easy Korean narrative per layer
Pro Report                    ← Detailed table: RRG / Trend / Risk / Breadth / Signal
↓
Selected Layer Detail Panel   ← Full detail for the active layer
↓
Selected Layer Trend Chart    ← Basket vs benchmark, normalized to 100
↓
10-Layer RRG Board            ← Quadrant navigation (주도/회복/둔화/소외/확인 필요)
↓
Deep Dive — 13-Bucket System  ← RS Table / State Labels / Advanced RRG (unchanged)
```

---

## 3. Internal Engine Structure

```
ohlcv_daily (SQLite)
  └── computeBucketRS()         ← RS, momentum, trend for 13 buckets
  └── computeBucketBreadth()    ← % of symbols above MA50
  └── computeBucketState()      ← RRG state label per bucket
        ↓
  adaptTowerLayers()            ← 13 buckets → 10 user layers (with tower virtual buckets)
        ↓
  generateBeginnerReport()      ← Korean narrative per layer
  generateProReport()           ← Detailed numeric report per layer
  buildTowerSummary()           ← Aggregate: state label, leadership, risk
```

---

## 4. 10 AI Layer Definitions

| Layer | Korean Label | ETF / Benchmark | Basket Symbols | Source Buckets |
|---|---|---|---|---|
| AI_COMPUTE | AI 연산 반도체 | SMH | NVDA, AMD, AVGO, TSM, ASML, AMAT, KLAC, LRCX | AI_CHIP + PACKAGING + TEST_EQUIPMENT |
| MEMORY_HBM | 메모리 / HBM | SOXX | MU, WDC, STX, SNDK | HBM_MEMORY |
| STORAGE_DATA | 스토리지 / 데이터 | QQQ | PSTG, NTAP, WDC, STX, MU | STORAGE_DATA (tower virtual) |
| NETWORKING_OPTICAL | 네트워크 / 광통신 | QQQ | ANET, AVGO, MRVL, COHR, LITE, CIEN, CSCO | OPTICAL_NETWORK |
| POWER_COOLING | 전력 / 냉각 | SPY | VRT, ETN, PWR, MOD, GEV, TT, HUBB | COOLING + POWER_INFRA + DATA_CENTER_INFRA |
| RAW_MATERIALS | 원자재 / 에너지 | SPY | FCX, SCCO, CCJ, BWXT | RAW_MATERIAL + SPECIALTY_GAS + CLEANROOM_WATER |
| CLOUD_HYPERSCALERS | 클라우드 / 하이퍼스케일러 | QQQ | MSFT, GOOGL, AMZN, META, ORCL | CLOUD_HYPERSCALERS (tower virtual) |
| AI_SOFTWARE | AI 소프트웨어 | QQQ | PLTR, SNOW, CRM, MDB, DDOG, NOW | AI_SOFTWARE (tower virtual) |
| ROBOTICS_PHYSICAL_AI | 로보틱스 / 피지컬 AI | SPY | TSLA, ISRG, ABB, ROK, TER | ROBOTICS_PHYSICAL_AI (tower virtual) |
| CYBERSECURITY | 사이버보안 | QQQ | CRWD, PANW, ZS, FTNT, NET | CYBERSECURITY (tower virtual) |

### Tower Virtual Buckets

5 layers (STORAGE_DATA, CLOUD_HYPERSCALERS, AI_SOFTWARE, ROBOTICS_PHYSICAL_AI, CYBERSECURITY) do not have corresponding entries in the original 13-bucket map. They are computed as **tower virtual buckets** inside the API route (`/api/ai-infra/theme-momentum`) using the same `computeBucketRS` / `computeBucketBreadth` / `computeBucketState` pipeline. They are returned as `tower_buckets` / `tower_states` — separate from the original `buckets` / `bucket_states` — so the Deep Dive 13-bucket system remains unaffected.

---

## 5. Beginner vs Pro Report Logic

### Beginner Report (`generateBeginnerReport`)

- Output: `BeginnerLayerReport[]`
- Fields: `layerId`, `koreanLabel`, `statusLabel`, `headline`, `explanation`, `group`, `riskLabel`
- Group assignment: `working` / `emerging` / `losing` / `caution` / `neutral`
- Narrative: templated Korean sentences per layer ID; coverage-aware wording appended
- Coverage guard: `coveragePct < 0.50` → deferred ("데이터 충분하지 않아 추세 판단 보류")

### Pro Report (`generateProReport`)

- Output: `ProLayerReport[]`
- Fields: all `LayerReportInput` fields + `rrgComment`, `momentumComment`, `trendComment`, `riskComment`, `nextCheckpoint`
- Each comment is a structured Korean sentence explaining the signal
- `nextCheckpoint`: actionable monitoring instruction per RRG state

---

## 6. Summary Card Logic (`buildTowerSummary`)

Input: `BeginnerLayerReport[]`

State derivation (priority order):
1. `highRiskCount >= 3` → **위험 상승**
2. `strongTotal >= 5` → **AI 인프라 확산 중**
3. `strongTotal >= 3` + storage/software emerging → **데이터 계층 확산**
4. `strongTotal >= 3` → **AI 인프라 확산 중**
5. AI_COMPUTE in caution + defensive leading → **방어적 순환**
6. Only AI_COMPUTE leading → **AI 연산 중심 주도**
7. `strongTotal === 0` → **혼조 / 확인 필요**

Risk aggregation:
- `HIGH/EXTREME >= 3` → 높음 (red)
- `HIGH >= 1` or `ELEVATED >= 3` → 과열 주의 (amber)
- `ELEVATED >= 2` or `MODERATE >= 5` → 주의 (teal)
- `MODERATE >= 2` → 소폭 주의 (teal)
- else → 안정 (green)

Output: `{ stateLabel, stateComment, leadership[], emerging[], weakening[], riskLabel, riskColor }`

---

## 7. Selected Layer Detail Logic

Component: `SelectedLayerDetailPanel`
Type: `SelectedLayerDetail`

Selection logic in `AIInfrastructureRadar`:
- Default: first `working` group layer → first available layer
- Override: user click on Pro table row or RRG board chip

Fields assembled from:
- `towerInputs` → momentum, trend, breadth, risk, coverage
- `beginnerReports` → statusLabel, narrative (explanation)
- `proReports` → nextCheckpoint
- `AI_INVESTMENT_TOWER_LAYERS` → basketSymbols

---

## 8. Trend Chart Logic (`/api/ai-investment-tower/layer-trend`)

Parameters: `layerId`, `range` (1M / 3M / 6M / 1Y, default 3M)

Basket calculation:
1. Normalize each symbol to 100 at its first available date in the range
2. For each trading date, average normalized values across symbols with data on that date
3. Equal-weight, gaps handled per-date (symbols missing on a date are excluded from that day's average)

Benchmark: tries `layer.benchmark` → `QQQ` → `SPY` in order; renders basket-only if none available.

Coverage: `validSymbols / totalBasketSymbols`

---

## 9. RRG Board Logic (`AIInvestmentLayerRRGBoard`)

Quadrant mapping:

| RRG State | Display | Color |
|---|---|---|
| LEADING | 주도 구간 | green |
| IMPROVING | 회복 구간 | teal |
| WEAKENING | 둔화 구간 | amber |
| LAGGING | 소외 구간 | red |
| MIXED / UNKNOWN | 확인 필요 | text3 |

Click behavior: updates `selectedLayerId` → propagates to Detail Panel + Trend Chart.
Selected chip: highlighted border + background using quadrant accent color.
Empty quadrant: renders "해당 레이어 없음".

---

## 10. Deep Dive Relationship

The Deep Dive system (13-bucket tabs: STATE LABELS, RS TABLE, RRG) is fully preserved and unchanged.

- Rendered below the RRG Board
- Uses original `buckets` / `bucket_states` arrays (not tower virtual data)
- `BucketRRGPanel` is the same advanced RRG chart available in the existing system

The AI Investment Tower is an additional interpretation layer on top, not a replacement.

---

## 11. Current DB Coverage

All 10 layers have complete price data as of 2026-05-09.

Backfilled symbols (Phase D-1):
- **SNOW** — Snowflake Inc (stooq local, NYSE)
- **MDB** — MongoDB Inc (stooq local, NASDAQ)
- **NET** — Cloudflare Inc (stooq local, NYSE)
- **ABB** — ABB Ltd via ABBN.SW (yfinance; CHF-denominated, FX-neutral for % momentum)

Known data notes:
- `SNDK` — recently listed; short history, may have lower coverage in early periods
- `GEV` — GE Vernova IPO 2024; pre-IPO dates excluded automatically
- `ABB` — Swiss Exchange prices used (ABBN.SW relabeled as ABB); suitable for momentum comparison

---

## 12. Known Limitations

1. **No per-symbol trend lines in chart** — basket index only; individual symbol lines not shown
2. **No true RRG scatter** in the board — quadrant grouping is state-label-based, not XY coordinate
3. **AI_COMPUTE benchmark is SMH** — if SMH unavailable in DB, fallback to SOXX applies automatically
4. **Tower virtual bucket coverage** — ROBOTICS, CYBERSECURITY baskets have fewer tradeable symbols; coverage may dip below 80% on older date ranges
5. **Basket normalization is equal-weight** — no market-cap weighting; suitable for directional trend observation, not precise index tracking
6. **No historical archive** — current state only; no time-travel or snapshot replay in this layer
7. **No Beginner mode RRG board click** — selection via Pro table row and RRG board only; Beginner card click not yet wired

---

## 13. Safety Language Rules

**Forbidden in all user-facing output:**
- 매수 / 매도
- 강력 매수 / 강력 매도
- 목표가
- 반드시 오른다 / 확실히 오른다
- "지금 사야 한다" 류의 직접 지시

**Allowed:**
- 관심권 진입
- 개선 흐름 확인 필요
- 비중 관리
- 과열 주의
- 추가 확인 필요
- 관망 구간
- 위험 회피
- 비중 확대 후보 (조건부)

All narrative text passes through `beginnerReportGenerator.ts` and `proReportGenerator.ts`. These files contain no forbidden terms.

---

## 14. Future Phase E Backlog

| Priority | Item |
|---|---|
| E-1 | AI Sector Weekly Momentum Heatmap |
| E-2 | AI Theme Price Momentum Pipeline (per-symbol return grid) |
| E-3 | Selected layer vs benchmark advanced chart (with RRG trail overlay) |
| E-4 | Layer RRG historical tail (past 4-week quadrant path) |
| E-5 | Daily narrative archive (timestamped state snapshots) |
| E-6 | Subscriber-facing weekly AI sector briefing generation |
| E-7 | ETF anchor expansion: IGN, GRID, CIBR, URA, IGV, CLOU |
| E-8 | Beginner card click → layer selection wiring |

**Do not implement these in Phase D.**
