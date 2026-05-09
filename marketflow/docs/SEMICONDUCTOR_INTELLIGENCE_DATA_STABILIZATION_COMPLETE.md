# Semiconductor Intelligence — Data Stabilization Complete

> SOXX/SOXL Lens data stabilization phase completed through DS-11.

---

## 1. Release Status

**Status:** COMPLETE
**Scope:** SOXX/SOXL Lens Data Stabilization
**Completed through:** DS-11 — Final Data Stabilization QA
**UI Redesign:** HOLD
**AI Infrastructure Radar UI Redesign:** HOLD

This release freeze records the completed data stabilization layer for the SOXX/SOXL Lens. The goal of this phase was to make the Lens data traceable, derived, freshness-aware, and internally auditable before continuing with user-facing UI polish.

---

## 2. Product Boundary

### SOXX/SOXL Lens

The SOXX/SOXL Lens quantifies selected internal SOXX drivers using holdings, returns, contribution, and residual participation.

It answers:

- What selected SOXX drivers contributed to the move?
- How much of the move came from selected buckets vs residual holdings?
- Is the internal SOXX structure broad, narrow, or mixed?
- How should SOXL daily sensitivity be interpreted in context?

### AI Infrastructure Radar

The AI Infrastructure Radar monitors broader AI infrastructure themes outside direct SOXX attribution.

It answers:

- Which broader AI infrastructure themes are developing?
- How are those themes related to SOXX/SOXL?
- Which themes have partial price momentum or manual context?

### Separation Rule

SOXX/SOXL Lens is a contribution and structure tool.
AI Infrastructure Radar is an exploratory theme-monitoring tool.

Do not merge these two roles.

---

## 3. Completed Data Stabilization Scope

| Phase | Name | Status | Purpose |
|---|---|---:|---|
| DS-1 | Data Stabilization Review | Complete | Reviewed holdings, mapping, returns, contribution, residual, and partial states. |
| DS-2 | Real Price Return Adapter | Complete | Connected or defined return adapter for 1D / 5D / 1M returns. |
| DS-3 | Contribution History Auto-Generation | Complete | Defined selected vs residual contribution history generation. |
| DS-4 | Data QA / Debug Panel | Complete | Added internal QA/debug visibility for data status. |
| DS-5 | Data Freshness / Reliability | Complete | Defined fresh, delayed, stale, and unknown data states. |
| DS-6 | Data Refresh Automation Plan | Complete | Documented refresh workflow and source-of-truth rules. |
| DS-7 | Daily Price Refresh Script Wiring | Complete | Ensured SOXX + holdings tickers are included in price refresh universe. |
| DS-8 | SOXX Holdings Refresh Workflow | Complete | Defined manual-first official holdings refresh and validation workflow. |
| DS-9 | Contribution Snapshot / History Generation Job | Complete | Defined/generated derived contribution snapshot and 60d history outputs. |
| DS-10 | Data Health / Refresh Status | Complete | Added internal health visibility for generated outputs and logs. |
| DS-11 | Final Data Stabilization QA | Complete | Validated the full data chain from holdings to user-facing Lens output. |

---

## 4. Frozen Data Chain

The SOXX/SOXL Lens data chain is frozen as:

```text
SOXX Holdings
→ SOXX Lens Universe
→ Price Data
→ Returns
→ Holding Contribution
→ Bucket Contribution
→ Selected vs Residual Contribution
→ Contribution Snapshot
→ Contribution History
→ Freshness / Data Health
→ Debug Panel
→ User Lens UI
```

Each output must remain traceable back to holdings and price data.

---

## 5. Current SOXX Holdings Reference

Current reference values:

| Item | Value |
|---|---:|
| Holdings as-of date | 2026-04-29 |
| Equity holdings count | 30 |
| Total weight | 99.89234% |
| Selected coverage | 48.52120% |
| Residual | 51.37114% |

If the code contains newer holdings, the actual code value takes precedence, but the as-of date and validation result must be documented.

---

## 6. Selected Bucket Mapping

Current selected internal SOXX buckets:

| Bucket | Tickers |
|---|---|
| AI Compute | NVDA, AMD, AVGO |
| Memory | MU |
| Equipment | AMAT, ASML, LRCX, KLAC |
| Foundry / Packaging | TSM |
| Residual | All other SOXX holdings |

**Important rule:**

Current buckets represent selected internal SOXX drivers, not the full SOXX index.

Residual means all other SOXX holdings outside selected buckets.

---

## 7. Contribution Formula

Holding-level contribution:

```text
holding contribution %p = holding weight % × holding return % / 100
```

Aggregation:

```text
Bucket contribution = sum of holding contributions inside the bucket
Selected contribution = sum of selected bucket contributions
Residual contribution = sum of unmapped holding contributions
Total contribution = selected contribution + residual contribution
```

Unit rules:

```text
Holding weight = %
Return = %
Contribution = %p
```

---

## 8. Data Status Rules

Use the following status rules consistently:

| Status | Meaning |
|---|---|
| available | All required data is usable. |
| partial | Some data is usable, but some tickers, periods, or files are missing. |
| unavailable | No usable data is available. |
| sample | Development/sample data only; must not be shown as production. |

