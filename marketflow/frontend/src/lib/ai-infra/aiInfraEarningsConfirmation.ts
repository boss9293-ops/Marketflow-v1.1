// AI 인프라 수익 확인 레이어 — 수동 시드 기반 스코어링 + 버킷 집계 (E-4 MVP)

import { AI_INFRA_BUCKET_BY_ID } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'
import { AI_INFRA_COMPANY_PURITY } from '@/lib/ai-infra/aiInfraCompanyPurity'
// seed import handled below after type definitions to avoid circular reference at runtime

// ── Types ─────────────────────────────────────────────────────────────────────

export type EarningsConfirmationLevel =
  | 'CONFIRMED'
  | 'PARTIAL'
  | 'WATCH'
  | 'NOT_CONFIRMED'
  | 'DATA_LIMITED'
  | 'UNKNOWN'

export type EarningsEvidenceType =
  | 'AI_REVENUE'
  | 'BACKLOG'
  | 'GUIDANCE'
  | 'MARGIN'
  | 'CUSTOMER_DEMAND'
  | 'CAPEX_EXPOSURE'
  | 'MANAGEMENT_COMMENTARY'
  | 'ORDER_GROWTH'
  | 'SEGMENT_GROWTH'
  | 'COMMERCIALIZATION_PROGRESS'

export type AIInfraEarningsEvidence = {
  symbol:           string
  company_name?:    string
  primary_bucket:   string
  secondary_buckets?: string[]

  confirmation_level?: EarningsConfirmationLevel
  confirmation_score?: number

  evidence_types: EarningsEvidenceType[]

  ai_revenue_visibility:
    | 'VISIBLE'
    | 'PARTIAL'
    | 'INDIRECT'
    | 'NOT_DISCLOSED'
    | 'UNKNOWN'

  revenue_trend:
    | 'ACCELERATING'
    | 'GROWING'
    | 'STABLE'
    | 'DECLINING'
    | 'UNKNOWN'

  guidance_tone:
    | 'RAISED'
    | 'POSITIVE'
    | 'NEUTRAL'
    | 'CAUTIOUS'
    | 'LOWERED'
    | 'UNKNOWN'

  backlog_or_orders:
    | 'STRONG'
    | 'IMPROVING'
    | 'STABLE'
    | 'WEAKENING'
    | 'NOT_DISCLOSED'
    | 'UNKNOWN'

  margin_quality:
    | 'EXPANDING'
    | 'STABLE'
    | 'PRESSURED'
    | 'UNKNOWN'

  commercialization_status:
    | 'REVENUE_VISIBLE'
    | 'EARLY_REVENUE'
    | 'PILOT_OR_DESIGN_WIN'
    | 'PRE_COMMERCIAL'
    | 'STORY_ONLY'
    | 'UNKNOWN'

  evidence_notes: string[]
  caution_notes:  string[]

  source: {
    quarter?:      string
    fiscal_period?: string
    source_type:
      | 'MANUAL'
      | 'EARNINGS_RELEASE'
      | 'TRANSCRIPT'
      | 'SEC_FILING'
      | 'INVESTOR_PRESENTATION'
      | 'UNKNOWN'
    source_label?: string
    as_of?:        string
  }
}

export type AIInfraBucketEarningsConfirmation = {
  bucket_id:    string
  bucket_label: string

  confirmation_level: EarningsConfirmationLevel
  confirmation_score: number

  covered_symbols:  string[]
  missing_symbols:  string[]

  confirmed_count:    number
  partial_count:      number
  watch_count:        number
  not_confirmed_count: number
  data_limited_count: number

  evidence_summary: string
  caution_summary:  string

  strongest_evidence_symbols: string[]
  weakest_evidence_symbols:   string[]

  source: {
    coverage_ratio: number
    as_of?:         string
  }
}

// ── Freshness ─────────────────────────────────────────────────────────────────
// E-6 amendment: reference date = dataset_meta.as_of (NOT system current date).
// System date changes daily; dataset is only updated quarterly.
// Freshness reflects dataset version age, not time since last page load.

export type EarningsEvidenceFreshness = 'CURRENT' | 'RECENT' | 'STALE' | 'UNKNOWN'

function parseQuarterStr(s: string): { year: number; quarter: number } | null {
  const m = s.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return null
  return { year: Number(m[1]), quarter: Number(m[2]) }
}

// Returns how many quarters asOf lags behind referenceDate (positive = older).
function quartersBehind(referenceDate: string, asOf: string): number | null {
  const ref = parseQuarterStr(referenceDate)
  const rec = parseQuarterStr(asOf)
  if (!ref || !rec) return null
  return (ref.year - rec.year) * 4 + (ref.quarter - rec.quarter)
}

