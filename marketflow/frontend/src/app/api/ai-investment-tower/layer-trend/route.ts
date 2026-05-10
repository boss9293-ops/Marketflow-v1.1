// AI Investment Tower 선택 레이어 바스켓 트렌드 API — 정규화 지수 반환
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { AI_INVESTMENT_TOWER_LAYERS } from '@/lib/ai-investment-tower/aiInvestmentTowerLayers'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '1M' | '3M' | '6M' | '1Y'

const RANGE_DAYS: Record<Range, number> = {
  '1M': 31, '3M': 92, '6M': 183, '1Y': 366,
}

type ReadonlyDatabase = {
  prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] }
  close: () => void
}

type OhlcvRow = { symbol: string; date: string; close: number }

export type LayerTrendResponse = {
  layerId:     string
  label:       string
  koreanLabel: string
  range:       Range
  basket: {
    name:   string
    points: { date: string; value: number }[]
  }
  benchmark: {
    symbol: string
    points: { date: string; value: number }[]
  } | null
  components: { ticker: string; returnPct: number | null; valid: boolean }[]
  coveragePct: number
}

// ── DB helpers ────────────────────────────────────────────────────────────────

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'backend', 'data', 'marketflow.db'),
]

function dateStrDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function queryPrices(
  db: ReadonlyDatabase,
  symbols: string[],
  startDate: string,
): Map<string, { date: string; close: number }[]> {
  if (symbols.length === 0) return new Map()
  const ph   = symbols.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT symbol, date, close
    FROM ohlcv_daily
    WHERE symbol IN (${ph}) AND date >= ?
    ORDER BY symbol, date
  `).all(...symbols, startDate) as OhlcvRow[]

  const map = new Map<string, { date: string; close: number }[]>()
  for (const row of rows) {
    if (!map.has(row.symbol)) map.set(row.symbol, [])
    map.get(row.symbol)!.push({ date: row.date, close: row.close })
  }
  return map
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalizeSeries(
  series: { date: string; close: number }[],
): Map<string, number> {
  if (series.length === 0) return new Map()
  const base = series[0].close
  if (!base || base <= 0) return new Map()
  const result = new Map<string, number>()
  for (const { date, close } of series) {
    result.set(date, Math.round((close / base) * 10000) / 100)
  }
  return result
}

function buildBasketIndex(
  priceMap: Map<string, { date: string; close: number }[]>,
  symbols: string[],
): { points: { date: string; value: number }[]; validCount: number } {
  const normalized = new Map<string, Map<string, number>>()
  for (const sym of symbols) {
    const series = priceMap.get(sym)
    if (series && series.length >= 2) {
      const ns = normalizeSeries(series)
      if (ns.size > 0) normalized.set(sym, ns)
    }
  }

  if (normalized.size === 0) return { points: [], validCount: 0 }

  // Collect all dates across all valid symbols
  const allDates = new Set<string>()
  for (const ns of normalized.values()) {
    for (const date of ns.keys()) allDates.add(date)
  }

  const sortedDates = Array.from(allDates).sort()
  const points: { date: string; value: number }[] = []

  for (const date of sortedDates) {
    const vals: number[] = []
    for (const ns of normalized.values()) {
      const v = ns.get(date)
      if (v !== undefined) vals.push(v)
    }
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      points.push({ date, value: Math.round(avg * 100) / 100 })
    }
  }

  return { points, validCount: normalized.size }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const layerId   = (searchParams.get('layerId') ?? '').trim()
  const rangeRaw  = (searchParams.get('range') ?? '3M').toUpperCase()
  const range     = (['1M', '3M', '6M', '1Y'].includes(rangeRaw) ? rangeRaw : '3M') as Range

  const layer = AI_INVESTMENT_TOWER_LAYERS.find(l => l.id === layerId)
  if (!layer) {
    return NextResponse.json({ error: `Unknown layerId: ${layerId}` }, { status: 400 })
  }

  const startDate = dateStrDaysAgo(RANGE_DAYS[range])

  // Open DB
  const { default: Database } = await import('better-sqlite3')
  let dbPath: string | null = null
  for (const candidate of DB_CANDIDATES) {
    try {
      const probe = new Database(candidate, { readonly: true, fileMustExist: true })
      probe.close()
      dbPath = candidate
      break
    } catch { /* try next */ }
  }

  if (!dbPath) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true }) as ReadonlyDatabase

  try {
    // Gather all symbols needed
    const bmPrimary   = layer.benchmark           // 'SPY' | 'QQQ' | 'SOXX' | 'SMH'
    const bmFallbacks = [bmPrimary, 'QQQ', 'SPY'].filter((v, i, a) => a.indexOf(v) === i)
    const allNeeded   = [...new Set([...layer.basketSymbols, ...bmFallbacks])]

    const priceMap = queryPrices(db, allNeeded, startDate)

    // Basket
    const { points: basketPoints, validCount } = buildBasketIndex(priceMap, layer.basketSymbols)
    const coveragePct = validCount / Math.max(layer.basketSymbols.length, 1)

    // Benchmark — first available in fallback chain
    let benchmarkPoints: { date: string; value: number }[] | null = null
    let benchmarkSymbol: string = bmPrimary
    for (const sym of bmFallbacks) {
      const series = priceMap.get(sym)
      if (series && series.length >= 5) {
        const ns = normalizeSeries(series)
        benchmarkPoints = Array.from(ns.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }))
        benchmarkSymbol = sym
        break
      }
    }

    // Per-component return
    const components = layer.basketSymbols.map(ticker => {
      const series = priceMap.get(ticker)
      if (!series || series.length < 2) return { ticker, returnPct: null, valid: false }
      const first = series[0].close
      const last  = series[series.length - 1].close
      return {
        ticker,
        returnPct: Math.round(((last / first - 1) * 100) * 10) / 10,
        valid: true,
      }
    })

    const response: LayerTrendResponse = {
      layerId:     layer.id,
      label:       layer.label,
      koreanLabel: layer.koreanLabel,
      range,
      basket: { name: layer.koreanLabel, points: basketPoints },
      benchmark: benchmarkPoints && benchmarkPoints.length > 0
        ? { symbol: benchmarkSymbol, points: benchmarkPoints }
        : null,
      components,
      coveragePct,
    }

    return NextResponse.json(response)
  } finally {
    db.close()
  }
}
