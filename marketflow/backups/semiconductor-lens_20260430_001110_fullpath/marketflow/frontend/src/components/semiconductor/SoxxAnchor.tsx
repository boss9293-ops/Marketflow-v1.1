'use client'
// B-2: SOXX Anchor View
import type { SoxxOutput, SignalInputs } from '@/lib/semiconductor/types'

const CONF_COLOR: Record<string, string> = { HIGH: '#22c55e', MODERATE: '#eab308', LOW: '#f97316' }

const ACTION_COLOR: Record<string, string> = {
  'ADD / HOLD': '#22c55e',
  'HOLD / ADD ON DIPS': '#38bdf8',
  'HOLD / ADD GRADUALLY': '#38bdf8',
  HOLD: '#94a3b8',
  'HOLD / REDUCE': '#f97316',
  REDUCE: '#ef4444',
}

interface Props { soxx: SoxxOutput; signals: SignalInputs }

export default function SoxxAnchor({ soxx, signals }: Props) {
  const actionColor = ACTION_COLOR[soxx.action] ?? '#94a3b8'
  const soxxQqq = signals.soxx_vs_qqq_60d
  const relStr  = `${soxxQqq > 0 ? '+' : ''}${(soxxQqq * 100).toFixed(1)}%`

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 12 }}>
        SOXX ANCHOR
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: 13 }}>
        <span style={{ color: '#64748b' }}>Action</span>
        <span style={{ color: actionColor, fontWeight: 700, fontSize: 15 }}>{soxx.action}</span>

        <span style={{ color: '#64748b' }}>Confidence</span>
        <span style={{ color: CONF_COLOR[soxx.confidence] ?? '#94a3b8', fontWeight: 600 }}>{soxx.confidence}</span>

        <span style={{ color: '#64748b' }}>Reason</span>
        <span style={{ color: '#e2e8f0' }}>{soxx.reason}</span>

        <span style={{ color: '#64748b' }}>Dominant</span>
        <span style={{ color: '#818cf8' }}>{soxx.dominant_signal}</span>

        <span style={{ color: '#64748b' }}>SOXX vs QQQ</span>
        <span style={{ color: soxxQqq >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {relStr} {soxxQqq >= 0 ? '↑' : '↓'} (60d)
        </span>
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 10,
                    display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          <span style={{ color: '#22c55e' }}>↑ Upgrade if: </span>{soxx.upgrade_if}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          <span style={{ color: '#ef4444' }}>↓ Downgrade if: </span>{soxx.downgrade_if}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>Rule: {soxx.rule_applied}</div>
    </div>
  )
}
