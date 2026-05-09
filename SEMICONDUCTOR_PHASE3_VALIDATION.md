# Semiconductor Phase 3 — Interpretation Layer Validation
**Date:** 2026-04-28 | **Purpose:** Sample generation for readability QA

---

## Sample 1 — Fully Aligned

**Input:**
```
breadth: strong | momentum: strong | correlation: falling
map: strong | ai_concentration: low | cycle_stage: expansion
conflict_mode: none | data_quality: high | analog: distance 0.22
```

**Step 2 — Signal Meanings:**
```
Breadth:          Broad participation
Momentum:         Price strength is persistent
Correlation:      Diversification improving
MAP:              Price structure is stable
AI Concentration: Leadership broadly distributed
Cycle Stage:      Growth phase
Combined Pattern: Broad structural support (Pattern 2)
```

**Step 3 — Alignment:**
```
Alignment:         Aligned
Reason:            Breadth, momentum, and market structure all point in the same structural direction.
Conflict Severity: None
Conflict Pairs:    []
```

**Step 4 — Structural Interpretation:**
```
Structure Statement:  The structure is broadly supported within an expansion phase, while constraints remain minimal.
Causal Explanation:   This is driven by broad participation and stable market structure, while diversification conditions are improving and leadership concentration remains distributed.
```

**Final Output:**

> **Setup Summary**
> Structural conditions are broadly aligned — participation, momentum, and market structure are mutually reinforcing within an expansion phase.
>
> **Signal Alignment**
> Signal alignment is Aligned, because breadth, momentum, and market structure all point in the same structural direction.
>
> **Supporting Structure**
> • Broad participation
> • Price structure is stable
>
> **Weakening Structure**
> • No material structural constraints identified
>
> **Structural Interpretation**
> The structure is broadly supported within an expansion phase, while constraints remain minimal. This is driven by broad participation and stable market structure, while diversification conditions are improving and leadership concentration remains distributed.
>
> **Historical Similar Setup**
> This setup is historically similar to broad expansion phases where participation, structure, and momentum were mutually reinforcing. Historically similar setups showed sustained broad participation across multiple segments with distributed leadership.
>
> **Confidence**
> Interpretation confidence is high, because signals are broadly aligned with stable data quality.

**Word count:** ~110

---

**QA Check — Sample 1:**
```
✔  First sentence alone conveys the structure
✔  Strength vs weakness clearly separated (no weakness = stated explicitly)
✔  No conflict to describe — correctly omitted
✔  Sentences are precise and unexaggerated
✔  No repetition across sections
✔  Historical stays structural — no outcome implied
✔  High confidence is justified by input state
```

---

## Sample 2 — Narrow Leadership (핵심 케이스)

**Input:**
```
breadth: weak | momentum: strong | correlation: rising
map: neutral | ai_concentration: high | cycle_stage: peak
conflict_mode: strong → Structural Conflict | data_quality: high | analog: distance 0.18
```

**Step 2 — Signal Meanings:**
```
Breadth:          Narrow participation
Momentum:         Price strength is persistent
Correlation:      Diversification is weakening
MAP:              Structure is transitional
AI Concentration: Leadership is concentrated in few names
Cycle Stage:      Late-stage structure
Combined Pattern: Concentrated leadership structure (Pattern 1)
                  Dependency-driven structure (Pattern 3)
                  Fragile market structure (Pattern 4)
```

**Step 3 — Alignment:**
```
Alignment:         Divergent
Reason:            Momentum remains strong, but breadth, correlation, and AI concentration form a structurally fragile and narrow configuration.
Conflict Severity: Structural Conflict
Conflict Pairs:    [(Momentum, Breadth), (Breadth, Correlation), (AI Concentration, Breadth)]
```

**Step 4 — Structural Interpretation:**
```
Structure Statement:  Leadership remains concentrated within a late-stage structure, while broader participation is limited.
Causal Explanation:   This is driven by persistent momentum and elevated AI concentration, while breadth remains narrow and market structure remains transitional.
```

