// Semiconductor Lens API ??v2 engine pipeline
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

export const dynamic = 'force-dynamic'

const CACHE_PATH          = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json')
const BREADTH_CACHE_PATH  = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_breadth.json')
const MOMENTUM_CACHE_PATH     = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_momentum.json')
const CORRELATION_CACHE_PATH  = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_correlation.json')
const WEIGHTS_CACHE_PATH      = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_weights.json')
const AI_CONC_CACHE_PATH      = path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_ai_concentration.json')

const REQUIRED_CORE_TICKERS = ['SOXX'] as const
const SELECTED_UI_TICKERS = [
  'SOXX',
  'NVDA',
  'AMD',
  'AVGO',
  'MU',
  'TSM',
  'ASML',
  'AMAT',
  'LRCX',
  'KLAC',
] as const

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

type LoadedMarketData = {
  data: MarketDataInput | null
  source: 'cache' | 'unavailable'
  warnings: string[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function loadData(): LoadedMarketData {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as MarketDataInput
      return {
        data: cached,
        source: 'cache',
        warnings: [],
      }
    }
  } catch {
    return {
      data: null,
      source: 'unavailable',
      warnings: ['Semiconductor market data cache could not be parsed.'],
    }
  }

  return {
    data: null,
    source: 'unavailable',
    warnings: ['Semiconductor market data cache is not connected.'],
  }
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
    const loadedData        = loadData()
    if (!loadedData.data) {
      return NextResponse.json(
        {
          status: 'unavailable',
          error: 'Semiconductor Lens market data is unavailable.',
          warnings: loadedData.warnings,
        },
        { status: 503 },
      )
    }

    const data              = loadedData.data
    const missingCoreTickers = REQUIRED_CORE_TICKERS.filter((ticker) =>
      !isFiniteNumber(data.tickers?.[ticker]?.price) ||
      !isFiniteNumber(data.tickers?.[ticker]?.return_60d)
    )

    if (missingCoreTickers.length > 0) {
      return NextResponse.json(
        {
          status: 'unavailable',
          error: 'Semiconductor Lens core market data is incomplete.',
          missingTickers: missingCoreTickers,
        },
        { status: 503 },
      )
    }

    const missingSelectedTickers = SELECTED_UI_TICKERS.filter((ticker) =>
      !isFiniteNumber(data.tickers?.[ticker]?.price) ||
      !isFiniteNumber(data.tickers?.[ticker]?.return_60d)
    )
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
    const soxxReturn60d = t.SOXX.return_60d

    // Breadth from normalized metrics
    const breadthMetric = metrics.find(m => m.id === 'breadth_pct_above_20ma')
    const breadthPct    = Math.round(breadthMetric?.normalized_value ?? 50)
    const breadthLabel  = breadthPct >= 65 ? 'BULLISH' : breadthPct >= 45 ? 'NEUTRAL' : 'BEARISH'

    // Bucket performance
    const buckets = BUCKET_DEFS.map(b => {
      const returns  = b.tickers
        .map(tk => t[tk]?.return_60d)
        .filter(isFiniteNumber)
      const avgRet   = returns.length > 0 ? avg(returns) : null
      const relRet   = avgRet !== null ? avgRet - soxxReturn60d : null
      const prices   = b.tickers
        .map(tk => t[tk]?.price)
        .filter((price): price is number => isFiniteNumber(price) && price > 0)
      const avgPrice = prices.length > 0 ? avg(prices) : null
      return {
        name:    b.name,
        color:   b.color,
        price:   avgPrice !== null ? avgPrice.toFixed(2) : 'Unavailable',
        m6:      avgRet !== null ? fmtPct(avgRet) : 'Unavailable',
        vs_soxx: relRet !== null ? `${relRet >= 0 ? '+' : ''}${relRet.toFixed(2)}` : 'Unavailable',
        rs:      avgRet !== null && soxxReturn60d !== 0 ? (1 + avgRet / soxxReturn60d).toFixed(2) : 'Unavailable',
        up:      avgRet !== null && avgRet >= soxxReturn60d,
      }
    })
    const soxxRow = {
      name:    'SOXX Index',
      color:   '#3b82f6',
      price:   t.SOXX.price.toFixed(2),
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
        soxx_price:       t.SOXX.price,
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
      _meta: {
        source: loadedData.source,
        warnings: [
          ...loadedData.warnings,
          ...(missingSelectedTickers.length > 0
            ? [`Missing selected ticker market data: ${missingSelectedTickers.join(', ')}.`]
            : []),
          ...(!weights?.market_cap_weights
            ? ['Holding-level return weights cache is unavailable; contribution snapshot should remain unavailable.']
            : []),
        ],
      },
    })
  } catch (err) {
    console.error('[semiconductor-lens/route]', err)
    return NextResponse.json({ error: 'computation failed' }, { status: 500 })
  }
}
