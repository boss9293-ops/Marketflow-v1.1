'use client'
// A-3: Leaders / Breadth Panel — sub-bucket performance vs SOXX
import type { SignalInputs } from '@/lib/semiconductor/types'

function Bar({ pct }: { pct: number }) {
  const w   = Math.min(100, Math.abs(pct) * 2)
  const pos = pct >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ width: 80, background: '#1e293b', borderRadius: 3, height: 8, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: pos ? '50%' : `${50 - w / 2}%`,
          width: `${w / 2}%`,
          height: '100%',
          background: pos ? '#22c55e' : '#ef4444',
          borderRadius: 3,
        }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#334155' }} />
      </div>
      <span style={{ fontSize: 12, color: pos ? '#22c55e' : '#ef4444', minWidth: 40 }}>
        {pct > 0 ? '+' : ''}{pct}%
      </span>
    </div>
  )
}

function Badge({ label, warning }: { label: string; warning?: boolean }) {
  const color = warning ? '#ef4444'
    : label === 'LEADING' ? '#22c55e'
    : label === 'IN-LINE' ? '#94a3b8'
    : label === 'LAGGING' ? '#f97316'
    : '#94a3b8'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`,
                   padding: '2px 7px', borderRadius: 4 }}>{label}</span>
  )
}

function stateLabel(pct: number): string {
  if (pct > 5) return 'LEADING'
  if (pct < -3) return 'LAGGING'
  return 'IN-LINE'
}

interface Props { signals: SignalInputs }

export default function LeadersBreadthPanel({ signals }: Props) {
  const { sub_bucket_perf, equipment_state, constraint_warning,
          nvda_mu_gap, nvda_tsm_gap, breadth_score, concentration_score } = signals

  const equipWarn = equipment_state === 'LAGGING' || equipment_state === 'DIVERGING'
  const constWarn = constraint_warning === 'ELEVATED' || constraint_warning === 'HIGH'

  const rows = [
    { label: 'Compute',   tickers: 'NVDA · AMD · AVGO', pct: sub_bucket_perf.compute,   p: '' },
    { label: 'Memory',    tickers: 'MU',                 pct: sub_bucket_perf.memory,    p: 'P2' },
    { label: 'Foundry',   tickers: 'TSM',                pct: sub_bucket_perf.foundry,   p: '' },
    { label: 'Equipment', tickers: 'ASML · AMAT · LRCX · KLAC', pct: sub_bucket_perf.equipment, p: 'P1', warn: equipWarn },
  ]

  const breadthLabel = breadth_score >= 76 ? 'VERY BROAD' : breadth_score >= 51 ? 'BROAD'
    : breadth_score >= 26 ? 'MODERATE' : 'NARROW'
  const concLabel = concentration_score >= 81 ? 'HIGH' : concentration_score >= 66 ? 'ELEVATED'
    : concentration_score >= 46 ? 'MODERATE' : 'DISTRIBUTED'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 12 }}>
        LEADERS · BREADTH · SUB-BUCKET (30d vs SOXX)
      </div>

      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                     marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ width: 90, fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{r.label}</div>
          <div style={{ width: 180, fontSize: 11, color: '#64748b' }}>{r.tickers}</div>
          <Badge label={stateLabel(r.pct)} warning={r.warn} />
          <Bar pct={r.pct} />
          {r.p && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>{r.p}</span>}
          {r.warn && <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ P1</span>}
        </div>
      ))}

      {/* Constraint row */}
      {constWarn && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#1e1010',
                      borderRadius: 6, border: '1px solid #7f1d1d' }}>
          <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>
            Constraint: {constraint_warning}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 12 }}>
            NVDA–MU: {(nvda_mu_gap * 100).toFixed(0)}%
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 12 }}>
            NVDA–TSM: {(nvda_tsm_gap * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Scores */}
      <div style={{ marginTop: 10, display: 'flex', gap: 24, borderTop: '1px solid #1e293b', paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Breadth Score: <strong style={{ color: '#e2e8f0' }}>{breadth_score}</strong>
          <span style={{ marginLeft: 6, color: '#64748b' }}>[{breadthLabel}]</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Concentration: <strong style={{ color: '#e2e8f0' }}>{concentration_score}</strong>
          <span style={{ marginLeft: 6, color: '#64748b' }}>[{concLabel}]</span>
        </div>
      </div>
    </div>
  )
}
