import type { SemiconductorBucketMapping } from './bucketMapping'

export type SoxxHoldingDriverClass =
  | 'internal_driver'
  | 'residual'
  | 'external_confirmer'

export type SoxxHoldingBucketId = SemiconductorBucketMapping['bucketId']

export type SoxxHolding = {
  ticker: string
  name: string
  // Percent weight, e.g. 8.42 means 8.42%. Do not store as decimal weight.
  weightPct: number
  bucketId: SoxxHoldingBucketId | null
  driverClass: SoxxHoldingDriverClass
  asOfDate: string
  sourceNote?: string
}
