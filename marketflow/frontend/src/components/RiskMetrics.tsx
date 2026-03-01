'use client'
import { useEffect, useState } from 'react'

interface RiskData {
  var_95: Record<string, number>
  var_99: Record<string, number>
  max_drawdown: Record<string, number>
  sharpe_ratio: Record<string, number>
  portfolio_volatility: number
  correlation_matrix: Record<string, Record<string, number>>
}

export default function RiskMetrics() {
  const [data, setData] = useState<RiskData | null>(null)

  useEffect(() => {
    fetch('http://localhost:5001/api/risk')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading...</div>

  const tickers = Object.keys(data.var_95 || {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>Portfolio Volatility (Ann.)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{data.portfolio_volatility}%</div>
        </div>
      </div>
      <div>
        <h4 style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Risk Metrics by Asset</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Ticker', 'VaR 95%', 'VaR 99%', 'Max DD', 'Sharpe'].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: '0.75rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(t => (
              <tr key={t} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#00D9FF' }}>{t}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#ef4444' }}>{data.var_95[t]}%</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#ef4444' }}>{data.var_99[t]}%</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#ef4444' }}>{data.max_drawdown[t]}%</td>
                <td style={{ padding: '0.6rem 0.75rem', color: (data.sharpe_ratio[t] || 0) > 0 ? '#22c55e' : '#ef4444' }}>{data.sharpe_ratio[t]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
