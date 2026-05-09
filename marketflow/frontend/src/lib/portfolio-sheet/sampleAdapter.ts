import { readCacheJsonOrNull } from '@/lib/readCacheJson'

import {
  calculatePortfolioRows,
  compareSheetRowToCalculated,
  summarizeCalculatedRows,
} from './calculatePortfolio'
import { PORTFOLIO_SHEET_COLUMNS } from './columns'
import type {
  PortfolioCalculatedRow,
  PortfolioHoldingInput,
  PortfolioPriceData,
  PortfolioSheetCalculationDebug,
  PortfolioSheetColumnKey,
  PortfolioSheetRow,
  PortfolioSheetSample,
} from './types'

export type {
  PortfolioAccountSummary,
  PortfolioCalculatedRow,
  PortfolioCalculationMismatch,
  PortfolioHoldingInput,
  PortfolioPriceData,
  PortfolioSheetColumnKey,
  PortfolioSheetRow,
  PortfolioSheetSample,
  PortfolioSnapshotRow,
} from './types'

export { PORTFOLIO_SHEET_COLUMNS } from './columns'

type RawRecord = Record<string, unknown>

type HoldingsCachePayload = {
  data_version?: string | null
  source?: string | null
  sheet_id?: string | null
  generated_at?: string | null
  selected_tabs?: string[] | null
  positions?: RawRecord[] | null
  positions_by_tab?: Record<string, RawRecord[]> | null
}

const EMPTY_SAMPLE: PortfolioSheetSample = {
  rows: [],
  allRows: [],
  accounts: [],
  activeAccount: null,
  populatedColumns: [],
  placeholderColumns: PORTFOLIO_SHEET_COLUMNS.map((column) => column.label),
  summary: {
    account: null,
    totalPortfolioValue: 0,
    marketValue: 0,
    costBasis: 0,
    cashBalance: 0,
    accountTotal: 0,
    totalInvested: 0,
    dollarTotalPnl: 0,
    returnPct: 0,
    todayPnl: 0,
    pnl: 0,
    pnlPct: 0,
    positionCount: 0,
    activePositionCount: 0,
  },
  calculationDebug: {
    comparedRows: 0,
    mismatchedRows: 0,
    mismatchCount: 0,
    mismatches: [],
  },
  source: {
    label: 'Existing Google Sheets import cache',
    cacheFile: 'my_holdings_cache.json',
    source: null,
    sheetId: null,
    generatedAt: null,
    dataVersion: null,
    totalRows: 0,
  },
}

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : null
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function firstValue(record: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key]
    }
  }
  return undefined
}

function firstText(record: RawRecord, keys: string[]): string {
  for (const key of keys) {
    const text = asText(record[key])
    if (text) return text
  }
  return ''
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined

  const text = asText(value)
  if (!text || text === '-') return undefined

  const isParenthetical = /^\(.*\)$/.test(text)
  const normalized = text.replace(/,/g, '')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined

  const parsed = Number(match[0])
  if (!Number.isFinite(parsed)) return undefined
  return isParenthetical && parsed > 0 ? -parsed : parsed
}

