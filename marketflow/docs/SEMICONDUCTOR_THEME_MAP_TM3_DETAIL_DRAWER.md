# Semiconductor Theme Map TM-3 Detail Drawer

> Date: 2026-05-12
> Phase: TM-3
> Status: COMPLETE

---

## Purpose

Enhance the Theme Map detail area so that clicking a theme tile presents a
six-section card explaining why the theme matters, what evidence exists, and
what to watch next — without adding new APIs or scoring engines.

---

## Component Created

**`ThemeDetailDrawer`** — defined inside `src/components/ai-infra/ThemeMapPanel.tsx`
(replaces the former `DetailCard` sub-component).

Helper components also added to the same file:
- `RiskBadge` — amber compact badge for risk flags
- `SectionLabel` — uppercase section divider line

---

## Data Used

All data flows from existing sources. No new API routes.

| Data | Source |
|------|--------|
| state_label, state_score, state_reason, state_drivers | AIInfraBucketState |
| confidence, risk_flags, theme_purity | AIInfraBucketState |
| coverage_ratio, data_quality | AIInfraBucketState.source |
| earnings_level, earnings_score, earnings_coverage | AIInfraBucketEarningsConfirmation (added to TileData) |
| evidence_summary, caution_summary | AIInfraBucketEarningsConfirmation |
| rs_1m / rs_3m / rs_6m | AIInfraBucketMomentum (getBenchmarkRS) |
| Related symbols purity metadata | AI_INFRA_COMPANY_PURITY (static) |
| Per-symbol evidence level | getCompanyEarningsEvidence(symbol) (static seed lookup) |

**New TileData fields added:**
- `earnings_score: number | null` — from `e?.confirmation_score`
- `earnings_coverage: number` — from `e?.source.coverage_ratio`

---

## Sections

### 1. Theme Header
- Theme display name (16px bold)
- State badge + state score
- Bucket ID (decorative, 10px)
- Benchmark · Confidence · Coverage · Data quality
- RS 1M / RS 3M / RS 6M row

### 2. State Explanation (WHY THIS STATE)
- Up to 3 bullet points:
  1. `state_reason` (truncated at 140 chars)
  2. `state_drivers[0]` (if exists)
  3. `state_drivers[1]` (if state_reason absent; else omitted to stay ≤3)
- Renders only if state_reason or state_drivers are non-empty
- No long paragraphs — max 3 bullets

### 3. Earnings Confirmation
- `EarningsBadge` + score (color-coded by level) + coverage %
- EVIDENCE row: evidence_summary text
- CAUTION row: caution_summary text (amber), only if earnings_level not null
- CONFIRMED/PARTIAL footnote: "Business evidence only. Not a trading signal."
- DATA_LIMITED/null box: grey box "Insufficient company-level evidence to confirm earnings theme"

### 4. Risk & Data Quality
- Compact amber `RiskBadge` for each active flag:
  Story Heavy · Comm. Risk · Indirect · Low Coverage · Data Insufficient · Overheat · Momentum Stretch
- "No active risk flags" shown when none apply

### 5. Related Symbols
- Source: `AI_INFRA_COMPANY_PURITY.filter(p => p.primary_bucket === bucket_id)`
- Per symbol: `getCompanyEarningsEvidence(symbol)` for evidence level
- **Sort order (TM-3 amendment):**
  1. Evidence level descending (CONFIRMED first via EARN_RANK 0–5)
  2. Then `ai_infra_relevance_score` descending as tiebreaker
  3. Symbols with no evidence data sorted last (rank = 6)
- Maximum 6 symbols displayed
- Per row: Ticker · Company name · Purity label · Evidence badge (if available)
- Fallback: "No mapped symbols available"

### 6. Watch Next
- Rule-based, max 3 items, **priority order:**
  1. Evidence gap (strong RS + weak earnings)
  2. Commercialization risk (story_heavy or comm_risk)
  3. Data limited (DATA_LIMITED or earnings_coverage < 50%)
  4. Indirect exposure
  5. Default (generic confirmation quality) — only if no other items
- No trading language (no buy/sell/entry/exit/target/매수/매도)

---

## Watch Next Rules

