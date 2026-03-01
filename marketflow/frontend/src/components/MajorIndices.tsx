'use client'
import { useEffect, useState } from 'react'

interface IndexData { name: string; price: number; change_pct: number }
interface MarketData {
  indices: Record<string, IndexData>
  volatility: Record<string, IndexData>
  commodities: Record<string, IndexData>
}

// 표시할 8개 항목 순서 고정
const DISPLAY_ORDER = [
  { key: 'DIA',      label: 'DOW JONES'    },
  { key: 'SPY',      label: 'S&P 500'      },
  { key: 'QQQ',      label: 'NASDAQ 100'   },
  { key: 'IWM',      label: 'RUSSELL 2000' },
  { key: '^VIX',     label: 'VIX'          },
  { key: 'GC=F',     label: 'GOLD'         },
  { key: 'CL=F',     label: 'CRUDE OIL'    },
  { key: 'BTC-USD',  label: 'BITCOIN'      },
]

export default function MajorIndices() {
  const [data, setData] = useState<MarketData | null>(null)
  const [refresh, setRefresh] = useState(0)

  const load = () =>
    fetch('http://localhost:5001/api/market/indices')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})

  useEffect(() => { load() }, [refresh])

  const flat: Record<string, IndexData> = {
    ...(data?.indices    ?? {}),
    ...(data?.volatility ?? {}),
    ...(data?.commodities ?? {}),
  }

  return (
    <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid rgba(255,255,255,0.05)', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem', margin: 0 }}>Major Indices</h3>
        <button
          onClick={() => setRefresh(r => r + 1)}
          style={{ background: 'none', border: 'none', color: '#00D9FF', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ↻ Refresh
        </button>
      </div>

      {!data ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: '0.85rem' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {DISPLAY_ORDER.map(({ key, label }) => {
            const item = flat[key]
            if (!item) return (
              <div key={key} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.625rem 0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.6rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>—</div>
              </div>
            )
            const up = (item.change_pct ?? 0) >= 0
            const changeColor = up ? '#22c55e' : '#ef4444'
            // VIX는 오름이 빨간색
            const isVix = key === '^VIX'
            const displayColor = isVix ? (up ? '#ef4444' : '#22c55e') : changeColor
            return (
              <div key={key} style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                padding: '0.625rem 0.75rem',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white', lineHeight: 1.1 }}>
                  {item.price >= 1000
                    ? item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : item.price.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: displayColor, marginTop: 2 }}>
                  {up ? '▲' : '▼'}{up ? '+' : ''}{item.change_pct?.toFixed(2)}%
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
