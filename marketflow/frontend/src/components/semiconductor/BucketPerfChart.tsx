'use client'
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { SignalInputs } from '@/lib/semiconductor/types'


interface Props { signals: SignalInputs }

function bucketRows(s: SignalInputs) {
  return [
    { name: 'Compute',   value: s.sub_bucket_perf.compute },
    { name: 'Memory',    value: s.sub_bucket_perf.memory },
    { name: 'Foundry',   value: s.sub_bucket_perf.foundry },
    { name: 'Equipment', value: s.sub_bucket_perf.equipment },
  ]
}

function scoreRows(s: SignalInputs) {
  return [
    { name: 'Breadth',    value: s.breadth_score },
    { name: 'Memory',     value: s.memory_score },
    { name: 'Capex',      value: s.capex_score },
    { name: 'Momentum',   value: s.momentum_score },
    { name: 'Constraint', value: 100 - s.constraint_score },
  ]
}

function BucketTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div style={{ background: '#0a1122', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
      <div style={{ color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ color: v > 0 ? '#22c55e' : v === 0 ? '#64748b' : '#ef4444', fontWeight: 700 }}>
        {v > 0 ? '+' : ''}{v}pp vs SOXX (30d)
      </div>
    </div>
  )
}

function ScoreTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  const c = v >= 60 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'
  return (
    <div style={{ background: '#0a1122', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
      <div style={{ color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ color: c, fontWeight: 700 }}>{v} / 100</div>
    </div>
  )
}

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function BucketPerfChart({ signals }: Props) {
  const bd  = bucketRows(signals)
  const sd  = scoreRows(signals)
  const d60 = signals.soxx_vs_qqq_60d
  const decLabel = d60 >= 0.05 ? 'LEADING' : d60 <= -0.05 ? 'LAGGING' : 'NEUTRAL'
  const decColor = d60 >= 0.05 ? '#22c55e' : d60 <= -0.05 ? '#ef4444' : '#64748b'
  const decPct   = `${d60 > 0 ? '+' : ''}${(d60 * 100).toFixed(1)}%`

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2 }}>SECTOR RADAR</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: decColor }}>
          SOXX vs QQQ 60d: {decPct} &nbsp;
          <span style={{ fontSize: 11, background: `${decColor}22`, padding: '2px 6px', borderRadius: 4 }}>
            {decLabel}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Left: Bucket vs SOXX ── */}
        <div>
          <div style={{ fontSize: 11, color: '#475569', letterSpacing: 1, marginBottom: 6 }}>
            BUCKET vs SOXX (30d, pp)
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={bd} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }}
                     axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false}
                     tickFormatter={v => `${v > 0 ? '+' : ''}${v}`} />
              <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />
              <Tooltip content={<BucketTip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={30}>
                {bd.map((d, i) => (
                  <Cell key={i}
                    fill={d.value > 0 ? '#22c55e' : d.value === 0 ? '#475569' : '#ef4444'}
                    fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
            Equal-weight bucket 30d return minus SOXX 30d return
          </div>
        </div>

        {/* ── Right: Signal scores ── */}
        <div>
          <div style={{ fontSize: 11, color: '#475569', letterSpacing: 1, marginBottom: 6 }}>
            SIGNAL HEALTH (0–100)
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={sd} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" domain={[0, 100]}
                     tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={62}
                     tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <ReferenceLine x={50} stroke="#334155" strokeDasharray="4 3" />
              <Tooltip content={<ScoreTip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {sd.map((d, i) => (
                  <Cell key={i}
                    fill={d.value >= 60 ? '#22c55e' : d.value >= 40 ? '#eab308' : '#ef4444'}
                    fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
            Constraint score inverted (100 = no risk)
          </div>
        </div>
      </div>
    </div>
  )
}
