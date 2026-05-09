# SEMICONDUCTOR PHASE 2 — Data Contract

**Version:** 1.0  
**Date:** 2026-04-28  
**Status:** Approved for implementation  
**Phase 1 baseline:** TerminalXDashboard.tsx, TypeScript clean, fallback count 0

---

## 1. Phase 2 Data Goals

| Goal | Description |
|------|-------------|
| Remove BREADTH proxy | Replace composite score proxy with real MA-participation data |
| Remove MOMENTUM proxy | Replace composite proxy with real RSI / MACD / ROC |
| Replace CORRELATION placeholder | Render true Pearson correlation matrix |
| Upgrade MAP | Enable market-cap weighted treemap when weights available |
| Add AI concentration history | Time-series tracking for AI_DISTORTION / AI_INFRA_SUSTAINABILITY_RISK |
| Design historical analog | Spec engine design doc only; no UI until data is ready |

Phase 2 does NOT touch: Market Path, Forecast Lab, Risk Path Tracker, new top-level modules.

---

## 2. API Response Schema Extension

All new fields are additive to the existing `/api/semiconductor-lens` response.  
Existing fields remain unchanged. All new fields are **nullable** — UI must handle `null` gracefully.

```ts
// Existing (Phase 1 — unchanged)
{
  as_of: string
  kpis: { ... }         // all current kpi fields preserved
  buckets: [ ... ]
  rs_table: [ ... ]
}

// Phase 2 additions
{
  // P2-1: Breadth
  breadth_detail: {
    pct_above_ma20:  number | null   // % of universe above 20-day SMA
    pct_above_ma50:  number | null   // % of universe above 50-day SMA
    pct_above_ma200: number | null   // % of universe above 200-day SMA
    universe_count:  number          // how many tickers were included
    breadth_history: Array<{
      date:             string
      breadth_score:    number        // composite 0–100
      advancing_pct:    number | null
      declining_pct:    number | null
      pct_above_ma20:   number | null
      pct_above_ma50:   number | null
      pct_above_ma200:  number | null
    }>
  } | null

  // P2-2: Momentum
  momentum_detail: {
    rsi_14:    number | null
    roc_1m:    number | null          // 21-day rate of change
    roc_3m:    number | null          // 63-day rate of change
    roc_6m:    number | null          // 126-day rate of change
    macd: {
      value:     number | null
      signal:    number | null
      histogram: number | null
      state:     'above_signal' | 'below_signal' | 'neutral' | 'pending'
    } | null
    momentum_history: Array<{
      date:            string
      momentum_score:  number         // 0–100 derived score
      rsi_14:          number | null
      macd_histogram:  number | null
      roc_1m:          number | null
    }>
  } | null

  // P2-3: Correlation
  correlation_matrix: {
    window_days: number               // rolling window used (default 90)
    labels:      string[]             // e.g. ['SOXX','AI Infra','Memory','Foundry','Equipment']
    values:      number[][]           // NxN Pearson correlation matrix
    as_of:       string
  } | null

  // P2-4: Market-cap weights
  market_cap_weights: Array<{
    ticker:     string
    name:       string
    bucket:     string
    market_cap: number | null         // USD millions
    weight:     number | null         // 0–1 within bucket
    return_1d:  number | null
    return_5d:  number | null
    return_1m:  number | null
  }> | null

  bucket_weights: Array<{
    bucket:    string
    weight:    number                 // 0–1 within SOXX universe
    return_1m: number | null
  }> | null

  // P2-5: AI Infra concentration history
  ai_infra_concentration_history: Array<{
    date:                        string
    leader_concentration_top5:   number   // 0–100
    equal_weight_vs_cap_spread:  number   // signed bps or %
    ai_infra_vs_soxx_spread:     number   // AI Infra return - SOXX return
    conflict_type:               string | null
  }> | null
}
```

---

## 3. Field-by-Field Definition

### Group 1 — Breadth MA Participation

