# Semiconductor Benchmark RS / RRG Design

## Phase C-5A — Benchmark Relative Strength Data Wiring

**API route**: `/api/semiconductor-benchmark-rs`  
**Cache file**: `marketflow/backend/output/cache/benchmark_rs_latest.json`  
**Build script**: `marketflow/scripts/build_semiconductor_benchmark_rs.py`

Payload fields consumed by `TabPerformance`:
- `benchmarks[]` — SOXX / SMH absolute returns per timeframe
- `relative` — SOXX vs QQQ/SPY relative strength delta (pp)
- `relativeStatus` — `Leading | Neutral | Lagging | Pending`
- `generatedAt` — ISO timestamp

---

## Phase C-5B — RRG Historical Path Wiring

**Build script**: `marketflow/scripts/build_rrg_paths.py`  
**Formula**: Candidate-D (log-RS EMA trend → z-score normalization), reused from `rrg_candidate_d.py`  
**Output**: `marketflow/backend/output/cache/rrg_paths_latest.json`

---

## Phase C-5C — Bucket Price Proxy

**Build script**: `marketflow/scripts/build_semiconductor_bucket_prices.py`  
**Config**: `marketflow/config/semiconductor_buckets.json`  
**Output**: `marketflow/backend/output/cache/semiconductor_bucket_prices_latest.json`

Bucket composition:
| Bucket | Tickers | Weight |
|--------|---------|--------|
| AI Compute | NVDA / AVGO / AMD | 0.5 / 0.3 / 0.2 |
| Memory / HBM | MU | 1.0 |
| Foundry / Pkg | TSM | 1.0 |
| Equipment | ASML / AMAT / LRCX / KLAC | 0.25 each |

Index = normalized base-100 weighted average of constituent tickers.

---

## Phase C-5D — Semiconductor Ticker Series Data

**Source DB**: `marketflow/data/marketflow.db` table `ohlcv_daily`  
**Build script**: `marketflow/scripts/build_semiconductor_series_data.py`  
**Output**: `marketflow/backend/output/cache/semiconductor_series_data_latest.json`

Tickers exported (last 3 years adj_close):
`NVDA AVGO AMD MU TSM ASML AMAT LRCX KLAC SOXX SMH QQQ SPY`

---

## Phase C-5E — UI RRG Path Wiring

**API route used**: `/api/semiconductor-rrg-paths`  
**Source file**: `marketflow/frontend/src/app/api/semiconductor-rrg-paths/route.ts`  
**UI component**: `SemiconductorRRGCard` inside `AnalysisEngineCoreTab.tsx`

### Payload fields consumed

| Field | Usage |
|-------|-------|
| `series[].id` | mapped to color + short label via `SERIES_META` |
| `series[].label` | display name in legend + interpretation strip |
| `series[].points[].rsRatio` | X coordinate on RRG chart |
| `series[].points[].rsMomentum` | Y coordinate on RRG chart |
| `series[].quadrant` | shown in interpretation strip |
| `series[].direction` | shown in interpretation strip |
| `series[].source` | determines live vs pending render path |
| `series[].note` | shown as sub-label in interpretation strip |
| `dataStatus.hasBucketPath` | drives footer accent color |
| `benchmark` | shown in footer status note |
| `lookback` | shown in footer status note |
| `generatedAt` | shown in footer status note |

### Lookback slicing rule

Payload always contains up to 24W of weekly points.  
Client-side slicing: `path.slice(-(n + 1))` where `n` = selected lookback (4 / 8 / 12 / 24).  
The +1 is required so the polyline includes the trail from point n-1 to point n.

### SOXX default behavior

When `bench === 'SOXX'`:
- Renders series: `ai_compute`, `memory_hbm`, `foundry_pkg`, `equipment`
- Adds a SOXX benchmark dot at (100, 100)
- Uses live payload when `hasLive = true`, otherwise falls back to `SEMI_RRG_BUCKETS` fixture

### QQQ / SPY pending behavior

Bucket-level paths vs QQQ or SPY benchmark are **not yet generated**.  
`soxx_vs_qqq` and `soxx_vs_spy` series are in the payload as benchmark context only — they are not shown as bucket paths.  
When `bench === 'QQQ'` or `bench === 'SPY'`, the card shows a PENDING state with the message:  
`"Bucket path pending for {bench} benchmark"`

Future work: run Candidate-D per bucket with QQQ/SPY as the comparison series and expose as `ai_compute_vs_qqq`, etc.

### Proxy vs full JdK RRG limitation

The formula used (`rrg_candidate_d.py`) is a Candidate-D approximation:
- Log-RS computed daily
- EMA-trend normalized via z-score
- Produces RS Ratio / RS Momentum values comparable to the JdK scale

This is **not** the official JdK RS-Ratio published by Bloomberg.  
The footer labels this as "RRG path: Nw real data" (not "JdK RRG").

### Fallback behavior

| Condition | UI behavior |
|-----------|-------------|
| API fetch fails | Error banner; fixture data hidden; error message shown |
| API loading | Loading spinner text |
| No series for bench | PENDING panel |
| series.source === 'PENDING' | points.length === 0; renders as pending dot |
| bench !== 'SOXX' | Always PENDING (no bucket-vs-QQQ/SPY data) |
| SOXX bench, no live data | Falls back to `SEMI_RRG_BUCKETS` fixture silently |

### Pipeline chain

```
build_semiconductor_series_data.py   (ohlcv_daily → per-ticker series JSON)
→ build_semiconductor_bucket_prices.py  (series → weighted bucket proxy index)
→ build_rrg_paths.py                    (bucket series + Candidate-D → path JSON)
```

Run all three via: `python marketflow/scripts/build_semiconductor_rrg_pipeline.py`
