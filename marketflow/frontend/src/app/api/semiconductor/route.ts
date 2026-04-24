// Phase 1B/1E — Semiconductor data API
// Serves computed SemiconductorOutput from mock data.
// Replace MOCK_MARKET_DATA with real EOD price fetch for production.
import { NextResponse } from 'next/server'
import type { MarketDataInput, SemiconductorOutput } from '@/lib/semiconductor/types'
import { computeSignals }  from '@/lib/semiconductor/signals'
import { determineStage }  from '@/lib/semiconductor/stageEngine'
import { translate }       from '@/lib/semiconductor/translationEngine'

// ── Mock market data — replace with real EOD API call ────────────────────────
// Returns represent approximate 60d, 30d, 20d returns (decimal).
// slope_30d: positive = MU price trending up over 30 days.
const MOCK_MARKET_DATA: MarketDataInput = {
  as_of: new Date().toISOString().split('T')[0],
  tier2: {
    samsung_trend: 'POSITIVE',
    skhynix_trend: null,
    available: true,
  },
  tickers: {
    SOXX: { ticker: 'SOXX', price: 220, return_60d: 0.08, return_30d: 0.05, return_20d: 0.04, above_20dma: true,  slope_30d: 0 },
    SOXL: { ticker: 'SOXL', price: 28,  return_60d: 0.22, return_30d: 0.13, return_20d: 0.11, above_20dma: true,  slope_30d: 0 },
    QQQ:  { ticker: 'QQQ',  price: 445, return_60d: 0.03, return_30d: 0.02, return_20d: 0.02, above_20dma: true,  slope_30d: 0 },
    NVDA: { ticker: 'NVDA', price: 870, return_60d: 0.28, return_30d: 0.18, return_20d: 0.14, above_20dma: true,  slope_30d: 0 },
    AMD:  { ticker: 'AMD',  price: 170, return_60d: 0.10, return_30d: 0.06, return_20d: 0.05, above_20dma: true,  slope_30d: 0 },
    AVGO: { ticker: 'AVGO', price: 155, return_60d: 0.20, return_30d: 0.12, return_20d: 0.09, above_20dma: true,  slope_30d: 0 },
    MU:   { ticker: 'MU',   price: 120, return_60d: 0.10, return_30d: 0.07, return_20d: 0.05, above_20dma: true,  slope_30d: 0.02 },
    TSM:  { ticker: 'TSM',  price: 162, return_60d: 0.09, return_30d: 0.05, return_20d: 0.04, above_20dma: true,  slope_30d: 0 },
    ASML: { ticker: 'ASML', price: 820, return_60d: 0.02, return_30d: 0.01, return_20d: 0.01, above_20dma: false, slope_30d: 0 },
    AMAT: { ticker: 'AMAT', price: 195, return_60d: 0.03, return_30d: 0.02, return_20d: 0.01, above_20dma: true,  slope_30d: 0 },
    LRCX: { ticker: 'LRCX', price: 880, return_60d: 0.04, return_30d: 0.02, return_20d: 0.01, above_20dma: true,  slope_30d: 0 },
    KLAC: { ticker: 'KLAC', price: 720, return_60d: 0.03, return_30d: 0.01, return_20d: 0.01, above_20dma: true,  slope_30d: 0 },
  },
}

export async function GET() {
  try {
    const as_of   = MOCK_MARKET_DATA.as_of
    const signals  = computeSignals(MOCK_MARKET_DATA)
    const stage    = determineStage(signals, as_of)
    const translation = translate(signals, stage)

    const output: SemiconductorOutput = {
      market_data: MOCK_MARKET_DATA,
      signals,
      stage,
      translation,
      as_of,
    }

    return NextResponse.json(output)
  } catch (err) {
    console.error('[semiconductor/route]', err)
    return NextResponse.json({ error: 'computation failed' }, { status: 500 })
  }
}
