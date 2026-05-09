# MARKETFLOW EVENT RANKER VALIDATION
## Phase N2 — Output Quality Validation
**Date:** 2026-05-03  
**Formula:** `eventRankScore = (relevanceScore ?? 0.5) * 50 + eventTypeBonus + tagBonus + tickerBonus + sourceBonus + recencyBonus`  
**File:** `marketflow/frontend/src/lib/terminal-mvp/eventRanker.ts`

---

## Test Setup

All 4 cases simulate production-realistic news batches with no pre-set `relevanceScore` or `tags`
(defaults: `relevanceScore=0.5` → base=25, `tagBonus=0`).  
Source/recency vary per item. Tickers assigned where appropriate.  
Scores are deterministic — computed by simulation against actual formula constants.

Score breakdown notation: `base + eventTypeBonus + tagBonus + tickerBonus + sourceBonus + recencyBonus`

---

## Case 1 — FOMC Lead

### Input
| # | Headline | Source | Age |
|---|---|---|---|
| 1 | Powell signals rate cuts may be delayed amid sticky inflation — FOMC minutes released | Reuters | 2h |
| 2 | CPI rises 0.4% in March; core inflation above consensus for third straight month | Bloomberg | 4h |
| 3 | Apple Q2 EPS beats estimate by 8%; shares up 3% after hours | CNBC | 1h |
| 4 | S&P 500 ends flat, Nasdaq -0.5% as markets await macro data | Yahoo Finance | 5h |
| 5 | Goldman upgrades MSFT to Buy, raises price target to $520 | MarketWatch | 3h |

### Ranked News Table

| Rank | Role | Event Type | Score | Headline | Key Matched |
|---:|---|---|---:|---|---|
| 1 | **LEAD** | FOMC | **59.00** | Powell signals rate cuts may be delayed… | `Powell` |
| 2 | SUPPORTING | INFLATION | 58.00 | CPI rises 0.4% in March; core inflation above consensus… | `CPI` |
| 3 | SUPPORTING | EARNINGS | 46.00 | Apple Q2 EPS beats estimate by 8%… | `EPS` |
| 4 | SUPPORTING | MACRO | 45.00 | S&P 500 ends flat… as markets await macro data | `macro data` |
| 5 | BACKGROUND | ANALYST_ACTION | 43.00 | Goldman upgrades MSFT to Buy… | `price target` (MSFT +3) |

Score components — rank 1: `25 + 25 + 0 + 0 + 4 + 5 = 59`  
Score components — rank 5: `25 + 8 + 0 + 3 + 2 + 5 = 43`

### LLM Context — Top 3

```json
{"rank":1,"role":"LEAD","is_lead":true,"eventType":"FOMC","eventRankScore":59,"rankingReason":"[matched: Powell]","relevanceScore":null,"tags":null}
{"rank":2,"role":"SUPPORTING","is_lead":false,"eventType":"INFLATION","eventRankScore":58,"rankingReason":"[matched: CPI]","relevanceScore":null,"tags":null}
{"rank":3,"role":"SUPPORTING","is_lead":false,"eventType":"EARNINGS","eventRankScore":46,"rankingReason":"[matched: EPS]","relevanceScore":null,"tags":null}
```

Prompt string injected (format: `[#N|ROLE|TYPE] timestamp - headline`):
```
[#1|LEAD|FOMC] 2026-05-03 10:00 - Powell signals rate cuts may be delayed amid sticky inflation — FOMC minutes released
[#2|SUPPORTING|INFLATION] 2026-05-03 08:00 - CPI rises 0.4% in March; core inflation above consensus for third straight month
[#3|SUPPORTING|EARNINGS] 2026-05-03 11:00 - Apple Q2 EPS beats estimate by 8%; shares up 3% after hours
```

### Generated Core Question (simulated)
> 연준의 금리 인하 지연 신호와 연속 상승하는 인플레이션 데이터가 겹친 지금,  
> **기술주 밸류에이션이 지탱될 수 있는가, 아니면 실질금리 상승 압력이 재개되는가?**

### PASS / FAIL

