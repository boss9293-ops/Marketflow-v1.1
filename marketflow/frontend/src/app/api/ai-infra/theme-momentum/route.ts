import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

import { INITIAL_AI_INFRASTRUCTURE_THEMES } from '@/lib/semiconductor/aiInfrastructureRadar'
import { AI_INFRA_THEME_WATCHLIST } from '@/lib/semiconductor/aiInfrastructureManualData'
import { AI_INFRA_BUCKETS } from '@/lib/semiconductor/aiInfraBucketMap'
import {
  buildThemeMomentumForPeriods,
  type AIInfraMomentumDataStatus,
  type AIInfraMomentumPeriod,
  type AIInfraThemeMomentum,
  type AIInfraThemeMomentumPeriods,
  type AIInfraTickerReturn,
} from '@/lib/semiconductor/aiInfrastructureMomentum'
import {
  computeBucketRS,
  rankBuckets,
  type AIInfraMultiPeriodReturn,
  type AIInfraBenchmarkReturns,
} from '@/lib/semiconductor/aiInfraBucketRS'
import { computeBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { RrgPathPayload } from '@/lib/semiconductor/rrgPathData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PricePoint = {
  date: string
  price: number
}

type ReadonlyDatabase = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => unknown[]
  }
  close: () => void
}

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'backend', 'data', 'marketflow.db'),
]

// D-4: load bottleneck RRG cache (optional — does not crash if missing)
const RRG_CACHE_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'),
  path.resolve(process.cwd(), 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'),
]

function loadRRGCache(): RrgPathPayload | null {
  for (const candidate of RRG_CACHE_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8')
        return JSON.parse(raw) as RrgPathPayload
      }
    } catch {
      // continue
    }
  }
  return null
}

// Delisted / legacy symbols — inactive in DB; never report as "missing active row"
const LEGACY_INACTIVE: ReadonlySet<string> = new Set(['CCMP'])

function uniqueRequiredTickers(): string[] {
  const tickers = new Set<string>()

  for (const item of AI_INFRA_THEME_WATCHLIST) {
    tickers.add(item.ticker.toUpperCase())
  }

  // D-2: add bucket symbols and all three benchmarks
  for (const bucket of AI_INFRA_BUCKETS) {
    for (const sym of bucket.symbols) tickers.add(sym.toUpperCase())
  }

  tickers.add('SOXX')
  tickers.add('QQQ')
  tickers.add('SPY')

  // Exclude inactive / delisted symbols from required-ticker set
  for (const sym of LEGACY_INACTIVE) tickers.delete(sym)

  return Array.from(tickers).sort()
}

