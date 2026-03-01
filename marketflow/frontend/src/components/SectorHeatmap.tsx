'use client'
import { useEffect, useState } from 'react'

interface Sector {
  name: string
  symbol: string
  change_pct: number
  week_pct: number
  month_pct: number
  strength: string
}

export default function SectorHeatmap() {
  const [data, setData] = useState<{ sectors: Sector[] } | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/sectors')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const sectors = data?.sectors || []

  const getColor = (pct: number) => {
    if (pct > 2) return { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' }
    if (pct > 0.5) return { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', text: '#86efac' }
    if (pct > -0.5) return { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: '#9ca3af' }
    if (pct > -2) return { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#fca5a5' }
    return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
      {sectors.map((s) => {
        const col = getColor(s.change_pct)
        return (
          <div key={s.symbol} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: '10px', padding: '0.875rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '2px' }}>{s.symbol}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', marginBottom: '6px', lineHeight: 1.2 }}>{s.name}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: col.text }}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px' }}>1W: {s.week_pct >= 0 ? '+' : ''}{s.week_pct}%</div>
          </div>
        )
      })}
    </div>
  )
}
