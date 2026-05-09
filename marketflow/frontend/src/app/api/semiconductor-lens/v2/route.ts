/**
 * FILE: app/api/semiconductor-lens/v2/route.ts
 * RESPONSIBILITY: Internal test API — run full Semiconductor Lens v2 engine pipeline
 *   and return both raw engine output and market-path-compatible sectorTailwind output.
 *
 * INPUT:  MarketDataInput (from backend cache or SAMPLE_DATA fallback)
 *         MacroSnapshot   (from query params or DEFAULT_MACRO fallback)
 * OUTPUT: {
 *   engine:        SemiconductorEngineV2Output   ← full internal detail
 *   sectorTailwind: SectorTailwindOutput          ← market-path compatible slice
 *   _meta: { source, pipeline_ms, as_of }
 * }
 *
 * USAGE:
 *   GET /api/semiconductor-lens/v2
 *   GET /api/semiconductor-lens/v2?vix=22&yield_bps=30
 *
 * CONSUMERS:
 *   - Internal validation / debugging
 *   - Future: /api/market-path reads sectorTailwind slice only
 *
 * NOT FOR: direct UI rendering — use /api/semiconductor-lens for UI data
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
import type { SemiconductorEngineV2Output } from '@/lib/semiconductor/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Cache path (reuse v1 cache) ───────────────────────────────────────────────

const CACHE_PATH = path.join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json',
)

// ── Sample data (fallback when cache unavailable) ─────────────────────────────

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
      // Fill any tickers missing from cache with sample fallback
      for (const [tk, row] of Object.entries(SAMPLE_DATA.tickers)) {
        if (!cached.tickers[tk]) cached.tickers[tk] = row
      }
      return { data: cached, source: 'cache' }
    }
  } catch { /* fall through to sample */ }
  return { data: SAMPLE_DATA, source: 'sample' }
}

// ── MacroSnapshot from query params ──────────────────────────────────────────

function parseMacro(req: NextRequest): MacroSnapshot {
  const p = req.nextUrl.searchParams
  return {
    vix_level:            parseFloat(p.get('vix')         ?? '') || DEFAULT_MACRO.vix_level,
    vix_change_5d_pct:    parseFloat(p.get('vix_chg')     ?? '') || DEFAULT_MACRO.vix_change_5d_pct,
    yield_10y_change_30d: parseFloat(p.get('yield_bps')   ?? '') || DEFAULT_MACRO.yield_10y_change_30d,
    dxy_trend_30d_pct:    parseFloat(p.get('dxy')         ?? '') || DEFAULT_MACRO.dxy_trend_30d_pct,
    soxx_rsi_14:          parseFloat(p.get('rsi')         ?? '') || DEFAULT_MACRO.soxx_rsi_14,
    soxx_macd_hist:       parseFloat(p.get('macd')        ?? '') || DEFAULT_MACRO.soxx_macd_hist,
    soxx_vs_200ma_pct:    parseFloat(p.get('vs200ma')     ?? '') || DEFAULT_MACRO.soxx_vs_200ma_pct,
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function runPipeline(
  marketData: MarketDataInput,
  macro:      MacroSnapshot,
): SemiconductorEngineV2Output {
  const metrics      = normalizeMetrics(marketData, macro)
  const domainScores = computeDomainScores(metrics)
  const engine       = computeEngineScore(domainScores, metrics)
  const confidence   = computeConfidence(metrics, domainScores, engine.conflict_type)
  const explanation  = buildExplanation(engine, confidence, metrics)

  return {
    metrics,
    domain_scores: domainScores,
    engine,
    confidence,
    explanation,
    as_of: marketData.as_of,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const t0 = Date.now()

  try {
    const { data: marketData, source } = loadMarketData()
    const macro = parseMacro(req)

    const engineOutput    = runPipeline(marketData, macro)
    const sectorTailwind  = toSectorTailwind(engineOutput)

    return NextResponse.json({
      engine:        engineOutput,
      sectorTailwind,
      _meta: {
        source,
        pipeline_ms: Date.now() - t0,
        as_of:       engineOutput.as_of,
        note:        'Internal test API — not for direct UI rendering',
      },
    })
  } catch (err) {
    console.error('[semiconductor-lens/v2]', err)
    return NextResponse.json(
      { error: 'pipeline failed', detail: String(err) },
      { status: 500 },
    )
  }
}
