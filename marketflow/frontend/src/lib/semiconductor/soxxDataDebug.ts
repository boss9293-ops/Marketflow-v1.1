import type { SoxxDataFreshnessResult } from './soxxDataFreshness'

export type SoxxDebugStatus =
  | 'pass'
  | 'partial'
  | 'fail'
  | 'unknown'

export type SoxxDataDebugSection = {
  id: string
  label: string
  status: SoxxDebugStatus
  summary: string
  details?: string[]
}

export type SoxxDataDebugSummary = {
  overallStatus: SoxxDebugStatus
  generatedAt: string
  sections: SoxxDataDebugSection[]
  warnings: string[]
}

type AvailabilityStatus = 'available' | 'partial' | 'unavailable'

type GenerationLogOutput = {
  file: string
  status: string
  records?: number
  warnings?: string[]
}

type BuildSoxxDataDebugSummaryParams = {
  generationLog?: {
    lastRunAt?: string | null
    status?: string | null
    outputs?: GenerationLogOutput[]
    missingTickers?: string[]
    warnings?: string[]
    error?: string | null
  }
  holdings?: {
    asOf?: string
    totalWeightPct?: number
    holdingCount?: number
    selectedCoveragePct?: number
    residualPct?: number
    duplicateTickers?: string[]
    missingWeightTickers?: string[]
  }
  bucketMapping?: {
    selectedBuckets?: Array<{
      label: string
      tickers: string[]
    }>
    missingSelectedTickers?: string[]
    duplicateBucketTickers?: string[]
    residualRuleOk?: boolean
  }
  returns?: {
    source?: string
    asOf?: string
    status?: AvailabilityStatus
    freshness?: SoxxDataFreshnessResult
    availableTickerCount?: number
    totalTickerCount?: number
    missingTickers?: string[]
    warnings?: string[]
  }
  contribution?: {
    source?: string
    asOf?: string
    status?: AvailabilityStatus
    freshness?: SoxxDataFreshnessResult
    selectedContributionPctPoint?: number | null
    residualContributionPctPoint?: number | null
    missingTickers?: string[]
    warnings?: string[]
  }
  history?: {
    source?: string
    asOf?: string
    status?: AvailabilityStatus
    freshness?: SoxxDataFreshnessResult
    pointCount?: number
    daysRequested?: number
    warnings?: string[]
  }
}

function formatPct(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  return `${value.toFixed(5)}%`
}