Missing data must not be silently converted to zero.

Partial and unavailable states must remain visible.

---

## 9. Freshness Rules

Use the following freshness labels:

| Freshness | Meaning |
|---|---|
| fresh | Today or previous trading day. |
| delayed | 2–3 calendar days old. |
| stale | More than 3 calendar days old. |
| unknown | No as-of date available. |

Weekend handling may treat Friday data as acceptable during Saturday/Sunday.

Do not use `live`, `real-time`, or `up-to-the-second` unless that behavior is actually implemented.

---

## 10. Generated Outputs

The contribution generation layer may produce:

```text
marketflow/backend/output/semiconductor/soxx_contribution_snapshot_latest.json
marketflow/backend/output/semiconductor/soxx_contribution_history_60d.json
marketflow/backend/output/semiconductor/soxx_contribution_generation_log.json
```

Rules:

- These are derived outputs.
- They must be generated from holdings and price data.
- They must not be manually edited as source data.
- Failed generation must not destroy the last usable output.
- Generation logs must preserve warnings and errors.

---

## 11. Debug / Data Health

Internal QA visibility is allowed through debug-only views.

Expected debug visibility:

- Holdings validation
- Bucket mapping validation
- Return adapter status
- Contribution snapshot status
- Contribution history status
- Freshness status
- Generated output health
- Missing tickers
- Warnings
- Errors

Debug panels must remain hidden by default and should only appear under explicit debug mode, such as `?debug=1`.

---

## 12. Guardrails

The following must remain true:

- Do not fabricate missing prices, returns, or contribution values.
- Do not silently replace missing returns with zero.
- Do not show sample/mock data as production data.
- Do not hide stale data.
- Do not mark delayed or stale data as live.
- Do not merge AI Infrastructure Radar logic into SOXX/SOXL Lens.
- Do not convert Radar themes into SOXX contribution buckets.
- Do not add trading-signal language.
- Do not redesign UI as part of data stabilization.

Forbidden language:

```text
buy
sell
entry
exit
target
strong buy
prediction
forecast
will outperform
guaranteed
```

Allowed guardrail copy:

```text
Historical structure context only. Not a forecast or trading signal.
SOXL daily sensitivity context, not a multi-day 3x forecast.
Beta context only. Not a forecast, recommendation, or trading signal.
```

---

## 13. HOLD Items

The following items are intentionally held for later phases:

### UI / UX

- SOXX/SOXL Lens user-facing cleanup
- AI Infrastructure Radar subscriber-friendly redesign
- Radar Theme Navigator + Selected Theme Detail layout
- Radar spacing, typography, and card reduction

### Operations

- Full automated scheduler
- Persistent refresh log database
- Production deployment refresh verification
- Railway/Vercel output persistence review

### Product / Copy

- Public product copy
- Landing page explanation
- Subscriber onboarding explanation
- Help / documentation pages

---

## 14. Next Recommended Phases

Recommended next phases:

| Phase | Name | Purpose |
|---|---|---|
| UX-LENS-1 | SOXX/SOXL Lens User-Facing Cleanup | Improve readability without changing data logic. |
| UX-RADAR-1 | AI Infrastructure Radar UI Redesign | Convert Radar from card grid to subscriber-friendly theme navigation. |
| OPS-1 | Deployment Data Persistence Review | Verify generated output behavior on Railway/Vercel. |
| COPY-1 | Semiconductor Intelligence Product Copy | Explain Lens vs Radar clearly for subscribers. |

Recommended order:

```text
1. OPS-1 if preparing deployment
2. UX-LENS-1 if improving user readability
3. UX-RADAR-1 if improving Radar usability
4. COPY-1 before public release
```

---

## 15. Validation Commands

Frontend build:

```bash
cd marketflow/frontend
npm run build
```

Backend generation:

```bash
cd marketflow/backend
python scripts/generate_soxx_contribution_outputs.py
```

Output inspection:

```bash
cd marketflow/backend
ls -lh output/semiconductor/
python -m json.tool output/semiconductor/soxx_contribution_snapshot_latest.json | head -80
python -m json.tool output/semiconductor/soxx_contribution_history_60d.json | head -80
python -m json.tool output/semiconductor/soxx_contribution_generation_log.json | head -80
```

Bad value scan:

```bash
grep -R "NaN\|undefined\|null%" marketflow/frontend/src marketflow/backend/output/semiconductor || true
```

Safety scan:

```bash
grep -R "strong buy\|next winner\|buy signal\|sell signal\|guaranteed beneficiary\|SOXL target\|will outperform\|prediction\|forecast\|entry\|exit" marketflow/frontend/src marketflow/docs marketflow/backend/scripts || true
```

---

## 16. Final Freeze Note

The SOXX/SOXL Lens data stabilization phase is considered complete through DS-11.

Future work should not change the frozen data chain unless a new phase explicitly updates the architecture.

The next work should focus on either:

- user-facing readability,
- deployment/refresh reliability,
- or product explanation.

Data logic should remain stable unless a defect is found.