function findLocalDbPath(): string | null {
  for (const candidate of DB_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }

  return null
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

// D-2: multi-period return for bucket RS (1M/3M/6M, not exposed to theme system)
function buildMultiPeriodReturn(ticker: string, rows: PricePoint[]): AIInfraMultiPeriodReturn {
  const one_month   = calculateReturnPct(rows, 21)
  const three_month = calculateReturnPct(rows, 63)
  const six_month   = calculateReturnPct(rows, 126)
  return {
    ticker,
    one_month,
    three_month,
    six_month,
    available: one_month !== null || three_month !== null || six_month !== null,
  }
}

function buildBenchmarkReturns(rowsByTicker: Map<string, PricePoint[]>): AIInfraBenchmarkReturns {
  const periodOf = (sym: string) => {
    const rows = rowsByTicker.get(sym) ?? []
    return {
      one_month:   calculateReturnPct(rows, 21),
      three_month: calculateReturnPct(rows, 63),
      six_month:   calculateReturnPct(rows, 126),
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

type AIInfraBenchmarkParam = 'SOXX' | 'QQQ' | 'SPY'

function parseBenchmark(param: string | null): AIInfraBenchmarkParam {
  if (param === 'QQQ' || param === 'SPY' || param === 'SOXX') return param
  return 'SOXX'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const benchmark = parseBenchmark(searchParams.get('benchmark'))

  const dbPath = findLocalDbPath()

  if (!dbPath) {
    return NextResponse.json(
      buildUnavailablePayload('Local marketflow.db was not found. Theme momentum remains unavailable.'),
    )
  }

  try {
    const { default: Database } = await import('better-sqlite3')
    const db = new Database(dbPath, { readonly: true, fileMustExist: true }) as ReadonlyDatabase

    try {
      const requiredTickers = uniqueRequiredTickers()
      const rowsByTicker = new Map<string, PricePoint[]>()

      for (const ticker of requiredTickers) {
        rowsByTicker.set(ticker, readTickerRows(db, ticker))
      }

      const tickerReturns = requiredTickers.map((ticker) =>
        buildTickerReturn(ticker, rowsByTicker.get(ticker) ?? []),
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
        const rows = rowsByTicker.get(ticker)
        return !rows || rows.length === 0
      })
      const asOf =
        rowsByTicker.get('SOXX')?.[0]?.date ??
        Array.from(rowsByTicker.values())
          .flat()
          .map((row) => row.date)
          .sort()
          .at(-1) ??
        null

      // ── D-2: Bucket Relative Strength ─────────────────────────────────────
      const multiPeriodMap = new Map<string, AIInfraMultiPeriodReturn>(
        requiredTickers.map(ticker => [
          ticker,
          buildMultiPeriodReturn(ticker, rowsByTicker.get(ticker) ?? []),
        ]),
      )
      const benchmarks = buildBenchmarkReturns(rowsByTicker)

      const rawBuckets = AI_INFRA_BUCKETS.map(bucket =>
        computeBucketRS({
          bucket_id:         bucket.bucket_id,
          display_name:      bucket.display_name,
          stage:             bucket.stage,
          default_benchmark: bucket.default_benchmark,
          symbols:           bucket.symbols,
          data_quality:      bucket.data_quality,
          tickerMap:         multiPeriodMap,
          benchmarks,
        }),
      )
      const buckets = rankBuckets(rawBuckets)

      const dataNotes: string[] = []
      const partialBuckets = buckets.filter(b => b.coverage.data_quality === 'PARTIAL')
      const insufficientBuckets = buckets.filter(b => b.coverage.data_quality === 'DATA_INSUFFICIENT')
      if (partialBuckets.length > 0)
        dataNotes.push(`Partial coverage: ${partialBuckets.map(b => b.display_name).join(', ')}.`)
      if (insufficientBuckets.length > 0)
        dataNotes.push(`No price data: ${insufficientBuckets.map(b => b.display_name).join(', ')}.`)
      // Only report truly missing active tickers (legacy/inactive already excluded from required set)
      const missingActive = missingTickers.filter(t => !LEGACY_INACTIVE.has(t))
      if (missingActive.length > 0)
        dataNotes.push(`Missing DB rows: ${missingActive.slice(0, 8).join(', ')}${missingActive.length > 8 ? '...' : ''}.`)
      else if (missingTickers.length === 0)
        dataNotes.push('Active coverage: all required DB rows present.')
      // ──────────────────────────────────────────────────────────────────────

      // ── D-4: State Label Engine ────────────────────────────────────────────
      const rrgCache = loadRRGCache()
      const rrgSeriesMap = new Map(
        (rrgCache?.series ?? []).map(s => [s.id, s])
      )
      const bucket_states = buckets.map(b =>
        computeBucketState(b, rrgSeriesMap.get(b.bucket_id) ?? null, benchmark)
      )
      dataNotes.push(`State labels are recalculated using the ${benchmark} benchmark. Rule-based and price/RRG-driven. Earnings confirmation not included.`)
      // ──────────────────────────────────────────────────────────────────────

      return NextResponse.json({
        source: 'local_price_db:ohlcv_daily',
        asOf,
        benchmark: 'SOXX',           // legacy field — default benchmark (unchanged for backward compat)
        selected_benchmark: benchmark, // D-7: reflects the requested benchmark
        status: aggregateStatus(allPeriodRows),
        themes,
        // D-2 extensions (additive — backward compatible)
        buckets,
        benchmarks,
        // D-4 extension (additive — backward compatible)
        bucket_states,
        generated_at: new Date().toISOString(),
        data_notes: dataNotes,
        warnings: missingTickers.length > 0
          ? [`Missing local price rows for: ${missingTickers.join(', ')}.`]
          : [],
      })
    } finally {
      db.close()
    }
  } catch {
    return NextResponse.json(
      buildUnavailablePayload('Local price DB could not be read. Theme momentum remains unavailable.'),
    )
  }
}
