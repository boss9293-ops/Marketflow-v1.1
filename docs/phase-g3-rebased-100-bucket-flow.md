# Phase G Step 3 — Rebased Bucket Flow Chart
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Promote CYCLE VIEW [2] to "Rebased Bucket Flow" — showing all 5 series (SOXX + 4 buckets) starting from 0 to reveal capital flow sequence.

---

## 2. Chart Specification

| Property | Value |
|----------|-------|
| Position | CYCLE VIEW tab — [2] (second chart) |
| Type | LineChart (Recharts) |
| Data | `rebasedData` (soxx, ai, mem, foundry, equip) |
| X axis | `date` |
| Y axis | % delta from window start (rebased to 0) |
| Reference line | y=0 (window start baseline) |
| Series | SOXX, AI Compute, Memory, Foundry, Equipment |

---

## 3. Colors

| Series | Color |
|--------|-------|
| SOXX | `#94a3b8` (slate — benchmark) |
| AI Compute | `#a78bfa` (violet) |
| Memory | `#34d399` (emerald) |
| Foundry | `#60a5fa` (blue) |
| Equipment | `#fb923c` (orange) |

---

## 4. Capital Flow Reading

The chart reveals which bucket led and what followed:
```
AI Compute → Memory → Foundry → Equipment → Broad Participation
```

SOXX line = benchmark to measure capital spread.

---

## 5. Purpose

Answers: **"How far has capital spread?"** and **"Is AI leadership broad or narrow?"**

Series moving together = broad participation.
Only AI Compute above SOXX = narrow leadership.

---

## 6. Change from Previous

| Before | After |
|--------|-------|
| [2] Relative Spread vs SOXX — 4 series | [2] Rebased Bucket Flow — 5 series (SOXX added) |

---

## 7. Success Criteria

```
[✅] Chart 2 is Rebased Bucket Flow
[✅] Shows all 5 series: SOXX, AI Compute, Memory, Foundry, Equipment
[✅] Data: rebasedData (delta from window start)
[✅] SOXX is slate/gray to distinguish as benchmark
[✅] TypeScript compile passes
```
