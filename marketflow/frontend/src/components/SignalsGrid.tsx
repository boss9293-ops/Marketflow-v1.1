'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProGate from '@/components/ProGate'
import { isFree } from '@/lib/plan'

interface VCPSignal {
  ticker: string
  name: string
  pattern: string
  grade: string
  stage: string
  stage_color: string
  signal_type: string
  score: number
  market_regime: string
  mcap_tier: string
  current_price: number
  pivot: number
  breakout_price: number
  stop_loss: number
  risk_reward: number
  breakout_close_pct: number
  distance_to_pivot_pct: number
  c1: number
  c2: number
  c3: number
  r12: number
  r23: number
  base_range_pct: number
  rsi: number
  atrp_pct: number
  volume_ratio: number
  above_ema50_ratio: number
  ema_sep_pct: number
  ema50: number
  ema200: number
  retest_depth_pct: number
  retest_vol_ratio: number
  vol_dryup_ratio?: number
  // legacy compat
  volatility_segments?: number[]
  is_contracting?: boolean
}

interface SignalsData {
  timestamp: string
  total_scanned: number
  signals: VCPSignal[]
}

const STAGE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  Retest:   { label: 'RETEST',   bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  Breakout: { label: 'BREAKOUT', bg: 'rgba(34,197,94,0.18)',  color: '#22c55e' },
  Ready:    { label: 'READY',    bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  Near:     { label: 'NEAR',     bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  Building: { label: 'BUILDING', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
}

const GRADE_COLOR: Record<string, string> = {
  A: '#22c55e', B: '#f59e0b', C: '#f97316', D: '#6b7280'
}

const REGIME_COLOR: Record<string, string> = {
  SPY_UP: '#22c55e', SPY_SIDE: '#f59e0b', SPY_DOWN: '#ef4444'
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? '#22c55e' : value >= 65 ? '#f59e0b' : '#3b82f6'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function VCPWave({ c1, c2, c3 }: { c1: number; c2: number; c3: number }) {
  const vals = [c1, c2, c3]
  const max = Math.max(...vals) || 1
  const labels = ['C1', 'C2', 'C3']
  const colors = ['rgba(0,217,255,0.35)', 'rgba(0,217,255,0.6)', '#00D9FF']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: '100%',
            height: Math.max(4, Math.round((v / max) * 28)),
            background: colors[i],
            borderRadius: '2px 2px 0 0',
          }} />
          <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>
        {value}
        {sub && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>{sub}</span>}
      </span>
    </div>
  )
}

function VCPCard({ s }: { s: VCPSignal }) {
  const stage = STAGE_CONFIG[s.stage] || STAGE_CONFIG.Building
  const gradeColor = GRADE_COLOR[s.grade] || '#6b7280'
  const regimeColor = REGIME_COLOR[s.market_regime] || '#f59e0b'
  const rrColor = s.risk_reward >= 3 ? '#22c55e' : s.risk_reward >= 2 ? '#f59e0b' : '#ef4444'

  return (
    <Link href={`/ticker/${encodeURIComponent(s.ticker)}`} style={{ textDecoration: 'none' }}>
    <div style={{
      background: '#1c1c1e',
      border: `1px solid ${stage.color}30`,
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
      cursor: 'pointer',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#00D9FF', fontSize: '1.1rem', letterSpacing: '0.02em' }}>{s.ticker}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: `${gradeColor}20`, color: gradeColor,
              fontSize: '0.65rem', fontWeight: 700,
            }}>Grade {s.grade}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 2, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 9999,
            background: stage.bg, color: stage.color,
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
          }}>{stage.label}</span>
          <span style={{ fontSize: '0.65rem', color: regimeColor }}>{s.market_regime}</span>
        </div>
      </div>

      {/* Score bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>SCORE</span>
          <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>R12: {s.r12}× · R23: {s.r23}×</span>
        </div>
        <ConfidenceBar value={s.score} />
      </div>

      {/* VCP contraction bars */}
      <div>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: 4 }}>
          VOLATILITY CONTRACTION (C1→C2→C3)
        </div>
        <VCPWave c1={s.c1} c2={s.c2} c3={s.c3} />
      </div>

      {/* Key metrics */}
      <div style={{ marginTop: '0.25rem' }}>
        <MetricRow label="Current Price"  value={`$${s.current_price}`} />
        <MetricRow label="Pivot Point"    value={`$${s.pivot}`}
          sub={s.signal_type === 'BREAKOUT' ? `+${s.breakout_close_pct}%` : `-${s.distance_to_pivot_pct}%`} />
        <MetricRow label="Breakout"       value={`$${s.breakout_price}`} />
        <MetricRow label="Stop Loss"      value={`$${s.stop_loss}`} />
        <MetricRow label="R/R Ratio"      value={`${s.risk_reward}x`} />
      </div>

      {/* Bottom stats: 4 mini pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.3rem', marginTop: '0.25rem' }}>
        {[
          { label: 'RSI',      value: s.rsi, color: s.rsi >= 70 ? '#f59e0b' : s.rsi <= 35 ? '#ef4444' : undefined },
          { label: 'Vol ×',    value: `${s.volume_ratio}x`, color: undefined },
          { label: 'ATR%',     value: `${s.atrp_pct}%`, color: undefined },
          { label: 'DryUp',    value: s.vol_dryup_ratio != null ? `${s.vol_dryup_ratio}x` : '—',
            color: (s.vol_dryup_ratio ?? 1) < 0.9 ? '#22c55e' : (s.vol_dryup_ratio ?? 1) > 1.3 ? '#ef4444' : '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '0.3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.55rem', color: '#6b7280', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: color ?? 'white' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Retest info if applicable */}
      {s.signal_type === 'RETEST_OK' && (
        <div style={{
          padding: '0.4rem 0.6rem', borderRadius: 6,
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
          fontSize: '0.68rem', color: '#a855f7',
        }}>
          Retest depth: {s.retest_depth_pct}% · Vol: {s.retest_vol_ratio}×
        </div>
      )}
    </div>
    </Link>
  )
}

