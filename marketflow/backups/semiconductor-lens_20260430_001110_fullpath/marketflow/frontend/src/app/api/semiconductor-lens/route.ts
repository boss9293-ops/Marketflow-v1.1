// Semiconductor Lens API — v2 engine pipeline
// Returns KPI bar data + bucket performance for TerminalXDashboard
import path from 'path'
import fs   from 'fs'
import { NextResponse } from 'next/server'
import type { MarketDataInput } from '@/lib/semiconductor/types'
import { DEFAULT_MACRO }        from '@/lib/semiconductor/types'
import { normalizeMetrics }     from '@/lib/semiconductor/normalizeMetrics'
import { computeDomainScores }  from '@/lib/semiconductor/domainScores'
import { computeEngineScore }   from '@/lib/semiconductor/engineScore'
import { computeConfidence }    from '@/lib/semiconductor/confidenceScore'
import { buildExplanation }     from '@/lib/semiconductor/explanationEngine'

const CACHE_PATH          = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json')
const BREADTH_CACHE_PATH  = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_breadth.json')
const MOMENTUM_CACHE_PATH     = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_momentum.json')
const CORRELATION_CACHE_PATH  = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_correlation.json')
const WEIGHTS_CACHE_PATH      = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_weights.json')
const AI_CONC_CACHE_PATH      = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_ai_concentration.json')

const MOCK: MarketDataInput = {
  as_of: new Date().toISOString().slice(0, 10),
  tier2: { samsung_trend: null, skhynix_trend: null, available: false },
  tickers: {
    SOXX: { ticker: 'SOXX', price: 568.23,  return_60d:  0.187, return_30d:  0.09, return_20d:  0.06, above_20dma: true,  slope_30d:  0.003 },
    SOXL: { ticker: 'SOXL', price: 22.40,   return_60d:  0.550, return_30d:  0.28, return_20d:  0.18, above_20dma: true,  slope_30d:  0.010 },
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
    MCHP: { ticker: 'MCHP', price: 87.60,   return_60d:  0.063, return_30d:  0.03, return_20d:  0.02, above_20dma: true,  slope_30d:  0.001 },
    ON:   { ticker: 'ON',   price: 68.20,   return_60d:  0.092, return_30d:  0.05, return_20d:  0.03, above_20dma: true,  slope_30d:  0.002 },
    ADI:  { ticker: 'ADI',  price: 223.15,  return_60d:  0.054, return_30d:  0.03, return_20d:  0.02, above_20dma: true,  slope_30d:  0.001 },
    MPWR: { ticker: 'MPWR', price: 712.30,  return_60d:  0.041, return_30d:  0.02, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
    AMKR: { ticker: 'AMKR', price: 24.80,   return_60d:  0.068, return_30d:  0.04, return_20d:  0.02, above_20dma: true,  slope_30d:  0.002 },
    ASX:  { ticker: 'ASX',  price: 8.90,    return_60d:  0.055, return_30d:  0.03, return_20d:  0.01, above_20dma: true,  slope_30d:  0.001 },
  },
}

function loadAiConcentrationHistory(): unknown[] | null {
  try {
    if (fs.existsSync(AI_CONC_CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(AI_CONC_CACHE_PATH, 'utf-8'))
      return cached.ai_infra_concentration_history ?? null
    }
  } catch { /* fall through */ }
  return null
}

function loadWeights(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(WEIGHTS_CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(WEIGHTS_CACHE_PATH, 'utf-8'))
      return { market_cap_weights: cached.market_cap_weights ?? null, bucket_weights: cached.bucket_weights ?? null }
    }
  } catch { /* fall through */ }
  return null
}

function loadCorrelationMatrix(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(CORRELATION_CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CORRELATION_CACHE_PATH, 'utf-8'))
      return cached.correlation_matrix ?? null
    }
  } catch { /* fall through */ }
  return null
}

function loadMomentumDetail(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(MOMENTUM_CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(MOMENTUM_CACHE_PATH, 'utf-8'))
      return cached.momentum_detail ?? null
    }
  } catch { /* fall through */ }
  return null
}

function loadBreadthDetail(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(BREADTH_CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(BREADTH_CACHE_PATH, 'utf-8'))
      return cached.breadth_detail ?? null
    }
  } catch { /* fall through */ }
  return null
}

function loadData(): MarketDataInput {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as MarketDataInput
      for (const [tk, data] of Object.entries(MOCK.tickers)) {
        if (!cached.tickers[tk]) cached.tickers[tk] = data
      }
      return cached
    }
  } catch { /* fall through */ }
  return MOCK
}

const BUCKET_DEFS = [
  { name: 'AI Infrastructure', tickers: ['NVDA','AMD','AVGO'],          color: '#10b981' },
  { name: 'Memory',            tickers: ['MU'],                         color: '#f97316' },
  { name: 'Foundry',           tickers: ['TSM'],                        color: '#ec4899' },
  { name: 'Equipment',         tickers: ['ASML','AMAT','LRCX','KLAC'], color: '#eab308' },
  { name: 'Logic / MCU',       tickers: ['TXN','MCHP','ON'],            color: '#8b5cf6' },
  { name: 'Analog / Power',    tickers: ['ADI','MPWR'],                 color: '#06b6d4' },
  { name: 'Packaging / OSAT',  tickers: ['AMKR','ASX'],                 color: '#a78bfa' },
] as const

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}
function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

