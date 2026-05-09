# Phase G Step 1 — Bucket Series Builder
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Objective

Establish the data foundation for all Phase G charts using existing `history.rows` data from `/api/semiconductor/history`.

---

## 2. Data Source

| Field | Source | Available |
|-------|--------|---------|
| `history.rows` | `/api/semiconductor/history` | ✅ |
| `soxx` | `row.soxx` | ✅ |
| `ai` | `row.ai` | ✅ (AI Compute bucket) |
| `mem` | `row.mem` | ✅ (Memory bucket) |
| `foundry` | `row.foundry` | ✅ (Foundry bucket) |
| `equip` | `row.equip` | ✅ (Equipment bucket) |

---

## 3. Two Derived Series

### rebasedData — Rebased to Window Start (delta from 0)
```ts
const first = rows[0]
const rebasedData = rows.map(r => ({
  date:    r.date,
  soxx:    r.soxx    - first.soxx,
  ai:      r.ai      - first.ai,
  mem:     r.mem     - first.mem,
  foundry: r.foundry - first.foundry,
  equip:   r.equip   - first.equip,
}))
```
Used by: Chart 2 — Rebased Bucket Flow

### spreadData — Relative Spread vs SOXX
```ts
const spreadData = rebasedData.map(r => ({
  date:    r.date,
  ai:      r.ai      - r.soxx,
  mem:     r.mem     - r.soxx,
  foundry: r.foundry - r.soxx,
  equip:   r.equip   - r.soxx,
}))
```
Used by: Chart 1 — Relative Spread vs SOXX

---

## 4. No New Data Required

All series derived from existing `history.rows`. No new API endpoints, no new tickers, no new fields added.

---

## 5. Success Criteria

```
[✅] rebasedData computed from history.rows
[✅] spreadData computed from rebasedData
[✅] No new data sources
[✅] 5 series available: soxx, ai, mem, foundry, equip
```
