# SOXX Holdings Refresh Procedure

## Overview

SOXX holdings are the source of truth for all contribution math in the SOXX/SOXL Lens engine.  
Holdings must be refreshed when iShares publishes a new fund composition update (typically monthly).

---

## Snapshot Locations

| Layer | File |
|-------|------|
| Backend (Python) | `marketflow/backend/data/semiconductor/soxx_holdings_snapshot.json` |
| Frontend (TypeScript) | `marketflow/frontend/src/lib/semiconductor/soxxHoldingsSnapshot.ts` |

Both files must be updated together. They must remain in sync.

---

## Data Source

**Official source:** iShares SOXX fund page  
**Fields needed per holding:** Ticker, Name, Weight (%)

Download the fund holdings CSV/Excel from the official iShares product page.  
Exclude cash rows, derivative rows, and any row with no ticker.

---

## Refresh Steps

### Step 1 — Download new holdings

Download the latest holdings file from the official iShares SOXX product page.  
Note the `as_of_date` shown on the download page.

### Step 2 — Update backend JSON

Edit `marketflow/backend/data/semiconductor/soxx_holdings_snapshot.json`:

```json
{
  "as_of_date": "YYYY-MM-DD",
  "download_date": "YYYY-MM-DD",
  "source_note": "Official iShares SOXX fund data download; holdings as of YYYY-MM-DD; downloaded YYYY-MM-DD.",
  "holdings": [
    { "ticker": "AVGO", "name": "BROADCOM INC", "weightPct": 7.91532, "bucketId": "ai_compute", "driverClass": "internal_driver" },
    ...
  ]
}
```

Rules:
- `weightPct` is percent value (e.g., `7.91` means 7.91%). Do not use decimal form.
- `bucketId` is `null` for residual holdings.
- `driverClass` is `"internal_driver"` for selected-bucket holdings, `"residual"` for all others.
- Do not add or remove bucket assignments without Architect approval.

### Step 3 — Update frontend TypeScript snapshot

Edit `marketflow/frontend/src/lib/semiconductor/soxxHoldingsSnapshot.ts`:

1. Update `SOXX_HOLDINGS_SNAPSHOT_AS_OF`
2. Update `SOXX_HOLDINGS_SNAPSHOT_DOWNLOAD_DATE`
3. Update the `SOXX_HOLDINGS_SNAPSHOT` array to match the new holdings

### Step 4 — Run validation

```bash
cd marketflow/backend
python scripts/check_soxx_holdings.py
```

Expected output:
```
SOXX Holdings Validation
File: ...soxx_holdings_snapshot.json
As-of date: YYYY-MM-DD
Holdings count: 30
Total weight: 99.89234%
Selected bucket tickers: 9
Status: PASS
  All checks passed.
```

### Step 5 — Run price coverage check

```bash
cd marketflow/backend
python scripts/check_soxx_lens_price_coverage.py
```

Verify that all new tickers have price data.  
If new tickers are missing, add them to the price refresh universe and run `update_ohlcv.py`.

### Step 6 — Run frontend build

```bash
cd marketflow/frontend
npm run build
```

Must complete without TypeScript errors in the semiconductor lib files.

---

## Bucket Mapping Rules

Current selected buckets and their tickers:

| Bucket ID | Tickers |
|-----------|---------|
| `ai_compute` | NVDA, AMD, AVGO |
| `memory` | MU |
| `equipment` | AMAT, ASML, LRCX, KLAC |
| `foundry_packaging` | TSM |
| residual | all other SOXX holdings |

Rules:
- Do not add new buckets without an explicit WORK_ORDER.
- Do not reassign residual tickers to selected buckets without Architect approval.
- If a selected-bucket ticker is dropped from SOXX, mark it as `driverClass: "residual"` and `bucketId: null`.

---

## Validation Checks

The validation script (`check_soxx_holdings.py`) and frontend helper (`soxxHoldingsValidation.ts`) verify:

| Check | Rule |
|-------|------|
| as-of date | Must be present |
| holding count | Must be > 0 |
| total weight | Must be 98%–101% |
| duplicate tickers | None allowed |
| zero/missing weights | Warn if found |
| multi-bucket assignment | No ticker in > 1 bucket |

---

## Data Contract

```
holdings[].ticker       string   Required. Normalized uppercase. e.g. "NVDA"
holdings[].name         string   Required. Fund display name.
holdings[].weightPct    number   Required. Percent, e.g. 7.91532 means 7.91%.
holdings[].bucketId     string|null  null for residual.
holdings[].driverClass  "internal_driver"|"residual"
as_of_date              string   YYYY-MM-DD. iShares as-of date.
download_date           string   YYYY-MM-DD. Date file was downloaded.
source_note             string   Provenance string for audit trail.
```

---

## Price Universe Dependency

After refreshing holdings, the SOXX Lens price refresh universe must include every new ticker.  
`update_ohlcv.py` automatically reads `soxx_holdings_snapshot.json` via `soxx_lens_universe.py`  
and appends any missing tickers to the refresh run.

No manual ticker list editing required — the JSON snapshot is the single source of truth.

---

## Frequency

| Trigger | Action |
|---------|--------|
| iShares publishes new holdings (typically monthly) | Full refresh: JSON + TS + validation + price check |
| Ticker added to SOXX mid-cycle | Partial refresh: add to JSON + TS, run price coverage |
| Ticker removed from SOXX | Mark as residual in snapshot; do not delete from price history |
