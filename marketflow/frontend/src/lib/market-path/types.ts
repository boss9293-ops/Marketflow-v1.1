/**
 * FILE: market-path/types.ts
 * RESPONSIBILITY: Define the public contract of the Market Path Engine.
 *   Sector modules (semiconductor, energy, etc.) adapt their internal output
 *   to SectorTailwindOutput before the parent engine consumes it.
 *
 * THIS FILE IS A CONTRACT, NOT AN IMPLEMENTATION.
 *   - No imports from domain modules (semiconductor/, terminal-mvp/, etc.)
 *   - Sector adapters import FROM here — never the reverse
 *   - Keep types minimal: only what the parent engine actually reads
 *
 * CONSUMPTION HIERARCHY:
 *   semiconductor/sectorTailwind.ts   → produces SectorTailwindOutput
 *   (future) energy/sectorTailwind.ts → produces SectorTailwindOutput
 *            ↓
 *   MarketPathInput.sector_tailwinds  → consumed by Market Path Engine
 *            ↓
 *   MarketPathOutput                  → served by /api/market-path
 *            ↓
 *   /api/forecast-lab                 → consumed by Forecast Lab UI
 *
 * PHASE MAP:
 *   Phase 1 (now)   — semiconductor only, MarketPath types defined, not implemented
 *   Phase 2         — macro_regime connected from lib/macro/
 *   Phase 3         — multi-sector, composite path_signal
 *
 * DO NOT: import from semiconductor/, macro/, terminal-mvp/, or any domain module
 */

// ── Shared signal types (kept here to avoid cross-module deps) ────────────────

export type SignalConfidence = 'Low' | 'Medium' | 'High'
export type SignalSentiment  = 'positive' | 'negative' | 'neutral'
export type DataFreshness    = 'high' | 'medium' | 'low'

// ── SectorTailwindOutput ──────────────────────────────────────────────────────
// The normalized output that each sector module must provide.
// Designed to be consumed by the Market Path Engine as one of N sector inputs.

export interface SectorKeySignal {
  label:     string          // e.g. "SOXX 60D Return"
  value:     string          // e.g. "+18.7%"
  sentiment: SignalSentiment
}

export interface SectorTailwindOutput {
  // ── Identity ──────────────────────────────────────────────────────────────
  sector_id:    string          // 'semiconductor' | 'energy' | 'financials' (future)
  sector_label: string          // "Semiconductor Cycle"
  version:      string          // 'semiconductor-lens-v2'

  // ── Core signal (parent engine uses for weighting and direction) ───────────
  tailwind_signal:  number      // -100~+100  internal calculation units
  tailwind_display: number      //   0~100    UI-safe display score
  state:            string      // CycleState string e.g. "Expansion"

  // ── Confidence (parent engine uses to weight sector contribution) ──────────
  confidence:       SignalConfidence
  confidence_score: number      // 0~100

  // ── Conflict (parent engine may penalize composite signal or flag UI) ──────
  conflict_type:  string        // ConflictTypeV2 string
  has_conflict:   boolean

  // ── Explanation (parent engine uses for composite narrative generation) ────
  primary_driver: string
  primary_risk:   string
  headline:       string        // 1-sentence market state summary
  key_signals:    SectorKeySignal[]  // 3~5 supporting evidence points

  // ── Metadata ──────────────────────────────────────────────────────────────
  data_quality: DataFreshness
  as_of:        string          // ISO date string "YYYY-MM-DD"
}

// ── MacroRegimeInput ──────────────────────────────────────────────────────────
// Slimmed view of lib/macro/ output for Market Path Engine consumption.
// Full macro output lives in lib/macro/types — this is the projection.

export interface MacroRegimeInput {
  regime_label: string          // e.g. "Risk On" | "Neutral" | "Risk Off"
  risk_score:   number          // 0~100 (from macro/compute.ts)
  liquidity:    'HIGH' | 'MED' | 'LOW' | 'DRAINING'
  vix_regime:   'LOW' | 'ELEVATED' | 'SPIKE'
  as_of:        string
}

// ── MarketPathInput ───────────────────────────────────────────────────────────
// Full input bundle consumed by the Market Path Engine.
// Phase 1: only semiconductor sector is required; others are optional.

export interface MarketPathInput {
  sector_tailwinds: {
    semiconductor:   SectorTailwindOutput
    energy?:         SectorTailwindOutput  // Phase 2
    financials?:     SectorTailwindOutput  // Phase 2
    technology?:     SectorTailwindOutput  // Phase 2
  }
  macro_regime?:    MacroRegimeInput       // Phase 2: connect lib/macro/
  market_breadth?:  {                      // Phase 3: market-wide breadth
    sp500_above_200ma:      number         // %
    nasdaq_advance_decline: number         // ratio
  }
  as_of: string
}

// ── MarketPathOutput ──────────────────────────────────────────────────────────
// Composite market direction signal produced by the Market Path Engine.
// Served by /api/market-path and consumed by /api/forecast-lab.

export type PathLabel =
  | 'Strongly Favorable'
  | 'Favorable'
  | 'Neutral'
  | 'Defensive'
  | 'Risk-Off'

export interface SectorContribution {
  sector_id:    string
  signal:       number          // -100~+100
  weight:       number          // 0~1
  contribution: number          // signal × weight
}

export interface MarketPathOutput {
  // ── Composite signal ───────────────────────────────────────────────────────
  path_signal:  number          // -100~+100
  path_display: number          //   0~100
  path_label:   PathLabel

  // ── Confidence ────────────────────────────────────────────────────────────
  confidence:       SignalConfidence
  confidence_score: number

  // ── Breakdown (which sector/macro drove the composite) ────────────────────
  sector_contributions: SectorContribution[]
  macro_contribution:   number              // macro_regime signal contribution
  dominant_input:       string              // e.g. "semiconductor" | "macro"

  // ── Explanation ───────────────────────────────────────────────────────────
  headline:  string
  rationale: string
  risks:     string[]

  as_of: string
}
