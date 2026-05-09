# Semiconductor Phase 3 — Interpretation Layer

**Version:** 0.6 (Steps 1–6 complete)
**Date:** 2026-04-28
**Status:** Design only — no implementation

---

## Step 1 — Core Principles

### 1. System Role Separation

| Layer | Role | Rule |
|-------|------|------|
| Engine | Fact Layer | Produces scores, states, conflict types — unchanged |
| Interpretation | Explanation Layer | Translates engine output to human-readable insight |

**Hard constraint:** Interpretation never modifies, overrides, or contradicts engine output.

---

### 2. Forbidden Language

#### Trading Language — STRICTLY FORBIDDEN

```
buy  /  sell  /  entry  /  exit  /  target  /  position
```

#### Forecast Language — STRICTLY FORBIDDEN

```
forecast  /  predict  /  expected  /  will
```

#### Allowed Historical Reference

```
"historically similar setup"
```

Any reference to past patterns must use this phrase or equivalent (e.g., "in past episodes with this structure").

---

### 3. Output Philosophy

**Interpretation MUST:**
- Explain **WHAT** the structure is
- Explain **WHY** the structure exists
- Show **WHERE** signals agree or conflict

**Interpretation MUST NOT:**
- Suggest actions
- Predict outcomes
- Provide targets

---

### 4. Output Characteristics

| Characteristic | Requirement |
|---------------|-------------|
| Length | Concise — no padding |
| Format | Structured — signal → meaning → context |
| Evidence | Every statement backed by signal logic |
| Tone | Institutional — neutral, factual |

---

### 5. Core Flow

```
Engine Output
    ↓
  Meaning        (what each signal value implies structurally)
    ↓
  Conflict       (where signals agree vs diverge)
    ↓
  Structure      (combined state label)
    ↓
  Historical Context  (historically similar setup — if analog available)
    ↓
  Confidence     (how strongly the interpretation is supported)
```

No step may skip the one before it.
Confidence is always the final output — never the first.

---

### 6. Success Criteria

```
✔  No trading language in any output string
✔  No forecast language in any output string
✔  Engine output values are quoted, not reinterpreted
✔  Every interpretation statement references at least one signal
✔  Conflict state always explicitly acknowledged when conflict_type ≠ NO_CONFLICT
```

---

---

## Step 2 — Signal Meaning Mapping

### Objective

Translate each raw engine signal into one structural meaning statement.
No narrative. No implication. No historical context. Translation only.

---

### 2.1 Individual Signal Maps

#### Breadth

| Signal level | Structural meaning |
|-------------|-------------------|
| Strong (≥65) | Broad participation |
| Neutral (45–64) | Moderate participation |
| Weak (<45) | Narrow participation |

#### Momentum

| Signal level | Structural meaning |
|-------------|-------------------|
| Strong | Price strength is persistent |
| Neutral | Price movement lacks persistence |
| Weak | Price structure is losing strength |

#### Correlation

| Trend | Structural meaning |
|-------|-------------------|
| Rising | Diversification is weakening |
| Stable | Diversification conditions unchanged |
| Falling | Diversification improving |

#### MAP (Market Structure)

| Signal level | Structural meaning |
|-------------|-------------------|
| Strong | Price structure is stable |
| Neutral | Structure is transitional |
| Weak | Structure is unstable |

#### AI Concentration

| Level | Structural meaning |
|-------|-------------------|
| High (≥65%) | Leadership is concentrated in few names |
| Medium (45–64%) | Leadership moderately distributed |
| Low (<45%) | Leadership broadly distributed |

#### Cycle Stage

| Stage | Structural meaning |
|-------|-------------------|
| Early / Trough / Recovery | Initial expansion phase |
| Expansion / Mid Expansion | Growth phase |
| Late Expansion / Peak Risk | Late-stage structure |
| Contraction | Contraction phase |

---

### 2.2 Combined Signal Patterns

Certain signal pairs carry meaning that neither signal conveys alone.
These patterns are evaluated **after** individual mapping, **before** conflict detection.

