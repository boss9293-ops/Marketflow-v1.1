'use client'
import { useState } from 'react'
import {
  ComposedChart, Line, ReferenceArea, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CYCLE_EVENTS, type CycleEvent } from '@/lib/semiconductor/cycleEvents'

const STAGE_BG: Record<string, string> = {
  BOTTOM: '#a78bfa28',
  BUILD:  '#38bdf828',
  EXPAND: '#22c55e28',
  PEAK:   '#eab30828',
  RESET:  '#ef444428',
}

const STAGE_LABEL: Record<string, string> = {
  BOTTOM: '저점', BUILD: '회복', EXPAND: '확장', PEAK: '고점', RESET: '수축',
}

function extractStageRanges(data: CycleEvent['chartData']) {
  if (!data.length) return []
  const ranges: { x1: number; x2: number; stage: string }[] = []
  let start = data[0]
  for (let i = 1; i < data.length; i++) {
    if (data[i].stage !== start.stage) {
      ranges.push({ x1: start.day, x2: data[i].day, stage: start.stage })
      start = data[i]
    }
  }
  ranges.push({ x1: start.day, x2: data[data.length - 1].day, stage: start.stage })
  return ranges
}

const LEFT_COLOR: Record<string, string> = {
  RESET: '#ef4444', PEAK: '#eab308', EXPAND: '#22c55e', BUILD: '#38bdf8', BOTTOM: '#a78bfa',
}
const LEFT_BG: Record<string, string> = {
  RESET: '#ef444433', PEAK: '#eab30833', EXPAND: '#22c55e33', BUILD: '#38bdf833', BOTTOM: '#a78bfa33',
}

interface Props { currentStage: string }

export default function CyclePlayback({ currentStage }: Props) {
  const [selectedId, setSelectedId] = useState<string>('2016-memory-super')
  const [showSoxl, setShowSoxl]     = useState(false)

  const selected     = CYCLE_EVENTS.find(e => e.id === selectedId) ?? CYCLE_EVENTS[0]
  const stageRanges  = extractStageRanges(selected.chartData)
  const sortedEvents = [...CYCLE_EVENTS].sort((a, b) => b.analog_score - a.analog_score)

  const lc = LEFT_COLOR[selected.stage] ?? '#64748b'
  const lb = LEFT_BG[selected.stage]    ?? '#1e293b'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>

      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 14 }}>
        HISTORICAL CYCLE PLAYBACK
      </div>

      {/* Event button grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {sortedEvents.map(event => {
          const isSel     = selectedId === event.id
          const isCurrent = event.id === '2024-ai-wave'
          const isHigh    = event.analog_score >= 70
          return (
            <button key={event.id} onClick={() => setSelectedId(event.id)} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12,
              fontFamily: 'monospace', cursor: 'pointer', fontWeight: isSel ? 700 : 500,
              borderColor: isSel ? '#6366f1' : isCurrent ? '#00D9FF44' : isHigh ? '#f9731633' : '#1e293b',
              background:  isSel ? '#1e1b4b' : isCurrent ? 'rgba(0,217,255,0.05)' : 'transparent',
              color:        isSel ? '#818cf8' : isCurrent ? '#00D9FF' : isHigh ? '#f97316' : '#94a3b8',
            }}>
              {event.label}
              {isHigh && !isCurrent && <span style={{ marginLeft: 4, fontSize: 10, color: '#f97316' }}>★</span>}
            </button>
          )
        })}
      </div>

      {/* Event summary card */}
      <div style={{
        background: '#0a1122',
        border: `1px solid ${lb}`,
        borderLeft: `3px solid ${lc}`,
        borderRadius: 6, padding: '10px 14px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>
              {selected.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {selected.period} · {selected.duration_days}일 · {STAGE_LABEL[selected.stage]}
            </div>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 5,
            background: selected.analog_score >= 70 ? '#f9731618' : '#1e293b',
            color:       selected.analog_score >= 70 ? '#f97316'   : '#64748b',
            border: `1px solid ${selected.analog_score >= 70 ? '#f9731644' : '#1e293b'}`,
          }}>
            현재 유사도 {selected.analog_score}%
          </div>
        </div>

        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '8px 0' }}>
          {selected.description}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8,
                      paddingTop: 8, borderTop: '1px solid #1e293b' }}>
          {selected.soxx_drawdown < 0 && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>SOXX 최대 낙폭: </span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{selected.soxx_drawdown}%</span>
            </div>
          )}
          {selected.soxx_recovery > 0 && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>회복: </span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>+{selected.soxx_recovery}%</span>
            </div>
          )}
          <div style={{ fontSize: 12 }}>
            <span style={{ color: '#64748b' }}>트리거: </span>
            <span style={{ color: '#e2e8f0' }}>{selected.trigger}</span>
          </div>
        </div>

        <div style={{ marginTop: 8, padding: '8px 10px', background: '#0c1524',
                      borderRadius: 5, fontSize: 12, color: '#64748b' }}>
          <span style={{ color: '#6366f1', fontWeight: 700, marginRight: 6 }}>현재 비교:</span>
          {selected.analog_reason}
        </div>
      </div>

      {/* Chart header + SOXL toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#475569' }}>
          Rebased 100 (이벤트 시작일 = 100) · Stage 배경 오버레이
        </div>
        <button onClick={() => setShowSoxl(!showSoxl)} style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          border: '1px solid', fontFamily: 'monospace',
          borderColor: showSoxl ? '#6366f1' : '#1e293b',
          background:  showSoxl ? '#1e1b4b' : 'transparent',
          color:        showSoxl ? '#818cf8' : '#475569',
        }}>
          {showSoxl ? 'SOXL ON' : 'SOXL OFF'}
        </button>
      </div>

      {/* Main chart */}
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={selected.chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            {stageRanges.map(r => (
              <ReferenceArea key={r.x1} x1={r.x1} x2={r.x2} fill={STAGE_BG[r.stage] ?? '#ffffff08'} />
            ))}
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="day"
                   tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={{ stroke: '#1e2736' }}
                   tickFormatter={v => `D${v}`}
                   interval={Math.floor(selected.chartData.length / 6)} />
            <YAxis domain={['auto', 'auto']}
                   tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                   tickLine={false} axisLine={false}
                   tickFormatter={v => `${v >= 100 ? '+' : ''}${(v - 100).toFixed(0)}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b',
                              borderRadius: 6, fontSize: 11, color: '#e2e8f0' }}
              labelStyle={{ color: '#64748b' }}
              formatter={(val: number, name: string) => [
                `${val >= 100 ? '+' : ''}${(val - 100).toFixed(1)}%`, name,
              ]}
            />
            <ReferenceLine y={100} stroke="#334155" strokeWidth={1} />
            <Line type="monotone" dataKey="soxx" name="SOXX"
                  stroke="#e2e8f0" strokeWidth={2} dot={false}
                  activeDot={{ r: 3, fill: '#38bdf8' }} />
            {showSoxl && (
              <Line type="monotone" dataKey="soxl" name="SOXL"
                    stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stage legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid #1e2736', flexWrap: 'wrap' }}>
        {Object.entries(STAGE_BG).map(([s, color]) => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5,
                                 fontSize: 11, color: '#64748b' }}>
            <span style={{ width: 10, height: 10, background: color, display: 'inline-block', borderRadius: 2 }} />
            {STAGE_LABEL[s]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          ★ = 현재와 유사도 70%+
        </span>
      </div>
    </div>
  )
}
