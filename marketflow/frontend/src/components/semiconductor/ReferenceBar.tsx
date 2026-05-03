'use client'
// B-0: Persistent Screen A reference bar — always visible on Screen B
import Link from 'next/link'
import type { StageOutput, SignalInputs } from '@/lib/semiconductor/types'


const CONF_COLOR: Record<string, string> = { HIGH: '#22c55e', MODERATE: '#eab308', LOW: '#f97316' }
const STAGE_COLOR: Record<string, string> = {
  EXPAND: '#22c55e', BUILD: '#38bdf8', PEAK: '#eab308', RESET: '#ef4444', BOTTOM: '#a78bfa',
}

interface Props { stage: StageOutput; signals: SignalInputs }

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function ReferenceBar({ stage, signals }: Props) {
  const equipWarn = signals.equipment_state === 'LAGGING' || signals.equipment_state === 'DIVERGING'
  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderBottom: '2px solid #1e3a5f',
                  borderRadius: 8, padding: '10px 18px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#64748b', letterSpacing: 1 }}>From Semiconductor Monitor:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: STAGE_COLOR[stage.stage] ?? '#e2e8f0' }}>
          Stage: {stage.stage}
        </span>
        <span style={{ fontSize: 12, color: CONF_COLOR[stage.confidence] ?? '#94a3b8' }}>
          Confidence: {stage.confidence}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          Breadth: {signals.breadth_state}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          Memory (P2): {signals.memory_strength}
        </span>
        <span style={{ fontSize: 12, color: equipWarn ? '#f97316' : '#94a3b8' }}>
          Equipment (P1): {signals.equipment_state}{equipWarn ? ' ⚠' : ''}
        </span>
        <span style={{ fontSize: 12, color: stage.conflict_mode ? '#ef4444' : '#64748b' }}>
          Conflict: {stage.conflict_mode ? 'ON' : 'OFF'}
        </span>
      </div>
      <Link href="/semiconductor" style={{ fontSize: 11, color: '#38bdf8', textDecoration: 'none' }}>
        ↗ Full analysis
      </Link>
    </div>
  )
}
