# Semiconductor Flow / Volume Proxy

## Purpose

Estimate whether semiconductor bucket price moves are supported by volume participation, using local OHLCV data only.

This is a **volume confirmation context layer**, not fund flow data.  
Do not treat this as actual ETF inflow/outflow data.

---

## Data Source

**DB**: `marketflow/data/marketflow.db` → `ohlcv_daily` → `volume` column  
**Tickers used**: same as bucket composition config (`semiconductor_buckets.json`)

---

## Formula

### Ticker-level metrics

```
avgVolume20D   = mean(volume, last 20 trading days)
avgVolume5D    = mean(volume, last 5 trading days)
currentVolume  = last trading day volume

volumeRatioCurrent = currentVolume / avgVolume20D
volumeRatio5D      = avgVolume5D   / avgVolume20D

return5D  = (close_today / close_5D_ago  - 1) × 100
return20D = (close_today / close_20D_ago - 1) × 100
```

### Bucket-level proxy

Weighted average of `volumeRatio5D` across available tickers, using configured weights from `semiconductor_buckets.json`.

```
bucketVolumeScore = Σ(weight_i × volumeRatio5D_i) / Σ(weight_i)
```

Re-normalizes weights for available tickers if some are missing.

---

## Confirmation Rules

| Condition | Label |
|-----------|-------|
| `volumeRatio5D ≥ 1.30` AND `return20D ≥ 0` | **Confirming** |
| `volumeRatio5D ≥ 1.30` AND `return20D < 0` | **Distribution Pressure** |
| `0.80 ≤ volumeRatio5D < 1.30` | **Neutral** |
| `volumeRatio5D < 0.80` | **Thin Participation** |
| some tickers missing, at least one available | **Partial** |
| no tickers available | **Pending** |

Constants in `build_semiconductor_flow_proxy.py`:
```python
SURGE_THRESHOLD = 1.30
THIN_THRESHOLD  = 0.80
```

---

## Bucket Weighting

Inherited from `marketflow/config/semiconductor_buckets.json`:

| Bucket | Tickers | Weights |
|--------|---------|---------|
| AI Compute | NVDA / AVGO / AMD | 0.5 / 0.3 / 0.2 |
| Memory / HBM | MU | 1.0 |
| Foundry / Pkg | TSM | 1.0 |
| Equipment | ASML / AMAT / LRCX / KLAC | 0.25 each |

---

## Missing Data Rules

- Ticker with < 21 trading days in DB → marked missing, excluded from bucket average
- Bucket with all tickers missing → status = `Pending`
- Bucket with partial tickers → status = `Partial`, raw status noted in `note` field
- Missing data always shows as `—` in UI, never zero

---

## Data Pipeline

**Build script**: `marketflow/scripts/build_semiconductor_flow_proxy.py`  
**Output**: `marketflow/backend/output/cache/semiconductor_flow_proxy_latest.json`  
**API route**: `/api/semiconductor-flow-proxy`  
**TS contract**: `marketflow/frontend/src/lib/semiconductor/flowProxy.ts`

---

## UI Placement

- **ENGINE > HEALTH** → compact Flow / Volume Confirmation table (bucket × vol ratio / return / status)
- **Right panel DATA LAB mini** → "Flow Proxy: {status}" row

---

## Limitations

1. Volume from `ohlcv_daily` is raw share volume, not dollar volume or ETF net flow
2. No fund flow (Bloomberg/Refinitiv) — this is participation proxy only
3. Benchmark volume (SOXX/SMH) is available but not currently used in bucket-level calc
4. Short lookback (5D/20D) can be noisy for sparse-trading tickers (e.g. ASML)
5. Do not interpret as evidence of actual institutional buying or selling

---

## Non-Trading Language Rule

Forbidden: buy / sell / entry / exit / accumulation (as signal) / distribution (as bearish call)  
Allowed: Confirming / Neutral / Thin Participation / Distribution Pressure (as volume context only)

---

## Relationship to Other Layers

| Layer | Purpose |
|-------|---------|
| RRG | Relative rotation (RS Ratio / Momentum) |
| Benchmark RS | Absolute / relative return vs SOXX/QQQ/SPY |
| SOXL Decay | Leverage efficiency vs ideal 3x path |
| **Flow Proxy** | Volume participation confirmation (this module) |

Flow Proxy is independent of RRG calculation. It adds a participation dimension to complement rotation data.
