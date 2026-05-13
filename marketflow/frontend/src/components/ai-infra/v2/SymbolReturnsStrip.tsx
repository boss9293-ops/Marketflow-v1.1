// AI 인프라 V2 — 종목 미니카드용 1W/1M/3M/90D 수익률 4열 스트립

import { fmtReturn, returnColor } from '@/lib/ai-infra/v2/symbolPriceFetcher'

const V = {
  text3:  '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  mono:   "'IBM Plex Mono', monospace",
} as const

interface Props {
  return_1w:  number | null
  return_1m:  number | null
  return_3m:  number | null
  ninety_day: number | null
}

export function SymbolReturnsStrip({ return_1w, return_1m, return_3m, ninety_day }: Props) {
  const cols: { label: string; value: number | null }[] = [
    { label: '1W',  value: return_1w  },
    { label: '1M',  value: return_1m  },
    { label: '3M',  value: return_3m  },
    { label: '90D', value: ninety_day },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      borderBottom: `1px solid ${V.border}`,
    }}>
      {cols.map(({ label, value }, i) => (
        <div
          key={label}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 4px',
            borderRight: i < 3 ? `1px solid ${V.border}` : 'none',
          }}
        >
          <span style={{
            fontFamily: V.mono, fontSize: 10, color: V.text3,
            letterSpacing: '0.08em', marginBottom: 4,
          }}>
            {label}
          </span>
          <span style={{
            fontFamily: V.mono, fontSize: 13, fontWeight: 700,
            color: returnColor(value),
          }}>
            {fmtReturn(value)}
          </span>
        </div>
      ))}
    </div>
  )
}
