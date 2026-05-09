// AI Investment Tower 중급/고급 리포트 생성기 — RRG·모멘텀·추세·리스크 상세 설명

import type { LayerReportInput, ProLayerReport, RRGStateLabel, TrendLabel, RiskLabel } from './reportTypes'

// ── Comment generators ────────────────────────────────────────────────────────

function rrgComment(rrgState: RRGStateLabel, koreanLabel: string): string {
  switch (rrgState) {
    case 'LEADING':   return `${koreanLabel}은(는) RRG상 Leading 사분면에 위치합니다. 상대강도와 모멘텀이 모두 벤치마크 대비 우위에 있습니다.`
    case 'IMPROVING': return `${koreanLabel}은(는) RRG상 Improving 사분면으로 진입 중입니다. 상대강도가 회복되고 있으며, Leading 사분면 진입 확인이 필요합니다.`
    case 'WEAKENING': return `${koreanLabel}은(는) RRG상 Weakening 사분면으로 이동 중입니다. 상대강도 모멘텀이 꺾이고 있어 주의가 필요합니다.`
    case 'LAGGING':   return `${koreanLabel}은(는) RRG상 Lagging 사분면에 위치합니다. 상대강도와 모멘텀 모두 벤치마크 대비 부진합니다.`
    case 'MIXED':     return `${koreanLabel}의 RRG 포지션은 혼조 상태입니다. 상대강도는 플러스이나 추세 확인이 필요합니다.`
    default:          return `${koreanLabel}의 RRG 포지션이 충분하지 않아 분류 불가합니다.`
  }
}

function momentumComment(r1w: number | null, r1m: number | null, r3m: number | null): string {
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const parts: string[] = []
  if (r1w !== null) parts.push(`1주: ${fmt(r1w)}`)
  if (r1m !== null) parts.push(`1개월: ${fmt(r1m)}`)
  if (r3m !== null) parts.push(`3개월: ${fmt(r3m)}`)

  if (parts.length === 0) return '모멘텀 데이터를 수집 중입니다.'

  const summary = parts.join(' / ')

  if (r1m !== null && r3m !== null) {
    if (r1m > 0 && r3m > 0)    return `${summary}. 단기·중기 모멘텀이 모두 플러스로 흐름이 일관됩니다.`
    if (r1m < 0 && r3m > 0)    return `${summary}. 중기 흐름은 유지되지만 단기 모멘텀이 둔화되었습니다. 지속성 확인 필요.`
    if (r1m > 0 && r3m < 0)    return `${summary}. 단기 반등 중이지만 중기 구조 회복 여부 확인이 필요합니다.`
    if (r1m < 0 && r3m < 0)    return `${summary}. 단기·중기 모멘텀 모두 마이너스. 추세 전환 신호 대기 중입니다.`
  }

  return summary
}

function trendComment(trend: TrendLabel, r1m: number | null, r3m: number | null): string {
  switch (trend) {
    case 'UPTREND':
      return `가격 추세가 상승 구조를 유지하고 있습니다. MA50 상단에서 안착 여부를 모니터링하세요.`
    case 'RECOVERING':
      return `중기 추세는 회복 중이지만 단기 모멘텀이 완전히 살아나지 않았습니다. 단기 연속 플러스 유지 여부가 핵심 체크포인트입니다.`
    case 'EXTENDED':
      return `가격이 단기 고점 대비 크게 확장되어 있습니다. 단기 조정 후 재진입 기회를 기다리는 것이 적절할 수 있습니다.`
    case 'SIDEWAYS':
      return `뚜렷한 방향성 없이 횡보 중입니다. 방향 돌파 확인 후 대응이 유효합니다.`
    case 'DOWNTREND':
      return `하락 추세 구조입니다. MA50 회복 이전까지 신규 비중 확대는 리스크가 큽니다.`
    default:
      return `추세 분류에 충분한 데이터가 없습니다.`
  }
}

