# MARKETFLOW BRIEFING QUALITY VALIDATION
## Phase N4 — Real Data Quality Check
**Date:** 2026-05-03  
**Pipeline:** eventRanker v1.6 → buildBriefingContext → TOP STORY / SUPPORTING DRIVERS / BACKGROUND prompt  
**News input:** Real cached ticker-news-history.json (April 7–8, 2026)  
**Briefing cache:** synth-ko-cache.json (v1.5, pre-N3)

---

## Test Case 1 — NVDA (April 7–8, 2026)

### Context
Market day: Oil spikes to $115, Trump tariff deadline imminent, geopolitical/macro macro pressure.  
NVDA had no direct catalyst — surrounding news was dominated by macro/AI supply chain discussion.

### Top 5 Ranked

| Rank | Role | Event Type | Score | Headline |
|---:|---|---|---:|---|
| 1 | **LEAD** | ENERGY_SHOCK | 48.0 | Oil Surges To $115, Stocks Slide As Trump Deadline Looms |
| 2 | SUPPORTING | GEOPOLITICAL | 46.0 | Where Nvidia Stock Needs to Trade to Get Out of Its Sideways Trap |
| 3 | SUPPORTING | GEOPOLITICAL | 45.0 | ASML Caught In Crossfire As US-China Chip War Escalates |
| 4 | SUPPORTING | GEOPOLITICAL | 45.0 | Samsung Cashes In Big As AI Memory Shortage Fuels Profit Explosion |
| 5 | BACKGROUND | AI_INFRASTRUCTURE | 45.0 | Nvidia-Backed Firmus Raises $505M As AI Data Center Boom Accelerates |

### Briefing Context

```json
{
  "top_story": { "rank": 1, "role": "LEAD", "eventType": "ENERGY_SHOCK",
    "headline": "Oil Surges To $115, Stocks Slide As Trump Deadline Looms: What's Moving Markets Tuesday?",
    "rankingReason": "[matched: Oil Surges]", "eventRankScore": 48 },
  "supporting_drivers": [
    { "rank": 2, "role": "SUPPORTING", "eventType": "GEOPOLITICAL", "headline": "Where Nvidia Stock Needs to Trade to Get Out of Its Sideways Trap", "rankingReason": "[matched: Iran]" },
    { "rank": 3, "role": "SUPPORTING", "eventType": "GEOPOLITICAL", "headline": "ASML Caught In Crossfire As US-China Chip War Escalates", "rankingReason": "[matched: China Chip]" },
    { "rank": 4, "role": "SUPPORTING", "eventType": "GEOPOLITICAL", "headline": "Samsung Cashes In Big As AI Memory Shortage Fuels Profit Explosion", "rankingReason": "[matched: Middle East]" }
  ],
  "background_count": 8
}
```

### Cached v1.5 Briefing
> 엔비디아(NVDA)는 4.01% 상승하며 $216.61에 마감했다, 그러나 당일 제공된 뉴스 흐름은 NVDA 자체의 직접적 촉매보다는 Vera Rubin 플랫폼 공급망 수혜 여부를 둘러싼 주변 종목 논의에 집중되어 있다. [...]

Note: The v1.5 cache is from a different news batch (April 27 — Vera Rubin supply chain stories). This batch is April 7–8 macro/oil data.

### Expected Core Question (N3 pipeline, if run live)
> 유가 $115 급등과 트럼프 관세 마감 압박이 동시에 작용하는 가운데,  
> **AI 반도체 수요 사이클의 구조적 강세가 매크로 리스크를 흡수할 수 있는가, 아니면 ASML·Samsung 공급망 불확실성이 섹터 전체를 압박하는가?**

### Quality Judgment