function formatPctPoint(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%p`
}

function availabilityToDebugStatus(status: AvailabilityStatus | undefined): SoxxDebugStatus {
  if (!status) return 'unknown'
  if (status === 'available') return 'pass'
  if (status === 'partial') return 'partial'
  return 'fail'
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function buildFreshnessWarning(
  sectionLabel: string,
  freshness: SoxxDataFreshnessResult | undefined,
): string | null {
  if (!freshness || freshness.status === 'unknown') {
    return `${sectionLabel} freshness is unknown.`
  }
  if (freshness.status === 'fresh') return null
  if (freshness.status === 'delayed') {
    return `${sectionLabel} freshness is delayed. ${freshness.detail}`
  }
  return `${sectionLabel} freshness is stale. ${freshness.detail}`
}

function buildOverallStatus(sections: SoxxDataDebugSection[]): SoxxDebugStatus {
  if (sections.some((section) => section.status === 'fail')) return 'fail'
  if (sections.some((section) => section.status === 'partial' || section.status === 'unknown')) return 'partial'
  return 'pass'
}

export function buildSoxxDataDebugSummary(
  params: BuildSoxxDataDebugSummaryParams,
): SoxxDataDebugSummary {
  const sections: SoxxDataDebugSection[] = []
  const warnings: string[] = []

  if (params.generationLog !== undefined) {
    const log = params.generationLog
    const logStatus = log?.status
    const logError = log?.error ?? null
    const logMissing = log?.missingTickers ?? []
    const logOutputs = log?.outputs ?? []
    const logWarnings = log?.warnings ?? []

    let status: SoxxDebugStatus = 'unknown'
    if (!log || !logStatus) {
      status = 'unknown'
    } else if (logError || logStatus === 'failed') {
      status = 'fail'
    } else if (logStatus === 'available') {
      status = 'pass'
    } else {
      status = 'partial'
    }

    const outputDetails = logOutputs.map((output) =>
      `${output.file}: ${output.status.toUpperCase()}${output.records !== undefined ? ` (${output.records} records)` : ''}`,
    )
    const details = [
      `Last run: ${log?.lastRunAt ?? 'Unknown'}`,
      `Status: ${logStatus ?? 'unknown'}`,
      ...outputDetails,
      `Missing tickers: ${logMissing.length > 0 ? logMissing.join(', ') : 'None'}`,
      `Warnings: ${logWarnings.length}`,
      ...(logError ? [`Error: ${logError}`] : []),
    ]

    if (logError) warnings.push(`Generation log error: ${logError}`)
    if (logMissing.length > 0) warnings.push(`Generation missing tickers: ${logMissing.join(', ')}.`)

    sections.push({
      id: 'generation_output',
      label: 'Contribution Output Health',
      status,
      summary:
        status === 'pass'
          ? 'Contribution outputs generated successfully.'
          : status === 'partial'
            ? `Contribution outputs generated with warnings. Missing: ${logMissing.length > 0 ? logMissing.join(', ') : 'None'}.`
            : status === 'fail'
              ? `Contribution output generation failed.${logError ? ` ${logError}` : ''}`
              : 'Generation log not yet loaded.',
      details,
    })
  }

  if (!params.holdings) {
    sections.push({
      id: 'holdings',
      label: 'Holdings',
      status: 'unknown',
      summary: 'Holdings debug input is not wired yet.',
    })
  } else {
    const duplicateTickers = params.holdings.duplicateTickers ?? []
    const missingWeightTickers = params.holdings.missingWeightTickers ?? []
    const holdingCount = params.holdings.holdingCount ?? 0
    const totalWeight = params.holdings.totalWeightPct
    const asOf = params.holdings.asOf
    const isWeightNearHundred =
      typeof totalWeight === 'number' &&
      Number.isFinite(totalWeight) &&
      totalWeight >= 95 &&
      totalWeight <= 105

    let status: SoxxDebugStatus = 'pass'
    if (!asOf || holdingCount <= 0) status = 'fail'
    else if (!isWeightNearHundred || duplicateTickers.length > 0 || missingWeightTickers.length > 0) status = 'partial'

    const details = [
      `As-of: ${asOf ?? 'Unavailable'}`,
      `Holdings: ${holdingCount}`,
      `Total weight: ${formatPct(totalWeight)}`,
      `Selected coverage: ${formatPct(params.holdings.selectedCoveragePct)}`,
      `Residual: ${formatPct(params.holdings.residualPct)}`,
      `Duplicate tickers: ${duplicateTickers.length > 0 ? duplicateTickers.join(', ') : 'None'}`,
      `Missing/zero weight tickers: ${missingWeightTickers.length > 0 ? missingWeightTickers.join(', ') : 'None'}`,
    ]

    if (!isWeightNearHundred) warnings.push('Holdings total weight is outside the expected near-100% range.')
    if (duplicateTickers.length > 0) warnings.push(`Duplicate holdings tickers detected: ${duplicateTickers.join(', ')}.`)
    if (missingWeightTickers.length > 0) warnings.push(`Holdings with missing/non-positive weights: ${missingWeightTickers.join(', ')}.`)

    sections.push({
      id: 'holdings',
      label: 'Holdings',
      status,
      summary:
        status === 'pass'
          ? `SOXX holdings loaded (${holdingCount}).`
          : status === 'partial'
            ? 'SOXX holdings loaded with data quality warnings.'
            : 'SOXX holdings are unavailable or incomplete.',
      details,
    })
  }

  if (!params.bucketMapping) {
    sections.push({
      id: 'bucket_mapping',
      label: 'Bucket Mapping',
      status: 'unknown',
      summary: 'Bucket mapping debug input is not wired yet.',
    })
  } else {
    const selectedBuckets = params.bucketMapping.selectedBuckets ?? []
    const missingSelectedTickers = params.bucketMapping.missingSelectedTickers ?? []
    const duplicateBucketTickers = params.bucketMapping.duplicateBucketTickers ?? []
    const residualRuleOk = params.bucketMapping.residualRuleOk

    let status: SoxxDebugStatus = 'pass'
    if (selectedBuckets.length === 0) status = 'fail'
    else if (
      missingSelectedTickers.length > 0 ||
      duplicateBucketTickers.length > 0 ||
      residualRuleOk === false
    ) status = 'partial'

    const details = [
      ...selectedBuckets.map((bucket) => `${bucket.label}: ${bucket.tickers.join(' / ')}`),
      `Missing selected tickers in holdings: ${missingSelectedTickers.length > 0 ? missingSelectedTickers.join(', ') : 'None'}`,
      `Duplicate selected tickers across buckets: ${duplicateBucketTickers.length > 0 ? duplicateBucketTickers.join(', ') : 'None'}`,
      `Residual rule (unmapped holdings -> residual): ${residualRuleOk === false ? 'Check required' : 'OK'}`,
    ]

    if (missingSelectedTickers.length > 0) warnings.push(`Bucket mapping missing tickers in holdings: ${missingSelectedTickers.join(', ')}.`)
    if (duplicateBucketTickers.length > 0) warnings.push(`Duplicate selected tickers across buckets: ${duplicateBucketTickers.join(', ')}.`)
    if (residualRuleOk === false) warnings.push('Residual mapping rule check failed.')

    sections.push({
      id: 'bucket_mapping',
      label: 'Bucket Mapping',
      status,
      summary:
        status === 'pass'
          ? 'Selected bucket mapping is consistent.'
          : status === 'partial'
            ? 'Selected bucket mapping is available with warnings.'
            : 'Selected bucket mapping is unavailable.',
      details,
    })
  }

  if (!params.returns) {
    sections.push({
      id: 'returns',
      label: 'Returns',
      status: 'unknown',
      summary: 'Return adapter debug input is not wired yet.',
    })
  } else {
    const statusFromAvailability = availabilityToDebugStatus(params.returns.status)
    const missingTickers = params.returns.missingTickers ?? []
    const sectionWarnings = params.returns.warnings ?? []
    const availableCount = params.returns.availableTickerCount ?? 0
    const totalCount = params.returns.totalTickerCount ?? 0
    const hasCoverageGap = totalCount > 0 && availableCount < totalCount
    const freshnessWarning = buildFreshnessWarning('Returns', params.returns.freshness)

    const status =
      statusFromAvailability === 'pass' &&
      !hasCoverageGap &&
      missingTickers.length === 0 &&
      sectionWarnings.length === 0 &&
      !freshnessWarning
        ? 'pass'
        : statusFromAvailability === 'fail'
          ? 'fail'
          : 'partial'

    const details = [
      `Source: ${params.returns.source ?? 'Unavailable'}`,
      `As-of: ${params.returns.asOf ?? 'Unavailable'}`,
      `Status: ${params.returns.status ?? 'unknown'}`,
      `Freshness: ${params.returns.freshness?.label ?? 'Unknown'}`,
      `Freshness detail: ${params.returns.freshness?.detail ?? 'As-of date is unavailable.'}`,
      `Available: ${availableCount} / ${totalCount}`,
      `Missing tickers: ${missingTickers.length > 0 ? missingTickers.join(', ') : 'None'}`,
      ...sectionWarnings.map((warning) => `Warning: ${warning}`),
    ]

    warnings.push(...sectionWarnings)
    if (hasCoverageGap || missingTickers.length > 0) {
      warnings.push(`Return coverage is partial (${availableCount}/${totalCount}).`)
    }
    if (freshnessWarning) warnings.push(freshnessWarning)

    sections.push({
      id: 'returns',
      label: 'Returns',
      status,
      summary:
        status === 'pass'
          ? 'Return adapter is fully connected.'
          : status === 'partial'
            ? 'Return adapter is connected with partial coverage.'
            : 'Return adapter is unavailable.',
      details,
    })
  }

  if (!params.contribution) {
    sections.push({
      id: 'contribution',
      label: 'Contribution',
      status: 'unknown',
      summary: 'Contribution debug input is not wired yet.',
    })
  } else {
    const statusFromAvailability = availabilityToDebugStatus(params.contribution.status)
    const missingTickers = params.contribution.missingTickers ?? []
    const sectionWarnings = params.contribution.warnings ?? []
    const freshnessWarning = buildFreshnessWarning('Contribution snapshot', params.contribution.freshness)

    const status =
      statusFromAvailability === 'pass' &&
      missingTickers.length === 0 &&
      sectionWarnings.length === 0 &&
      !freshnessWarning
        ? 'pass'
        : statusFromAvailability === 'fail'
          ? 'fail'
          : 'partial'

    const selected = params.contribution.selectedContributionPctPoint
    const residual = params.contribution.residualContributionPctPoint
    const total =
      typeof selected === 'number' && Number.isFinite(selected) &&
      typeof residual === 'number' && Number.isFinite(residual)
        ? selected + residual
        : null

    const details = [
      `Source: ${params.contribution.source ?? 'Unavailable'}`,
      `As-of: ${params.contribution.asOf ?? 'Unavailable'}`,
      `Status: ${params.contribution.status ?? 'unknown'}`,
      `Freshness: ${params.contribution.freshness?.label ?? 'Unknown'}`,
      `Freshness detail: ${params.contribution.freshness?.detail ?? 'As-of date is unavailable.'}`,
      `Selected contribution: ${formatPctPoint(selected)}`,
      `Residual contribution: ${formatPctPoint(residual)}`,
      `Total contribution: ${formatPctPoint(total)}`,
      `Missing tickers: ${missingTickers.length > 0 ? missingTickers.join(', ') : 'None'}`,
      ...sectionWarnings.map((warning) => `Warning: ${warning}`),
    ]

    warnings.push(...sectionWarnings)
    if (missingTickers.length > 0) warnings.push(`Contribution is missing ticker returns: ${missingTickers.join(', ')}.`)
    if (freshnessWarning) warnings.push(freshnessWarning)

    sections.push({
      id: 'contribution',
      label: 'Contribution',
      status,
      summary:
        status === 'pass'
          ? 'Contribution calculation is available.'
          : status === 'partial'
            ? 'Contribution calculation is partial.'
            : 'Contribution calculation is unavailable.',
      details,
    })
  }

  if (!params.history) {
    sections.push({
      id: 'history',
      label: 'Contribution History',
      status: 'unknown',
      summary: 'History debug input is not wired yet.',
    })
  } else {
    const statusFromAvailability = availabilityToDebugStatus(params.history.status)
    const sectionWarnings = params.history.warnings ?? []
    const pointCount = params.history.pointCount ?? 0
    const daysRequested = params.history.daysRequested ?? 0
    const freshnessWarning = buildFreshnessWarning('Contribution history', params.history.freshness)

    const status =
      statusFromAvailability === 'pass' && sectionWarnings.length === 0 && !freshnessWarning
        ? 'pass'
        : statusFromAvailability === 'fail'
          ? 'fail'
          : 'partial'

    const details = [
      `Source: ${params.history.source ?? 'Unavailable'}`,
      `As-of: ${params.history.asOf ?? 'Unavailable'}`,
      `Status: ${params.history.status ?? 'unknown'}`,
      `Freshness: ${params.history.freshness?.label ?? 'Unknown'}`,
      `Freshness detail: ${params.history.freshness?.detail ?? 'As-of date is unavailable.'}`,
      `Days requested: ${daysRequested}`,
      `Points generated: ${pointCount}`,
      ...sectionWarnings.map((warning) => `Warning: ${warning}`),
    ]

    warnings.push(...sectionWarnings)
    if (freshnessWarning) warnings.push(freshnessWarning)

    sections.push({
      id: 'history',
      label: 'Contribution History',
      status,
      summary:
        status === 'pass'
          ? 'Contribution history is available.'
          : status === 'partial'
            ? 'Contribution history is partial.'
            : 'Contribution history is unavailable.',
      details,
    })
  }

  const dedupedWarnings = dedupe(warnings)
  sections.push({
    id: 'warnings',
    label: 'Warnings',
    status: dedupedWarnings.length > 0 ? 'partial' : 'pass',
    summary:
      dedupedWarnings.length > 0
        ? `${dedupedWarnings.length} warning(s) reported.`
        : 'No warnings reported.',
    details: dedupedWarnings,
  })

  return {
    overallStatus: buildOverallStatus(sections),
    generatedAt: new Date().toISOString(),
    sections,
    warnings: dedupedWarnings,
  }
}
