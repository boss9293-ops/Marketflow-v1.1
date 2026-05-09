# Phase E Step 3 — Playback Route Adapter Validation
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Real Replay File Used

`backend/output/replay/2022_tightening.json`

- window: 2022_tightening
- trading_days: 251
- date_range: 2022-01-03 → 2022-12-30

---

## 2. JSON Shape

```json
{
  "window": "2022_tightening",
  "snapshots": [
    {
      "date": "2022-01-03",
      "state": "Normal",
      "regime": "Expansion",
      "mss": 108.0,
      "total_risk": 11,
      "crisis_stage_label": "Normal"
    }
  ]
}
```

---

## 3. Timeline Mapping

| Snapshot Field | → Timeline Field | Mapping Rule |
|---|---|---|
| `date` | `date` | Direct |
| index × step + 1 | `cycleDay` | Sampled every ~22 trading days |
| `state` + `regime` | `stage` | vrStateToStage() |
| `mss` | `breadth` | ≥100=Broad, ≥92=Mixed, else Narrow |
| `total_risk` | `momentum` | <20=Strong, <45=Neutral, else Weak |
| `regime` | `map` | Liquidity Crisis=Unstable, else Stable |
| `crisis_stage_label` | `conflict` | Normal=None, else label |

### vrStateToStage() mapping

| state | regime | → stage |
|-------|--------|---------|
| High Risk / Crisis | any | Trough |
| Warning | any | Contraction |
| Caution | any | Contraction Watch |
| any | Liquidity Crisis | Contraction |
| Normal | Expansion | Expansion |

---

## 4. Legacy Stress Reference Behavior

- `contraction_2022` loads real timeline when `2022_tightening.json` exists
- `dataStatus.source` = `'snapshot'`
- Note text: "The 2022 Contraction period uses real VR engine replay data. This period is shown as a legacy stress reference, not as a direct AI-regime analog."
- `dataStatus.missing` = `['bucket_series']` (no bucket price series available)

---

## 5. Fallback Behavior

| Condition | Behavior |
|-----------|---------|
| File missing | Uses static fallback timeline, `source: 'fallback'` |
| JSON parse error | Uses static fallback, no crash |
| Empty snapshots | Returns null → fallback |

---

## 6. Forbidden Word Scan

| Word | playback/route.ts |
|------|------------------|
| buy | PASS |
| sell | PASS |
| entry | PASS |
| exit | PASS |
| target | PASS |
| forecast | PASS |
| predict | PASS |
| expected | PASS |
| will | PASS |

---

## 7. TypeScript Compile

`tsc --noEmit --skipLibCheck` → **clean (0 errors)**

---

## 8. Success Criteria

```
[✅] contraction_2022 loads 2022_tightening.json when available
[✅] Playback route never crashes (try/catch + fallback)
[✅] 2022 labeled as Legacy Stress Reference
[✅] missing[] discloses bucket_series absence
[✅] Fallback remains safe for all other periods
[✅] TypeScript compile passes
```
