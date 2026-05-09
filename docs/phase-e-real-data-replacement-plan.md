# Phase E Step 2 — Real Data Replacement Plan
**Date:** 2026-04-29 | **Status:** PLAN COMPLETE (Controlled PARTIAL acceptable)

---

## 1. Current Fallback Data Map

### Tab 3 — Playback

| Component | File / Route | Purpose | Real Replacement |
|-----------|-------------|---------|-----------------|
| Historical periods (3) | `app/api/playback/route.ts` (inline) | Period definitions | Derive from replay snapshot files |
| Bucket series (rebased 100) | Inline static arrays in route.ts | SOXX + AI Infra/Memory/Foundry/Equipment price chart | Real bucket price series — NOT yet available |
| Cycle Day Timeline | Inline static arrays in route.ts | Daily stage/breadth/momentum/map table | Derivable from VR replay snapshots (partial) |
| Interpretation snapshots | Inline static objects in route.ts | Structural interpretation per period | Future: derive from engine snapshots |

### Tab 2 — SOXX/SOXL Translation

| Component | File / Route | Purpose | Real Replacement |
|-----------|-------------|---------|-----------------|
| SOXL EngineOutput | `app/api/translation/route.ts` | SOXL-specific structural interpretation | Partially available via `semiconductor_market_data.json` |
| SOXL delta / amplification | Computed from SOXX structure | Leverage sensitivity | Future: SOXL-specific engine output |
| `dataMode` disclosure | Not yet implemented | Indicates derived vs SOXL-specific | Phase E2-C |

---

## 2. Candidate Real Data Sources

### Available Now

| Source | Location | Contents | Usability |
|--------|----------|---------|----------|
| VR replay snapshots | `backend/output/replay/2022_tightening.json` | 251 daily VR snapshots (2022-01-03 → 2022-12-30): date, state, MSS, regime | **HIGH** — timeline derivable |
| VR replay snapshots | `backend/output/replay/2020_covid.json` | 125 daily VR snapshots (2020-01-02 → 2020-06-30): date, state, MSS, regime | **PARTIAL** — covers Jan-Jun 2020 only (recovery period is Apr-Dec) |
| VR replay snapshots | `backend/output/replay/2025_current.json` | Recent period | **LOW** — not matched to current playback periods |
| VR replay snapshots | `backend/output/replay/2023_bank_stress.json` | 2023 bank stress period | **LOW** — not a current playback period |
| Live semiconductor data | `backend/output/cache/semiconductor_market_data.json` | SOXX, SOXL, 10 tickers: price, 5d/20d/30d/60d returns, slope, above_20dma | **HIGH** for SOXL translation |

### Not Yet Available

| Source | Why Needed | Status |
|--------|-----------|--------|
| SOXX daily price series (2020, 2022, 2024) | Rebased 100 bucket charts in Playback | Not in current data pipeline |
| AI Infrastructure bucket daily prices | AI Infra series in playback chart | Not in current data pipeline |
| Memory bucket daily prices | Memory series in playback chart | Not in current data pipeline |
| Foundry bucket daily prices | Foundry series in playback chart | Not in current data pipeline |
| Equipment bucket daily prices | Equipment series in playback chart | Not in current data pipeline |
| 2024 AI Expansion VR replay | `ai_expansion_2024` period timeline | No 2024 replay file exists |
| SOXL-specific EngineOutput | Full SOXL structural engine score | Not yet built |

---

## 3. Playback Data Contract

Real playback data must conform to this shape:

```ts
type PlaybackRealData = {
  periods: PlaybackPeriod[];
  periodData: Record<string, {
    series:         PlaybackSeriesPoint[];
    timeline:       PlaybackTimelinePoint[];
    interpretation: InterpretationOutput;
  }>;
  dataStatus: {
    source:  'snapshot' | 'database' | 'fallback';
    note?:   string;
    missing?: string[];   // optional list of missing fields disclosed to UI
  };
  lastUpdated?: string;
};

type PlaybackSeriesPoint = {
  date:       string;
  soxx:       number;    // rebased 100 at period start
  aiInfra?:   number;
  memory?:    number;
  foundry?:   number;
  equipment?: number;
};

type PlaybackTimelinePoint = {
  date:      string;
  cycleDay:  number;
  stage:     string;     // e.g. 'Expansion', 'Contraction', 'Early Cycle'
  breadth:   string;
  momentum:  string;
  map:       string;
  conflict:  string;
};
```

