import { NextRequest, NextResponse } from 'next/server'

import {
  ensurePortfolioSchema,
  listPortfolioInvestmentContributions,
  portfolioSheetDbPath,
  upsertPortfolioInvestmentContributions,
} from '@/lib/portfolio-sheet/storage'
import { PORTFOLIO_INVESTMENT_SHEET_LAYOUT } from '@/lib/portfolio-sheet/investmentLayout'
import type { PortfolioInvestmentContributionInput } from '@/lib/portfolio-sheet/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type InvestmentRequestBody = {
  account?: string
  accountName?: string
  account_name?: string
  rows?: Partial<PortfolioInvestmentContributionInput>[]
  investments?: Partial<PortfolioInvestmentContributionInput>[]
}

function normalizeRows(body: InvestmentRequestBody): PortfolioInvestmentContributionInput[] {
  const accountName = body.account_name ?? body.accountName ?? body.account ?? ''
  const rows = body.rows ?? body.investments ?? []

  return rows.map((row) => ({
    account_name: row.account_name ?? accountName,
    period_type: row.period_type ?? 'year',
    year: row.year ?? 0,
    month: row.month ?? 0,
    amount: row.amount ?? 0,
    memo: row.memo ?? null,
  }))
}

export async function GET(req: NextRequest) {
  ensurePortfolioSchema()

  const account = req.nextUrl.searchParams.get('account') || ''
  if (!account.trim()) {
    return NextResponse.json({ error: 'account is required' }, { status: 400 })
  }

  try {
    return NextResponse.json({
      account,
      investments: listPortfolioInvestmentContributions(account),
      sheetLayout: PORTFOLIO_INVESTMENT_SHEET_LAYOUT,
      db: {
        strategy: 'sqlite',
        path: portfolioSheetDbPath(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load investment contributions' },
      { status: 400 },
    )
  }
}

export async function PUT(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as InvestmentRequestBody
    const rows = normalizeRows(body)
    const result = upsertPortfolioInvestmentContributions(rows)
    const account = body.account_name ?? body.accountName ?? body.account ?? rows[0]?.account_name ?? ''

    return NextResponse.json({
      result,
      account,
      investments: account ? listPortfolioInvestmentContributions(account) : [],
      sheetLayout: PORTFOLIO_INVESTMENT_SHEET_LAYOUT,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save investment contributions' },
      { status: 400 },
    )
  }
}

export const POST = PUT
