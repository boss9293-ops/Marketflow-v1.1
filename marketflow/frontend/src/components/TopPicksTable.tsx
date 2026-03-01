'use client'
import { useEffect, useState } from 'react'

interface Pick {
  rank: number
  ticker: string
  name: string
  sector: string
  price: number
  composite_score: number
  grade: string
  signal: string
  rsi: number
  institutional_pct: number
  trend_alignment: string
  target_upside: number
}

export default function TopPicksTable() {
  const [data, setData] = useState<{ top_picks: Pick[] } | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/top-picks')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const gradeColors: Record<string, string> = { A: '#22c55e', B: '#f97316', C: '#6b7280' }
  const signalColors: Record<string, string> = { 'Strong Buy': '#22c55e', 'Buy': '#3b82f6', 'Hold': '#6b7280' }

  return (
    <div style={{ overflowX: 'auto' }}>
      {!data?.top_picks?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading picks...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['#', 'Ticker', 'Name', 'Sector', 'Price', 'Score', 'Grade', 'Signal', 'RSI', 'Inst%', 'Upside'].map(h => (
                <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.top_picks.map((pick) => (
              <tr key={pick.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.75rem', color: '#6b7280' }}>{pick.rank}</td>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#00D9FF' }}>{pick.ticker}</td>
                <td style={{ padding: '0.75rem', color: '#d1d5db', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick.name}</td>
                <td style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.75rem' }}>{pick.sector}</td>
                <td style={{ padding: '0.75rem', color: 'white', fontWeight: 500 }}>${pick.price}</td>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: 'white' }}>{pick.composite_score}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '9999px', background: `${gradeColors[pick.grade]}20`, color: gradeColors[pick.grade], fontWeight: 600, fontSize: '0.75rem' }}>{pick.grade}</span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ color: signalColors[pick.signal] || '#9ca3af', fontSize: '0.8rem' }}>{pick.signal}</span>
                </td>
                <td style={{ padding: '0.75rem', color: pick.rsi > 70 ? '#ef4444' : pick.rsi < 30 ? '#22c55e' : '#9ca3af' }}>{pick.rsi}</td>
                <td style={{ padding: '0.75rem', color: '#9ca3af' }}>{pick.institutional_pct}%</td>
                <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 500 }}>+{pick.target_upside}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
