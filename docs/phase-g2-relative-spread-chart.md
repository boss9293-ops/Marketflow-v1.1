# Phase G Step 2 — Relative Spread vs SOXX Chart
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Replace CYCLE VIEW [1] (SOXX Anchor) with the primary "Relative Spread vs SOXX" chart.

---

## 2. Chart Specification

| Property | Value |
|----------|-------|
| Position | CYCLE VIEW tab — [1] (first chart) |
| Type | LineChart (Recharts) |
| Data | `spreadData` (ai, mem, foundry, equip vs soxx) |
| X axis | `date` |
| Y axis | Percentage pp (spread vs SOXX) |
| Reference line | y=0 (SOXX baseline) |
| Series | AI Compute, Memory, Foundry, Equipment |

---

## 3. Colors

| Series | Color |
|--------|-------|
| AI Compute | `#a78bfa` (violet) |
| Memory | `#34d399` (emerald) |
| Foundry | `#60a5fa` (blue) |
| Equipment | `#fb923c` (orange) |

---

## 4. Purpose

Directly answers: **"What supports SOXX? What weakens SOXX?"**

Lines above 0 = supporting SOXX.
Lines below 0 = lagging / weakening SOXX.

---

## 5. Change from Previous

| Before | After |
|--------|-------|
| [1] SOXX Anchor — SOXX only AreaChart | [1] Relative Spread vs SOXX — 4 series LineChart |

---

## 6. Success Criteria

```
[✅] Chart 1 is now Relative Spread vs SOXX
[✅] Uses spreadData (4 series vs soxx baseline)
[✅] Reference line at y=0 (SOXX baseline)
[✅] Labels: AI Compute, Memory, Foundry, Equipment (no abbreviations)
[✅] TypeScript compile passes
```
