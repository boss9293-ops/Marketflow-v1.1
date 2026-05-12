import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

import { backendApiUrl } from '@/lib/backendApi'
import { computeBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { computeInfraToSoxxTranslation } from '@/lib/ai-infra/infraToSoxxTranslation'
import { computeInfraHistoricalAnalog } from '@/lib/ai-infra/infraHistoricalAnalogs'
import { buildInfraEducationalNarrative } from '@/lib/ai-infra/infraEducationalNarrative'
import type { SemiconductorCyclePhase, SemiconductorSOXXJudgment, SemiconductorSOXLEnvironment } from '@/lib/ai-infra/infrastructureCycleContext'
import { AI_INFRA_COMPANY_PURITY } from '@/lib/ai-infra/aiInfraCompanyPurity'
import { computeAllBucketEarningsConfirmation } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { AI_INFRA_BUCKETS } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketId, AIInfraStage, AIInfraDataQuality } from '@/lib/semiconductor/aiInfraBucketMap'
import {
  computeBucketRS,
  rankBuckets,
  type AIInfraBenchmarkReturns,
  type AIInfraBucketBreadth,
  type BreadthLabel,
  type AIInfraMultiPeriodReturn,
} from '@/lib/semiconductor/aiInfraBucketRS'
import {
  INITIAL_AI_INFRASTRUCTURE_THEMES,
} from '@/lib/semiconductor/aiInfrastructureRadar'
import { AI_INFRA_THEME_WATCHLIST } from '@/lib/semiconductor/aiInfrastructureManualData'
import {
  buildThemeMomentumForPeriods,
  type AIInfraMomentumDataStatus,
  type AIInfraMomentumPeriod,
  type AIInfraThemeMomentum,
  type AIInfraThemeMomentumPeriods,
  type AIInfraTickerReturn,
} from '@/lib/semiconductor/aiInfrastructureMomentum'
import type { RrgPathPayload } from '@/lib/semiconductor/rrgPathData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PricePoint = {
  date: string
  price: number
}

type BackendChartPayload = {
  candles?: Array<{
    date?: unknown
    close?: unknown
    adj_close?: unknown
  }>
}

type ReadonlyDatabase = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => unknown[]
  }
  close: () => void
}

type AIInfraBenchmarkParam = 'SOXX' | 'QQQ' | 'SPY'

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'backend', 'data', 'marketflow.db'),
]

const RRG_CACHE_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'),
  path.resolve(process.cwd(), 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'),
]

const LEGACY_INACTIVE: ReadonlySet<string> = new Set(['CCMP'])
const REMOTE_CHART_CONCURRENCY = 8
const REMOTE_CHART_TIMEOUT_MS = 7000

// ── Tower virtual bucket configs (5 new layers without existing 13-bucket mapping) ──

type TowerVirtualBucketConfig = {
  bucket_id:         string
  display_name:      string
  stage:             AIInfraStage
  default_benchmark: 'SOXX' | 'QQQ' | 'SPY'
  symbols:           string[]
  data_quality:      AIInfraDataQuality
}

