# SOXL Decay Model

## Purpose

Measures how much actual SOXL returns have deviated from a simple ideal 3x benchmark comparison over a selected lookback window.

This is a **volatility-drag proxy / environment context indicator**.  
It is NOT a trading signal or return forecast.

---

## Formula

```
actualSOXLReturn  = SOXL_end / SOXL_start - 1
benchmarkReturn   = SOXX_end / SOXX_start - 1
ideal3xReturn     = 3 × benchmarkReturn          (simple point-to-point)
decayPct          = actualSOXLReturn - ideal3xReturn
```

Note: this is a **point-to-point comparison**, not a daily-compounding model.  
In trending markets SOXL can exceed the simple 3x path (positive compounding).  
In choppy markets SOXL can underperform (volatility drag accumulates).  
Do not label this as the official leveraged ETF decay model.

---

## Benchmark Selection Rule

1. Use **SOXX** if ≥252 trading days available → benchmark = `'SOXX'`
2. Fallback to **SMH** if SOXX insufficient → benchmark = `'SMH'`
3. If neither: benchmark = `'PENDING'`, no metrics computed

Always label benchmark honestly in UI: show SOXX or SMH, never substitute one for the other.

---

## Lookback Windows

| Window | Trading Days |
|--------|-------------|
| 5D | 5 |
| 1M | 21 |
| 3M | 63 |
| 6M | 126 |
| 1Y | 252 |

Default window: **3M**

---

## Status Thresholds

| Condition | Status |
|-----------|--------|
| decayPct ≥ +2pp | FAVORABLE |
| -2pp to +2pp | NEUTRAL |
| -8pp to -2pp | CAUTION |
| < -8pp | STRESS |
| data missing | PENDING |

Constants in `build_soxl_decay.py`:
```python
FAVORABLE_PP = 2.0
CAUTION_PP   = -2.0
STRESS_PP    = -8.0
```

---

## Data Pipeline

**Source**: `marketflow/data/marketflow.db` → `ohlcv_daily` → `COALESCE(adj_close, close)`

**Build script**: `marketflow/scripts/build_soxl_decay.py`  
**Output**: `marketflow/backend/output/cache/soxl_decay_latest.json`  
**API route**: `/api/soxl-decay`  
**TS contract**: `marketflow/frontend/src/lib/semiconductor/soxlDecay.ts`

---

## UI Mapping

| UI location | Data field |
|-------------|-----------|
| Bridge 5 stat boxes | `metrics[window].{actual/ideal/decayPct}` |
| Bridge 5 status chip | `metrics[window].status` |
| Bridge 5 window selector | `metrics[].window` — client-side selection |
| Bridge 5 interpretation text | `summary.koreanSummary` |
| Right panel mini | `summary.currentDecayPct`, `summary.status` |
| Top KPI bar sub-text | `summary.currentDecayPct`, `summary.status` |

---

## Limitations

1. Simple point-to-point 3x comparison — not daily compound model
2. SOXX/SOXL history required; no external API fallback
3. In strong trends, SOXL can show FAVORABLE (positive path dependency — this is expected behavior, not a data error)
4. Short windows (5D) can be noisy
5. Benchmark label (SOXX vs SMH) must always be shown in UI — never substitute silently

---

## Non-Trading Language Rule

Forbidden: buy / sell / entry / exit / target / stop / overweight / underweight  
Allowed: environment context / volatility drag proxy / decay proxy / caution level / path cost

---

## Relationship to RRG

SOXL Decay is a separate environment indicator, not derived from RRG.  
RRG measures relative sector rotation (RS Ratio / RS Momentum).  
SOXL Decay measures actual vs theoretical 3x leverage efficiency.  
These are independent dimensions of the SOXL environment assessment.
