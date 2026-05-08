// SOXL vs 이론 3배 감쇠 추적 데이터 계약 — 변동성 감쇠 환경 지표
export type SoxlDecayStatus = 'FAVORABLE' | 'NEUTRAL' | 'CAUTION' | 'STRESS' | 'PENDING'
export type SoxlDecayWindow = '5D' | '1M' | '3M' | '6M' | '1Y'

export interface SoxlDecayMetric {
  window: SoxlDecayWindow
  benchmark: 'SOXX' | 'SMH'
  actualSoxlReturnPct: number | null
  benchmarkReturnPct: number | null
  ideal3xReturnPct: number | null
  decayPct: number | null
  status: SoxlDecayStatus
  startDate?: string
  endDate?: string
  observations: number
  source: 'LOCAL_DB' | 'CACHE' | 'PENDING'
  note?: string
}

export interface SoxlDecayPayload {
  generatedAt: string
  defaultWindow: SoxlDecayWindow
  benchmark: 'SOXX' | 'SMH' | 'PENDING'
  metrics: SoxlDecayMetric[]
  summary: {
    currentDecayPct: number | null
    status: SoxlDecayStatus
    label: string
    koreanSummary: string
  }
}

export const PENDING_SOXL_DECAY: SoxlDecayPayload = {
  generatedAt: '',
  defaultWindow: '3M',
  benchmark: 'PENDING',
  metrics: [],
  summary: {
    currentDecayPct: null,
    status: 'PENDING',
    label: 'SOXL decay pending',
    koreanSummary: 'SOXL 감쇠 데이터 대기 중입니다.',
  },
}

export const DECAY_STATUS_COLOR: Record<SoxlDecayStatus, string> = {
  FAVORABLE: '#3FB6A8',
  NEUTRAL:   '#B8C8DC',
  CAUTION:   '#D4B36A',
  STRESS:    '#E55A5A',
  PENDING:   '#6B7B95',
}

export const DECAY_STATUS_LABEL: Record<SoxlDecayStatus, string> = {
  FAVORABLE: 'Favorable',
  NEUTRAL:   'Neutral',
  CAUTION:   'Caution',
  STRESS:    'Stress',
  PENDING:   'Pending',
}

export function fmtDecay(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}pp`
}

export function fmtReturn(v: number | null): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}