Rules:
- Missing bucket series must not crash UI (optional fields)
- Missing fields must be disclosed in `dataStatus.missing[]`
- `dataStatus.source` drives the badge shown in Tab 3

---

## 4. SOXL-Specific Translation Contract

Target input type for `/api/translation`:

```ts
type SoxxSoxlTranslationInput = {
  soxx: EngineOutput;
  soxl?: {
    momentum:        'strong' | 'neutral' | 'weak';
    map:             'strong' | 'neutral' | 'weak';
    volatility_mult: number;   // estimated from return_5d vs soxx return_5d ratio
  };
  leverageContext: {
    leverageRatio:           number;   // 3x for SOXL
    volatilitySensitivity:   'low' | 'medium' | 'high';
    correlationSensitivity:  'low' | 'medium' | 'high';
  };
  dataMode: 'soxl-specific' | 'derived';
};
```

Current SOXL data available in `semiconductor_market_data.json`:
- `return_5d`, `return_20d`, `return_30d`, `return_60d`, `slope_30d`, `above_20dma`
- Can derive: momentum (`slope_30d` > 0 and `above_20dma` → strong), map (from returns trend)
- Cannot derive: breadth, correlation, ai_concentration (SOXL-level)

---

## 5. Replacement Phase Plan

### Phase E2-A — Inventory (COMPLETE)

Status: Done in this document.

Findings:
- `2022_tightening.json` replay: usable for `contraction_2022` timeline
- `2020_covid.json` replay: partial usability for `recovery_2020` timeline (Jan-Jun only)
- No replay file for `ai_expansion_2024`
- SOXL current ticker data available for enhanced translation
- Bucket price series: not yet available for any period

### Phase E2-B — Playback Route Adapter

Target file: `app/api/playback/route.ts`

Implementation:
1. Add `loadReplayTimeline(window: string): PlaybackTimelinePoint[] | null` — reads from `backend/output/replay/{window}.json`
2. Map VR state/MSS → semiconductor cycle stage:

```ts
function vrStateToStage(state: string, regime: string): string {
  if (state === 'Normal' && regime === 'Expansion')    return 'Expansion'
  if (state === 'Caution')                             return 'Mid Expansion'
  if (state === 'Warning')                             return 'Contraction'
  if (state === 'High Risk' || state === 'Crisis')     return 'Trough'
  return 'Transitional'
}
```

3. Period → replay file mapping:

| Tab 3 Period | Replay File | Coverage | Status |
|-------------|------------|---------|--------|
| `contraction_2022` | `2022_tightening.json` | Full 2022 (251 days) | ✅ Use real timeline |
| `recovery_2020` | `2020_covid.json` | Jan-Jun 2020 only | ⚠️ Partial — supplement with fallback |
| `ai_expansion_2024` | None | — | ❌ Use fallback timeline |

4. Bucket series: fallback preserved (no real source)
5. Response `dataStatus.source`: `'snapshot'` if timeline real, `'fallback'` if fully fallback
6. `dataStatus.missing`: `['bucket_series']` if bucket data absent

### Phase E2-C — SOXL-Specific Translation

Target file: `app/api/translation/route.ts`

Implementation:
1. Read SOXL ticker from `semiconductor_market_data.json` (already loaded for SOXX)
2. Derive partial SOXL EngineOutput:

```ts
const soxlMomentum = soxlRaw.slope_30d > 0.01 ? 'strong'
                   : soxlRaw.slope_30d < -0.01 ? 'weak' : 'neutral'
const soxlMap      = soxlRaw.above_20dma && soxlRaw.return_20d > 0 ? 'strong'
                   : !soxlRaw.above_20dma ? 'weak' : 'neutral'
const dataMode     = 'derived'   // until full SOXL engine is built
```

3. Add `dataMode` field to response: `'soxl-specific'` or `'derived'`
4. Add DATA MODE badge to Tab 2 Block ⑥ Data Source

