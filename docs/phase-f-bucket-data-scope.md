# Phase F Step 4 — Bucket and Data Scope Lock
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Document and lock the minimal data scope for the Semiconductor Engine.
No new tickers or data sources are added beyond this definition.

---

## 2. Locked Bucket Definitions

### AI Compute
| Ticker | Role |
|--------|------|
| NVDA | AI GPU leadership |
| AMD | AI GPU alternative |
| AVGO | AI networking / custom silicon |

### Memory
| Ticker | Role |
|--------|------|
| MU | Primary — always used |
| Samsung (tier2) | Optional — used only when tier2 data available |
| SK Hynix (tier2) | Optional — used only when tier2 data available |

### Foundry / Packaging
| Ticker | Role |
|--------|------|
| TSM | Primary and sole foundry proxy |

### Equipment
| Ticker | Role |
|--------|------|
| ASML | Lithography (primary) |
| AMAT | Deposition / etch (primary) |
| LRCX | Etch (primary) |
| KLAC | Process control (primary) |

### Benchmark
| Ticker | Role |
|--------|------|
| SOXX | Primary semiconductor anchor |
| QQQ | Cross-asset reference (engine internal only) |

---

## 3. Data Fields Used per Ticker

| Field | Usage |
|-------|-------|
| `return_5d` | Short-term momentum |
| `return_20d` | Bucket spread vs SOXX (primary AI Regime input) |
| `return_30d` | Medium-term trend |
| `slope_30d` | Direction of momentum |
| `above_20dma` | Structure quality |

Tier2 fields (Samsung, SK Hynix):
| Field | Usage |
|-------|-------|
| `samsung_trend` | Memory confirmation adjustment (+1pp/-1pp) |
| `skhynix_trend` | Memory confirmation adjustment (+1pp/-1pp) |

---

## 4. Data Source Lock

| Source | Location | Status |
|--------|----------|--------|
| Live semiconductor data | `backend/output/cache/semiconductor_market_data.json` | Primary |
| Fallback snapshot | `backend/output/semiconductor_mvp_latest.json` | Fallback |
| VR replay (2022) | `backend/output/replay/2022_tightening.json` | Playback only |
| VR replay (2020) | `backend/output/replay/2020_covid.json` | Playback only (partial) |

---

## 5. What Is Out of Scope

The following are explicitly excluded from this engine:

| Category | Examples | Reason |
|----------|---------|--------|
| Additional tickers | INTC, QCOM, MRVL, ARM | Not in locked bucket map |
| Macro data | Fed rate, CPI, PMI | Separate module (macro page) |
| News/sentiment | Headlines, sentiment scores | Separate module (briefing page) |
| Valuation data | P/E, EV/EBITDA | Not part of structural flow |
| Portfolio data | Holdings, allocation | Separate module (portfolio page) |
| Historical price series | Daily OHLCV for bucket charts | Not in current data pipeline |

---

## 6. Bucket Label Standardization

Use these labels consistently across all UI, docs, and code:

| Internal key | Display label |
|---|---|
| `ai_infra` / `ai` | AI Compute |
| `memory` / `mem` | Memory |
| `foundry` | Foundry |
| `equipment` / `equip` | Equipment |
| `soxx` | SOXX |

---

## 7. AI Regime Lens Scope Lock

The AI Regime Lens uses exactly these inputs:

| Component | Tickers | Field |
|-----------|---------|-------|
| AI Infrastructure Leadership | NVDA, AMD, AVGO | `return_20d` |
| Memory Confirmation | MU (+ tier2) | `return_20d` + tier2 direction |
| Foundry Support | TSM | `return_20d` |
| Equipment Follow-through | ASML, AMAT, LRCX, KLAC | `return_20d` |
| Rotation Risk | All 4 spreads | computed |

No additional tickers will be added to the AI Regime Lens without a design review.

---

## 8. Success Criteria

```
[✅] Bucket definitions locked (4 buckets + benchmark)
[✅] Ticker list locked per bucket
[✅] Data fields documented
[✅] Out-of-scope items explicitly listed
[✅] UI label standardization enforced (AI Compute, Memory, Foundry, Equipment)
[✅] AI Regime Lens scope locked
```

---

## 9. Next Step

**Phase F Step 5 — Final Purpose QA**
Every visible element must answer one of the 5 core questions.
