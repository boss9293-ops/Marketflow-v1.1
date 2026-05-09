/**
 * FILE: semiconductor/sectorTailwind.ts
 * RESPONSIBILITY: Adapter — SemiconductorEngineV2Output → SectorTailwindOutput
 *   This is the boundary between the semiconductor sub-module and the
 *   parent Market Path Engine. It SLIMS the full engine output to only
 *   what the parent engine needs.
 *
 * INPUT:  SemiconductorEngineV2Output — full internal engine output
 * OUTPUT: SectorTailwindOutput        — market-path compatible interface
 *
 * CONSUMPTION PATH:
 *   [Internal test]   /api/semiconductor-lens/v2  → returns full SemiconductorEngineV2Output
 *   [Product]         /api/market-path            → reads SectorTailwindOutput only
 *                     /api/forecast-lab           → reads SectorTailwindOutput only
 *   Key path in parent: input.sector_tailwinds.semiconductor
 *
 * ADAPTER RULES:
 *   - Map internal_signal (-100~+100) → tailwind_signal (same scale, same value)
 *   - Extract top 3~5 key signals from NormalizedMetric[] for evidence
 *   - Data quality = 'high' when all MVP metrics available, 'medium' otherwise
 *   - Do NOT include domain_scores, full metrics array, or explanation body
 *     (those are internal — use full v2 output for debugging only)
 *
 * DO NOT: import React, use JSX, reference window/document
 * DO NOT: add fields not defined in SectorTailwindOutput
 */

import type {
  SemiconductorEngineV2Output,
  NormalizedMetric,
} from './types'
import type {
  SectorTailwindOutput,
  SectorKeySignal,
  DataFreshness,
} from '../market-path/types'

// ── Evidence extraction ───────────────────────────────────────────────────────
// Select 3~5 representative signals from the full metrics list.
// Priority order mirrors what the parent engine most needs to understand.

const EVIDENCE_PRIORITY = [
  'soxx_return_60d',
  'breadth_pct_above_20ma',
  'soxx_vs_200ma',
  'leader_concentration_top5',
  'vix_level',
]

function extractKeySignals(metrics: NormalizedMetric[]): SectorKeySignal[] {
  return EVIDENCE_PRIORITY
    .map(id => metrics.find(m => m.id === id))
    .filter((m): m is NormalizedMetric => m !== undefined)
    .map(m => ({
      label:     m.name,
      value:     String(m.raw_value),
      sentiment: (
        m.signal_value > 15  ? 'positive' :
        m.signal_value < -15 ? 'negative' :
        'neutral'
      ) as 'positive' | 'negative' | 'neutral',
    }))
}

// ── Data quality assessment ───────────────────────────────────────────────────
// 'high'   = all 23 MVP metrics computed from live price data
// 'medium' = some metrics fell back to proxy or DEFAULT_MACRO values
// 'low'    = significant missing data

function assessDataQuality(metrics: NormalizedMetric[]): DataFreshness {
  const total  = metrics.length
  if (total < 15) return 'low'

  const highCount = metrics.filter(m => m.data_quality === 'high').length
  const ratio     = highCount / total

  if (ratio >= 0.85) return 'high'
  if (ratio >= 0.60) return 'medium'
  return 'low'
}

// ── Main export ───────────────────────────────────────────────────────────────

export function toSectorTailwind(
  output: SemiconductorEngineV2Output,
): SectorTailwindOutput {
  const { engine, confidence, explanation, metrics } = output

  return {
    // Identity
    sector_id:    'semiconductor',
    sector_label: 'Semiconductor Cycle',
    version:      'semiconductor-lens-v2',

    // Core signal
    tailwind_signal:  engine.internal_signal,
    tailwind_display: engine.engine_score,
    state:            engine.state,

    // Confidence
    confidence:       confidence.confidence_label,
    confidence_score: confidence.confidence_score,

    // Conflict
    conflict_type: engine.conflict_type,
    has_conflict:  engine.conflict_type !== 'NO_CONFLICT',

    // Explanation (slim — parent uses these for composite narrative)
    primary_driver: engine.primary_driver,
    primary_risk:   engine.primary_risk,
    headline:       explanation.headline,
    key_signals:    extractKeySignals(metrics),

    // Metadata
    data_quality: assessDataQuality(metrics),
    as_of:        output.as_of,
  }
}
