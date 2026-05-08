// RRG 히스토리컬 경로 데이터 계약 — 버킷별 RS 경로 레이어
export type RrgBenchmarkId = 'SOXX' | 'QQQ' | 'SPY'

export type RrgQuadrant =
  | 'Leading'
  | 'Weakening'
  | 'Lagging'
  | 'Improving'
  | 'Pending'

export type RrgDirection =
  | 'Accelerating'
  | 'Sustaining'
  | 'Recovering'
  | 'Flattening'
  | 'Rolling Over'
  | 'Pending'

export interface RrgPoint {
  date: string
  rsRatio: number | null
  rsMomentum: number | null
}

export interface RrgSeries {
  id: string
  label: string
  benchmark: RrgBenchmarkId
  source: 'CACHE' | 'LOCAL_DB' | 'PROXY' | 'PENDING'
  quadrant: RrgQuadrant
  direction: RrgDirection
  points: RrgPoint[]
  note?: string
}

export interface RrgPathPayload {
  generatedAt: string
  benchmark: RrgBenchmarkId
  lookback: '4W' | '8W' | '12W' | '24W'
  series: RrgSeries[]
  dataStatus: {
    hasBenchmarkPath: boolean
    hasBucketPath: boolean
    pendingReason?: string | null
  }
  note?: string
}

export const PENDING_RRG_PAYLOAD: RrgPathPayload = {
  generatedAt: '',
  benchmark: 'SOXX',
  lookback: '8W',
  series: [],
  dataStatus: {
    hasBenchmarkPath: false,
    hasBucketPath: false,
    pendingReason: 'RRG path cache not generated',
  },
}
