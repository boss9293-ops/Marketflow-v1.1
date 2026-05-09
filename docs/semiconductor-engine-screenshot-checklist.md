# Semiconductor Engine — Screenshot / Demo Capture Checklist

---

## Required Screenshots

| # | Subject | Location | Notes |
|---|---------|---------|-------|
| 1 | Full dashboard overview | `/semiconductor` — ENGINE tab | All 3 columns visible; CYCLE VIEW active |
| 2 | AI Regime label + KPI strip | Top KPI strip | Regime label visible; conflict type human-readable |
| 3 | Relative Spread vs SOXX chart | CYCLE VIEW [1] | 4 bucket lines + SOXX reference at 0 |
| 4 | Rebased Bucket Flow chart | CYCLE VIEW [2] | 5 series from 0 baseline |
| 5 | Capital Flow Stage timeline | CYCLE VIEW [3] | Color-coded stage badges visible |
| 6 | Simplified interpretation panel | Right panel | 5 blocks: Summary, Leading, Lagging, Capital Flow, SOXL |
| 7 | SOXL sensitivity block | Right panel ⑤ | Level label + reason text visible |
| 8 | Data status / footer | Footer strip | LIVE/SNAPSHOT label + source + last updated |
| 9 | SOXX/SOXL Translation tab | STRATEGY tab | Translation blocks visible |
| 10 | Playback tab | PLAYBACK tab | Period selector + dataStatus note visible |

---

## Screenshot Rules

```
[✅] No broken data state (unless intentionally showing fallback)
[✅] No raw enum labels as primary display (AI_DISTORTION → "AI Leadership Narrow")
[✅] No overly long text blocks
[✅] No trading or forecast language in any visible UI text
[✅] Data status is visible in footer
[✅] Last updated timestamp visible
[✅] Chart legends use full names (AI Compute, Memory, Foundry, Equipment)
[✅] SOXX reference line labeled in charts
```

---

## Pre-Screenshot Setup

1. Run dev server from `marketflow/frontend/`: `npm run dev`
2. Open `/semiconductor` in browser
3. Confirm ENGINE tab is active
4. Confirm CYCLE VIEW is the active center tab
5. Confirm real data is loaded (check footer: SNAPSHOT or LIVE)
6. Confirm AI Regime label is visible (not `—`)

---

## Capture Order (Recommended)

```
1. Full dashboard (wide viewport, 1440px+)
2. KPI strip close-up
3. CYCLE VIEW [1] close-up
4. CYCLE VIEW [2] close-up
5. CYCLE VIEW [3] close-up
6. Right panel close-up (scroll to show all 5 blocks)
7. Footer close-up
8. Switch to STRATEGY tab → capture
9. Switch to PLAYBACK tab → capture
```
