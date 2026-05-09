export type PortfolioHoldingInput = {
  ticker: string
  shares: number
  avg_price: number
  account?: string
  memo?: string
  active?: boolean
}

export type PortfolioPriceData = {
  ticker: string
  currentPrice?: number | null
  prevClose?: number | null
  dailyChangePct?: number | null
  volumeK?: number | null
  high52?: number | null
  low52?: number | null
  ma5?: number | null
  ma120?: number | null
  ma200?: number | null
  rsi?: number | null
  mdd?: number | null
  source?: string
  updatedAt?: string
}

export type PortfolioCalculatedRow = PortfolioHoldingInput &
  PortfolioPriceData & {
    account: string
    active: boolean
    costBasis: number
    marketValue: number
    pnl: number
    pnlPct: number
    todayPnl: number
    positionPct: number
    dailyChangePct: number
  }

export type PortfolioAccountSummary = {
  account: string | null
  totalPortfolioValue: number
  marketValue: number
  costBasis: number
  cashBalance: number
  accountTotal: number
  totalInvested: number
  dollarTotalPnl: number
  returnPct: number
  todayPnl: number
  pnl: number
  pnlPct: number
  positionCount: number
  activePositionCount: number
}

export type PortfolioSnapshotRow = {
  snapshotAt: string
  account: string
  ticker: string
  shares: number
  avg_price: number
  currentPrice: number
  costBasis: number
  marketValue: number
  pnl: number
  pnlPct: number
  todayPnl: number
  positionPct: number
  dailyChangePct: number
  memo?: string
  active?: boolean
}

export type PortfolioAccountRecord = {
  id: number
  name: string
  currency: string
  cash: number
  created_at: string
  updated_at: string
}

export type PortfolioHoldingRecord = {
  id: number
  account_name: string
  ticker: string
  shares: number
  avg_price: number
  memo: string | null
  active: number
  created_at: string
  updated_at: string
}

export type PortfolioDailySnapshotRecord = {
  id: number
  date: string
  account_name: string
  total_value: number
  total_cost: number
  cash: number
  pnl: number
  pnl_pct: number
  today_pnl: number
  delta: number
  holdings_count: number
  snapshot_json: string | null
  created_at: string
}

export type PortfolioInvestmentPeriodType = 'before_year' | 'year'

export type PortfolioInvestmentContributionInput = {
  account_name: string
  period_type: PortfolioInvestmentPeriodType
  year: number
  month: number
  amount: number
  memo?: string | null
}

export type PortfolioInvestmentContributionRecord = PortfolioInvestmentContributionInput & {
  id: number
  created_at: string
  updated_at: string
}

export type PortfolioInvestmentSummary = {
  account: string
  totalInvested: number
  annualTotals: Record<string, number>
}

export type PortfolioCalculatedField =
  | 'costBasis'
  | 'marketValue'
  | 'pnl'
  | 'pnlPct'
  | 'todayPnl'
  | 'positionPct'
  | 'dailyChangePct'

export type PortfolioCalculationMismatch = {
  account: string
  ticker: string
  field: PortfolioCalculatedField
  label: string
  sheetValue: number
  calculatedValue: number
  delta: number
  tolerance: number
  unit: 'number' | 'ratio'
}

export type PortfolioSheetRow = {
  holdingId?: number
  account: string
  order: number
  ticker: string
  memo?: string
  active?: boolean
  spark50?: unknown
  prevClose?: number
  currentPrice?: number
  dailyChangePct?: number
  todayPnl?: number
  avgPrice?: number
  marketValue?: number
  costBasis?: number
  rsi?: number
  positionPct?: number
  shares?: number
  pnlPct?: number
  pnl?: number
  mdd?: number
  volumeK?: number
  high52?: number
  low52?: number
  ma5?: number
  ma120?: number
  ma200?: number
  calculated?: PortfolioCalculatedRow
  calculationMismatches?: PortfolioCalculationMismatch[]
}

export type PortfolioSheetColumnKey =
  | 'order'
  | 'ticker'
  | 'spark50'
  | 'prevClose'
  | 'currentPrice'
  | 'dailyChangePct'
  | 'todayPnl'
  | 'avgPrice'
  | 'marketValue'
  | 'costBasis'
  | 'rsi'
  | 'positionPct'
  | 'shares'
  | 'pnlPct'
  | 'pnl'
  | 'mdd'
  | 'volumeK'
  | 'high52'
  | 'low52'
  | 'ma5'
  | 'ma120'
  | 'ma200'

export type PortfolioSheetColumn = {
  key: PortfolioSheetColumnKey
  label: string
  align: 'left' | 'right' | 'center'
  kind: 'index' | 'text' | 'spark' | 'number' | 'signedNumber' | 'percent' | 'signedPercent'
  editable?: boolean
  precision?: number
}

export type PortfolioSheetCalculationDebug = {
  comparedRows: number
  mismatchedRows: number
  mismatchCount: number
  mismatches: PortfolioCalculationMismatch[]
}

export type PortfolioSheetSample = {
  rows: PortfolioSheetRow[]
  allRows: PortfolioSheetRow[]
  accounts: string[]
  activeAccount: string | null
  populatedColumns: string[]
  placeholderColumns: string[]
  summary: PortfolioAccountSummary
  calculationDebug: PortfolioSheetCalculationDebug
  source: {
    label: string
    cacheFile: string
    source: string | null
    sheetId: string | null
    generatedAt: string | null
    dataVersion: string | null
    totalRows: number
  }
}
