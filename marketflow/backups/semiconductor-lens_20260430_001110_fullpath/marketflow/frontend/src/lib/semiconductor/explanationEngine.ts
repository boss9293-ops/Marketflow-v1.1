/**
 * FILE: explanationEngine.ts
 * RESPONSIBILITY: Engine Layer 7 — generate human-readable market state explanation
 *
 * INPUT:  EngineOutputV2      — from computeEngineScore()
 *         ConfidenceOutputV2  — from computeConfidence()
 *         NormalizedMetric[]  — for evidence extraction
 *         prevState?          — previous EngineOutputV2 for what_changed detection
 * OUTPUT: ExplanationOutputV2 — headline, summary, subscriber_explanation, evidence, etc.
 *
 * DESIGN RULES:
 *   - No trading language: use "Favorable/Unfavorable" not "Buy/Sell/Enter"
 *   - Beginner summary: max 3 sentences, no jargon, analogy where helpful
 *   - Evidence: 3~5 bullet points citing actual metric values
 *   - Subscriber explanation: explain WHY the confidence level matters
 *   - what_changed: only emit items that actually changed from prevState
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import type {
  EngineOutputV2,
  ConfidenceOutputV2,
  NormalizedMetric,
  ExplanationOutputV2,
  CycleState,
  ConflictTypeV2,
  ConfidenceLabelV2,
} from './types'

// ── Headline templates ────────────────────────────────────────────────────────

const HEADLINE: Record<CycleState, string> = {
  'Trough':         'Semiconductor sector is at a cyclical low — early recovery signals emerging.',
  'Recovery':       'Semiconductor sector is in early recovery — conditions improving gradually.',
  'Expansion':      'Semiconductor sector is in an expansion phase with positive momentum.',
  'Late Expansion': 'Semiconductor sector is in late expansion — strong but watch for fatigue.',
  'Peak Risk':      'Semiconductor sector shows peak-risk conditions — signal breadth weakening.',
  'Contraction':    'Semiconductor sector is in contraction — defensive conditions prevail.',
}

const HEADLINE_WITH_CONFLICT: Partial<Record<ConflictTypeV2, string>> = {
  AI_DISTORTION:               'Semiconductor sector is rising, but the advance is narrow — AI names are carrying the index.',
  BREADTH_DIVERGENCE:          'The semiconductor index is up, but most individual stocks are not participating.',
  MOMENTUM_DIVERGENCE:         'Price trend is positive, but momentum indicators are diverging — watch for a potential slowdown.',
  MACRO_OVERRIDE:              'Macro conditions are overriding semiconductor cycle signals — elevated volatility.',
  VALUATION_STRETCH:           'Semiconductor sector is extended on valuation and momentum — reversal risk elevated.',
  AI_INFRA_SUSTAINABILITY_RISK:'AI Infrastructure is driving extreme gains, but leadership concentration is at structural risk levels.',
  MULTIPLE_CONFLICTS:          'Multiple conflicting signals detected — low conviction reading.',
}

// ── State summary templates ───────────────────────────────────────────────────

function buildSummary(state: CycleState, driver: string, risk: string): string {
  const stateDesc: Record<CycleState, string> = {
    'Trough':         'Most indicators are near cycle lows, but early stabilization signals are appearing.',
    'Recovery':       'The sector is transitioning out of weakness. Demand signals are improving from depressed levels.',
    'Expansion':      'Demand and price trends are positive. Breadth is confirming the move in most areas.',
    'Late Expansion': 'Conditions remain favorable, but the cycle is maturing. Concentration and exhaustion risk are rising.',
    'Peak Risk':      'The index is elevated, but signal quality is deteriorating. Breadth is not confirming price strength.',
    'Contraction':    'Demand is contracting, inventories are building, and price momentum is negative.',
  }
  return `${stateDesc[state]} Main driver: ${driver}. Key risk to monitor: ${risk}.`
}

// ── Subscriber explanation templates ────────────────────────────────────────

function buildSubscriberExplanation(
  state:      CycleState,
  conflict:   ConflictTypeV2,
  confidence: ConfidenceLabelV2,
): string {
  const confidenceNote: Record<ConfidenceLabelV2, string> = {
    High:   'The signal is consistent across multiple indicators, making this a relatively reliable reading.',
    Medium: 'The signal has some internal inconsistencies. Treat it as directional guidance, not a high-conviction call.',
    Low:    'Several indicators are pointing in different directions. This is a low-conviction environment — proceed with extra caution.',
  }

  const conflictNote: Partial<Record<ConflictTypeV2, string>> = {
    AI_DISTORTION:
      'The semiconductor index is being carried by a small group of AI-linked names (like NVDA). ' +
      'This means the trend can continue, but it is less stable than a broad-based rally.',
    BREADTH_DIVERGENCE:
      'The index is up, but most semiconductor stocks are not following. ' +
      'This kind of divergence often precedes a slowdown or pullback.',
    MOMENTUM_DIVERGENCE:
      'Price is rising but the underlying momentum (RSI, MACD) is weakening. ' +
      'This pattern historically precedes a trend slowdown.',
    MACRO_OVERRIDE:
      'External conditions (market volatility, interest rates) are creating headwinds that may override the semiconductor cycle signal.',
    VALUATION_STRETCH:
      'The sector is technically extended — overbought readings suggest limited near-term upside and elevated pullback risk.',
    AI_INFRA_SUSTAINABILITY_RISK:
      'A small group of AI Infrastructure names are generating extreme outperformance, ' +
      'but the gains are highly concentrated and the equal-weight index is significantly lagging. ' +
      'This pattern historically precedes sharp mean-reversion when sentiment shifts.',
    MULTIPLE_CONFLICTS:
      'Multiple conflicting signals make this an unusually uncertain environment. ' +
      'No single direction has strong confirmation.',
  }

  const base = conflictNote[conflict] ?? ''
  const conf = confidenceNote[confidence]

  const stateNote: Record<CycleState, string> = {
    'Trough':
      'We are near the bottom of the semiconductor cycle. Historically, early Trough periods reward patience — the cycle tends to turn before fundamentals visibly improve.',
    'Recovery':
      'The sector is beginning to recover. This phase can move faster than expected once breadth starts to expand.',
    'Expansion':
      'Conditions are broadly favorable. This is the phase where semiconductor exposure has historically had the strongest risk-adjusted returns.',
    'Late Expansion':
      'The cycle is maturing. Returns are still positive but the easy gains may be behind us. Concentration risk is worth watching.',
    'Peak Risk':
      'Signal quality is deteriorating even as prices remain elevated. Historical cycle patterns suggest increasing caution at this stage.',
    'Contraction':
      'The cycle is in a downswing. Historically, this phase tests patience — conditions typically improve before sector prices stabilize.',
  }

  return [base, conf, stateNote[state]].filter(Boolean).join(' ')
}

// ── Evidence extraction ───────────────────────────────────────────────────────

function extractEvidence(metrics: NormalizedMetric[]): string[] {
  const priority = [
    'soxx_return_60d',
    'soxx_vs_200ma',
    'breadth_pct_above_20ma',
    'leader_concentration_top5',
    'vix_level',
    'soxx_rsi_14',
    'soxx_vs_qqq_ratio',
  ]
  return priority
    .map(id => metrics.find(m => m.id === id))
    .filter(Boolean)
    .slice(0, 5)
    .map(m => m!.explanation_short)
}

// ── What changed ─────────────────────────────────────────────────────────────

function buildWhatChanged(
  current:  EngineOutputV2,
  previous: EngineOutputV2 | undefined,
): string[] {
  if (!previous) return ['Initial reading — no prior state available']

  const changes: string[] = []

  if (current.state !== previous.state) {
    changes.push(`Cycle state: ${previous.state} → ${current.state}`)
  }

  const scoreDelta = current.engine_score - previous.engine_score
  if (Math.abs(scoreDelta) >= 3) {
    changes.push(
      `Engine Score: ${previous.engine_score} → ${current.engine_score} (${scoreDelta > 0 ? '+' : ''}${scoreDelta})`,
    )
  }

  if (current.conflict_type !== previous.conflict_type) {
    changes.push(
      current.conflict_type === 'NO_CONFLICT'
        ? `Conflict resolved: ${previous.conflict_type} cleared`
        : `New conflict detected: ${current.conflict_type.replace(/_/g, ' ')}`,
    )
  }

  if (current.confidence !== previous.confidence) {
    changes.push(`Confidence: ${previous.confidence} → ${current.confidence}`)
  }

  return changes.length > 0 ? changes : ['No significant changes from prior reading']
}

// ── Suitability label ─────────────────────────────────────────────────────────

function toSuitabilityLabel(score: number): string {
  if (score >= 85) return 'Highly Favorable'
  if (score >= 65) return 'Favorable'
  if (score >= 36) return 'Neutral / Monitor'
  if (score >= 16) return 'Unfavorable'
  return 'High Risk Setup'
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildExplanation(
  engine:     EngineOutputV2,
  confidence: ConfidenceOutputV2,
  metrics:    NormalizedMetric[],
  prevEngine?: EngineOutputV2,
): ExplanationOutputV2 {
  const conflict = engine.conflict_type

  const headline = HEADLINE_WITH_CONFLICT[conflict] ?? HEADLINE[engine.state]
  const summary  = buildSummary(engine.state, engine.primary_driver, engine.primary_risk)

  return {
    headline,
    summary,
    current_state:          engine.state,
    confidence_label:       confidence.confidence_label,
    main_driver:            engine.primary_driver,
    main_risk:              engine.primary_risk,
    what_changed:           buildWhatChanged(engine, prevEngine),
    evidence:               extractEvidence(metrics),
    conflicts:              conflict === 'NO_CONFLICT' ? [] : [conflict.replace(/_/g, ' ')],
    subscriber_explanation: buildSubscriberExplanation(
      engine.state,
      conflict,
      confidence.confidence_label,
    ),
  }
}