type SignalsGridProps = {
  showStatsBar?: boolean
  showLegend?: boolean
}

export default function SignalsGrid({ showStatsBar = true, showLegend = true }: SignalsGridProps) {
  const [data, setData] = useState<SignalsData | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'score' | 'grade' | 'freshness'>('score')

  useEffect(() => {
    try {
      const f = window.localStorage.getItem('vcp_selectedFilter')
      const s = window.localStorage.getItem('vcp_selectedSort')
      if (f) setFilter(f)
      if (s === 'score' || s === 'grade' || s === 'freshness') setSortBy(s)
    } catch {}
    fetch('http://localhost:5001/api/signals')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('vcp_selectedFilter', filter)
      window.localStorage.setItem('vcp_selectedSort', sortBy)
    } catch {}
  }, [filter, sortBy])

  const filtered = (data?.signals || []).filter(s => filter === 'All' || s.stage === filter)
  const signals = [...filtered].sort((a, b) => {
    if (sortBy === 'grade') {
      const gradeRank = (g: string) => ({ A: 4, B: 3, C: 2, D: 1 }[g] ?? 0)
      const gDiff = gradeRank(b.grade) - gradeRank(a.grade)
      return gDiff || b.score - a.score
    }
    if (sortBy === 'freshness') {
      const freshness = (s: VCPSignal) => {
        if (s.stage === 'Breakout' || s.stage === 'Retest') return 4
        if (s.stage === 'Ready') return 3
        if (s.stage === 'Near') return 2
        return 1
      }
      const fDiff = freshness(b) - freshness(a)
      return fDiff || b.score - a.score
    }
    return b.score - a.score
  })

  const tabs = ['All', 'Retest', 'Breakout', 'Ready', 'Near', 'Building']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Stats bar */}
      {showStatsBar && data && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Scanned <span style={{ color: 'white', fontWeight: 600 }}>{data.total_scanned}</span> stocks
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Found <span style={{ color: '#00D9FF', fontWeight: 600 }}>{data.signals.length}</span> VCP patterns
          </div>
          {data.timestamp && (
            <div style={{ fontSize: '0.7rem', color: '#4b5563' }}>
              Updated: {new Date(data.timestamp).toLocaleString()}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'grade' | 'freshness')}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#dbe3f0',
                borderRadius: 8,
                padding: '0.25rem 0.45rem',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <option value="score">Score desc</option>
              <option value="grade">Grade</option>
              <option value="freshness">Freshness</option>
            </select>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const count = tab === 'All' ? data?.signals.length : data?.signals.filter(s => s.stage === tab).length
          const active = filter === tab
          const cfg = tab !== 'All' ? STAGE_CONFIG[tab] : null
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 9999,
                border: `1px solid ${active ? (cfg?.color || '#00D9FF') : 'rgba(255,255,255,0.1)'}`,
                background: active ? (cfg ? cfg.bg : 'rgba(0,217,255,0.1)') : 'transparent',
                color: active ? (cfg?.color || '#00D9FF') : '#6b7280',
                fontSize: '0.72rem',
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {tab} {count !== undefined ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      {signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          {data ? 'No VCP patterns found for selected filter.' : 'Loading VCP signals...'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {signals.slice(0, 3).map(s => <VCPCard key={s.ticker + "_pre"} s={s} />)}
          </div>
          {signals.length > 3 && (
            <ProGate description={signals.length - 3 + " more signals"}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                {signals.slice(3).map(s => <VCPCard key={s.ticker} s={s} />)}
              </div>
            </ProGate>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && <div style={{
        marginTop: '0.5rem',
        padding: '0.75rem 1rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        display: 'flex',
        gap: '1.25rem',
        flexWrap: 'wrap',
        fontSize: '0.68rem',
        color: '#4b5563',
      }}>
        <span><span style={{ color: '#a855f7', fontWeight: 700 }}>RETEST</span> — Pullback to pivot confirmed.</span>
        <span><span style={{ color: '#22c55e', fontWeight: 700 }}>BREAKOUT</span> — Broke above pivot.</span>
        <span><span style={{ color: '#22c55e', fontWeight: 700 }}>READY</span> — Within 1.5% of pivot.</span>
        <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>NEAR</span> — 1.5–3% from pivot.</span>
        <span><span style={{ color: '#3b82f6', fontWeight: 700 }}>BUILDING</span> — Base forming.</span>
        <span>DryUp: <span style={{ color: '#22c55e' }}>&lt;0.9×</span> dry · <span style={{ color: '#f59e0b' }}>0.9–1.3×</span> flat · <span style={{ color: '#ef4444' }}>&gt;1.3×</span> rising vol</span>
        <span style={{ marginLeft: 'auto' }}>Grade: <span style={{ color: '#22c55e' }}>A</span> Strict · <span style={{ color: '#f59e0b' }}>B</span> Relaxed · <span style={{ color: '#f97316' }}>C</span> Basic · <span style={{ color: '#6b7280' }}>D</span> Accum</span>
      </div>}
    </div>
  )
}
