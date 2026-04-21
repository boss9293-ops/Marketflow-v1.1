'use client'
import { useEffect, useState } from 'react'
import CircularProgress from './CircularProgress'
import { clientApiUrl } from '@/lib/backendApi'

interface GateData   { score: number; status: string; signal: string }
interface RegimeData { trend: string; risk_appetite: string; cycle: string; confidence: string }
interface PredData   { spy: { bullish_probability: number; direction: string } }
interface RiskData   { sharpe_ratio: number; portfolio_volatility: number; max_drawdown: number }

const SIGNAL_CFG = {
  BUY:       { label: 'BUY',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  SELECTIVE: { label: 'SELECTIVE', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  HOLD:      { label: 'HOLD',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
}

function StatPill({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 }}>
      <span style={{ fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: color || 'white', lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: '0.7rem', color: sub.startsWith('+') ? '#22c55e' : sub.startsWith('-') ? '#ef4444' : '#9ca3af' }}>{sub}</span>}
    </div>
  )
}

export default function DashboardBanner() {
  const [gate,   setGate]   = useState<GateData | null>(null)
  const [regime, setRegime] = useState<RegimeData | null>(null)
  const [pred,   setPred]   = useState<PredData | null>(null)
  const [risk,   setRisk]   = useState<RiskData | null>(null)

  useEffect(() => {
    fetch(clientApiUrl('/api/market/gate')).then(r => r.json()).then(setGate).catch(() => {})
    fetch(clientApiUrl('/api/regime')).then(r => r.json()).then(setRegime).catch(() => {})
    fetch(clientApiUrl('/api/prediction')).then(r => r.json()).then(setPred).catch(() => {})
    fetch(clientApiUrl('/api/risk')).then(r => r.json()).then(setRisk).catch(() => {})
  }, [])

  const signal = gate?.signal as keyof typeof SIGNAL_CFG | undefined
  const cfg    = signal ? (SIGNAL_CFG[signal] || SIGNAL_CFG.SELECTIVE) : SIGNAL_CFG.SELECTIVE
  const score  = gate?.score ?? 0

  const riskLevel =
    (risk?.portfolio_volatility ?? 0) < 0.1 ? 'Low' :
    (risk?.portfolio_volatility ?? 0) < 0.2 ? 'Medium' : 'High'
  const riskColor = riskLevel === 'Low' ? '#22c55e' : riskLevel === 'Medium' ? '#f97316' : '#ef4444'

  const regimeColor = regime?.risk_appetite === 'Risk On' ? '#22c55e' : '#ef4444'
  const predPct     = pred?.spy?.bullish_probability ?? 0
  const predColor   = predPct >= 60 ? '#22c55e' : predPct >= 40 ? '#f97316' : '#ef4444'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a1d 0%, #1c1c1e 100%)',
      borderRadius: '14px',
      padding: '1.5rem 2rem',
      border: `1px solid ${cfg.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      flexWrap: 'wrap',
    }}>
      {/* 투자 신호 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '2.8rem', fontWeight: 800, color: cfg.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>Investment Signal</div>
        </div>

        {/* 원형 게이지 */}
        <CircularProgress value={score} size={80} strokeWidth={7} color="auto" sublabel="/100" />
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* 스탯 필 */}
      <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', flex: 1 }}>
        <StatPill
          label="Gate"
          value={String(gate?.score ?? '--')}
          sub={gate ? `+${gate.score * 0.25 > 0 ? (gate.score * 0.25).toFixed(0) : 0}` : undefined}
          color="#00D9FF"
        />
        <StatPill
          label="Regime"
          value={regime?.risk_appetite?.replace(' ', '\u00A0') ?? '--'}
          sub={regime ? `+15.0` : undefined}
          color={regimeColor}
        />
        <StatPill
          label="ML Pred"
          value={pred ? `${predPct}%` : '--'}
          sub={pred ? `+${(predPct * 0.15).toFixed(1)}` : undefined}
          color={predColor}
        />
        <StatPill
          label="Risk"
          value={riskLevel}
          sub={riskLevel === 'Low' ? '+5.0' : riskLevel === 'Medium' ? '0.0' : '-5.0'}
          color={riskColor}
        />
        <StatPill
          label="Sector"
          value={regime?.cycle ?? '--'}
          sub="-5.0"
          color="#9ca3af"
        />
      </div>

      {/* Timing 배지 */}
      <div style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 10, padding: '0.75rem 1.25rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
        <span style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Timing</span>
      </div>
    </div>
  )
}
