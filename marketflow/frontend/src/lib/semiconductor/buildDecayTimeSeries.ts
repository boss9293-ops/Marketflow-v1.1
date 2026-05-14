// SOXX/SOXL 90일 누적 수익률 시계열 계산 — Decay 추적기 카드 3용 데이터 빌더
import path from 'path'

export interface DecayTimeSeriesPoint {
  date: string
  theoretical_soxl: number  // SOXX 누적수익률 × 3 (%)
  actual_soxl: number        // SOXL 실제 누적수익률 (%)
  excess_return: number      // actual - theoretical (pp)
}

export interface DecayTimeSeries {
  series: DecayTimeSeriesPoint[]
  base_date: string
  current: {
    theoretical_soxl: number
    actual_soxl: number
    excess_return: number
  }
  trend: 'outperforming' | 'underperforming' | 'neutral'
}

type PriceRow = {
  date: string
  close: number
}

type ReadonlyDb = {
  prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] }
  close: () => void
}

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
]

function detectTrend(series: DecayTimeSeriesPoint[]): DecayTimeSeries['trend'] {
  // 최근 30일 excess_return 선형 기울기로 판단
  const window = series.slice(-30)
  if (window.length < 5) return 'neutral'
  const n = window.length
  const sumX = (n * (n - 1)) / 2
  const sumX2 = window.reduce((acc, _, i) => acc + i * i, 0)
  const sumY = window.reduce((acc, p) => acc + p.excess_return, 0)
  const sumXY = window.reduce((acc, p, i) => acc + i * p.excess_return, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return 'neutral'
  const slope = (n * sumXY - sumX * sumY) / denom
  if (slope > 0.05) return 'outperforming'
  if (slope < -0.05) return 'underperforming'
  return 'neutral'
}

export async function buildDecayTimeSeries(days = 90): Promise<DecayTimeSeries | null> {
  let db: ReadonlyDb | null = null
  try {
    const { default: Database } = await import('better-sqlite3')
    for (const candidate of DB_CANDIDATES) {
      try {
        db = new Database(candidate, { readonly: true, fileMustExist: true }) as ReadonlyDb
        break
      } catch { /* try next */ }
    }
    if (!db) return null

    // 요청 일수 + 버퍼 (주말/공휴일 대비)
    const fetchDays = Math.ceil(days * 1.5) + 10

    const soxxRows = db.prepare(
      `SELECT date, adj_close AS close FROM ohlcv_daily
       WHERE symbol = 'SOXX' AND adj_close IS NOT NULL AND adj_close > 0
       ORDER BY date DESC LIMIT ?`
    ).all(fetchDays) as PriceRow[]

    const soxlRows = db.prepare(
      `SELECT date, adj_close AS close FROM ohlcv_daily
       WHERE symbol = 'SOXL' AND adj_close IS NOT NULL AND adj_close > 0
       ORDER BY date DESC LIMIT ?`
    ).all(fetchDays) as PriceRow[]

    db.close()
    db = null

    if (soxxRows.length < days || soxlRows.length < days) return null

    // 공통 거래일 추출 (양쪽 모두 있는 날짜)
    const soxlMap = new Map(soxlRows.map(r => [r.date, r.close]))
    const common = soxxRows
      .filter(r => soxlMap.has(r.date))
      .slice(0, days)
      .reverse()  // 오래된 순서로

    if (common.length < 10) return null

    const baseSOXX = common[0].close
    const baseSOXL = soxlMap.get(common[0].date)!

    const series: DecayTimeSeriesPoint[] = common.map(r => {
      const soxxRet = ((r.close / baseSOXX) - 1) * 100
      const theoretical = soxxRet * 3
      const actual = ((soxlMap.get(r.date)! / baseSOXL) - 1) * 100
      const excess = actual - theoretical
      return {
        date: r.date,
        theoretical_soxl: Math.round(theoretical * 100) / 100,
        actual_soxl: Math.round(actual * 100) / 100,
        excess_return: Math.round(excess * 100) / 100,
      }
    })

    const last = series[series.length - 1]

    return {
      series,
      base_date: common[0].date,
      current: {
        theoretical_soxl: last.theoretical_soxl,
        actual_soxl: last.actual_soxl,
        excess_return: last.excess_return,
      },
      trend: detectTrend(series),
    }
  } catch {
    return null
  } finally {
    try { db?.close() } catch { /* ignore */ }
  }
}
