// AI Bottleneck Radar 버킷 상태 레이블 규칙 엔진 — Phase D-4

import type { AIInfraBucketId, AIInfraStage, AIInfraDataQuality } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import type { RrgSeries } from '@/lib/semiconductor/rrgPathData'

// ── State Label Types ─────────────────────────────────────────────────────────

export type AIInfraStateLabel =
  | 'LEADING'
  | 'EMERGING'
  | 'CONFIRMING'
  | 'CROWDED'
  | 'LAGGING'
  | 'STORY_ONLY'
  | 'DISTRIBUTION'
  | 'DATA_INSUFFICIENT'

export type AIInfraStateConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type AIInfraRiskFlag =
  | 'OVERHEAT_RISK'
  | 'LOW_COVERAGE'
  | 'PARTIAL_DATA'
  | 'RRG_WEAKENING'
  | 'RS_UNDERPERFORMANCE'
  | 'MOMENTUM_STRETCH'
  | 'COMMERCIALIZATION_UNCERTAINTY'
  | 'BENCHMARK_MISSING'

export interface AIInfraBucketState {
  bucket_id:    AIInfraBucketId
  display_name: string
  stage:        AIInfraStage

  state_label:   AIInfraStateLabel
  state_score:   number | null

  confidence:    AIInfraStateConfidence

  state_reason:  string
  state_drivers: string[]
  risk_flags:    AIInfraRiskFlag[]

  source: {
    has_rs:         boolean
    has_rrg:        boolean
    benchmark:      'SOXX' | 'QQQ' | 'SPY'
    coverage_ratio: number
    data_quality:   AIInfraDataQuality
  }
}

// ── Display Labels ────────────────────────────────────────────────────────────

export const STATE_DISPLAY_LABELS: Record<AIInfraStateLabel, string> = {
  LEADING:           'Leading',
  EMERGING:          'Emerging',
  CONFIRMING:        'Confirming',
  CROWDED:           'Crowded',
  LAGGING:           'Lagging',
  STORY_ONLY:        'Story Only',
  DISTRIBUTION:      'Distribution',
  DATA_INSUFFICIENT: 'Data Insufficient',
}

export const STATE_COLORS: Record<AIInfraStateLabel, string> = {
  LEADING:           '#22c55e',
  EMERGING:          '#5DCFB0',
  CONFIRMING:        '#3FB6A8',
  CROWDED:           '#fbbf24',
  LAGGING:           '#ef4444',
  STORY_ONLY:        '#8b9098',
  DISTRIBUTION:      '#f97316',
  DATA_INSUFFICIENT: '#555a62',
}

// ── Thresholds (centralized — tune here only) ─────────────────────────────────

const LOW_COVERAGE_THRESHOLD     = 0.50
const PARTIAL_COVERAGE_THRESHOLD = 0.75

const STRONG_RS_3M   = 5    // pp above benchmark
const POSITIVE_RS_3M = 0    // pp
const WEAK_RS_3M     = -5   // pp

const STRETCHED_RETURN_3M = 35  // %
const STRETCHED_RETURN_6M = 60  // %

// ── State Score (0–100, internal sort key only) ───────────────────────────────

function calcStateScore(
  rs3m:       number | null,
  ret3m:      number | null,
  rrgQ:       string | null,
  coverage:   number,
  overheated: boolean,
): number | null {
  if (rs3m === null && ret3m === null) return null

  // RS 3M: 35 pts — 35 at 0pp, +1.5 per pp, floor 0
  const rsScore = rs3m !== null
    ? Math.min(35, Math.max(0, 35 + rs3m * 1.5))
    : 15

  // Return 3M: 25 pts — 12.5 at 0%, +0.5 per %
  const momScore = ret3m !== null
    ? Math.min(25, Math.max(0, 12.5 + ret3m * 0.5))
    : 10

  // RRG: 25 pts
  const rrgScore = rrgQ === 'Leading'  ? 25
                 : rrgQ === 'Improving' ? 18
                 : rrgQ === 'Weakening' ? 8
                 : rrgQ === 'Lagging'   ? 0
                 : 12  // missing = neutral

  // Coverage: 15 pts
  const covScore = Math.round(coverage * 15)

  const penalty = overheated ? 20 : 0

  return Math.min(100, Math.max(0,
    Math.round(rsScore + momScore + rrgScore + covScore - penalty)
  ))
}

// ── Confidence ────────────────────────────────────────────────────────────────

function calcConfidence(
  hasRS:    boolean,
  hasRRG:   boolean,
  coverage: number,
  quality:  AIInfraDataQuality,
): AIInfraStateConfidence {
  if (coverage >= 0.8 && hasRS && hasRRG && quality === 'REAL') return 'HIGH'
  if (coverage >= 0.5 && hasRS) return 'MEDIUM'
  return 'LOW'
}

// ── Rule Engine ───────────────────────────────────────────────────────────────

