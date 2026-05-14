// Phase 4A — Semiconductor data API (real data)
// Reads from backend/output/cache/semiconductor_market_data.json (built by build_semiconductor_mvp.py).
// Falls back to mock data on Vercel / when cache is absent.
import path from 'path'
import fs   from 'fs'
import { NextResponse } from 'next/server'
import type { MarketDataInput, SemiconductorOutput, SignalInputs, StageOutput, SoxlOutput } from '@/lib/semiconductor/types'
import { computeSignals }       from '@/lib/semiconductor/signals'
import { determineStage }       from '@/lib/semiconductor/stageEngine'
import { translate }            from '@/lib/semiconductor/translationEngine'
import { getTursoClient }       from '@/lib/tursoClient'
import { buildDecayTimeSeries } from '@/lib/semiconductor/buildDecayTimeSeries'
import { buildLayerTimeSeries }       from '@/lib/semiconductor/buildLayerTimeSeries'
import { buildCycleScoreTimeSeries, saveTodayCycleScore } from '@/lib/semiconductor/buildCycleScoreTimeSeries'
import { buildSectorRSTimeSeries } from '@/lib/semiconductor/buildSectorRSTimeSeries'

const CACHE_PATH = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json')

const MOCK_MARKET_DATA: MarketDataInput = {
  as_of: '2026-04-22',
  tier2: { samsung_trend: null, skhynix_trend: null, available: false },
  tickers: {
    SOXX: { ticker: 'SOXX', price: 428, return_60d: 0.249, return_30d: 0.12, return_20d: 0.08, above_20dma: true,  slope_30d: 0.004 },
    SOXL: { ticker: 'SOXL', price: 103, return_60d: 0.707, return_30d: 0.35, return_20d: 0.22, above_20dma: true,  slope_30d: 0.012 },
    QQQ:  { ticker: 'QQQ',  price: 452, return_60d: 0.043, return_30d: 0.02, return_20d: 0.01, above_20dma: true,  slope_30d: 0.001 },
    NVDA: { ticker: 'NVDA', price: 201, return_60d: 0.079, return_30d: 0.04, return_20d: 0.03, above_20dma: true,  slope_30d: 0.002 },
    AMD:  { ticker: 'AMD',  price: 296, return_60d: 0.180, return_30d: 0.09, return_20d: 0.06, above_20dma: true,  slope_30d: 0.003 },
    AVGO: { ticker: 'AVGO', price: 417, return_60d: 0.286, return_30d: 0.14, return_20d: 0.09, above_20dma: true,  slope_30d: 0.004 },
    MU:   { ticker: 'MU',   price: 482, return_60d: 0.241, return_30d: 0.12, return_20d: 0.08, above_20dma: true,  slope_30d: 0.005 },
    TSM:  { ticker: 'TSM',  price: 380, return_60d: 0.143, return_30d: 0.07, return_20d: 0.05, above_20dma: true,  slope_30d: 0.002 },
    ASML: { ticker: 'ASML', price: 1465,return_60d: 0.037, return_30d: 0.02, return_20d: 0.01, above_20dma: true,  slope_30d: 0.001 },
    AMAT: { ticker: 'AMAT', price: 400, return_60d: 0.254, return_30d: 0.13, return_20d: 0.08, above_20dma: true,  slope_30d: 0.003 },
    LRCX: { ticker: 'LRCX', price: 262, return_60d: 0.177, return_30d: 0.09, return_20d: 0.06, above_20dma: true,  slope_30d: 0.003 },
    KLAC: { ticker: 'KLAC', price: 1803,return_60d: 0.169, return_30d: 0.08, return_20d: 0.05, above_20dma: true,  slope_30d: 0.002 },
  },
}

function loadMarketData(): MarketDataInput {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as MarketDataInput
    }
  } catch { /* fall through to mock */ }
  return MOCK_MARKET_DATA
}

async function persistTodaySnapshot(signals: SignalInputs, stage: StageOutput, soxl: SoxlOutput) {
  const today   = new Date().toISOString().slice(0, 10)
  const savedAt = new Date().toISOString()
  const payload = JSON.stringify({
    date:                today,
    cycle_score:         stage.stage_score,
    stage:               stage.stage,
    confidence:          stage.confidence,
    compute_rel:         signals.sub_bucket_perf.compute,
    memory_rel:          signals.sub_bucket_perf.memory,
    foundry_rel:         signals.sub_bucket_perf.foundry,
    equipment_rel:       signals.sub_bucket_perf.equipment,
    soxl_score:          soxl.suitability,
    soxl_window:         soxl.window,
    breadth_score:       signals.breadth_score,
    concentration_score: signals.concentration_score,
    soxx_vs_qqq_60d:     signals.soxx_vs_qqq_60d,
    saved_at:            savedAt,
  })
  try {
    const db = getTursoClient()
    if (!db) return
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS semiconductor_history (
              date     TEXT PRIMARY KEY,
              payload  TEXT NOT NULL,
              saved_at TEXT
            )`,
      args: [],
    })
    await db.execute({
      sql:  'INSERT OR REPLACE INTO semiconductor_history (date, payload, saved_at) VALUES (?, ?, ?)',
      args: [today, payload, savedAt],
    })
  } catch (e) {
    console.warn('[SC History] save failed:', e)
  }
}

export async function GET() {
  try {
    const marketData  = loadMarketData()
    const as_of       = marketData.as_of
    const signals     = computeSignals(marketData)
    const stage       = determineStage(signals, as_of)
    const translation = translate(signals, stage)

    // fire-and-forget — does not block response
    void persistTodaySnapshot(signals, stage, translation.soxl)

    const [decay_time_series, cycle_score_time_series, sector_rs_time_series] = await Promise.all([
      buildDecayTimeSeries(90),
      buildCycleScoreTimeSeries(90),
      buildSectorRSTimeSeries(90),
    ])
    const layer_time_series = buildLayerTimeSeries(90)

    // 오늘 Cycle Score 로컬 DB 저장 (fire-and-forget)
    void saveTodayCycleScore(stage.stage_score, stage.stage)

    const output: SemiconductorOutput = {
      market_data: marketData,
      signals,
      stage,
      translation,
      as_of,
      decay_time_series,
      layer_time_series,
      cycle_score_time_series,
      sector_rs_time_series,
    }
    return NextResponse.json(output)
  } catch (err) {
    console.error('[semiconductor/route]', err)
    return NextResponse.json({ error: 'computation failed' }, { status: 500 })
  }
}
