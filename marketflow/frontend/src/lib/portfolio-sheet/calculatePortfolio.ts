import type {
  PortfolioAccountSummary,
  PortfolioCalculatedField,
  PortfolioCalculatedRow,
  PortfolioCalculationMismatch,
  PortfolioHoldingInput,
  PortfolioPriceData,
  PortfolioSheetRow,
} from './types'

type PriceLookup = Record<string, PortfolioPriceData | undefined> | Map<string, PortfolioPriceData>

type ComparableField = {
  field: PortfolioCalculatedField
  label: string
  tolerance: number
  unit: 'number' | 'ratio'
  sheetValue: (row: PortfolioSheetRow) => number | undefined
  calculatedValue: (row: PortfolioCalculatedRow) => number
}

const COMPARABLE_FIELDS: ComparableField[] = [
  {
    field: 'costBasis',
    label: '매수총액',
    tolerance: 1,
    unit: 'number',
    sheetValue: (row) => row.costBasis,
    calculatedValue: (row) => row.costBasis,
  },
  {
    field: 'marketValue',
    label: '평가액',
    tolerance: 1,
    unit: 'number',
    sheetValue: (row) => row.marketValue,
    calculatedValue: (row) => row.marketValue,
  },
  {
    field: 'pnl',
    label: '누적수익금($)',
    tolerance: 1,
    unit: 'number',
    sheetValue: (row) => row.pnl,
    calculatedValue: (row) => row.pnl,
  },
  {
    field: 'pnlPct',
    label: '누적수익률(%)',
    tolerance: 0.005,
    unit: 'ratio',
    sheetValue: (row) => percentPointToRatio(row.pnlPct),
    calculatedValue: (row) => row.pnlPct,
  },
  {
    field: 'todayPnl',
    label: '오늘 수익',
    tolerance: 1,
    unit: 'number',
    sheetValue: (row) => row.todayPnl,
    calculatedValue: (row) => row.todayPnl,
  },
  {
    field: 'positionPct',
    label: '포지션(%)',
    tolerance: 0.005,
    unit: 'ratio',
    sheetValue: (row) => percentPointToRatio(row.positionPct),
    calculatedValue: (row) => row.positionPct,
  },
  {
    field: 'dailyChangePct',
    label: '변동(%)',
    tolerance: 0.0005,
    unit: 'ratio',
    sheetValue: (row) => percentPointToRatio(row.dailyChangePct),
    calculatedValue: (row) => row.dailyChangePct,
  },
]

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function percentPointToRatio(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value / 100
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function getPrice(lookup: PriceLookup, ticker: string): PortfolioPriceData | undefined {
  const normalized = normalizeTicker(ticker)
  if (lookup instanceof Map) {
    return lookup.get(normalized) ?? lookup.get(ticker)
  }
  return lookup[normalized] ?? lookup[ticker]
}

export function calculatePortfolioRow(
  input: PortfolioHoldingInput,
  price: PortfolioPriceData | undefined,
  totalPortfolioValue: number,
): PortfolioCalculatedRow {
  const ticker = normalizeTicker(input.ticker)
  const shares = finiteOrZero(input.shares)
  const avgPrice = finiteOrZero(input.avg_price)
  const currentPrice = finiteOrZero(price?.currentPrice)
  const prevClose = finiteOrZero(price?.prevClose)
  const costBasis = shares * avgPrice
  const marketValue = shares * currentPrice
  const pnl = marketValue - costBasis
  const pnlPct = costBasis > 0 ? pnl / costBasis : 0
  const todayPnl = shares * (currentPrice - prevClose)
  const positionPct = totalPortfolioValue > 0 ? marketValue / totalPortfolioValue : 0
  const dailyChangePct = prevClose > 0 ? (currentPrice - prevClose) / prevClose : 0

  return {
    ...input,
    ticker,
    account: input.account || 'Sample',
    active: input.active !== false,
    shares,
    avg_price: avgPrice,
    prevClose,
    currentPrice,
    rsi: price?.rsi,
    mdd: price?.mdd,
    volumeK: price?.volumeK,
    high52: price?.high52,
    low52: price?.low52,
    ma5: price?.ma5,
    ma120: price?.ma120,
    ma200: price?.ma200,
    costBasis,
    marketValue,
    pnl,
    pnlPct,
    todayPnl,
    positionPct,
    dailyChangePct,
  }
}

export function calculatePortfolioRows(
  inputs: PortfolioHoldingInput[],
  pricesByTicker: PriceLookup,
): PortfolioCalculatedRow[] {
  const provisionalRows = inputs.map((input) => calculatePortfolioRow(input, getPrice(pricesByTicker, input.ticker), 0))
  const totalPortfolioValue = provisionalRows.reduce((sum, row) => {
    if (row.active === false) return sum
    return sum + row.marketValue
  }, 0)

  return inputs.map((input) => calculatePortfolioRow(input, getPrice(pricesByTicker, input.ticker), totalPortfolioValue))
}

export function summarizeCalculatedRows(
  rows: PortfolioCalculatedRow[],
  account: string | null = null,
  cashBalance = 0,
): PortfolioAccountSummary {
  const scopedRows = account ? rows.filter((row) => row.account === account) : rows
  const activeRows = scopedRows.filter((row) => row.active !== false)
  const marketValue = activeRows.reduce((sum, row) => sum + row.marketValue, 0)
  const costBasis = activeRows.reduce((sum, row) => sum + row.costBasis, 0)
  const todayPnl = activeRows.reduce((sum, row) => sum + row.todayPnl, 0)
  const accountTotal = marketValue + cashBalance
  const totalInvested = costBasis
  const dollarTotalPnl = marketValue - costBasis
  const returnPct = totalInvested > 0 ? dollarTotalPnl / totalInvested : 0

  return {
    account,
    totalPortfolioValue: accountTotal,
    marketValue,
    costBasis,
    cashBalance,
    accountTotal,
    totalInvested,
    dollarTotalPnl,
    returnPct,
    todayPnl,
    pnl: dollarTotalPnl,
    pnlPct: returnPct,
    positionCount: scopedRows.length,
    activePositionCount: activeRows.length,
  }
}

export function compareSheetRowToCalculated(
  sheetRow: PortfolioSheetRow,
  calculatedRow: PortfolioCalculatedRow,
): PortfolioCalculationMismatch[] {
  const mismatches: PortfolioCalculationMismatch[] = []

  for (const comparable of COMPARABLE_FIELDS) {
    const sheetValue = comparable.sheetValue(sheetRow)
    if (sheetValue === undefined) continue

    const calculatedValue = comparable.calculatedValue(calculatedRow)
    const delta = calculatedValue - sheetValue

    if (Math.abs(delta) <= comparable.tolerance) continue

    mismatches.push({
      account: sheetRow.account,
      ticker: sheetRow.ticker,
      field: comparable.field,
      label: comparable.label,
      sheetValue,
      calculatedValue,
      delta,
      tolerance: comparable.tolerance,
      unit: comparable.unit,
    })
  }

  return mismatches
}