| Check | Result | Notes |
|---|---|---|
| Top Story quality | ✅ PASS | Oil $115 / Trump deadline WAS the macro driver of Apr 7-8 |
| Top Story market-wide (not noise) | ✅ PASS | ENERGY_SHOCK is market-wide |
| RankingReason explains why | ⚠️ PARTIAL | "[matched: Oil Surges]" correct but terse; causal chain not stated |
| Supporting #2 correct? | ❌ FAIL | "NVDA Sideways Trap" is TECHNICAL ANALYSIS — matched GEOPOLITICAL via "Iran" in summary text |
| Supporting #3 correct? | ✅ PASS | "ASML US-China Chip War" is legitimately GEOPOLITICAL |
| Supporting #4 correct? | ❌ FAIL | "Samsung AI Memory" matched GEOPOLITICAL via "Middle East" in summary text — false positive |
| Firmus AI Data Center at background | ✅ PASS | Correctly deprioritized |

**Issue Type: Summary text false positive** — Benzinga articles reference global macro context in summaries, causing unrelated articles to match GEOPOLITICAL keywords.

---

## Test Case 2 — TSLA (April 7–8, 2026)

### Context
Market day: Oil at $115 on Apr 7, then Iran ceasefire on Apr 8 causes oil to drop. TSLA got "Iran bump" — EV benefit from lower oil prices. Tesla regulatory win and Intel/Terafab AI partnership also in news.

### Top 5 Ranked

| Rank | Role | Event Type | Score | Headline |
|---:|---|---|---:|---|
| 1 | **LEAD** | ENERGY_SHOCK | 48.0 | Oil Surges To $115, Stocks Slide As Trump Deadline Looms |
| 2 | SUPPORTING | GEOPOLITICAL | 46.0 | Nasdaq tech leads strong Wall Street rebound after Iran ceasefire deal |
| 3 | SUPPORTING | GEOPOLITICAL | 46.0 | Tesla Stock Jumps Despite Slumping Oil Prices. Why It's Getting an Iran Bump. |
| 4 | SUPPORTING | SEMICONDUCTOR | 43.0 | Microsoft Is Now The Biggest Deadweight On S&P 500 — And Exxon Is What Nvidia Used To Be |
| 5 | BACKGROUND | SEMICONDUCTOR | 43.0 | Intel Stock Surges 2% As Elon Musk Partnership Targets 1 Terawatt Of AI Power |

### Briefing Context

```json
{
  "top_story": { "eventType": "ENERGY_SHOCK", "headline": "Oil Surges To $115...", "eventRankScore": 48 },
  "supporting_drivers": [
    { "eventType": "GEOPOLITICAL", "headline": "Nasdaq tech leads strong Wall Street rebound after Iran ceasefire deal" },
    { "eventType": "GEOPOLITICAL", "headline": "Tesla Stock Jumps Despite Slumping Oil Prices. Why It's Getting an Iran Bump." },
    { "eventType": "SEMICONDUCTOR", "headline": "Microsoft Is Now The Biggest Deadweight On S&P 500..." }
  ],
  "background_count": 11
}
```

### Quality Judgment

| Check | Result | Notes |
|---|---|---|
| Top Story quality | ✅ PASS | Oil $115 / macro shock is correct macro driver for Apr 7 |
| Supporting #2 correct? | ✅ PASS | Iran ceasefire → oil drop → market rebound is legitimate supporting driver |
| Supporting #3 correct? | ✅ PASS | "TSLA Iran Bump" directly explains TSLA price action relative to oil |
| Supporting #4 correct? | ⚠️ WEAK | "MSFT deadweight / Exxon is what Nvidia used to be" is commentary, not a direct TSLA catalyst |
| Two-day inversion visible? | ⚠️ NOTE | Oil surge Apr 7 then ceasefire Apr 8 — both in context. The ranker correctly picks oil surge (Apr 7) as LEAD but ceasefire (Apr 8) as SUPPORTING — coherent two-act story |
| Background noise controlled | ✅ PASS | Intel/Terafab, SpaceX partnership, bearish JP Morgan analyst — all background |

**Verdict: ✅ PASS** — TSLA's Iran/oil narrative is correctly structured.

---

## Test Case 3 — NFLX (April 7–8, 2026)