| Field | Type | Unit | Update Freq | Source |
|-------|------|------|-------------|--------|
| `pct_above_ma20` | number \| null | % (0–100) | Daily | Calculated from close prices |
| `pct_above_ma50` | number \| null | % (0–100) | Daily | Calculated from close prices |
| `pct_above_ma200` | number \| null | % (0–100) | Daily | Calculated from close prices |
| `universe_count` | number | count | Daily | Count of valid tickers |

### Group 2 — Breadth History

| Field | Type | Unit | Update Freq |
|-------|------|------|-------------|
| `breadth_history[].date` | string | YYYY-MM-DD | Daily row |
| `breadth_history[].breadth_score` | number | 0–100 | Daily |
| `breadth_history[].advancing_pct` | number \| null | % | Daily |
| `breadth_history[].pct_above_ma20` | number \| null | % | Daily |

### Group 3 — Momentum Indicators

| Field | Type | Unit | Update Freq | Source |
|-------|------|------|-------------|--------|
| `rsi_14` | number \| null | 0–100 | Daily | 14-day RSI of SOXX |
| `roc_1m` | number \| null | % | Daily | 21-day price ROC of SOXX |
| `roc_3m` | number \| null | % | Daily | 63-day price ROC of SOXX |
| `roc_6m` | number \| null | % | Daily | 126-day price ROC of SOXX |
| `macd.value` | number \| null | price diff | Daily | 12/26 EMA diff |
| `macd.signal` | number \| null | price diff | Daily | 9 EMA of MACD value |
| `macd.histogram` | number \| null | price diff | Daily | MACD value - signal |
| `macd.state` | string | enum | Daily | Derived from histogram sign |

### Group 4 — Correlation Matrix

| Field | Type | Notes |
|-------|------|-------|
| `correlation_matrix.window_days` | number | Default 90 trading days |
| `correlation_matrix.labels` | string[] | Min: SOXX + 4 buckets |
| `correlation_matrix.values` | number[][] | Pearson; diagonal = 1.0 |
| `correlation_matrix.as_of` | string | Date of last computed row |

### Group 5 — Market-cap Weights

| Field | Type | Notes |
|-------|------|-------|
| `market_cap_weights[].ticker` | string | Individual ticker |
| `market_cap_weights[].weight` | number \| null | Within-bucket weight |
| `bucket_weights[].weight` | number | Bucket share of SOXX |

### Group 6 — AI Infra Concentration History

| Field | Type | Notes |
|-------|------|-------|
| `leader_concentration_top5` | number | 0–100, higher = more concentrated |
| `equal_weight_vs_cap_spread` | number | Negative = cap-weight dominates |
| `ai_infra_vs_soxx_spread` | number | Positive = AI outperforming |

---

## 4. Calculation Methods

### MA Participation (P2-1)

```python
# For each ticker in universe:
above_ma20  = close[-1] > mean(close[-20:])
above_ma50  = close[-1] > mean(close[-50:])
above_ma200 = close[-1] > mean(close[-200:])

# Skip ticker if insufficient history
valid = [t for t in universe if len(history[t]) >= 200]

pct_above_ma20  = sum(above_ma20[t]  for t in valid) / len(valid) * 100
pct_above_ma50  = sum(above_ma50[t]  for t in valid) / len(valid) * 100
pct_above_ma200 = sum(above_ma200[t] for t in valid) / len(valid) * 100
```

### Momentum Indicators (P2-2)

```python
# Using SOXX as primary anchor
RSI_14       = rsi(soxx_close, period=14)
ROC_1M       = (soxx_close[-1] / soxx_close[-21] - 1) * 100
ROC_3M       = (soxx_close[-1] / soxx_close[-63] - 1) * 100
ROC_6M       = (soxx_close[-1] / soxx_close[-126] - 1) * 100
ema12        = ema(soxx_close, 12)
ema26        = ema(soxx_close, 26)
macd_val     = ema12 - ema26
macd_signal  = ema(macd_val, 9)
macd_hist    = macd_val - macd_signal
```

