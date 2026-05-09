import type {
  PortfolioAccountRecord,
  PortfolioDailySnapshotRecord,
  PortfolioHoldingRecord,
  PortfolioSheetColumnKey,
  PortfolioSheetRow,
} from './types'

type CsvValue = string | number | boolean | null | undefined

const UTF8_BOM = '\uFEFF'

const REPORT_COLUMNS: Array<{ header: string; key: PortfolioSheetColumnKey }> = [
  { header: '순서', key: 'order' },
  { header: '종목', key: 'ticker' },
  { header: '50일선', key: 'spark50' },
  { header: '어제종가', key: 'prevClose' },
  { header: '오늘', key: 'currentPrice' },
  { header: '변동(%)', key: 'dailyChangePct' },
  { header: '오늘 수익', key: 'todayPnl' },
  { header: '평단가', key: 'avgPrice' },
  { header: '평가액', key: 'marketValue' },
  { header: '매수총액', key: 'costBasis' },
  { header: 'RSI', key: 'rsi' },
  { header: '포지션(%)', key: 'positionPct' },
  { header: '주식수', key: 'shares' },
  { header: '누적수익률(%)', key: 'pnlPct' },
  { header: '누적수익금($)', key: 'pnl' },
  { header: 'MDD', key: 'mdd' },
  { header: 'Volume(K)', key: 'volumeK' },
  { header: 'H52', key: 'high52' },
  { header: 'L52', key: 'low52' },
  { header: 'MA(5)', key: 'ma5' },
  { header: 'MA(120)', key: 'ma120' },
  { header: 'MA(200)', key: 'ma200' },
]

function normalizeCsvValue(value: unknown): CsvValue {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'object') return ''
  return String(value)
}

function csvCell(value: unknown): string {
  const normalized = normalizeCsvValue(value)
  const text = String(normalized ?? '')
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ]
  return `${lines.join('\r\n')}\r\n`
}

export function withUtf8Bom(csv: string): string {
  return csv.startsWith(UTF8_BOM) ? csv : `${UTF8_BOM}${csv}`
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([withUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function portfolioHoldingsToCsv(
  holdings: PortfolioHoldingRecord[],
  activeAccount: PortfolioAccountRecord | null,
): string {
  const headers = ['account', 'ticker', 'shares', 'avg_price', 'cash', 'memo']
  const rows = holdings.map((holding, index) => [
    holding.account_name,
    holding.ticker,
    holding.shares,
    holding.avg_price,
    index === 0 ? activeAccount?.cash ?? 0 : '',
    holding.memo ?? '',
  ])

  return toCsv(headers, rows)
}

export function portfolioReportToCsv(rows: PortfolioSheetRow[]): string {
  return toCsv(
    REPORT_COLUMNS.map((column) => column.header),
    rows.map((row) => REPORT_COLUMNS.map((column) => row[column.key])),
  )
}

export function portfolioSnapshotHistoryToCsv(history: PortfolioDailySnapshotRecord[]): string {
  const headers = [
    'Date',
    'Account',
    'Total_Value',
    'Total_Cost',
    'Cash',
    'PnL',
    'PnL_%',
    'Today_PnL',
    'Delta',
    'Holdings_Count',
  ]
  const rows = history.map((snapshot) => [
    snapshot.date,
    snapshot.account_name,
    snapshot.total_value,
    snapshot.total_cost,
    snapshot.cash,
    snapshot.pnl,
    snapshot.pnl_pct * 100,
    snapshot.today_pnl,
    snapshot.delta,
    snapshot.holdings_count,
  ])

  return toCsv(headers, rows)
}

export function safeCsvFilePart(value: string | null | undefined): string {
  const normalized = String(value || 'account').trim() || 'account'
  return normalized.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
}
