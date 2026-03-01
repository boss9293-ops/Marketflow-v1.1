'use client'
import { useEffect, useState } from 'react'
import CircularProgress from './CircularProgress'

interface PredData {
  spy: { bullish_probability: number; direction: string; confidence: string }
  qqq: { bullish_probability: number; direction: string; confidence: string }
}

export default function PredictionGauge() {
  const [data, setData] = useState<PredData | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/prediction')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading prediction...</div>

  const getDirectionColor = (dir: string) => dir === 'Bullish' ? '#22c55e' : dir === 'Bearish' ? '#ef4444' : '#f97316'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      {[
        { label: 'SPY (S&P 500)', d: data.spy },
        { label: 'QQQ (NASDAQ 100)', d: data.qqq },
      ].map(({ label, d }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <h4 style={{ color: '#9ca3af', fontWeight: 500 }}>{label}</h4>
          <CircularProgress
            value={Math.round(d.bullish_probability)}
            size={160}
            strokeWidth={14}
            color={getDirectionColor(d.direction)}
            sublabel="% Bullish"
          />
          <div style={{ textAlign: 'center' }}>
            <span style={{ padding: '0.25rem 1rem', borderRadius: '9999px', background: `${getDirectionColor(d.direction)}20`, color: getDirectionColor(d.direction), fontWeight: 600 }}>
              {d.direction}
            </span>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Confidence: {d.confidence}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
