'use client'
// B-3: SOXL Tactical View — score breakdown always visible
import type { SoxlOutput } from '@/lib/semiconductor/types'


const CONF_COLOR: Record<string, string> = { HIGH: '#22c55e', MODERATE: '#eab308', LOW: '#f97316' }

const WINDOW_STYLE: Record<string, { color: string; bg: string }> = {
  ALLOWED:       { color: '#22c55e', bg: '#052e16' },
  'TACTICAL ONLY': { color: '#f59e0b', bg: '#1c1407' },
  AVOID:         { color: '#ef4444', bg: '#1c0a0a' },
}

function AdjRow({ label, value, p }: { label: string; value: number; p?: string }) {
  const pos = value > 0
  const color = value === 0 ? '#64748b' : pos ? '#22c55e' : '#ef4444'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: '#94a3b8' }}>
        {label} {p && <span style={{ color: '#6366f1', fontWeight: 700 }}>{p}</span>}
      </span>
      <span style={{ color, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  )
}

interface Props { soxl: SoxlOutput }

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function SoxlTactical({ soxl }: Props) {
  const ws = WINDOW_STYLE[soxl.window] ?? { color: '#94a3b8', bg: '#1e293b' }

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 12 }}>
        SOXL TACTICAL
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: 13, marginBottom: 14 }}>
        <span style={{ color: '#64748b' }}>Window</span>
        <span style={{ color: ws.color, fontWeight: 700, fontSize: 15 }}>{soxl.window}</span>

        <span style={{ color: '#64748b' }}>Suitability</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{soxl.suitability} / 100</span>

        <span style={{ color: '#64748b' }}>Confidence</span>
        <span style={{ color: CONF_COLOR[soxl.confidence] ?? '#94a3b8', fontWeight: 600 }}>{soxl.confidence}</span>

        <span style={{ color: '#64748b' }}>Dominant</span>
        <span style={{ color: '#818cf8' }}>{soxl.dominant_signal}</span>

        {soxl.window !== 'AVOID' && <>
          <span style={{ color: '#64748b' }}>Sizing</span>
          <span style={{ color: '#e2e8f0' }}>{soxl.sizing}</span>

          <span style={{ color: '#64748b' }}>Hold window</span>
          <span style={{ color: '#e2e8f0' }}>{soxl.hold_window}</span>
        </>}
      </div>

      {/* Score breakdown */}
      <div style={{ background: '#0a1122', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, letterSpacing: 1 }}>SCORE BREAKDOWN</div>
        <AdjRow label="Stage base (100) + adj"   value={soxl.breakdown.stage_adj} />
        <AdjRow label="Capex Signal"              value={soxl.breakdown.capex_adj}         p="P1" />
        <AdjRow label="Memory Strength"           value={soxl.breakdown.memory_adj}        p="P2" />
        <AdjRow label="Breadth"                   value={soxl.breakdown.breadth_adj}       p="P3" />
        <AdjRow label="Momentum"                  value={soxl.breakdown.momentum_adj}      p="P4" />
        <AdjRow label="Concentration"             value={soxl.breakdown.concentration_adj} />
        <AdjRow label="Constraint Warning"        value={soxl.breakdown.constraint_adj} />
        <div style={{ borderTop: '1px solid #1e293b', marginTop: 6, paddingTop: 6,
                      display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Final Suitability</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{soxl.final_suitability}</span>
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{soxl.breakdown.overrides}</div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
        Reason: {soxl.reason}
      </div>
    </div>
  )
}
