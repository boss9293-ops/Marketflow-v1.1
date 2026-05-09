import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS = 60
const MIN_SOXX_CONTRIBUTION_HISTORY_DAYS = 20
const MAX_SOXX_CONTRIBUTION_HISTORY_DAYS = 252

const CONTRIBUTION_HISTORY_PATHS = [
  path.join(process.cwd(), '..', 'backend', 'output', 'semiconductor', 'soxx_contribution_history.json'),
  path.join(process.cwd(), 'backend', 'output', 'semiconductor', 'soxx_contribution_history.json'),
  path.join(process.cwd(), '..', 'output', 'semiconductor', 'soxx_contribution_history.json'),
]

function normalizeDays(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS
  return Math.max(
    MIN_SOXX_CONTRIBUTION_HISTORY_DAYS,
    Math.min(MAX_SOXX_CONTRIBUTION_HISTORY_DAYS, Math.round(parsed)),
  )
}

function sliceContributionPayload(payload: any, daysRequested: number) {
  const history = Array.isArray(payload.history)
    ? payload.history.slice(-daysRequested)
    : []
  const historyDates = new Set(history.map((row: any) => row?.date).filter(Boolean))

  const snapshots = Array.isArray(payload.snapshots)
    ? (
        historyDates.size > 0
          ? payload.snapshots.filter((snapshot: any) => historyDates.has(snapshot?.date))
          : payload.snapshots.slice(-daysRequested)
      )
    : []
  const snapshotDates = new Set(snapshots.map((snapshot: any) => snapshot?.date).filter(Boolean))
  const activeDates = historyDates.size > 0 ? historyDates : snapshotDates

  const bucketHistory = Array.isArray(payload.bucketHistory)
    ? payload.bucketHistory.filter((point: any) => activeDates.has(point?.date))
    : []

  return {
    ...payload,
    asOf: history[history.length - 1]?.date ?? snapshots[snapshots.length - 1]?.date ?? payload.asOf ?? null,
    daysRequested,
    window_trading_days: daysRequested,
    history,
    bucketHistory,
    snapshots,
  }
}

function loadContributionHistory() {
  for (const candidate of CONTRIBUTION_HISTORY_PATHS) {
    try {
      if (!fs.existsSync(candidate)) continue
      return {
        payload: JSON.parse(fs.readFileSync(candidate, 'utf-8')),
        sourcePath: candidate,
      }
    } catch {
      // Try the next candidate path.
    }
  }

  const unavailableMessage = 'Historical holding-level return data is not available in this build.'

  return {
    payload: {
      data_version: 'soxx_contribution_history_v1',
      status: 'unavailable',
      asOf: null,
      generated_at: null,
      holdings_as_of: null,
      source: {
        holdings: 'Official SOXX holdings snapshot.',
        prices: 'Historical contribution output JSON not found.',
      },
      period: '1D',
      daysRequested: DEFAULT_SOXX_CONTRIBUTION_HISTORY_DAYS,
      history: [],
      bucketHistory: [],
      snapshots: [],
      validation: {
        snapshotCount: 0,
        hasResidual: false,
        hasSelectedTotal: false,
        warnings: [unavailableMessage],
        status: 'unavailable',
      },
      warnings: [unavailableMessage],
    },
    sourcePath: null,
  }
}

export async function GET(request: NextRequest) {
  const { payload, sourcePath } = loadContributionHistory()
  const daysRequested = normalizeDays(request.nextUrl.searchParams.get('days'))
  const slicedPayload = sliceContributionPayload(payload, daysRequested)

  return NextResponse.json({
    ...slicedPayload,
    _meta: {
      sourcePath,
      note: 'Historical SOXX contribution data is backward-looking and not a forecast.',
    },
  })
}
