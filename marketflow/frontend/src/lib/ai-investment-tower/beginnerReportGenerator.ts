// AI Investment Tower 초급 리포트 생성기 — 쉬운 언어, 핵심 흐름 요약

import type { LayerReportInput, BeginnerLayerReport, BeginnerGroup, RiskLabel } from './reportTypes'

// ── Status label mapping ──────────────────────────────────────────────────────

function toStatusLabel(layer: LayerReportInput): string {
  if (layer.trendLabel === 'EXTENDED') return '강하지만 과열'
  switch (layer.rrgState) {
    case 'LEADING':   return layer.riskLabel === 'HIGH' ? '강하지만 과열' : '요즘 잘나감'
    case 'IMPROVING': return '새로 뜨는 중'
    case 'WEAKENING': return '힘 빠지는 중'
    case 'LAGGING':   return '아직 관망'
    case 'MIXED':     return '계속 강함'
    default:          return '확인 필요'
  }
}

// ── Group mapping ─────────────────────────────────────────────────────────────

function toGroup(layer: LayerReportInput): BeginnerGroup {
  const extended = layer.trendLabel === 'EXTENDED' || layer.riskLabel === 'HIGH' || layer.riskLabel === 'EXTREME'
  if (extended && layer.rrgState === 'LEADING') return 'caution'
  switch (layer.rrgState) {
    case 'LEADING':   return 'working'
    case 'IMPROVING': return 'emerging'
    case 'WEAKENING': return 'losing'
    case 'LAGGING':   return 'losing'
    case 'MIXED':     return 'working'
    default:          return 'neutral'
  }
}

// ── Momentum phrasing ─────────────────────────────────────────────────────────

function momentumPhrase(r1m: number | null, r3m: number | null): string {
  if (r1m === null && r3m === null) return '데이터를 확인 중입니다'
  const m1 = r1m !== null ? `${r1m >= 0 ? '+' : ''}${r1m.toFixed(1)}%` : null
  const m3 = r3m !== null ? `${r3m >= 0 ? '+' : ''}${r3m.toFixed(1)}%` : null
  if (m1 && m3) return `최근 한 달 ${m1}, 3개월 ${m3}`
  if (m1) return `최근 한 달 ${m1}`
  return `최근 3개월 ${m3}`
}

// ── Per-layer narrative templates ─────────────────────────────────────────────

function layerExplanation(layer: LayerReportInput, statusLabel: string): string {
  const { id, koreanLabel, momentum1m, momentum3m, rrgState, riskLabel, trendLabel } = layer
  const momStr = momentumPhrase(momentum1m, momentum3m)
  const riskNote = riskLabel === 'HIGH' || riskLabel === 'ELEVATED'
    ? ' 신규 진입보다는 비중 관리가 더 중요한 구간입니다.'
    : ''

  // Specific templates for known layers
  switch (id) {
    case 'AI_CHIP':
      return riskLabel === 'HIGH' || trendLabel === 'EXTENDED'
        ? `AI Compute는 아직 주도권을 유지하고 있지만 과열 부담이 있습니다. (${momStr}) 신규 진입보다는 비중 관리가 더 중요한 구간입니다.`
        : `AI Compute(반도체)는 AI 사이클의 핵심 엔진입니다. ${momStr}으로 흐름이 이어지고 있습니다.${riskNote}`

    case 'HBM_MEMORY':
      if (rrgState === 'WEAKENING' || (momentum1m !== null && momentum1m < 0))
        return `메모리 / HBM은 최근 모멘텀이 약해졌습니다. ${momStr}으로 중기 구조는 남아 있지만 단기 둔화가 관찰됩니다. 추가 확인이 필요합니다.`
      return `메모리 / HBM 계층이 AI 수요 확산 수혜를 받고 있습니다. ${momStr}으로 흐름이 유지되고 있습니다.${riskNote}`

    case 'DATA_CENTER_INFRA':
    case 'PCB_SUBSTRATE':
      if (rrgState === 'IMPROVING')
        return `${koreanLabel}이(가) 새롭게 뜨고 있습니다. ${momStr}으로 AI 인프라 수요가 이 레이어까지 확산되는 신호입니다.`
      return `${koreanLabel}은(는) ${statusLabel} 상태입니다. ${momStr}.${riskNote}`

    case 'POWER_INFRA':
    case 'COOLING':
      return rrgState === 'LEADING'
        ? `전력 / 냉각 인프라는 여전히 잘나가고 있습니다. ${momStr}으로 AI 데이터센터 투자가 물리 인프라로 확산되는 신호입니다.${riskNote}`
        : `전력 / 냉각 인프라의 흐름이 변화하고 있습니다. ${momStr}.${riskNote}`

    case 'OPTICAL_NETWORK':
      return `광 네트워크 / 네트워킹은 AI 클러스터 내 데이터 이동 수요와 연결됩니다. ${momStr}.${riskNote}`

    case 'RAW_MATERIAL':
      return rrgState === 'IMPROVING'
        ? `원자재(구리·우라늄 등)가 새롭게 뜨고 있습니다. ${momStr}으로 AI 인프라 투자 수요가 업스트림 소재까지 확산되는 신호입니다.`
        : `원자재 계층은 ${statusLabel} 상태입니다. ${momStr}.${riskNote}`

    default:
      return `${koreanLabel}은(는) ${statusLabel} 상태입니다. ${momStr}.${riskNote}`
  }
}

