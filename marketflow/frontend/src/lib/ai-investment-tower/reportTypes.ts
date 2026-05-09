// AI Investment Tower 리포트 공유 타입 및 어댑터 계약

import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import type { AIInfraBucketState, AIInfraRiskFlag } from '@/lib/ai-infra/aiInfraStateLabels'

// ── Enum types ────────────────────────────────────────────────────────────────

export type RRGStateLabel   = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING' | 'MIXED' | 'UNKNOWN'
export type TrendLabel      = 'UPTREND' | 'RECOVERING' | 'SIDEWAYS' | 'DOWNTREND' | 'EXTENDED' | 'UNKNOWN'
export type BreadthLabel    = 'BROAD' | 'IMPROVING' | 'NARROW' | 'WEAK' | 'UNKNOWN'
export type RiskLabel       = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'EXTREME' | 'UNKNOWN'
export type BeginnerGroup   = 'working' | 'emerging' | 'losing' | 'caution' | 'neutral'

// ── Core shared input type ────────────────────────────────────────────────────

export type LayerReportInput = {
  id:            string
  label:         string
  koreanLabel:   string
  primaryEtf?:   string
  basketLabel?:  string
  rrgState:      RRGStateLabel
  momentum1w:    number | null   // 5-trading-day return — null until route exposes it
  momentum1m:    number | null
  momentum3m:    number | null
  trendLabel:    TrendLabel
  breadthLabel:  BreadthLabel
  riskLabel:     RiskLabel
  towerSignal:   string          // Korean user-facing action label
}

// ── Output types ──────────────────────────────────────────────────────────────

export type BeginnerLayerReport = {
  layerId:      string
  koreanLabel:  string           // display name for narrative text
  statusLabel:  string           // Korean simple label
  headline:     string           // one-line headline
  explanation:  string           // 2–4 sentence explanation
  group:        BeginnerGroup
  riskLabel:    RiskLabel
}

export type ProLayerReport = {
  layerId:          string
  label:            string
  koreanLabel:      string
  primaryEtf?:      string
  rrgState:         RRGStateLabel
  momentum1w:       number | null
  momentum1m:       number | null
  momentum3m:       number | null
  trendLabel:       TrendLabel
  breadthLabel:     BreadthLabel
  riskLabel:        RiskLabel
  towerSignal:      string
  rrgComment:       string
  momentumComment:  string
  trendComment:     string
  riskComment:      string
  nextCheckpoint:   string
}

// ── Korean label map per bucket_id ────────────────────────────────────────────

const KOREAN_LAYER_LABELS: Record<string, string> = {
  AI_CHIP:           'AI 컴퓨트 (반도체)',
  HBM_MEMORY:        '메모리 / HBM',
  PACKAGING:         '첨단 패키징',
  COOLING:           '냉각',
  PCB_SUBSTRATE:     'PCB / 기판',
  TEST_EQUIPMENT:    '테스트 장비',
  GLASS_SUBSTRATE:   '유리 기판',
  OPTICAL_NETWORK:   '광 네트워크',
  POWER_INFRA:       '전력 인프라',
  CLEANROOM_WATER:   '클린룸 / 수처리',
  SPECIALTY_GAS:     '특수 가스',
  DATA_CENTER_INFRA: '데이터센터 인프라',
  RAW_MATERIAL:      '원자재',
}

// ── Adapter: AIInfraBucketMomentum + AIInfraBucketState → LayerReportInput ───

function stateToRRG(label: AIInfraBucketState['state_label']): RRGStateLabel {
  switch (label) {
    case 'LEADING':      return 'LEADING'
    case 'CROWDED':      return 'LEADING'
    case 'EMERGING':     return 'IMPROVING'
    case 'CONFIRMING':   return 'MIXED'
    case 'DISTRIBUTION': return 'WEAKENING'
    case 'LAGGING':      return 'LAGGING'
    default:             return 'UNKNOWN'
  }
}

function deriveTrend(
  m: AIInfraBucketMomentum,
  flags: AIInfraRiskFlag[],
): TrendLabel {
  const { one_month: r1m, three_month: r3m, six_month: r6m } = m.returns
  if (flags.includes('OVERHEAT_RISK')) return 'EXTENDED'
  if (r3m !== null && r3m > 5 && r1m !== null && r1m > 0) return 'UPTREND'
  if (r3m !== null && r3m > 0 && r1m !== null && r1m > 0) return 'UPTREND'
  if (r1m !== null && r1m < 0 && r3m !== null && r3m > 0) return 'RECOVERING'
  if (r3m !== null && r3m < 0 && r6m !== null && r6m > 0) return 'RECOVERING'
  if ((r3m !== null && r3m < -10) || (r1m !== null && r1m < 0 && r3m !== null && r3m < 0)) return 'DOWNTREND'
  return 'SIDEWAYS'
}

function deriveRisk(flags: AIInfraRiskFlag[]): RiskLabel {
  if (flags.includes('OVERHEAT_RISK') && flags.includes('MOMENTUM_STRETCH')) return 'HIGH'
  if (flags.includes('OVERHEAT_RISK')) return 'ELEVATED'
  if (flags.includes('RS_UNDERPERFORMANCE') || flags.includes('RRG_WEAKENING')) return 'MODERATE'
  if (flags.includes('LOW_COVERAGE') || flags.includes('PARTIAL_DATA')) return 'MODERATE'
  if (flags.length === 0) return 'LOW'
  return 'MODERATE'
}

function stateTowerSignal(label: AIInfraBucketState['state_label']): string {
  switch (label) {
    case 'LEADING':      return '주도권 유지'
    case 'EMERGING':     return '비중 확대 후보'
    case 'CONFIRMING':   return '관심권 진입'
    case 'CROWDED':      return '비중 조절 주의'
    case 'DISTRIBUTION': return '비중 조절 주의'
    case 'LAGGING':      return '관망 우선'
    case 'STORY_ONLY':   return '확인 필요'
    default:             return '확인 필요'
  }
}

export function adaptToBucketReport(
  momentum: AIInfraBucketMomentum,
  state: AIInfraBucketState,
): LayerReportInput {
  return {
    id:           momentum.bucket_id,
    label:        momentum.display_name,
    koreanLabel:  KOREAN_LAYER_LABELS[momentum.bucket_id] ?? momentum.display_name,
    primaryEtf:   momentum.benchmark,
    rrgState:     stateToRRG(state.state_label),
    momentum1w:   null,
    momentum1m:   momentum.returns.one_month,
    momentum3m:   momentum.returns.three_month,
    trendLabel:   deriveTrend(momentum, state.risk_flags),
    breadthLabel: 'UNKNOWN',
    riskLabel:    deriveRisk(state.risk_flags),
    towerSignal:  stateTowerSignal(state.state_label),
  }
}

export function adaptAllLayers(
  buckets:       AIInfraBucketMomentum[],
  bucketStates:  AIInfraBucketState[],
): LayerReportInput[] {
  const stateMap = new Map(bucketStates.map(s => [s.bucket_id, s]))
  return buckets
    .map(b => {
      const state = stateMap.get(b.bucket_id)
      if (!state) return null
      return adaptToBucketReport(b, state)
    })
    .filter((r): r is LayerReportInput => r !== null)
}
