'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clientApiUrl } from '@/lib/backendApi'

interface RegimeData {
  trend: string; risk_appetite: string; cycle: string; confidence: string
}
interface PredData {
  spy: { bullish_probability: number; direction: string; confidence: string }
}
interface SectorData {
  sectors: { name: string; symbol: string; strength: string }[]
}
interface RiskData {
  sharpe_ratio: number; portfolio_volatility: number; max_drawdown: number; var_95: Record<string, number>
}

export default function SummaryCards() {
  const [regime, setRegime] = useState<RegimeData | null>(null)
  const [pred,   setPred]   = useState<PredData   | null>(null)
  const [sector, setSector] = useState<SectorData | null>(null)
  const [risk,   setRisk]   = useState<RiskData   | null>(null)

  useEffect(() => {
    fetch(clientApiUrl('/api/regime')).then(r => r.json()).then(setRegime).catch(() => {})
    fetch(clientApiUrl('/api/prediction')).then(r => r.json()).then(setPred).catch(() => {})
    fetch(clientApiUrl('/api/sectors')).then(r => r.json()).then(setSector).catch(() => {})
    fetch(clientApiUrl('/api/risk')).then(r => r.json()).then(setRisk).catch(() => {})
  }, [])

  const riskLevel =
    (risk?.portfolio_volatility ?? 0) < 0.10 ? 'Low' :
    (risk?.portfolio_volatility ?? 0) < 0.20 ? 'Medium' : 'High'
  const riskColor  = riskLevel === 'Low' ? '#22c55e' : riskLevel === 'Medium' ? '#f97316' : '#ef4444'
  const regimeColor = regime?.risk_appetite === 'Risk On' ? '#22c55e' : '#ef4444'
  const predPct    = pred?.spy?.bullish_probability ?? 0
  const predColor  = predPct >= 60 ? '#22c55e' : predPct >= 40 ? '#f97316' : '#ef4444'
  const leadingSectors = sector?.sectors
    ?.filter(s => s.strength === 'Strong')
    .map(s => s.symbol).slice(0, 3).join(', ') || '—'
  const varSpy = risk?.var_95?.SPY ?? 0

  const cards = [
    {
      href: '/regime',
      label: 'MARKET REGIME',
      value: regime?.risk_appetite ?? '—',
      sub: `Confidence: ${regime?.confidence ?? '—'}`,
      color: regimeColor,
    },
    {
      href: '/prediction',
      label: 'SPY PREDICTION',
      value: pred ? `${predPct}% Bullish` : '—',
      sub: pred?.spy?.confidence ? `Confidence: ${pred.spy.confidence}` : '—',
      color: predColor,
    },
    {
      href: '/sectors',
      label: 'BUSINESS CYCLE',
      value: regime?.cycle ?? '—',
      sub: `Leading: ${leadingSectors}`,
      color: '#00D9FF',
    },
    {
      href: '/risk',
      label: 'PORTFOLIO RISK',
      value: riskLevel,
      sub: `VaR: $${Math.abs(varSpy * 10000).toLocaleString()}`,
      color: riskColor,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
      {cards.map(c => (
        <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#1c1c1e',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            border: '1px solid rgba(255,255,255,0.05)',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            height: '100%',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${c.color}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.08em', fontWeight: 500 }}>{c.label}</span>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>→</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color, lineHeight: 1.1, marginBottom: '0.375rem' }}>
              {c.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{c.sub}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
