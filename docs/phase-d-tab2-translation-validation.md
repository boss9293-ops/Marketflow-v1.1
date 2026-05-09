# Phase D Step 4 — Tab 2 SOXX/SOXL Translation Validation
Date: 2026-04-29

---

## Tab 2 UI Summary

**Tab:** STRATEGY (renamed intent: SOXX/SOXL Translation)
**Route:** `/api/translation`
**Component:** `components/semiconductor/SoxxSoxlTranslationTab.tsx`
**Wiring:** `mainTab === 'STRATEGY'` hides the 3-column ENGINE body and renders the translation tab

**5 Blocks:**
1. Translation Summary — one sentence, relationship not direction
2. SOXX Base Structure — InterpretationOutput (summary, alignment, support/weakness, interpretation)
3. SOXL Translation — same InterpretationOutput + soxl_note (leverage sensitivity annotation)
4. Structural Delta — amplification chip + sensitivity factors + explanation + constraint
5. Structural Watch Conditions — max 3 bullets, no action language

---

## API Route

**Path:** `app/api/translation/route.ts`
**Pipeline:** Same v2 engine pipeline as `/api/interpretation` (normalizeMetrics → computeDomainScores → computeEngineScore → computeConfidence → translateEngineOutput)
**Additional outputs:** delta (amplification, sensitivity, constraint, explanation), watch[], summary string, soxl_note string

---

## Data Fallback

- SOXL-specific engine data not available: SOXL column renders the same `base` InterpretationOutput with a `soxl_note` appended:
  "SOXL translation is derived from the SOXX structure with higher sensitivity to breadth, correlation, and volatility conditions."
- If API call fails: error banner shown, tab remains visible (no crash)
- If cache file missing: 503 returned, error banner shown

---

## 3 Validation Scenarios

### Case 1 — Broad SOXX
Input: breadth=strong, momentum=strong, correlation=falling, map=strong, ai_concentration=low

Delta logic:
- High? breadth!=weak, correlation!=rising, map!=weak → NO
- Medium? breadth!=neutral, map!=neutral, ai_concentration!=high → NO
- Low? breadth==strong && map==strong && correlation!=rising → YES

Expected: amplification=low ✓
Explanation: "SOXL sensitivity appears contained because the base semiconductor structure is broadly supported and internally consistent."

### Case 2 — Narrow Leadership
Input: breadth=weak, momentum=strong, correlation=rising, map=neutral, ai_concentration=high

Delta logic:
- High? breadth==weak → YES immediately

Expected: amplification=high ✓
Explanation: "SOXL sensitivity is elevated because weak participation, unstable structure, or rising correlation can magnify structural stress."
Sensitivity factors: ["breadth", "correlation", "map"]

### Case 3 — Mixed Structure
Input: breadth=neutral, momentum=strong, correlation=stable, map=strong, ai_concentration=high

Delta logic:
- High? breadth!=weak, correlation!=rising, map!=weak → NO
- Medium? breadth==neutral → YES

Expected: amplification=medium ✓
Explanation: "SOXL sensitivity is moderate because the base structure is supportive but not fully broad across participation or concentration signals."

All 3 cases: PASS ✓

---

## Forbidden Word Scan

Searched all rendered text for: buy, sell, entry, exit, target, forecast, predict, expected, will

Result: **CLEAN**

Watch conditions use neutral conditional phrasing:
- "reduces translation quality" ✓
- "increases SOXL sensitivity" ✓
- "lowers interpretation confidence" ✓

---

## Known Limitations

1. SOXL column uses derived data (same as SOXX + note) — no independent SOXL engine output
2. Tab still labeled "STRATEGY" in UI nav — rename pending
3. Footer ticker bar remains static (placeholder data)
4. Historical analog always absent (distance=0.99) — analog engine not yet built

---

## Status: COMPLETE — proceed to Phase D Step 5 (Tab 3 Playback)
