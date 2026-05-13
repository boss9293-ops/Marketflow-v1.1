// AI 인프라 V2 — Sector Pulse Card Section E: 관찰 포인트 (최대 3개)

import type { WatchPoint } from '@/lib/ai-infra/v2/buildWatchPoints'

const V = {
  text: '#f1f5f9', text2: '#cbd5e1', text3: '#94a3b8',
  border: 'rgba(148,163,184,0.24)',
  warning: '#fbbf24',
  ui: "Inter, Pretendard, 'Noto Sans KR', sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
} as const

const PRIORITY_COL: Record<WatchPoint['priority'], string> = {
  high:   '#fbbf24',
  medium: '#B8C8DC',
  low:    '#8b9098',
}

interface Props {
  points: WatchPoint[]
}

export function SectorPulseWatchPoints({ points }: Props) {
  return (
    <div style={{
      padding: 12, border: `1px solid ${V.border}`, borderRadius: 4,
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        <span style={{
          fontFamily: V.mono, fontSize: 10, color: V.warning, letterSpacing: '0.10em',
        }}>
          지금 확인할 것
        </span>
      </div>

      {points.length === 0 ? (
        <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
          관찰 포인트 준비 중.
        </div>
      ) : (
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {points.map((p, idx) => (
            <li
              key={idx}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontFamily: V.ui, fontSize: 12, color: V.text2, lineHeight: 1.5,
              }}
            >
              <span style={{
                color: PRIORITY_COL[p.priority], flexShrink: 0,
                fontFamily: V.mono, fontSize: 12, marginTop: 1,
              }}>
                ▸
              </span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
