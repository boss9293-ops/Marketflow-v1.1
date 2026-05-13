# V2 Data Source Decision

> Date: 2026-05-13
> Phase: V2-1
> Status: COMPLETE

---

## Current Price Data Infrastructure

The `theme-momentum` route (`src/app/api/ai-infra/theme-momentum/route.ts`) already:

1. Collects all relevant tickers via `getTickers()` — includes all symbols from `AI_INFRA_BUCKETS` (`.symbols` field) plus SOXX/QQQ/SPY
2. Reads price rows from `ohlcv_daily` SQLite DB via `readTickerRows(db, ticker)`
3. Falls back to Flask backend `/api/chart/{ticker}` for missing tickers
4. Computes RS (1M/3M/6M) for every ticker in the set

---

## ETF Coverage Status

| ETF | In Ticker Set | Notes |
|-----|--------------|-------|
| SOXX | ✅ | explicitly added |
| QQQ | ✅ | explicitly added |
| SPY | ✅ | explicitly added |
| SOXL | ❌ | not in current set — leverage ETF not needed for v2 charts |
| SMH | ❌ | not needed for v2 |

For v2 Sector Pulse Card 90-day chart, sector proxy ETFs can be added as a ticker per bucket (e.g., use primary symbol instead of ETF).

---

## Individual Symbol Coverage Status

Symbols from `AI_INFRA_COMPANY_PURITY` with `primary_bucket` membership are all included in `AI_INFRA_BUCKETS.symbols` or can be added. The route already fetches prices for any symbol present in `bucket.symbols`.

**Lead symbols (top by `ai_infra_relevance_score`) — all fetchable:**

| Bucket | Primary | Secondary | Tertiary |
|--------|---------|-----------|----------|
| AI_CHIP | NVDA | AVGO | AMD |
| HBM_MEMORY | MU | — | — |
| PACKAGING | TSM | ASML | LRCX |
| TEST_EQUIPMENT | TER | ONTO | FORM |
| PCB_SUBSTRATE | TTMI | SANM | FLEX |
| OPTICAL_NETWORK | ANET | COHR | LITE |
| COOLING | VRT | ETN | MOD |
| POWER_INFRA | PWR | HUBB | GEV |
| DATA_CENTER_INFRA | SMCI | EQIX | DLR |
| CLEANROOM_WATER | ECL | XYL | WTS |
| SPECIALTY_GAS | ENTG | LIN | APD |
| RAW_MATERIAL | FCX | SCCO | TECK |
| GLASS_SUBSTRATE | GLW | — | — |

---

## Required New Data

For V2-3/V2-4/V2-5, the following data is needed:

| Data | Volume | Status |
|------|--------|--------|
| 90-day daily candles for lead symbols | ~13 × 90 rows | ✅ Already in `ohlcv_daily` if symbols in bucket.symbols |
| 1W / 1M / 3M return for lead symbols | computed | ✅ `readTickerRows` + date arithmetic |
| Symbol last price + % change | 1 row per symbol | ✅ same infrastructure |

**No new API needed for V2-3 symbol display.** The existing price infrastructure covers all required data.

---

## Candidate Sources Compared

| Option | Cost | Reliability | Recommendation |
|--------|------|-------------|----------------|
| Existing `ohlcv_daily` + `/api/chart` | $0 | Dependent on daily update script | ⭐⭐⭐⭐⭐ (first) |
| Polygon.io | $29/mo | High | ⭐⭐⭐⭐ (if gaps found) |
| Yahoo Finance (unofficial) | $0 | Medium, rate-limited | ⭐⭐ |
| Alpha Vantage | Free tier | Medium, 5 req/min free | ⭐⭐⭐ |
| Tiingo | $10/mo | High | ⭐⭐⭐⭐ |

---

## Recommended Source

**Existing infrastructure first.** The `ohlcv_daily` DB + `readTickerRows` path already supports all 13 lead symbols. No new data source needed for V2-3 MVP.

If coverage gaps appear (symbol not in DB → empty rows), add to `AI_INFRA_BUCKETS.symbols` and re-run the daily update script. The route falls back to Flask backend for missing symbols.

---

## Implementation Path for V2-3/V2-4/V2-5

```
V2-3: Symbol integration
  → Use existing readTickerRows(db, symbol)
  → Compute 1W/1M/3M return: last price vs. price N days ago
  → No new API route — extend existing theme-momentum response

V2-4: Sector Pulse Card
  → 90-day chart: readTickerRows returns up to 90 rows per symbol
  → Display as SVG sparkline

V2-5: Symbol mini-card chart
  → Same data, per-symbol 90-day line
```

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Symbol not in `ohlcv_daily` | Medium | Add to `bucket.symbols`, re-run daily update |
| TSM / ASML not updating daily | Low | Both likely in existing DB |
| FORM / ONTO thin volume data | Low | Fallback to Flask `/api/chart` |
| HBM_MEMORY: only MU available | High | Document limitation; SK하이닉스/삼성 미상장 |
| GLASS_SUBSTRATE: only GLW | Medium | Document as indirect-only bucket |

---

## Conclusion

**READY_FOR_V2_3 via existing infrastructure.** No new price data provider needed for MVP.
