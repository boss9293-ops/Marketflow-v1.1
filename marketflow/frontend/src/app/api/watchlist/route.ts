import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') || 'wl-default-core'
  
  // Simulated database / python backend response of watchlist items
  // In a real scenario, this could query PostgreSQL, MongoDB, or an external Python service.
  const items = [
    { id: 'wli-nflx', watchlistId: id, symbol: 'NFLX', companyName: 'Netflix, Inc.', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-aapl', watchlistId: id, symbol: 'AAPL', companyName: 'Apple Inc.', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-googl', watchlistId: id, symbol: 'GOOGL', companyName: 'Alphabet Inc. Class A', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-tsla', watchlistId: id, symbol: 'TSLA', companyName: 'Tesla, Inc.', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-nvda', watchlistId: id, symbol: 'NVDA', companyName: 'NVIDIA Corporation', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-ibm', watchlistId: id, symbol: 'IBM', companyName: 'International Business Machines', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-intc', watchlistId: id, symbol: 'INTC', companyName: 'Intel Corporation', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
    { id: 'wli-xom', watchlistId: id, symbol: 'XOM', companyName: 'Exxon Mobil Corporation', lastPrice: '--', changePercent: '--', rangeLabel: '--' },
  ]

  // Add a slight delay to simulate database/API latency
  await new Promise(resolve => setTimeout(resolve, 50))
  
  return NextResponse.json({ watchlistId: id, items })
}
