import { NextRequest, NextResponse } from 'next/server'

import {
  ensurePortfolioSchema,
  listPortfolioDailySnapshots,
  portfolioSheetDbPath,
} from '@/lib/portfolio-sheet/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  ensurePortfolioSchema()

  const account = req.nextUrl.searchParams.get('account') || ''
  if (!account.trim()) {
    return NextResponse.json({ error: 'account is required' }, { status: 400 })
  }

  try {
    return NextResponse.json({
      account,
      history: listPortfolioDailySnapshots(account),
      db: {
        strategy: 'sqlite',
        path: portfolioSheetDbPath(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load snapshot history' },
      { status: 400 },
    )
  }
}
