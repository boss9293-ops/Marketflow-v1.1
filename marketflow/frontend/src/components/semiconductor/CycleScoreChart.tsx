'use client'
import { useState } from 'react'
import {
  ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ConflictType } from '@/lib/semiconductor/types'

interface Props {
  currentScore: number
  currentStage: string
  conflictMode: boolean
  conflictType: ConflictType
}

const STAGE_BG: Record<string, string> = {
  BOTTOM: '#a78bfa28', BUILD: '#38bdf828', EXPAND: '#22c55e28',
  PEAK:   '#eab30828', RESET: '#ef444428',
}
const STAGE_COLOR: Record<string, string> = {
  BOTTOM: '#a78bfa', BUILD: '#38bdf8', EXPAND: '#22c55e',
  PEAK:   '#eab308', RESET: '#ef4444',
}
const THRESHOLDS = [
  { value: 88, color: '#eab308', label: 'L0 Peak' },
  { value: 63, color: '#22c55e', label: 'L1 Expand' },
  { value: 43, color: '#38bdf8', label: 'L2 Build' },
  { value: 28, color: '#a78bfa', label: 'L3 Bottom' },
]

interface ScorePoint { date: string; score: number; stage: string }

function generateHistory(currentScore: number, currentStage: string, days: number): ScorePoint[] {
  const points: ScorePoint[] = []
  const now = new Date()
  const startScore = 40
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const t = (days - 1 - i) / (days - 1)
    let base: number
    if      (t < 0.35) base = startScore + (43 - startScore) * (t / 0.35)
    else if (t < 0.70) base = 43 + (currentScore - 43) * ((t - 0.35) / 0.35)
    else               base = currentScore + (Math.random() - 0.5) * 4
    const score = Math.max(10, Math.min(100, Math.round(base + (Math.random() - 0.5) * 2)))
    let stage: string
    if      (score >= 80) stage = 'PEAK'
    else if (score >= 55) stage = 'EXPAND'
    else if (score >= 35) stage = 'BUILD'
    else if (score >= 20) stage = 'BOTTOM'
    else                  stage = 'RESET'
    points.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, score, stage })
  }
  points[points.length - 1].score = currentScore
  points[points.length - 1].stage = currentStage
  return points
}

function extractStageRanges(data: ScorePoint[]) {
  if (!data.length) return []
  const ranges: { x1: string; x2: string; stage: string }[] = []
  let start = data[0]
  for (let i = 1; i < data.length; i++) {
    if (data[i].stage !== start.stage) {
      ranges.push({ x1: start.date, x2: data[i].date, stage: start.stage })
      start = data[i]
    }
  }
  ranges.push({ x1: start.date, x2: data[data.length - 1].date, stage: start.stage })
  return ranges
}

function CycleTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: ScorePoint }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const stage = payload[0].payload.stage
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6,
                  padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>
      <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>Score: {score}</div>
      <div style={{ color: STAGE_COLOR[stage] ?? '#94a3b8', marginTop: 2 }}>{stage}</div>
    </div>
  )
}

export default function CycleScoreChart({ currentScore, currentStage, conflictMode, conflictType }: Props) {
  const [range, setRange] = useState<'3m' | '6m' | '1y'>('6m')
  const days = { '3m': 90, '6m': 180, '1y': 365 }[range]
  const data        = generateHistory(currentScore, currentStage, days)
  const stageRanges = extractStageRanges(data)
  const currentColor = STAGE_COLOR[currentStage] ?? '#94a3b8'

  const conflictBadge =
    conflictType === 'AI_DISTORTION' ? '⚠ AI Distortion' :
    conflictType === 'P1_OVERRIDE'   ? '⚠ P1 Override'   : null
  const badgeColor = conflictType === 'AI_DISTORTION' ? '#6366f1' : '#f97316'
  const badgeBg    = conflictType === 'AI_DISTORTION' ? 'rgba(99,102,241,0.1)' : 'rgba(249,115,22,0.1)'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, marginBottom: 4 }}>
            PANEL 1 — CYCLE SCORE
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            현재{' '}
            <span style={{ color: currentColor, fontWeight: 700, fontSize: 16 }}>{currentScore}</span>
            {' '}/ 100 · Stage: <span style={{ color: currentColor }}>{currentStage}</span>
            {conflictBadge && (
              <span style={{ marginLeft: 10, fontSize: 11, color: badgeColor,
                             background: badgeBg, padding: '1px 7px', borderRadius: 4 }}>
                {conflictBadge}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['3m', '6m', '1y'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 10px', borderRadius: 4, border: '1px solid', fontSize: 11,
              fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer',
              borderColor: range === r ? '#475569' : '#1e293b',
              background:  range === r ? '#1e293b'  : 'transparent',
              color:       range === r ? '#e2e8f0'  : '#475569',
            }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 55, left: -10, bottom: 0 }}>
            {stageRanges.map(r => (
              <ReferenceArea key={`${r.x1}-${r.stage}`} x1={r.x1} x2={r.x2}
                             fill={STAGE_BG[r.stage] ?? '#ffffff08'} />
            ))}
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={{ stroke: '#1e2736' }}
                   interval={Math.floor(data.length / 7)} />
            <YAxis domain={[10, 100]} tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={false} width={24} />
            <Tooltip content={<CycleTooltip />} />
            {THRESHOLDS.map(t => (
              <ReferenceLine key={t.value} y={t.value} stroke={t.color}
                             strokeWidth={0.8} strokeDasharray="4 4"
                             label={{ value: t.label, position: 'right',
                                      fill: t.color, fontSize: 9, fontFamily: 'monospace' }} />
            ))}
            <ReferenceLine y={currentScore} stroke={currentColor} strokeWidth={0.5} strokeDasharray="2 2" />
            <Line type="monotone" dataKey="score" stroke="#e2e8f0" strokeWidth={1.5} dot={false}
                  activeDot={{ r: 3, fill: currentColor, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid #1e2736', fontSize: 11, color: '#64748b' }}>
        {Object.entries(STAGE_COLOR).map(([stage, color]) => (
          <span key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: STAGE_BG[stage], border: `1px solid ${color}`,
                           borderRadius: 2, display: 'inline-block' }} />
            {stage}
          </span>
        ))}
      </div>
    </div>
  )
}
