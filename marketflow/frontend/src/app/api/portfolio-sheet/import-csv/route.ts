import { NextRequest, NextResponse } from 'next/server'

import { parsePortfolioCsv, supportedPortfolioCsvColumns } from '@/lib/portfolio-sheet/csvImport'
import type { PortfolioCsvImportRow, PortfolioCsvInvalidRow } from '@/lib/portfolio-sheet/csvImport'
import {
  ensurePortfolioSchema,
  getPortfolioHolding,
  portfolioSheetDbPath,
  setPortfolioAccountCash,
  upsertPortfolioHolding,
} from '@/lib/portfolio-sheet/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportCsvRequestBody = {
  csvText?: string
  rows?: PortfolioCsvImportRow[]
  activeAccount?: string | null
}

type ImportCsvResult = {
  parsedRows: number
  inserted: number
  updated: number
  skipped: number
  cashUpdatedAccounts: string[]
  invalidRows: PortfolioCsvInvalidRow[]
  ignoredColumns: string[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeRows(rows: PortfolioCsvImportRow[] | undefined): {
  validRows: PortfolioCsvImportRow[]
  invalidRows: PortfolioCsvInvalidRow[]
  ignoredColumns: string[]
} {
  const validRows: PortfolioCsvImportRow[] = []
  const invalidRows: PortfolioCsvInvalidRow[] = []

  const sourceRows = rows ?? []
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index]
    const sourceRow = row.sourceRow || index + 1
    const ticker = String(row.ticker || '').trim().toUpperCase()
    const accountName = String(row.account_name || '').trim()
    const reasons: string[] = []

    if (!accountName) reasons.push('account is required')
    if (!ticker) reasons.push('ticker is required')
    if (ticker && !/^[A-Z0-9.\-]{1,20}$/.test(ticker)) reasons.push('ticker is invalid')
    if (!isFiniteNumber(row.shares)) reasons.push('shares must be numeric')
    if (!isFiniteNumber(row.avg_price)) reasons.push('avg_price must be numeric')
    if (isFiniteNumber(row.shares) && row.shares < 0) reasons.push('shares must be >= 0')
    if (isFiniteNumber(row.avg_price) && row.avg_price < 0) reasons.push('avg_price must be >= 0')

    if (reasons.length > 0) {
      invalidRows.push({
        sourceRow,
        reason: reasons.join('; '),
        raw: {
          account: accountName,
          ticker,
          shares: String(row.shares ?? ''),
          avg_price: String(row.avg_price ?? ''),
        },
      })
      continue
    }

    validRows.push({
      sourceRow,
      account_name: accountName,
      ticker,
      shares: row.shares,
      avg_price: row.avg_price,
      cash: isFiniteNumber(row.cash) ? row.cash : null,
      memo: row.memo ? String(row.memo) : null,
    })
  }

  return { validRows, invalidRows, ignoredColumns: [] }
}

export async function POST(req: NextRequest) {
  ensurePortfolioSchema()

  try {
    const body = (await req.json().catch(() => ({}))) as ImportCsvRequestBody
    const parsed = body.csvText
      ? parsePortfolioCsv(body.csvText, body.activeAccount ?? null)
      : normalizeRows(body.rows)
    const result: ImportCsvResult = {
      parsedRows: parsed.validRows.length + parsed.invalidRows.length,
      inserted: 0,
      updated: 0,
      skipped: parsed.invalidRows.length,
      cashUpdatedAccounts: [],
      invalidRows: [...parsed.invalidRows],
      ignoredColumns: parsed.ignoredColumns,
    }
    const cashUpdated = new Set<string>()

    for (const row of parsed.validRows) {
      try {
        const existing = getPortfolioHolding(row.account_name, row.ticker)
        upsertPortfolioHolding({
          account_name: row.account_name,
          ticker: row.ticker,
          shares: row.shares,
          avg_price: row.avg_price,
          memo: row.memo,
          active: true,
        })

        if (existing) result.updated += 1
        else result.inserted += 1

        if (isFiniteNumber(row.cash)) {
          setPortfolioAccountCash(row.account_name, row.cash)
          cashUpdated.add(row.account_name)
        }
      } catch (error) {
        result.skipped += 1
        result.invalidRows.push({
          sourceRow: row.sourceRow,
          reason: error instanceof Error ? error.message : 'Failed to upsert row',
          raw: {
            account: row.account_name,
            ticker: row.ticker,
            shares: String(row.shares),
            avg_price: String(row.avg_price),
          },
        })
      }
    }

    result.cashUpdatedAccounts = Array.from(cashUpdated)

    return NextResponse.json({
      imported: true,
      result,
      supportedColumns: supportedPortfolioCsvColumns(),
      db: {
        strategy: 'sqlite',
        path: portfolioSheetDbPath(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import CSV' },
      { status: 400 },
    )
  }
}
