import type {
  PortfolioInvestmentContributionRecord,
  PortfolioInvestmentPeriodType,
  PortfolioInvestmentSummary,
} from './types'

export type PortfolioInvestmentColumn = {
  key: string
  label: string
  periodType: PortfolioInvestmentPeriodType
  year: number
  sheetColumn: string
}

export const PORTFOLIO_INVESTMENT_SHEET_LAYOUT = {
  titleRange: 'P25:X25',
  headerRange: 'P26:X26',
  monthRange: 'P27:P38',
  inputRange: 'Q27:X38',
  totalRowRange: 'P39:X39',
  grandTotalRange: 'P40:X40',
  historyHeaderRange: 'D49:I49',
  historyDataRange: 'D50:I',
} as const

export const PORTFOLIO_INVESTMENT_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const PORTFOLIO_INVESTMENT_COLUMNS: PortfolioInvestmentColumn[] = [
  { key: 'before_2025', label: '<2025', periodType: 'before_year', year: 2025, sheetColumn: 'Q' },
  { key: '2025', label: '2025', periodType: 'year', year: 2025, sheetColumn: 'R' },
  { key: '2026', label: '2026', periodType: 'year', year: 2026, sheetColumn: 'S' },
  { key: '2027', label: '2027', periodType: 'year', year: 2027, sheetColumn: 'T' },
  { key: '2028', label: '2028', periodType: 'year', year: 2028, sheetColumn: 'U' },
  { key: '2029', label: '2029', periodType: 'year', year: 2029, sheetColumn: 'V' },
  { key: '2030', label: '2030', periodType: 'year', year: 2030, sheetColumn: 'W' },
  { key: '2031', label: '2031', periodType: 'year', year: 2031, sheetColumn: 'X' },
]

export function investmentCellKey(periodType: PortfolioInvestmentPeriodType, year: number, month: number): string {
  return `${periodType}:${year}:${month}`
}

export function investmentColumnKey(column: PortfolioInvestmentColumn, month: number): string {
  return investmentCellKey(column.periodType, column.year, month)
}

export function buildInvestmentDrafts(records: PortfolioInvestmentContributionRecord[]): Record<string, string> {
  const drafts = PORTFOLIO_INVESTMENT_COLUMNS.reduce((acc, column) => {
    for (const month of PORTFOLIO_INVESTMENT_MONTHS) {
      acc[investmentColumnKey(column, month)] = ''
    }
    return acc
  }, {} as Record<string, string>)

  for (const record of records) {
    drafts[investmentCellKey(record.period_type, record.year, record.month)] =
      record.amount === 0 ? '' : String(record.amount)
  }

  return drafts
}

export function summarizeInvestmentDrafts(account: string, drafts: Record<string, string>): PortfolioInvestmentSummary {
  const annualTotals: Record<string, number> = {}
  let totalInvested = 0

  for (const column of PORTFOLIO_INVESTMENT_COLUMNS) {
    let annualTotal = 0

    for (const month of PORTFOLIO_INVESTMENT_MONTHS) {
      const rawValue = drafts[investmentColumnKey(column, month)]
      const amount = Number(rawValue)
      if (!Number.isFinite(amount)) continue
      annualTotal += amount
    }

    annualTotals[column.key] = annualTotal
    totalInvested += annualTotal
  }

  return {
    account,
    annualTotals,
    totalInvested,
  }
}
