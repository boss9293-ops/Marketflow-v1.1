/**
 * FILE: market-path/engine.ts
 * RESPONSIBILITY: Market Path Engine — composite market direction signal
 *
 * INPUT:  MarketPathInput  — sector_tailwinds (semiconductor required) + optional macro_regime
 * OUTPUT: MarketPathOutput — path_signal, path_label, confidence, sector_contributions, narrative
 *
 * PHASE 1 (now):
 *   - Semiconductor only. Effective weight = 1.0 (sole contributor).
 *   - macro_regime is accepted but contribution = 0 (stub).
 *   - energy/financials/technology: accepted if present, weight normalized automatically.
 *
 * PHASE 2 (future — connect lib/macro/):
 *   - macro_regime contribution activated. Semiconductor weight = 0.70, macro = 0.30.
 *   - Flip MACRO_WEIGHT from 0 → 0.30 and implement macroToSignal().
 *
 * WEIGHT DESIGN (raw, before normalization):
 *   semiconductor: 0.70  energy: 0.10  financials: 0.10  technology: 0.10  macro: 0.30
 *   Normalization: available sector weights are scaled so sectors + macro = 1.0.
 *
 * PATH LABEL THRESHOLDS:
 *   >= +50  → Strongly Favorable
 *   >= +20  → Favorable
 *   >= -20  → Neutral
 *   >= -50  → Defensive
 *   <  -50  → Risk-Off
 *
 * DO NOT: import from semiconductor/, macro/, or any domain module
 * DO NOT: import React, use JSX, reference window/document
 */

import type {
  MarketPathInput,
  MarketPathOutput,
  SectorContribution,
  PathLabel,
  SignalConfidence,
  SectorTailwindOutput,
} from './types'

// ── Sector weights (raw — normalized at runtime) ──────────────────────────────

const RAW_SECTOR_WEIGHT: Record<string, number> = {
  semiconductor: 0.70,
  energy:        0.10,
  financials:    0.10,
  technology:    0.10,
}

// Phase 1: 0 → macro contribution stub. Phase 2: set to 0.30.
const MACRO_WEIGHT = 0

// ── Path label ────────────────────────────────────────────────────────────────

function toPathLabel(signal: number): PathLabel {
  if (signal >= 50)  return 'Strongly Favorable'
  if (signal >= 20)  return 'Favorable'
  if (signal >= -20) return 'Neutral'
  if (signal >= -50) return 'Defensive'
  return 'Risk-Off'
}

// ── Macro signal (Phase 2 stub) ───────────────────────────────────────────────
// Phase 2: map macro_regime.risk_score (0~100) → signal (-100~+100)
// risk_score 50 = neutral (signal 0), 100 = max risk (signal -100), 0 = max safety (signal +100)

function macroToSignal(riskScore: number): number {
  return Math.round((50 - riskScore) * 2)
}

// ── Sector contributions ──────────────────────────────────────────────────────

function buildSectorContributions(
  tailwinds: MarketPathInput['sector_tailwinds'],
  effectiveSectorScale: number,
): SectorContribution[] {
  const entries: Array<[string, SectorTailwindOutput]> = [
    ['semiconductor', tailwinds.semiconductor],
    ...(tailwinds.energy      ? [['energy',      tailwinds.energy]      as [string, SectorTailwindOutput]] : []),
    ...(tailwinds.financials  ? [['financials',  tailwinds.financials]  as [string, SectorTailwindOutput]] : []),
    ...(tailwinds.technology  ? [['technology',  tailwinds.technology]  as [string, SectorTailwindOutput]] : []),
  ]

  return entries.map(([id, tw]) => {
    const rawWeight      = RAW_SECTOR_WEIGHT[id] ?? 0.10
    const effectiveWeight = rawWeight * effectiveSectorScale
    return {
      sector_id:    id,
      signal:       tw.tailwind_signal,
      weight:       effectiveWeight,
      contribution: tw.tailwind_signal * effectiveWeight,
    }
  })
}

// ── Composite confidence ──────────────────────────────────────────────────────
// Phase 1: delegate to semiconductor confidence score directly.
// Phase 2: weighted average of all available sector confidence scores.

