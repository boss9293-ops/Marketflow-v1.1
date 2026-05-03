# WATCHLIST_TERMINAL_NEWS_ARCHITECTURE_REVIEW

Inspected: 2026-05-03  
Scope: Terminal News · Watchlist News · Synthesis pipeline  
Status: Read-only — no code changed

---

## 1. High-Level Data Flow

```
[Backend]
context_news.py
  └─ Yahoo / Reuters / polygon fetch
  └─ ArticleScore dedup + quality filter
  └─ → backend/output/cache/context_news.json

[Frontend Ticker Layer]
GET /api/terminal/ticker/[symbol]/news
  └─ serverTickerNewsFree.ts → fetchTickerNewsFromYahoo()
  └─ quality scoring + caching
  └─ → TickerNewsItem[]

[CenterPanel — watchlist_mvp]
  └─ Groups news by dateET
  └─ POST /api/terminal/news-synthesize  ← one call per date group
       body: { symbol, items[], langPref, changePct, price, companyName, marketContext }

[news-synthesize/route.ts]
  └─ buildTerminalKoSystemPrompt()     ← newsSynthesizePrompts.ts
  └─ buildTerminalKoUserPrompt()       ← newsSynthesizePrompts.ts
  └─ Call Anthropic (claude-sonnet-4-6) → fallback OpenAI (gpt-4o-mini)
  └─ JSON.parse → SynthesizedItem { id, text, signal, commentary_type, core_question, watch_next }
  └─ Cache (file-based, 8h TTL, per symbol/date/lang)
  └─ EN translation: DeepL → fallback LLM re-synthesis

[CenterPanel rendering]
  └─ briefGenerator.ts → buildSignalPart / buildEventPart / buildContextPart / buildWatchPart
  └─ NewsTerminalCard.tsx → 5-part brief display
       Visible: text (body), signal (bull/bear/neutral), 5-bar strength
       NOT visible: commentary_type, core_question, watch_next  ← gap
```

---

## 2. Source Files Map

| File | Role | Key Functions / Types | Notes |
|------|------|-----------------------|-------|
| `frontend/src/lib/terminal-mvp/newsSynthesizePrompts.ts` | Prompt builders | `buildTerminalKoSystemPrompt`, `buildTerminalKoUserPrompt`, `buildTerminalEnSystemPrompt` | **Phase 1 already upgraded** — includes 9 commentary types, core_question, watch_next |
| `frontend/src/app/api/terminal/news-synthesize/route.ts` | Synthesis orchestrator | POST handler, provider chain, JSON parse, cache | Parses commentary_type/core_question/watch_next but **SynthesizedItem not fully surfaced** |
| `frontend/src/components/watchlist_mvp/CenterPanel.tsx` | Synthesis caller + layout | Lines 546–560 (KO), 616–630 (EN) | Calls news-synthesize, passes result to NewsTerminalCard |
| `frontend/src/components/news/NewsTerminalCard.tsx` | Card renderer | 5-part brief, signal bars | **Does NOT render** commentary_type / core_question / watch_next |
| `frontend/src/lib/terminal-mvp/briefGenerator.ts` | Brief template engine | `buildSignalPart`, `buildEventPart`, `buildContextPart`, `buildWatchPart`, `buildRiskPart` | Rule-based, NOT LLM — builds 5-section MarketBrief from raw signal data |
| `frontend/src/components/watchlist_mvp/MarketNewsPanel.tsx` | Watchlist market news | Lines 80–166 | Raw headlines only, **no LLM synthesis**, separate from terminal pipeline |
| `frontend/src/app/api/terminal/ticker/[symbol]/news/route.ts` | Ticker news fetcher | GET, dedup, TTL cache | Calls serverTickerNewsFree.ts |
| `frontend/src/lib/terminal-mvp/serverTickerNewsFree.ts` | Yahoo news fetch | `fetchTickerNewsFromYahoo`, quality scoring, history caching | Source of TickerNewsItem[] |
| `frontend/src/lib/terminal-mvp/serverNewsStore.ts` | In-memory news store | `upsertNewsDetails`, `appendNewsClick` | Per-request detail store |
| `frontend/src/types/` | TypeScript types | `TickerNewsItem`, `NewsDetail`, `MarketHeadline`, `Watchlist`, `MarketBrief` | MarketBrief is the 5-section struct passed to NewsTerminalCard |
| `backend/news/context_news.py` | Backend macro news cache | `build_context_news_cache`, `ArticleScore` | Feeds MarketNewsPanel (watchlist side), NOT terminal synthesis |
| `backend/news/news_paths.py` | Path constants + schema defs | `CONTEXT_NEWS_PATH`, `TICKER_NEWS_HISTORY_PATH`, read/write helpers | Shared by build scripts |

