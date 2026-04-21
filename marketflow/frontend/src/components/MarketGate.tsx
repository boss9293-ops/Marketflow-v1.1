'use client'
import { useEffect, useState } from 'react'
import CircularProgress from './CircularProgress'
import { clientApiUrl } from '@/lib/backendApi'

interface GateData {
  score: number
  status: string
  signal: string
  components: { vix: number; trend: number; momentum: number; regime: number }
}

const STATUS_COLOR: Record<string, string> = {
  GREEN:  '#22c55e',
  YELLOW: '#f59e0b',
  RED:    '#ef4444',
}

export default function MarketGate() {
  const [data, setData] = useState<GateData | null>(null)

  useEffect(() => {
    fetch(clientApiUrl('/api/market/gate'))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ score: 65, status: 'YELLOW', signal: 'SELECTIVE', components: { vix: 20, trend: 25, momentum: 10, regime: 10 } }))
  }, [])

  if (!data) return (
    <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading...</span>
    </div>
  )

  const color = STATUS_COLOR[data.status] || '#f59e0b'

  return (
    <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', height: '100%' }}>
      <h3 style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem', margin: '0 0 1.25rem 0' }}>US Market Gate</h3>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
        <CircularProgress value={data.score} size={120} strokeWidth={10} color="auto" sublabel="/100" />
        <span style={{
          padding: '0.25rem 1.25rem', borderRadius: 9999,
          background: `${color}20`, color,
          fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em',
        }}>
          {data.status}
        </span>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', textAlign: 'center' }}>
          RSI: {data.components.momentum ?? '--'} &nbsp;|&nbsp; VIX: {data.components.vix ?? '--'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
        {Object.entries(data.components).map(([key, val]) => (
          <div key={key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{key}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
