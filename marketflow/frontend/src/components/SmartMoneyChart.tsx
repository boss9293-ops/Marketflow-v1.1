'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Signal {
  ticker: string
  name: string
  score: number
  volume_ratio: number
  institutional_pct: number
  price_change_5d: number
  signal: string
  price: number
}

export default function SmartMoneyChart() {
  const [data, setData] = useState<{ signals: Signal[] } | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/smart-money')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const signals = data?.signals || []

  return (
    <div>
      {signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading smart money data...</div>
      ) : (
        <>
          <div style={{ height: '220px', marginBottom: '1.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signals.slice(0, 10)} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <XAxis dataKey="ticker" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                />
                <Bar dataKey="score" fill="#00D9FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Ticker', 'Score', 'Vol Ratio', 'Inst%', '5D Chg', 'Signal'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: '0.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#00D9FF' }}>{s.ticker}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'white', fontWeight: 500 }}>{s.score}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#9ca3af' }}>{s.volume_ratio}x</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#9ca3af' }}>{s.institutional_pct}%</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: s.price_change_5d >= 0 ? '#22c55e' : '#ef4444' }}>
                    {s.price_change_5d >= 0 ? '+' : ''}{s.price_change_5d}%
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: s.signal === 'Strong Buying' ? '#22c55e' : '#f97316' }}>{s.signal}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