### Correlation Matrix (P2-3)

```python
# Daily returns for each bucket (equal-weighted unless market_cap_weights available)
returns_soxx   = pct_change(soxx_close, window=90)
returns_ai     = equal_weight_return(ai_tickers, window=90)
returns_mem    = equal_weight_return(memory_tickers, window=90)
returns_foundry= equal_weight_return(foundry_tickers, window=90)
returns_equip  = equal_weight_return(equip_tickers, window=90)

matrix = pearson_corr([returns_soxx, returns_ai, returns_mem, returns_foundry, returns_equip])
# Result: 5x5 symmetric matrix, diagonal=1.0, range [-1, 1]
```

### Market-cap Weights (P2-4)

```python
# Source: yfinance market_cap field or cached from data provider
bucket_weight = sum(market_cap[t] for t in bucket) / sum(market_cap[t] for t in soxx_universe)
ticker_weight = market_cap[t] / sum(market_cap[t] for t in bucket)
```

### AI Infra Concentration History (P2-5)

```python
# Per day for last N days:
top5_tickers = sorted(ai_infra_tickers, key=lambda t: market_cap[t], reverse=True)[:5]
top5_contribution = sum(return_1d[t] * weight[t] for t in top5_tickers) / ai_infra_return_1d * 100
ew_vs_cw_spread = equal_weight_ai_return - cap_weight_ai_return  # bps or %
ai_vs_soxx = ai_infra_return - soxx_return
```

---

## 5. Source Data Requirements

| Data Group | Minimum History | Price Granularity | Provider |
|------------|----------------|-------------------|----------|
| MA Participation | 200 trading days per ticker | Daily close | yfinance / cache |
| Breadth History | 180 days of daily snapshots | Daily | Computed from above |
| RSI/MACD/ROC | 200 trading days SOXX | Daily close | yfinance / cache |
| Correlation Matrix | 90 trading days per bucket | Daily return | Computed |
| Market-cap Weights | Current snapshot | N/A | yfinance info.marketCap |
| AI Infra Concentration | 180 days | Daily | Computed from ticker data |

**Universe (Phase 2):**
```
NVDA, AMD, AVGO, MRVL, MU, WDC, TSM, INTC, ASML, AMAT,
LRCX, KLAC, MPWR, TXN, ON, ADI, ANET, LITE, COHR, NXPI, STM
```
Plus SOXX as benchmark. Tickers with < 200 days history are excluded from MA calculations.

---

## 6. UI Tab Dependency Map

| Data Field | BREADTH | MOMENTUM | CORRELATION | MAP | AI OVERLAY |
|------------|---------|----------|-------------|-----|-----------|
| `pct_above_ma20/50/200` | ✅ Primary | — | — | — | — |
| `breadth_history` | ✅ History chart | — | — | — | — |
| `rsi_14` | — | ✅ Primary | — | — | — |
| `macd.*` | — | ✅ Primary | — | — | — |
| `roc_1m/3m/6m` | — | ✅ Primary | — | — | — |
| `momentum_history` | — | ✅ Chart | — | — | — |
| `correlation_matrix` | — | — | ✅ Heatmap | — | — |
| `market_cap_weights` | — | — | ✅ Optional | ✅ Treemap | — |
| `bucket_weights` | — | — | ✅ Optional | ✅ Labels | — |
| `ai_infra_concentration_history` | ✅ Mini chart | — | ✅ Trend | ✅ Overlay | ✅ |

---

## 7. Missing-data Behavior

| Condition | UI Behavior |
|-----------|-------------|
| Field is `null` | Show "Data pending" |
| Field is empty array `[]` | Show "Data pending" |
| Partial data (some tickers missing) | Use valid tickers, show `universe_count` |
| < 20 tickers in universe | Return `null` for pct_above fields |
| < 90 days for correlation | Return `null` for correlation_matrix |
| < 21 days for ROC_1M | Return `null` for roc_1m |
| Market cap unavailable | Keep equal-size MAP, do not estimate |