### Context
NFLX news batch: court refund ruling (regulatory), Goldman WB deal analysis, Jefferies guidance lift, quarterly results miss. This is a single-stock batch with no macro driver.

### Top 5 Ranked

| Rank | Role | Event Type | Score | Headline |
|---:|---|---|---:|---|
| 1 | **LEAD** | GEOPOLITICAL | 46.0 | Netflix Lost the Battle for Warner Bros, but Goldman Sachs Says It Won the War |
| 2 | SUPPORTING | EARNINGS | 40.0 | Netflix price increases expected to lift full-year guidance: Jefferies |
| 3 | SUPPORTING | EARNINGS | 40.0 | Netflix (NFLX) Slid as Results Fell Short of Expectations |
| 4 | SUPPORTING | REGULATION | 36.0 | Netflix told by court to refund customers over repeated price hikes |

### Briefing Context

```json
{
  "top_story": { "eventType": "GEOPOLITICAL", "headline": "Netflix Lost the Battle for Warner Bros, but Goldman Sachs Says It Won the War", "rankingReason": "[matched: War]", "eventRankScore": 46 },
  "supporting_drivers": [
    { "eventType": "EARNINGS", "headline": "Netflix price increases expected to lift full-year guidance: Jefferies" },
    { "eventType": "EARNINGS", "headline": "Netflix (NFLX) Slid as Results Fell Short of Expectations" },
    { "eventType": "REGULATION", "headline": "Netflix told by court to refund customers over repeated price hikes" }
  ],
  "background_count": 0
}
```

### Quality Judgment

| Check | Result | Notes |
|---|---|---|
| Top Story quality | ❌ FAIL | "Goldman says NFLX won the war" = M&A strategy article. Labeled GEOPOLITICAL via metaphorical "war". Wrong. |
| Correct lead should be | ✅ — | "Netflix Slid as Results Fell Short" (EARNINGS) or "price increases expected to lift guidance" (GUIDANCE) |
| Supporting drivers correct? | ✅ PASS | EARNINGS and REGULATION are the right supporting themes |
| eventType label for rank 1 | ❌ FAIL | GEOPOLITICAL is wrong — should be GUIDANCE or EARNINGS |
| RankingReason | ❌ FAIL | "[matched: War]" is misleading — "war" is metaphorical, not geopolitical |

**Verdict: ❌ FAIL** — Root cause: `\bwar\b` in GEOPOLITICAL pattern matches metaphorical use of "war" in financial headlines.

---

## Cross-Case Structural Checks

| Check | Result | Notes |
|---|---|---|
| Exactly one `is_lead: true` | ✅ PASS | All 3 cases |
| Rank 2–4 as supporting | ✅ PASS | Structure maintained |
| Recency bonus not dominating | ✅ PASS | All news old (0 recency) — structure based purely on event type |
| Backward compat | ✅ PASS | text/signal/commentary_type/core_question preserved |
| TOP STORY section in prompt | ✅ PASS | LLM receives labeled hierarchy |
| BACKGROUND section separated | ✅ PASS | Background items labeled clearly |

---

## Issues Found

### Issue 1 — GEOPOLITICAL `\bwar\b` false positive (CRITICAL)
**Severity:** High — causes wrong LEAD in NFLX case  
**Example:** "Netflix...Says It Won the War" → matched `\bwar\b` → GEOPOLITICAL lead  
**Fix:** Remove bare `\bwar\b` from GEOPOLITICAL pattern. Replace with `\b(trade war|proxy war|war risk|civil war|war in|war on)\b` plus keep `geopolit|sanction|iran|ukraine|russia|tariff|taiwan strait|north korea|middle east`.

### Issue 2 — Summary text pollution: unrelated articles match GEOPOLITICAL via summary
**Severity:** Medium — affects supporting driver classification  
**Examples:**  
- "NVDA Sideways Trap" headline matched GEOPOLITICAL because "Iran" appeared in article summary text  
- "Samsung AI Memory" matched GEOPOLITICAL because "Middle East" appeared in summary context  
**Fix:** Apply eventType classification to headline only (not headline + summary). Reserve summary for disambiguation only.

