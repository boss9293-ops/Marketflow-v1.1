// AI Investment Tower 초급 리포트 생성기 — 쉬운 언어, 핵심 흐름 요약

import type { LayerReportInput, BeginnerLayerReport, BeginnerGroup, RiskLabel } from './reportTypes'

// ── Status label mapping ──────────────────────────────────────────────────────

function toStatusLabel(layer: LayerReportInput): string {
  const highRisk = layer.riskLabel === 'HIGH' || layer.riskLabel === 'EXTREME'
  if (layer.trendLabel === 'DOWNTREND' && highRisk) return '위험 회피'
  if (layer.trendLabel === 'EXTENDED') return '강하지만 과열'
  switch (layer.rrgState) {
    case 'LEADING':   return highRisk ? '강하지만 과열' : '요즘 잘나감'
    case 'IMPROVING': return '새로 뜨는 중'
    case 'WEAKENING': return '힘 빠지는 중'
    case 'LAGGING':   return '아직 관망'
    case 'MIXED':     return '계속 강함'
    default:          return '확인 필요'
  }
}

// ── Group mapping ─────────────────────────────────────────────────────────────

function toGroup(layer: LayerReportInput): BeginnerGroup {
  if ((layer.coveragePct ?? 1) < 0.50) return 'neutral'
  const highRisk = layer.riskLabel === 'HIGH' || layer.riskLabel === 'EXTREME'
  if (layer.trendLabel === 'DOWNTREND' && highRisk) return 'caution'
  if ((layer.trendLabel === 'EXTENDED' || highRisk) && layer.rrgState === 'LEADING') return 'caution'
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

function breadthSuffix(breadthLabel: string): string {
  switch (breadthLabel) {
    case 'BROAD':     return ' 버킷 내부 종목 전반이 함께 강해지고 있어 단일 종목 움직임보다 섹터 확산 신호에 가깝습니다.'
    case 'IMPROVING': return ' 버킷 내 절반 이상 종목이 함께 회복 중입니다.'
    case 'NARROW':    return ' 아직 일부 종목 중심의 움직임으로, 확산 여부를 추가 확인해야 합니다.'
    case 'WEAK':      return ' 버킷 내 대부분 종목이 약한 상태로, 신중한 접근이 필요합니다.'
    default:          return ''
  }
}

function layerExplanation(layer: LayerReportInput, statusLabel: string): string {
  const { id, koreanLabel, momentum1m, momentum1w, momentum3m, rrgState, riskLabel, trendLabel, breadthLabel } = layer
  const cov = layer.coveragePct ?? 1

  // Low coverage — avoid signaling
  if (cov < 0.50) {
    return `${koreanLabel}은(는) 아직 데이터가 충분하지 않아 추세 판단을 보류합니다.`
  }

  const momStr    = momentumPhrase(momentum1m, momentum3m)
  const bSuffix   = breadthSuffix(breadthLabel)
  const riskNote  = riskLabel === 'HIGH' || riskLabel === 'ELEVATED'
    ? ' 신규 진입보다는 비중 관리가 더 중요한 구간입니다.'
    : ''
  const covNote   = cov < 0.80 ? ' 일부 종목 기준이므로 추가 확인이 필요합니다.' : ''
  const shortTermWeak = momentum1w !== null && momentum1w < 0 && momentum1m !== null && momentum1m > 0
  const weeklyNote = shortTermWeak ? ' 다만 최근 일주일 모멘텀은 음전환해 단기 확인이 필요합니다.' : ''

  let base: string
  switch (id) {
    case 'AI_CHIP':
    case 'AI_COMPUTE':
      base = riskLabel === 'HIGH' || trendLabel === 'EXTENDED'
        ? `AI Compute는 아직 주도권을 유지하고 있지만 과열 부담이 있습니다. (${momStr}) 신규 진입보다는 비중 관리가 더 중요한 구간입니다.`
        : `AI Compute(반도체)는 AI 사이클의 핵심 엔진입니다. ${momStr}로 흐름이 이어지고 있습니다.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'HBM_MEMORY':
    case 'MEMORY_HBM':
      base = (rrgState === 'WEAKENING' || (momentum1m !== null && momentum1m < 0))
        ? `메모리 / HBM은 최근 모멘텀이 약해졌습니다. ${momStr}로 중기 구조는 남아 있지만 단기 둔화가 관찰됩니다. 추가 확인이 필요합니다.`
        : `메모리 / HBM 계층이 AI 수요 확산 수혜를 받고 있습니다. ${momStr}로 흐름이 유지되고 있습니다.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'DATA_CENTER_INFRA':
    case 'PCB_SUBSTRATE':
      base = rrgState === 'IMPROVING'
        ? `${koreanLabel}이 새롭게 뜨고 있습니다. ${momStr}로 AI 인프라 수요가 이 계층까지 확산되는 신호입니다.${bSuffix}`
        : `${koreanLabel}은 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'POWER_INFRA':
    case 'COOLING':
    case 'POWER_COOLING':
      if (rrgState === 'LEADING')
        base = `전력 / 냉각 인프라는 여전히 잘나가고 있습니다. ${momStr}로 AI 데이터센터 투자가 물리 인프라로 확산되는 신호입니다.${bSuffix}${riskNote}`
      else if (rrgState === 'IMPROVING')
        base = `전력 / 냉각 인프라가 개선 흐름에 진입하고 있습니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      else
        base = `전력 / 냉각 인프라의 흐름이 둔화되고 있습니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'OPTICAL_NETWORK':
    case 'NETWORKING_OPTICAL':
      base = `광 네트워크 / 네트워킹은 AI 클러스터 내 데이터 이동 수요와 연결됩니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'RAW_MATERIAL':
    case 'RAW_MATERIALS':
      base = rrgState === 'IMPROVING'
        ? `원자재(구리·우라늄 등)가 새롭게 뜨고 있습니다. ${momStr}로 AI 인프라 투자 수요가 업스트림 소재까지 확산되는 신호입니다.${bSuffix}`
        : `원자재 계층은 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'CLOUD_HYPERSCALERS':
      base = rrgState === 'LEADING'
        ? `클라우드·하이퍼스케일러가 AI 인프라 투자를 주도하고 있습니다. ${momStr}. 빅테크 자본지출 확대가 반도체 사이클 전반을 견인하는 신호입니다.${bSuffix}${riskNote}`
        : `클라우드·하이퍼스케일러는 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'AI_SOFTWARE':
      base = (rrgState === 'LEADING' || rrgState === 'IMPROVING')
        ? `AI 소프트웨어 계층이 강세를 보이고 있습니다. ${momStr}. 하드웨어 투자 이후 소프트웨어 수익화 단계로 넘어가는 신호일 수 있습니다.${bSuffix}${riskNote}`
        : `AI 소프트웨어 계층은 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'ROBOTICS_PHYSICAL_AI':
      base = rrgState === 'IMPROVING'
        ? `로보틱스·피지컬 AI가 새롭게 부각되고 있습니다. ${momStr}. AI가 현실 세계로 확산되는 초기 신호로 관심이 필요합니다.${bSuffix}`
        : `로보틱스·피지컬 AI 계층은 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'CYBERSECURITY':
      base = `사이버보안은 AI 확산과 함께 위협도 커지는 방어적 계층입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    case 'STORAGE_DATA':
      base = rrgState === 'IMPROVING'
        ? `스토리지·데이터 인프라가 새롭게 뜨고 있습니다. ${momStr}. AI 학습 데이터 폭증이 이 계층까지 확산되는 신호입니다.${bSuffix}`
        : `스토리지·데이터 계층은 ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
      break

    default:
      base = `${koreanLabel}은(는) ${statusLabel} 상태입니다. ${momStr}.${weeklyNote}${bSuffix}${riskNote}`
  }

  return base + covNote
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
        koreanLabel: layer.koreanLabel,
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
  if (reports.length === 0) return ''

  const working  = reports.filter(r => r.group === 'working')
  const emerging = reports.filter(r => r.group === 'emerging')
  const losing   = reports.filter(r => r.group === 'losing')
  const caution  = reports.filter(r => r.group === 'caution')

  const parts: string[] = []

  if (working.length > 0) {
    const names = working.map(r => r.koreanLabel).slice(0, 2).join(', ')
    parts.push(`현재 ${names} 계층이 AI 인프라 사이클을 주도하고 있습니다.`)
  }
  if (emerging.length > 0) {
    const names = emerging.map(r => r.koreanLabel).slice(0, 2).join(', ')
    parts.push(`${names}이(가) 새롭게 부각되는 단계로 관심이 필요합니다.`)
  }
  if (caution.length > 0) {
    const names = caution.map(r => r.koreanLabel).slice(0, 2).join(', ')
    parts.push(`${names}은(는) 과열 또는 리스크 부담이 있어 비중 관리가 필요합니다.`)
  }
  if (losing.length > 0) {
    parts.push(`일부 계층은 단기 모멘텀이 약화되고 있어 추가 확인이 필요합니다.`)
  }

  const hasData = working.length + emerging.length > 0
  if (!hasData) return '현재 충분한 데이터가 없어 전체 판단을 보류합니다.'

  const isBroadening = emerging.length >= 2 || (working.length + emerging.length) >= 4
  const isNarrowing  = working.length <= 2 && emerging.length === 0 && working.length > 0

  if (isBroadening) parts.push('전체적으로 AI 강세가 여러 계층으로 확산되는 흐름입니다.')
  else if (isNarrowing) parts.push('AI 강세가 일부 계층에 집중된 상태로, 선택적 접근이 유효합니다.')

  return parts.join(' ')
}
