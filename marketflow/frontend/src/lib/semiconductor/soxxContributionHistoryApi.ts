import type {
  SoxxBucketContributionHistoryPoint,
  SoxxContributionHistoryPoint,
  SoxxContributionHistorySnapshot,
} from './soxxContributionHistory'
import {
  getSoxxDataFreshness,
  type SoxxDataSourceMeta,
} from './soxxDataFreshness'

export type SoxxContributionHistoryApiStatus =
  | 'available'
  | 'ok'
  | 'partial'
  | 'unavailable'

export type SoxxContributionHistoryApiResponse = {
  status: SoxxContributionHistoryApiStatus
  source?: {
    holdings?: string
    prices?: string
  }
  asOf?: string | null
  generated_at?: string | null
  holdings_as_of?: string | null
  period?: string
  daysRequested?: number
  window_trading_days?: number
  history?: SoxxContributionHistoryPoint[]
  bucketHistory?: SoxxBucketContributionHistoryPoint[]
  snapshot_count?: number
  snapshots: SoxxContributionHistorySnapshot[]
  validation?: {
    snapshotCount?: number
    historyCount?: number
    bucketPointCount?: number
    hasResidual?: boolean
    hasSelectedTotal?: boolean
    holdingsTotalWeightPct?: number
    missingTickerCount?: number
    missingTickerDateRows?: number
    soxxReturnDiffWarningCount?: number
    warningCount?: number
    warnings?: string[]
    status?: string
  }
  warnings?: string[]
  meta?: SoxxDataSourceMeta
}

function normalizeHistoryStatus(
  status: SoxxContributionHistoryApiStatus | undefined,
): 'available' | 'partial' | 'unavailable' {
  if (status === 'available' || status === 'ok') return 'available'
  if (status === 'partial') return 'partial'
  return 'unavailable'
}

export function buildSoxxContributionHistorySourceMeta(
  payload: SoxxContributionHistoryApiResponse,
): SoxxDataSourceMeta {
  const source = payload.source?.prices ?? 'not_connected'
  const asOf = payload.asOf ?? undefined
  const status = normalizeHistoryStatus(payload.status)
  const warnings = payload.warnings ?? []

  return {
    source,
    asOf,
    status,
    freshness: getSoxxDataFreshness({ asOf }),
    warnings,
  }
}

export function isUsableSoxxContributionHistory(
  payload: SoxxContributionHistoryApiResponse | null | undefined,
): boolean {
  return Boolean(
    payload &&
      (payload.status === 'available' ||
        payload.status === 'ok' ||
        payload.status === 'partial') &&
      Array.isArray(payload.snapshots) &&
      payload.snapshots.length >= 2,
  )
}

export async function loadSoxxContributionHistory(params?: {
  days?: number
}): Promise<SoxxContributionHistoryApiResponse> {
  const days = params?.days
  const query =
    typeof days === 'number' && Number.isFinite(days)
      ? `?days=${Math.round(days)}`
      : ''

  try {
    const response = await fetch(`/api/semiconductor-lens/contribution-history${query}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      const fallback: SoxxContributionHistoryApiResponse = {
        status: 'unavailable',
        source: {
          prices: 'not_connected',
        },
        asOf: null,
        daysRequested: days ?? 60,
        history: [],
        bucketHistory: [],
        snapshots: [],
        validation: {
          warnings: [`Contribution history API returned ${response.status}.`],
        },
        warnings: [`Contribution history API returned ${response.status}.`],
      }
      return {
        ...fallback,
        meta: buildSoxxContributionHistorySourceMeta(fallback),
      }
    }

    const payload = await response.json()
    return {
      ...payload,
      meta: buildSoxxContributionHistorySourceMeta(payload),
    }
  } catch {
    const fallback: SoxxContributionHistoryApiResponse = {
      status: 'unavailable',
      source: {
        prices: 'not_connected',
      },
      asOf: null,
      daysRequested: days ?? 60,
      history: [],
      bucketHistory: [],
      snapshots: [],
      validation: {
        warnings: ['Contribution history API unavailable.'],
      },
      warnings: ['SOXX contribution history source is not connected yet.'],
    }
    return {
      ...fallback,
      meta: buildSoxxContributionHistorySourceMeta(fallback),
    }
  }
}

export async function fetchSoxxContributionHistory(): Promise<SoxxContributionHistoryApiResponse> {
  return loadSoxxContributionHistory()
}