| Pattern | Condition | Combined meaning |
|---------|-----------|-----------------|
| 1 | Momentum strong + Breadth weak | Concentrated leadership structure |
| 2 | Breadth strong + Momentum strong | Broad structural support |
| 3 | AI Concentration high + Breadth weak | Dependency-driven structure |
| 4 | Correlation rising + Breadth weak | Fragile market structure |

When a combined pattern fires, it **supplements** (does not replace) the individual signal meanings.

---

### 2.3 Output Format (Internal)

One clean meaning line per signal. No duplication. No implication.

```
Breadth:          [meaning]
Momentum:         [meaning]
Correlation:      [meaning]
MAP:              [meaning]
AI Concentration: [meaning]
Cycle Stage:      [meaning]
Combined Pattern: [pattern label | none]
```

Example output:
```
Breadth:          Narrow participation
Momentum:         Price strength is persistent
Correlation:      Diversification is weakening
MAP:              Price structure is stable
AI Concentration: Leadership is concentrated in few names
Cycle Stage:      Late-stage structure
Combined Pattern: Concentrated leadership structure (Pattern 1)
```

---

### 2.4 Rules

- Do NOT combine into narrative
- Do NOT explain implications
- Do NOT mention historical context
- One meaning line per signal — no duplication

---

### 2.5 Success Criteria

```
✔  Each of the 6 signals mapped to exactly one meaning
✔  Combined patterns evaluated as a separate layer
✔  No meaning line contains action or forecast language
✔  Output is machine-parseable (key: value format)
✔  Ready for Step 3 — Conflict Detection
```

---

---

## Step 3 — Agreement / Conflict Detection

### Objective

Determine whether mapped signals are aligned, partially aligned, or in conflict.
Output: structural coherence classification + conflict severity. No narrative.

---

### 3.1 Inputs

All inputs are **translated meanings from Step 2**, not raw values.

```
Breadth meaning
Momentum meaning
Correlation meaning
MAP meaning
AI Concentration meaning
Cycle Stage meaning
```

---

### 3.2 Primary Classification

#### Aligned

**Conditions (all must hold):**
- Breadth supports Momentum (both strong or both weak)
- MAP supports Momentum
- AI Concentration is not extreme (medium or low)
- Correlation not rising aggressively

**Interpretation output:** Signals point in the same structural direction.

---

#### Mixed

**Conditions:**
- At least one major disagreement exists
- But no critical contradiction (see Divergent)

**Example triggers:**
- Momentum strong + Breadth neutral
- Momentum strong + MAP neutral
- AI Concentration high, but Breadth not weak

**Interpretation output:** Structure is partially supported, partially constrained.

---

#### Divergent

**Conditions — ANY of the following fires:**

| Pair | Conflict |
|------|---------|
| Momentum strong + Breadth weak | ✴ High-weight |
| Breadth weak + Correlation rising | ✴ High-weight |
| AI Concentration high + Breadth weak | ✴ High-weight |
| MAP weak + Momentum strong | Structural |

**Interpretation output:** Core structural signals contradict each other.

---

### 3.3 Conflict Severity

Secondary label applied when classification is Mixed or Divergent.

| Severity | Conditions |
|----------|-----------|
| **Mild Conflict** | Exactly 1 conflicting pair |
| **Structural Conflict** | 2+ conflicting pairs OR any pair includes Breadth vs Momentum |

No severity label when classification is Aligned.

---

### 3.4 Signal Priority Hierarchy

When conflicts exist, weight is assigned by this order. Higher rank = higher conflict weight.

```
1. Breadth           ← highest weight
2. MAP
3. Momentum
4. AI Concentration
5. Correlation       ← lowest weight
```

**Application rule:** If Breadth contradicts any signal ranked 2–5, the conflict is automatically promoted to Structural Conflict regardless of count.

---

### 3.5 Output Format (Internal)

