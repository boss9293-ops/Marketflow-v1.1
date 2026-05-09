'use client'
import React, { useEffect, useState } from 'react'
import {

  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ???? Types ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

type PlaybackPeriod = {
  id: string
  label: string
  startDate: string
  endDate: string
  cycleStage: 'early' | 'expansion' | 'peak' | 'downturn'
  description: string
}

type SeriesPoint = {
  date: string
  soxx: number
  aiInfra: number
  memory: number
  foundry: number
  equipment: number
}

type TimelinePoint = {
  date: string
  cycleDay: number
  stage: string
  breadth: string
  momentum: string
  map: string
  conflict: string
}

type InterpretationOutput = {
  summary: string
  alignment: string
  support: string[]
  weakness: string[]
  interpretation: string
  context: string
  confidence: string
}

type PeriodPayload = {
  series: SeriesPoint[]
  timeline: TimelinePoint[]
  interpretation: InterpretationOutput
}

type PlaybackData = {
  periods: PlaybackPeriod[]
  periodData: Record<string, PeriodPayload>
  dataStatus: { source: string; note?: string }
}

// ???? Helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const STAGE_COLORS: Record<string, string> = {
  Expansion:      '#3b82f6',
  'Mid Expansion':'#6366f1',
  'Early Cycle':  '#10b981',
  Recovery:       '#10b981',
  Peak:           '#f97316',
  Contraction:    '#ef4444',
  Trough:         '#64748b',
}

const CYCLE_STAGE_BG: Record<string, string> = {
  expansion: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  early:     'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  peak:      'bg-orange-500/10 text-orange-300 border-orange-500/30',
  downturn:  'bg-red-500/10 text-red-300 border-red-500/30',
}

function breadthCls(v: string) {
  return v === 'Broad'  ? 'text-emerald-400' :
         v === 'Mixed'  ? 'text-yellow-400'  :
         v === 'Narrow' ? 'text-red-400'     : 'text-slate-400'
}
function momentumCls(v: string) {
  return v === 'Strong'  ? 'text-emerald-400' :
         v === 'Neutral' ? 'text-yellow-400'  :
         v === 'Weak'    ? 'text-red-400'     : 'text-slate-400'
}
function mapCls(v: string) {
  return v === 'Stable'      ? 'text-emerald-400' :
         v === 'Transitional'? 'text-yellow-400'  :
         v === 'Stabilizing' ? 'text-yellow-400'  :
         v === 'Unstable'    ? 'text-red-400'     : 'text-slate-400'
}

// ???? Sub-components ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: UI_FONT }}>
      <span className="mr-1 text-slate-500">{n}.</span>{text}
    </div>
  )
}

