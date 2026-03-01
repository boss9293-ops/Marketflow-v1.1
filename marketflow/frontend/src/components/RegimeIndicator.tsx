'use client'
import { useEffect, useState } from 'react'

interface RegimeData {
  trend: string
  risk_appetite: string
  volatility: string
  cycle: string
  vix_level: number
  strategy: string
  confidence: string
}

export default function RegimeIndicator() {
  const [data, setData] = useState<RegimeData | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/regime')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading regime data...</div>

  const trendColors: Record<string, string> = { Bull: '#22c55e', Bear: '#ef4444', Transition: '#f97316' }
  const riskColors: Record<string, string> = { 'Risk On': '#22c55e', 'Risk Off': '#ef4444' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Trend', value: data.trend, color: trendColors[data.trend] || '#9ca3af' },
          { label: 'Risk Appetite', value: data.risk_appetite, color: riskColors[data.risk_appetite] || '#9ca3af' },
          { label: 'Volatility', value: data.volatility, color: '#9ca3af' },
          { label: 'Cycle', value: data.cycle, color: '#00D9FF' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '10px', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontWeight: 600, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px' }}>VIX Level</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: data.vix_level < 20 ? '#22c55e' : data.vix_level < 30 ? '#f97316' : '#ef4444' }}>{data.vix_level}</div>
      </div>
      <div style={{ background: 'rgba(0,217,255,0.05)', border: '1px solid rgba(0,217,255,0.2)', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px' }}>Strategy Recommendation</div>
        <div style={{ fontSize: '0.9rem', color: '#00D9FF', lineHeight: 1.5 }}>{data.strategy}</div>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '6px' }}>Confidence: {data.confidence}</div>
      </div>
    </div>
  )
}