---

## 3. Current JSON Shape

### SynthesizedItem (route.ts lines 41–48)

```ts
type SynthesizedItem = {
  id: string               // REQUIRED — news item ID from input batch
  text: string             // REQUIRED — KO/EN synthesized commentary (2-3 paragraphs)
  signal?: 'bull' | 'bear' | 'neutral'  // OPTIONAL — parsed from LLM JSON
  commentary_type?: string              // OPTIONAL — one of 9 types (Phase 1 added)
  core_question?: string               // OPTIONAL — Korean question sentence (Phase 1 added)
  watch_next?: string[]                // OPTIONAL — 1-2 watch signals (Phase 1 added)
}
```

### TickerNewsItem (input to synthesis)

```ts
{
  id: string           // REQUIRED
  headline: string     // REQUIRED
  summary?: string     // OPTIONAL
  publishedAt: string  // REQUIRED — ISO timestamp
  source?: string      // OPTIONAL
}
```

### MarketBrief (5-section brief — built by briefGenerator.ts)

```ts
{
  signal: string        // bull / bear / neutral
  strength: number      // 0–10
  parts: {
    SIGNAL: string[]    // Signal assessment lines
    EVENT: string[]     // What happened
    CONTEXT: string[]   // Why it matters
    WATCH: string[]     // Next session watch points
    RISK: string[]      // Risk notes
  }
}
```

---

## 4. Current Prompt Structure

### System Prompt (`newsSynthesizePrompts.ts` lines 29–56, upgraded in Phase 1)

```
You are a MarketFlow research terminal editor.
Write a catalyst-driven Korean commentary following this structure:
  1. What happened — the catalyst, not the price move
  2. Why it matters — causal chain: catalyst → market reaction → implication
  3. Thesis/bucket impact — does this confirm, weaken, or leave uncertain the investment thesis?
  4. Watch next — 1-2 specific signals to monitor in the next 1-3 sessions

The first sentence is provided — copy it exactly as the opening, then continue in Korean.
Do not open with index percentage moves or broad market recap.
Focus on company-specific catalysts and directly relevant policy or macro factors.
Merge multiple articles about the same catalyst into one explanation.
Do not write technical-analysis language, chart talk, or broad index comparisons.
Do not mention source names, outlet names, URLs, or citations in the body.
Write 2-3 dense paragraphs. Sound like a human market analyst, not a data reader.

Commentary type — pick one that best fits:
THESIS_CONFIRMATION | CONTRADICTION_ALERT | EVENT_SETUP | MOMENTUM_STRETCH |
MACRO_PRESSURE | RISK_RELIEF | PULLBACK_WATCH | BREADTH_CHECK | LEADERSHIP_ROTATION

Forbidden: buy, sell, target price, recommendation, must buy, must sell, guaranteed.
Use instead: thesis reinforced, thesis weakened, needs confirmation, constructive setup, watchpoint.

Return JSON only — no markdown, no code block:
{"text":"<Korean commentary>","signal":"bull|bear|neutral","commentary_type":"<TYPE>","core_question":"<one Korean sentence question>","watch_next":["<signal 1>","<signal 2>"]}
```

**Phase 1 already added**: `commentary_type` (9 types), `core_question`, `watch_next`, no buy/sell rule  
**Not yet added**: `event_type`, `why_it_matters`, `thesis_impact`, `impact_direction`, `affected_buckets`, `risk_note`, `contradiction`

### User Prompt (built in `newsSynthesizePrompts.ts` lines 58–80)

Injected fields:
- `symbol` (e.g., NVDA)
- `dateET` (e.g., 2026-05-03)
- `companyName` (e.g., NVIDIA Corporation)
- `marketContext` (optional macro regime string — rarely populated)
- `items[]` — up to 15 headlines as `"HH:MM — headline | summary"`
- `leadSentence` — pre-built Korean opening line (e.g., "엔비디아(NVDA)는 3.21% 하락하며 $112.40에 마감했다,")

