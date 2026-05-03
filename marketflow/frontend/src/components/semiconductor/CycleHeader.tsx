'use client'
// A-1: Sticky Cycle Position Header
import type { StageOutput } from '@/lib/semiconductor/types'


const CONF_COLOR: Record<string, string> = {
  HIGH: '#22c55e', MODERATE: '#eab308', LOW: '#f97316',
}

const STAGE_COLOR: Record<string, string> = {
  EXPAND: '#22c55e', BUILD: '#38bdf8', PEAK: '#eab308', RESET: '#ef4444', BOTTOM: '#a78bfa',
}

interface Props {
  stage: StageOutput
  breadth:  string
  momentum: string
  summary:  string
}

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function CycleHeader({ stage, breadth, momentum, summary }: Props) {
  const stageColor = STAGE_COLOR[stage.stage] ?? '#94a3b8'
  const confColor  = CONF_COLOR[stage.confidence] ?? '#94a3b8'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>

        {/* Left: stage + confidence */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 8 }}>
            SEMICONDUCTOR CYCLE MONITOR
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 11, color: '#64748b' }}>Stage</span>
              <div style={{ fontSize: 22, fontWeight: 700, color: stageColor, marginTop: 2 }}>
                {stage.stage}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#64748b' }}>Confidence</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: confColor, marginTop: 2 }}>
                {stage.confidence}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#64748b' }}>Breadth</span>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0', marginTop: 2 }}>
                {breadth}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#64748b' }}>Momentum</span>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0', marginTop: 2 }}>
                {momentum}
              </div>
            </div>
          </div>
        </div>

        {/* Right: conflict + updated */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            Conflict Mode: <span style={{ color: stage.conflict_mode ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
              {stage.conflict_mode ? 'ON' : 'OFF'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Updated: {stage.as_of}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: 12, fontSize: 13, color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: 10 }}>
        {summary}
      </div>

      {/* Conflict note */}
      {stage.conflict_mode && stage.conflict_note && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#f97316', fontStyle: 'italic' }}>
          ⚠ {stage.conflict_note}
        </div>
      )}
    </div>
  )
}