// ── Headline ──────────────────────────────────────────────────────────────────

function layerHeadline(layer: LayerReportInput, statusLabel: string): string {
  const { koreanLabel, rrgState, trendLabel, riskLabel } = layer
  if (trendLabel === 'EXTENDED' || riskLabel === 'HIGH') return `${koreanLabel} — 과열 부담, 비중 관리 필요`
  switch (rrgState) {
    case 'LEADING':   return `${koreanLabel} — 주도권 유지 중`
    case 'IMPROVING': return `${koreanLabel} — 새로 부각`
    case 'WEAKENING': return `${koreanLabel} — 단기 모멘텀 둔화`
    case 'LAGGING':   return `${koreanLabel} — 관망 구간`
    default:          return `${koreanLabel} — ${statusLabel}`
  }
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateBeginnerReport(layers: LayerReportInput[]): BeginnerLayerReport[] {
  return layers
    .filter(l => l.rrgState !== 'UNKNOWN' || l.momentum1m !== null)
    .map(layer => {
      const statusLabel = toStatusLabel(layer)
      const group       = toGroup(layer)
      return {
        layerId:     layer.id,
        statusLabel,
        headline:    layerHeadline(layer, statusLabel),
        explanation: layerExplanation(layer, statusLabel),
        group,
        riskLabel:   layer.riskLabel,
      }
    })
}

// ── Overall narrative summary ─────────────────────────────────────────────────

export function generateBeginnerOverall(reports: BeginnerLayerReport[]): string {
  const working  = reports.filter(r => r.group === 'working')
  const emerging = reports.filter(r => r.group === 'emerging')
  const losing   = reports.filter(r => r.group === 'losing')
  const caution  = reports.filter(r => r.group === 'caution')

  const parts: string[] = []

  if (working.length > 0) {
    const names = working.map(r => r.layerId).slice(0, 2).join(', ')
    parts.push(`현재 ${names} 계층이 AI 인프라 사이클을 주도하고 있습니다.`)
  }
  if (emerging.length > 0) {
    const names = emerging.map(r => r.layerId).slice(0, 2).join(', ')
    parts.push(`${names}은(는) 새롭게 부각되는 단계로, 관심이 필요합니다.`)
  }
  if (caution.length > 0) {
    const names = caution.map(r => r.layerId).slice(0, 2).join(', ')
    parts.push(`${names}은(는) 강하지만 단기 과열 부담이 있어 비중 관리가 필요합니다.`)
  }
  if (losing.length > 0) {
    parts.push(`일부 계층은 단기 모멘텀이 약화되고 있어 추가 확인이 필요합니다.`)
  }

  const isNarrowing = working.length <= 2 && emerging.length === 0
  const isBroadening = emerging.length >= 2 || (working.length + emerging.length) >= 4

  if (isBroadening) parts.push('전체적으로 AI 강세가 여러 계층으로 확산되는 흐름입니다.')
  if (isNarrowing)  parts.push('AI 강세가 일부 계층에 집중된 상태로, 선택적 접근이 유효합니다.')

  return parts.join(' ')
}
