# MARKETFLOW NEWS RANKING LAYER — ARCHITECTURE LOCK
**Version:** v1.7  
**Locked:** 2026-05-03  
**Phases:** N1 → N6 + TA cleanup  

---

## 1. Purpose

The MarketFlow News Layer is **not technical analysis**.

It ranks market events and catalysts by structural importance.  
It explains thesis impact, sector structure, risk transmission, and watchpoints.

| In scope | Out of scope |
|---|---|
| Market events (macro, earnings, policy) | Chart patterns |
| Catalyst identification | Trading setups |
| Thesis confirm / weaken signal | RSI / MACD / moving averages |
| Sector / supply chain impact | Breakout / breakdown framing |
| Risk transmission path | Entry / exit / stop loss |
| Watchpoints (next 1-3 sessions) | Buy / sell / target price recommendation |

---

## 2. Completed Flow

```
raw news items (FinnHub / Yahoo Finance / Google News KR)
  │
  ▼
eventRanker.ts — rankEvents()
  │  classifyEvent(title + headline only — NOT summary)
  │  eventRankScore = relevanceBase + eventTypeBonus + tagBonus
  │                   + tickerBonus + sourceBonus + recencyBonus
  │
  ▼
Ranked list  [rank 1 = LEAD | rank 2-4 = SUPPORTING | rank 5+ = BACKGROUND]
  │
  ▼
buildBriefingContext()  →  BriefingContext
  │  top_story        (rank 1, BriefingTopStory)
  │  supporting_drivers (rank 2-4, BriefingDriver[])
  │  background_items  (rank 5+)
  │
  ▼
news-synthesize/route.ts
  │  briefingCtx built BEFORE cache check
  │  cache hit path: itemsWithCtx spreads top_story + supporting_drivers
  │  cache miss path: LLM receives buildStructuredItemLines() prompt
  │
  ▼
LLM (Claude / OpenAI)
  │  receives: TOP STORY anchor | SUPPORTING DRIVERS | BACKGROUND
  │  outputs: text, signal, commentary_type, core_question, watch_next
  │
  ▼
SynthesizedItem  { text, signal, commentary_type, core_question,
                   watch_next, top_story, supporting_drivers }
  │
  ▼
CenterPanel.tsx — TOP STORY block (isFirstItem only)
  [TOP STORY] [eventType] #1 · {score}pt
  headline (2-line clamp)
  supporting drivers #2–#4
```

---

## 3. Files

| File | Role | Version |
|---|---|---|
| `src/lib/terminal-mvp/eventRanker.ts` | Scoring + ranking engine | N1 (multi-component) |
| `src/lib/terminal-mvp/newsSynthesizePrompts.ts` | Briefing context + LLM prompt | v1.7 |
| `src/app/api/terminal/news-synthesize/route.ts` | API handler + cache logic | N3 |
| `src/components/watchlist_mvp/CenterPanel.tsx` | TOP STORY UI rendering | N5 |

---

## 4. eventRanker.ts — Scoring Formula

```typescript
eventRankScore =
  (relevanceScore ?? 0.5) * 50    // relevanceBase  [0–50]
  + eventTypeBonus                 // event priority [0–25]
  + tagBonus                       // tag signals    [0–∞]
  + tickerBonus                    // key tickers    [+3 each]
  + sourceBonus                    // source trust   [0–4]
  + recencyBonus                   // age            [0–5]
```

**Classification:** `title + headline` only. Summary is fallback if both empty.  
Prevents Benzinga-style macro summary from polluting classification of unrelated articles.

---

## 5. Event Types

Priority order (highest bonus first):

| Event Type | Bonus | Notes |
|---|---|---|
| FOMC | 25 | Fed/rates — highest structural priority |
| INFLATION | 24 | CPI / PPI / PCE |
| ENERGY_SHOCK | 23 | Oil / OPEC / energy crisis |
| GEOPOLITICAL | 20 | Trade war, sanctions, conflict — bare `war` removed |
| AI_INFRASTRUCTURE | 20 | AI capex, GPU demand, data center |
| SEMICONDUCTOR | 18 | NVDA/TSMC/ASML/chip cycle |
| CAPEX | 18 | Capital spending signals |
| CREDIT_LIQUIDITY | 18 | Yield curve, credit spreads, systemic risk |
| MARKET_STRUCTURE | 16 | VIX, options expiry, gamma, margin call |
| EARNINGS | 14 | EPS / revenue events |
| GUIDANCE | 14 | Forward guidance changes |
| MACRO | 14 | GDP, jobs, ISM |
| REGULATION | 10 | SEC, FTC, antitrust, court rulings |
| SUPPLY_CHAIN | 10 | Inventory, logistics, shortages |
| ANALYST_ACTION | 8 | Upgrades / downgrades / institutional price targets |
| OTHER | 0 | No dominant category matched |

**Note:** `TECHNICAL_ANALYSIS` is not an event type in this layer. TA headlines classify as `OTHER` or `MARKET_STRUCTURE` (broad market structure only).

---

## 6. Commentary Types

