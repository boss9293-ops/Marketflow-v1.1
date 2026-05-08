// 반도체 신호 품질 점수 — 결정론적 다중 레이어 집계 헬퍼

export type SignalQualityLabel = 'High' | 'Medium' | 'Mixed' | 'Low' | 'Pending'

export type SignalQualityComponent =
  | 'Benchmark RS'
  | 'RRG Rotation'
  | 'Flow Volume'
  | 'Breadth Momentum'
  | 'SOXL Decay'
  | 'Data Trust'

export type SignalQualityComponentLabel = 'Confirming' | 'Neutral' | 'Diverging' | 'Caution' | 'Pending'

export interface SignalQualityComponentScore {
  component: SignalQualityComponent
  score: number
  maxScore: number
  label: SignalQualityComponentLabel
  note: string
}

export interface SemiconductorSignalQuality {
  score: number
  maxScore: number
  pct: number
  label: SignalQualityLabel
  components: SignalQualityComponentScore[]
  confirmingFactors: string[]
  cautionFactors: string[]
  pendingFactors: string[]
  koreanSummary: string
}

export interface SignalQualityInputs {
  // Benchmark RS (20 pts)
  soxxVsQQQ: string
  soxxVsSPY: string
  // RRG Rotation (25 pts)
  rrgMode: string
  rrgDataReady: boolean
  // Flow Proxy (15 pts)
  flowOverallStatus: string
  flowConfirmingCount: number
  flowDistributionCount: number
  // Breadth / Momentum (20 pts)
  breadthPct: number | null
  advancingPct: number | null
  // SOXL Decay (10 pts)
  soxlDecayStatus: string
  // Data Trust (10 pts)
  dataLive: number
  dataCache: number
  dataTotal: number
}

const W = { brs: 20, rrg: 25, flow: 15, breadth: 20, soxl: 10, trust: 10 } as const

function scoreBRS(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'Benchmark RS'
  const M = W.brs
  if (i.soxxVsQQQ === 'Pending' || i.soxxVsSPY === 'Pending')
    return { component: c, score: 0, maxScore: M, label: 'Pending', note: 'Benchmark RS data unavailable' }
  const lead = [i.soxxVsQQQ, i.soxxVsSPY].filter(s => s === 'Leading').length
  const lag  = [i.soxxVsQQQ, i.soxxVsSPY].filter(s => s === 'Lagging').length
  if (lead === 2)              return { component: c, score: 20, maxScore: M, label: 'Confirming', note: 'SOXX leading QQQ and SPY' }
  if (lead === 1 && lag === 0) return { component: c, score: 15, maxScore: M, label: 'Confirming', note: 'SOXX leading one benchmark, neutral on other' }
  if (lag === 0)               return { component: c, score: 10, maxScore: M, label: 'Neutral',    note: 'SOXX neutral vs both benchmarks' }
  if (lag === 1)               return { component: c, score:  7, maxScore: M, label: 'Caution',    note: 'SOXX lagging one benchmark' }
  return                              { component: c, score:  3, maxScore: M, label: 'Diverging',  note: 'SOXX lagging both benchmarks' }
}

function scoreRRG(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'RRG Rotation'
  const M = W.rrg
  if (!i.rrgDataReady)
    return { component: c, score: 0, maxScore: M, label: 'Pending', note: 'RRG path data not yet generated' }
  switch (i.rrgMode) {
    case 'Broad Leadership':
    case 'Rotation Broadening':
      return { component: c, score: 25, maxScore: M, label: 'Confirming', note: 'Broad or broadening leadership across buckets' }
    case 'Narrow Leadership':
      return { component: c, score: 18, maxScore: M, label: 'Neutral',    note: 'Leadership concentrated in fewer buckets' }
    case 'High Dispersion':
      return { component: c, score: 12, maxScore: M, label: 'Neutral',    note: 'High rotation dispersion — mixed signals' }
    case 'Rotation Weakening':
      return { component: c, score:  7, maxScore: M, label: 'Caution',    note: 'Rotation weakening — leadership fading' }
    default:
      return { component: c, score:  0, maxScore: M, label: 'Pending',    note: 'RRG rotation mode pending' }
  }
}

function scoreFlow(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'Flow Volume'
  const M = W.flow
  if (i.flowOverallStatus === 'Pending')
    return { component: c, score: 0, maxScore: M, label: 'Pending', note: 'Flow proxy cache not generated' }
  if (i.flowConfirmingCount >= 2 && i.flowDistributionCount === 0)
    return { component: c, score: 15, maxScore: M, label: 'Confirming', note: `${i.flowConfirmingCount} confirming buckets, no distribution pressure` }
  if (i.flowConfirmingCount === 1 && i.flowDistributionCount === 0)
    return { component: c, score: 10, maxScore: M, label: 'Neutral',    note: '1 confirming bucket' }
  if (i.flowDistributionCount > 0 || i.flowOverallStatus === 'Distribution Pressure')
    return { component: c, score:  3, maxScore: M, label: 'Diverging',  note: 'Distribution pressure detected in bucket volume' }
  if (i.flowOverallStatus === 'Thin Participation')
    return { component: c, score:  5, maxScore: M, label: 'Caution',    note: 'Thin volume participation — signal not confirmed' }
  return                    { component: c, score:  8, maxScore: M, label: 'Neutral',    note: 'Neutral volume participation across buckets' }
}

