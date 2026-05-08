// 반도체 버킷별 거래량 프록시 확인 지표 데이터 계약
export type FlowProxyStatus =
  | 'Confirming'
  | 'Neutral'
  | 'Thin Participation'
  | 'Distribution Pressure'
  | 'Partial'
  | 'Pending'

export type FlowProxySource = 'LOCAL_DB' | 'CACHE' | 'PARTIAL' | 'PENDING'

export interface FlowProxyMetric {
  id: string
  label: string
  status: FlowProxyStatus
  volumeRatioCurrent: number | null
  volumeRatio5D: number | null
  return5D: number | null
  return20D: number | null
  availableTickers: string[]
  missingTickers: string[]
  source: FlowProxySource
  note?: string
}

export interface SemiconductorFlowProxyPayload {
  generatedAt: string
  benchmark: 'SOXX' | 'SMH' | 'PENDING'
  buckets: FlowProxyMetric[]
  summary: {
    overallStatus: FlowProxyStatus
    confirmingBuckets: string[]
    weakParticipationBuckets: string[]
    distributionPressureBuckets: string[]
    koreanSummary: string
  }
}

export const PENDING_FLOW_PROXY: SemiconductorFlowProxyPayload = {
  generatedAt: '',
  benchmark: 'PENDING',
  buckets: [],
  summary: {
    overallStatus: 'Pending',
    confirmingBuckets: [],
    weakParticipationBuckets: [],
    distributionPressureBuckets: [],
    koreanSummary: '거래량 프록시 데이터 대기 중입니다.',
  },
}

export const FLOW_STATUS_COLOR: Record<FlowProxyStatus, string> = {
  'Confirming':            '#3FB6A8',
  'Neutral':               '#B8C8DC',
  'Thin Participation':    '#D4B36A',
  'Distribution Pressure': '#E55A5A',
  'Partial':               '#6B7B95',
  'Pending':               '#6B7B95',
}

export const FLOW_STATUS_DOT: Record<FlowProxyStatus, string> = {
  'Confirming':            '●',
  'Neutral':               '◐',
  'Thin Participation':    '○',
  'Distribution Pressure': '▼',
  'Partial':               '◌',
  'Pending':               '—',
}
