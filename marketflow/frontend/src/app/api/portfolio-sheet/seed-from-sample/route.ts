import { NextRequest, NextResponse } from 'next/server'

import { seedPortfolioSheetFromLinkedSample } from '@/lib/portfolio-sheet/sampleSeed'
import { ensurePortfolioSchema, portfolioSheetDbPath } from '@/lib/portfolio-sheet/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as {
      account?: string | null
      overwrite?: boolean
    }
    const result = await seedPortfolioSheetFromLinkedSample({
      account: body.account,
      overwrite: body.overwrite === true,
    })

    return NextResponse.json({
      seeded: true,
      db: {
        strategy: 'sqlite',
        path: portfolioSheetDbPath(),
      },
      result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed from linked sample' },
      { status: 400 },
    )
  }
}
