'use client'
// A-4: Core Driver Panel — 4 drivers + 3 confirmations
import type { SignalInputs } from '@/lib/semiconductor/types'


const STATE_COLORS: Record<string, string> = {
  STRONG: '#22c55e', RECOVERING: '#38bdf8', NEUTRAL: '#94a3b8',
  WEAK: '#ef4444', RISING: '#22c55e', DECLINING: '#ef4444',
  BROAD: '#22c55e', 'VERY BROAD': '#22c55e', MODERATE: '#eab308', NARROW: '#ef4444',
  LEADING: '#22c55e', 'IN-LINE': '#94a3b8', LAGGING: '#f97316', DIVERGING: '#ef4444',
  ACCELERATING: '#22c55e', DECELERATING: '#ef4444',
  LOW: '#22c55e', ELEVATED: '#f97316', HIGH: '#ef4444',
}

function Row({ label, state, evidence, pBadge, warn }:
  { label: string; state: string; evidence: string; pBadge?: string; warn?: boolean }) {
  const color = STATE_COLORS[state] ?? '#94a3b8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
      <div style={{ width: 110, fontSize: 12, color: '#64748b' }}>{label}</div>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}18`,
                     padding: '2px 8px', borderRadius: 4, minWidth: 90, textAlign: 'center' }}>
        {state}
      </span>
      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{evidence}</span>
      {pBadge && <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>{pBadge}</span>}
      {warn && <span style={{ fontSize: 11, color: '#ef4444' }}>⚠</span>}
    </div>
  )
}

interface Props { signals: SignalInputs }

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function CoreDriverPanel({ signals }: Props) {
  const {
    demand, supply, price, breadth_state,
    memory_strength, equipment_state, constraint_warning,
    soxx_vs_qqq_60d, nvda_mu_gap, equipment_vs_soxx_60d,
  } = signals

  const soxxQqqPct = `${soxx_vs_qqq_60d > 0 ? '+' : ''}${(soxx_vs_qqq_60d * 100).toFixed(1)}% vs QQQ (60d)`
  const muSlope    = price === 'RISING' ? 'MU slope positive' : price === 'DECLINING' ? 'MU slope negative' : 'MU slope flat'
  const equipEvid  = `Basket ${(equipment_vs_soxx_60d * 100).toFixed(0)}% vs SOXX`
  const constEvid  = `${(nvda_mu_gap * 100).toFixed(0)}% NVDA–MU gap`

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 12 }}>
        CORE DRIVERS
      </div>

      <div style={{ borderBottom: '1px solid #1e293b', marginBottom: 10, paddingBottom: 10 }}>
        <Row label="DEMAND"  state={demand}        evidence="NVDA+AVGO 60d vs QQQ" />
        <Row label="SUPPLY"  state={supply}        evidence={soxxQqqPct} />
        <Row label="PRICE"   state={price}         evidence={muSlope} />
        <Row label="BREADTH" state={breadth_state} evidence="Equal-weight vs cap-weight SOXX (30d)" />
      </div>

      <div>
        <Row label="Memory (P2)"    state={memory_strength}  evidence="MU slope + Samsung confirmation" pBadge="P2" />
        <Row label="Equipment (P1)" state={equipment_state}  evidence={equipEvid} pBadge="P1"
             warn={equipment_state === 'LAGGING' || equipment_state === 'DIVERGING'} />
        <Row label="Constraint"     state={constraint_warning} evidence={constEvid} />
      </div>
    </div>
  )
}