function computeCompositeConfidence(
  contributions: SectorContribution[],
  tailwinds:     MarketPathInput['sector_tailwinds'],
): { confidence: SignalConfidence; confidence_score: number } {
  // Phase 1: semiconductor is the sole driver
  const score = tailwinds.semiconductor.confidence_score

  const confidence: SignalConfidence =
    score >= 65 ? 'High' :
    score >= 40 ? 'Medium' :
    'Low'

  return { confidence, confidence_score: score }
}

// ── Narrative ─────────────────────────────────────────────────────────────────

function buildNarrative(
  tailwinds:    MarketPathInput['sector_tailwinds'],
  pathLabel:    PathLabel,
  dominantInput: string,
): { headline: string; rationale: string; risks: string[] } {
  const semi = tailwinds.semiconductor

  const headline =
    dominantInput === 'macro'
      ? `Market path: ${pathLabel} — macro conditions are overriding sector signals.`
      : `Market path: ${pathLabel} — ${semi.headline}`

  const rationale =
    dominantInput === 'semiconductor'
      ? `Semiconductor cycle (${semi.state}) is the primary driver. ${semi.primary_driver}.`
      : `Macro conditions are the dominant force, overriding semiconductor cycle readings.`

  const risks: string[] = []
  if (semi.has_conflict) {
    risks.push(`Semiconductor: ${semi.conflict_type.replace(/_/g, ' ')}`)
  }
  if (semi.confidence !== 'High') {
    risks.push(`Signal confidence is ${semi.confidence} — treat as directional guidance, not high-conviction`)
  }
  if (semi.primary_risk) {
    risks.push(semi.primary_risk)
  }

  return { headline, rationale, risks }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeMarketPath(inputs: MarketPathInput): MarketPathOutput {
  const { sector_tailwinds, macro_regime, as_of } = inputs

  // Available sector weight sum (raw)
  const availableIds = [
    'semiconductor',
    ...(sector_tailwinds.energy     ? ['energy']     : []),
    ...(sector_tailwinds.financials ? ['financials'] : []),
    ...(sector_tailwinds.technology ? ['technology'] : []),
  ]
  const rawSectorSum = availableIds.reduce((s, id) => s + (RAW_SECTOR_WEIGHT[id] ?? 0), 0)

  // Effective macro weight (Phase 1: 0, Phase 2: MACRO_WEIGHT when macro_regime present)
  const effectiveMacroWeight = macro_regime ? MACRO_WEIGHT : 0

  // Scale sector weights so all contributions sum to (1 - effectiveMacroWeight)
  const effectiveSectorScale = rawSectorSum > 0
    ? (1 - effectiveMacroWeight) / rawSectorSum
    : 1

  // Sector contributions
  const sectorContributions = buildSectorContributions(sector_tailwinds, effectiveSectorScale)
  const sectorSignalSum     = sectorContributions.reduce((s, c) => s + c.contribution, 0)

  // Macro contribution (Phase 1: always 0)
  const macroContribution = macro_regime
    ? macroToSignal(macro_regime.risk_score) * effectiveMacroWeight
    : 0

  const pathSignal  = Math.round(sectorSignalSum + macroContribution)
  const pathDisplay = Math.round((pathSignal + 100) / 2)
  const pathLabel   = toPathLabel(pathSignal)

  // Dominant input: largest absolute contribution
  const dominantSector = [...sectorContributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0]
  const dominantInput =
    macro_regime && Math.abs(macroContribution) > Math.abs(dominantSector?.contribution ?? 0)
      ? 'macro'
      : (dominantSector?.sector_id ?? 'semiconductor')

  const { confidence, confidence_score } = computeCompositeConfidence(sectorContributions, sector_tailwinds)
  const { headline, rationale, risks }   = buildNarrative(sector_tailwinds, pathLabel, dominantInput)

  return {
    path_signal:          pathSignal,
    path_display:         pathDisplay,
    path_label:           pathLabel,
    confidence,
    confidence_score,
    sector_contributions: sectorContributions,
    macro_contribution:   macroContribution,
    dominant_input:       dominantInput,
    headline,
    rationale,
    risks,
    as_of,
  }
}