**Final Output:**

> **Setup Summary**
> Momentum is persistent, but the structure is internally fragile — participation is narrow, concentration is elevated, and diversification is weakening within a late-stage structure.
>
> **Signal Alignment**
> Signal alignment is Divergent, because momentum and breadth point in opposite structural directions while correlation conditions are deteriorating.
>
> **Supporting Structure**
> • Price strength is persistent
> • Leadership is concentrated in few names
>
> **Weakening Structure**
> • Narrow participation
> • Diversification is weakening
>
> **Structural Interpretation**
> Leadership remains concentrated within a late-stage structure, while broader participation is limited. This is driven by persistent momentum and elevated AI concentration, while breadth remains narrow and market structure remains transitional.
>
> **Historical Similar Setup**
> This setup is historically similar to late-cycle periods where momentum in a narrow leadership group persisted while broader participation deteriorated. Historically similar setups showed continued strength in concentrated segments while cross-sector diversification weakened.
>
> **Confidence**
> Interpretation confidence is low, because core signals are in structural conflict despite stable data quality.

**Word count:** ~135

---

**QA Check — Sample 2:**
```
✔  First sentence captures both the strength AND the fragility — no false positives
✔  Strength (momentum) and weakness (breadth, correlation) clearly separated
✔  Conflict described naturally — "opposite structural directions"
✔  No exaggeration, no outcome implied
✔  Historical stays behavioral — "showed continued strength in concentrated segments" ≠ prediction
✔  Low confidence correctly justified by Structural Conflict
❌ FAIL CHECK: Does "Leadership is concentrated in few names" in Supporting Structure mislead?
   → PASS: It is labeled under Supporting because it explains what IS holding the structure up, not as an endorsement
```

---

## Sample 3 — Early Weak Structure

**Input:**
```
breadth: neutral | momentum: weak | correlation: stable
map: weak | ai_concentration: medium | cycle_stage: early
conflict_mode: mild | data_quality: medium | analog: distance 0.40 → OMIT
```

**Step 2 — Signal Meanings:**
```
Breadth:          Moderate participation
Momentum:         Price structure is losing strength
Correlation:      Diversification conditions unchanged
MAP:              Structure is unstable
AI Concentration: Leadership moderately distributed
Cycle Stage:      Initial expansion phase
Combined Pattern: None
```

**Step 3 — Alignment:**
```
Alignment:         Mixed
Reason:            Market structure and momentum are weak while participation remains at neutral levels within an early-phase context.
Conflict Severity: Mild Conflict
Conflict Pairs:    [(Momentum, Cycle Stage)]
```

**Step 4 — Structural Interpretation:**
```
Structure Statement:  The structure is transitional and losing momentum within an early-phase context, while participation has yet to confirm directional support.
Causal Explanation:   This is driven by unstable market structure and weakening momentum, while participation remains neutral and AI concentration is moderately distributed.
```

**Final Output:**

> **Setup Summary**
> Structure is unstable and momentum is weakening within an early expansion phase, while participation has not yet confirmed directional support.
>
> **Signal Alignment**
> Signal alignment is Mixed, because structural signals are weak while participation and concentration remain at neutral levels.
>
> **Supporting Structure**
> • Moderate participation
> • Leadership moderately distributed
>
> **Weakening Structure**
> • Price structure is losing strength
> • Structure is unstable
>
> **Structural Interpretation**
> The structure is transitional and losing momentum within an early-phase context, while participation has yet to confirm directional support. This is driven by unstable market structure and weakening momentum, while participation remains neutral and AI concentration is moderately distributed.
>
> *(Historical Similar Setup omitted — analog distance 0.40 exceeds threshold)*
>
> **Confidence**
> Interpretation confidence is low, because signals are partially aligned with mixed data quality across key structural indicators.

**Word count:** ~110