### Lead Sentence construction (route.ts lines 564–568)

```
"${koName}(${symbol})는 ${changePct}% ${koDir}하며${koPrice} 마감했다,"
```

### Model chain

| Priority | Provider | Model | temp | max_tokens | timeout |
|----------|----------|-------|------|-----------|---------|
| 1st | Anthropic | claude-sonnet-4-6 | 0.35 | 3200 | 20s |
| 2nd | OpenAI | gpt-4o-mini | 0.35 | 2500 | 20s |
| EN translation | DeepL | Free tier | — | — | 8s |
| EN fallback | LLM re-synthesis | EN system prompt | 0.35 | 2000 | 20s |

---

## 5. Current Rendering Structure

### NewsTerminalCard.tsx — what IS rendered

```
┌──────────────────────────────────────────┐
│ [SIGNAL] ████░ 8/10  · bull · 14:32 ET  │
│ [EVENT]  What triggered the move         │
│ [CONTEXT] Why it matters                 │
│ [WATCH]  Watch in next session           │
│ [RISK]   Risk note                       │
└──────────────────────────────────────────┘
```

Source of 5 sections: `briefGenerator.ts` (rule-based, NOT from LLM `text` field directly)

The LLM `text` field is rendered as-is below the 5-part brief (as free-form commentary).

### What is parsed but NOT rendered

| Field | Parsed in route.ts | Stored in SynthesizedItem | Rendered | Notes |
|-------|-------------------|--------------------------|----------|-------|
| `text` | ✅ | ✅ | ✅ | Main body text |
| `signal` | ✅ | ✅ | ✅ (color/bar) | |
| `commentary_type` | ✅ | ✅ | ❌ | **Phase 1 gap** |
| `core_question` | ✅ | ✅ | ❌ | **Phase 1 gap** |
| `watch_next` | ✅ | ✅ | ❌ | **Phase 1 gap** |

---

## 6. Watchlist vs Terminal Distinction

| Dimension | Watchlist (MarketNewsPanel) | Terminal (CenterPanel + NewsTerminalCard) |
|-----------|----------------------------|-------------------------------------------|
| Data source | Backend context_news.json | Yahoo Finance per-ticker |
| LLM synthesis | ❌ None — raw headlines | ✅ Full synthesis via news-synthesize |
| API route | Backend `/api/context-news` | Frontend `/api/terminal/ticker/[symbol]/news` + `/api/terminal/news-synthesize` |
| Grouping | By trading day (last 5) | By dateET per symbol |
| Ticker scope | Market-wide (SPY/QQQ/VIX/macro) | Stock-specific |
| Commentary type | Not applicable | Produced but not rendered |
| Watchlist connection | Shows market news for all tickers | Per-ticker, user selects symbol in CenterPanel |
| User portfolio link | ❌ No position data connected | ❌ No thesis baseline connected |

---

## 7. Current Weaknesses

| # | Weakness | Impact |
|---|----------|--------|
| 1 | `commentary_type`, `core_question`, `watch_next` parsed but never rendered | Rich semantic output invisible to user |
| 2 | No thesis baseline passed to LLM | "Thesis/bucket impact" synthesized blind — no prior context |
| 3 | `marketContext` is optional and rarely populated | LLM doesn't know if market is risk-on or risk-off |
| 4 | Single synthesis per date group — multiple unrelated catalysts merged | NVDA AI + macro data = one contradictory summary |
| 5 | No multi-day narrative coherence — 8h cache resets everything | Can't say "this confirms risk-off from Tuesday" |
| 6 | `watch_next` signals never validated or followed up | Signal accountability is zero |
| 7 | EN translation may degrade structure — DeepL fallback loses commentary_type | KO→EN: commentary_type/core_question can be lost in translation path |
| 8 | Lead sentence is price-movement-first (`하락하며 마감했다`) | Prompt says "don't open with price move" but lead sentence does exactly that |
| 9 | briefGenerator.ts builds 5 sections from rule-based logic, not from LLM text | Two parallel interpretations of same event |
| 10 | No `affected_buckets`, `event_type`, `impact_direction` fields | Can't connect news to semiconductor cycle or sector bucket |

---

## 8. Safe Insertion Points

