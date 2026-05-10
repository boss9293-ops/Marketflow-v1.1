// AI 인프라 버킷별 상대강도·모멘텀 계산 계약 및 순수 헬퍼 — Phase D-2

import type { AIInfraBucketId, AIInfraStage, AIInfraDataQuality } from './aiInfraBucketMap'

// ── Period return shape ───────────────────────────────────────────────────────

export interface AIInfraPeriodReturns {
  one_month:   number | null
  three_month: number | null
  six_month:   number | null
}

// ── Breadth types ─────────────────────────────────────────────────────────────

export type BreadthLabel = 'BROAD' | 'IMPROVING' | 'NARROW' | 'WEAK' | 'UNKNOWN'

export interface AIInfraBucketBreadth {
  valid_count:       number
  above_ma50_count:  number
  breadth_ma50_pct:  number
  label:             BreadthLabel
}

// ── Core output type ──────────────────────────────────────────────────────────

export interface AIInfraBucketMomentum {
  bucket_id:    AIInfraBucketId
  display_name: string
  stage:        AIInfraStage
  benchmark:    'SOXX' | 'QQQ' | 'SPY'

  returns:  AIInfraPeriodReturns
  one_week?: number | null           // 5 trading-day basket return; computed in route

  relative_strength: {
    vs_soxx: AIInfraPeriodReturns
    vs_qqq:  AIInfraPeriodReturns
    vs_spy:  AIInfraPeriodReturns
  }

  rank: {
    one_month:   number | null
    three_month: number | null
    six_month:   number | null
    composite:   number | null
  }

  coverage: {
    symbol_count:        number
    priced_symbol_count: number
    coverage_ratio:      number
    data_quality:        AIInfraDataQuality
  }

  breadth?: AIInfraBucketBreadth     // % above MA50; computed in route
}

// ── Benchmark snapshot ────────────────────────────────────────────────────────

export interface AIInfraBenchmarkReturns {
  SOXX: AIInfraPeriodReturns
  QQQ:  AIInfraPeriodReturns
  SPY:  AIInfraPeriodReturns
}

// ── Per-ticker multi-period return (used by route, not exposed to UI) ─────────

