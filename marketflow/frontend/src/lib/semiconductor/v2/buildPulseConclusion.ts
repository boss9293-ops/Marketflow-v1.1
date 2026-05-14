// PULSE 탭 페이지 상단 한 줄 결론 빌더
import type { CycleScoreTimeSeries, LayerTimeSeries, DecayTimeSeries } from '../types'

export function buildPulseConclusion(
  cycle: CycleScoreTimeSeries | null | undefined,
  layer: LayerTimeSeries | null | undefined,
  decay: DecayTimeSeries | null | undefined,
): string {
  const parts: string[] = []

  if (cycle && cycle.series.length > 0) {
    const last = cycle.series[cycle.series.length - 1]
    const days = cycle.current_phase_duration_days
    parts.push(`${last.phase} 페이즈 ${days}일 지속 중`)
  }

  if (layer) {
    const spread = layer.current.spread
    const dir = spread >= 0 ? 'AI Layer 우위' : 'Legacy 우위'
    const abs = Math.abs(spread).toFixed(1)
    parts.push(`${dir} +${abs}pp`)
  }

  if (decay) {
    const ex = decay.current.excess_return
    const sign = ex >= 0 ? '+' : ''
    parts.push(`SOXL 실제수익 이론 대비 ${sign}${ex.toFixed(1)}pp`)
  }

  return parts.length > 0 ? parts.join(' — ') : '데이터 로딩 중'
}