// Use dataset_meta.as_of as referenceDate — never pass new Date() here.
export function getDatasetFreshness(
  asOf: string,
  referenceDate: string,
): EarningsEvidenceFreshness {
  if (!asOf || !referenceDate) return 'UNKNOWN'
  const diff = quartersBehind(referenceDate, asOf)
  if (diff === null) return 'UNKNOWN'
  if (diff <= 1) return 'CURRENT'   // same quarter or 1 quarter behind
  if (diff <= 3) return 'RECENT'    // 2–3 quarters behind
  return 'STALE'
}

// Per-record freshness. Pass dataset_meta.as_of as referenceDate.
export function getEarningsEvidenceFreshness(
  record: AIInfraEarningsEvidence,
  referenceDate: string,
): EarningsEvidenceFreshness {
  return getDatasetFreshness(record.source.as_of ?? '', referenceDate)
}

// ── Revenue-class gate ────────────────────────────────────────────────────────

const REVENUE_CLASS: EarningsEvidenceType[] = [
  'AI_REVENUE', 'BACKLOG', 'SEGMENT_GROWTH', 'ORDER_GROWTH',
]

function hasRevenueClassEvidence(ev: AIInfraEarningsEvidence): boolean {
  return ev.evidence_types.some(t => REVENUE_CLASS.includes(t))
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function computeCompanyEarningsScore(ev: AIInfraEarningsEvidence): number {
  // Section 9 missing data: empty evidence_types → no positive score possible
  if (!Array.isArray(ev.evidence_types) || ev.evidence_types.length === 0) return 0

  const et = ev.evidence_types
  let score = 0

  if (et.includes('AI_REVENUE')) score += 25

  if (et.includes('BACKLOG') || et.includes('ORDER_GROWTH')) {
    if (ev.backlog_or_orders === 'STRONG')    score += 20
    else if (ev.backlog_or_orders === 'IMPROVING') score += 10
  }

  if (et.includes('GUIDANCE')) {
    if (ev.guidance_tone === 'RAISED')    score += 20
    else if (ev.guidance_tone === 'POSITIVE') score += 15
    else if (ev.guidance_tone === 'CAUTIOUS') score -= 20
    else if (ev.guidance_tone === 'LOWERED')  score -= 20
  }

  if (et.includes('SEGMENT_GROWTH')) score += 15

  if (et.includes('MARGIN')) {
    if (ev.margin_quality === 'EXPANDING') score += 10
    else if (ev.margin_quality === 'STABLE') score += 5
  }

  if (et.includes('MANAGEMENT_COMMENTARY')) score += 10

  // Risk deductions (independent of evidence_types)
  if (ev.ai_revenue_visibility === 'INDIRECT')     score -= 15
  if (ev.ai_revenue_visibility === 'NOT_DISCLOSED') score -= 10
  if (ev.margin_quality === 'PRESSURED')            score -= 10

  if (
    ev.commercialization_status === 'PRE_COMMERCIAL' ||
    ev.commercialization_status === 'STORY_ONLY'
  ) {
    score -= 25
  } else if (ev.commercialization_status === 'PILOT_OR_DESIGN_WIN') {
    score -= 10
  }

  return Math.min(100, Math.max(0, score))
}

export function getEarningsConfirmationLevel(
  score: number,
  ev: AIInfraEarningsEvidence,
): EarningsConfirmationLevel {
  // Revenue-class gate: MANAGEMENT_COMMENTARY alone cannot reach PARTIAL or above
  const effective = hasRevenueClassEvidence(ev) ? score : Math.min(score, 59)

  if (effective >= 80) return 'CONFIRMED'
  if (effective >= 60) return 'PARTIAL'
  if (effective >= 40) return 'WATCH'
  if (effective >= 20) return 'NOT_CONFIRMED'
  return 'DATA_LIMITED'
}

// ── Seed data access ──────────────────────────────────────────────────────────

// Lazy import avoids circular reference at module init time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EARNINGS_EVIDENCE_SEED: AIInfraEarningsEvidence[] =
  (require('./aiInfraEarningsEvidenceSeed') as { EARNINGS_EVIDENCE_SEED: AIInfraEarningsEvidence[] }).EARNINGS_EVIDENCE_SEED

export function getCompanyEarningsEvidence(symbol: string): AIInfraEarningsEvidence | undefined {
  return EARNINGS_EVIDENCE_SEED.find(e => e.symbol === symbol)
}

// ── Bucket aggregation ────────────────────────────────────────────────────────

function coveragePenalty(ratio: number): number {
  if (ratio >= 0.75) return 0
  if (ratio >= 0.50) return 10
  if (ratio >= 0.25) return 20
  return 30
}

export function aggregateBucketEarningsConfirmation(
  bucketId: string,
  bucketLabel: string,
  allEvidence: AIInfraEarningsEvidence[],
  bucketUniverse: string[],
): AIInfraBucketEarningsConfirmation {
  const covered    = allEvidence.filter(e => e.primary_bucket === bucketId)
  const covSymbols = covered.map(e => e.symbol)
  const missing    = bucketUniverse.filter(s => !covSymbols.includes(s))

  if (covered.length === 0) {
    return {
      bucket_id:    bucketId,
      bucket_label: bucketLabel,
      confirmation_level: 'DATA_LIMITED',
      confirmation_score: 0,
      covered_symbols:  [],
      missing_symbols:  bucketUniverse,
      confirmed_count: 0, partial_count: 0,
      watch_count: 0, not_confirmed_count: 0, data_limited_count: 0,
      evidence_summary: 'No coverage in current seed data.',
      caution_summary:  '',
      strongest_evidence_symbols: [],
      weakest_evidence_symbols:   [],
      source: { coverage_ratio: 0 },
    }
  }

  const scored = covered.map(e => {
    const score = computeCompanyEarningsScore(e)
    const level = getEarningsConfirmationLevel(score, e)
    return { e, score, level }
  })

  const coverage_ratio = bucketUniverse.length > 0
    ? covSymbols.length / bucketUniverse.length
    : 1

  const avgScore = scored.reduce((s, r) => s + r.score, 0) / scored.length
  const penalty  = coveragePenalty(coverage_ratio)
  let adjustedScore = Math.max(0, Math.round(avgScore - penalty))

  // E-5B amendment: minimum evidence floor — prevents aggregation dilution artifact
  // When a strong anchor symbol (e.g. ANET=100) is diluted by a weaker addition (e.g. APH=50),
  // the bucket score cannot fall below: maxCompanyScore - 30 (maximum possible coverage penalty)
  // Safety caps below override this floor.
  const maxCompanyScore = Math.max(...scored.map(r => r.score))
  const evidenceFloor = Math.max(0, maxCompanyScore - 30)
  adjustedScore = Math.max(adjustedScore, evidenceFloor)

  // Section 9 amendment: if all covered symbols are INDIRECT exposure, cap at WATCH (overrides floor)
  const allIndirect = covered.every(e => e.ai_revenue_visibility === 'INDIRECT')
  if (allIndirect) adjustedScore = Math.min(adjustedScore, 59)

  // Section 6.4 amendment: one-name bucket with INDIRECT or PARTIAL exposure → cap at WATCH (overrides floor)
  const isOneName = covered.length === 1
  if (isOneName) {
    const vis = covered[0].ai_revenue_visibility
    if (vis === 'INDIRECT' || vis === 'PARTIAL') {
      adjustedScore = Math.min(adjustedScore, 59)
    }
  }

  const level: EarningsConfirmationLevel =
    adjustedScore >= 80 ? 'CONFIRMED'
    : adjustedScore >= 60 ? 'PARTIAL'
    : adjustedScore >= 40 ? 'WATCH'
    : adjustedScore >= 20 ? 'NOT_CONFIRMED'
    : 'DATA_LIMITED'

  const countOf = (l: EarningsConfirmationLevel) => scored.filter(r => r.level === l).length

  const sorted     = [...scored].sort((a, b) => b.score - a.score)
  const topSymbols = sorted.slice(0, 2).map(r => r.e.symbol)
  const botSymbols = sorted.slice(-2).map(r => r.e.symbol)

  const notesAll    = covered.flatMap(e => e.evidence_notes).slice(0, 2)
  const cautionsAll = covered.flatMap(e => e.caution_notes).slice(0, 2)

  const as_of = covered
    .map(e => e.source.as_of)
    .filter(Boolean)
    .sort()
    .at(-1)

  return {
    bucket_id:    bucketId,
    bucket_label: bucketLabel,
    confirmation_level:  level,
    confirmation_score:  adjustedScore,
    covered_symbols:     covSymbols,
    missing_symbols:     missing,
    confirmed_count:     countOf('CONFIRMED'),
    partial_count:       countOf('PARTIAL'),
    watch_count:         countOf('WATCH'),
    not_confirmed_count: countOf('NOT_CONFIRMED'),
    data_limited_count:  countOf('DATA_LIMITED'),
    evidence_summary:    notesAll.join(' '),
    caution_summary:     cautionsAll.join(' '),
    strongest_evidence_symbols: topSymbols,
    weakest_evidence_symbols:   botSymbols,
    source: { coverage_ratio, as_of },
  }
}

export function computeAllBucketEarningsConfirmation(
  allEvidence: AIInfraEarningsEvidence[] = EARNINGS_EVIDENCE_SEED,
): {
  buckets:   AIInfraBucketEarningsConfirmation[]
  companies: AIInfraEarningsEvidence[]
  summary: {
    confirmed_buckets:     number
    partial_buckets:       number
    watch_buckets:         number
    not_confirmed_buckets: number
    data_limited_buckets:  number
    coverage_ratio:        number
    as_of?:                string
  }
} {
  const BUCKET_IDS: AIInfraBucketId[] = [
    'AI_CHIP', 'HBM_MEMORY', 'PACKAGING', 'COOLING', 'PCB_SUBSTRATE',
    'TEST_EQUIPMENT', 'GLASS_SUBSTRATE', 'OPTICAL_NETWORK', 'POWER_INFRA',
    'CLEANROOM_WATER', 'SPECIALTY_GAS', 'DATA_CENTER_INFRA', 'RAW_MATERIAL',
  ]

  const buckets = BUCKET_IDS.map(id => {
    const meta    = AI_INFRA_BUCKET_BY_ID[id]
    const label   = meta?.display_name ?? id
    const universe = AI_INFRA_COMPANY_PURITY
      .filter(p => p.primary_bucket === id)
      .map(p => p.symbol)
    return aggregateBucketEarningsConfirmation(id, label, allEvidence, universe)
  })

  const countLevel = (l: EarningsConfirmationLevel) =>
    buckets.filter(b => b.confirmation_level === l).length

  const totalExpected = AI_INFRA_COMPANY_PURITY.length
  const totalCovered  = allEvidence.length
  const coverage_ratio = totalExpected > 0 ? totalCovered / totalExpected : 0

  const as_of = allEvidence
    .map(e => e.source.as_of)
    .filter(Boolean)
    .sort()
    .at(-1)

  return {
    buckets,
    companies: allEvidence,
    summary: {
      confirmed_buckets:     countLevel('CONFIRMED'),
      partial_buckets:       countLevel('PARTIAL'),
      watch_buckets:         countLevel('WATCH'),
      not_confirmed_buckets: countLevel('NOT_CONFIRMED'),
      data_limited_buckets:  countLevel('DATA_LIMITED'),
      coverage_ratio:        Math.round(coverage_ratio * 100) / 100,
      as_of,
    },
  }
}

// ── Validation helper ─────────────────────────────────────────────────────────

export function validateEarningsEvidenceRecord(record: AIInfraEarningsEvidence): string[] {
  const errors: string[] = []

  if (!record.symbol) errors.push('symbol is required')
  if (!record.primary_bucket) errors.push('primary_bucket is required')
  if (!Array.isArray(record.evidence_types)) {
    errors.push('evidence_types must be array')
  } else if (record.evidence_types.length === 0) {
    errors.push('evidence_types is empty — confirmation_level will be DATA_LIMITED (Section 9 missing data rule)')
  }
  if (!Array.isArray(record.evidence_notes)) errors.push('evidence_notes must be array')
  if (!Array.isArray(record.caution_notes))  errors.push('caution_notes must be array')
  if (!record.source) errors.push('source is required')

  const score = computeCompanyEarningsScore(record)
  if (score < 0 || score > 100) errors.push(`score out of range: ${score}`)

  // Section 7 amendment: MANAGEMENT_COMMENTARY-only cannot reach PARTIAL or above
  const hasOnlyCommentary = !hasRevenueClassEvidence(record)
  const level = getEarningsConfirmationLevel(score, record)
  if (hasOnlyCommentary && (level === 'PARTIAL' || level === 'CONFIRMED')) {
    errors.push('VIOLATION: MANAGEMENT_COMMENTARY-only record reaching PARTIAL or CONFIRMED (E-4B QA blocker)')
  }

  return errors
}

export function validateAllSeedRecords(): { symbol: string; errors: string[] }[] {
  return EARNINGS_EVIDENCE_SEED
    .map(r => ({ symbol: r.symbol, errors: validateEarningsEvidenceRecord(r) }))
    .filter(r => r.errors.length > 0)
}
