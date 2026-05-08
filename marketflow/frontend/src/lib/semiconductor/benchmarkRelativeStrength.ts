// 반도체 벤치마크 상대강도 데이터 계약 — SOXX/QQQ/SPY 비교 레이어
export type BenchmarkId = 'SOXX' | 'QQQ' | 'SPY'

export type RelativeStatus = 'Leading' | 'Neutral' | 'Lagging' | 'Pending'

export type TimeframeKey = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y'

export const RELATIVE_LEADING_THRESHOLD_PP = 1.0
export const RELATIVE_LAGGING_THRESHOLD_PP = -1.0

export interface BenchmarkReturn {
  symbol: BenchmarkId
  proxy: string | null
  latestPrice: number | null
  asOf: string
  returns: Partial<Record<TimeframeKey, number | null>>
  sources: Partial<Record<TimeframeKey, 'CACHE' | 'LOCAL_DB' | 'PROXY' | 'PENDING' | 'snapshot_change_pct' | 'snapshot_history'>>
}

export interface BenchmarkRSPayload {
  generatedAt: string
  note?: string
  thresholds: { leading_pp: number; lagging_pp: number }
  benchmarks: Record<BenchmarkId, BenchmarkReturn>
  relative: {
    SOXX_vs_QQQ: Partial<Record<TimeframeKey, number | null>>
    SOXX_vs_SPY: Partial<Record<TimeframeKey, number | null>>
  }
  summary: {
    SOXX_vs_QQQ: RelativeStatus
    SOXX_vs_SPY: RelativeStatus
    primary_timeframe: TimeframeKey
  }
}

export function relativeStatusLabel(val: number | null | undefined): RelativeStatus {
  if (val == null) return 'Pending'
  if (val >= RELATIVE_LEADING_THRESHOLD_PP) return 'Leading'
  if (val <= RELATIVE_LAGGING_THRESHOLD_PP) return 'Lagging'
  return 'Neutral'
}

export function formatReturn(val: number | null | undefined): string {
  if (val == null) return '—'
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%'
}

export function formatRelative(val: number | null | undefined): string {
  if (val == null) return '—'
  return (val >= 0 ? '+' : '') + val.toFixed(1) + 'pp'
}

export const PENDING_RS_PAYLOAD: BenchmarkRSPayload = {
  generatedAt: '',
  thresholds: { leading_pp: RELATIVE_LEADING_THRESHOLD_PP, lagging_pp: RELATIVE_LAGGING_THRESHOLD_PP },
  benchmarks: {
    SOXX: { symbol: 'SOXX', proxy: 'SMH', latestPrice: null, asOf: '', returns: {}, sources: {} },
    QQQ:  { symbol: 'QQQ',  proxy: null,  latestPrice: null, asOf: '', returns: {}, sources: {} },
    SPY:  { symbol: 'SPY',  proxy: null,  latestPrice: null, asOf: '', returns: {}, sources: {} },
  },
  relative: { SOXX_vs_QQQ: {}, SOXX_vs_SPY: {} },
  summary: { SOXX_vs_QQQ: 'Pending', SOXX_vs_SPY: 'Pending', primary_timeframe: '1M' },
}
