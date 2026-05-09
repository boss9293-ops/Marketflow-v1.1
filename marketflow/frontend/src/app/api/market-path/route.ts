/**
 * FILE: app/api/market-path/route.ts
 * RESPONSIBILITY: Public Market Path API — composite market direction signal
 *
 * INPUT:  MarketDataInput  (from backend cache or SAMPLE_DATA fallback)
 *         MacroSnapshot    (from query params or DEFAULT_MACRO fallback)
 * OUTPUT: MarketPathOutput — path_signal, path_label, confidence, sector_contributions, narrative
 *
 * PIPELINE:
 *   loadMarketData()
 *   → semiconductor sub-pipeline  (normalizeMetrics → domainScores → engineScore
 *                                   → confidence → explanation → toSectorTailwind)
 *   → assembleMarketPathInput()
 *   → computeMarketPath()
 *   → MarketPathOutput
 *
 * PHASE 1: semiconductor sector only. macro_regime = undefined (stub).
 * PHASE 2: connect lib/macro/ → pass macro_regime into MarketPathInput.
 *
 * QUERY PARAMS (all optional, fall back to DEFAULT_MACRO):
 *   ?vix=22  ?vix_chg=-0.05  ?yield_bps=30  ?dxy=-0.01  ?rsi=62  ?macd=0.8  ?vs200ma=0.12
 *
 * CONSUMERS:
 *   - /app/dashboard (market path widget)
 *   - /api/forecast-lab (future)
 *   - Any UI component needing composite market direction
 *
 * NOT FOR: semiconductor-specific detail — use /api/semiconductor-lens for that
 *
 * DO NOT: import React, use JSX, reference window/document
 */

import path            from 'path'
import fs              from 'fs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { MarketDataInput, MacroSnapshot } from '@/lib/semiconductor/types'
import { DEFAULT_MACRO }        from '@/lib/semiconductor/types'
import { normalizeMetrics }     from '@/lib/semiconductor/normalizeMetrics'
import { computeDomainScores }  from '@/lib/semiconductor/domainScores'
import { computeEngineScore }   from '@/lib/semiconductor/engineScore'
import { computeConfidence }    from '@/lib/semiconductor/confidenceScore'
import { buildExplanation }     from '@/lib/semiconductor/explanationEngine'
import { toSectorTailwind }     from '@/lib/semiconductor/sectorTailwind'
import { computeMarketPath }    from '@/lib/market-path/engine'
import type { MarketPathInput } from '@/lib/market-path/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Cache path ────────────────────────────────────────────────────────────────

const CACHE_PATH = path.join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json',
)

// ── Sample fallback ───────────────────────────────────────────────────────────

