import type { SoxxHolding } from './soxxHoldings'

export type SoxxHoldingReturn = {
  ticker: string
  returnPct: number
  periodLabel: string
}

export type SoxxHoldingContribution = {
  ticker: string
  name: string
  weightPct: number
  returnPct: number
  contributionPctPoint: number
  bucketId: string | null
  driverClass: SoxxHolding['driverClass']
  periodLabel: string
}

export type SoxxBucketContribution = {
  bucketId: string
  label: string
  contributionPctPoint: number
  totalWeightPct: number
  weightedReturnPct: number
  holdingsCount: number
  periodLabel: string
}

export type SoxxContributionSummary = {
  periodLabel: string
  totalContributionPctPoint: number
  selectedContributionPctPoint: number
  residualContributionPctPoint: number
  selectedWeightPct: number
  residualWeightPct: number
  bucketContributions: SoxxBucketContribution[]
  holdingContributions: SoxxHoldingContribution[]
  missingReturnTickers: string[]
  warnings: string[]
}

export type SoxxDataStatus =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'sample'

export const SOXX_BUCKET_LABELS: Record<string, string> = {
  ai_compute: 'AI Compute',
  memory: 'Memory / HBM',
  equipment: 'Equipment',
  foundry_packaging: 'Foundry / Packaging',
  residual: 'Other SOXX / Residual',
}

export const SOXX_BUCKET_DISPLAY_ORDER = [
  'ai_compute',
  'memory',
  'equipment',
  'foundry_packaging',
  'residual',
] as const

export type SoxxParticipationState =
  | 'broad_participation'
  | 'selected_led'
  | 'residual_led'
  | 'mixed_diverging'
  | 'unavailable'

export type SoxxParticipationInterpretation = {
  state: SoxxParticipationState
  label: string
  interpretation: string
  soxlContext: string
}

