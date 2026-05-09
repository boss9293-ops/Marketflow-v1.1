import type { SoxxHoldingReturn } from './soxxContribution'

export type SoxxContributionPeriod = '1D' | '5D' | '1M'

export const SOXX_CONTRIBUTION_PERIODS: SoxxContributionPeriod[] = [
  '1D',
  '5D',
  '1M',
]

export type RawSoxxReturnInput = {
  ticker: string
  returnPct: number
}

export type RawSoxxMultiPeriodReturnInput = {
  ticker: string
  return1D?: number | null
  return5D?: number | null
  return1M?: number | null
}

export function buildSoxxHoldingReturnsFromRaw(
  rows: RawSoxxReturnInput[],
  periodLabel: string,
): SoxxHoldingReturn[] {
  return rows
    .filter((row) => row.ticker && Number.isFinite(row.returnPct))
    .map((row) => ({
      ticker: row.ticker.trim().toUpperCase(),
      returnPct: row.returnPct,
      periodLabel,
    }))
}

export function buildSoxxHoldingReturnsForPeriod(
  rows: RawSoxxMultiPeriodReturnInput[],
  period: SoxxContributionPeriod,
): SoxxHoldingReturn[] {
  return rows
    .flatMap((row) => {
      const ticker = row.ticker?.trim().toUpperCase()
      if (!ticker) return []

      let returnPct: number | null | undefined

      if (period === '1D') returnPct = row.return1D
      if (period === '5D') returnPct = row.return5D
      if (period === '1M') returnPct = row.return1M

      if (!Number.isFinite(returnPct)) return []

      return [{
        ticker,
        returnPct: returnPct as number,
        periodLabel: period,
      }]
    })
}

export function hasSoxxReturnDataForPeriod(
  rows: RawSoxxMultiPeriodReturnInput[],
  period: SoxxContributionPeriod,
): boolean {
  return buildSoxxHoldingReturnsForPeriod(rows, period).length > 0
}

export function getAvailableSoxxContributionPeriods(
  rows: RawSoxxMultiPeriodReturnInput[],
): SoxxContributionPeriod[] {
  return SOXX_CONTRIBUTION_PERIODS.filter((period) =>
    hasSoxxReturnDataForPeriod(rows, period),
  )
}