const SAMPLE_DATA: MarketDataInput = {
  as_of: new Date().toISOString().slice(0, 10),
  tier2: { samsung_trend: null, skhynix_trend: null, available: false },
  tickers: {
    SOXX: { ticker: 'SOXX', price: 568.23,  return_60d:  0.187, return_30d:  0.09, return_20d:  0.06, above_20dma: true,  slope_30d:  0.003 },
    SOXL: { ticker: 'SOXL', price:  22.40,  return_60d:  0.550, return_30d:  0.28, return_20d:  0.18, above_20dma: true,  slope_30d:  0.010 },
    QQQ:  { ticker: 'QQQ',  price: 452.00,  return_60d:  0.043, return_30d:  0.02, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
    NVDA: { ticker: 'NVDA', price: 950.00,  return_60d:  0.410, return_30d:  0.20, return_20d:  0.13, above_20dma: true,  slope_30d:  0.006 },
    AMD:  { ticker: 'AMD',  price: 167.00,  return_60d:  0.280, return_30d:  0.14, return_20d:  0.09, above_20dma: true,  slope_30d:  0.004 },
    AVGO: { ticker: 'AVGO', price: 1248.00, return_60d:  0.320, return_30d:  0.16, return_20d:  0.10, above_20dma: true,  slope_30d:  0.005 },
    MU:   { ticker: 'MU',   price: 130.00,  return_60d: -0.043, return_30d: -0.02, return_20d: -0.01, above_20dma: false, slope_30d: -0.001 },
    TSM:  { ticker: 'TSM',  price: 187.32,  return_60d:  0.112, return_30d:  0.06, return_20d:  0.04, above_20dma: true,  slope_30d:  0.002 },
    ASML: { ticker: 'ASML', price: 1023.00, return_60d: -0.021, return_30d: -0.01, return_20d: -0.01, above_20dma: false, slope_30d: -0.001 },
    AMAT: { ticker: 'AMAT', price: 198.00,  return_60d:  0.032, return_30d:  0.02, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
    LRCX: { ticker: 'LRCX', price: 890.00,  return_60d: -0.015, return_30d: -0.01, return_20d: -0.01, above_20dma: false, slope_30d: -0.001 },
    KLAC: { ticker: 'KLAC', price: 720.00,  return_60d: -0.028, return_30d: -0.01, return_20d: -0.01, above_20dma: false, slope_30d: -0.001 },
    TXN:  { ticker: 'TXN',  price: 192.40,  return_60d:  0.078, return_30d:  0.04, return_20d:  0.02, above_20dma: true,  slope_30d:  0.002 },
    MCHP: { ticker: 'MCHP', price:  87.60,  return_60d:  0.063, return_30d:  0.03, return_20d:  0.02, above_20dma: true,  slope_30d:  0.001 },
    ON:   { ticker: 'ON',   price:  68.20,  return_60d:  0.092, return_30d:  0.05, return_20d:  0.03, above_20dma: true,  slope_30d:  0.002 },
    ADI:  { ticker: 'ADI',  price: 223.15,  return_60d:  0.054, return_30d:  0.03, return_20d:  0.02, above_20dma: true,  slope_30d:  0.001 },
    MPWR: { ticker: 'MPWR', price: 712.30,  return_60d:  0.041, return_30d:  0.02, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
    AMKR: { ticker: 'AMKR', price:  24.80,  return_60d:  0.068, return_30d:  0.04, return_20d:  0.02, above_20dma: true,  slope_30d:  0.002 },
    ASX:  { ticker: 'ASX',  price:   8.90,  return_60d:  0.055, return_30d:  0.03, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
  },
}

// ── Data loader ───────────────────────────────────────────────────────────────

function loadMarketData(): { data: MarketDataInput; source: 'cache' | 'sample' } {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as MarketDataInput
      for (const [tk, row] of Object.entries(SAMPLE_DATA.tickers)) {
        if (!cached.tickers[tk]) cached.tickers[tk] = row
      }
      return { data: cached, source: 'cache' }
    }
  } catch { /* fall through */ }
  return { data: SAMPLE_DATA, source: 'sample' }
}

// ── Macro from query params ───────────────────────────────────────────────────

function parseMacro(req: NextRequest): MacroSnapshot {
  const p = req.nextUrl.searchParams
  return {
    vix_level:            parseFloat(p.get('vix')       ?? '') || DEFAULT_MACRO.vix_level,
    vix_change_5d_pct:    parseFloat(p.get('vix_chg')   ?? '') || DEFAULT_MACRO.vix_change_5d_pct,
    yield_10y_change_30d: parseFloat(p.get('yield_bps') ?? '') || DEFAULT_MACRO.yield_10y_change_30d,
    dxy_trend_30d_pct:    parseFloat(p.get('dxy')       ?? '') || DEFAULT_MACRO.dxy_trend_30d_pct,
    soxx_rsi_14:          parseFloat(p.get('rsi')       ?? '') || DEFAULT_MACRO.soxx_rsi_14,
    soxx_macd_hist:       parseFloat(p.get('macd')      ?? '') || DEFAULT_MACRO.soxx_macd_hist,
    soxx_vs_200ma_pct:    parseFloat(p.get('vs200ma')   ?? '') || DEFAULT_MACRO.soxx_vs_200ma_pct,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const t0 = Date.now()

  try {
    const { data: marketData, source } = loadMarketData()
    const macro = parseMacro(req)

    // Semiconductor sub-pipeline
    const metrics      = normalizeMetrics(marketData, macro)
    const domainScores = computeDomainScores(metrics)
    const engine       = computeEngineScore(domainScores, metrics)
    const confidence   = computeConfidence(metrics, domainScores, engine.conflict_type)
    const explanation  = buildExplanation(engine, confidence, metrics)

    const semiconductorOutput = { metrics, domain_scores: domainScores, engine, confidence, explanation, as_of: marketData.as_of }
    const sectorTailwind      = toSectorTailwind(semiconductorOutput)

    // Market Path Engine (Phase 1: semiconductor only)
    const marketPathInput: MarketPathInput = {
      sector_tailwinds: { semiconductor: sectorTailwind },
      as_of: marketData.as_of,
    }
    const marketPath = computeMarketPath(marketPathInput)

    return NextResponse.json({
      ...marketPath,
      _meta: {
        source,
        pipeline_ms: Date.now() - t0,
        phase:       'Phase 1 — semiconductor only',
      },
    })
  } catch (err) {
    console.error('[market-path]', err)
    return NextResponse.json(
      { error: 'pipeline failed', detail: String(err) },
      { status: 500 },
    )
  }
}
