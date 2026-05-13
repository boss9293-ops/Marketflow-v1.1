// AI 인프라 V2 — Sector Pulse Card 한 줄 요약 생성기 (룰 기반)

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type {
  AIInfraBucketEarningsConfirmation,
  EarningsConfirmationLevel,
} from '@/lib/ai-infra/aiInfraEarningsConfirmation'

export type PulseSummaryTone = 'positive' | 'caution' | 'neutral' | 'warning' | 'data'

export interface SectorPulseSummary {
  sentence:     string
  sub_sentence: string
  tone:         PulseSummaryTone
}

function isStoryHeavy(state: AIInfraBucketState): boolean {
  return state.theme_purity?.theme_purity === 'STORY_HEAVY'
}

function isIndirect(state: AIInfraBucketState): boolean {
  return state.theme_purity?.theme_purity === 'INDIRECT_EXPOSURE'
}

export function buildSectorPulseSummary(input: {
  state:    AIInfraBucketState
  earnings?: AIInfraBucketEarningsConfirmation
}): SectorPulseSummary {
  const { state, earnings } = input
  const label  = state.state_label
  const eLevel: EarningsConfirmationLevel | undefined = earnings?.confirmation_level
  const name   = state.display_name

  // P1: STORY_ONLY / STORY_HEAVY
  if (label === 'STORY_ONLY' || isStoryHeavy(state)) {
    return {
      sentence:     '가격 흐름 활발하나 상업화 미확인 단계입니다.',
      sub_sentence: '매출 인식 시점과 양산 가시화 여부를 관찰.',
      tone:         'warning',
    }
  }

  // P2: DATA_INSUFFICIENT
  if (label === 'DATA_INSUFFICIENT') {
    return {
      sentence:     '가격 데이터가 부족해 신호가 미확정 상태입니다.',
      sub_sentence: '커버리지 보강 이후 재평가가 필요한 구간.',
      tone:         'data',
    }
  }

  // P3: INDIRECT EXPOSURE
  if (isIndirect(state)) {
    if (label === 'LEADING' || label === 'EMERGING' || label === 'CONFIRMING') {
      return {
        sentence:     '간접 수혜 가능성, 직접 AI 매출은 미확인입니다.',
        sub_sentence: '데이터센터 / 인프라 수요 동향을 함께 관찰.',
        tone:         'caution',
      }
    }
  }

  // P4: CROWDED
  if (label === 'CROWDED') {
    return {
      sentence:     `${name} 단기 과열 + 모멘텀 확장 동시 발생 구간입니다.`,
      sub_sentence: '단기 조정 후 추세 지속 여부를 관찰.',
      tone:         'warning',
    }
  }

  // P5: DISTRIBUTION
  if (label === 'DISTRIBUTION') {
    return {
      sentence:     `${name} 분배 국면 — 강세 후 약화 신호가 감지됩니다.`,
      sub_sentence: '추세 이탈 여부와 회복 신호를 관찰.',
      tone:         'warning',
    }
  }

  // P6: LEADING
  if (label === 'LEADING') {
    if (eLevel === 'CONFIRMED') {
      return {
        sentence:     `${name} 수요 강세 + 실적 확인 — 주도 흐름 형성 중.`,
        sub_sentence: '과열 여부와 단기 조정 구간을 함께 관찰.',
        tone:         'positive',
      }
    }
    if (eLevel === 'PARTIAL') {
      return {
        sentence:     `${name} 가격 주도, 실적 일부 확인 단계입니다.`,
        sub_sentence: '다음 분기 실적 확정 여부를 관찰.',
        tone:         'positive',
      }
    }
    return {
      sentence:     `${name} 가격 주도 흐름, 실적 확인은 부족합니다.`,
      sub_sentence: '실적 가시화 여부를 우선 관찰.',
      tone:         'caution',
    }
  }

  // P7: EMERGING / CONFIRMING
  if (label === 'EMERGING' || label === 'CONFIRMING') {
    if (eLevel === 'CONFIRMED' || eLevel === 'PARTIAL') {
      return {
        sentence:     `${name} 확산 흐름 + 실적 확인 진행 중.`,
        sub_sentence: '주도권 강화 여부와 후행 버킷 동반 여부 관찰.',
        tone:         'positive',
      }
    }
    return {
      sentence:     `${name} 가격 확산 시작, 실적 확인은 미진합니다.`,
      sub_sentence: '확산 지속과 실적 가시화 여부를 관찰.',
      tone:         'neutral',
    }
  }

  // P8: LAGGING
  if (label === 'LAGGING') {
    return {
      sentence:     `${name} 가격 약세 지속 구간입니다.`,
      sub_sentence: '회복 신호 또는 추세 전환 여부를 관찰.',
      tone:         'caution',
    }
  }

  // Fallback
  return {
    sentence:     `${name} 혼재 구간 — 추가 신호 확인이 필요합니다.`,
    sub_sentence: '주도 / 부진 방향 명확화 여부를 관찰.',
    tone:         'neutral',
  }
}