### Issue 3 — Score compression when recency = 0
**Severity:** Low  
**Example:** NVDA top 5 all score 45–48; ranking signal is very weak  
**Cause:** All news >24h old → recencyBonus=0. Event type bonuses spread only 5 points (48 vs 43).  
**Fix (optional):** No action needed — score compression on stale news is expected. The ordering is still structurally correct.

---

## Recommended Fixes (Small — apply before N5)

### Fix 1 — GEOPOLITICAL pattern (eventRanker.ts, ~line 56)

```typescript
// BEFORE
pattern: /\b(war|sanction|trade war|tariff|taiwan strait|north korea|middle east|iran|ukraine|russia|geopolit)\b/i

// AFTER
pattern: /\b(trade war|proxy war|war risk|civil war|sanction|tariff|taiwan strait|north korea|middle east|iran|ukraine|russia|geopolit|military strike|armed conflict)\b/i
```

Remove `\bwar\b` alone. Keep all specific phrases.

### Fix 2 — Classify on headline only (eventRanker.ts classifyEvent call)

```typescript
// BEFORE (in rankEvents)
const text = `${item.title ?? ''} ${item.headline} ${item.summary ?? ''}`

// AFTER — use headline+title only for classification, summary as fallback only
const classifyText = `${item.title ?? ''} ${item.headline}`
const text = classifyText || `${item.summary ?? ''}`
```

This prevents summary text from importing spurious keywords from unrelated macro context in Benzinga-style news aggregation.

---

## PASS / FAIL Summary

| Symbol | Top Story | Core Question Anchor | Supporting Correct | Background Controlled | Verdict |
|---|---|---|---|---|---|
| NVDA | ✅ ENERGY_SHOCK correct for context | ✅ (simulated) | ✅ after fix (AI_INFRA + SEMICONDUCTOR) | ✅ | ✅ PASS |
| TSLA | ✅ ENERGY_SHOCK → Iran/oil narrative | ✅ (simulated) | ✅ | ✅ | ✅ PASS |
| NFLX | ✅ GUIDANCE after fix (was false GEOPOLITICAL) | ✅ after fix | ✅ | ✅ | ✅ PASS |

---

## Failure Classification (NFLX)

| Category | Status |
|---|---|
| Ranking formula issue | No |
| EventType classification issue | **YES — `war` false positive** |
| Prompt issue | No |
| Source/candidate issue | No |
| Rendering issue | No |
| LLM overrule issue | N/A (pre-LLM) |

---

## Recommendation

**MINOR TUNE — 2 fixes applied 2026-05-03. N5 can proceed.**

### Post-fix re-ranking (verified)

**NVDA after fix:**
- #1 LEAD ENERGY_SHOCK: Oil Surges To $115 ✅
- #2 SUPPORTING AI_INFRASTRUCTURE: Samsung AI Memory Shortage ✅ (was false GEOPOLITICAL)
- #3 SUPPORTING AI_INFRASTRUCTURE: Firmus AI Data Center ✅ (promoted from background)
- #4 SUPPORTING SEMICONDUCTOR: NVDA Sideways Trap ✅ (was false GEOPOLITICAL at #2)

**TSLA after fix:** unchanged — ENERGY_SHOCK lead + Iran ceasefire supporting ✅

**NFLX after fix:**
- #1 LEAD GUIDANCE: Netflix price increases expected to lift full-year guidance ✅ (was false GEOPOLITICAL)
- #2 SUPPORTING EARNINGS: Results Fell Short ✅
- #3 SUPPORTING REGULATION: Court refund ruling ✅
- #4 BACKGROUND OTHER: "Won the War" metaphor → demoted to rank 4 ✅

**All 3 cases: ✅ PASS after fixes.**

**N5 (UI rendering of Top Story / Supporting Drivers in briefing panel) is cleared to proceed.**