```
Alignment:        Aligned | Mixed | Divergent
Reason:           [single sentence — which signals conflict or agree, no implications]
Conflict Severity: None | Mild Conflict | Structural Conflict
Conflict Pairs:   [(signal_a, signal_b), ...]  ← list of detected pairs, may be empty
```

**Example A — Divergent:**
```
Alignment:         Divergent
Reason:            Momentum remains strong, but breadth and concentration indicate a narrow and fragile structure.
Conflict Severity: Structural Conflict
Conflict Pairs:    [(Momentum, Breadth), (AI Concentration, Breadth)]
```

**Example B — Aligned:**
```
Alignment:         Aligned
Reason:            Breadth, momentum, and MAP all indicate broad structural support.
Conflict Severity: None
Conflict Pairs:    []
```

**Example C — Mixed:**
```
Alignment:         Mixed
Reason:            Momentum is strong but market structure (MAP) remains transitional.
Conflict Severity: Mild Conflict
Conflict Pairs:    [(Momentum, MAP)]
```

---

### 3.6 Rules

- Do NOT build narrative
- Do NOT mention historical context
- Do NOT infer outcomes
- Classify structural coherence only

---

### 3.7 Success Criteria

```
✔  One of: Aligned / Mixed / Divergent — no other values
✔  Reason is a single sentence referencing the conflicting signals by name
✔  Conflict Severity correctly assigned using pair count and priority hierarchy
✔  Breadth vs Momentum contradiction always triggers Structural Conflict
✔  Output is machine-parseable (key: value format)
✔  Ready for Step 4 — Structural Interpretation (Meaning Synthesis)
```

---

---

## Step 4 — Structural Interpretation (Meaning Synthesis)

### Objective

Synthesize Step 2 meanings and Step 3 alignment into exactly two sentences:
a Structure Statement (WHAT) and a Causal Explanation (WHY).
No narrative. No historical reference. No confidence statement. No outcome inference.

---

### 4.1 Inputs

```
Signal meanings     → from Step 2
Alignment state     → Aligned | Mixed | Divergent (Step 3)
Conflict severity   → None | Mild Conflict | Structural Conflict (Step 3)
Cycle Stage         → from engine
```

---

### 4.2 Output

Exactly two sentences:

```
Structure Statement:  [one sentence — WHAT the structure is]
Causal Explanation:   [one sentence — WHY the structure exists]
```

---

### 4.3 Structure Statement (WHAT)

**Form:** `"[Core structure], while [constraint]."`

| Alignment | Emphasis | Template |
|-----------|---------|----------|
| Aligned | Consistency | `"The structure is [broadly / fully] supported, while [minor constraint]."` |
| Mixed | Balance | `"The structure is partially supported, while [key constraint] limits [scope]."` |
| Divergent | Contradiction | `"The structure is internally inconsistent, while [signal A] and [signal B] point in different directions."` |

**Examples:**
- `"Leadership remains concentrated, while broader participation is limited."`
- `"The structure is broadly supported, while concentration risk remains contained."`
- `"The structure is internally inconsistent, while key signals contradict each other."`

---

### 4.4 Causal Explanation (WHY)

**Form:** `"This is driven by [supporting signals], while [weakening signals]."`

**Signal selection rules:**
- Max **2 supporting signals** named
- Max **2 weakening signals** named
- Select by priority order (highest first):

```
Priority:  Breadth → MAP → Momentum → AI Concentration → Correlation
```

**Examples:**
- `"This is driven by persistent momentum and stable structure, while breadth remains narrow and concentration elevated."`
- `"This is driven by broad participation and stable structure, while correlation conditions remain neutral."`

---

### 4.5 Cycle Context Injection (Optional)

Append a short clause to the Structure Statement if it improves clarity.

| Cycle Stage | Clause |
|------------|--------|
| Early / Trough / Recovery | `"within an early-phase context"` |
| Expansion / Mid Expansion | `"within an expansion phase"` |
| Late Expansion / Peak Risk | `"within a late-stage structure"` |
| Contraction | `"within a contraction phase"` |

