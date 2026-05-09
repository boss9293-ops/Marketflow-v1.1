import { calculatePortfolioRows, summarizeCalculatedRows } from './calculatePortfolio'
import type {
  PortfolioAccountRecord,
  PortfolioAccountSummary,
  PortfolioCalculatedRow,
  PortfolioHoldingInput,
  PortfolioHoldingRecord,
  PortfolioPriceData,
  PortfolioSheetRow,
} from './types'

export type PortfolioSheetRowsResult = {
  rows: PortfolioSheetRow[]
  calculatedRows: PortfolioCalculatedRow[]
  summary: PortfolioAccountSummary
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function toDisplayNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function accountCash(account: PortfolioAccountRecord | null | undefined): number {
  return typeof account?.cash === 'number' && Number.isFinite(account.cash) ? account.cash : 0
}

function toHoldingInput(holding: PortfolioHoldingRecord): PortfolioHoldingInput {
  return {
    ticker: holding.ticker,
    shares: holding.shares,
    avg_price: holding.avg_price,
    account: holding.account_name,
    memo: holding.memo ?? undefined,
    active: holding.active !== 0,
  }
}

export function buildPortfolioSheetRows(
  holdings: PortfolioHoldingRecord[],
  pricesByTicker: Record<string, PortfolioPriceData | undefined>,
  account: PortfolioAccountRecord | null,
): PortfolioSheetRowsResult {
  const inputs = holdings.map(toHoldingInput)
  const calculatedRows = calculatePortfolioRows(inputs, pricesByTicker)
  const rows = holdings.map((holding, index): PortfolioSheetRow => {
    const ticker = normalizeTicker(holding.ticker)
    const price = pricesByTicker[ticker]
    const calculated = calculatedRows[index]

    return {
      holdingId: holding.id,
      account: holding.account_name,
      order: index + 1,
      ticker,
      memo: holding.memo ?? undefined,
      active: holding.active !== 0,
      prevClose: toDisplayNumber(price?.prevClose),
      currentPrice: toDisplayNumber(price?.currentPrice),
      dailyChangePct: calculated.dailyChangePct * 100,
      todayPnl: calculated.todayPnl,
      avgPrice: holding.avg_price,
      marketValue: calculated.marketValue,
      costBasis: calculated.costBasis,
      rsi: toDisplayNumber(price?.rsi),
      positionPct: calculated.positionPct * 100,
      shares: holding.shares,
      pnlPct: calculated.pnlPct * 100,
      pnl: calculated.pnl,
      mdd: toDisplayNumber(price?.mdd),
      volumeK: toDisplayNumber(price?.volumeK),
      high52: toDisplayNumber(price?.high52),
      low52: toDisplayNumber(price?.low52),
      ma5: toDisplayNumber(price?.ma5),
      ma120: toDisplayNumber(price?.ma120),
      ma200: toDisplayNumber(price?.ma200),
      calculated,
      calculationMismatches: [],
    }
  })

  return {
    rows,
    calculatedRows,
    summary: summarizeCalculatedRows(calculatedRows, account?.name ?? null, accountCash(account)),
  }
}
