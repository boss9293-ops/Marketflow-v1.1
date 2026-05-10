// AI Investment Tower 상단 요약 카드 데이터 계산 — 5초 요약

import type { BeginnerLayerReport, RiskLabel } from './reportTypes'

export type TowerSummary = {
  stateLabel:   string
  stateComment: string
  leadership:   string[]
  emerging:     string[]
  weakening:    string[]
  riskLabel:    string
  riskColor:    string
}

const RISK_RANK: Record<RiskLabel, number> = {
  UNKNOWN: 0, LOW: 1, MODERATE: 2, ELEVATED: 3, HIGH: 4, EXTREME: 5,
}

// ── State label derivation ────────────────────────────────────────────────────

function deriveState(
  working:  BeginnerLayerReport[],
  emerging: BeginnerLayerReport[],
  caution:  BeginnerLayerReport[],
  _losing:  BeginnerLayerReport[],
  highRiskCount: number,
): { stateLabel: string; stateComment: string } {
  const strongTotal = working.length + emerging.length

  if (highRiskCount >= 3) return {
    stateLabel:   '위험 상승',
    stateComment: '여러 계층에서 과열 또는 고위험 신호가 감지됩니다. 비중 관리가 우선입니다.',
  }

  const computeLeading  = working.some(r  => r.layerId === 'AI_COMPUTE')
  const computeCaution  = caution.some(r  => r.layerId === 'AI_COMPUTE')
  const storageEmerging = emerging.some(r => r.layerId === 'STORAGE_DATA')
  const softwareEmerging = emerging.some(r => r.layerId === 'AI_SOFTWARE')
  const defensiveLeading = working.some(r =>
    r.layerId === 'CYBERSECURITY' || r.layerId === 'POWER_COOLING')

  if (strongTotal >= 5) return {
    stateLabel:   'AI 인프라 확산 중',
    stateComment: '5개 이상 계층이 함께 강세입니다. AI 투자 사이클이 폭넓게 확산되고 있습니다.',
  }

  if (strongTotal >= 3 && (storageEmerging || softwareEmerging)) return {
    stateLabel:   '데이터 계층 확산',
    stateComment: '반도체를 넘어 데이터·소프트웨어 계층으로 AI 수요가 확산되는 신호입니다.',
  }

  if (strongTotal >= 3) return {
    stateLabel:   'AI 인프라 확산 중',
    stateComment: '여러 계층이 함께 강세를 보이고 있습니다.',
  }

  if (computeCaution && defensiveLeading) return {
    stateLabel:   '방어적 순환',
    stateComment: 'AI Compute 비중이 줄고 전력·보안 등 방어적 계층이 부각되고 있습니다.',
  }

  if (computeLeading && working.length === 1 && emerging.length === 0) return {
    stateLabel:   'AI 연산 중심 주도',
    stateComment: 'AI Compute에 강세가 집중되어 있습니다. 확산 여부 확인이 필요합니다.',
  }

  if (strongTotal === 0) return {
    stateLabel:   '혼조 / 확인 필요',
    stateComment: '현재 뚜렷한 주도 계층이 없습니다. 방향성 확인 후 대응이 유효합니다.',
  }

  return {
    stateLabel:   '혼조 / 확인 필요',
    stateComment: '일부 계층은 강하지만 전체 방향성 확인이 필요합니다.',
  }
}

// ── Risk aggregation ──────────────────────────────────────────────────────────

const COLOR_GREEN  = '#22c55e'
const COLOR_TEAL   = '#3FB6A8'
const COLOR_AMBER  = '#fbbf24'
const COLOR_RED    = '#ef4444'
const COLOR_TEXT3  = '#8b9098'

function deriveRisk(reports: BeginnerLayerReport[]): { riskLabel: string; riskColor: string } {
  const highCount     = reports.filter(r => r.riskLabel === 'HIGH' || r.riskLabel === 'EXTREME').length
  const elevatedCount = reports.filter(r => r.riskLabel === 'ELEVATED').length
  const moderateCount = reports.filter(r => r.riskLabel === 'MODERATE').length

  if (highCount >= 3)                         return { riskLabel: '높음',      riskColor: COLOR_RED   }
  if (highCount >= 1 || elevatedCount >= 3)   return { riskLabel: '과열 주의', riskColor: COLOR_AMBER }
  if (elevatedCount >= 2 || moderateCount >= 5) return { riskLabel: '주의',    riskColor: COLOR_TEAL  }
  if (moderateCount >= 2)                     return { riskLabel: '소폭 주의', riskColor: COLOR_TEAL  }
  return                                             { riskLabel: '안정',      riskColor: COLOR_GREEN }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildTowerSummary(reports: BeginnerLayerReport[]): TowerSummary {
  if (reports.length === 0) {
    return {
      stateLabel: '데이터 로딩 중', stateComment: '',
      leadership: [], emerging: [], weakening: [],
      riskLabel: '-', riskColor: COLOR_TEXT3,
    }
  }

  const working  = reports.filter(r => r.group === 'working')
  const emerging = reports.filter(r => r.group === 'emerging')
  const losing   = reports.filter(r => r.group === 'losing')
  const caution  = reports.filter(r => r.group === 'caution')
  const highRiskCount = reports.filter(r =>
    r.riskLabel === 'HIGH' || r.riskLabel === 'EXTREME'
  ).length

  const { stateLabel, stateComment } = deriveState(
    working, emerging, caution, losing, highRiskCount
  )
  const { riskLabel, riskColor } = deriveRisk(reports)

  return {
    stateLabel,
    stateComment,
    leadership: working.slice(0, 3).map(r => r.koreanLabel),
    emerging:   emerging.slice(0, 3).map(r => r.koreanLabel),
    weakening:  losing.slice(0, 3).map(r => r.koreanLabel),
    riskLabel,
    riskColor,
  }
}