**Rules:**
- Add only if it adds clarity (not by default)
- Do not repeat cycle terminology in the Causal Explanation

---

### 4.6 Full Output Examples

**Example A — Divergent / Structural Conflict / Late-stage:**
```
Structure Statement:  Leadership remains concentrated within a late-stage structure, while broader participation is limited.
Causal Explanation:   This is driven by persistent momentum and elevated AI concentration, while breadth remains narrow and market structure is weakening.
```

**Example B — Aligned / No Conflict / Expansion:**
```
Structure Statement:  The structure is broadly supported, while concentration risk remains contained.
Causal Explanation:   This is driven by broad participation and stable market structure, while AI concentration and correlation conditions remain at neutral levels.
```

**Example C — Mixed / Mild Conflict:**
```
Structure Statement:  The structure is partially supported, while transitional market structure limits full participation.
Causal Explanation:   This is driven by persistent momentum and moderate participation, while market structure remains in a transitional state.
```

---

### 4.7 Rules

- Exactly 2 sentences total — no more
- No narrative beyond these 2 sentences
- No historical references
- No confidence statements
- No speculation or outcome inference
- Both sentences must reference signal names (not score numbers)

---

### 4.8 Success Criteria

```
✔  Structure Statement clearly states WHAT the structure is
✔  Causal Explanation clearly states WHY using max 2+2 signals
✔  Alignment state correctly shapes emphasis (consistent / balanced / contradictory)
✔  Highest-priority signals selected by Step 3 hierarchy
✔  Cycle context clause added only when it improves clarity
✔  Output is exactly 2 sentences — machine-parseable
✔  Ready for Step 5 — Historical Context Integration
```

---

---

## Step 5 — Narrative Builder (User-facing)

### Objective

Transform Step 4 structural interpretation into a user-facing explanation block.
Terminal-grade clarity. 80–120 words total. No internal logic exposed.

---

### 5.1 Inputs

```
Structure Statement    → Step 4
Causal Explanation     → Step 4
Alignment State        → Step 3
Conflict Severity      → Step 3
Signal Meanings        → Step 2
```

---

### 5.2 Output Structure (Strict)

Five fixed sections in this exact order:

```
1. Setup Summary          (1 sentence)
2. Signal Alignment       (1 sentence)
3. Supporting Structure   (max 2 bullets)
4. Weakening Structure    (max 2 bullets)
5. Structural Interpretation  (1–2 sentences — Step 4 output verbatim)
```

---

### 5.3 Section Construction Rules

#### 1. Setup Summary

- Combines WHAT + primary constraint into one standalone sentence
- Must be readable without any other context
- **Form:** `"[Core structure statement], while [primary constraint]."`

**Examples:**
- `"Leadership remains strong, but broader participation is limited."`
- `"Structural support is broad, with concentration risk contained."`
- `"The structure is internally inconsistent, with key signals pointing in different directions."`

---

#### 2. Signal Alignment

- States the alignment classification and the core reason
- **Form:** `"Signal alignment is [Aligned / Mixed / Divergent], because [one-clause reason]."`

**Examples:**
- `"Signal alignment is Divergent, because momentum and breadth point in opposite directions."`
- `"Signal alignment is Aligned, because breadth, structure, and momentum are mutually consistent."`
- `"Signal alignment is Mixed, because momentum is strong while market structure remains transitional."`

---

#### 3. Supporting Structure (bullets)

- Use signal meaning phrases from Step 2 verbatim
- No additional explanation
- Max 2 bullets

**Format:**
```
• [Signal meaning phrase]
• [Signal meaning phrase]
```

**Example:**
```
• Price strength is persistent
• Price structure is stable
```

---

#### 4. Weakening Structure (bullets)

- Use signal meaning phrases from Step 2 verbatim
- Prioritize by Step 3 hierarchy (Breadth first)
- Max 2 bullets

**Format:**
```
• [Signal meaning phrase]
• [Signal meaning phrase]
```

**Example:**
```
• Narrow participation
• Leadership is concentrated in few names
```

---