function scoreBreadth(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'Breadth Momentum'
  const M = W.breadth
  if (i.breadthPct === null)
    return { component: c, score: 0, maxScore: M, label: 'Pending', note: 'Breadth data not available' }
  const b = i.breadthPct
  const a = i.advancingPct ?? 0
  if (b >= 65 && a >= 55) return { component: c, score: 20, maxScore: M, label: 'Confirming', note: `Breadth ${b.toFixed(0)}%, advancing ${a.toFixed(0)}%` }
  if (b >= 55)            return { component: c, score: 15, maxScore: M, label: 'Neutral',    note: `Breadth ${b.toFixed(0)}% — healthy but not broad` }
  if (b >= 45)            return { component: c, score: 10, maxScore: M, label: 'Neutral',    note: `Breadth ${b.toFixed(0)}% — mixed participation` }
  return                         { component: c, score:  5, maxScore: M, label: 'Caution',    note: `Breadth ${b.toFixed(0)}% — narrow participation` }
}

function scoreSoxl(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'SOXL Decay'
  const M = W.soxl
  switch (i.soxlDecayStatus) {
    case 'FAVORABLE': return { component: c, score: 10, maxScore: M, label: 'Confirming', note: 'SOXL tracking above expected 3× path' }
    case 'NEUTRAL':   return { component: c, score:  8, maxScore: M, label: 'Neutral',    note: 'SOXL decay within normal range (±2pp)' }
    case 'CAUTION':   return { component: c, score:  5, maxScore: M, label: 'Caution',    note: 'SOXL decay elevated — leverage drag noted' }
    case 'STRESS':    return { component: c, score:  2, maxScore: M, label: 'Diverging',  note: 'SOXL decay in stress range — significant leverage drag' }
    default:          return { component: c, score:  0, maxScore: M, label: 'Pending',    note: 'SOXL decay data not available' }
  }
}

function scoreTrust(i: SignalQualityInputs): SignalQualityComponentScore {
  const c: SignalQualityComponent = 'Data Trust'
  const M = W.trust
  if (i.dataTotal === 0)
    return { component: c, score: 0, maxScore: M, label: 'Pending', note: 'No data status counts available' }
  const r = (i.dataLive + i.dataCache) / i.dataTotal
  if (r >= 0.7) return { component: c, score: 10, maxScore: M, label: 'Confirming', note: `${Math.round(r * 100)}% live or cached data` }
  if (r >= 0.5) return { component: c, score:  7, maxScore: M, label: 'Neutral',    note: `${Math.round(r * 100)}% live or cached — some static/manual` }
  if (r >= 0.3) return { component: c, score:  4, maxScore: M, label: 'Caution',    note: `${Math.round(r * 100)}% live — significant static/pending data` }
  return               { component: c, score:  2, maxScore: M, label: 'Diverging',  note: 'Low data confidence — many fields pending or unavailable' }
}

export function computeSignalQuality(inputs: SignalQualityInputs): SemiconductorSignalQuality {
  const components = [
    scoreBRS(inputs),
    scoreRRG(inputs),
    scoreFlow(inputs),
    scoreBreadth(inputs),
    scoreSoxl(inputs),
    scoreTrust(inputs),
  ]

  const active   = components.filter(c => c.label !== 'Pending')
  const pending  = components.filter(c => c.label === 'Pending')
  const score    = active.reduce((s, c) => s + c.score, 0)
  const maxScore = active.reduce((s, c) => s + c.maxScore, 0)
  const pct      = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  let label: SignalQualityLabel
  if (pending.length >= 3)  { label = 'Pending' }
  else if (pct >= 80)       { label = 'High'    }
  else if (pct >= 60)       { label = 'Medium'  }
  else if (pct >= 40)       { label = 'Mixed'   }
  else                      { label = 'Low'     }

  const confirmingFactors = active.filter(c => c.label === 'Confirming').map(c => c.note)
  const cautionFactors    = active.filter(c => c.label === 'Caution' || c.label === 'Diverging').map(c => c.note)
  const pendingFactors    = pending.map(c => `${c.component} 데이터 대기 중`)

  const kor: string[] = [
    pending.length >= 3
      ? '데이터가 충분하지 않아 신호 품질을 확정할 수 없습니다.'
      : `현재 반도체 신호 품질은 ${label}입니다.`,
  ]
  if (confirmingFactors.length > 0)
    kor.push(`확인 요소: ${confirmingFactors.slice(0, 2).join(' · ')}.`)
  if (cautionFactors.length > 0)
    kor.push(`주의 요소: ${cautionFactors.slice(0, 2).join(' · ')}.`)

  return { score, maxScore, pct, label, components, confirmingFactors, cautionFactors, pendingFactors, koreanSummary: kor.join(' ') }
}

export const SQ_COLOR: Record<SignalQualityLabel, string> = {
  'High':    '#3FB6A8',
  'Medium':  '#4A9EE0',
  'Mixed':   '#D4B36A',
  'Low':     '#E55A5A',
  'Pending': '#6B7B95',
}

export const SQ_BG: Record<SignalQualityLabel, string> = {
  'High':    'rgba(63,182,168,0.10)',
  'Medium':  'rgba(74,158,224,0.09)',
  'Mixed':   'rgba(212,179,106,0.09)',
  'Low':     'rgba(229,90,90,0.09)',
  'Pending': 'rgba(107,123,149,0.08)',
}

export const COMP_LABEL_COLOR: Record<SignalQualityComponentLabel, string> = {
  'Confirming': '#3FB6A8',
  'Neutral':    '#B8C8DC',
  'Caution':    '#D4B36A',
  'Diverging':  '#E55A5A',
  'Pending':    '#6B7B95',
}
