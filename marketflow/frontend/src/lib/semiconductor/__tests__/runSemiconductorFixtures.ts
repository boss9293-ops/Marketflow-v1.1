/**
 * FILE: __tests__/runSemiconductorFixtures.ts
 * RESPONSIBILITY: Execute all 4 scenario fixtures through the full engine pipeline
 *   and compare actual outputs against expectations.
 *
 * USAGE (via API route): GET /api/semiconductor-lens/test-fixtures
 * OUTPUT: { results: ScenarioResult[], summary: string, ready_for_ui: boolean }
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import { normalizeMetrics }    from '../normalizeMetrics'
import { computeDomainScores } from '../domainScores'
import { computeEngineScore }  from '../engineScore'
import { computeConfidence }   from '../confidenceScore'
import { buildExplanation }    from '../explanationEngine'
import { ALL_FIXTURES, KNOWN_MISMATCHES } from './testFixtures'
import type { ScenarioFixture } from './testFixtures'

// ── Result shape ──────────────────────────────────────────────────────────────

export interface ScenarioResult {
  name:         string
  description:  string
  actual: {
    internal_signal:  number
    engine_display:   number
    state:            string
    conflict:         string
    confidence_label: string
    confidence_score: number
    primary_driver:   string
    primary_risk:     string
    domain_signals:   Record<string, number>
  }
  checks: {
    conflict:        { pass: boolean; expected: string; got: string }
    state:           { pass: boolean; expected: string; got: string }
    engine_positive: { pass: boolean; expected: boolean; got: boolean }
    confidence:      { pass: boolean; expected: string | string[]; got: string }
  }
  pass: boolean
}

// ── Run one fixture ───────────────────────────────────────────────────────────

function runFixture(fixture: ScenarioFixture): ScenarioResult {
  const { marketData, macro, expected } = fixture

  const metrics      = normalizeMetrics(marketData, macro)
  const domainScores = computeDomainScores(metrics)
  const engine       = computeEngineScore(domainScores, metrics)
  const confidence   = computeConfidence(metrics, domainScores, engine.conflict_type)
  const explanation  = buildExplanation(engine, confidence, metrics)

  const actual = {
    internal_signal:  engine.internal_signal,
    engine_display:   engine.engine_score,
    state:            engine.state,
    conflict:         engine.conflict_type,
    confidence_label: confidence.confidence_label,
    confidence_score: confidence.confidence_score,
    primary_driver:   engine.primary_driver,
    primary_risk:     engine.primary_risk,
    domain_signals: {
      price_trend:  domainScores.price_trend.signal,
      leadership:   domainScores.leadership.signal,
      breadth:      domainScores.breadth.signal,
      momentum:     domainScores.momentum.signal,
      macro:        domainScores.macro.signal,
      fundamentals: domainScores.fundamentals.signal,
      ai_infra:     domainScores.ai_infra.signal,
    },
  }

  // ── Checks ────────────────────────────────────────────────────────────────

  const conflictPass = actual.conflict === expected.conflict

  const statePass = actual.state === expected.state
    || (expected.state === 'Expansion' && actual.state === 'Expansion')
    || (expected.state === 'Contraction' && actual.state === 'Contraction')

  const posPass = (actual.internal_signal > 0) === expected.engine_positive

  const expectedConf = Array.isArray(expected.confidence)
    ? expected.confidence
    : [expected.confidence]
  const confPass = expectedConf.includes(actual.confidence_label)

  const checks = {
    conflict:        { pass: conflictPass, expected: expected.conflict, got: actual.conflict },
    state:           { pass: statePass,    expected: expected.state,    got: actual.state },
    engine_positive: { pass: posPass,      expected: expected.engine_positive, got: actual.internal_signal > 0 },
    confidence:      { pass: confPass,     expected: expected.confidence,      got: actual.confidence_label },
  }

  const pass = Object.values(checks).every(c => c.pass)

  return { name: fixture.name, description: fixture.description, actual, checks, pass }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runAllFixtures(): {
  results:       ScenarioResult[]
  total:         number
  passed:        number
  failed:        number
  ready_for_ui:  boolean
  known_mismatches: string
} {
  const results  = ALL_FIXTURES.map(runFixture)
  const passed   = results.filter(r => r.pass).length
  const failed   = results.length - passed

  // Ready for UI: all conflict + state + direction checks pass (confidence is informational)
  const corePass = results.every(r =>
    r.checks.conflict.pass &&
    r.checks.state.pass    &&
    r.checks.engine_positive.pass
  )

  return {
    results,
    total:            results.length,
    passed,
    failed,
    ready_for_ui:     corePass,
    known_mismatches: KNOWN_MISMATCHES,
  }
}