| Check | Result |
|---|---|
| Rank 1 makes sense? | ✅ PASS — Powell/FOMC is structural driver |
| EventType correct? | ✅ PASS — FOMC |
| RankingReason explains why? | ✅ PASS — matched `Powell` |
| ANALYST_ACTION did not lead? | ✅ PASS — rank 5 |
| Time order stopped dominating? | ✅ PASS — newest (Apple, 1h) is rank 3, not rank 1 |
| FOMC–INFLATION gap tight (59 vs 58)? | ⚠️ NOTE — gap is only 1pt; if a stronger CPI headline appears, INFLATION could take lead |

**Verdict: ✅ PASS**

---

## Case 2 — Energy Shock Lead

### Input
| # | Headline | Source | Age |
|---|---|---|---|
| 1 | Iran threatens to close Strait of Hormuz as regional tensions escalate | Reuters | 1h |
| 2 | WTI crude spikes 4% on Middle East supply disruption fears | Bloomberg | 2h |
| 3 | NVDA falls 2.1% on sector rotation to defensive names amid oil spike | CNBC | 3h |
| 4 | Utilities ETF XLU rallies 1.5% as investors rotate to defensive sectors | Yahoo Finance | 4h |
| 5 | Brent crude at $95, highest level since October 2023 | Reuters | 6h |

### Ranked News Table

| Rank | Role | Event Type | Score | Headline | Key Matched |
|---:|---|---|---:|---|---|
| 1 | **LEAD** | ENERGY_SHOCK | **57.00** | Iran threatens to close Strait of Hormuz… | `Hormuz` |
| 2 | SUPPORTING | ENERGY_SHOCK | 57.00 | WTI crude spikes 4% on Middle East… | `WTI` |
| 3 | SUPPORTING | ENERGY_SHOCK | 55.00 | Brent crude at $95, highest since Oct 2023 | `Brent` (6h → rec=+3) |
| 4 | SUPPORTING | SEMICONDUCTOR | 53.00 | NVDA falls 2.1% on sector rotation… | `NVDA` (+3 ticker) |
| 5 | BACKGROUND | OTHER | 31.00 | Utilities ETF XLU rallies 1.5%… | — |

Tie-break: items 1 and 2 both score 57; item 1 wins by stable original-position sort.  
Note: `Iran...Hormuz` matched ENERGY_SHOCK (bonus 23) before GEOPOLITICAL (bonus 20) — correct by priority; economic supply impact outweighs political label.

### LLM Context — Top 3

```json
{"rank":1,"role":"LEAD","is_lead":true,"eventType":"ENERGY_SHOCK","eventRankScore":57,"rankingReason":"[matched: Hormuz]","relevanceScore":null,"tags":null}
{"rank":2,"role":"SUPPORTING","is_lead":false,"eventType":"ENERGY_SHOCK","eventRankScore":57,"rankingReason":"[matched: WTI]","relevanceScore":null,"tags":null}
{"rank":3,"role":"SUPPORTING","is_lead":false,"eventType":"ENERGY_SHOCK","eventRankScore":55,"rankingReason":"[matched: Brent]","relevanceScore":null,"tags":null}
```

### Generated Core Question (simulated)
> 호르무즈 봉쇄 위협과 WTI 4% 급등이 동시에 발생한 지금,  
> **에너지 공급 충격이 인플레이션 기대치를 다시 높여 연준의 금리 경로를 재조정시킬 것인가?**

### PASS / FAIL

| Check | Result |
|---|---|
| Rank 1 makes sense? | ✅ PASS — ENERGY_SHOCK is dominant driver |
| EventType correct? | ✅ PASS — ENERGY_SHOCK (Hormuz = oil supply chokepoint) |
| RankingReason explains? | ⚠️ PARTIAL — `matched: Hormuz` is minimal; full reason chain (oil → inflation → rates → tech) not in rankingReason string |
| Defensive rotation at rank 4? | ✅ PASS |
| Utilities noise at background? | ✅ PASS — rank 5, score 31 |
| Issue: top 3 all ENERGY_SHOCK | ⚠️ ISSUE — no deduplication penalty; 3 oil headlines dominate the LLM context; sector rotation signal (NVDA) may be underweighted |

**Verdict: ✅ PASS (with duplicate-clustering note)**

---

## Case 3 — AI Infrastructure Lead