function InterpCard({ data }: { data: InterpretationOutput }) {
  const confCls =
    data.confidence === 'High'   ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    data.confidence === 'Medium' ? 'text-yellow-400  border-yellow-500/30  bg-yellow-500/10'  :
                                   'text-orange-400  border-orange-500/30  bg-orange-500/10'
  const alignCls =
    data.alignment === 'Aligned'  ? 'text-emerald-400' :
    data.alignment === 'Mixed'    ? 'text-yellow-400'  :
    data.alignment === 'Divergent'? 'text-red-400'     : 'text-slate-400'

  return (
    <div className="flex flex-col gap-[10px].5 text-[11px]">

      {/* Summary */}
      <div className="pb-2 border-b border-slate-800/60">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>Summary</div>
        <p className="text-slate-200 font-medium leading-[1.6]">{data.summary}</p>
      </div>

      {/* Alignment + Confidence chips */}
      <div className="flex gap-[10px] pb-2 border-b border-slate-800/60">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400 uppercase">Alignment</span>
          <span className={`text-[11px] font-bold ${alignCls}`}>{data.alignment}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400 uppercase">Confidence</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 border rounded-sm ${confCls}`}>{data.confidence}</span>
        </div>
      </div>

      {/* Stronger relative structure */}
      <div className="pb-2 border-b border-slate-800/60">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>Stronger Relative Structure</div>
        <ul className="space-y-0.5">
          {data.support.map((s, i) => (
            <li key={i} className="flex items-start gap-[6px] text-slate-400">
              <span className="text-emerald-600 shrink-0 mt-0.5">-</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Weaker relative structure */}
      <div className="pb-2 border-b border-slate-800/60">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>Weaker Relative Structure</div>
        <ul className="space-y-0.5">
          {data.weakness.length === 0 ? (
            <li className="text-slate-400">No material structural constraints identified</li>
          ) : data.weakness.map((w, i) => (
            <li key={i} className="flex items-start gap-[6px] text-slate-400">
              <span className="text-orange-600 shrink-0 mt-0.5">-</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Interpretation */}
      <div className="pb-2 border-b border-slate-800/60">
        <div className="text-[20px] font-semibold text-slate-400 mb-1">Structural Interpretation</div>
        <p className="text-slate-300 leading-[1.6]">{data.interpretation}</p>
      </div>

      {/* Historical Context */}
      {data.context && (
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>Historical Context</div>
          <p className="text-slate-500 leading-[1.6] italic">{data.context}</p>
        </div>
      )}

    </div>
  )
}

// ???? Main Component ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function SemiconductorPlaybackTab() {
  const [data, setData] = useState<PlaybackData | null>(null)
  const [selectedId, setSelectedId] = useState('ai_expansion_2024')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/playback')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setData(d); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [])

  const periods      = data?.periods ?? []
  const periodData   = data?.periodData ?? {}
  const current      = periodData[selectedId] ?? null
  const currentPeriod = periods.find(p => p.id === selectedId) ?? null
  const dataStatus   = data?.dataStatus ?? { source: 'loading' }

  const seriesData   = (current?.series   ?? []) as SeriesPoint[]
  const timelineData = (current?.timeline ?? []) as TimelinePoint[]
  const interp       = (current?.interpretation ?? null) as InterpretationOutput | null

  return (
    <div className="flex flex-col gap-[18px] px-4 py-4 max-w-[1280px] mx-auto">

      {/* ??Playback Header */}
      <div className="border border-slate-800 bg-[#04070d] rounded-sm p-4">
        <SectionLabel n={1} text="Playback Header" />
        <div className="flex items-baseline gap-[14px]">
          <h2 className="text-[16px] font-bold text-white tracking-tight">Historical Structure Playback</h2>
          <span className={`text-[11px] px-2 py-0.5 border rounded-sm font-bold ${
            currentPeriod ? CYCLE_STAGE_BG[currentPeriod.cycleStage] : 'text-slate-500 border-slate-700'
          }`}>{currentPeriod?.cycleStage?.toUpperCase() ?? '-'}</span>
        </div>
        <p className="text-[14px] leading-[1.6] text-slate-400 mt-1 leading-[1.6]">
          Review how semiconductor structure evolved across selected historical cycle periods.
        </p>
        {currentPeriod && (
          <p className="text-[11px] text-slate-500 mt-1.5">{currentPeriod.description}</p>
        )}
      </div>

      {/* ??Period Selector */}
      <div className="border border-slate-800 bg-[#04070d] rounded-sm p-4">
        <SectionLabel n={2} text="Period Selector" />
        <div className="flex flex-col sm:flex-row gap-[10px]">
          {loading ? (
            <p className="text-[11px] text-slate-400">Loading periods...</p>
          ) : periods.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex-1 text-left px-3 py-2.5 border rounded-sm transition-colors ${
                selectedId === p.id
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-slate-700 bg-transparent text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}>
              <div className="text-[11px] font-bold leading-[1.6]">{p.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{p.startDate} - {p.endDate}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ???た Charts side by side */}
      <div className="grid grid-cols-2 gap-[18px]">

        {/* ??Rebased 100 Chart */}
        <div className="border border-slate-800 bg-[#04070d] rounded-sm p-4">
          <SectionLabel n={3} text="Rebased 100 Chart" />
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-3" style={{ fontFamily: UI_FONT }}>
            Rebased 100 | Relative Structure
          </div>
          <div className="flex flex-wrap gap-[14px] mb-2 text-[11px]">
            {[
              { key: 'soxx',      label: 'SOXX',          color: '#3b82f6' },
              { key: 'aiInfra',   label: 'AI Infra',      color: '#10b981' },
              { key: 'memory',    label: 'Memory',        color: '#f97316' },
              { key: 'foundry',   label: 'Foundry',       color: '#ec4899' },
              { key: 'equipment', label: 'Equipment',     color: '#eab308' },
            ].map(s => (
              <span key={s.key} className="flex items-center gap-[6px] text-slate-500">
                <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          <div className="h-[200px]">
            {seriesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400">
                {loading ? 'Loading...' : 'No data'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={v => String(v)} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }}
                    formatter={(v: unknown) => [`${v}`, '']} />
                  <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 2" />
                  <Line type="monotone" dataKey="soxx"      stroke="#3b82f6" strokeWidth={2}   dot={false} name="SOXX" />
                  <Line type="monotone" dataKey="aiInfra"   stroke="#10b981" strokeWidth={1.5} dot={false} name="AI Infra" />
                  <Line type="monotone" dataKey="memory"    stroke="#f97316" strokeWidth={1.5} dot={false} name="Memory" />
                  <Line type="monotone" dataKey="foundry"   stroke="#ec4899" strokeWidth={1.2} dot={false} name="Foundry" />
                  <Line type="monotone" dataKey="equipment" stroke="#eab308" strokeWidth={1.2} dot={false} name="Equipment" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ??Cycle Day Alignment */}
        <div className="border border-slate-800 bg-[#04070d] rounded-sm p-4">
          <SectionLabel n={4} text="Cycle Day Alignment" />
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-3" style={{ fontFamily: UI_FONT }}>
            Cycle Day Alignment
          </div>
          {timelineData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-[11px] text-slate-400">
              {loading ? 'Loading...' : 'No timeline data'}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-[11px] font-mono" style={{ fontFamily: DATA_FONT }}>
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Date','Day','Stage','Breadth','Momentum','MAP','Conflict'].map(h => (
                      <th key={h} className="text-left py-1 pr-2 text-[11px] text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timelineData.map((pt, i) => (
                    <tr key={i} className="border-b border-slate-800/40">
                      <td className="py-1 pr-2 text-slate-400">{pt.date}</td>
                      <td className="py-1 pr-2 text-slate-500">{pt.cycleDay}</td>
                      <td className="py-1 pr-2">
                        <span className="font-medium" style={{ color: STAGE_COLORS[pt.stage] ?? '#94a3b8' }}>
                          {pt.stage}
                        </span>
                      </td>
                      <td className={`py-1 pr-2 ${breadthCls(pt.breadth)}`}>{pt.breadth}</td>
                      <td className={`py-1 pr-2 ${momentumCls(pt.momentum)}`}>{pt.momentum}</td>
                      <td className={`py-1 pr-2 ${mapCls(pt.map)}`}>{pt.map}</td>
                      <td className="py-1 pr-2 text-slate-500">{pt.conflict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ??Interpretation Replay Panel */}
      <div className="border border-slate-800 bg-[#04070d] rounded-sm p-4">
        <SectionLabel n={5} text="Interpretation Replay Panel" />
        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-3" style={{ fontFamily: UI_FONT }}>
          Structural Interpretation | {currentPeriod?.label ?? '-'}
        </div>
        {!interp ? (
          <p className="text-[11px] text-slate-400">{loading ? 'Loading...' : 'Interpretation not available.'}</p>
        ) : (
          <InterpCard data={interp} />
        )}
      </div>

      {/* ??Data Status */}
      <div className="border border-slate-800/50 bg-slate-900/20 rounded-sm px-4 py-2.5 flex flex-wrap items-center gap-[14px]">
        <SectionLabel n={6} text="Data Status" />
        <div className="flex flex-wrap items-center gap-[10px] ml-auto">
          <span className={`text-[11px] px-1.5 py-0.5 border rounded-sm font-bold uppercase tracking-widest ${
            dataStatus.source === 'live'        ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
            dataStatus.source === 'snapshot'    ? 'text-blue-400    border-blue-500/30    bg-blue-500/10'    :
            dataStatus.source === 'fallback'    ? 'text-yellow-400  border-yellow-500/30  bg-yellow-500/10'  :
            dataStatus.source === 'unavailable' ? 'text-red-400     border-red-500/30     bg-red-500/10'     :
                                                  'text-slate-400   border-slate-600       bg-slate-800/30'
          }`}>DATA STATUS {dataStatus.source.toUpperCase()}</span>
          <span className="text-[11px] text-slate-500 leading-[1.6]">
            {dataStatus.note ?? 'Fallback data is used to preserve layout while historical source integration is pending.'}
          </span>
        </div>
      </div>

    </div>
  )
}



