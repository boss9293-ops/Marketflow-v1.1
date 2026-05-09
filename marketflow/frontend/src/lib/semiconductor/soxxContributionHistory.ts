import {
  SOXX_BUCKET_DISPLAY_ORDER,
  type SoxxBucketContribution,
  type SoxxContributionSummary,
} from './soxxContribution'
import type { SoxxContributionPeriod } from './soxxContributionAdapter'

export const SOXX_CONTRIBUTION_BUCKET_ORDER = SOXX_BUCKET_DISPLAY_ORDER

type SoxxContributionBucketId = (typeof SOXX_CONTRIBUTION_BUCKET_ORDER)[number]

export type SoxxContributionHistoryStatus =
  | 'available'
  | 'partial'
  | 'unavailable'

export type SoxxContributionHistoryPoint = {
  date: string
  selectedContributionPctPoint: number | null
  residualContributionPctPoint: number | null
  totalContributionPctPoint: number | null
  soxxReturnPct: number | null
  availableTickerCount: number
  totalTickerCount: number
  missingTickers: string[]
  status: SoxxContributionHistoryStatus
}

export type SoxxBucketContributionHistoryPoint = {
  date: string
  period: SoxxContributionPeriod | string
  bucketId: string
  bucketName?: string
  label: string
  contributionPctPoint?: number | null
  returnPct?: number | null
  weightPct?: number
  bucketContributionPctPoint: number | null
  bucketWeightPct: number
  bucketWeightedReturnPct: number | null
  holdingsCount: number
  availableTickerCount?: number
  totalTickerCount?: number
  missingTickers?: string[]
  status?: SoxxContributionHistoryStatus
}

export type SoxxContributionHistorySnapshot = {
  date: string
  period: SoxxContributionPeriod | string
  selectedTotalPctPoint: number | null
  residualPctPoint: number | null
  totalContributionPctPoint: number | null
  soxxReturnPct?: number | null
  selectedWeightPct: number
  residualWeightPct: number
  availableTickerCount?: number
  totalTickerCount?: number
  missingTickers?: string[]
  status?: SoxxContributionHistoryStatus
  points: SoxxBucketContributionHistoryPoint[]
  warnings: string[]
}

export type SoxxContributionTrendSeriesPoint = {
  date: string
  ai_compute?: number | null
  memory?: number | null
  equipment?: number | null
  foundry_packaging?: number | null
  residual?: number | null
  selected_total?: number | null
  total?: number | null
  soxx_return?: number | null
}

export type SoxxContributionHistoryValidation = {
  snapshotCount: number
  pointCount: number
  hasResidual: boolean
  hasSelectedTotal: boolean
  warnings: string[]
}

function isTrendBucketId(bucketId: string): bucketId is SoxxContributionBucketId {
  return (SOXX_CONTRIBUTION_BUCKET_ORDER as readonly string[]).includes(bucketId)
}

export function buildContributionHistorySnapshot(
  date: string,
  summary: SoxxContributionSummary,
): SoxxContributionHistorySnapshot {
  const points: SoxxBucketContributionHistoryPoint[] =
    summary.bucketContributions.map((bucket: SoxxBucketContribution) => ({
      date,
      period: summary.periodLabel,
      bucketId: bucket.bucketId,
      bucketName: bucket.label,
      label: bucket.label,
      contributionPctPoint: bucket.contributionPctPoint,
      returnPct: bucket.weightedReturnPct,
      weightPct: bucket.totalWeightPct,
      bucketContributionPctPoint: bucket.contributionPctPoint,
      bucketWeightPct: bucket.totalWeightPct,
      bucketWeightedReturnPct: bucket.weightedReturnPct,
      holdingsCount: bucket.holdingsCount,
    }))

  return {
    date,
    period: summary.periodLabel,
    selectedTotalPctPoint: summary.selectedContributionPctPoint,
    residualPctPoint: summary.residualContributionPctPoint,
    totalContributionPctPoint: summary.totalContributionPctPoint,
    selectedWeightPct: summary.selectedWeightPct,
    residualWeightPct: summary.residualWeightPct,
    points,
    warnings: summary.warnings,
  }
}

export function buildContributionTrendSeries(
  snapshots: SoxxContributionHistorySnapshot[],
): SoxxContributionTrendSeriesPoint[] {
  return snapshots.map((snapshot) => {
    const row: SoxxContributionTrendSeriesPoint = {
      date: snapshot.date,
      selected_total: snapshot.selectedTotalPctPoint,
      residual: snapshot.residualPctPoint,
      total: snapshot.totalContributionPctPoint,
      soxx_return: snapshot.soxxReturnPct ?? null,
    }

    for (const point of snapshot.points) {
      if (isTrendBucketId(point.bucketId)) {
        row[point.bucketId] =
          point.bucketContributionPctPoint ?? point.contributionPctPoint ?? null
      }
    }

    return row
  })
}

export function validateContributionHistorySnapshots(
  snapshots: SoxxContributionHistorySnapshot[],
): SoxxContributionHistoryValidation {
  const warnings: string[] = []

  const pointCount = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.points.length,
    0,
  )

  const hasResidual =
    snapshots.length > 0 &&
    snapshots.every((snapshot) =>
      snapshot.points.some((point) => point.bucketId === 'residual'),
    )

  const hasSelectedTotal =
    snapshots.length > 0 &&
    snapshots.every((snapshot) =>
      typeof snapshot.selectedTotalPctPoint === 'number' &&
      Number.isFinite(snapshot.selectedTotalPctPoint),
    )

  if (!hasResidual) {
    warnings.push('One or more contribution history snapshots are missing residual bucket.')
  }

  if (!hasSelectedTotal) {
    warnings.push('One or more contribution history snapshots are missing selected total.')
  }

  return {
    snapshotCount: snapshots.length,
    pointCount,
    hasResidual,
    hasSelectedTotal,
    warnings,
  }
}
