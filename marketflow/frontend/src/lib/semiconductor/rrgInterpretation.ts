// RRG 버킷별 순환 위치 해석 헬퍼 — quadrant + direction → phase + breadth summary
import type { RrgSeries } from './rrgPathData'

export type BucketPhase =
  | 'Leadership'
  | 'Leadership Fading'
  | 'Recovery Attempt'
  | 'Early Recovery'
  | 'Weakness'
  | 'Neutral'
  | 'Pending'

export type BucketSeverity = 'positive' | 'neutral' | 'caution' | 'weak' | 'pending'

export interface BucketRotationInterpretation {
  id: string
  label: string
  quadrant: string
  direction: string
  phase: BucketPhase
  shortText: string
  koreanText: string
  severity: BucketSeverity
}

export type LeadershipMode =
  | 'Broad Leadership'
  | 'Narrow Leadership'
  | 'Rotation Broadening'
  | 'Rotation Weakening'
  | 'High Dispersion'
  | 'Pending'

export interface RrgRotationSummary {
  leadershipMode: LeadershipMode
  leadBuckets: string[]
  recoveringBuckets: string[]
  weakeningBuckets: string[]
  laggingBuckets: string[]
  summaryText: string
  koreanSummary: string
}

type Q = 'Leading' | 'Weakening' | 'Lagging' | 'Improving' | 'Pending'
type D = 'Accelerating' | 'Sustaining' | 'Recovering' | 'Flattening' | 'Rolling Over' | 'Pending'

function resolvePhase(q: Q, d: D): BucketPhase {
  if (q === 'Pending') return 'Pending'
  if (q === 'Leading') {
    if (d === 'Flattening' || d === 'Rolling Over') return 'Leadership Fading'
    return 'Leadership'
  }
  if (q === 'Weakening') return 'Leadership Fading'
  if (q === 'Improving') return 'Recovery Attempt'
  if (q === 'Lagging') {
    if (d === 'Recovering') return 'Early Recovery'
    return 'Weakness'
  }
  return 'Neutral'
}

function phaseToSeverity(p: BucketPhase): BucketSeverity {
  if (p === 'Leadership')        return 'positive'
  if (p === 'Recovery Attempt' || p === 'Early Recovery') return 'neutral'
  if (p === 'Leadership Fading') return 'caution'
  if (p === 'Weakness')          return 'weak'
  if (p === 'Pending')           return 'pending'
  return 'neutral'
}

function phaseToShortText(p: BucketPhase): string {
  if (p === 'Leadership')        return 'Leads — momentum sustained'
  if (p === 'Leadership Fading') return 'Leading but momentum fading'
  if (p === 'Recovery Attempt')  return 'Improving — recovery in progress'
  if (p === 'Early Recovery')    return 'Lagging — early recovery signal'
  if (p === 'Weakness')          return 'Lagging — no recovery signal yet'
  if (p === 'Pending')           return 'Pending'
  return 'Neutral rotation'
}

function phaseToKorean(p: BucketPhase, label: string): string {
  if (p === 'Leadership')        return `${label}이(가) 주도 구간에서 모멘텀을 유지하고 있습니다.`
  if (p === 'Leadership Fading') return `${label}의 주도권은 있으나 모멘텀이 둔화되고 있습니다.`
  if (p === 'Recovery Attempt')  return `${label}이(가) 개선 구간으로 진입하며 회복 시도가 보입니다.`
  if (p === 'Early Recovery')    return `${label}이(가) 약세 구간에서 초기 회복 신호를 보이기 시작했습니다.`
  if (p === 'Weakness')          return `${label}이(가) 약세 구간에 머물며 아직 확인이 부족합니다.`
  if (p === 'Pending')           return `${label} 데이터 대기 중입니다.`
  return `${label} 순환 위치가 중립입니다.`
}

export function classifyBucketRotation(series: RrgSeries): BucketRotationInterpretation {
  const phase = resolvePhase(series.quadrant as Q, series.direction as D)
  return {
    id: series.id,
    label: series.label,
    quadrant: series.quadrant,
    direction: series.direction,
    phase,
    shortText: phaseToShortText(phase),
    koreanText: phaseToKorean(phase, series.label),
    severity: phaseToSeverity(phase),
  }
}

export function classifyRrgRotation(seriesList: RrgSeries[]): RrgRotationSummary {
  const bucket_ids = ['ai_compute', 'memory_hbm', 'foundry_pkg', 'equipment']
  const buckets = seriesList.filter(s => bucket_ids.includes(s.id))

  if (buckets.length === 0) {
    return {
      leadershipMode: 'Pending',
      leadBuckets: [], recoveringBuckets: [], weakeningBuckets: [], laggingBuckets: [],
      summaryText: 'No bucket data available.',
      koreanSummary: '버킷 데이터 대기 중입니다.',
    }
  }

  const interps = buckets.map(classifyBucketRotation)
  const lead      = interps.filter(b => b.quadrant === 'Leading')
  const improving = interps.filter(b => b.quadrant === 'Improving')
  const weakening = interps.filter(b => b.quadrant === 'Weakening')
  const lagging   = interps.filter(b => b.quadrant === 'Lagging')
  const fading    = interps.filter(b => b.phase === 'Leadership Fading')

  let leadershipMode: LeadershipMode
  if (buckets.every(s => s.quadrant === 'Pending')) {
    leadershipMode = 'Pending'
  } else if (lead.length >= 2 && improving.length >= 1) {
    leadershipMode = 'Rotation Broadening'
  } else if (lead.length >= 2 && lagging.length === 0) {
    leadershipMode = 'Broad Leadership'
  } else if (lead.length === 1 && lagging.length >= 2) {
    leadershipMode = 'Narrow Leadership'
  } else if (fading.length >= 2 || weakening.length >= 2) {
    leadershipMode = 'Rotation Weakening'
  } else {
    leadershipMode = 'High Dispersion'
  }

  const leadLabels     = lead.map(b => b.label)
  const recoverLabels  = interps.filter(b => b.phase === 'Recovery Attempt' || b.phase === 'Early Recovery').map(b => b.label)
  const fadingLabels   = fading.map(b => b.label)
  const weakLabels     = interps.filter(b => b.phase === 'Weakness').map(b => b.label)

  const enParts: string[] = []
  if (leadLabels.length)    enParts.push(`${leadLabels.join(' & ')} leads`)
  if (recoverLabels.length) enParts.push(`${recoverLabels.join(' & ')} improving`)
  if (fadingLabels.length)  enParts.push(`${fadingLabels.join(' & ')} fading`)
  if (weakLabels.length)    enParts.push(`${weakLabels.join(' & ')} weak vs SOXX`)

  const korParts: string[] = []
  if (leadLabels.length)    korParts.push(`${leadLabels.join(', ')}가 주도하고`)
  if (recoverLabels.length) korParts.push(`${recoverLabels.join(', ')}이(가) 개선 중이며`)
  if (weakLabels.length)    korParts.push(`${weakLabels.join(', ')}은(는) SOXX 대비 약세 구간에 머물고 있습니다.`)

  return {
    leadershipMode,
    leadBuckets: leadLabels,
    recoveringBuckets: recoverLabels,
    weakeningBuckets: fadingLabels,
    laggingBuckets: weakLabels,
    summaryText: enParts.length > 0 ? enParts.join('. ') + '.' : 'Mixed rotation.',
    koreanSummary: korParts.length > 0 ? korParts.join(', ') : '혼합 순환 상태입니다.',
  }
}
