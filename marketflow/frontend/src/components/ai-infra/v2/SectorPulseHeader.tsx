// AI 인프라 V2 — Sector Pulse Card Section A: 헤더 (섹터명 + 상태 뱃지 + 점수)

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_COLORS, STATE_DISPLAY_LABELS } from '@/lib/ai-infra/aiInfraStateLabels'

const V = {
  text:  '#f1f5f9',
  text2: '#cbd5e1',
  text3: '#94a3b8',
  border: 'rgba(148,163,184,0.24)',
  ui:   "Inter, Pretendard, 'Noto Sans KR', sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
} as const

interface Props {
  state:   AIInfraBucketState
  onClose: () => void
}

function stateSubtitle(state: AIInfraBucketState): string {
  const labels: string[] = []
  if (state.risk_flags.includes('OVERHEAT_RISK'))         labels.push('단기 과열')
  if (state.risk_flags.includes('MOMENTUM_STRETCH'))      labels.push('모멘텀 확장')
  if (state.risk_flags.includes('RRG_WEAKENING'))         labels.push('모멘텀 약화')
  if (state.risk_flags.includes('RS_UNDERPERFORMANCE'))   labels.push('상대 강도 저하')
  if (labels.length > 0) return labels.join(' · ') + ' 구간'
  const fallback: Partial<Record<string, string>> = {
    LEADING:           '모멘텀 선도 구간',
    EMERGING:          '상승 전환 구간',
    CONFIRMING:        '순환 참여 확인',
    LAGGING:           '상대 강도 저하 구간',
    DISTRIBUTION:      '분배 진행 구간',
    STORY_ONLY:        '서사 중심 · 실적 미확인',
    DATA_INSUFFICIENT: '데이터 부족',
  }
  return fallback[state.state_label] ?? ''
}

export function SectorPulseHeader({ state, onClose }: Props) {
  const col      = STATE_COLORS[state.state_label]
  const purity   = state.theme_purity
  const subtitle = stateSubtitle(state)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, padding: '16px 20px 14px',
      borderBottom: `1px solid ${V.border}`,
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* Eye-brow label */}
        <div style={{
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.14em',
          marginBottom: 5,
        }}>
          SECTOR PULSE
        </div>

        {/* Main title */}
        <div style={{
          fontFamily: V.ui, fontSize: 22, fontWeight: 750, color: V.text,
          lineHeight: 1.2, letterSpacing: '-0.02em',
        }}>
          {state.display_name}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            fontFamily: V.ui, fontSize: 13, fontWeight: 500, color: V.text2,
            marginTop: 4, lineHeight: 1.4,
          }}>
            {subtitle}
          </div>
        )}

        {/* Metrics row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 4,
            fontFamily: V.ui, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            color: '#0f1117', background: col,
          }}>
            {STATE_DISPLAY_LABELS[state.state_label]}
          </span>
          {state.state_score != null && (
            <span style={{
              fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.04em',
            }}>
              Score {state.state_score}
            </span>
          )}
          <span style={{
            fontFamily: V.ui, fontSize: 12, color: V.text3,
          }}>
            · 신뢰도 {state.confidence}
          </span>
          {purity?.theme_purity === 'STORY_HEAVY' && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.35)', borderRadius: 3,
              padding: '1px 6px', letterSpacing: '0.04em',
            }}>
              Story Heavy
            </span>
          )}
          {purity?.theme_purity === 'INDIRECT_EXPOSURE' && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.text3,
              border: '1px solid rgba(148,163,184,0.35)', borderRadius: 3,
              padding: '1px 6px', letterSpacing: '0.04em',
            }}>
              Indirect
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: V.text3, fontSize: 22, lineHeight: 1, padding: '2px 6px',
          flexShrink: 0,
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  )
}