### Input
| # | Headline | Source | Age |
|---|---|---|---|
| 1 | Microsoft hyperscaler capex: AI infrastructure spending plan reaches $80B in 2025 | Bloomberg | 2h |
| 2 | NVDA GPU demand surges on hyperscaler AI spending — data center backlog extends to Q4 | Reuters | 1h |
| 3 | TSMC AI training chip capacity fills through 2026; ASML EUV orders at record | Reuters | 3h |
| 4 | AMD raises full-year AI chip guidance to $5.5B; semiconductor cycle strengthens | CNBC | 4h |
| 5 | Treasury yields steady at 4.32%, dollar index flat on light volume | Yahoo Finance | 5h |

### Ranked News Table

| Rank | Role | Event Type | Score | Headline | Key Matched |
|---:|---|---|---:|---|---|
| 1 | **LEAD** | **SEMICONDUCTOR** | **58.00** | TSMC AI training chip capacity fills through 2026… | `TSMC` (TSM+ASML +6) |
| 2 | SUPPORTING | AI_INFRASTRUCTURE | 57.00 | Microsoft hyperscaler capex: AI infrastructure… | `AI infrastructure` (MSFT +3) |
| 3 | SUPPORTING | AI_INFRASTRUCTURE | 57.00 | NVDA GPU demand surges on hyperscaler AI spending… | `GPU demand` (NVDA +3) |
| 4 | SUPPORTING | SEMICONDUCTOR | 53.00 | AMD raises full-year AI chip guidance… | `AMD` (AMD +3) |
| 5 | BACKGROUND | OTHER | 31.00 | Treasury yields steady… | — |

Score components — rank 1: `25 + 18(SEMICONDUCTOR) + 0 + 6(TSM+ASML) + 4 + 5 = 58`  
Score components — rank 2: `25 + 20(AI_INFRA) + 0 + 3(MSFT) + 4 + 5 = 57`

**Issue identified:** TSMC headline has "AI training chip" but pattern `ai training` is NOT in AI_INFRA keyword list (only `llm training` is). TSMC matches SEMICONDUCTOR before AI_INFRA, and the 2-ticker bonus (+6) pushes it to rank 1 with SEMICONDUCTOR label.

The top 3 narrative is correct (all AI infra plays), but the LEAD's `eventType` is SEMICONDUCTOR, not AI_INFRASTRUCTURE.

### LLM Context — Top 3

```json
{"rank":1,"role":"LEAD","is_lead":true,"eventType":"SEMICONDUCTOR","eventRankScore":58,"rankingReason":"[matched: TSMC | tickers: TSM,ASML]","relevanceScore":null,"tags":null}
{"rank":2,"role":"SUPPORTING","is_lead":false,"eventType":"AI_INFRASTRUCTURE","eventRankScore":57,"rankingReason":"[matched: AI infrastructure | tickers: MSFT]","relevanceScore":null,"tags":null}
{"rank":3,"role":"SUPPORTING","is_lead":false,"eventType":"AI_INFRASTRUCTURE","eventRankScore":57,"rankingReason":"[matched: GPU demand | tickers: NVDA]","relevanceScore":null,"tags":null}
```

### Generated Core Question (simulated)
> TSMC의 AI 반도체 생산 능력 소진과 NVDA/MSFT의 AI 인프라 투자 사이클이 맞물린 지금,  
> **하이퍼스케일러 AI 지출 사이클이 2026년까지 지속될 수 있는 수요 기반이 확인되고 있는가?**

### PASS / FAIL

| Check | Result |
|---|---|
| Rank 1 story is right? | ✅ PASS — top story is TSMC AI chip (relevant) |
| EventType label correct? | ⚠️ PARTIAL FAIL — labeled SEMICONDUCTOR, should be AI_INFRASTRUCTURE or CAPEX |
| Top 3 narrative coherent? | ✅ PASS — all AI infra plays appear in top 3 |
| Time order stopped dominating? | ✅ PASS — newest (NVDA, 1h) is rank 3 |
| Noise at background? | ✅ PASS — Treasury at rank 5 |
| Root cause | AI_INFRA pattern lacks `\bai training\b`; 2-ticker bonus on TSMC item is valid but causes mislabel |