#### 5. Structural Interpretation

- Reuse Step 4 output verbatim (Structure Statement + Causal Explanation)
- Do NOT expand, paraphrase, or add sentences
- Exactly as produced in Step 4

---

### 5.4 Language Rules

| Rule | Requirement |
|------|------------|
| Sentences | Full sentences only — no fragments |
| Tone | Institutional — neutral, factual |
| Hype | None |
| Repetition | No phrase repeated across sections |
| Historical | None in this step |
| Length | 80–120 words total across all 5 sections |

---

### 5.5 Full Example

**Input state:** Divergent / Structural Conflict / Late-stage / AI_DISTORTION

```
Setup Summary:
  Leadership remains concentrated within a late-stage structure, while broader participation is limited.

Signal Alignment:
  Signal alignment is Divergent, because momentum and breadth point in opposite structural directions.

Supporting Structure:
  • Price strength is persistent
  • Price structure is stable

Weakening Structure:
  • Narrow participation
  • Leadership is concentrated in few names

Structural Interpretation:
  Leadership remains concentrated within a late-stage structure, while broader participation is limited.
  This is driven by persistent momentum and elevated AI concentration, while breadth remains narrow and market structure is weakening.
```

Word count: ~90

---

### 5.6 Rules

- Total output: 80–120 words (count excludes section labels)
- Supporting and Weakening bullets use Step 2 phrases only — no new language
- Structural Interpretation is always Step 4 verbatim
- No section may reference historical data
- No confidence language in this step

---

### 5.7 Success Criteria

```
✔  Setup Summary is standalone-readable
✔  Alignment state explicitly named (Aligned / Mixed / Divergent)
✔  Supporting bullets use Step 2 phrases exactly
✔  Weakening bullets prioritized by Step 3 hierarchy
✔  Structural Interpretation is Step 4 verbatim — not paraphrased
✔  Total output within 80–120 words
✔  No trading or forecast language
✔  Ready for Step 6 — Historical Context + Confidence Layer
```

---

---

## Step 6 — Historical Context + Confidence Layer

### Objective

Append historical context (when analog available) and a confidence qualification to the Step 5 narrative.
Completes the full Interpretation Layer. No forecasting. No probabilities.

---

### 6.1 Inputs

```
Narrative block      → Step 5
Alignment State      → Step 3
Conflict Severity    → Step 3
Data Quality         → engine metadata (High | Medium | Low)
Historical Analog    → distance score + label (from P2-6 engine, Phase B+)
```

---

### 6.2 Output — Two Appended Sections

```
6. Historical Similar Setup   (1–2 sentences, conditional)
7. Confidence                 (1 sentence, always present)
```

---

### 6.3 Historical Similar Setup

#### Inclusion Rule

| Condition | Action |
|-----------|--------|
| Analog distance < 0.35 | Include this section |
| No analog / distance ≥ 0.35 | Omit this section entirely |

#### Mandatory Language

- Must begin with: `"This setup is historically similar to …"`
- Must follow with: `"Historically similar setups showed …"`

#### Allowed Content

- Structural resemblance only
- Regime description (e.g., narrow leadership, late-stage participation)
- Behavioral patterns observed (e.g., leadership concentration, uneven participation)

#### Forbidden Content

```
NO prediction of future outcomes
NO probabilities or return estimates
NO timing statements ("X will happen in Y weeks")
```

#### Example

```
This setup is historically similar to prior periods where leadership was concentrated in a small group of infrastructure names.
Historically similar setups showed continued strength in leading segments while broader participation remained limited.
```

---

### 6.4 Confidence Layer

#### Purpose

State how much trust the interpretation deserves, based on signal agreement and data quality.

#### Confidence Levels and Logic

| Level | Conditions |
|-------|-----------|
| **High** | Alignment = Aligned AND Data Quality = High AND Conflict Severity = None or Mild |
| **Medium** | Alignment = Mixed OR minor conflicts present |
| **Low** | Alignment = Divergent OR Structural Conflict OR Data Quality = Low |