---

## 6. Fallback Preservation Rules

| Condition | Behavior |
|-----------|---------|
| Real timeline available | Use real timeline, keep fallback series |
| Real timeline partial | Use real for covered dates, fallback for gaps, disclose |
| Real source unavailable | Use full fallback, show `DATA STATUS FALLBACK` |
| Route error | Return 503, Tab 3 shows "Interpretation not available." |
| SOXL partial data | Show `DATA MODE: DERIVED FROM SOXX`, render all blocks |

**Never remove fallback before real data is confirmed working.**

---

## 7. Validation Plan

### Scenario 1 — Full Real Timeline (contraction_2022)
Expected:
- `DATA STATUS SNAPSHOT` badge shown
- Timeline shows real VR-derived stage/breadth/momentum/map
- Bucket series still shows static (fallback, disclosed in missing[])
- Interpretation uses existing fallback InterpretationOutput

### Scenario 2 — Partial Coverage (recovery_2020)
Expected:
- Timeline shows real data for Jan-Jun 2020, fallback for remainder
- `dataStatus.missing` includes `'timeline_partial'`
- No UI crash on gap dates

### Scenario 3 — No Real Playback Source (ai_expansion_2024)
Expected:
- `DATA STATUS FALLBACK`
- All 3 existing fallback blocks render normally
- No behavior change from current state

### Scenario 4 — SOXL Partial Translation
Expected:
- `DATA MODE: DERIVED FROM SOXX` shown in Tab 2 Block ⑥
- Delta renders normally (derived amplification)
- Watch conditions render normally
- No UI crash

---

## 8. Data Mode Disclosure — Tab 2

Modify `SoxxSoxlTranslationTab.tsx` Block ⑥ to show DATA MODE badge:

```tsx
{/* ⑥ Data Source */}
<div className="...">
  <span>⑥ Data Source</span>
  <span className={dataMode === 'soxl-specific'
    ? 'text-emerald-400 border-emerald-500/30'
    : 'text-yellow-400 border-yellow-500/30'
  }>DATA MODE: {dataMode === 'soxl-specific' ? 'SOXL-SPECIFIC' : 'DERIVED FROM SOXX'}</span>
  <p>Translation data uses the current engine snapshot...</p>
</div>
```

This is deferred to Phase E2-B/C implementation.

---

## 9. Known Limitations (Accepted)

| Limitation | Reason | Accepted |
|-----------|--------|---------|
| Bucket price series not available | No historical bucket price pipeline | ✅ Disclosed via `dataStatus.missing` |
| `recovery_2020` timeline only partial | 2020_covid.json covers Jan-Jun, not full recovery | ✅ Partial timeline acceptable |
| `ai_expansion_2024` fully fallback | No 2024 VR replay file exists | ✅ Fallback + disclosure |
| SOXL EngineOutput is derived | Full SOXL engine not yet built | ✅ `DATA MODE: DERIVED` disclosure |
| Interpretation snapshots remain static | No historical engine snapshot storage yet | ✅ Acceptable for Phase E |

---

## 10. TypeScript Compile

No code changes in this step (plan only).

`tsc --noEmit --skipLibCheck` → **clean (carried over from Phase E Step 1)**

---

## 11. Success Criteria — This Step

```
[✅] Real data source inventory documented
[✅] Replay file structure confirmed (2022_tightening, 2020_covid)
[✅] SOXL current data availability confirmed (semiconductor_market_data.json)
[✅] Playback real data contract defined
[✅] SOXL-specific translation contract defined
[✅] Replacement phases defined (E2-A / E2-B / E2-C)
[✅] Fallback preservation rules documented
[✅] Data mode disclosure plan defined
[✅] Validation scenarios documented
[✅] Known limitations documented
```

---

## 12. Next Step

**Phase E Step 3 — Implement Playback Route Adapter**

Implement Phase E2-B:
1. Add `loadReplayTimeline()` to `app/api/playback/route.ts`
2. Wire `contraction_2022` → `2022_tightening.json`
3. Add `dataStatus.missing[]` field to route response
4. Preserve all fallback behavior
5. TypeScript compile must remain clean
