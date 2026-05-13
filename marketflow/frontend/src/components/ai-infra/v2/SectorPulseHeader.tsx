// AI 인프라 V2 — Sector Pulse Card Section A: 헤더 (섹터명 + 상태 뱃지 + 점수)

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_COLORS, STATE_DISPLAY_LABELS } from '@/lib/ai-infra/aiInfraStateLabels'

const V = {
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

interface Props {
  state:   AIInfraBucketState
  onClose: () => void
}

export function SectorPulseHeader({ state, onClose }: Props) {
  const col = STATE_COLORS[state.state_label]
  const purity = state.theme_purity

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, padding: '14px 18px 12px',
      borderBottom: `1px solid ${V.border}`,
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.14em',
          marginBottom: 4,
        }}>
          SECTOR PULSE
        </div>
        <div style={{
          fontFamily: V.ui, fontSize: 18, fontWeight: 700, color: V.text,
          lineHeight: 1.25,
        }}>
          {state.display_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 3,
            fontFamily: V.ui, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
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
            fontFamily: V.mono, fontSize: 11, color: V.text3, letterSpacing: '0.06em',
          }}>
            · 신뢰도 {state.confidence}
          </span>
          {/* Purity badges */}
          {purity?.theme_purity === 'STORY_HEAVY' && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.35)', borderRadius: 3,
              padding: '1px 6px', letterSpacing: '0.05em',
            }}>
              Story Heavy
            </span>
          )}
          {purity?.theme_purity === 'INDIRECT_EXPOSURE' && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.text3,
              border: '1px solid rgba(139,144,152,0.35)', borderRadius: 3,
              padding: '1px 6px', letterSpacing: '0.05em',
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
          color: V.text3, fontSize: 20, lineHeight: 1, padding: '2px 6px',
          flexShrink: 0,
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  )
}
