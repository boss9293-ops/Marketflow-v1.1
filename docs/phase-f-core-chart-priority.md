# Phase F Step 3 — Core Chart Priority
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Ensure the three core charts that answer the product purpose are primary and prominent.

Product purpose:
```
Track AI-era semiconductor capital flow using SOXX as the anchor.
Show which groups support SOXX, which weaken it, and how capital spreads.
```

---

## 2. Three Core Charts

### Chart 1 — SOXX Relative Spread
**Location:** CYCLE VIEW tab → [1] Relative Spread vs SOXX
**Formula:** Bucket Return − SOXX Return (rebased window)
**Series:** AI Compute, Memory, Foundry, Equipment
**Purpose:** Shows what is supporting or weakening SOXX.

### Chart 2 — Rebased Bucket Flow
**Location:** CYCLE VIEW tab → [2] Rebased Bucket Flow
**Formula:** Delta from window start (rebased to 0)
**Series:** SOXX, AI Compute, Memory, Foundry, Equipment
**Purpose:** Shows where capital moved first and what followed.

### Chart 3 — Capital Flow Stage
**Location:** Right panel → ④ Capital Flow Stage + Left panel → AI Regime Lens
**Source:** `interpData.regime_context` → `rotation_risk.note` → `interpretation`
**AI Regime Lens:** 5 component bars (AI Compute, Memory, Foundry, Equipment, Rotation)
**Purpose:** Shows how far AI capital has spread across semiconductor stages.

---

## 3. Changes Made

### File: `components/semiconductor/TerminalXDashboard.tsx`

**CYCLE VIEW — [1] and [2] reordered and updated:**

| Position | Before | After |
|----------|--------|-------|
| [1] | SOXX Anchor (SOXX only, AreaChart) | **Relative Spread vs SOXX** (Chart 1) |
| [2] | Relative Spread vs SOXX (LineChart) | **Rebased Bucket Flow** (Chart 2, all 5 series) |
| [3] | Current Relative Ranking | Unchanged |

**Label updates:**
- "AI Infra" → "AI Compute" (aligned with bucket definition)
- "Equip" → "Equipment" (full name)

---

## 4. Data Sources

| Chart | Data | Available |
|-------|------|---------|
| Chart 1 — Relative Spread | `spreadData` (from `rebasedData`) | ✅ Live from history.rows |
| Chart 2 — Rebased Bucket Flow | `rebasedData` (soxx, ai, mem, foundry, equip) | ✅ Live from history.rows |
| Chart 3 — Capital Flow Stage | `interpData.regime_context` + AI Regime Lens | ✅ From /api/interpretation |

No new data sources required.

---

## 5. Chart 3 — Capital Flow Stage Reference

Capital flows in this order (when healthy):
```
AI Compute → Memory → Foundry → Equipment → Broad Participation
```

AI Regime Lens states map to stage confirmation:
| Component State | Stage Meaning |
|---|---|
| LEADING / CONFIRMED / SUPPORTING | Stage confirmed |
| IN_LINE / PARTIAL / NEUTRAL | Stage partial |
| LAGGING_AI_DELAY | Stage pending (AI delay pattern) |
| LAGGING_CYCLE | Stage not confirmed |
| WEAK / NOT_CONFIRMED | Stage absent |

---

## 6. TypeScript Compile

`tsc --noEmit --skipLibCheck` → **clean (0 errors)**

---

## 7. Success Criteria

```
[✅] Chart 1 (Relative Spread) is primary / first in CYCLE VIEW
[✅] Chart 2 (Rebased Bucket Flow) shows all 5 series
[✅] Chart 3 (Capital Flow Stage) exists in right panel + AI Regime Lens
[✅] No new data sources added
[✅] Labels updated: AI Infra → AI Compute, Equip → Equipment
[✅] TypeScript compile passes
```

---

## 8. Next Step

**Phase F Step 4 — Bucket and Data Scope Lock**
Document and enforce minimal data scope.
