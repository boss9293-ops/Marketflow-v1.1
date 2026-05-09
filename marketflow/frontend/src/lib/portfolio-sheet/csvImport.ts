export type PortfolioCsvImportRow = {
  sourceRow: number
  account_name: string
  ticker: string
  shares: number
  avg_price: number
  cash?: number | null
  memo?: string | null
}

export type PortfolioCsvInvalidRow = {
  sourceRow: number
  reason: string
  raw: Record<string, string>
}

export type PortfolioCsvParseResult = {
  headers: string[]
  validRows: PortfolioCsvImportRow[]
  invalidRows: PortfolioCsvInvalidRow[]
  ignoredColumns: string[]
}

const COLUMN_ALIASES = {
  account_name: ['account', 'account_name', 'account name', '계좌', '계좌명'],
  ticker: ['ticker', 'symbol', '종목'],
  shares: ['shares', 'share', 'quantity', 'qty', '주식수', '수량'],
  avg_price: ['avg_price', 'avgprice', 'avg price', 'average price', 'avg_cost', '평단가', '평균단가'],
  cash: ['cash', 'cash_balance', 'cash balance', '현금잔고', '현금'],
  memo: ['memo', 'note', 'notes', '메모', '비고'],
} as const

const CALCULATED_COLUMN_HINTS = [
  '현재가',
  '오늘',
  '어제종가',
  '평가액',
  '매수총액',
  '수익률',
  '수익금',
  'rsi',
  'mdd',
  'ma',
  'volume',
  '변동',
  '포지션',
]

type CanonicalColumn = keyof typeof COLUMN_ALIASES

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function canonicalColumn(header: string): CanonicalColumn | null {
  const normalized = normalizeHeader(header)

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as Array<[CanonicalColumn, readonly string[]]>) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return key
  }

  return null
}

function isLikelyCalculatedColumn(header: string): boolean {
  const normalized = normalizeHeader(header)
  return CALCULATED_COLUMN_HINTS.some((hint) => normalized.includes(normalizeHeader(hint)))
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseNumber(value: string): number | null {
  const text = asText(value)
  if (!text || text === '-') return null

  const negative = /^\(.*\)$/.test(text)
  const normalized = text.replace(/[$,%]/g, '').replace(/,/g, '').replace(/[()]/g, '').trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const next = csvText[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => asText(value))) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => asText(value))) rows.push(row)
  return rows
}

function rawRecord(headers: string[], values: string[]): Record<string, string> {
  return headers.reduce((record, header, index) => {
    record[header] = asText(values[index])
    return record
  }, {} as Record<string, string>)
}

function readMappedValue(
  record: Record<string, string>,
  columnMap: Partial<Record<CanonicalColumn, string>>,
  key: CanonicalColumn,
): string {
  const header = columnMap[key]
  return header ? asText(record[header]) : ''
}

export function parsePortfolioCsv(csvText: string, defaultAccount: string | null = null): PortfolioCsvParseResult {
  const rows = parseCsvRows(csvText)
  const headers = (rows[0] ?? []).map((header) => asText(header).replace(/^\uFEFF/, ''))
  const dataRows = rows.slice(1)
  const columnMap: Partial<Record<CanonicalColumn, string>> = {}
  const ignoredColumns: string[] = []

  for (const header of headers) {
    const canonical = canonicalColumn(header)
    if (canonical && !columnMap[canonical]) {
      columnMap[canonical] = header
    } else if (header && (canonical || isLikelyCalculatedColumn(header))) {
      ignoredColumns.push(header)
    }
  }

  const validRows: PortfolioCsvImportRow[] = []
  const invalidRows: PortfolioCsvInvalidRow[] = []

  if (headers.length === 0) {
    return {
      headers: [],
      validRows,
      invalidRows: [{ sourceRow: 1, reason: 'CSV header row is missing', raw: {} }],
      ignoredColumns,
    }
  }

  for (let index = 0; index < dataRows.length; index += 1) {
    const values = dataRows[index]
    const sourceRow = index + 2
    const raw = rawRecord(headers, values)
    const account = readMappedValue(raw, columnMap, 'account_name') || asText(defaultAccount)
    const ticker = readMappedValue(raw, columnMap, 'ticker').toUpperCase().replace(/\s+/g, '')
    const shares = parseNumber(readMappedValue(raw, columnMap, 'shares'))
    const avgPrice = parseNumber(readMappedValue(raw, columnMap, 'avg_price'))
    const cash = parseNumber(readMappedValue(raw, columnMap, 'cash'))
    const memo = readMappedValue(raw, columnMap, 'memo') || null

    const reasons: string[] = []
    if (!account) reasons.push('account is required')
    if (!ticker) reasons.push('ticker is required')
    if (ticker && !/^[A-Z0-9.\-]{1,20}$/.test(ticker)) reasons.push('ticker is invalid')
    if (shares === null) reasons.push('shares must be numeric')
    if (avgPrice === null) reasons.push('avg_price must be numeric')
    if (shares !== null && shares < 0) reasons.push('shares must be >= 0')
    if (avgPrice !== null && avgPrice < 0) reasons.push('avg_price must be >= 0')

    if (reasons.length > 0) {
      invalidRows.push({ sourceRow, reason: reasons.join('; '), raw })
      continue
    }

    validRows.push({
      sourceRow,
      account_name: account,
      ticker,
      shares: shares as number,
      avg_price: avgPrice as number,
      cash,
      memo,
    })
  }

  return {
    headers,
    validRows,
    invalidRows,
    ignoredColumns: Array.from(new Set(ignoredColumns)),
  }
}

export function supportedPortfolioCsvColumns(): string[] {
  return [
    'account',
    'ticker / symbol / 종목',
    'shares / 주식수',
    'avg_price / 평단가',
    'cash / 현금잔고',
    'memo / 메모',
  ]
}
