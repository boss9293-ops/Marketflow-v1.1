import { NextRequest, NextResponse } from 'next/server'

import {
  createPortfolioHolding,
  ensurePortfolioSchema,
  listPortfolioHoldings,
  updatePortfolioHolding,
  upsertPortfolioHolding,
} from '@/lib/portfolio-sheet/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type HoldingRequestBody = {
  account?: string
  accountName?: string
  account_name?: string
  id?: number
  ticker?: string
  shares?: number
  avgPrice?: number
  avg_price?: number
  memo?: string | null
  active?: boolean | number
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE') || message.includes('constraint failed')
}

function holdingPayload(body: HoldingRequestBody) {
  return {
    account_name: body.account_name ?? body.accountName ?? body.account ?? '',
    ticker: body.ticker ?? '',
    shares: body.shares ?? 0,
    avg_price: body.avg_price ?? body.avgPrice ?? 0,
    memo: body.memo ?? null,
    active: body.active,
  }
}

export async function GET(req: NextRequest) {
  ensurePortfolioSchema()
  const account = req.nextUrl.searchParams.get('account')

  return NextResponse.json({
    account: account || null,
    holdings: listPortfolioHoldings(account),
  })
}

export async function POST(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as HoldingRequestBody
    const holding = createPortfolioHolding(holdingPayload(body))
    return NextResponse.json({ holding }, { status: 201 })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Holding already exists for this account and ticker' }, { status: 409 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create holding' },
      { status: 400 },
    )
  }
}

export async function PUT(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as HoldingRequestBody
    const payload = holdingPayload(body)
    const holding = body.id ? updatePortfolioHolding({ ...payload, id: body.id }) : upsertPortfolioHolding(payload)
    return NextResponse.json({ holding })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Holding already exists for this account and ticker' }, { status: 409 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upsert holding' },
      { status: 400 },
    )
  }
}