function riskComment(riskLabel: RiskLabel, layer: LayerReportInput): string {
  const cov = layer.coveragePct ?? 1
  const covSuffix = cov < 0.50
    ? ' (데이터 부족 — 신호 신뢰도 낮음)'
    : cov < 0.80
      ? ` (커버리지 ${Math.round(cov * 100)}% — 일부 종목 기준)`
      : ''
  switch (riskLabel) {
    case 'LOW':      return `현재 주요 리스크 플래그 없음. 데이터 커버리지도 적절합니다.${covSuffix}`
    case 'MODERATE': return `경미한 리스크 요인이 있습니다. 상대강도 약화 또는 RRG 이동 방향을 주기적으로 확인하세요.${covSuffix}`
    case 'ELEVATED': return `과열 또는 단기 확장 신호가 감지됩니다. 비중 유지 수준에서 관리하는 것이 적절합니다.${covSuffix}`
    case 'HIGH':     return `과열 + 모멘텀 확장이 동시에 발생했습니다. 포지션 리스크 관리 우선. 신규 진입 자제를 권고합니다.${covSuffix}`
    case 'EXTREME':  return `극단적 리스크 신호 발생. 기존 포지션 축소 검토 및 트리거 설정이 필요합니다.${covSuffix}`
    default:         return `리스크 분류에 충분한 데이터가 없습니다.${covSuffix}`
  }
}

function nextCheckpoint(layer: LayerReportInput): string {
  const { rrgState, trendLabel, riskLabel } = layer
  if (riskLabel === 'HIGH' || riskLabel === 'EXTREME') return '단기 조정 후 MA50 회복 여부 확인 — 미회복 시 비중 축소 트리거'
  if (trendLabel === 'EXTENDED')   return '단기 조정 발생 시 MA50 지지 유지 확인 — 지지 성공 시 재진입 기회'
  if (rrgState === 'LEADING')      return 'MA50 상단 지지 유지 + RRG Leading 사분면 유지 여부 모니터링'
  if (rrgState === 'IMPROVING')    return 'RRG Leading 사분면 진입 확인 — 진입 성공 시 비중 확대 신호'
  if (rrgState === 'WEAKENING')    return 'MA50 지지 여부 확인 — 이탈 시 비중 조절 신호로 해석'
  if (rrgState === 'LAGGING')      return '추세 회복 신호 대기 (MA50 회복 + 1개월 모멘텀 플러스 전환)'
  if (trendLabel === 'RECOVERING') return '1개월 연속 플러스 모멘텀 유지 확인 — 지속 시 비중 확대 검토'
  if (trendLabel === 'DOWNTREND')  return 'MA50 회복 이전 신규 진입 자제 — 회복 신호 발생 시 재진입 검토'
  return '벤치마크 대비 초과 성과 지속 여부 확인'
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateProReport(layers: LayerReportInput[]): ProLayerReport[] {
  return layers.map(layer => ({
    layerId:          layer.id,
    label:            layer.label,
    koreanLabel:      layer.koreanLabel,
    primaryEtf:       layer.primaryEtf,
    rrgState:         layer.rrgState,
    momentum1w:       layer.momentum1w,
    momentum1m:       layer.momentum1m,
    momentum3m:       layer.momentum3m,
    trendLabel:       layer.trendLabel,
    breadthLabel:     layer.breadthLabel,
    riskLabel:        layer.riskLabel,
    towerSignal:      layer.towerSignal,
    rrgComment:       rrgComment(layer.rrgState, layer.koreanLabel),
    momentumComment:  momentumComment(layer.momentum1w, layer.momentum1m, layer.momentum3m),
    trendComment:     trendComment(layer.trendLabel, layer.momentum1m, layer.momentum3m),
    riskComment:      riskComment(layer.riskLabel, layer),
    nextCheckpoint:   nextCheckpoint(layer),
    coveragePct:      layer.coveragePct,
  }))
}
