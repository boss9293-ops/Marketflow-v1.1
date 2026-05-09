import {
  SOXX_HOLDINGS_SNAPSHOT,
  SOXX_HOLDINGS_SNAPSHOT_AS_OF,
  SELECTED_SOXX_BUCKET_IDS,
} from './soxxHoldingsSnapshot'
import type { SoxxHolding } from './soxxHoldings'

export type SoxxHoldingsValidationStatus = 'pass' | 'partial' | 'fail'

export type SoxxHoldingsValidationIssue = {
  field: string
  severity: 'fail' | 'warn'
  message: string
}

export type SoxxHoldingsValidationResult = {
  status: SoxxHoldingsValidationStatus
  asOfDate: string | null
  holdingCount: number
  totalWeightPct: number
  selectedBucketTickerCount: number
  issues: SoxxHoldingsValidationIssue[]
}

const WEIGHT_MIN = 98
const WEIGHT_MAX = 101

export function validateSoxxHoldings(
  holdings: SoxxHolding[] = SOXX_HOLDINGS_SNAPSHOT,
  asOfDate: string | null = SOXX_HOLDINGS_SNAPSHOT_AS_OF,
): SoxxHoldingsValidationResult {
  const issues: SoxxHoldingsValidationIssue[] = []

  if (!asOfDate) {
    issues.push({ field: 'as_of_date', severity: 'fail', message: 'as-of date missing' })
  }

  if (!holdings || holdings.length === 0) {
    issues.push({ field: 'holdings', severity: 'fail', message: 'holdings list is empty' })
    return { status: 'fail', asOfDate, holdingCount: 0, totalWeightPct: 0, selectedBucketTickerCount: 0, issues }
  }

  const totalWeightPct = holdings.reduce((acc, h) => acc + (h.weightPct ?? 0), 0)

  if (totalWeightPct < WEIGHT_MIN || totalWeightPct > WEIGHT_MAX) {
    issues.push({
      field: 'total_weight',
      severity: 'fail',
      message: `total weight ${totalWeightPct.toFixed(5)}% outside expected range (${WEIGHT_MIN}%–${WEIGHT_MAX}%)`,
    })
  }

  const tickerList = holdings
    .map((h) => h.ticker?.trim().toUpperCase())
    .filter((t): t is string => Boolean(t))

  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const t of tickerList) {
    if (seen.has(t)) dupes.add(t)
    seen.add(t)
  }
  if (dupes.size > 0) {
    issues.push({
      field: 'tickers',
      severity: 'fail',
      message: `duplicate tickers: ${[...dupes].sort().join(', ')}`,
    })
  }

  const zeroWeight = holdings
    .filter((h) => !h.weightPct || h.weightPct <= 0)
    .map((h) => h.ticker)
  if (zeroWeight.length > 0) {
    issues.push({
      field: 'weights',
      severity: 'warn',
      message: `zero/missing weight: ${zeroWeight.join(', ')}`,
    })
  }

  const tickerBuckets = new Map<string, string[]>()
  for (const h of holdings) {
    const t = h.ticker?.trim().toUpperCase()
    if (t && h.bucketId) {
      const current = tickerBuckets.get(t) ?? []
      current.push(h.bucketId)
      tickerBuckets.set(t, current)
    }
  }
  const multiBucket = [...tickerBuckets.entries()].filter(([, bs]) => bs.length > 1)
  if (multiBucket.length > 0) {
    issues.push({
      field: 'bucket_mapping',
      severity: 'fail',
      message: `tickers in multiple buckets: ${multiBucket.map(([t, bs]) => `${t}→[${bs.join(',')}]`).join('; ')}`,
    })
  }

  const selectedBucketIds = SELECTED_SOXX_BUCKET_IDS as readonly string[]
  const selectedBucketTickers = holdings.filter(
    (h) => h.bucketId && selectedBucketIds.includes(h.bucketId),
  )

  const hasFail = issues.some((i) => i.severity === 'fail')
  const hasWarn = issues.some((i) => i.severity === 'warn')
  const status: SoxxHoldingsValidationStatus = hasFail ? 'fail' : hasWarn ? 'partial' : 'pass'

  return {
    status,
    asOfDate,
    holdingCount: holdings.length,
    totalWeightPct,
    selectedBucketTickerCount: selectedBucketTickers.length,
    issues,
  }
}
