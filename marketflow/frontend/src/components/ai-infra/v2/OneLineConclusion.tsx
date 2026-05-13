// AI 인프라 V2 — 섹터 상태 한 줄 결론 배너

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { buildOneLineConclusion } from '@/lib/ai-infra/v2/buildOneLineConclusion'

interface Props {
  states: AIInfraBucketState[]
}

export function OneLineConclusion({ states }: Props) {
  const c = buildOneLineConclusion(states)
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 16px', borderRadius: 4, marginBottom: 12,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${c.highlight}44`,
    }}>
      <div style={{
        width: 3, flexShrink: 0, alignSelf: 'stretch',
        borderRadius: 2, background: c.highlight,
      }} />
      <div>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 14, fontWeight: 700, color: c.highlight, lineHeight: 1.4,
          marginBottom: c.sub ? 4 : 0,
        }}>
          {c.sentence}
        </div>
        {c.sub && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, color: '#8b9098', letterSpacing: '0.04em',
          }}>
            {c.sub}
          </div>
        )}
      </div>
    </div>
  )
}
