import type { SoxxHolding } from './soxxHoldings'

export type SoxxCoverageSummary = {
  selectedCoveragePct: number
  residualPct: number
  totalWeightPct: number
  matchedHoldingsCount: number
  residualHoldingsCount: number
  asOfDate: string | null
  isPlaceholder: boolean
}

export type SoxxHoldingsValidation = {
  totalWeightPct: number
  isNearHundred: boolean
  missingWeightCount: number
  duplicateTickers: string[]
  selectedCoveragePct: number
  residualPct: number
  asOfDate: string | null
  warnings: string[]
}

export function computeSoxxCoverageSummary(
  holdings: SoxxHolding[],
  selectedBucketIds: readonly string[],
): SoxxCoverageSummary {
  const selectedSet = new Set(selectedBucketIds)

  const totalWeightPct = holdings.reduce(
    (sum, holding) => sum + (Number.isFinite(holding.weightPct) ? holding.weightPct : 0),
    0,
  )

  const selectedHoldings = holdings.filter(
    (holding) => holding.bucketId !== null && selectedSet.has(holding.bucketId),
  )

  const selectedCoveragePct = selectedHoldings.reduce(
    (sum, holding) => sum + (Number.isFinite(holding.weightPct) ? holding.weightPct : 0),
    0,
  )

  const residualPct = Math.max(0, totalWeightPct - selectedCoveragePct)

  const asOfDate = holdings.length > 0 ? holdings[0].asOfDate : null

  const isPlaceholder =
    !asOfDate ||
    asOfDate.includes('STATIC_SAMPLE') ||
    totalWeightPct === 0

  return {
    selectedCoveragePct,
    residualPct,
    totalWeightPct,
    matchedHoldingsCount: selectedHoldings.length,
    residualHoldingsCount: Math.max(0, holdings.length - selectedHoldings.length),
    asOfDate,
    isPlaceholder,
  }
}

export function validateSoxxHoldingsSnapshot(
  holdings: SoxxHolding[],
  selectedBucketIds: readonly string[],
): SoxxHoldingsValidation {
  const warnings: string[] = []

  const totalWeightPct = holdings.reduce(
    (sum, holding) => sum + (Number.isFinite(holding.weightPct) ? holding.weightPct : 0),
    0,
  )

  const isNearHundred = totalWeightPct >= 95 && totalWeightPct <= 105

  if (!isNearHundred) {
    warnings.push(`Total SOXX holdings weight is ${totalWeightPct.toFixed(2)}%, expected near 100%.`)
  }

  const missingWeightCount = holdings.filter(
    (holding) => !Number.isFinite(holding.weightPct) || holding.weightPct <= 0,
  ).length

  if (missingWeightCount > 0) {
    warnings.push(`${missingWeightCount} holdings have missing or non-positive weights.`)
  }

  const seenTickers = new Set<string>()
  const duplicateTickers: string[] = []

  for (const holding of holdings) {
    const ticker = holding.ticker.trim().toUpperCase()

    if (seenTickers.has(ticker) && !duplicateTickers.includes(ticker)) {
      duplicateTickers.push(ticker)
    }

    seenTickers.add(ticker)
  }

  if (duplicateTickers.length > 0) {
    warnings.push(`Duplicate tickers found: ${duplicateTickers.join(', ')}`)
  }

  const summary = computeSoxxCoverageSummary(holdings, selectedBucketIds)

  if (summary.isPlaceholder) {
    warnings.push('SOXX holdings snapshot appears to be placeholder data.')
  }

  return {
    totalWeightPct,
    isNearHundred,
    missingWeightCount,
    duplicateTickers,
    selectedCoveragePct: summary.selectedCoveragePct,
    residualPct: summary.residualPct,
    asOfDate: summary.asOfDate,
    warnings,
  }
}
