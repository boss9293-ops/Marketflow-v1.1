'use client'
import {
  ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Props {
  currentScore: number
  currentStage: string
}

function generateSoxlHistory(currentScore: number, days: number = 60) {
  const points: { date: string; score: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const t = (days - 1 - i) / (days - 1)
    const pivot = days * 0.4
    const base = i > pivot
      ? 65 - (i - pivot) * 0.3
      : 65 - ((pivot - i) / pivot) * (65 - currentScore)
    const score = Math.max(10, Math.min(90, Math.round(base + (Math.random() - 0.5) * 5)))
    void t
    points.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, score })
  }
  points[points.length - 1].score = currentScore
  return points
}

const THRESHOLDS = [
  { value: 60, color: '#22c55e', label: 'ENTER 60' },
  { value: 40, color: '#eab308', label: 'CAUTION 40' },
  { value: 20, color: '#ef4444', label: 'AVOID 20' },
]

export default function SoxlScoreChart({ currentScore }: Props) {
  const data = generateSoxlHistory(currentScore, 60)

  const window =
    currentScore >= 60 ? { label: 'ENTER',   color: '#22c55e' } :
    currentScore >= 40 ? { label: 'CAUTION', color: '#eab308' } :
                         { label: 'AVOID',   color: '#ef4444' }

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2 }}>
          SOXL SUITABILITY SCORE — 60D
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: window.color }}>
          현재 {currentScore} / 100 · {window.label}
        </div>
      </div>

      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 52, left: -10, bottom: 0 }}>
            <Area type="monotone" dataKey="score" fill="rgba(239,68,68,0.04)" stroke="none" />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="date"
                   tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={{ stroke: '#1e2736' }}
                   interval={9} />
            <YAxis domain={[0, 100]}
                   tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={false} width={24} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b',
                              borderRadius: 6, fontSize: 11, color: '#e2e8f0' }}
              formatter={(val: number) => [`${val} / 100`, 'Suitability']}
            />
            {THRESHOLDS.map(t => (
              <ReferenceLine key={t.value} y={t.value}
                             stroke={t.color} strokeWidth={0.8} strokeDasharray="4 4"
                             label={{ value: t.label, position: 'right',
                                      fill: t.color, fontSize: 9, fontFamily: 'monospace' }} />
            ))}
            <Line type="monotone" dataKey="score" name="Suitability"
                  stroke="#e2e8f0" strokeWidth={1.5} dot={false}
                  activeDot={{ r: 3, fill: '#ef4444' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid #1e2736', flexWrap: 'wrap' }}>
        {THRESHOLDS.map(t => (
          <span key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 5,
                                       fontSize: 11, color: '#64748b' }}>
            <span style={{ width: 14, height: 0, borderTop: `1px dashed ${t.color}`,
                           display: 'inline-block' }} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
