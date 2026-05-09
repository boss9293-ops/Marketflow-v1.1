# Phase G Step 4 — Capital Flow Stage Timeline
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Replace CYCLE VIEW [3] "Current Relative Ranking" with a Capital Flow Stage Timeline that shows how far AI capital has confirmed across semiconductor segments.

---

## 2. Stage Logic

Stage states computed from `interpData.ai_regime` component spread values:

| Segment | Confirmed | Partial | Mixed | Lagging/Weak |
|---------|-----------|---------|-------|--------------|
| AI Compute | >5pp | >2pp | >-2pp | else Weak |
| Memory | >3pp | >0pp | >-3pp | else Weak |
| Foundry | >3pp | — | >-3pp | else Weak |
| Equipment | >2pp | — | >-2pp | else Lagging |

Broad Participation derived:
- 3+ Confirmed/Partial → Confirmed
- Only AI Compute above → Narrow
- 3+ Weak/Lagging → Weak
- else → Mixed

Fallback when no `ai_regime` data: all stages = 'Unavailable'

---

## 3. Stage Colors (STAGE_CLS map)

| State | Color |
|-------|-------|
| Confirmed | emerald (green) |
| Partial | sky (blue) |
| Mixed | yellow |
| Lagging | orange |
| Weak | red |
| Narrow | orange |
| Unavailable | slate (gray) |

---

## 4. Display Layout

Horizontal flow with arrows:
```
AI Compute → Memory → Foundry → Equipment → Broad Participation
[state badge] [state badge] [state badge] [state badge] [state badge]
[±pp]         [±pp]         [±pp]         [±pp]
```

---

## 5. Capital Flow Sequence Reference

```
AI Compute → Memory → Foundry → Equipment → Broad Participation
```

Healthy cycle: stages confirm sequentially left to right.
AI_LED_NARROW: only AI Compute confirmed, rest lagging.
CONTRACTION: all segments weak.

---

## 6. Purpose

Directly answers: **"How far has capital spread?"** (Question 4)

---

## 7. Change from Previous

| Before | After |
|--------|-------|
| [3] Current Relative Ranking (bar chart) | [3] Capital Flow Stage Timeline (flow diagram) |

---

## 8. Success Criteria

```
[✅] [3] replaced with Capital Flow Stage Timeline
[✅] Stage states computed from ai_regime spread values
[✅] 5 stages displayed: AI Compute, Memory, Foundry, Equipment, Broad
[✅] Color-coded state badges
[✅] pp spread values displayed per segment
[✅] Fallback to 'Unavailable' when no ai_regime data
[✅] TypeScript compile passes (0 errors)
```
