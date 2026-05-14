// 13버킷 대표 종목 SOXX 대비 RS 90일 시계열 빌더 — Card 2 (PULSE 탭)
import path from 'path'

export type SectorTrend = 'acceleration' | 'emerging' | 'neutral' | 'fading' | 'weakening'

export interface BucketRSPoint {
  date:       string
  rs_vs_soxx: number  // pp (SOXX 대비 초과수익)
}

export interface BucketRSSeries {
  bucket_id:    string
  bucket_label: string
  symbol:       string
  series:       BucketRSPoint[]
  rs_90d:       number       // 90일 전 대비 현재 RS
  rs_30d:       number       // 30일 전 대비 현재 RS
  trend:        SectorTrend
  color:        string
}

export interface SectorRSTimeSeries {
  buckets:         BucketRSSeries[]
  base_date:       string
  missing_buckets: string[]
}

const TREND_COLOR: Record<SectorTrend, string> = {
  acceleration: '#10b981',
  emerging:     '#6ee7b7',
  neutral:      '#94a3b8',
  fading:       '#fb923c',
  weakening:    '#ef4444',
}

// 13버킷 대표 종목 — aiInfraBucketMap.ts의 첫 번째 symbols 기준
const BUCKET_MAP = [
  { id: 'AI_CHIP',           label: 'AI Chip',         symbol: 'NVDA'  },
  { id: 'HBM_MEMORY',        label: 'HBM Memory',      symbol: 'MU'    },
  { id: 'PACKAGING',         label: 'Adv. Packaging',  symbol: 'AMAT'  },
  { id: 'COOLING',           label: 'Cooling',         symbol: 'VRT'   },
  { id: 'PCB_SUBSTRATE',     label: 'PCB & Substrate', symbol: 'TTMI'  },
  { id: 'TEST_EQUIPMENT',    label: 'Test Equipment',  symbol: 'TER'   },
  { id: 'GLASS_SUBSTRATE',   label: 'Glass Substrate', symbol: 'GLW'   },
  { id: 'OPTICAL_NETWORK',   label: 'Optical Network', symbol: 'ANET'  },
  { id: 'POWER_INFRA',       label: 'Power Infra',     symbol: 'ETN'   },
  { id: 'CLEANROOM_WATER',   label: 'Cleanroom/Water', symbol: 'ACMR'  },
  { id: 'SPECIALTY_GAS',     label: 'Specialty Gas',   symbol: 'LIN'   },
  { id: 'DATA_CENTER_INFRA', label: 'Data Center',     symbol: 'EQIX'  },
  { id: 'RAW_MATERIAL',      label: 'Raw Material',    symbol: 'FCX'   },
] as const

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
]

type DbRow = { date: string; adj_close: number }
type DbStatement = { all: (...args: unknown[]) => unknown[] }
type Db = { prepare: (sql: string) => DbStatement; close: () => void }

function fetchPriceMap(db: Db, symbol: string): Map<string, number> {
  const rows = db.prepare(
    `SELECT date, adj_close FROM ohlcv_daily
     WHERE symbol = ? AND adj_close IS NOT NULL AND adj_close > 0
     ORDER BY date DESC LIMIT 130`
  ).all(symbol) as DbRow[]
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.date, r.adj_close)
  return m
}

function classifyTrend(rs_90d: number, rs_30d: number): SectorTrend {
  if (rs_90d > 5  && rs_30d > 3)   return 'acceleration'
  if (rs_90d <= 0 && rs_30d > 3)   return 'emerging'
  if (rs_90d > 5  && rs_30d < -3)  return 'fading'
  if (rs_90d < -5 && rs_30d < -3)  return 'weakening'
  return 'neutral'
}

export async function buildSectorRSTimeSeries(days = 90): Promise<SectorRSTimeSeries | null> {
  let db: Db | null = null
  try {
    const { default: Database } = await import('better-sqlite3')
    for (const c of DB_CANDIDATES) {
      try { db = new Database(c, { readonly: true, fileMustExist: true }) as Db; break }
      catch { /* try next */ }
    }
    if (!db) return null

    const soxxMap   = fetchPriceMap(db, 'SOXX')
    const soxxDates = [...soxxMap.keys()].sort()
    const windowDates = soxxDates.slice(-days)

    if (windowDates.length < 5) return null

    const base_date = windowDates[0]
    const soxxBase  = soxxMap.get(base_date)
    if (!soxxBase) return null

    const lastDate = windowDates[windowDates.length - 1]
    const date30   = windowDates[Math.max(0, windowDates.length - 30)]

    const buckets: BucketRSSeries[] = []
    const missing_buckets: string[] = []

    for (const bucket of BUCKET_MAP) {
      const symMap  = fetchPriceMap(db, bucket.symbol)
      const symBase = symMap.get(base_date)

      if (!symBase) {
        missing_buckets.push(bucket.id)
        continue
      }

      const series: BucketRSPoint[] = []
      for (const date of windowDates) {
        const symP  = symMap.get(date)
        const soxxP = soxxMap.get(date)
        if (!symP || !soxxP) continue
        const symRet  = ((symP  / symBase)  - 1) * 100
        const soxxRet = ((soxxP / soxxBase) - 1) * 100
        series.push({ date, rs_vs_soxx: Math.round((symRet - soxxRet) * 100) / 100 })
      }

      if (series.length < 5) {
        missing_buckets.push(bucket.id)
        continue
      }

      // rs_90d: D-90 대비 오늘 RS (마지막 포인트)
      const rs_90d = series[series.length - 1].rs_vs_soxx

      // rs_30d: D-30 대비 오늘 RS (실제 가격 기준)
      const symLast    = symMap.get(lastDate)
      const soxxLast   = soxxMap.get(lastDate)
      const symAt30    = symMap.get(date30)
      const soxxAt30   = soxxMap.get(date30)
      let rs_30d = 0
      if (symLast && soxxLast && symAt30 && soxxAt30) {
        rs_30d = Math.round(
          (((symLast / symAt30) - 1) * 100 - ((soxxLast / soxxAt30) - 1) * 100) * 100
        ) / 100
      }

      const trend = classifyTrend(rs_90d, rs_30d)

      buckets.push({
        bucket_id:    bucket.id,
        bucket_label: bucket.label,
        symbol:       bucket.symbol,
        series,
        rs_90d,
        rs_30d,
        trend,
        color: TREND_COLOR[trend],
      })
    }

    return { buckets, base_date, missing_buckets }
  } catch {
    return null
  } finally {
    try { db?.close() } catch { /* ignore */ }
  }
}