```
THESIS_CONFIRMATION
CONTRADICTION_ALERT
CATALYST_WATCH          ← replaces EVENT_SETUP (removed: "setup" = TA language)
MOMENTUM_STRETCH
MACRO_PRESSURE
RISK_RELIEF
PULLBACK_WATCH
BREADTH_CHECK
LEADERSHIP_ROTATION
```

`EVENT_SETUP` was removed in v1.7. `CATALYST_WATCH` is the replacement.

---

## 7. Guardrails

### Prompt-level (enforced in `buildTerminalKoSystemPrompt`)
- No technical-analysis language, chart talk, or broad index comparisons
- No source names, URLs, or citations in body
- Lead sentence anchored to TOP STORY event
- Hierarchy: TOP STORY → SUPPORTING DRIVERS → BACKGROUND (no reordering)

### Forbidden output vocabulary
```
buy | sell | target price | recommendation | must buy | must sell | guaranteed
technical analysis | chart pattern | breakout | breakdown | support | resistance
RSI | MACD | Bollinger | moving average | MA50 | MA100 | MA200
trendline | bull flag | bear flag | cup and handle | head and shoulders
golden cross | death cross | overbought | oversold | pivot
setup | entry | exit | stop loss
```

### Allowed vocabulary
```
thesis reinforced | thesis weakened | needs confirmation
developing catalyst | watchpoint | catalyst emerging
market reaction | sector rotation | risk premium
demand signal | supply disruption | margin impact
```

### Analyst price target
Allowed **only** as `ANALYST_ACTION` classification context.  
e.g., "Goldman raises NVDA to $200" = institutional action, not TA.  
Forbidden as recommendation language in briefing output.

---

## 8. QA Results (N6 — 2026-05-03)

### 3-Case Summary Table

| Symbol | EventType | Score | Top Story | Supporting | Verdict |
|---|---|---|---|---|---|
| NVDA | ENERGY_SHOCK | 48 | Oil Surges To $115, Stocks Slide As Trump Deadline Looms | AI_INFRASTRUCTURE × 2, SEMICONDUCTOR | ✅ PASS |
| TSLA | ENERGY_SHOCK | 48 | Oil Surges To $115, Stocks Slide As Trump Deadline Looms | GEOPOLITICAL × 2 (Iran ceasefire, TSLA bump), SEMICONDUCTOR | ✅ PASS |
| NFLX | GUIDANCE | 40 | Netflix price increases expected to lift full-year guidance | EARNINGS, REGULATION, OTHER | ✅ PASS |

### Static Code Path Checks (12/12 PASS)
- `isFirstItem && topStory` guard — TOP STORY renders only on index [0,0]
- Null safety — missing topStory hides block gracefully
- EN/KO parity — both paths read from same `briefingCtx`
- State reset — `setSynthTopStory(new Map())` on symbol/date change
- Score plausible — all 3 cases in [25–80] range
- EventType specific — no `OTHER` as lead

### TA Cleanup Validation (Post-patch)

**NVDA:**
- Before: Supporting #2 `SEMICONDUCTOR — NVDA Sideways Trap` (false GEOPOLITICAL via "Iran" in summary)
- After: Supporting #2 `AI_INFRASTRUCTURE — Samsung AI Memory Shortage` (headline-only classification fix)

**TSLA:**
- No change needed — ENERGY_SHOCK lead + Iran ceasefire supporting correct

**NFLX:**
- Before: Lead `GEOPOLITICAL — Netflix…Won the War` (false positive: bare `\bwar\b`)
- After: Lead `GUIDANCE — Netflix price increases expected to lift full-year guidance` (GEOPOLITICAL pattern fixed)

---

## 9. Known Watchpoints

| Item | Description | Action if triggered |
|---|---|---|
| ENERGY_SHOCK dominance | Oil/macro items tend to dominate multi-stock feeds (same article in NVDA, TSLA, NFLX) | Acceptable — top story correctly represents market context. No change needed. |
| Score compression (stale news) | recencyBonus=0 when all news >24h old; top 5 scores cluster within 5pt | Expected behavior. Structural event type ordering still correct. |
| Supporting driver relevance | MARKET_STRUCTURE / SEMICONDUCTOR items sometimes appear as supporting drivers for non-related stocks | Monitor. Apply future relevance filter if needed. |
| Analyst action wording | ANALYST_ACTION rankingReason uses "momentum catalyst" — borderline but not TA | Acceptable in current form. |
| PULLBACK_WATCH commentary type | "pullback" is common TA term; here it means risk-watch context | Acceptable. If ambiguity found in LLM output, add explicit clarification to prompt. |

---

## 10. Architecture Invariants (Do Not Break)

1. `briefingCtx` is built **before** any cache check — ensures cache hits retain current ranking
2. Classification is on `title + headline` only — never `title + headline + summary`
3. GEOPOLITICAL pattern has no bare `\bwar\b` — metaphorical use blocked
4. `EVENT_SETUP` is permanently removed — use `CATALYST_WATCH`
5. TOP STORY block renders **only** on `isFirstItem && topStory` — never on subsequent items
6. State maps (`synthTopStory`, `synthSupportingDrivers`) reset on symbol **or** date change
7. Supporting driver text uses `#737880` minimum — never `#555a62` (below 3.0:1 contrast floor)