---

**QA Check — Sample 3:**
```
✔  First sentence correctly flags both the weakness AND the early-phase ambiguity
✔  Strength vs weakness clearly separated — neutral signals appear in Supporting as context
✔  Mild conflict explained without drama
✔  Historical correctly omitted (distance 0.40 ≥ 0.35)
✔  Low confidence justified by mixed data quality AND partial alignment
✔  No outcome implied — "has yet to confirm" is structural, not directional
```

---

## Sample 4 — Mixed Signals

**Input:**
```
breadth: neutral | momentum: strong | correlation: stable
map: strong | ai_concentration: high | cycle_stage: expansion
conflict_mode: mild | data_quality: high | analog: distance 0.30
```

**Step 2 — Signal Meanings:**
```
Breadth:          Moderate participation
Momentum:         Price strength is persistent
Correlation:      Diversification conditions unchanged
MAP:              Price structure is stable
AI Concentration: Leadership is concentrated in few names
Cycle Stage:      Growth phase
Combined Pattern: None (Breadth neutral, not weak — Patterns 1/3 do not fully fire)
```

**Step 3 — Alignment:**
```
Alignment:         Mixed
Reason:            Momentum and market structure are strong, but participation is only moderate and AI concentration is elevated.
Conflict Severity: Mild Conflict
Conflict Pairs:    [(Momentum, Breadth)]
```

**Step 4 — Structural Interpretation:**
```
Structure Statement:  The structure is partially supported within an expansion phase, while concentrated leadership and moderate participation limit full structural confirmation.
Causal Explanation:   This is driven by persistent momentum and stable market structure, while participation remains moderate and AI concentration is elevated.
```

**Final Output:**

> **Setup Summary**
> Momentum and market structure are strong, but AI leadership concentration and moderate participation limit full structural confirmation within an expansion phase.
>
> **Signal Alignment**
> Signal alignment is Mixed, because momentum is strong while breadth remains at a neutral level and leadership concentration is elevated.
>
> **Supporting Structure**
> • Price strength is persistent
> • Price structure is stable
>
> **Weakening Structure**
> • Moderate participation
> • Leadership is concentrated in few names
>
> **Structural Interpretation**
> The structure is partially supported within an expansion phase, while concentrated leadership and moderate participation limit full structural confirmation. This is driven by persistent momentum and stable market structure, while participation remains moderate and AI concentration is elevated.
>
> **Historical Similar Setup**
> This setup is historically similar to mid-cycle periods where strong momentum and structure coexisted with concentrated leadership and unconfirmed participation. Historically similar setups showed continued momentum in leading segments while broader participation lagged the structural advance.
>
> **Confidence**
> Interpretation confidence is medium, because signals are partially aligned while elevated AI concentration remains a structural constraint.

**Word count:** ~135

---

**QA Check — Sample 4:**
```
✔  Setup Summary captures both the strength and the structural caveat in one sentence
✔  Supporting (momentum, MAP) and weakening (breadth, concentration) clearly separated
✔  "Limit full structural confirmation" is precise — not pessimistic, not optimistic
✔  Historical: "broader participation lagged the structural advance" — behavioral, not predictive
✔  Medium confidence correctly assigned — aligned in two major signals, constrained in two others
✔  No repetition between Setup Summary and Structural Interpretation (different emphasis)
```

---

## Sample 5 — Breakdown Structure

**Input:**
```
breadth: weak | momentum: weak | correlation: rising
map: weak | ai_concentration: low | cycle_stage: downturn
conflict_mode: none | data_quality: medium | analog: distance 0.25
```

**Step 2 — Signal Meanings:**
```
Breadth:          Narrow participation
Momentum:         Price structure is losing strength
Correlation:      Diversification is weakening
MAP:              Structure is unstable
AI Concentration: Leadership broadly distributed
Cycle Stage:      Contraction phase
Combined Pattern: Fragile market structure (Pattern 4: Correlation rising + Breadth weak)
```

