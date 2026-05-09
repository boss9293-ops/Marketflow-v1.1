import { NextRequest, NextResponse } from 'next/server'

import { loadPortfolioPrices } from '@/lib/portfolio-sheet/priceAdapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseTickers(raw: string | null): string[] {
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 80)
}

export async function GET(req: NextRequest) {
  const tickers = parseTickers(req.nextUrl.searchParams.get('tickers'))
  if (tickers.length === 0) {
    return NextResponse.json({ prices: {}, tickers: [] })
  }

  const prices = await loadPortfolioPrices(tickers)
  return NextResponse.json({
    prices,
    tickers,
  })
}