**Verdict: ⚠️ PARTIAL PASS — narrative correct, eventType label wrong for rank 1. Requires small pattern fix.**

---

## Case 4 — Analyst Action Should NOT Lead

### Input
| # | Headline | Source | Age |
|---|---|---|---|
| 1 | Goldman Sachs upgrades NVDA to Strong Buy, raises price target to $900 | MarketWatch | 1h |
| 2 | Powell: Too early to declare victory on inflation — rate cuts not imminent per FOMC | Reuters | 2h |
| 3 | S&P 500 breadth narrows; VIX spikes to 18 intraday amid policy uncertainty | Bloomberg | 3h |
| 4 | AAPL Q2 earnings beat: EPS $1.52 vs $1.42 expected, revenue $91B | CNBC | 4h |
| 5 | Meta capital expenditure plan raised to $65B for full year — AI data center investment | Bloomberg | 5h |

### Ranked News Table

| Rank | Role | Event Type | Score | Headline | Key Matched |
|---:|---|---|---:|---|---|
| 1 | **LEAD** | FOMC | **59.00** | Powell: Too early to declare victory on inflation… | `Powell` |
| 2 | SUPPORTING | CAPEX | 55.00 | Meta capital expenditure plan raised to $65B… | `capital expenditure` (META +3) |
| 3 | SUPPORTING | SEMICONDUCTOR | 53.00 | Goldman Sachs upgrades NVDA to Strong Buy… | `NVDA` (NVDA +3) |
| 4 | SUPPORTING | EARNINGS | 46.00 | AAPL Q2 earnings beat: EPS $1.52… | `Q2 earnings` |
| 5 | BACKGROUND | OTHER | 34.00 | S&P 500 breadth narrows; VIX spikes to 18… | — (pattern miss) |

**Issue identified (two):**
1. Goldman/NVDA upgrade headline matched SEMICONDUCTOR (bonus 18) before ANALYST_ACTION (bonus 8) because "NVDA" fires first. Result: score 53 instead of 43. Labeling is wrong but score is acceptable — it didn't lead.
2. "VIX spikes" (plural) does NOT match pattern `vix spike` (singular) in MARKET_STRUCTURE rule. Item falls to OTHER (score 34). Should be ~50.

### LLM Context — Top 3

```json
{"rank":1,"role":"LEAD","is_lead":true,"eventType":"FOMC","eventRankScore":59,"rankingReason":"[matched: Powell]","relevanceScore":null,"tags":null}
{"rank":2,"role":"SUPPORTING","is_lead":false,"eventType":"CAPEX","eventRankScore":55,"rankingReason":"[matched: capital expenditure | tickers: META]","relevanceScore":null,"tags":null}
{"rank":3,"role":"SUPPORTING","is_lead":false,"eventType":"SEMICONDUCTOR","eventRankScore":53,"rankingReason":"[matched: NVDA | tickers: NVDA]","relevanceScore":null,"tags":null}
```

### Generated Core Question (simulated)
> 파월의 금리 인하 유보 발언과 메타의 AI 투자 확대가 동시에 나온 지금,  
> **실질금리 상승 압력 속에서도 하이퍼스케일러 AI 지출이 기술주 밸류에이션을 지탱할 수 있는가?**

### PASS / FAIL

