import fs from 'fs'
import path from 'path'

import Database from 'better-sqlite3'

import { loadPortfolioSheetSample } from './sampleAdapter'
import type { PortfolioPriceData } from './types'

type ReadonlyDb = any

type PriceDbRow = {
  date?: string
  close?: number
  high?: number
  low?: number
  volume?: number
  source?: string | null
  updated_at?: string | null
  rsi14?: number | null
}

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'backend', 'data', 'marketflow.db'),
]

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function findLocalPriceDbPath(): string | null {
  for (const candidate of DB_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function movingAverage(rows: PriceDbRow[], period: number): number | null {
  const closes = rows.slice(0, period).map((row) => toNumber(row.close)).filter((value): value is number => value !== null)
  if (closes.length < period) return null
  return closes.reduce((sum, value) => sum + value, 0) / period
}

function computeRsi(rows: PriceDbRow[], period = 14): number | null {
  const closes = rows
    .slice(0, period + 1)
    .map((row) => toNumber(row.close))
    .filter((value): value is number => value !== null)
    .reverse()

  if (closes.length < period + 1) return null

  let gains = 0
  let losses = 0
  for (let index = 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }

  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function computeMdd(rows: PriceDbRow[]): number | null {
  const latestClose = toNumber(rows[0]?.close)
  if (latestClose === null) return null

  const peak = rows
    .map((row) => toNumber(row.close))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0)

  if (peak <= 0) return null
  return ((latestClose - peak) / peak) * 100
}

function readRowsFromLocalDb(db: ReadonlyDb, ticker: string): PriceDbRow[] {
  return db
    .prepare(
      `
      SELECT
        o.date,
        CASE
          WHEN o.adj_close IS NOT NULL AND o.adj_close > 0 THEN o.adj_close
          ELSE o.close
        END AS close,
        o.high,
        o.low,
        o.volume,
        o.source,
        o.updated_at,
        i.rsi14
      FROM ohlcv_daily o
      LEFT JOIN indicators_daily i
        ON i.symbol = o.symbol
       AND i.date = o.date
      WHERE o.symbol = ?
        AND o.close IS NOT NULL
      ORDER BY o.date DESC
      LIMIT 260
    `,
    )
    .all(ticker) as PriceDbRow[]
}

function normalizeFromDbRows(ticker: string, rows: PriceDbRow[]): PortfolioPriceData | null {
  const latest = rows[0]
  const previous = rows[1]
  const currentPrice = toNumber(latest?.close)
  const prevClose = toNumber(previous?.close)
  if (currentPrice === null || prevClose === null) return null

  const highs = rows.map((row) => toNumber(row.high)).filter((value): value is number => value !== null)
  const lows = rows.map((row) => toNumber(row.low)).filter((value): value is number => value !== null)
  const volume = toNumber(latest?.volume)
  const rsi = toNumber(latest?.rsi14) ?? computeRsi(rows)

  return {
    ticker,
    currentPrice,
    prevClose,
    dailyChangePct: prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : null,
    volumeK: volume !== null ? volume / 1000 : null,
    high52: highs.length ? Math.max(...highs) : null,
    low52: lows.length ? Math.min(...lows) : null,
    ma5: movingAverage(rows, 5),
    ma120: movingAverage(rows, 120),
    ma200: movingAverage(rows, 200),
    rsi,
    mdd: computeMdd(rows),
    source: latest?.source ? `local_price_db:ohlcv_daily:${latest.source}` : 'local_price_db:ohlcv_daily',
    updatedAt: latest?.updated_at || latest?.date || undefined,
  }
}

async function loadSampleFallbackPrices(tickers: string[]): Promise<Map<string, PortfolioPriceData>> {
  const sample = await loadPortfolioSheetSample()
  const requested = new Set(tickers)
  const fallback = new Map<string, PortfolioPriceData>()

  for (const row of sample.allRows) {
    const ticker = normalizeTicker(row.ticker)
    if (!requested.has(ticker) || fallback.has(ticker)) continue

    fallback.set(ticker, {
      ticker,
      currentPrice: row.currentPrice ?? null,
      prevClose: row.prevClose ?? null,
      dailyChangePct: row.dailyChangePct ?? null,
      volumeK: row.volumeK ?? null,
      high52: row.high52 ?? null,
      low52: row.low52 ?? null,
      ma5: row.ma5 ?? null,
      ma120: row.ma120 ?? null,
      ma200: row.ma200 ?? null,
      rsi: row.rsi ?? null,
      mdd: row.mdd ?? null,
      source: 'linked_google_sheet_sample',
      updatedAt: sample.source.generatedAt || undefined,
    })
  }

  return fallback
}

export async function loadPortfolioPrices(tickers: string[]): Promise<Record<string, PortfolioPriceData>> {
  const uniqueTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)))
  const prices = new Map<string, PortfolioPriceData>()
  const dbPath = findLocalPriceDbPath()

  if (dbPath) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true }) as ReadonlyDb
    try {
      for (const ticker of uniqueTickers) {
        const fromDb = normalizeFromDbRows(ticker, readRowsFromLocalDb(db, ticker))
        if (fromDb) prices.set(ticker, fromDb)
      }
    } finally {
      db.close()
    }
  }

  const missing = uniqueTickers.filter((ticker) => !prices.has(ticker))
  if (missing.length > 0) {
    const fallback = await loadSampleFallbackPrices(missing)
    for (const [ticker, row] of fallback.entries()) {
      prices.set(ticker, row)
    }
  }

  for (const ticker of uniqueTickers) {
    if (!prices.has(ticker)) {
      prices.set(ticker, {
        ticker,
        currentPrice: null,
        prevClose: null,
        source: dbPath ? 'local_price_db:missing' : 'not_available',
        updatedAt: undefined,
      })
    }
  }

  return Object.fromEntries(prices.entries())
}
