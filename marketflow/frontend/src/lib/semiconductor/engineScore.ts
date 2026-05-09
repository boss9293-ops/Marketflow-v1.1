/**
 * FILE: engineScore.ts
 * RESPONSIBILITY: Engine Layer 5 ??produce final engine score and detect state/conflicts
 *
 * INPUT:  DomainScores         ??output of computeDomainScores()
 *         NormalizedMetric[]   ??needed for conflict detection thresholds
 * OUTPUT: EngineOutputV2       ??engine_score (0~100), internal_signal (-100~+100),
 *                                state (CycleState), primary_driver, primary_risk,
 *                                conflict_type, confidence label (preliminary)
 *
 * CONFLICT DETECTION LOGIC:
 *   AI_DISTORTION       ??AI Infra strong, but Breadth weak and EW lags CW
 *   BREADTH_DIVERGENCE  ??SOXX up 60D, but breadth_pct < 45%
 *   MOMENTUM_DIVERGENCE ??RSI declining while price trend positive
 *   SECTOR_ROTATION     ??bucket spread > 30% and top/bottom switched
 *   MACRO_OVERRIDE      ??VIX > 28 or yield spike > 75bps
 *   VALUATION_STRETCH   ??RSI > 75 and SOXX/QQQ RS at high percentile
 *   MULTIPLE_CONFLICTS  ??2+ of the above simultaneously
 *
 * CYCLE STATE MAPPING (based on internal_signal + breadth confirmation):
 *   Contraction  ??signal < -40
 *   Trough       ??signal -40 ~ -15, breadth recovering
 *   Recovery     ??signal -15 ~ +10
 *   Expansion    ??signal +10 ~ +45
 *   Late Expansion ??signal +45 ~ +70, breadth still broad
 *   Peak Risk    ??signal > +45 AND (breadth weak OR concentration high)
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import type {
  DomainScores,
  NormalizedMetric,
  EngineOutputV2,
  CycleState,
  ConflictTypeV2,
  ConfidenceLabelV2,
} from './types'
import { aggregateToEngineSignal } from './domainScores'

// ?? Helpers ???????????????????????????????????????????????????????????????????

function signalToDisplay(signal: number): number {
  return Math.round((signal + 100) / 2)
}

function getMetric(metrics: NormalizedMetric[], id: string): NormalizedMetric | undefined {
  return metrics.find(m => m.id === id)
}

// ?? Conflict detection ????????????????????????????????????????????????????????

function detectConflicts(
  domains: DomainScores,
  metrics: NormalizedMetric[],
): ConflictTypeV2[] {
  const found: ConflictTypeV2[] = []

  const aiSignal      = domains.ai_infra.signal
  const breadthSignal = domains.breadth.signal
  const macroSignal   = domains.macro.signal
  const priceSig      = domains.price_trend.signal
  const momSig        = domains.momentum.signal

  const breadthPct  = getMetric(metrics, 'breadth_pct_above_20ma')?.normalized_value ?? 50
  const ewVsCw      = getMetric(metrics, 'equal_weight_vs_cap_spread')?.signal_value ?? 0
  const rsiRaw      = getMetric(metrics, 'soxx_rsi_14')?.raw_value
  const rsi         = typeof rsiRaw === 'number' ? rsiRaw : 50
  const soxxRsRaw   = getMetric(metrics, 'soxx_vs_qqq_ratio')?.normalized_value ?? 50
  const vixRaw      = getMetric(metrics, 'vix_level')?.raw_value
  const vix         = typeof vixRaw === 'number' ? vixRaw
    : typeof vixRaw === 'string' ? parseFloat(vixRaw) : 15
  const yieldRaw    = getMetric(metrics, 'yield_10y_change_30d')?.raw_value
  const yieldBps    = typeof yieldRaw === 'string'
    ? parseFloat(yieldRaw.replace('bps', ''))
    : (typeof yieldRaw === 'number' ? yieldRaw : 0)

  // Bucket spread: max - min bucket return signals
  const bucketKeys  = ['ai_infra_return_60d','memory_return_60d','foundry_return_60d','equipment_return_60d']
  const bucketSigs  = bucketKeys.map(k => getMetric(metrics, k)?.signal_value ?? 0)
  const bucketSpread = Math.max(...bucketSigs) - Math.min(...bucketSigs)

  // AI_DISTORTION: AI Infra leading, breadth weak, EW trailing CW
  if (aiSignal > 30 && breadthPct < 50 && ewVsCw < -10) {
    found.push('AI_DISTORTION')
  }

  // BREADTH_DIVERGENCE: SOXX return positive but breadth weak
  if (priceSig > 20 && breadthPct < 45) {
    found.push('BREADTH_DIVERGENCE')
  }

  // MOMENTUM_DIVERGENCE: price rising but momentum fading
  if (priceSig > 10 && momSig < -10) {
    found.push('MOMENTUM_DIVERGENCE')
  }

  // SECTOR_ROTATION: extreme bucket spread
  if (bucketSpread > 80) {
    found.push('SECTOR_ROTATION')
  }

  // MACRO_OVERRIDE: VIX spike or yield surge
  if (vix > 28 || yieldBps > 75) {
    found.push('MACRO_OVERRIDE')
  }

  // VALUATION_STRETCH: RSI overbought + SOXX/QQQ RS at high
  if (rsi > 75 && soxxRsRaw > 80) {
    found.push('VALUATION_STRETCH')
  }

  // AI_INFRA_SUSTAINABILITY_RISK: extreme AI concentration without broad confirmation
  // Phase 1 proxy ??uses price/market data only (concentration + EW spread + AI return signal).
  // Full model (monetization_gap_proxy, circular_financing_risk) deferred to Phase 2.
  const aiReturnSig   = getMetric(metrics, 'ai_infra_return_60d')?.signal_value ?? 0
  // normalized_value = top5proxy (0~100 number) ??use instead of raw_value (string "100%")
  const concentration = getMetric(metrics, 'leader_concentration_top5')?.normalized_value ?? 0
  if (aiReturnSig > 60 && concentration > 85 && ewVsCw < -20) {
    found.push('AI_INFRA_SUSTAINABILITY_RISK')
  }

  if (found.length >= 2) return ['MULTIPLE_CONFLICTS']
  if (found.length === 1) return found
  return ['NO_CONFLICT']
}

// ?? Cycle state mapping ???????????????????????????????????????????????????????

function mapToCycleState(
  signal: number,
  breadthSignal: number,
  conflictTypes: ConflictTypeV2[],
): CycleState {
  const hasConflict = conflictTypes[0] !== 'NO_CONFLICT'

  if (signal < -40)                          return 'Contraction'
  if (signal < -15)                          return 'Trough'
  if (signal < 10)                           return 'Recovery'
  if (signal < 45)                           return 'Expansion'

  // signal >= 45: distinguish Late Expansion vs Peak Risk
  const isBreadthWeak = breadthSignal < -10
  const isPeakRisk    = isBreadthWeak || hasConflict
  return isPeakRisk ? 'Peak Risk' : 'Late Expansion'
}

// ?? Primary driver / risk ????????????????????????????????????????????????????

function detectPrimaryDriver(domains: DomainScores): string {
  const keys = Object.keys(domains) as Array<keyof DomainScores>
  const strongest = keys.reduce((best, k) =>
    Math.abs(domains[k].signal) > Math.abs(domains[best].signal) ? k : best
  , keys[0])

  const domainLabels: Record<string, string> = {
    price_trend:  'Price trend momentum',
    leadership:   'Sector leadership rotation',
    breadth:      'Broad market participation',
    momentum:     'Technical momentum',
    macro:        'Macro / risk regime',
    fundamentals: 'Industry fundamentals',
    ai_infra:     'AI Infrastructure demand',
  }
  return domainLabels[strongest] ?? strongest
}

function detectPrimaryRisk(
  domains: DomainScores,
  conflictTypes: ConflictTypeV2[],
): string {
  const conflict = conflictTypes[0]
  if (conflict === 'AI_DISTORTION')     return 'Narrow breadth ??advance led by AI names only'
  if (conflict === 'BREADTH_DIVERGENCE') return 'Index rising but majority of stocks not participating'
  if (conflict === 'MOMENTUM_DIVERGENCE') return 'Price strength not confirmed by momentum indicators'
  if (conflict === 'MACRO_OVERRIDE')    return 'Elevated macro volatility (VIX or rates)'
  if (conflict === 'VALUATION_STRETCH') return 'Overbought conditions ??elevated reversal risk'
  if (conflict === 'SECTOR_ROTATION')  return 'Extreme bucket divergence ??capital rotation in progress'
  if (conflict === 'MULTIPLE_CONFLICTS') return 'Multiple conflicting signals ??low conviction setup'

  // No conflict: find weakest domain as risk
  const keys = Object.keys(domains) as Array<keyof DomainScores>
  const weakest = keys.reduce((worst, k) =>
    domains[k].signal < domains[worst].signal ? k : worst
  , keys[0])
  const weakLabels: Record<string, string> = {
    price_trend:  'Price trend fading',
    breadth:      'Breadth narrowing',
    momentum:     'Momentum fading',
    macro:        'Macro headwinds',
    fundamentals: 'Industry fundamentals soft',
    leadership:   'Leadership rotation risk',
    ai_infra:     'AI Infrastructure demand uncertainty',
  }
  return weakLabels[weakest] ?? 'Monitor signal quality'
}

// ?? Preliminary confidence label (full Confidence computed in confidenceScore.ts) ??

function preliminaryConfidence(
  internalSignal: number,
  conflictTypes: ConflictTypeV2[],
): ConfidenceLabelV2 {
  const conflict = conflictTypes[0]
  if (conflict === 'MULTIPLE_CONFLICTS') return 'Low'
  if (conflict === 'AI_DISTORTION' || conflict === 'MACRO_OVERRIDE' || conflict === 'AI_INFRA_SUSTAINABILITY_RISK') return 'Medium'
  if (Math.abs(internalSignal) > 50) return 'High'
  return 'Medium'
}

// ?? Main export ???????????????????????????????????????????????????????????????

export function computeEngineScore(
  domains: DomainScores,
  metrics: NormalizedMetric[],
): EngineOutputV2 {
  const internalSignal = aggregateToEngineSignal(domains)
  const engineScore    = signalToDisplay(internalSignal)
  const conflictTypes  = detectConflicts(domains, metrics)
  const conflictType   = conflictTypes[0]
  const state          = mapToCycleState(
    internalSignal,
    domains.breadth.signal,
    conflictTypes,
  )
  const primaryDriver = detectPrimaryDriver(domains)
  const primaryRisk   = detectPrimaryRisk(domains, conflictTypes)
  const confidence    = preliminaryConfidence(internalSignal, conflictTypes)

  return {
    engine_score:    engineScore,
    internal_signal: internalSignal,
    state,
    primary_driver:  primaryDriver,
    primary_risk:    primaryRisk,
    conflict_type:   conflictType,
    confidence,
  }
}