When multiple conditions apply, the lowest applicable level takes precedence.

#### Output Format

```
"Interpretation confidence is [High / Medium / Low], because [reason]."
```

#### Reason Construction Rules

- Must reference signal agreement OR data quality — not both unless necessary
- One clause only

**Examples:**
- `"Interpretation confidence is high, because signals are broadly aligned with stable data quality."`
- `"Interpretation confidence is medium, because signals are partially aligned while key constraints remain."`
- `"Interpretation confidence is low, because core signals are in structural conflict despite stable data quality."`

---

### 6.5 Integration Rule

```
Final output = Step 5 Narrative
             + Step 6 Historical Similar Setup (if analog available)
             + Step 6 Confidence (always)
```

Final structure (7 sections):
```
1. Setup Summary
2. Signal Alignment
3. Supporting Structure
4. Weakening Structure
5. Structural Interpretation
6. Historical Similar Setup   ← conditional
7. Confidence                 ← always
```

---

### 6.6 Length Constraint

| Section | Limit |
|---------|-------|
| Historical Similar Setup | Max 2 sentences |
| Confidence | Exactly 1 sentence |
| Combined total (Step 5 + Step 6) | 100–150 words |

---

### 6.7 Full Output Example

**State:** Divergent / Structural Conflict / Late-stage / Analog available (distance 0.21)

```
Setup Summary:
  Leadership remains concentrated within a late-stage structure, while broader participation is limited.

Signal Alignment:
  Signal alignment is Divergent, because momentum and breadth point in opposite structural directions.

Supporting Structure:
  • Price strength is persistent
  • Price structure is stable

Weakening Structure:
  • Narrow participation
  • Leadership is concentrated in few names

Structural Interpretation:
  Leadership remains concentrated within a late-stage structure, while broader participation is limited.
  This is driven by persistent momentum and elevated AI concentration, while breadth remains narrow and market structure is weakening.

Historical Similar Setup:
  This setup is historically similar to prior periods where infrastructure leadership was narrow and momentum diverged from participation.
  Historically similar setups showed continued leadership strength while broader segments lagged.

Confidence:
  Interpretation confidence is low, because core signals are in structural conflict despite stable data quality.
```

Word count: ~130

---

### 6.8 Success Criteria

```
✔  "historically similar setup" language used correctly
✔  No forecast language in Historical section
✔  Historical section omitted when no valid analog exists
✔  Confidence level derived correctly from alignment + data quality
✔  Confidence reason references signal agreement or data quality
✔  No redundancy between sections 6 and 7 and earlier narrative
✔  Combined word count within 100–150
```

---

## Core Flow — Complete

```
Engine Output
    ↓
Step 2 — Signal Meaning Mapping
    ↓
Step 3 — Agreement / Conflict Detection
    ↓
Step 4 — Structural Interpretation (WHAT + WHY)
    ↓
Step 5 — Narrative Builder (user-facing block)
    ↓
Step 6 — Historical Context + Confidence
    ↓
Final Output (7-section block, 100–150 words)
```

---

## Pending Steps

| Step | Title | Status |
|------|-------|--------|
| Step 1 | Core Principles | ✅ Complete |
| Step 2 | Signal Meaning Mapping | ✅ Complete |
| Step 3 | Agreement / Conflict Detection | ✅ Complete |
| Step 4 | Structural Interpretation | ✅ Complete |
| Step 5 | Narrative Builder | ✅ Complete |
| Step 6 | Historical Context + Confidence | ✅ Complete |

---

## Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-28 | 0.1 | Step 1 — Core Principles |
| 2026-04-28 | 0.2 | Step 2 — Signal Meaning Mapping |
| 2026-04-28 | 0.3 | Step 3 — Agreement / Conflict Detection |
| 2026-04-28 | 0.4 | Step 4 — Structural Interpretation |
| 2026-04-28 | 0.5 | Step 5 — Narrative Builder |
| 2026-04-28 | 0.6 | Step 6 — Historical Context + Confidence Layer |
