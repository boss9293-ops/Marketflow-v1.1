# MARKETFLOW_NEWS_PROCESSING_GAP_ANALYSIS

Inspected: 2026-05-03  
Phase N1 implemented: 2026-05-03  
Scope: Terminal news pipeline · Backend context news · Synthesis route · Prompt layer  
Status: Phase N1 complete — event ranking wired

---

## 1. Current Data Flow

```
[Backend — market-wide only]
context_news.py
  └─ CompositeNewsProvider: Yahoo + Reuters + AP + Google News RSS
  └─ _article_score(): keyword hits × recency × publisher weight
  └─ _dedupe_articles(): headline text clustering across sources
  └─ top-5 by score → output/cache/context_news.json
  └─ → MarketNewsPanel (watchlist) — raw headlines, NO synthesis

[Frontend — ticker-specific only]
serverTickerNewsFree.ts
  └─ Yahoo Finance API + Google News RSS (free tier only)
  └─ inferTags(): regex → analyst/earnings/guidance/regulatory/macro
  └─ inferRelevanceScore(): symbol match + topical + source boost → 0.35–0.98
  └─ Bucketing: best item per (dateET × am/pm slot)
  └─ Hard cap: 200 items / ticker

GET /api/terminal/ticker/[symbol]/news
  └─ Returns TickerNewsItem[] — no score, no tag exported to client

POST /api/terminal/news-synthesize
  └─ selectRelevantItems(): catalyst keyword scoring, cap 12
  └─ [N1] rankEvents(): event classification + structural bonus scoring
  └─ [N1] rankedSelected passed to buildTerminalKoUserPrompt
  └─ Hard cap: 20 items/batch input, 15 items passed to LLM
  └─ Lead sentence: global price/changePct (not per-item)
  └─ [N1] LLM receives: [#N|ROLE|EVENT_TYPE] timestamp — headline | summary
  └─ [N1] System prompt instructs: lead with LEAD item, not time order
  └─ LLM output: text, signal, commentary_type, core_question, watch_next
  └─ → CenterPanel inline rendering
```

---

## 2. Raw News Fields Available

### Frontend TickerNewsItem (serverTickerNewsFree.ts)
| Field | Available | Sent to LLM |
|-------|-----------|-------------|
| id | ✅ | ❌ |
| symbol | ✅ | ❌ |
| dateET | ✅ | ✅ (as timestamp) |
| publishedAtET | ✅ | ✅ (as timestamp) |
| timeET | ✅ | ✅ (fallback) |
| headline | ✅ | ✅ |
| summary | ✅ | ✅ |
| source | ✅ | ❌ (stripped per prompt rule) |
| url | ✅ | ❌ |
| tags (analyst/earnings/…) | ✅ (computed) | ❌ |
| relevanceScore | ✅ (computed) | ❌ |
| **rank** | ✅ [N1] | ✅ [N1] (as prefix) |
| **is_lead** | ✅ [N1] | ✅ [N1] (as prefix) |
| **eventType** | ✅ [N1] | ✅ [N1] (as prefix) |
| **role** | ✅ [N1] | ✅ [N1] (as prefix) |
| sentiment | ❌ | ❌ |
| price at publish | ❌ | ❌ |

---

## 3. Hard Caps Summary

| Stage | Limit | File |
|-------|-------|------|
| Stored per ticker | 200 items | serverTickerNewsFree.ts:13 |
| Backend context news | 5 articles / run | context_news.py:319 |
| Synthesis batch input | 20 items | news-synthesize/route.ts:57 |
| Items sent to LLM | 15 items | newsSynthesizePrompts.ts:22 |
| Anthropic max_tokens | 2500 | news-synthesize/route.ts:259 |
| OpenAI max_tokens | 2500 | news-synthesize/route.ts:305 |

---

## 4. Weakness Classification

| Category | Severity | Phase N1 Status |
|----------|----------|-----------------|
| Source weakness | Low | Not addressed — Yahoo+Google sufficient for MVP |
| Processing weakness | HIGH | **Partially fixed** — ranking signals now reach LLM |
| Prompt weakness | Medium | **Fixed** — LEAD/SUPPORTING/BACKGROUND prefix + ranking instruction |
| Ranking weakness | HIGH | **Fixed** — eventRanker.ts with structural event bonuses |
| Market reaction linkage weakness | HIGH | Not yet addressed — global changePct only |
| Rendering weakness | Low | Fixed prior session — commentary_type/core_question/watch_next rendered |

---

## 5. Phase N1 — What Was Implemented

### New file: `frontend/src/lib/terminal-mvp/eventRanker.ts`