export interface AIInfraMultiPeriodReturn {
  ticker:      string
  five_day?:   number | null         // 5 trading-day return
  one_month:   number | null
  three_month: number | null
  six_month:   number | null
  available:   boolean
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function avgOrNull(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) return null
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

function diffOrNull(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return a - b
}

// ── Bucket RS computation ─────────────────────────────────────────────────────

export function computeBucketRS(params: {
  bucket_id:         AIInfraBucketId
  display_name:      string
  stage:             AIInfraStage
  default_benchmark: 'SOXX' | 'QQQ' | 'SPY'
  symbols:           string[]
  data_quality:      AIInfraDataQuality
  tickerMap:         Map<string, AIInfraMultiPeriodReturn>
  benchmarks:        AIInfraBenchmarkReturns
}): AIInfraBucketMomentum {
  const {
    bucket_id, display_name, stage, default_benchmark,
    symbols, data_quality, tickerMap, benchmarks,
  } = params

  const priced = symbols.filter(sym => tickerMap.get(sym.toUpperCase())?.available === true)

  const get = (sym: string, field: keyof AIInfraPeriodReturns): number | null =>
    tickerMap.get(sym.toUpperCase())?.[field] ?? null

  const basketReturns: AIInfraPeriodReturns = {
    one_month:   avgOrNull(priced.map(s => get(s, 'one_month'))),
    three_month: avgOrNull(priced.map(s => get(s, 'three_month'))),
    six_month:   avgOrNull(priced.map(s => get(s, 'six_month'))),
  }

  const one_week = avgOrNull(priced.map(s => tickerMap.get(s.toUpperCase())?.five_day ?? null))

  const rs_vs_soxx: AIInfraPeriodReturns = {
    one_month:   diffOrNull(basketReturns.one_month,   benchmarks.SOXX.one_month),
    three_month: diffOrNull(basketReturns.three_month, benchmarks.SOXX.three_month),
    six_month:   diffOrNull(basketReturns.six_month,   benchmarks.SOXX.six_month),
  }

  const rs_vs_qqq: AIInfraPeriodReturns = {
    one_month:   diffOrNull(basketReturns.one_month,   benchmarks.QQQ.one_month),
    three_month: diffOrNull(basketReturns.three_month, benchmarks.QQQ.three_month),
    six_month:   diffOrNull(basketReturns.six_month,   benchmarks.QQQ.six_month),
  }

  const rs_vs_spy: AIInfraPeriodReturns = {
    one_month:   diffOrNull(basketReturns.one_month,   benchmarks.SPY.one_month),
    three_month: diffOrNull(basketReturns.three_month, benchmarks.SPY.three_month),
    six_month:   diffOrNull(basketReturns.six_month,   benchmarks.SPY.six_month),
  }

  const coverage_ratio = symbols.length > 0 ? priced.length / symbols.length : 0

  // Downgrade data_quality at runtime if coverage is worse than bucket definition
  let effective_quality: AIInfraDataQuality = data_quality
  if (priced.length === 0) effective_quality = 'DATA_INSUFFICIENT'
  else if (coverage_ratio < 0.5 && data_quality === 'REAL') effective_quality = 'PARTIAL'

  return {
    bucket_id,
    display_name,
    stage,
    benchmark: default_benchmark,
    returns: basketReturns,
    one_week,
    relative_strength: { vs_soxx: rs_vs_soxx, vs_qqq: rs_vs_qqq, vs_spy: rs_vs_spy },
    rank: { one_month: null, three_month: null, six_month: null, composite: null },
    coverage: {
      symbol_count:        symbols.length,
      priced_symbol_count: priced.length,
      coverage_ratio:      Math.round(coverage_ratio * 100) / 100,
      data_quality:        effective_quality,
    },
  }
}

// ── Ranking ───────────────────────────────────────────────────────────────────
// Rank 1 = highest RS vs SOXX. null RS → unranked.

export function rankBuckets(buckets: AIInfraBucketMomentum[]): AIInfraBucketMomentum[] {
  const r1 = buildRankByField(buckets, b => b.relative_strength.vs_soxx.one_month)
  const r3 = buildRankByField(buckets, b => b.relative_strength.vs_soxx.three_month)
  const r6 = buildRankByField(buckets, b => b.relative_strength.vs_soxx.six_month)

  return buckets.map((b, i) => ({
    ...b,
    rank: {
      one_month:   r1[i],
      three_month: r3[i],
      six_month:   r6[i],
      composite:   compositeRank([r1[i], r3[i], r6[i]]),
    },
  }))
}

function buildRankByField(
  buckets: AIInfraBucketMomentum[],
  getValue: (b: AIInfraBucketMomentum) => number | null,
): (number | null)[] {
  const entries = buckets.map((b, i) => ({ i, v: getValue(b) }))
  const valid   = entries.filter((x): x is { i: number; v: number } => x.v !== null)
  valid.sort((a, b) => b.v - a.v)
  const rankMap = new Map(valid.map(({ i }, rank) => [i, rank + 1]))
  return buckets.map((_, i) => rankMap.get(i) ?? null)
}

function compositeRank(ranks: (number | null)[]): number | null {
  const valid = ranks.filter((r): r is number => r !== null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((s, r) => s + r, 0) / valid.length)
}

// ── Display helpers ───────────────────────────────────────────────────────────
// getBasicRSLabel is a TEMPORARY D-2 display shortcut — NOT the final D-4 State Label.

export function getBasicRSLabel(rs3M: number | null): { label: string; color: string } {
  if (rs3M === null) return { label: 'Data Missing', color: '#6B7B95' }
  if (rs3M > 5)     return { label: 'Leading',      color: '#3FB6A8' }
  if (rs3M > 0)     return { label: 'Improving',    color: '#5DCFB0' }
  if (rs3M > -5)    return { label: 'Mixed',        color: '#D4B36A' }
  return                   { label: 'Lagging',      color: '#E55A5A' }
}

export function fmtRS(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}pp`
}

export function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function rsColor(v: number | null): string {
  if (v === null) return '#6B7B95'
  if (v > 0)  return '#3FB6A8'
  if (v < 0)  return '#E55A5A'
  return '#B8C8DC'
}