type BucketAccumulator = {
  contributionPctPoint: number
  totalWeightPct: number
  weightedReturnNumerator: number
  holdingsCount: number
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function computeSoxxContributionSummary(
  holdings: SoxxHolding[],
  returns: SoxxHoldingReturn[],
  selectedBucketIds: readonly string[],
): SoxxContributionSummary {
  const warnings: string[] = []
  const selectedSet = new Set(selectedBucketIds)
  const returnMap = new Map(
    returns.map((returnRow) => [normalizeTicker(returnRow.ticker), returnRow]),
  )

  const periodLabel = returns[0]?.periodLabel ?? 'unknown'
  const periodLabels = new Set(returns.map((returnRow) => returnRow.periodLabel))

  if (periodLabels.size > 1) {
    warnings.push('Holding return inputs contain multiple period labels. The first period label was used for the summary.')
  }

  const missingReturnTickers: string[] = []

  const holdingContributions: SoxxHoldingContribution[] = holdings.map((holding) => {
    const ticker = normalizeTicker(holding.ticker)
    const returnRow = returnMap.get(ticker)

    if (!returnRow) {
      missingReturnTickers.push(ticker)
    }

    const returnPct =
      returnRow && Number.isFinite(returnRow.returnPct)
        ? returnRow.returnPct
        : 0

    const weightPct = finiteOrZero(holding.weightPct)
    const contributionPctPoint = (weightPct * returnPct) / 100

    return {
      ticker,
      name: holding.name,
      weightPct,
      returnPct,
      contributionPctPoint,
      bucketId: holding.bucketId,
      driverClass: holding.driverClass,
      periodLabel,
    }
  })

  if (missingReturnTickers.length > 0) {
    warnings.push(
      `${missingReturnTickers.length} holdings are missing return data. Their contribution was treated as 0.`,
    )
  }

  const bucketAccumulator = new Map<string, BucketAccumulator>()

  for (const item of holdingContributions) {
    const bucketKey =
      item.bucketId && selectedSet.has(item.bucketId)
        ? item.bucketId
        : 'residual'

    const current =
      bucketAccumulator.get(bucketKey) ??
      {
        contributionPctPoint: 0,
        totalWeightPct: 0,
        weightedReturnNumerator: 0,
        holdingsCount: 0,
      }

    current.contributionPctPoint += item.contributionPctPoint
    current.totalWeightPct += item.weightPct
    current.weightedReturnNumerator += item.weightPct * item.returnPct
    current.holdingsCount += 1

    bucketAccumulator.set(bucketKey, current)
  }

  if (!bucketAccumulator.has('residual')) {
    bucketAccumulator.set('residual', {
      contributionPctPoint: 0,
      totalWeightPct: 0,
      weightedReturnNumerator: 0,
      holdingsCount: 0,
    })
  }

  const bucketContributions: SoxxBucketContribution[] = Array.from(
    bucketAccumulator.entries(),
  ).map(([bucketId, value]) => ({
    bucketId,
    label: SOXX_BUCKET_LABELS[bucketId] ?? bucketId,
    contributionPctPoint: value.contributionPctPoint,
    totalWeightPct: value.totalWeightPct,
    weightedReturnPct:
      value.totalWeightPct > 0
        ? value.weightedReturnNumerator / value.totalWeightPct
        : 0,
    holdingsCount: value.holdingsCount,
    periodLabel,
  }))

  const totalContributionPctPoint = bucketContributions.reduce(
    (sum, bucket) => sum + bucket.contributionPctPoint,
    0,
  )

  const selectedContributionPctPoint = bucketContributions
    .filter((bucket) => selectedSet.has(bucket.bucketId))
    .reduce((sum, bucket) => sum + bucket.contributionPctPoint, 0)

  const residualContributionPctPoint =
    bucketContributions.find((bucket) => bucket.bucketId === 'residual')
      ?.contributionPctPoint ?? 0

  const selectedWeightPct = bucketContributions
    .filter((bucket) => selectedSet.has(bucket.bucketId))
    .reduce((sum, bucket) => sum + bucket.totalWeightPct, 0)

  const residualWeightPct =
    bucketContributions.find((bucket) => bucket.bucketId === 'residual')
      ?.totalWeightPct ?? 0

  return {
    periodLabel,
    totalContributionPctPoint,
    selectedContributionPctPoint,
    residualContributionPctPoint,
    selectedWeightPct,
    residualWeightPct,
    bucketContributions,
    holdingContributions,
    missingReturnTickers,
    warnings,
  }
}

export function buildSoxxParticipationInterpretation(params: {
  selectedContributionPctPoint?: number | null
  residualContributionPctPoint?: number | null
  neutralBandPctPoint?: number
}): SoxxParticipationInterpretation {
  const neutralBand = params.neutralBandPctPoint ?? 0.05
  const selected = params.selectedContributionPctPoint
  const residual = params.residualContributionPctPoint

  if (
    typeof selected !== 'number' ||
    !Number.isFinite(selected) ||
    typeof residual !== 'number' ||
    !Number.isFinite(residual)
  ) {
    return {
      state: 'unavailable',
      label: 'Unavailable',
      interpretation:
        'Contribution interpretation is unavailable because required return or holdings data is missing.',
      soxlContext:
        'SOXL sensitivity context is unavailable until contribution data is connected.',
    }
  }

  const selectedPos = selected > neutralBand
  const selectedNeg = selected < -neutralBand
  const residualPos = residual > neutralBand
  const residualNeg = residual < -neutralBand

  if (selectedPos && residualPos) {
    return {
      state: 'broad_participation',
      label: 'Broad participation',
      interpretation:
        'Selected buckets and residual holdings are both contributing. This suggests broader SOXX participation rather than a move limited to the main mapped drivers.',
      soxlContext:
        'For SOXL, broader SOXX participation may make daily exposure interpretation cleaner, though still path-dependent.',
    }
  }

  if ((selectedPos && residualNeg) || (selectedNeg && residualPos)) {
    return {
      state: 'mixed_diverging',
      label: 'Mixed / Diverging',
      interpretation:
        'Selected buckets and residual holdings are moving in different directions. This suggests an uneven internal SOXX structure.',
      soxlContext:
        'For SOXL, divergent internal participation may make daily sensitivity harder to interpret.',
    }
  }

  if (selectedPos && !residualPos) {
    return {
      state: 'selected_led',
      label: 'Selected-led',
      interpretation:
        'Selected semiconductor driver buckets are contributing more than residual holdings. The move appears concentrated in the mapped drivers.',
      soxlContext:
        'For SOXL, selected-led contribution may imply more concentrated daily sensitivity to a smaller group of SOXX drivers.',
    }
  }

  if (residualPos && !selectedPos) {
    return {
      state: 'residual_led',
      label: 'Residual-led',
      interpretation:
        'Residual SOXX holdings are contributing more than the selected buckets. The move may be broader than the mapped driver set.',
      soxlContext:
        'For SOXL, residual-led contribution means sensitivity is coming from outside the main mapped driver buckets.',
    }
  }

  return {
    state: 'mixed_diverging',
    label: 'Mixed / Near neutral',
    interpretation:
      'Selected buckets and residual holdings are near neutral or not clearly aligned.',
    soxlContext:
      'For SOXL, near-neutral internal participation provides limited sensitivity context.',
  }
}

export function formatPctPoint(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%p`
}

export function formatReturnPct(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
