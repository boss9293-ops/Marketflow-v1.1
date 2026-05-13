// AI 인프라 V2 — Sector Pulse Card 관찰 포인트 생성기 (우선순위 룰 기반)

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type {
  AIInfraBucketEarningsConfirmation,
  EarningsConfirmationLevel,
} from '@/lib/ai-infra/aiInfraEarningsConfirmation'

export type WatchPointPriority = 'high' | 'medium' | 'low'

export interface WatchPoint {
  text:     string
  priority: WatchPointPriority
}

function isStoryHeavy(state: AIInfraBucketState): boolean {
  return state.theme_purity?.theme_purity === 'STORY_HEAVY'
}

function isIndirect(state: AIInfraBucketState): boolean {
  return state.theme_purity?.theme_purity === 'INDIRECT_EXPOSURE'
}

export function buildWatchPoints(input: {
  state:    AIInfraBucketState
  earnings?: AIInfraBucketEarningsConfirmation
  conflict?: boolean
}): WatchPoint[] {
  const { state, earnings, conflict } = input
  const label  = state.state_label
  const eLevel: EarningsConfirmationLevel | undefined = earnings?.confirmation_level
  const points: WatchPoint[] = []

  // P1: Conflict signal
  if (conflict) {
    points.push({ text: '사이클 맥락과 인프라 신호 불일치 — 추가 확인 신호 대기', priority: 'high' })
  }

  // P2: Story heavy
  if (isStoryHeavy(state) || label === 'STORY_ONLY') {
    points.push({ text: '상업화 미확인 — 매출 인식 시점 관찰', priority: 'high' })
    points.push({ text: '양산 일정 / 고객 수주 가시화 여부 점검', priority: 'medium' })
  }

  // P3: Crowded + overheat
  if (label === 'CROWDED' || state.risk_flags.includes('OVERHEAT_RISK')) {
    points.push({ text: '단기 과열 + 모멘텀 확장 동시 발생', priority: 'high' })
    points.push({ text: 'MA50 회복 여부 확인', priority: 'medium' })
  }

  // P4: Distribution
  if (label === 'DISTRIBUTION') {
    points.push({ text: '강세 후 약화 — 추세 이탈 여부 점검', priority: 'high' })
    points.push({ text: '회복 신호 또는 추가 약화 방향 확인', priority: 'medium' })
  }

  // P5: Earnings gap (strong price, weak earnings)
  const isStrongState = label === 'LEADING' || label === 'EMERGING' || label === 'CONFIRMING'
  const isWeakEarnings = eLevel === 'WATCH' || eLevel === 'NOT_CONFIRMED' || eLevel === 'DATA_LIMITED' || eLevel == null
  if (isStrongState && isWeakEarnings && !isStoryHeavy(state)) {
    points.push({ text: '가격 강세 대비 실적 확인 부족', priority: 'high' })
    points.push({ text: '다음 분기 실적 가시화 여부 관찰', priority: 'medium' })
  }

  // P6: Indirect exposure
  if (isIndirect(state)) {
    points.push({ text: '직접 AI 매출 미확인 — 간접 수혜 경로 점검', priority: 'medium' })
    points.push({ text: '데이터센터 / 인프라 수요 지속 여부 관찰', priority: 'low' })
  }

  // P7: Data limited
  if (label === 'DATA_INSUFFICIENT') {
    points.push({ text: '가격 / 실적 데이터 부족 — 데이터 보강 대기', priority: 'high' })
  }

  // P8: Lagging
  if (label === 'LAGGING') {
    points.push({ text: '약세 지속 — 회복 신호 또는 추세 전환 대기', priority: 'medium' })
  }

  // P9: Generic fallback
  if (points.length === 0) {
    points.push({ text: '확인 신호 추가 관찰', priority: 'low' })
    points.push({ text: '추세 지속 여부 점검', priority: 'low' })
  }

  // Deduplicate (text-based) + cap at 3
  const seen = new Set<string>()
  const out: WatchPoint[] = []
  for (const p of points) {
    if (seen.has(p.text)) continue
    seen.add(p.text)
    out.push(p)
    if (out.length >= 3) break
  }
  return out
}