function firstNumber(record: RawRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = parseNumber(record[key])
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function firstPresentValue(record: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = firstValue(record, [key])
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return undefined
}

function normalizePosition(record: RawRecord, fallbackAccount: string, fallbackOrder: number): PortfolioSheetRow | null {
  const account = firstText(record, ['_tab', 'account', '계좌']) || fallbackAccount
  const ticker = firstText(record, ['symbol', 'ticker', '종목'])
  if (!ticker) return null

  return {
    account,
    order: firstNumber(record, ['order', '순서', 'col_1']) ?? fallbackOrder,
    ticker,
    spark50: firstPresentValue(record, ['spark50', '50일선', '50 일선', '__sparkline', 'Sparkline']),
    prevClose: firstNumber(record, ['yesterday_close', 'prevClose', '어제종가']),
    currentPrice: firstNumber(record, ['today_close', 'currentPrice', '오늘']),
    dailyChangePct: firstNumber(record, ['change_pct', 'dailyChangePct', '변동(%)']),
    todayPnl: firstNumber(record, ['pnl_today', 'todayPnl', '오늘 수익']),
    avgPrice: firstNumber(record, ['avg_cost', 'avgPrice', '평단가']),
    marketValue: firstNumber(record, ['equity', 'marketValue', '평가액']),
    costBasis: firstNumber(record, ['buy_total', 'cost_basis', 'costBasis', '매수총액']),
    rsi: firstNumber(record, ['rsi', 'RSI']),
    positionPct: firstNumber(record, ['position_pct', 'positionPct', '포지션(%)', 'position']),
    shares: firstNumber(record, ['shares', '주식수']),
    pnlPct: firstNumber(record, ['cum_return_pct', 'pnlPct', '누적수익률(%)', '누작수익률(%)', 'PL(%)']),
    pnl: firstNumber(record, ['cum_pnl_usd', 'pnl', '누적수익금($)', '누적수익금', 'PL']),
    mdd: firstNumber(record, ['mdd_pct', 'mdd', 'MDD']),
    volumeK: firstNumber(record, ['volume_k', 'volumeK', 'Volume(K)', 'Volume (K)']),
    high52: firstNumber(record, ['high_52w', 'high52', 'H52', 'H 52']),
    low52: firstNumber(record, ['low_52w', 'low52', 'L52', 'L 52']),
    ma5: firstNumber(record, ['ma5', 'MA(5)']),
    ma120: firstNumber(record, ['ma120', 'MA(120)']),
    ma200: firstNumber(record, ['ma200', 'MA(200)']),
  }
}

function normalizeRowsFromPositions(positions: RawRecord[] | null | undefined): PortfolioSheetRow[] {
  if (!Array.isArray(positions)) return []

  const accountCounters = new Map<string, number>()
  const rows: PortfolioSheetRow[] = []

  for (const raw of positions) {
    const record = asRecord(raw)
    if (!record) continue

    const account = firstText(record, ['_tab', 'account', '계좌']) || 'Sample'
    const nextOrder = (accountCounters.get(account) ?? 0) + 1
    accountCounters.set(account, nextOrder)

    const row = normalizePosition(record, account, nextOrder)
    if (row) rows.push(row)
  }

  return rows
}

function normalizeRowsFromTabs(
  positionsByTab: Record<string, RawRecord[]> | null | undefined,
  selectedTabs: string[] | null | undefined,
): PortfolioSheetRow[] {
  if (!positionsByTab || typeof positionsByTab !== 'object') return []

  const tabNames = Array.isArray(selectedTabs) && selectedTabs.length ? selectedTabs : Object.keys(positionsByTab)
  const rows: PortfolioSheetRow[] = []

  for (const tabName of tabNames) {
    const tabRows = positionsByTab[tabName]
    if (!Array.isArray(tabRows)) continue

    let order = 0
    for (const raw of tabRows) {
      const record = asRecord(raw)
      if (!record) continue

      const row = normalizePosition(record, tabName, order + 1)
      if (!row) continue

      order += 1
      rows.push({ ...row, order })
    }
  }

  return rows
}

function uniqueAccounts(rows: PortfolioSheetRow[]): string[] {
  const seen = new Set<string>()
  const accounts: string[] = []

  for (const row of rows) {
    if (seen.has(row.account)) continue
    seen.add(row.account)
    accounts.push(row.account)
  }

  return accounts
}

function hasCellValue(row: PortfolioSheetRow, key: PortfolioSheetColumnKey): boolean {
  const value = row[key]
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function getColumnCoverage(rows: PortfolioSheetRow[]) {
  const populatedColumns: string[] = []
  const placeholderColumns: string[] = []

  for (const column of PORTFOLIO_SHEET_COLUMNS) {
    const populated = rows.some((row) => hasCellValue(row, column.key))
    if (populated) {
      populatedColumns.push(column.label)
    } else {
      placeholderColumns.push(column.label)
    }
  }

  return { populatedColumns, placeholderColumns }
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function toHoldingInput(row: PortfolioSheetRow): PortfolioHoldingInput {
  return {
    ticker: row.ticker,
    shares: row.shares ?? 0,
    avg_price: row.avgPrice ?? 0,
    account: row.account,
    memo: row.memo,
    active: row.active,
  }
}

function toPriceData(row: PortfolioSheetRow): PortfolioPriceData {
  return {
    ticker: normalizeTicker(row.ticker),
    prevClose: row.prevClose,
    currentPrice: row.currentPrice,
    rsi: row.rsi,
    mdd: row.mdd,
    volumeK: row.volumeK,
    high52: row.high52,
    low52: row.low52,
    ma5: row.ma5,
    ma120: row.ma120,
    ma200: row.ma200,
  }
}

function calculateRowsByAccount(rows: PortfolioSheetRow[]): PortfolioCalculatedRow[] {
  const grouped = new Map<string, Array<{ row: PortfolioSheetRow; index: number }>>()

  rows.forEach((row, index) => {
    const group = grouped.get(row.account) ?? []
    group.push({ row, index })
    grouped.set(row.account, group)
  })

  const calculatedByIndex = new Map<number, PortfolioCalculatedRow>()

  for (const group of grouped.values()) {
    const inputs = group.map(({ row }) => toHoldingInput(row))
    const pricesByTicker: Record<string, PortfolioPriceData> = {}

    for (const { row } of group) {
      pricesByTicker[normalizeTicker(row.ticker)] = toPriceData(row)
    }

    const calculatedRows = calculatePortfolioRows(inputs, pricesByTicker)
    calculatedRows.forEach((calculatedRow, groupIndex) => {
      calculatedByIndex.set(group[groupIndex].index, calculatedRow)
    })
  }

  return rows.map((row, index) => {
    return calculatedByIndex.get(index) ?? calculatePortfolioRows([toHoldingInput(row)], { [normalizeTicker(row.ticker)]: toPriceData(row) })[0]
  })
}

function applyCalculatedFallbacks(row: PortfolioSheetRow, calculated: PortfolioCalculatedRow): PortfolioSheetRow {
  const mismatches = compareSheetRowToCalculated(row, calculated)

  return {
    ...row,
    dailyChangePct: row.dailyChangePct ?? calculated.dailyChangePct * 100,
    todayPnl: row.todayPnl ?? calculated.todayPnl,
    marketValue: row.marketValue ?? calculated.marketValue,
    costBasis: row.costBasis ?? calculated.costBasis,
    positionPct: row.positionPct ?? calculated.positionPct * 100,
    pnlPct: row.pnlPct ?? calculated.pnlPct * 100,
    pnl: row.pnl ?? calculated.pnl,
    calculated,
    calculationMismatches: mismatches,
  }
}

function attachCalculations(rows: PortfolioSheetRow[]): PortfolioSheetRow[] {
  const calculatedRows = calculateRowsByAccount(rows)
  return rows.map((row, index) => applyCalculatedFallbacks(row, calculatedRows[index]))
}

function createCalculationDebug(rows: PortfolioSheetRow[]): PortfolioSheetCalculationDebug {
  const mismatches = rows.flatMap((row) => row.calculationMismatches ?? [])
  const mismatchedRowKeys = new Set(mismatches.map((mismatch) => `${mismatch.account}:${mismatch.ticker}`))

  return {
    comparedRows: rows.filter((row) => row.calculated).length,
    mismatchedRows: mismatchedRowKeys.size,
    mismatchCount: mismatches.length,
    mismatches,
  }
}

export async function loadPortfolioSheetSample(): Promise<PortfolioSheetSample> {
  const cache = await readCacheJsonOrNull<HoldingsCachePayload>('my_holdings_cache.json')
  if (!cache || typeof cache !== 'object') {
    return EMPTY_SAMPLE
  }

  const fromCanonicalPositions = normalizeRowsFromPositions(cache.positions)
  const normalizedRows =
    fromCanonicalPositions.length > 0
      ? fromCanonicalPositions
      : normalizeRowsFromTabs(cache.positions_by_tab, cache.selected_tabs)
  const allRows = attachCalculations(normalizedRows)
  const accounts = uniqueAccounts(allRows)
  const activeAccount = accounts[0] ?? null
  const rows = activeAccount ? allRows.filter((row) => row.account === activeAccount) : allRows
  const activeCalculatedRows = rows.map((row) => row.calculated).filter((row): row is PortfolioCalculatedRow => Boolean(row))
  const coverage = getColumnCoverage(allRows)

  return {
    rows,
    allRows,
    accounts,
    activeAccount,
    ...coverage,
    summary: summarizeCalculatedRows(activeCalculatedRows, activeAccount),
    calculationDebug: createCalculationDebug(allRows),
    source: {
      label: 'Existing Google Sheets import cache',
      cacheFile: 'my_holdings_cache.json',
      source: cache.source ?? null,
      sheetId: cache.sheet_id ?? null,
      generatedAt: cache.generated_at ?? null,
      dataVersion: cache.data_version ?? null,
      totalRows: allRows.length,
    },
  }
}
