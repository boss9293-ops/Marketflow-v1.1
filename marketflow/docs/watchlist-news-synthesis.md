# Watchlist News Synthesis Rules

## Purpose

Watchlist news synthesis produces a **catalyst-driven news brief** for each stock.
The goal is identical to professional terminals (Bloomberg, Terminal X): tell the user
*why* the stock moved today, citing real events and sources — not chart behavior.

---

## Output Format

```
{company}({symbol}) closed [up|down|unchanged] +X.XX% at $YYY.YY,
[Reason paragraph 1 — the primary catalyst, source-cited]
[Paragraph 2 — context, analyst reaction, or secondary catalyst]
[Paragraph 3 — forward-looking risk or confirmation, optional]
```

- Length: ~400–600 characters
- Signal tag: `bull` | `bear` | `neutral`
- Language: English (server-side) → DeepL KO translation

---

## ALLOWED Topics

Write **only** about these event types:

| Category | Examples |
|---|---|
| **Earnings** | EPS beat/miss, revenue vs estimate, guidance raise/cut |
| **Analyst actions** | Upgrade/downgrade (firm name + price target) |
| **Product / pipeline** | Launch, FDA approval/CRL, FCC ruling, clinical trial result |
| **Management** | CEO/CFO comment, investor day, conference call quote |
| **Corporate action** | M&A announcement, buyback, dividend change, share offering |
| **Regulatory / policy** | Tariff ruling on company's products, sector-specific legislation |
| **Competitive** | Key partnership, licensing deal, competitor announcement affecting this stock |

---

## STRICTLY FORBIDDEN

Never mention any of the following:

### Technical Analysis (100% banned)
- Moving averages: MA20, MA50, MA200, SMA, EMA, death cross, golden cross
- Oscillators: RSI, MACD, Stochastic, CCI, Williams %R
- Volatility bands: Bollinger Bands, ATR, Keltner Channels
- Chart patterns: head & shoulders, cup & handle, triangle, wedge
- Levels: support, resistance, pivot points, Fibonacci levels
- Volume analysis: on-balance volume, accumulation/distribution
- Candlestick signals: doji, engulfing, hammer, etc.
- Any phrase like "broke above", "bounced off", "tested support"

### Market-Wide Context
- S&P 500, Nasdaq, Dow Jones comparisons
- "Risk-on / risk-off" macro sentiment
- Broad market rally/selloff used to explain individual stock moves

---

## Signal Logic

| Signal | Criteria |
|---|---|
| `bull` | Catalyst is net positive: earnings beat + raised guidance, upgrade, FDA approval, accretive deal |
| `bear` | Catalyst is net negative: earnings miss, downgrade, regulatory rejection, guidance cut |
| `neutral` | Mixed signals, or move is macro-driven with no specific company catalyst |

---

## Bad vs Good Example

**Bad (technical):**
> TSLA closed up 7.63% at $391.83. Tesla's stock reclaimed the 50-day moving average after bouncing off support at $360, triggering a technical breakout with RSI climbing above 55.

**Good (catalyst-driven):**
> Tesla (TSLA) closed up 7.63% at $391.83 as Elon Musk confirmed the next-gen AI5 autonomous chip reached tape-out and entered manufacturing. UBS raised its rating to Neutral. Analysts cited humanoid robotics and FSD expansion as long-term catalysts ahead of the April 22 earnings.

---

## Implementation

- **Route**: `src/app/api/terminal/news-synthesize/route.ts`
- **Function**: `buildBriefSystemPromptEN()` — enforces all rules above
- **Translation**: EN result → DeepL KO (once per trading day, file-cached)
- **Cache**: `.cache/deepl-ko-cache.json` keyed by `${symbol}:${dateET}`
- **Day boundary**: 16:00 EDT (market close) — `getLatestTradingDateET()`