**Event types (16):**
```
FOMC | INFLATION | EARNINGS | GUIDANCE | CAPEX | AI_INFRASTRUCTURE
SEMICONDUCTOR | ENERGY_SHOCK | GEOPOLITICAL | REGULATION | SUPPLY_CHAIN
ANALYST_ACTION | CREDIT_LIQUIDITY | MARKET_STRUCTURE | MACRO | OTHER
```

**Ranking formula:**
```
eventRankScore = eventTypeBonus (0–2.5)
              + sourceBonus    (0–0.30)
              + recencyBonus   (0–0.15)
```

**eventTypeBonus values:**
| EventType | Bonus |
|-----------|-------|
| FOMC | 2.50 |
| INFLATION | 2.20 |
| EARNINGS | 2.00 |
| GUIDANCE | 2.00 |
| ENERGY_SHOCK | 1.80 |
| MACRO | 1.80 |
| AI_INFRASTRUCTURE | 1.80 |
| GEOPOLITICAL | 1.60 |
| SEMICONDUCTOR | 1.60 |
| CAPEX | 1.60 |
| CREDIT_LIQUIDITY | 1.40 |
| REGULATION | 1.30 |
| MARKET_STRUCTURE | 1.30 |
| ANALYST_ACTION | 1.20 |
| SUPPLY_CHAIN | 1.20 |
| OTHER | 0.00 |

**Design decisions:**
- Recency capped at 0.15 — prevents time order from overriding structural importance
- Source bonus capped at 0.30 — Reuters/Bloomberg signal quality, not dominance
- Tie-break by original position (stable sort)
- `role`: LEAD (rank 1), SUPPORTING (rank 2–4), BACKGROUND (rank 5+)

### Modified files

**`newsSynthesizePrompts.ts`**
- `TerminalNewsPromptItem` extended with optional ranking fields
- `buildItemLines()` now prefixes each item: `[#N|ROLE|EVENT_TYPE]`
- `buildTerminalKoSystemPrompt()` now instructs: "Treat LEAD item as anchor. Do not follow time order."

**`news-synthesize/route.ts`**
- Import `rankEvents` from `eventRanker`
- `rankedSelected = rankEvents(selected)` inserted after `selectRelevantItems()`
- `buildTerminalKoUserPrompt()` receives `rankedSelected` (ranked order)
- Result `id` uses `rankedSelected[0].id` (lead story, not time-first)
- Cache key still uses original `selected` for stability

---

## 6. LLM Context — Before vs After

### Before (Phase N0)
```
2026-05-02 14:32 - NVDA drops 3% amid broader selloff | Market-wide risk-off
2026-05-02 11:15 - Fed signals higher for longer | Powell remarks at IMF
2026-05-02 09:30 - NVDA analyst raises price target to $150
```
*LLM had no signal about which item was most important. Latest item = implicit lead.*

### After (Phase N1)
```
[#1|LEAD|FOMC] 2026-05-02 11:15 - Fed signals higher for longer | Powell remarks at IMF
[#2|SUPPORTING|ANALYST_ACTION] 2026-05-02 09:30 - NVDA analyst raises price target to $150
[#3|BACKGROUND|OTHER] 2026-05-02 14:32 - NVDA drops 3% amid broader selloff | Market-wide risk-off
```
*LLM instructed: "Treat LEAD item as synthesis anchor. Core Question should reflect the highest-ranked driver."*

---

## 7. Remaining Gaps (Post N1)

| # | Gap | Suggested Phase |
|---|-----|-----------------|
| 1 | `relevanceScore` from serverTickerNewsFree not passed through CenterPanel to synthesis | N2 |
| 2 | `tags` from inferTags() not passed through | N2 |
| 3 | Per-item price reaction delta (±% within 15 min of headline) not computed | N3 |
| 4 | Multi-source headline clustering before synthesis (same story from 3 sources) | N3 |
| 5 | Multi-day story continuity — ranker has no memory of prior day's lead | N4 |
| 6 | Backend context news (Reuters/AP) not bridged to terminal synthesis | N4 |

---

## 8. Appendix — Source File Reference

| File | Key Lines | Role |
|------|-----------|------|
| `frontend/src/lib/terminal-mvp/eventRanker.ts` | **NEW** | Event classification + ranking |
| `frontend/src/lib/terminal-mvp/newsSynthesizePrompts.ts` | 4–18, 33–41, 46–51 | Prompt + type |
| `frontend/src/app/api/terminal/news-synthesize/route.ts` | 10, 558–560, 603, 643, 678 | Ranking integration |
| `frontend/src/lib/terminal-mvp/serverTickerNewsFree.ts` | 13, 149–156, 419–453 | Fetch, score, bucket |
| `backend/news/context_news.py` | 85–161, 319, 344–365 | Backend article scoring |