const TOWER_VIRTUAL_BUCKETS: TowerVirtualBucketConfig[] = [
  {
    bucket_id:         'STORAGE_DATA',
    display_name:      'Storage & Data',
    stage:             'STAGE_4_EXTERNAL_INFRA',
    default_benchmark: 'QQQ',
    symbols:           ['PSTG', 'NTAP', 'WDC', 'STX', 'MU'],
    data_quality:      'PARTIAL',
  },
  {
    bucket_id:         'CLOUD_HYPERSCALERS',
    display_name:      'Cloud / Hyperscalers',
    stage:             'STAGE_4_EXTERNAL_INFRA',
    default_benchmark: 'QQQ',
    symbols:           ['MSFT', 'GOOGL', 'AMZN', 'META', 'ORCL'],
    data_quality:      'REAL',
  },
  {
    bucket_id:         'AI_SOFTWARE',
    display_name:      'AI Software',
    stage:             'STAGE_4_EXTERNAL_INFRA',
    default_benchmark: 'QQQ',
    symbols:           ['PLTR', 'CRM', 'DDOG', 'NOW', 'SNOW', 'MDB'],
    data_quality:      'PARTIAL',
  },
  {
    bucket_id:         'ROBOTICS_PHYSICAL_AI',
    display_name:      'Robotics / Physical AI',
    stage:             'STAGE_5_PHYSICAL_RESOURCE',
    default_benchmark: 'SPY',
    symbols:           ['TSLA', 'ISRG', 'ROK', 'TER', 'ABB'],
    data_quality:      'PARTIAL',
  },
  {
    bucket_id:         'CYBERSECURITY',
    display_name:      'Cybersecurity',
    stage:             'STAGE_4_EXTERNAL_INFRA',
    default_benchmark: 'QQQ',
    symbols:           ['CRWD', 'PANW', 'ZS', 'FTNT', 'NET'],
    data_quality:      'PARTIAL',
  },
]

function parseBenchmark(param: string | null): AIInfraBenchmarkParam {
  if (param === 'QQQ' || param === 'SPY' || param === 'SOXX') return param
  return 'SOXX'
}

function parseCyclePhase(param: string | null): SemiconductorCyclePhase | null {
  const VALID: ReadonlySet<string> = new Set(['EARLY_EXPANSION', 'MID_EXPANSION', 'LATE_EXPANSION', 'DISTRIBUTION', 'DOWNTURN', 'RECOVERY'])
  return param && VALID.has(param) ? (param as SemiconductorCyclePhase) : null
}

function parseCycleSOXXJudgment(param: string | null): SemiconductorSOXXJudgment | null {
  const VALID: ReadonlySet<string> = new Set(['SUPPORTIVE', 'NEUTRAL', 'FRAGILE', 'RISK_ELEVATED'])
  return param && VALID.has(param) ? (param as SemiconductorSOXXJudgment) : null
}

function parseCycleSOXLEnvironment(param: string | null): SemiconductorSOXLEnvironment | null {
  const VALID: ReadonlySet<string> = new Set(['LEVERAGE_SENSITIVE', 'CONFIRMATION_NEEDED', 'TACTICAL_ONLY', 'HIGH_VOLATILITY'])
  return param && VALID.has(param) ? (param as SemiconductorSOXLEnvironment) : null
}

function findLocalDbPath(): string | null {
  for (const candidate of DB_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function loadRRGCache(): RrgPathPayload | null {
  for (const candidate of RRG_CACHE_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf-8')) as RrgPathPayload
      }
    } catch {
      // Continue to next candidate.
    }
  }
  return null
}

function uniqueRequiredTickers(): string[] {
  const tickers = new Set<string>()
  for (const item of AI_INFRA_THEME_WATCHLIST) tickers.add(item.ticker.toUpperCase())
  for (const bucket of AI_INFRA_BUCKETS) {
    for (const symbol of bucket.symbols) tickers.add(symbol.toUpperCase())
  }
  for (const bucket of TOWER_VIRTUAL_BUCKETS) {
    for (const symbol of bucket.symbols) tickers.add(symbol.toUpperCase())
  }
  tickers.add('SOXX')
  tickers.add('QQQ')
  tickers.add('SPY')
  for (const symbol of LEGACY_INACTIVE) tickers.delete(symbol)
  return Array.from(tickers).sort()
}

function calculateReturnPct(rows: PricePoint[], offset: number): number | null {
  const latest = rows[0]
  const reference = rows[offset]
  if (!latest || !reference) return null
  if (!Number.isFinite(latest.price) || !Number.isFinite(reference.price)) return null
  if (reference.price <= 0) return null
  return ((latest.price / reference.price) - 1) * 100
}

