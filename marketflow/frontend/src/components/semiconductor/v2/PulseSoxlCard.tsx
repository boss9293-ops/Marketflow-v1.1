'use client'
// AI Compute vs Legacy 레이어 + SOXL Decay 추이 카드 — Card 3 (PULSE 탭)
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { LayerTimeSeries, DecayTimeSeries } from '@/lib/semiconductor/types'

const UI_FONT   = "'IBM Plex Sans', sans-serif"
const DATA_FONT = "'IBM Plex Mono', monospace"

function fmtDate(d: string) {
  return d.slice(5).replace('-', '/')
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function LayerTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f1117', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: DATA_FONT, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ fontSize: 13, fontFamily: DATA_FONT, color: p.color, marginBottom: 2 }}>
          {p.dataKey === 'ai_compute' ? 'AI' : 'Legacy'}: {fmtPct(p.value)}
        </div>
      ))}
    </div>
  )
}

function DecayTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f1117', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: DATA_FONT, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ fontSize: 13, fontFamily: DATA_FONT, color: p.color, marginBottom: 2 }}>
          {p.dataKey === 'theoretical_soxl' ? '이론값' : '실제값'}: {fmtPct(p.value)}
        </div>
      ))}
      {payload.length === 2 && (
        <div style={{ fontSize: 12, fontFamily: DATA_FONT, color: '#94a3b8', marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 4 }}>
          초과: {fmtPct(payload[1].value - payload[0].value)}
        </div>
      )}
    </div>
  )
}

interface Props {
  layerData: LayerTimeSeries
  decayData: DecayTimeSeries
}

export default function PulseSoxlCard({ layerData, decayData }: Props) {
  const layerSeries = layerData.series
  const decaySeries = decayData.series

  const layerTickDates = layerSeries
    .filter((_, i) => i % Math.floor(layerSeries.length / 5) === 0)
    .map(p => p.date)

  const decayTickDates = decaySeries
    .filter((_, i) => i % Math.floor(decaySeries.length / 5) === 0)
    .map(p => p.date)

  const spread = layerData.current.spread
  const spreadColor = spread >= 0 ? '#22c55e' : '#ef4444'
  const excessReturn = decayData.current.excess_return
  const excessColor = excessReturn >= 0 ? '#22c55e' : '#ef4444'

  const decayYMin = Math.min(
    ...decaySeries.map(p => Math.min(p.theoretical_soxl, p.actual_soxl))
  )
  const decayYMax = Math.max(
    ...decaySeries.map(p => Math.max(p.theoretical_soxl, p.actual_soxl))
  )
  const decayPad = Math.abs(decayYMax - decayYMin) * 0.1

  return (
    <div style={{ background: '#0d0d12', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Section 1: AI vs Legacy ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
              AI COMPUTE vs LEGACY — 90 DAYS
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#22d3ee', fontFamily: UI_FONT, letterSpacing: '0.05em' }}>AI</div>
                <div style={{ fontSize: 22, fontFamily: DATA_FONT, fontWeight: 700, color: '#22d3ee' }}>
                  {fmtPct(layerData.current.ai_compute)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#fbbf24', fontFamily: UI_FONT, letterSpacing: '0.05em' }}>LEGACY</div>
                <div style={{ fontSize: 22, fontFamily: DATA_FONT, fontWeight: 700, color: '#fbbf24' }}>
                  {fmtPct(layerData.current.legacy)}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
              SPREAD
            </div>
            <div style={{ fontSize: 22, fontFamily: DATA_FONT, fontWeight: 700, color: spreadColor }}>
              {spread >= 0 ? '+' : ''}{spread.toFixed(1)}pp
            </div>
          </div>
        </div>

        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={layerSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeWidth={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                tickFormatter={fmtDate}
                ticks={layerTickDates}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
              <Tooltip content={<LayerTooltip />} />
              <ReferenceLine y={0} stroke="#1e293b" strokeWidth={1} />
              <Line type="monotone" dataKey="ai_compute" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="legacy" stroke="#fbbf24" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #1e293b' }} />

      {/* ── Section 2: SOXL Decay ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
              SOXL DECAY TRACKER — 90 DAYS
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: UI_FONT, letterSpacing: '0.05em' }}>이론값 (3× SOXX)</div>
                <div style={{ fontSize: 18, fontFamily: DATA_FONT, fontWeight: 700, color: '#94a3b8' }}>
                  {fmtPct(decayData.current.theoretical_soxl)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: UI_FONT, letterSpacing: '0.05em' }}>실제 SOXL</div>
                <div style={{ fontSize: 18, fontFamily: DATA_FONT, fontWeight: 700, color: '#3b82f6' }}>
                  {fmtPct(decayData.current.actual_soxl)}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
              초과수익
            </div>
            <div style={{ fontSize: 18, fontFamily: DATA_FONT, fontWeight: 700, color: excessColor }}>
              {excessReturn >= 0 ? '+' : ''}{excessReturn.toFixed(1)}pp
            </div>
            <div style={{ fontSize: 12, fontFamily: UI_FONT, color: '#94a3b8', marginTop: 2 }}>
              {decayData.trend === 'outperforming' ? '초과수익 추세' : decayData.trend === 'underperforming' ? '미달 추세' : '중립'}
            </div>
          </div>
        </div>

        <div style={{ height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decaySeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeWidth={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                tickFormatter={fmtDate}
                ticks={decayTickDates}
              />
              <YAxis
                domain={[Math.floor(decayYMin - decayPad), Math.ceil(decayYMax + decayPad)]}
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
              <Tooltip content={<DecayTooltip />} />
              <ReferenceLine y={0} stroke="#1e293b" strokeWidth={1} />
              <Line type="monotone" dataKey="theoretical_soxl" stroke="#475569" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} />
              <Line type="monotone" dataKey="actual_soxl" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
