/**
 * FILE: domainScores.ts
 * RESPONSIBILITY: Engine Layer 4 — aggregate NormalizedMetric[] into 7 domain scores
 *
 * INPUT:  NormalizedMetric[]  — output of normalizeMetrics()
 * OUTPUT: DomainScores        — one score per domain, weighted average of member signals
 *
 * DOMAIN WEIGHTS (sum = 1.0):
 *   price_trend   0.20   — SOXX return, vs-QQQ, vs-200MA, ROC
 *   leadership    0.20   — bucket RS, concentration, EW-vs-CW spread
 *   breadth       0.20   — % above 20MA, % near 52W high
 *   momentum      0.15   — RSI, MACD, MACD ROC
 *   macro         0.10   — VIX level, VIX change, yield change, DXY
 *   fundamentals  0.10   — Phase 2 placeholder (MU proxy for MVP)
 *   ai_infra      0.05   — AI Infra composite + AI bucket return (sum = 1.0)
 *
 * AI_INFRA NOTE: 5% weight is fixed. AI Distortion / AI_INFRA_SUSTAINABILITY_RISK
 *   are handled by the Confidence layer (conflict_penalty), NOT by reducing this weight.
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import type {
  NormalizedMetric,
  DomainScore,
  DomainScores,
  DomainKey,
} from './types'

// ── Domain member metric IDs ──────────────────────────────────────────────────

const DOMAIN_METRICS: Record<DomainKey, string[]> = {
  price_trend: [
    'soxx_return_20d',
    'soxx_return_60d',
    'soxx_vs_qqq_ratio',
    'soxx_vs_200ma',
    'soxx_roc_60d',
  ],
  leadership: [
    'ai_infra_return_60d',
    'memory_return_60d',
    'foundry_return_60d',
    'equipment_return_60d',
    'leader_concentration_top5',
    'equal_weight_vs_cap_spread',
  ],
  breadth: [
    'breadth_pct_above_20ma',
    'breadth_near_52w_high',
  ],
  momentum: [
    'soxx_rsi_14',
    'soxx_macd_signal',
  ],
  macro: [
    'vix_level',
    'vix_change_5d',
    'yield_10y_change_30d',
    'dxy_trend_30d',
  ],
  fundamentals: [
    // MVP: memory_return_60d used as industry proxy
    'memory_return_60d',
    'equipment_return_60d',
  ],
  ai_infra: [
    'ai_infra_strength',
    'ai_infra_return_60d',
  ],
}

const DOMAIN_WEIGHTS: Record<DomainKey, number> = {
  price_trend:  0.20,
  leadership:   0.20,
  breadth:      0.20,
  momentum:     0.15,
  macro:        0.10,
  fundamentals: 0.10,
  ai_infra:     0.05,
}

const DOMAIN_NAMES: Record<DomainKey, string> = {
  price_trend:  'Price / Trend',
  leadership:   'Leadership / Rotation',
  breadth:      'Breadth / Participation',
  momentum:     'Momentum / Exhaustion',
  macro:        'Macro / Risk Regime',
  fundamentals: 'Industry Fundamentals',
  ai_infra:     'AI Infrastructure',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function signalToDisplay(signal: number): number {
  return Math.round((signal + 100) / 2)
}

function clamp(v: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeDomainScores(metrics: NormalizedMetric[]): DomainScores {
  const metricMap = new Map(metrics.map(m => [m.id, m]))

  const build = (key: DomainKey): DomainScore => {
    const ids     = DOMAIN_METRICS[key]
    const members = ids.map(id => metricMap.get(id)).filter(Boolean) as NormalizedMetric[]

    let signal: number
    if (members.length === 0) {
      signal = 0
    } else {
      // Simple average of signal_values (all members weighted equally within domain)
      signal = members.reduce((sum, m) => sum + m.signal_value, 0) / members.length
    }

    signal = Math.round(clamp(signal))

    return {
      name:          DOMAIN_NAMES[key],
      key,
      weight:        DOMAIN_WEIGHTS[key],
      signal,
      display:       signalToDisplay(signal),
      metrics_count: members.length,
    }
  }

  return {
    price_trend:  build('price_trend'),
    leadership:   build('leadership'),
    breadth:      build('breadth'),
    momentum:     build('momentum'),
    macro:        build('macro'),
    fundamentals: build('fundamentals'),
    ai_infra:     build('ai_infra'),
  }
}

// Weighted aggregate of all domain signals → engine internal signal (-100~+100)
export function aggregateToEngineSignal(domains: DomainScores): number {
  const keys: DomainKey[] = [
    'price_trend', 'leadership', 'breadth',
    'momentum', 'macro', 'fundamentals', 'ai_infra',
  ]
  const weighted = keys.reduce(
    (sum, k) => sum + domains[k].signal * domains[k].weight,
    0,
  )
  return Math.round(clamp(weighted))
}
