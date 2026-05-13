// AI 인프라 V2 — 버킷 상태 분포 기반 한 줄 결론 생성기

import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'

export interface OneLineConclusion {
  sentence:  string
  sub:       string
  highlight: string
}

function countLabel(states: AIInfraBucketState[], label: AIInfraStateLabel): number {
  return states.filter(s => s.state_label === label).length
}

function topByLabel(states: AIInfraBucketState[], label: AIInfraStateLabel): string | null {
  return (
    states
      .filter(s => s.state_label === label)
      .sort((a, b) => (b.state_score ?? 0) - (a.state_score ?? 0))[0]
      ?.display_name ?? null
  )
}

export function buildOneLineConclusion(states: AIInfraBucketState[]): OneLineConclusion {
  if (states.length === 0) {
    return { sentence: '데이터를 불러오는 중입니다.', sub: '', highlight: '#8b9098' }
  }

  const leading    = countLabel(states, 'LEADING')
  const emerging   = countLabel(states, 'EMERGING')
  const confirming = countLabel(states, 'CONFIRMING')
  const crowded    = countLabel(states, 'CROWDED')
  const dist       = countLabel(states, 'DISTRIBUTION')
  const lagging    = countLabel(states, 'LAGGING')
  const dataInsuf  = countLabel(states, 'DATA_INSUFFICIENT')

  const topLeading  = topByLabel(states, 'LEADING')
  const topEmerging = topByLabel(states, 'EMERGING')
  const topCrowded  = topByLabel(states, 'CROWDED')
  const topDist     = topByLabel(states, 'DISTRIBUTION')

  const usable = states.length - dataInsuf

  if (leading >= 3) {
    return {
      sentence: 'AI 인프라 섹터 전반에 강한 순환 흐름이 형성 중입니다.',
      sub: `${leading}개 버킷 Leading${topLeading ? ' — ' + topLeading + ' 포함' : ''}. ${emerging > 0 ? emerging + '개 Emerging 추가 상승 대기.' : ''}`.trim(),
      highlight: '#22c55e',
    }
  }

  if (leading >= 1 && emerging >= 2) {
    return {
      sentence: `${topLeading ?? 'AI Chip'} 주도, ${topEmerging ?? '인접 버킷'} 추종 흐름이 확인됩니다.`,
      sub: `${leading + emerging}개 버킷 모멘텀 확산. Confirming ${confirming}개 동반.`,
      highlight: '#22c55e',
    }
  }

  if (leading === 1 && emerging === 0) {
    return {
      sentence: `${topLeading ?? 'Leading 버킷'} 단독 주도권 유지 중. 인접 버킷 추종 여부 주시.`,
      sub: `나머지 ${usable - 1}개 버킷 중 Confirming ${confirming}개.`,
      highlight: '#5DCFB0',
    }
  }

  if (crowded >= 2) {
    return {
      sentence: '과열 구간 버킷 증가 — 신규 모멘텀보다 로테이션 탐색이 유효합니다.',
      sub: `Crowded ${crowded}개${topCrowded ? ' (' + topCrowded + ' 포함)' : ''}. Leading ${leading}개.`,
      highlight: '#fbbf24',
    }
  }

  if (dist >= 2) {
    return {
      sentence: '분배(Distribution) 국면 버킷 증가 — 섹터 전반 로테이션 압력이 높아지고 있습니다.',
      sub: `Distribution ${dist}개${topDist ? ' (' + topDist + ' 포함)' : ''}. Lagging ${lagging}개.`,
      highlight: '#f97316',
    }
  }

  if (lagging >= 6) {
    return {
      sentence: 'AI 인프라 전반 부진 — 명확한 주도 버킷이 부재한 조정 국면입니다.',
      sub: `Lagging ${lagging}개 / Leading ${leading}개.`,
      highlight: '#ef4444',
    }
  }

  if (confirming >= 4 && leading === 0) {
    return {
      sentence: '뚜렷한 주도 버킷 없이 전반적인 Confirming 흐름 — 로테이션 초기 징후 탐색 중.',
      sub: `Confirming ${confirming}개. 명확한 Leading 형성 대기.`,
      highlight: '#3FB6A8',
    }
  }

  const positiveCount = leading + emerging + confirming
  return {
    sentence: `혼재 구간 — ${positiveCount}개 버킷 긍정 흐름, ${lagging}개 부진.`,
    sub: `Leading ${leading} / Emerging ${emerging} / Lagging ${lagging}.`,
    highlight: '#B8C8DC',
  }
}