function readTickerRows(db: ReadonlyDatabase, ticker: string): PricePoint[] {
  const rows = db
    .prepare(`
      SELECT
        date,
        CASE
          WHEN adj_close IS NOT NULL AND adj_close > 0 THEN adj_close
          ELSE close
        END AS price
      FROM ohlcv_daily
      WHERE symbol = ?
        AND close IS NOT NULL
      ORDER BY date DESC
      LIMIT 135
    `)
    .all(ticker) as Array<{ date?: unknown; price?: unknown }>

  return rows
    .map((row) => ({
      date: typeof row.date === 'string' ? row.date : '',
      price: typeof row.price === 'number' ? row.price : Number(row.price),
    }))
    .filter((row) => row.date && Number.isFinite(row.price) && row.price > 0)
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function normalizeBackendRows(payload: BackendChartPayload | null | undefined): PricePoint[] {
  if (!payload || !Array.isArray(payload.candles)) return []
  const rows = payload.candles
    .map((row) => ({
      date: typeof row?.date === 'string' ? row.date : '',
      price:
        typeof row?.adj_close === 'number'
          ? row.adj_close
          : typeof row?.close === 'number'
            ? row.close
            : Number(row?.adj_close ?? row?.close),
    }))
    .filter((row) => row.date && Number.isFinite(row.price) && row.price > 0)
  rows.sort((a, b) => b.date.localeCompare(a.date))
  return rows.slice(0, 135)
}

async function fetchBackendTickerRows(ticker: string): Promise<PricePoint[]> {
  const url = backendApiUrl(`/api/chart/${encodeURIComponent(ticker)}`)
  const response = await fetchWithTimeout(url, REMOTE_CHART_TIMEOUT_MS)
  if (!response || !response.ok) return []
  try {
    return normalizeBackendRows((await response.json()) as BackendChartPayload)
  } catch {
    return []
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function buildTickerReturn(ticker: string, rows: PricePoint[]): AIInfraTickerReturn {
  const return1D = calculateReturnPct(rows, 1)
  const return5D = calculateReturnPct(rows, 5)
  const return1M = calculateReturnPct(rows, 21)
  const hasAnyReturn = [return1D, return5D, return1M].some(
    (value) => typeof value === 'number' && Number.isFinite(value),
  )
  return {
    ticker,
    return1D,
    return5D,
    return1M,
    dataStatus: hasAnyReturn ? 'available' : 'unavailable',
  }
}

function buildMultiPeriodReturn(ticker: string, rows: PricePoint[]): AIInfraMultiPeriodReturn {
  const five_day    = calculateReturnPct(rows, 5)
  const one_month   = calculateReturnPct(rows, 21)
  const three_month = calculateReturnPct(rows, 63)
  const six_month   = calculateReturnPct(rows, 126)
  return {
    ticker,
    five_day,
    one_month,
    three_month,
    six_month,
    available: one_month !== null || three_month !== null || six_month !== null,
  }
}

function computeSymbolMA50Above(rows: PricePoint[]): boolean | null {
  if (rows.length < 52) return null
  const latest = rows[0]?.price
  if (!latest || !Number.isFinite(latest) || latest <= 0) return null
  const ma50 = rows.slice(1, 51).reduce((s, r) => s + r.price, 0) / 50
  return ma50 > 0 ? latest > ma50 : null
}

function computeBucketBreadth(
  symbols: string[],
  rowsByTicker: Map<string, PricePoint[]>,
): AIInfraBucketBreadth {
  const results = symbols
    .map(sym => computeSymbolMA50Above(rowsByTicker.get(sym) ?? []))
    .filter((r): r is boolean => r !== null)

  const valid_count      = results.length
  const above_ma50_count = results.filter(Boolean).length
  const breadth_ma50_pct = valid_count > 0 ? above_ma50_count / valid_count : 0

  let label: BreadthLabel
  if (valid_count < 2)               label = 'UNKNOWN'
  else if (breadth_ma50_pct >= 0.70) label = 'BROAD'
  else if (breadth_ma50_pct >= 0.50) label = 'IMPROVING'
  else if (breadth_ma50_pct >= 0.30) label = 'NARROW'
  else                               label = 'WEAK'

  return { valid_count, above_ma50_count, breadth_ma50_pct, label }
}

function buildBenchmarkReturns(rowsByTicker: Map<string, PricePoint[]>): AIInfraBenchmarkReturns {
  const periodOf = (symbol: string) => {
    const rows = rowsByTicker.get(symbol) ?? []
    return {
      one_month: calculateReturnPct(rows, 21),
      three_month: calculateReturnPct(rows, 63),
      six_month: calculateReturnPct(rows, 126),
    }
  }
  return { SOXX: periodOf('SOXX'), QQQ: periodOf('QQQ'), SPY: periodOf('SPY') }
}

function toPeriodMap(momentumRows: AIInfraThemeMomentum[]): AIInfraThemeMomentumPeriods {
  return momentumRows.reduce((acc, row) => {
    acc[row.period] = row
    return acc
  }, {} as Record<AIInfraMomentumPeriod, AIInfraThemeMomentum>) as AIInfraThemeMomentumPeriods
}

function aggregateStatus(rows: AIInfraThemeMomentum[]): AIInfraMomentumDataStatus {
  if (rows.length === 0) return 'unavailable'
  const hasAnyData = rows.some((row) => row.availableTickerCount > 0)
  if (!hasAnyData) return 'unavailable'
  return rows.every((row) => row.dataStatus === 'available') ? 'available' : 'partial'
}

function buildUnavailablePayload(warning: string) {
  const tickerReturns: AIInfraTickerReturn[] = []
  const themes = INITIAL_AI_INFRASTRUCTURE_THEMES.map((theme) => ({
    themeId: theme.id,
    themeName: theme.name,
    periods: toPeriodMap(
      buildThemeMomentumForPeriods({
        themeId: theme.id,
        themeName: theme.name,
        tickerReturns,
        soxxReturns: {},
      }),
    ),
  }))

  return {
    source: 'not_connected',
    asOf: null,
    benchmark: 'SOXX',
    status: 'unavailable' as AIInfraMomentumDataStatus,
    themes,
    warnings: [warning],
  }
}

function buildResponseFromRows(params: {
  rowsByTicker:            Map<string, PricePoint[]>
  benchmark:               AIInfraBenchmarkParam
  source:                  string
  sourceNote?:             string
  cycle_phase?:            SemiconductorCyclePhase | null
  cycle_soxx_judgment?:    SemiconductorSOXXJudgment | null
  cycle_soxl_environment?: SemiconductorSOXLEnvironment | null
}) {
  const requiredTickers = uniqueRequiredTickers()
  const tickerReturns = requiredTickers.map((ticker) =>
    buildTickerReturn(ticker, params.rowsByTicker.get(ticker) ?? []),
  )
  const soxxReturn = tickerReturns.find((row) => row.ticker === 'SOXX')
  const soxxReturns = {
    return1D: soxxReturn?.return1D ?? null,
    return5D: soxxReturn?.return5D ?? null,
    return1M: soxxReturn?.return1M ?? null,
  }

  const themes = INITIAL_AI_INFRASTRUCTURE_THEMES.map((theme) => ({
    themeId: theme.id,
    themeName: theme.name,
    periods: toPeriodMap(
      buildThemeMomentumForPeriods({
        themeId: theme.id,
        themeName: theme.name,
        tickerReturns,
        soxxReturns,
      }),
    ),
  }))

  const allPeriodRows = themes.flatMap((theme) => Object.values(theme.periods))
  const missingTickers = requiredTickers.filter((ticker) => {
    const rows = params.rowsByTicker.get(ticker)
    return !rows || rows.length === 0
  })

  const asOf =
    params.rowsByTicker.get('SOXX')?.[0]?.date ??
    Array.from(params.rowsByTicker.values())
      .flat()
      .map((row) => row.date)
      .sort()
      .at(-1) ??
    null

  const multiPeriodMap = new Map<string, AIInfraMultiPeriodReturn>(
    requiredTickers.map((ticker) => [
      ticker,
      buildMultiPeriodReturn(ticker, params.rowsByTicker.get(ticker) ?? []),
    ]),
  )
  const benchmarks = buildBenchmarkReturns(params.rowsByTicker)
  const rawBuckets = AI_INFRA_BUCKETS.map((bucket) => {
    const rs = computeBucketRS({
      bucket_id:         bucket.bucket_id,
      display_name:      bucket.display_name,
      stage:             bucket.stage,
      default_benchmark: bucket.default_benchmark,
      symbols:           bucket.symbols,
      data_quality:      bucket.data_quality,
      tickerMap:         multiPeriodMap,
      benchmarks,
    })
    return { ...rs, breadth: computeBucketBreadth(bucket.symbols, params.rowsByTicker) }
  })
  const buckets = rankBuckets(rawBuckets)

  const dataNotes: string[] = []
  if (params.sourceNote) dataNotes.push(params.sourceNote)

  const partialBuckets = buckets.filter((bucket) => bucket.coverage.data_quality === 'PARTIAL')
  const insufficientBuckets = buckets.filter((bucket) => bucket.coverage.data_quality === 'DATA_INSUFFICIENT')
  if (partialBuckets.length > 0) {
    dataNotes.push(`Partial coverage: ${partialBuckets.map((bucket) => bucket.display_name).join(', ')}.`)
  }
  if (insufficientBuckets.length > 0) {
    dataNotes.push(`No price data: ${insufficientBuckets.map((bucket) => bucket.display_name).join(', ')}.`)
  }

  const missingActive = missingTickers.filter((ticker) => !LEGACY_INACTIVE.has(ticker))
  if (missingActive.length > 0) {
    dataNotes.push(
      `Missing rows: ${missingActive.slice(0, 8).join(', ')}${missingActive.length > 8 ? '...' : ''}.`,
    )
  } else if (missingTickers.length === 0) {
    dataNotes.push('Active coverage: all required rows present.')
  }

  const rrgCache = loadRRGCache()
  const rrgSeriesMap = new Map((rrgCache?.series ?? []).map((series) => [series.id, series]))
  const bucket_states = buckets.map((bucket) =>
    computeBucketState(bucket, rrgSeriesMap.get(bucket.bucket_id) ?? null, params.benchmark),
  )
  const infra_to_soxx_translation = computeInfraToSoxxTranslation({
    bucket_states,
    selected_benchmark:      params.benchmark,
    cycle_phase:             params.cycle_phase ?? undefined,
    cycle_soxx_judgment:     params.cycle_soxx_judgment ?? undefined,
    cycle_soxl_environment:  params.cycle_soxl_environment ?? undefined,
  })
  const infra_historical_analog = computeInfraHistoricalAnalog({
    bucket_states,
    infra_translation:  infra_to_soxx_translation,
    cycle_phase:        params.cycle_phase ?? undefined,
    selected_benchmark: params.benchmark,
  })
  const infra_educational_narrative = buildInfraEducationalNarrative({
    infra_translation:       infra_to_soxx_translation,
    infra_historical_analog,
    cycle_phase:             params.cycle_phase ?? undefined,
    selected_benchmark:      params.benchmark,
  })
  dataNotes.push(
    `State labels are recalculated using the ${params.benchmark} benchmark. Rule-based and price/RRG-driven. Earnings confirmation not included.`,
  )

  // Tower virtual buckets — basket-based calc for layers without existing 13-bucket source
  const rawTowerBuckets = TOWER_VIRTUAL_BUCKETS.map((cfg) => {
    const rs = computeBucketRS({
      bucket_id:         cfg.bucket_id as AIInfraBucketId,
      display_name:      cfg.display_name,
      stage:             cfg.stage,
      default_benchmark: cfg.default_benchmark,
      symbols:           cfg.symbols,
      data_quality:      cfg.data_quality,
      tickerMap:         multiPeriodMap,
      benchmarks,
    })
    return { ...rs, breadth: computeBucketBreadth(cfg.symbols, params.rowsByTicker) }
  })
  const tower_buckets = rankBuckets(rawTowerBuckets)
  const tower_states = tower_buckets.map((bucket) =>
    computeBucketState(bucket, null, params.benchmark),
  )

  const earnings_confirmation = computeAllBucketEarningsConfirmation()

  return {
    source: params.source,
    asOf,
    benchmark: params.benchmark,
    selected_benchmark: params.benchmark,
    status: aggregateStatus(allPeriodRows),
    themes,
    buckets,
    benchmarks,
    bucket_states,
    infra_to_soxx_translation,
    infra_historical_analog,
    infra_educational_narrative,
    tower_buckets,
    tower_states,
    company_purity: AI_INFRA_COMPANY_PURITY,
    earnings_confirmation,
    generated_at: new Date().toISOString(),
    data_notes: dataNotes,
    warnings: missingTickers.length > 0
      ? [`Missing rows for: ${missingTickers.join(', ')}.`]
      : [],
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const benchmark              = parseBenchmark(searchParams.get('benchmark'))
  const cycle_phase            = parseCyclePhase(searchParams.get('cycle_phase'))
  const cycle_soxx_judgment    = parseCycleSOXXJudgment(searchParams.get('cycle_soxx_judgment'))
  const cycle_soxl_environment = parseCycleSOXLEnvironment(searchParams.get('cycle_soxl_environment'))

  const dbPath = findLocalDbPath()
  if (dbPath) {
    try {
      const { default: Database } = await import('better-sqlite3')
      const db = new Database(dbPath, { readonly: true, fileMustExist: true }) as ReadonlyDatabase
      try {
        const requiredTickers = uniqueRequiredTickers()
        const rowsByTicker = new Map<string, PricePoint[]>()
        for (const ticker of requiredTickers) {
          rowsByTicker.set(ticker, readTickerRows(db, ticker))
        }
        return NextResponse.json(
          buildResponseFromRows({
            rowsByTicker,
            benchmark,
            source: 'local_price_db:ohlcv_daily',
            cycle_phase,
            cycle_soxx_judgment,
            cycle_soxl_environment,
          }),
        )
      } finally {
        db.close()
      }
    } catch {
      // Continue to remote fallback.
    }
  }

  try {
    const requiredTickers = uniqueRequiredTickers()
    const rowsList = await mapWithConcurrency(
      requiredTickers,
      REMOTE_CHART_CONCURRENCY,
      fetchBackendTickerRows,
    )
    const rowsByTicker = new Map<string, PricePoint[]>()
    for (let i = 0; i < requiredTickers.length; i += 1) {
      rowsByTicker.set(requiredTickers[i], rowsList[i] ?? [])
    }

    const hasAnyRows = rowsList.some((rows) => rows.length > 0)
    if (!hasAnyRows) {
      return NextResponse.json(
        buildUnavailablePayload('Remote price source is unavailable. Theme momentum remains unavailable.'),
      )
    }

    return NextResponse.json(
      buildResponseFromRows({
        rowsByTicker,
        benchmark,
        source: 'backend_api:/api/chart/<symbol>',
        sourceNote:
          'Remote chart API fallback was used because local DB/cache is unavailable in this runtime.',
        cycle_phase,
        cycle_soxx_judgment,
        cycle_soxl_environment,
      }),
    )
  } catch {
    return NextResponse.json(
      buildUnavailablePayload('Price source could not be loaded. Theme momentum remains unavailable.'),
    )
  }
}