**Step 3 — Alignment:**
```
Alignment:         Aligned
Reason:            Breadth, momentum, and market structure all confirm structural deterioration within a contraction phase.
Conflict Severity: None
Conflict Pairs:    []
```

**Step 4 — Structural Interpretation:**
```
Structure Statement:  The structure is deteriorating broadly within a contraction phase, while all primary signals confirm the structural decline.
Causal Explanation:   This is driven by narrow participation and unstable market structure, while weakening momentum and rising correlation reinforce the structural decline.
```

**Final Output:**

> **Setup Summary**
> All primary signals confirm broad structural deterioration — participation, momentum, and market structure are aligned in decline within a contraction phase.
>
> **Signal Alignment**
> Signal alignment is Aligned, because breadth, momentum, and market structure all indicate consistent structural weakness.
>
> **Supporting Structure**
> • Leadership broadly distributed
>
> **Weakening Structure**
> • Narrow participation
> • Structure is unstable
>
> **Structural Interpretation**
> The structure is deteriorating broadly within a contraction phase, while all primary signals confirm the structural decline. This is driven by narrow participation and unstable market structure, while weakening momentum and rising correlation reinforce the structural decline.
>
> **Historical Similar Setup**
> This setup is historically similar to broad contraction phases where participation, momentum, and structure deteriorated simultaneously while diversification conditions weakened. Historically similar setups showed broad-based structural weakness until participation and market structure stabilized.
>
> **Confidence**
> Interpretation confidence is low, because structural signals are uniformly weak with medium data quality.

**Word count:** ~120

---

**QA Check — Sample 5:**
```
✔  First sentence immediately conveys full contraction — no ambiguity
✔  "Aligned in decline" is structurally honest — not alarmist
✔  Supporting: leadership distribution correctly surfaced as the one non-negative element
✔  Historical: "until participation and structure stabilized" — structural reference, not a timing claim
✔  Low confidence correctly assigned — medium data quality + uniform weakness
✔  No recovery language, no softening of the contraction state
```

---

## Cross-Sample Quality Summary

| Criterion | S1 | S2 | S3 | S4 | S5 |
|-----------|----|----|----|----|-----|
| First sentence captures structure | ✅ | ✅ | ✅ | ✅ | ✅ |
| Strength vs Weakness clearly separated | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conflict described naturally | n/a | ✅ | ✅ | ✅ | n/a |
| Sentences precise, no exaggeration | ✅ | ✅ | ✅ | ✅ | ✅ |
| No repetition across sections | ✅ | ✅ | ✅ | ✅ | ✅ |
| Historical stays structural | ✅ | ✅ | n/a | ✅ | ✅ |
| Confidence is justified | ✅ | ✅ | ✅ | ✅ | ✅ |

**Failure check:**
```
❌ Momentum strong → positively only described?        PASS — S2 + S4 both qualify momentum with breadth constraint
❌ Breadth weak ignored?                              PASS — S2 + S5 both prioritize breadth in Weakening section
❌ "상승 지속 가능" style expressions?                  PASS — no outcome or continuity language anywhere
❌ Historical used as de facto prediction?             PASS — "showed" + structural description only, no "will" or "expect"
❌ Sentences too long or ambiguous?                    PASS — all setup summaries are standalone-readable
```

---

## Validation Result

**✅ PASS** — All 5 samples meet terminal-grade readability standard.

**Key observations:**
1. Divergent case (S2) is the most informative — clearly separates what holds the structure up from what makes it fragile
2. Fully Aligned case (S1) correctly handles absence of weakness — no filler bullets added
3. Breakdown case (S5) correctly surfaces the one non-negative element (low AI concentration) without false optimism
4. Historical section in all cases is behavioral pattern description — not outcome assertion
5. Confidence level is mechanically consistent with alignment + data quality inputs across all 5

**Ready for implementation.**