| Check | Result |
|---|---|
| ANALYST_ACTION did not lead? | ✅ PASS — Goldman NVDA at rank 3 |
| Rank 1 makes sense? | ✅ PASS — Powell/FOMC is structural |
| EventType for Goldman NVDA? | ⚠️ NOTE — labeled SEMICONDUCTOR not ANALYST_ACTION (acceptable: didn't lead) |
| VIX spike missed? | ❌ ISSUE — "VIX spikes" (plural) misses MARKET_STRUCTURE pattern; rank 5 as OTHER |
| No duplicate domination? | ✅ PASS |
| Time order stopped? | ✅ PASS — newest (Goldman NVDA, 1h) is rank 3 |

**Verdict: ✅ PASS (two pattern issues flagged)**

---

## Cross-Case Structural Checks

| Check | Result |
|---|---|
| Exactly one `is_lead: true` per batch | ✅ PASS — all 4 cases |
| Rank 2–4 treated as SUPPORTING | ✅ PASS |
| Recency bonus does NOT dominate | ✅ PASS — max recency bonus is +5; structural bonus minimum is +8 |
| ANALYST_ACTION does not dominate macro/sector | ✅ PASS — Case 4 analyst upgrade at rank 3 |
| Duplicate headlines do not occupy top 3 | ⚠️ NOTE — Case 2: top 3 are 3 different oil headlines (same theme, different facts; acceptable but monitor) |
| Backward compatibility | ✅ PASS — `rank`, `role`, `is_lead`, `eventType`, `rankingReason`, `eventRankScore` all present |
| `relevanceScore`/`tags` default safely | ✅ PASS — both optional; 0.5 default and empty array produce stable scores |

---

## Issues Found

### Issue 1 — AI_INFRA pattern gap: `ai training` not recognized
**Severity:** Medium  
**Symptom:** "TSMC AI training chip" headline matches SEMICONDUCTOR, not AI_INFRASTRUCTURE.  
**Root cause:** AI_INFRA pattern has `llm training` but not `ai training`.  
**Fix:** Add `\bai training\b` to AI_INFRASTRUCTURE pattern.

### Issue 2 — MARKET_STRUCTURE pattern gap: `VIX spikes` (plural) not matched
**Severity:** Low-Medium  
**Symptom:** "VIX spikes to 18" classified as OTHER (score 34) instead of MARKET_STRUCTURE (~50).  
**Root cause:** Pattern literal `vix spike` does not match `vix spikes`.  
**Fix:** Change `vix spike` → `vix spike[s]?` in pattern.

### Issue 3 — Duplicate same-type items cluster in top 3 (Case 2)
**Severity:** Low  
**Symptom:** 3 consecutive ENERGY_SHOCK oil headlines occupy top 3; NVDA sector rotation pushed to rank 4.  
**Root cause:** No intra-type deduplication or diversity penalty.  
**Fix (optional, N3):** Add soft penalty for 3+ same-`eventType` in top 3; promote highest-scoring different-type item.

### Issue 4 — ANALYST_ACTION for named tickers classified as SEMICONDUCTOR
**Severity:** Info only  
**Symptom:** "Goldman upgrades NVDA" → SEMICONDUCTOR label (not ANALYST_ACTION).  
**Root cause:** SEMICONDUCTOR rule fires on `nvda` before ANALYST_ACTION rule fires on `upgrades`.  
**Impact:** Score higher than pure analyst noise (acceptable — prevents pure single-stock noise from dominating with low bonus). LLM label is slightly wrong.  
**Fix (optional):** Detect "upgrade/downgrade/price target" pattern FIRST, then assign analyst ticker label.

---

## Recommended Tuning (Small — Not Blocking)

```
1. eventRanker.ts, AI_INFRA pattern:
   Add: `ai training|ai chip demand`
   Current: /\b(ai spending|data center build|gpu demand|llm training|...)\b/i
   After:   /\b(ai spending|ai training|ai chip demand|data center build|gpu demand|llm training|...)\b/i

2. eventRanker.ts, MARKET_STRUCTURE pattern:
   Change: vix spike  →  vix spike[s]?
   Also consider: vix.{0,5}spike, vix.{0,5}jump

3. (N3 optional) Add duplicate-type diversity bonus/penalty when 3+ same type in top 5.
```

These are the only changes needed. Do NOT overhaul ranking formula.

---

## N3 Readiness

| Condition | Status |
|---|---|
| `rank`, `role`, `is_lead`, `eventType` fields stable | ✅ Ready |
| `eventRankScore` reliable for top-story selection | ✅ Ready |
| `rankingReason` informative enough for LLM anchor | ✅ Ready |
| AI_INFRA label gap fixed before N3? | ⚠️ Recommended before N3 |
| VIX spike pattern fixed? | ⚠️ Recommended before N3 |

**Overall Phase N2 Verdict: ✅ PASS with 2 small pattern fixes recommended**

N3 can proceed after applying the two pattern fixes (Issues 1 and 2).  
N3 objective: Fix Top Story (rank 1) + Supporting Drivers (rank 2–4) as stable briefing structure.
