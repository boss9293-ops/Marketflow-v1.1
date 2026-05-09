/**
 * FILE: confidenceScore.ts
 * RESPONSIBILITY: Engine Layer 6 — compute 4-component independent confidence score
 *
 * INPUT:  NormalizedMetric[]  — from normalizeMetrics()
 *         DomainScores        — from computeDomainScores()
 *         ConflictTypeV2      — from computeEngineScore()
 *         prevDomainSignals?  — optional 5-day rolling window for signal stability
 * OUTPUT: ConfidenceOutputV2  — confidence_score (0~100), confidence_label, components
 *
 * FORMULA:
 *   confidence_score =
 *     agreement        × 0.40
 *   + data_quality     × 0.25
 *   + signal_stability × 0.20
 *   + conflict_penalty × 0.15
 *
 * COMPONENTS:
 *   agreement        — do the 5 core domains point in the same direction?
 *   data_quality     — average data_quality weight of active metrics
 *   signal_stability — how consistently have domain signals held direction (5D)?
 *   conflict_penalty — each conflict type carries a fixed penalty (lowers score)
 *
 * NOTE: Historical Reliability Score is excluded from MVP.
 *   It will be added as a 5th component in Phase 3.
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import type {
  NormalizedMetric,
  DomainScores,
  DomainKey,
  ConflictTypeV2,
  ConfidenceOutputV2,
  ConfidenceComponents,
  ConfidenceLabelV2,
} from './types'

// ── Conflict penalty table ────────────────────────────────────────────────────

const CONFLICT_PENALTY: Record<ConflictTypeV2, number> = {
  NO_CONFLICT:                  100,
  AI_DISTORTION:                 40,
  BREADTH_DIVERGENCE:            50,
  MOMENTUM_DIVERGENCE:           55,
  SECTOR_ROTATION:               65,
  MACRO_OVERRIDE:                30,
  VALUATION_STRETCH:             60,
  AI_INFRA_SUSTAINABILITY_RISK:  35,
  MULTIPLE_CONFLICTS:            15,
}

// ── Data quality weights ──────────────────────────────────────────────────────

const DATA_QUALITY_WEIGHT: Record<string, number> = {
  high:   1.0,
  medium: 0.65,
  low:    0.30,
}

// ── Component 1: Agreement Score (40%) ───────────────────────────────────────
// Measures whether the 5 core domains point in the same direction.
// Agreement is about consistency of direction, not whether direction is positive.

function computeAgreement(domains: DomainScores): number {
  const coreDomains: DomainKey[] = ['price_trend', 'leadership', 'breadth', 'momentum', 'macro']
  const signals = coreDomains.map(k => domains[k].signal)

  const positiveCount = signals.filter(s => s > 5).length
  const negativeCount = signals.filter(s => s < -5).length
  const neutralCount  = signals.length - positiveCount - negativeCount

  // Agreement is high when the majority points in one direction (even if negative)
  const majorityCount = Math.max(positiveCount, negativeCount)

  // Scoring: all 5 same direction = 100, 4/5 = 80, 3/5 = 50, etc.
  if (majorityCount === 5) return 100
  if (majorityCount === 4) return 80
  if (majorityCount === 3) return 50 + neutralCount * 5
  if (majorityCount === 2) return 25
  return 10 // complete split
}

// ── Component 2: Data Quality Score (25%) ────────────────────────────────────
// Average quality weight across all active metrics.

function computeDataQuality(metrics: NormalizedMetric[]): number {
  if (!metrics.length) return 50
  const totalWeight = metrics.reduce(
    (sum, m) => sum + (DATA_QUALITY_WEIGHT[m.data_quality] ?? 0.5),
    0,
  )
  return Math.round((totalWeight / metrics.length) * 100)
}

// ── Component 3: Signal Stability Score (20%) ─────────────────────────────────
// How consistently domain signals have held their direction over 5 trading days.
// When prevDomainSignals is unavailable (MVP launch), returns a neutral 60.

function computeSignalStability(
  current: DomainScores,
  prevDomainSignals?: Array<Partial<Record<DomainKey, number>>>,
): number {
  if (!prevDomainSignals || prevDomainSignals.length === 0) {
    return 60 // neutral default when no history available
  }

  const keys: DomainKey[] = ['price_trend', 'leadership', 'breadth', 'momentum', 'macro']
  const windowSize = prevDomainSignals.length // should be ~5

  let totalStability = 0
  let domainCount = 0

  for (const key of keys) {
    const currentSign = Math.sign(current[key].signal)
    if (currentSign === 0) continue

    const histSigns = prevDomainSignals
      .map(d => Math.sign(d[key] ?? 0))
      .filter(s => s !== 0)

    if (!histSigns.length) continue

    const matchCount = histSigns.filter(s => s === currentSign).length
    const stability  = (matchCount / histSigns.length) * 100
    totalStability  += stability
    domainCount++
  }

  return domainCount > 0 ? Math.round(totalStability / domainCount) : 60
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeConfidence(
  metrics:            NormalizedMetric[],
  domains:            DomainScores,
  conflictType:       ConflictTypeV2,
  prevDomainSignals?: Array<Partial<Record<DomainKey, number>>>,
): ConfidenceOutputV2 {
  const agreement       = computeAgreement(domains)
  const dataQuality     = computeDataQuality(metrics)
  const signalStability = computeSignalStability(domains, prevDomainSignals)
  const conflictPenalty = CONFLICT_PENALTY[conflictType] ?? 100

  const components: ConfidenceComponents = {
    agreement,
    data_quality:     dataQuality,
    signal_stability: signalStability,
    conflict_penalty: conflictPenalty,
  }

  const confidenceScore = Math.round(
    agreement        * 0.40 +
    dataQuality      * 0.25 +
    signalStability  * 0.20 +
    conflictPenalty  * 0.15,
  )

  let confidence_label: ConfidenceLabelV2
  if (confidenceScore >= 65)      confidence_label = 'High'
  else if (confidenceScore >= 40) confidence_label = 'Medium'
  else                            confidence_label = 'Low'

  // Ceiling rule: AI_INFRA_SUSTAINABILITY_RISK caps confidence at Medium.
  // Score unchanged — only the label is capped.
  if (conflictType === 'AI_INFRA_SUSTAINABILITY_RISK' && confidence_label === 'High') {
    confidence_label = 'Medium'
  }

  return { confidence_score: confidenceScore, confidence_label, components }
}