| Condition | Item text |
|-----------|-----------|
| RS 3M or 6M > +5% AND earnings NOT CONFIRMED/PARTIAL | Evidence gap: RS outpacing earnings confirmation. Watch for revenue visibility improvement. |
| story_heavy OR comm_risk | Commercialization risk: Monitor whether design activity converts to confirmed revenue. |
| earnings DATA_LIMITED or null OR earnings_coverage < 50% | Data limited: More company-level evidence needed before confirmation level improves. |
| indirect_exp | Indirect exposure: Sector benefit depends on downstream AI infrastructure adoption. |
| None of the above | Confirmation quality: Watch for broadening evidence across covered companies next quarter. |

---

## Related Symbols Sort Order

```
EARN_RANK = { CONFIRMED: 0, PARTIAL: 1, WATCH: 2, NOT_CONFIRMED: 3, DATA_LIMITED: 4, UNKNOWN: 5 }
No evidence → rank 6 (sorted last)

Primary sort: ev_rank ascending (lower = higher quality)
Secondary sort: ai_infra_relevance_score descending
Slice: first 6
```

---

## Responsive Rules

| Width | Drawer layout |
|-------|--------------|
| All | Full-width below tile grid |
| Mobile (<768px) | Same — full-width, single column |
| Mobile | No side-by-side |
| All | No horizontal scroll |
| All | Font size ≥ 10px (10px decorative labels only) |

---

## Non-Goals (TM-3)

- Flow Ladder → TM-4
- Momentum Curve sparklines → TM-5
- Full Sankey → deferred
- LLM narrative → deferred
- New API route → not created
- New scoring engine → not created
- Portfolio linkage → not in scope
- Alerts / trading signals → not in scope

---

## QA Result

| Check | Result |
|-------|--------|
| Tile click updates detail drawer | ✅ |
| Detail shows selected theme only | ✅ |
| Earnings level matches EARNINGS tab | ✅ reads same API path |
| DATA_LIMITED visually conservative | ✅ grey box, not green/teal |
| Story-heavy / indirect risk visible | ✅ RiskBadge in Section 4 |
| Related symbols render safely | ✅ fallback "No mapped symbols available" |
| Missing symbols safe fallback | ✅ |
| Watch Next: max 3 items | ✅ `.slice(0, 3)` |
| Watch Next: no trading language | ✅ no buy/sell/entry/exit/target |
| Watch Next items: maximum 3 confirmed, no trading language | ✅ |
| Mobile no horizontal scroll | ✅ flexWrap on all rows |
| Existing filters still work | ✅ filter logic untouched |
| Heatmap still respects filter | ✅ filteredTiles passed unchanged |
| Existing tabs unaffected | ✅ |
| API unchanged | ✅ |
| TypeScript tsc --noEmit --skipLibCheck | ✅ exit 0 |
| Forbidden language absent | ✅ no buy/sell/매수/매도/predicts/guarantees |

---

## Final Report

| Item | Result |
|------|--------|
| Files inspected | ThemeMapPanel.tsx, aiInfraBucketMap.ts, aiInfraEarningsConfirmation.ts, aiInfraCompanyPurity.ts |
| Files created | ThemeDetailDrawer (inside ThemeMapPanel.tsx), SEMICONDUCTOR_THEME_MAP_TM3_DETAIL_DRAWER.md |
| Files modified | ThemeMapPanel.tsx |
| Detail drawer created? | ✅ ThemeDetailDrawer (6 sections) |
| Tile click behavior | ✅ opens drawer, same-click closes, benchmark switch resets |
| Earnings integration status | ✅ level + score + coverage + evidence + caution |
| Risk/data quality display | ✅ compact RiskBadge per flag |
| Related symbols display | ✅ sorted by evidence level then purity score, max 6 |
| Watch Next rules | ✅ priority-ordered, max 3, no trading language |
| Missing data fallback | ✅ — for RS, "No mapped symbols available" for symbols |
| Responsive status | ✅ full-width below grid on all breakpoints |
| API unchanged? | ✅ |
| Existing Theme Map regression | ✅ none — filter/heatmap/tile logic untouched |
| Existing tabs regression | ✅ none |
| TypeScript status | ✅ exit 0 |
| Forbidden language check | ✅ clean |
| Remaining limitations | Related symbols limited to primary_bucket match only (secondary_buckets not included); state_drivers may be empty for placeholder data |
| Recommended next step | **READY_FOR_TM3B_QA** |

---

## Next Step

**READY_FOR_TM3B_QA**

TM-4 target: Flow Ladder — value chain stage flow visualization with upstream/downstream linkage.
