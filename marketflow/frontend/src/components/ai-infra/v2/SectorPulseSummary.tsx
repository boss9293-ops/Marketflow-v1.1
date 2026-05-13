// AI 인프라 V2 — Sector Pulse Card Section C: 한 줄 요약 + 1W/1M/3M 수익률

import type { SectorPulseSummary as SummaryData } from '@/lib/ai-infra/v2/buildSectorPulseSummary'
import { fmtReturn, returnColor } from '@/lib/ai-infra/v2/symbolPriceFetcher'

const V = {
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

const TONE_COLOR: Record<SummaryData['tone'], string> = {
  positive: '#22c55e',
  caution:  '#fbbf24',
  neutral:  '#B8C8DC',
  warning:  '#f97316',
  data:     '#8b9098',
}

interface Props {
  summary:   SummaryData
  return_1w: number | null
  return_1m: number | null
  return_3m: number | null
  symbol:    string | null
}

function ReturnCell({ label, value }: { label: string; value: number | null }) {
  const col = returnColor(value)
  return (
    <div style={{ flex: 1, minWidth: 60 }}>
      <div style={{
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: V.mono, fontSize: 16, fontWeight: 700, color: col,
        marginTop: 2,
      }}>
        {fmtReturn(value)}
      </div>
    </div>
  )
}

export function SectorPulseSummary({ summary, return_1w, return_1m, return_3m, symbol }: Props) {
  const toneCol = TONE_COLOR[summary.tone]
  return (
    <div style={{
      padding: 12, border: `1px solid ${V.border}`, borderRadius: 4,
      background: 'rgba(255,255,255,0.02)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Section label */}
      <div style={{
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em',
      }}>
        SUMMARY
      </div>

      {/* Summary text */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        paddingBottom: 4,
      }}>
        <div style={{
          width: 3, alignSelf: 'stretch', flexShrink: 0,
          background: toneCol, borderRadius: 2,
        }} />
        <div>
          <div style={{
            fontFamily: V.ui, fontSize: 14, fontWeight: 700, color: V.text,
            lineHeight: 1.45, marginBottom: 4,
          }}>
            {summary.sentence}
          </div>
          <div style={{
            fontFamily: V.ui, fontSize: 12, color: V.text2, lineHeight: 1.5,
          }}>
            {summary.sub_sentence}
          </div>
        </div>
      </div>

      {/* Returns row */}
      <div style={{
        display: 'flex', gap: 10, paddingTop: 8,
        borderTop: `1px solid ${V.border}`,
      }}>
        <ReturnCell label="1W" value={return_1w} />
        <ReturnCell label="1M" value={return_1m} />
        <ReturnCell label="3M" value={return_3m} />
      </div>
      {symbol && (
        <div style={{
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em',
        }}>
          수익률 기준: {symbol}
        </div>
      )}
    </div>
  )
}
