'use client'
// Cycle Score 90일 추이 카드 — Card 1 (PULSE 탭)
import {
  ComposedChart, Line, ReferenceArea, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { CycleScoreTimeSeries } from '@/lib/semiconductor/types'

const UI_FONT   = "'IBM Plex Sans', sans-serif"
const DATA_FONT = "'IBM Plex Mono', monospace"

const PHASE_COLOR: Record<string, string> = {
  PEAK:        '#f97316',
  EXPANSION:   '#3b82f6',
  EARLY_CYCLE: '#6366f1',
  CONTRACTION: '#ef4444',
}
const PHASE_FILL: Record<string, string> = {
  PEAK:        '#f9731618',
  EXPANSION:   '#3b82f618',
  EARLY_CYCLE: '#6366f118',
  CONTRACTION: '#ef444418',
}

function extractPhaseBands(series: CycleScoreTimeSeries['series']) {
  if (!series.length) return []
  const bands: { x1: string; x2: string; phase: string }[] = []
  let start = series[0]
  for (let i = 1; i < series.length; i++) {
    if (series[i].phase !== start.phase) {
      bands.push({ x1: start.date, x2: series[i - 1].date, phase: start.phase })
      start = series[i]
    }
  }
  bands.push({ x1: start.date, x2: series[series.length - 1].date, phase: start.phase })
  return bands
}

function fmtDate(d: string) {
  return d.slice(5).replace('-', '/')
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { phase: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const phase = payload[0].payload.phase
  return (
    <div style={{ background: '#0f1117', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: DATA_FONT, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#f3f4f6', fontFamily: DATA_FONT, fontWeight: 700 }}>{score.toFixed(1)}</div>
      <div style={{ fontSize: 12, color: PHASE_COLOR[phase] ?? '#cbd5e1', fontFamily: UI_FONT, marginTop: 2 }}>{phase}</div>
    </div>
  )
}

interface Props {
  data: CycleScoreTimeSeries
}

export default function PulseCycleCard({ data }: Props) {
  const series = data.series
  const last   = series[series.length - 1]
  const bands  = extractPhaseBands(series)

  const tickDates = series
    .filter((_, i) => i % Math.floor(series.length / 6) === 0)
    .map(p => p.date)

  const phaseColor = PHASE_COLOR[last.phase] ?? '#cbd5e1'

  return (
    <div style={{ background: '#0d0d12', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
            CYCLE SCORE — 90 DAYS
          </div>
          <div style={{ fontSize: 36, fontFamily: DATA_FONT, fontWeight: 900, color: phaseColor, lineHeight: 1 }}>
            {last.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 13, fontFamily: UI_FONT, color: phaseColor, marginTop: 4 }}>
            {last.phase.replace('_', ' ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
            PHASE DURATION
          </div>
          <div style={{ fontSize: 22, fontFamily: DATA_FONT, fontWeight: 700, color: '#f3f4f6' }}>
            {data.current_phase_duration_days}
          </div>
          <div style={{ fontSize: 12, fontFamily: UI_FONT, color: '#94a3b8' }}>days</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            {bands.map(b => (
              <ReferenceArea
                key={`${b.x1}-${b.phase}`}
                x1={b.x1} x2={b.x2}
                fill={PHASE_FILL[b.phase] ?? '#ffffff08'}
                strokeOpacity={0}
              />
            ))}
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeWidth={0.5} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tickFormatter={fmtDate}
              ticks={tickDates}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={phaseColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: phaseColor }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Phase legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(PHASE_COLOR).map(([phase, color]) => (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity: 0.8 }} />
            <span style={{ fontSize: 11, fontFamily: UI_FONT, color: '#94a3b8', letterSpacing: '0.05em' }}>
              {phase.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
