export type BenchmarkValidationStatus =
  | 'validated'
  | 'partial'
  | 'needs_review'

export type SoxxBenchmarkMethodologySummary = {
  fundTicker: string
  fundName: string
  benchmarkName: string
  benchmarkProvider: string
  verificationDate: string
  methodologyAsOfDate?: string
  methodologySourceNote: string
  validationStatus: BenchmarkValidationStatus
  userFacingRole: 'validation_anchor'
  sourceUrls: string[]
  notes: string[]
  guardrails: string[]
}

export const SOXX_BENCHMARK_METHODOLOGY_SUMMARY: SoxxBenchmarkMethodologySummary = {
  fundTicker: 'SOXX',
  fundName: 'iShares Semiconductor ETF',
  benchmarkName: 'NYSE Semiconductor Index',
  benchmarkProvider: 'ICE Data Indices, LLC',
  verificationDate: '2026-05-01',
  methodologySourceNote:
    'Benchmark name verified from the official iShares SOXX fund page. ICE official index-name-change notice confirms ICESEMIT maps to NYSE Semiconductor Index (TR). Public methodology details were cross-checked from an SEC-filed pricing supplement; full ICE methodology access may require the ICE Index Platform.',
  validationStatus: 'partial',
  userFacingRole: 'validation_anchor',
  sourceUrls: [
    'https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf',
    'https://www.ice.com/publicdocs/ice/notifications/adhoc/110000725074/ICEBIO_ICESEMI_Index_Name_Changes_20231013.pdf',
    'https://www.sec.gov/Archives/edgar/data/927971/000183988226009157/bmo5509_424b2-05728.htm',
  ],
  notes: [
    'SOXX remains the user-facing anchor in the Semiconductor Lens.',
    'SOXX holdings remain the calculation anchor.',
    'Benchmark methodology is used only for structural validation.',
    'The benchmark is described as a modified float-adjusted market capitalization-weighted semiconductor index in public documentation.',
  ],
  guardrails: [
    'Do not replace SOXX with the benchmark index as the primary user-facing anchor.',
    'Do not present benchmark validation as a forecast.',
    'Do not use benchmark methodology as a buy/sell signal.',
    'Do not present benchmark methodology as holding-weighted SOXX contribution attribution.',
  ],
}

export function getSoxxBenchmarkTrustLabel(
  summary: SoxxBenchmarkMethodologySummary,
): string {
  if (summary.validationStatus === 'validated') {
    return 'Benchmark methodology validated'
  }

  if (summary.validationStatus === 'partial') {
    return 'Benchmark methodology partially verified'
  }

  return 'Benchmark methodology pending review'
}

export function getSoxxBenchmarkShortName(
  summary: SoxxBenchmarkMethodologySummary,
): string {
  return summary.benchmarkName && !summary.benchmarkName.includes('VERIFY')
    ? summary.benchmarkName
    : 'Semiconductor benchmark'
}
