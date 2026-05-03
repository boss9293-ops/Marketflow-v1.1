'use client'
import { useState, useEffect } from 'react'
import {

  ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Props { currentScore: number; currentStage: string }

const THRESHOLDS = [
  { value: 60, color: '#22c55e', label: 'Enter 60' },
  { value: 40, color: '#eab308', label: 'Caution 40' },
  { value: 20, color: '#ef4444', label: 'Avoid 20' },
]

interface SoxlPoint { date: string; score: number; zone: 'ENTER' | 'CAUTION' | 'AVOID' }

function toZone(score: number): SoxlPoint['zone'] {
  return score >= 60 ? 'ENTER' : score >= 40 ? 'CAUTION' : 'AVOID'
}

function generateHistory(currentScore: number, days = 60): SoxlPoint[] {
  const points: SoxlPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const t = (days - 1 - i) / (days - 1)
    const base = t < 0.5
      ? 65 + (Math.random() - 0.5) * 8
      : 65 + (currentScore - 65) * ((t - 0.5) / 0.5)
    const score = Math.max(5, Math.min(90, Math.round(base + (Math.random() - 0.5) * 4)))
    points.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, score, zone: toZone(score) })
  }
  points[points.length - 1].score = currentScore
  points[points.length - 1].zone  = toZone(currentScore)
  return points
}

function SoxlTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: SoxlPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const zone  = payload[0].payload.zone
  const c = zone === 'ENTER' ? '#22c55e' : zone === 'CAUTION' ? '#eab308' : '#ef4444'
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6,
                  padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>
      <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>Score: {score} / 100</div>
      <div style={{ color: c, marginTop: 2 }}>{zone}</div>
    </div>
  )
}

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function SoxlScoreChart({ currentScore }: Props) {
  const [data, setData] = useState<SoxlPoint[]>([])
  useEffect(() => { setData(generateHistory(currentScore, 60)) }, [currentScore])
  const currentZone = toZone(currentScore)
  const zoneColor   = currentZone === 'ENTER' ? '#22c55e' : currentZone === 'CAUTION' ? '#eab308' : '#ef4444'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase' }}>
          Panel 3 — SOXL Suitability Score — 60D
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
          현재{' '}
          <span style={{ color: zoneColor, fontWeight: 700, fontSize: 15 }}>{currentScore}</span>
          {' / 100 · '}
          <span style={{ color: zoneColor }}>{currentZone}</span>
        </div>
      </div>

      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 55, left: -10, bottom: 0 }}>
            <Area type="monotone" dataKey="score" fill="rgba(239,68,68,0.04)" stroke="none" fillOpacity={1} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={{ stroke: '#1e2736' }} interval={9} />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={false} width={24} />
            <Tooltip content={<SoxlTooltip />} />
            {THRESHOLDS.map(t => (
              <ReferenceLine key={t.value} y={t.value} stroke={t.color}
                             strokeWidth={0.8} strokeDasharray="4 4"
                             label={{ value: t.label, position: 'right',
                                      fill: t.color, fontSize: 9, fontFamily: 'monospace' }} />
            ))}
            <ReferenceLine y={currentScore} stroke={zoneColor} strokeWidth={0.5} strokeDasharray="2 2" />
            <Line type="monotone" dataKey="score" stroke="#e2e8f0" strokeWidth={1.5} dot={false}
                  activeDot={{ r: 3, fill: zoneColor, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid #1e2736', flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
        {THRESHOLDS.map(t => (
          <span key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 0, borderTop: `1px dashed ${t.color}`, display: 'inline-block' }} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