**Hard rule:** Never fake, estimate, or interpolate missing values for display. Return `null` and display "Data pending".

---

## 8. Priority Order

```
Priority 1 (highest impact, data already partially available):
  P2-1  Breadth MA Participation + breadth_history

Priority 2:
  P2-2  Momentum RSI/MACD/ROC

Priority 3:
  P2-3  Correlation Matrix

Priority 4:
  P2-4  Market-cap Weighted MAP

Priority 5:
  P2-5  AI Infra Concentration History

Priority 6 (design only):
  P2-6  Historical Analog Engine Design
```

Rationale: Breadth data is highest priority because it removes 3 pending fields at once and the MA calculation is straightforward with existing cached price data.

---

## 9. Testing Plan

### P2-1 Breadth Test Fixtures

| Fixture | NVDA above MA20 | MU above MA200 | Expected pct_above_ma20 |
|---------|----------------|----------------|-------------------------|
| Broad rally | Yes | Yes | High (≥70%) |
| Narrow rally | Yes | No | Low (≤40%) |
| Weak market | No | No | Very low (≤20%) |
| Missing ticker | N/A | N/A | universe_count decremented |

### P2-2 Momentum Test Fixtures

| Fixture | SOXX 14d trend | Expected RSI | Expected MACD state |
|---------|---------------|--------------|---------------------|
| Strong uptrend | +15% | >60 | above_signal |
| Consolidating | ±2% | 45–55 | neutral |
| Downtrend | -12% | <40 | below_signal |
| Insufficient data | — | null | pending |

### P2-3 Correlation Test

| Fixture | AI return vs SOXX | Expected correlation |
|---------|-------------------|----------------------|
| AI leads, others lag | Divergent | Low AI-SOXX correlation |
| All move together | Parallel | High all-bucket correlation |

### P2-4 Market-cap Test

| Fixture | NVDA market cap available | Expected |
|---------|--------------------------|---------|
| Full data | Yes | Treemap with % labels |
| Partial (some null) | No | Equal-size fallback |

---

## 10. Implementation Sequence

```
Step 1 — Backend: Add MA participation calculator to semiconductor data pipeline
         Output: pct_above_ma20 / pct_above_ma50 / pct_above_ma200 / universe_count
         File: marketflow/backend/services/semiconductor_breadth.py (new)

Step 2 — Backend: Add breadth_history time series
         Output: breadth_history[] array
         File: same as Step 1

Step 3 — API: Extend /api/semiconductor-lens to include breadth_detail
         File: marketflow/frontend/src/app/api/semiconductor-lens/route.ts

Step 4 — UI: Wire BREADTH tab Participation Health panel
         File: TerminalXDashboard.tsx

Step 5 — Backend: Add RSI / MACD / ROC calculator
         Output: rsi_14, macd, roc_1m/3m/6m, momentum_history
         File: marketflow/backend/services/semiconductor_momentum.py (new)

Step 6 — API + UI: Wire MOMENTUM tab

Step 7 — Backend: Correlation matrix calculator
         Output: correlation_matrix
         File: marketflow/backend/services/semiconductor_correlation.py (new)

Step 8 — API + UI: Wire CORRELATION tab heatmap

Step 9 — Backend: Market cap fetcher
         Output: market_cap_weights, bucket_weights
         File: marketflow/backend/services/semiconductor_weights.py (new)

Step 10 — UI: Wire MAP treemap (with equal-size fallback)

Step 11 — Backend: AI Infra concentration history
          File: extend semiconductor data pipeline

Step 12 — UI: Wire AI concentration history charts

Step 13 — Design doc: Historical Analog Engine
          File: SEMICONDUCTOR_HISTORICAL_ANALOG_ENGINE.md

Step 14 — P2-7 QA: Validate all pending fields resolved
```

---

## Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-28 | 1.0 | Initial contract for Phase 2 |