const CYCLE_STATE_LABEL: Record<string, string> = {
  'Contraction':    'CONTRACTION',
  'Trough':         'TROUGH',
  'Recovery':       'RECOVERY',
  'Expansion':      'MID EXPANSION',
  'Late Expansion': 'LATE EXPANSION',
  'Peak Risk':      'PEAK RISK',
}

export async function GET() {
  try {
    const data              = loadData()
    const breadthDetail     = loadBreadthDetail()
    const momentumDetail    = loadMomentumDetail()
    const correlationMatrix = loadCorrelationMatrix()
    const weights           = loadWeights()
    const aiConcHistory     = loadAiConcentrationHistory()
    const macro             = DEFAULT_MACRO

    // v2 engine pipeline
    const metrics      = normalizeMetrics(data, macro)
    const domainScores = computeDomainScores(metrics)
    const engine       = computeEngineScore(domainScores, metrics)
    const confidence   = computeConfidence(metrics, domainScores, engine.conflict_type)
    const explanation  = buildExplanation(engine, confidence, metrics)

    const t            = data.tickers
    const soxxReturn60d = t.SOXX?.return_60d ?? 0

    // Breadth from normalized metrics
    const breadthMetric = metrics.find(m => m.id === 'breadth_pct_above_20ma')
    const breadthPct    = Math.round(breadthMetric?.normalized_value ?? 50)
    const breadthLabel  = breadthPct >= 65 ? 'BULLISH' : breadthPct >= 45 ? 'NEUTRAL' : 'BEARISH'

    // Bucket performance
    const buckets = BUCKET_DEFS.map(b => {
      const returns  = b.tickers.map(tk => t[tk]?.return_60d ?? 0)
      const avgRet   = avg(returns)
      const relRet   = avgRet - soxxReturn60d
      const prices   = b.tickers.map(tk => t[tk]?.price ?? 0)
      const avgPrice = avg(prices.filter(p => p > 0))
      return {
        name:    b.name,
        color:   b.color,
        price:   avgPrice > 0 ? avgPrice.toFixed(2) : '—',
        m6:      fmtPct(avgRet),
        vs_soxx: `${relRet >= 0 ? '+' : ''}${relRet.toFixed(2)}`,
        rs:      avgRet > 0 ? (1 + avgRet / (soxxReturn60d || 0.001)).toFixed(2) : '0.80',
        up:      avgRet >= soxxReturn60d,
      }
    })

    const soxxRow = {
      name:    'SOXX Index',
      color:   '#3b82f6',
      price:   (t.SOXX?.price ?? 568).toFixed(2),
      m6:      fmtPct(soxxReturn60d),
      vs_soxx: '0.00',
      rs:      '1.00',
      up:      soxxReturn60d >= 0,
    }

    const hasConflict   = engine.conflict_type !== 'NO_CONFLICT'
    const marketRegime  = engine.internal_signal > 20 ? 'RISK ON' : engine.internal_signal < -20 ? 'RISK OFF' : 'NEUTRAL'
    const strategyScore = Math.round(engine.engine_score * 0.75 + confidence.confidence_score * 0.25)

    return NextResponse.json({
      as_of: data.as_of,
      kpis: {
        engine_score:     engine.engine_score,
        strategy_score:   strategyScore,
        stage:            CYCLE_STATE_LABEL[engine.state] ?? engine.state.toUpperCase(),
        cycle_position:   engine.engine_score,
        conflict_type:    engine.conflict_type,
        has_conflict:     hasConflict,
        breadth_pct:      breadthPct,
        breadth_label:    breadthLabel,
        advancing_pct:    breadthPct,
        declining_pct:    100 - breadthPct,
        market_regime:    marketRegime,
        soxx_price:       t.SOXX?.price ?? 0,
        soxx_return_60d:  soxxReturn60d,
        // v2 additions
        confidence_score: confidence.confidence_score,
        confidence_label: confidence.confidence_label,
        primary_driver:   engine.primary_driver,
        primary_risk:     engine.primary_risk,
        internal_signal:  engine.internal_signal,
        domain_signals: {
          price_trend:  domainScores.price_trend.signal,
          leadership:   domainScores.leadership.signal,
          breadth:      domainScores.breadth.signal,
          momentum:     domainScores.momentum.signal,
          macro:        domainScores.macro.signal,
          fundamentals: domainScores.fundamentals.signal,
          ai_infra:     domainScores.ai_infra.signal,
        },
        conflict_note:             explanation.conflicts[0] ?? '',
        leader_concentration_top5: metrics.find(m => m.id === 'leader_concentration_top5')?.normalized_value ?? null,
        equal_weight_vs_cap_spread: metrics.find(m => m.id === 'equal_weight_vs_cap_spread')?.signal_value   ?? null,
      },
      buckets:          [soxxRow, ...buckets],
      rs_table:         buckets.map(b => ({ name: b.name, rs: b.rs, vs: b.vs_soxx, up: b.up })),
      breadth_detail:     breadthDetail,
      momentum_detail:    momentumDetail,
      correlation_matrix: correlationMatrix,
      market_cap_weights:              weights?.market_cap_weights ?? null,
      bucket_weights:                  weights?.bucket_weights     ?? null,
      ai_infra_concentration_history:  aiConcHistory,
    })
  } catch (err) {
    console.error('[semiconductor-lens/route]', err)
    return NextResponse.json({ error: 'computation failed' }, { status: 500 })
  }
}
