import { loadPortfolioSheetSample } from './sampleAdapter'
import { seedPortfolioHoldings } from './storage'
import type { SeedPortfolioResult } from './storage'

export type SeedPortfolioSheetFromSampleOptions = {
  account?: string | null
  overwrite?: boolean
}

export type SeedPortfolioSheetFromSampleResult = SeedPortfolioResult & {
  overwrite: boolean
  sourceRows: number
  candidateRows: number
  seededRows: number
  accounts: string[]
  notImportedRows: Array<{
    sourceRow: number
    account: string | null
    ticker: string | null
    reason: string
  }>
}

export async function seedPortfolioSheetFromLinkedSample(
  options: SeedPortfolioSheetFromSampleOptions = {},
): Promise<SeedPortfolioSheetFromSampleResult> {
  const sample = await loadPortfolioSheetSample()
  const accountFilter = options.account?.trim()
  const fallbackAccount = accountFilter || sample.activeAccount || null
  const candidates = []
  const notImportedRows: SeedPortfolioSheetFromSampleResult['notImportedRows'] = []

  for (let index = 0; index < sample.allRows.length; index += 1) {
    const row = sample.allRows[index]
    const sourceRow = index + 1
    const accountName = row.account?.trim() || fallbackAccount
    const reasons: string[] = []

    if (accountFilter && accountName !== accountFilter) reasons.push(`account does not match selected account ${accountFilter}`)
    if (!accountName) reasons.push('account is missing')
    if (!row.ticker) reasons.push('ticker is missing')
    if (typeof row.shares !== 'number' || !Number.isFinite(row.shares)) reasons.push('shares is missing or not numeric')
    if (typeof row.avgPrice !== 'number' || !Number.isFinite(row.avgPrice)) reasons.push('avg_price is missing or not numeric')

    if (reasons.length > 0) {
      notImportedRows.push({
        sourceRow,
        account: accountName,
        ticker: row.ticker || null,
        reason: reasons.join('; '),
      })
      continue
    }

    candidates.push({
      account_name: accountName as string,
      ticker: row.ticker,
      shares: row.shares as number,
      avg_price: row.avgPrice as number,
    })
  }

  const result = seedPortfolioHoldings(candidates, options.overwrite === true)

  return {
    ...result,
    overwrite: options.overwrite === true,
    sourceRows: sample.allRows.length,
    candidateRows: candidates.length,
    seededRows: candidates.length,
    accounts: Array.from(new Set(candidates.map((row) => row.account_name))),
    notImportedRows,
  }
}