export function computeBucketState(
  bucket:    AIInfraBucketMomentum,
  rrgSeries: RrgSeries | null | undefined,
): AIInfraBucketState {
  const { bucket_id, display_name, stage, benchmark, returns, relative_strength, coverage } = bucket
  const { coverage_ratio, data_quality } = coverage

  const rs3m  = relative_strength.vs_soxx.three_month
  const rs1m  = relative_strength.vs_soxx.one_month
  const ret3m = returns.three_month
  const ret6m = returns.six_month
  const ret1m = returns.one_month

  const hasRS  = rs3m !== null || rs1m !== null
  const hasRRG = rrgSeries != null
               && rrgSeries.source === 'LOCAL_DB'
               && rrgSeries.points.length > 0

  const rrgQ: string | null = hasRRG ? rrgSeries!.quadrant : null

  const stretched3m = ret3m !== null && ret3m >= STRETCHED_RETURN_3M
  const stretched6m = ret6m !== null && ret6m >= STRETCHED_RETURN_6M
  const overheated  = (stretched3m && rs3m !== null && rs3m >= STRONG_RS_3M) || stretched6m

  const risk_flags: AIInfraRiskFlag[] = []

  const src = {
    has_rs:         hasRS,
    has_rrg:        hasRRG,
    benchmark:      benchmark,
    coverage_ratio,
    data_quality,
  }

  const confidence = calcConfidence(hasRS, hasRRG, coverage_ratio, data_quality)

  // ── 1. DATA_INSUFFICIENT ───────────────────────────────────────────────────
  if (coverage_ratio < LOW_COVERAGE_THRESHOLD || !hasRS) {
    if (coverage_ratio < LOW_COVERAGE_THRESHOLD) risk_flags.push('LOW_COVERAGE')
    if (!hasRS) risk_flags.push('BENCHMARK_MISSING')
    return {
      bucket_id, display_name, stage,
      state_label:   'DATA_INSUFFICIENT',
      state_score:   null,
      confidence:    'LOW',
      state_reason:  `${display_name} has insufficient data for state classification (coverage: ${Math.round(coverage_ratio * 100)}%).`,
      state_drivers: [`coverage_ratio ${Math.round(coverage_ratio * 100)}% < 50% threshold`],
      risk_flags,
      source: src,
    }
  }

  // ── 2. STORY_ONLY ─────────────────────────────────────────────────────────
  const rsInconclusive = rs3m === null || (rs3m >= WEAK_RS_3M && rs3m <= POSITIVE_RS_3M)
  if (data_quality === 'PARTIAL' && coverage_ratio < PARTIAL_COVERAGE_THRESHOLD && rsInconclusive) {
    risk_flags.push('PARTIAL_DATA')
    if (coverage_ratio < PARTIAL_COVERAGE_THRESHOLD) risk_flags.push('LOW_COVERAGE')
    return {
      bucket_id, display_name, stage,
      state_label:   'STORY_ONLY',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
      confidence:    'LOW',
      state_reason:  `${display_name} is classified as Story Only because data coverage is partial and price confirmation remains limited.`,
      state_drivers: [
        `partial data quality`,
        `coverage ${Math.round(coverage_ratio * 100)}%`,
        `RS inconclusive (${rs3m != null ? rs3m.toFixed(1) + 'pp' : 'null'})`,
      ],
      risk_flags,
      source: src,
    }
  }

  // ── 3. CROWDED ────────────────────────────────────────────────────────────
  if (overheated) {
    risk_flags.push('OVERHEAT_RISK')
    if (stretched3m) risk_flags.push('MOMENTUM_STRETCH')
    if (rrgQ === 'Weakening') risk_flags.push('RRG_WEAKENING')
    const drivers: string[] = []
    if (stretched3m && ret3m != null) drivers.push(`3M return +${ret3m.toFixed(1)}% ≥ ${STRETCHED_RETURN_3M}% threshold`)
    if (stretched6m && ret6m != null) drivers.push(`6M return +${ret6m.toFixed(1)}% ≥ ${STRETCHED_RETURN_6M}% threshold`)
    if (rs3m != null && rs3m >= STRONG_RS_3M) drivers.push(`RS vs SOXX 3M +${rs3m.toFixed(1)}pp`)
    return {
      bucket_id, display_name, stage,
      state_label:   'CROWDED',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, true),
      confidence,
      state_reason:  `${display_name} is classified as Crowded because ${stretched3m && ret3m != null ? `3M performance is stretched (+${ret3m.toFixed(1)}%)` : `6M performance is extended (+${ret6m?.toFixed(1)}%)`} while relative strength remains strong.`,
      state_drivers: drivers,
      risk_flags,
      source: src,
    }
  }

  // ── 4. DISTRIBUTION ───────────────────────────────────────────────────────
  const positiveHistorical = (ret3m != null && ret3m > 0) || (ret6m != null && ret6m > 0)
  const deteriorating1m    = ret1m != null && ret1m < 0
  if (rrgQ === 'Weakening' && positiveHistorical && deteriorating1m) {
    risk_flags.push('RRG_WEAKENING')
    return {
      bucket_id, display_name, stage,
      state_label:   'DISTRIBUTION',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
      confidence:    hasRRG && hasRS ? 'HIGH' : 'MEDIUM',
      state_reason:  `${display_name} is classified as Distribution because RRG position is weakening from prior strength while 1M momentum is deteriorating.`,
      state_drivers: [
        'RRG quadrant = Weakening',
        ret1m != null ? `1M return ${ret1m.toFixed(1)}% (negative)` : '1M negative',
        ret3m != null && ret3m > 0 ? `3M return +${ret3m.toFixed(1)}% (prior strength)` : '',
      ].filter(Boolean),
      risk_flags,
      source: src,
    }
  }

  // ── 5. LEADING ────────────────────────────────────────────────────────────
  if (
    rrgQ === 'Leading' &&
    rs3m != null && rs3m >= STRONG_RS_3M &&
    ret3m != null && ret3m > 0
  ) {
    return {
      bucket_id, display_name, stage,
      state_label:   'LEADING',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
      confidence:    coverage_ratio >= 0.8 && hasRRG ? 'HIGH' : 'MEDIUM',
      state_reason:  `${display_name} is classified as Leading because its 3M relative strength vs SOXX is positive (+${rs3m.toFixed(1)}pp) and its RRG position is in the Leading quadrant.`,
      state_drivers: [
        `RS vs SOXX 3M +${rs3m.toFixed(1)}pp`,
        'RRG quadrant = Leading',
        `3M return +${ret3m.toFixed(1)}%`,
      ],
      risk_flags,
      source: src,
    }
  }

  // ── 6. EMERGING ───────────────────────────────────────────────────────────
  const rsImproving   = (rs1m != null && rs1m > POSITIVE_RS_3M) || (rs3m != null && rs3m > POSITIVE_RS_3M)
  const positiveReturn = (ret1m != null && ret1m > 0) || (ret3m != null && ret3m > 0)
  if (rrgQ === 'Improving' && rsImproving && positiveReturn) {
    return {
      bucket_id, display_name, stage,
      state_label:   'EMERGING',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
      confidence:    hasRRG && coverage_ratio >= 0.5 ? 'MEDIUM' : 'LOW',
      state_reason:  `${display_name} is classified as Emerging because RRG position is improving and relative strength is turning positive.`,
      state_drivers: [
        'RRG quadrant = Improving',
        rs3m != null ? `RS vs SOXX 3M ${rs3m >= 0 ? '+' : ''}${rs3m.toFixed(1)}pp` : 'RS 1M positive',
        positiveReturn ? 'return recovering' : '',
      ].filter(Boolean),
      risk_flags,
      source: src,
    }
  }

  // ── 7. CONFIRMING ─────────────────────────────────────────────────────────
  const rrgOk = rrgQ === null || rrgQ === 'Leading' || rrgQ === 'Improving'
  if (rs3m != null && rs3m > POSITIVE_RS_3M && ret3m != null && ret3m > 0 && rrgOk) {
    return {
      bucket_id, display_name, stage,
      state_label:   'CONFIRMING',
      state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
      confidence:    coverage_ratio >= 0.75 && hasRS ? 'MEDIUM' : 'LOW',
      state_reason:  `${display_name} is classified as Confirming because relative strength is positive and 3M return is positive, consistent with participation in the current rotation.`,
      state_drivers: [
        `RS vs SOXX 3M +${rs3m.toFixed(1)}pp`,
        `3M return +${ret3m.toFixed(1)}%`,
        rrgQ ? `RRG = ${rrgQ}` : 'RRG unavailable',
      ],
      risk_flags,
      source: src,
    }
  }

  // ── 8. LAGGING (default) ──────────────────────────────────────────────────
  const explicitLagging = (rs3m != null && rs3m <= WEAK_RS_3M) || rrgQ === 'Lagging'
  if (rs3m != null && rs3m <= WEAK_RS_3M) risk_flags.push('RS_UNDERPERFORMANCE')
  if (rrgQ === 'Lagging') risk_flags.push('RRG_WEAKENING')
  return {
    bucket_id, display_name, stage,
    state_label:   'LAGGING',
    state_score:   calcStateScore(rs3m, ret3m, rrgQ, coverage_ratio, false),
    confidence:    hasRS ? 'MEDIUM' : 'LOW',
    state_reason:  explicitLagging
      ? `${display_name} is classified as Lagging because relative strength vs SOXX is weak${rrgQ === 'Lagging' ? ' and RRG position is in the Lagging quadrant' : ''}.`
      : `${display_name} does not meet thresholds for any positive state classification.`,
    state_drivers: [
      rs3m != null ? `RS vs SOXX 3M ${rs3m.toFixed(1)}pp` : 'RS unavailable',
      rrgQ === 'Lagging' ? 'RRG quadrant = Lagging' : '',
    ].filter(Boolean),
    risk_flags,
    source: src,
  }
}