The following new fields can be added to the news synthesis schema later:

```json
{
  "event_type": "",
  "why_it_matters": "",
  "thesis_impact": "",
  "impact_direction": "",
  "impact_magnitude": "",
  "affected_buckets": [],
  "risk_note": "",
  "contradiction": "",
  "watch_next": []
}
```

| Field | Insertion File | Function/Type | Risk | Reason |
|-------|---------------|--------------|------|--------|
| `event_type` | `newsSynthesizePrompts.ts` | system prompt + JSON schema | Low | Additive to JSON spec, no existing field conflict |
| `why_it_matters` | `newsSynthesizePrompts.ts` | user prompt instruction | Low | Prompt instruction only, no schema change needed |
| `thesis_impact` | `route.ts` (news-synthesize) | SynthesizedItem type + parse block | Low | Optional field, backward compatible |
| `impact_direction` | `route.ts` (news-synthesize) | SynthesizedItem type + parse block | Low | Optional field |
| `impact_magnitude` | `route.ts` (news-synthesize) | SynthesizedItem type + parse block | Low | Optional field |
| `affected_buckets` | `newsSynthesizePrompts.ts` + `route.ts` | system prompt + SynthesizedItem | Medium | Requires bucket taxonomy to be defined first |
| `risk_note` | `newsSynthesizePrompts.ts` | JSON schema in prompt | Low | Replaces existing RISK section logic |
| `contradiction` | `newsSynthesizePrompts.ts` | JSON schema in prompt | Low | Additive, maps to CONTRADICTION_ALERT type |
| `watch_next` | Already in SynthesizedItem | **Render in NewsTerminalCard** | Low | Already produced — just needs UI wiring |

**Safest first target**: wire `commentary_type`, `core_question`, `watch_next` into `NewsTerminalCard.tsx` — they already exist in the data, cost zero prompt changes.

---

## 9. Recommended Phase Plan

### Phase T1 — Prompt / schema extension only
Extend newsSynthesizePrompts.ts and SynthesizedItem type with new fields.  
Validate LLM output shape against expected schema.  
Files: `newsSynthesizePrompts.ts`, `route.ts` (SynthesizedItem type + parse block)  
No UI changes.

### Phase T2 — Sample output validation
Run 3–5 synthesis test cases against the updated prompt.  
Confirm new fields are present, concise, non-dramatic.  
Files: test script or manual run log

### Phase T3 — Render new fields in NewsTerminalCard
Surface `commentary_type` badge, `core_question` text, `watch_next` bullets.  
This is already zero-cost at the data layer — fields exist in SynthesizedItem.  
Files: `NewsTerminalCard.tsx`, optionally `CenterPanel.tsx`

### Phase T4 — Watchlist Pulse summary
Add a daily pulse card above MarketNewsPanel (watchlist side).  
Aggregates `commentary_type` distribution across portfolio tickers.  
Files: `MarketNewsPanel.tsx` (or new `WatchlistPulse.tsx`), new API route

### Phase T5 — Dashboard linkage
Connect watchlist synthesis signals to dashboard briefing commentary.  
Cross-reference `affected_buckets` with semiconductor cycle state.  
Files: `dashboard/page.tsx`, `BriefingView.tsx`, possibly new aggregation route

---

## Appendix — Key Line References

| Reference | File | Lines |
|-----------|------|-------|
| SynthesizedItem type | `news-synthesize/route.ts` | 41–48 |
| KO synthesis parse block | `news-synthesize/route.ts` | 619–646 |
| EN synthesis parse block | `news-synthesize/route.ts` | 488–496 |
| System prompt (KO) | `newsSynthesizePrompts.ts` | 29–56 |
| User prompt builder | `newsSynthesizePrompts.ts` | 58–80 |
| Lead sentence construction | `news-synthesize/route.ts` | 564–568 |
| CenterPanel synthesis call | `watchlist_mvp/CenterPanel.tsx` | 546–560, 616–630 |
| NewsTerminalCard render | `news/NewsTerminalCard.tsx` | 42–160 |
| briefGenerator 5-part build | `terminal-mvp/briefGenerator.ts` | all |
| MarketNewsPanel (watchlist) | `watchlist_mvp/MarketNewsPanel.tsx` | 80–166 |
| Backend news cache | `backend/news/context_news.py` | 317–462 |
