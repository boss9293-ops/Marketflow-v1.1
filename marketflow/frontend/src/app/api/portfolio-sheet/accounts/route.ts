import { NextRequest, NextResponse } from 'next/server'

import {
  createPortfolioAccount,
  ensurePortfolioSchema,
  listPortfolioAccounts,
  portfolioSheetDbPath,
  setPortfolioAccountCash,
} from '@/lib/portfolio-sheet/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE') || message.includes('constraint failed')
}

export async function GET() {
  ensurePortfolioSchema()
  return NextResponse.json({
    accounts: listPortfolioAccounts(),
    db: {
      strategy: 'sqlite',
      path: portfolioSheetDbPath(),
    },
  })
}

export async function POST(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      currency?: string
      cash?: number
    }
    const account = createPortfolioAccount({
      name: body.name ?? '',
      currency: body.currency,
      cash: body.cash,
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account' },
      { status: 400 },
    )
  }
}

export async function PUT(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      account?: string
      account_name?: string
      currency?: string
      cash?: number
    }
    const account = setPortfolioAccountCash(
      body.name ?? body.account_name ?? body.account ?? '',
      body.cash ?? 0,
      body.currency ?? 'USD',
    )

    return NextResponse.json({ account })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update account cash' },
      { status: 400 },
    )
  }
}
