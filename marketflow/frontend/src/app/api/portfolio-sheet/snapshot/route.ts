import { NextRequest, NextResponse } from 'next/server'

import {
  ensurePortfolioSchema,
  portfolioSheetDbPath,
  savePortfolioDailySnapshot,
} from '@/lib/portfolio-sheet/storage'
import { portfolioMarketClosureReason } from '@/lib/portfolio-sheet/marketCalendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SnapshotRequestBody = {
  date?: string
  account?: string
  accountName?: string
  account_name?: string
  totalValue?: number
  total_value?: number
  totalCost?: number
  total_cost?: number
  cash?: number
  pnl?: number
  pnlPct?: number
  pnl_pct?: number
  todayPnl?: number
  today_pnl?: number
  holdingsCount?: number
  holdings_count?: number
  snapshotJson?: unknown
  snapshot_json?: unknown
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstNumber(values: unknown[], fallback = 0): number {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    return asNumber(value, fallback)
  }
  return fallback
}

function payloadFromBody(body: SnapshotRequestBody) {
  const totalValue = firstNumber([body.total_value, body.totalValue])
  const totalCost = firstNumber([body.total_cost, body.totalCost])
  const cash = firstNumber([body.cash])
  const pnl = firstNumber([body.pnl], totalValue - totalCost - cash)
  const pnlPct = firstNumber([body.pnl_pct, body.pnlPct], totalCost > 0 ? pnl / totalCost : 0)

  return {
    date: body.date || todayKey(),
    account_name: body.account_name ?? body.accountName ?? body.account ?? '',
    total_value: totalValue,
    total_cost: totalCost,
    cash,
    pnl,
    pnl_pct: pnlPct,
    today_pnl: firstNumber([body.today_pnl, body.todayPnl]),
    holdings_count: firstNumber([body.holdings_count, body.holdingsCount]),
    snapshot_json: body.snapshot_json ?? body.snapshotJson ?? null,
  }
}

export async function POST(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as SnapshotRequestBody
    const payload = payloadFromBody(body)
    const closureReason = portfolioMarketClosureReason(payload.date)

    if (closureReason) {
      return NextResponse.json(
        {
          error: `Snapshot skipped: ${payload.date} is not a trading day (${closureReason}).`,
          tradingDay: false,
          closureReason,
        },
        { status: 409 },
      )
    }

    const snapshot = savePortfolioDailySnapshot(payload)

    return NextResponse.json({
      snapshot,
      tradingDay: true,
      duplicateRule: 'upsert by date + account_name',
      db: {
        strategy: 'sqlite',
        path: portfolioSheetDbPath(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save snapshot' },
      { status: 400 },
    )
  }
}
