'use client'
import { useState } from 'react'
import {
  ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface BucketPoint {
  day: number
  label: string
  compute: number
  memory: number
  foundry: number
  equipment: number
  soxx: number
}

interface Props {
  currentPerf: { compute: number; memory: number; foundry: number; equipment: number }
  stage: string
}

function generateRebasedHistory(perf: Props['currentPerf'], days: number): BucketPoint[] {
  const points: BucketPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const t = (days - 1 - i) / (days - 1)
    const n = () => (Math.random() - 0.5) * 0.8
    points.push({
      day: -i,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      compute:   parseFloat((100 + perf.compute   * t + n()).toFixed(2)),
      memory:    parseFloat((100 + perf.memory    * t + n()).toFixed(2)),
      foundry:   parseFloat((100 + perf.foundry   * t + n()).toFixed(2)),
      equipment: parseFloat((100 + perf.equipment * t + n()).toFixed(2)),
      soxx: 100,
    })
  }
  return points
}

function calcZScore(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const std  = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
  if (std === 0) return 0
  return (values[values.length - 1] - mean) / std
}

const BUCKET_COLORS = {
  compute:   '#a78bfa',
  memory:    '#38bdf8',
  foundry:   '#22c55e',
  equipment: '#f97316',
} as const

const STAGE_BG: Record<string, string> = {
  PEAK:        'rgba(234,179,8,0.06)',
  EXPAND:      'rgba(34,197,94,0.06)',
  EXPANSION:   'rgba(34,197,94,0.06)',
  TRANSITION:  'rgba(249,115,22,0.06)',
  CONTRACTION: 'rgba(239,68,68,0.07)',
  BUILD:       'rgba(56,189,248,0.06)',
  BOTTOM:      'rgba(167,139,250,0.06)',
  RESET:       'rgba(239,68,68,0.07)',
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; color: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 11, color: '#e2e8f0' }}>
      <div style={{ color: '#64748b', padding: '6px 10px 0' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ padding: '2px 10px', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: p.value >= 100 ? '#22c55e' : '#ef4444' }}>
            {p.value >= 100 ? '+' : ''}{(p.value - 100).toFixed(1)}%
          </span>
        </div>
      ))}
      <div style={{ padding: '4px 10px 6px', borderTop: '1px solid #1e293b', marginTop: 4, color: '#475569', fontSize: 10 }}>
        base = 100 (period start)
      </div>
    </div>
  )
}

export default function BucketRSChart({ currentPerf, stage }: Props) {
  const [range, setRange] = useState<'30d' | '60d' | '90d'>('30d')
  const days = { '30d': 30, '60d': 60, '90d': 90 }[range]
  const data = generateRebasedHistory(currentPerf, days)

  const zScores = {
    compute:   calcZScore(data.map(d => d.compute)),
    memory:    calcZScore(data.map(d => d.memory)),
    foundry:   calcZScore(data.map(d => d.foundry)),
    equipment: calcZScore(data.map(d => d.equipment)),
  }

  const stageBg = STAGE_BG[stage] ?? 'transparent'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 2 }}>
            BUCKET RELATIVE STRENGTH — Rebased 100
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>period start = 100 · each bucket independent</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['30d', '60d', '90d'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              border: '1px solid', fontFamily: 'monospace', fontWeight: 600,
              borderColor: range === r ? '#475569' : '#1e293b',
              background:  range === r ? '#1e293b'  : 'transparent',
              color:        range === r ? '#e2e8f0'  : '#475569',
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Z-Score badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(Object.entries(BUCKET_COLORS) as [keyof typeof BUCKET_COLORS, string][]).map(([key, color]) => {
          const z = zScores[key]
          const label = z > 1.5 ? 'STRONG' : z > 0.5 ? 'ABOVE' : z > -0.5 ? 'NEUTRAL' : z > -1.5 ? 'BELOW' : 'WEAK'
          const lc    = z > 0.5 ? '#22c55e' : z < -0.5 ? '#ef4444' : '#94a3b8'
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                    background: '#0a1122', borderRadius: 5, padding: '4px 10px',
                                    border: '1px solid #1e293b' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{key}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: lc }}>{label}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>z={z.toFixed(1)}</span>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <ReferenceArea x1={data[0]?.label} x2={data[data.length - 1]?.label} fill={stageBg} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={{ stroke: '#1e2736' }}
                   interval={Math.floor(data.length / 6)} />
            <YAxis tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={false}
                   tickFormatter={v => `${v >= 100 ? '+' : ''}${(v - 100).toFixed(0)}%`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={100} stroke="#334155" strokeWidth={1} />
            <Line type="monotone" dataKey="compute"   name="Compute"      stroke="#a78bfa" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="memory"    name="Memory P2"    stroke="#38bdf8" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="foundry"   name="Foundry"      stroke="#22c55e" strokeWidth={1.2} dot={false} />
            <Line type="monotone" dataKey="equipment" name="Equipment P1" stroke="#f97316" strokeWidth={2}
                  strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10,
                    paddingTop: 10, borderTop: '1px solid #1e2736', fontSize: 11, color: '#64748b' }}>
        {[
          { color: '#a78bfa', label: 'Compute (NVDA·AMD·AVGO)', dash: false },
          { color: '#38bdf8', label: 'Memory P2 (MU)',           dash: false },
          { color: '#22c55e', label: 'Foundry (TSM)',            dash: false },
          { color: '#f97316', label: 'Equipment P1 (ASML·AMAT·LRCX)', dash: true },
        ].map(({ color, label, dash }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 16, height: 0, borderTop: `1.5px ${dash ? 'dashed' : 'solid'} ${color}`, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
