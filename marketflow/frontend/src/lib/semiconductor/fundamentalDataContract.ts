// 반도체 L1/L2 펀더멘털 데이터의 타입 계약 — 모든 정적/캐시/라이브 전환의 기반

export type DataStatus =
  | 'LIVE'
  | 'CACHE'
  | 'STATIC'
  | 'MANUAL'
  | 'PENDING'
  | 'UNAVAILABLE'

export type UpdateFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'manual'
  | 'unknown'

export interface FundamentalMetric {
  id: string
  label: string
  value: number | string | null
  unit?: string
  displayValue: string
  status: DataStatus
  source: string
  sourceUrl?: string
  asOf?: string
  updatedAt?: string
  frequency: UpdateFrequency
  note?: string
}

export interface DataStatusSummary {
  live: number
  cache: number
  static: number
  manual: number
  pending: number
  unavailable: number
}

export interface SemiconductorFundamentalsPayload {
  generatedAt: string
  dataStatusSummary: DataStatusSummary
  l1Fundamentals: {
    tsmcRevenueYoY: FundamentalMetric
    bookToBill: FundamentalMetric
    siaSemiSales: FundamentalMetric
    nvdaDataCenterRevenue: FundamentalMetric
  }
  l2CapitalFlow: {
    hyperscalerCapex: FundamentalMetric
    microsoftCapex?: FundamentalMetric
    amazonCapex?: FundamentalMetric
    googleCapex?: FundamentalMetric
    metaCapex?: FundamentalMetric
    hbmSupply?: FundamentalMetric
    asmlOrders?: FundamentalMetric
    dataCenterPowerDemand?: FundamentalMetric
  }
  l3MarketConfirmation: {
    soxxReflection: FundamentalMetric
    soxlDecay: FundamentalMetric
  }
}

export const PENDING_METRIC = (id: string, label: string): FundamentalMetric => ({
  id,
  label,
  value: null,
  displayValue: '—',
  status: 'PENDING',
  source: 'Not connected',
  frequency: 'unknown',
  note: 'Endpoint not yet connected',
})
