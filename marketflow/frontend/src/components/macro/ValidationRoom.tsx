'use client'

import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts'
import { Shield, AlertTriangle, Activity, BarChart2, CheckCircle, Info } from 'lucide-react'

type ValidationSummary = {
  policy_version: string
  window: string
  start_date: string
  end_date: string
  metrics: {
    avg_lead_time_vix: number | null
    avg_lead_time_dd: number | null
    false_alarm_rate: number
    coverage: number
    stability_95: number
    counts: {
      macro: number
      vix: number
      dd: number
      false_alarms: number
    }
  }
  events: {
    macro_events: any[]
    vix_events: any[]
    dd_events: any[]
  }
}

type ValidationTimeseries = {
  date: string[]
  MPS: number[]
  LPI: number[]
  RPI: number[]
  VRI: number[]
  VIX: number[]
  QQQ: number[]
  drawdown: number[]
  tqqq_drawdown: number[] | null
  is_mps_ge_70: boolean[]
  is_vix_ge_25: boolean[]
  is_dd_le_neg10: boolean[]
  is_tqqq_dd_le_neg30: boolean[] | null
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

export default function ValidationRoom() {
  const [selectedWindow, setSelectedWindow] = useState('2020')
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const [timeseries, setTimeseries] = useState<ValidationTimeseries | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [selectedWindow])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumRes, tsRes] = await Promise.all([
        fetch(`${API_BASE}/api/macro/validation/summary?window=${selectedWindow}`),
        fetch(`${API_BASE}/api/macro/validation/timeseries?window=${selectedWindow}`)
      ])

      if (!sumRes.ok || !tsRes.ok) {
        const sumErr = !sumRes.ok ? await sumRes.text().catch(() => '') : ''
        const tsErr = !tsRes.ok ? await tsRes.text().catch(() => '') : ''
        throw new Error(sumErr || tsErr || 'Failed to fetch validation data')
      }

      const sumData = await sumRes.json()
      const tsData = await tsRes.json()

      setSummary(sumData)
      setTimeseries(tsData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-slate-400">Loading historical validation data...</div>
  if (error) return <div className="p-10 text-center text-red-400">Error: {error}</div>
  if (!summary || !timeseries) return null

  // Prepare chart data
  const chartData = timeseries.date.map((d, i) => ({
    date: d,
    MPS: timeseries.MPS[i],
    VIX: timeseries.VIX[i],
    QQQ: timeseries.QQQ[i],
    DD: timeseries.drawdown[i] * 100, // as percentage
    TQQQ_DD: timeseries.tqqq_drawdown ? timeseries.tqqq_drawdown[i] * 100 : null,
    isMPS: timeseries.is_mps_ge_70[i],
    isVIX: timeseries.is_vix_ge_25[i],
    isDD: timeseries.is_dd_le_neg10[i],
    isTQQQ: timeseries.is_tqqq_dd_le_neg30 ? timeseries.is_tqqq_dd_le_neg30[i] : false,
  }))

  const metrics = summary.metrics
  const windows = ['2020', '2022', '2024', '2025', 'baseline'] as const
  const windowLabel = (w: (typeof windows)[number]) => {
    if (w === '2020') return '2020 Crisis'
    if (w === '2022') return '2022 Tightening'
    if (w === '2024') return '2024 엔캐리'
    if (w === '2025') return '2025 관세'
    return 'Baseline (2017-19)'
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Window Selector */}
      <div className="flex items-center gap-3 bg-[#1a1a1a] p-1 rounded-xl border border-[#2a2a2a] w-fit">
        {windows.map((w) => (
          <button
            key={w}
            onClick={() => setSelectedWindow(w)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedWindow === w ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-white'
              }`}
          >
            {windowLabel(w)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Lead Time (VIX >= 25)"
          value={metrics.avg_lead_time_vix != null ? `${metrics.avg_lead_time_vix.toFixed(0)}d` : 'N/A'}
          subtitle="Days prior macro pressure"
          icon={<Shield className="w-4 h-4 text-emerald-400" />}
          trend={metrics.avg_lead_time_vix != null && metrics.avg_lead_time_vix > 0 ? 'Positive Lead' : 'No Lead'}
        />
        <MetricCard
          title="False Alarm Rate"
          value={`${(metrics.false_alarm_rate * 100).toFixed(0)}%`}
          subtitle={`${metrics.counts.false_alarms} out of ${metrics.counts.macro} cases`}
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          trend={metrics.false_alarm_rate < 0.2 ? 'Excellent' : 'Moderate'}
        />
        <MetricCard
          title="Stress Coverage"
          value={`${(metrics.coverage * 100).toFixed(0)}%`}
          subtitle="MPS >= 70 during stress"
          icon={<Activity className="w-4 h-4 text-sky-400" />}
        />
        <MetricCard
          title="Signal Stability"
          value={metrics.stability_95.toFixed(1)}
          subtitle="95th %ile of daily change"
          icon={<BarChart2 className="w-4 h-4 text-purple-400" />}
          trend={metrics.stability_95 < 5 ? 'Stable' : 'Volatile'}
        />
      </div>

      {/* Primary Timeline Chart */}
      <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Historical Playback Timeline <span className="text-xs font-normal text-slate-500">(MPS vs VIX vs QQQ vs TQQQ)</span>
          </h3>
          <div className="flex gap-4 text-[10px] text-slate-400">
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500/20 rounded-sm"></div> MPS {'>'}= 70</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500/20 rounded-sm"></div> Stress (VIX/DD)</div>
          </div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#555"
                fontSize={10}
                tickFormatter={(d) => d.slice(5)}
                minTickGap={30}
              />
              <YAxis yAxisId="left" stroke="#888" fontSize={10} domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" stroke="#555" fontSize={10} domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />

              {/* Pressure Highlight Zones (MPS >= 70) */}
              {chartData.map((d, i) => {
                if (d.isMPS) {
                  return <ReferenceArea key={`mps-${i}`} x1={d.date} x2={chartData[i + 1]?.date || d.date} yAxisId="left" fill="#10b981" fillOpacity={0.08} stroke="none" />
                }
                return null
              })}

              {/* Stress Highlight Zones (VIX >= 25 or DD <= -10%) */}
              {chartData.map((d, i) => {
                if (d.isVIX || d.isDD) {
                  return <ReferenceArea key={`stress-${i}`} x1={d.date} x2={chartData[i + 1]?.date || d.date} yAxisId="left" fill="#ef4444" fillOpacity={0.08} stroke="none" />
                }
                return null
              })}

              <Line yAxisId="left" type="monotone" dataKey="MPS" stroke="#10b981" strokeWidth={2} dot={false} name="Macro Pressure Score" />
              <Line yAxisId="left" type="monotone" dataKey="VIX" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="VIX" />
              <Line yAxisId="right" type="monotone" dataKey="DD" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="QQQ Drawdown %" />
              {chartData.some(d => d.TQQQ_DD != null) && (
                <Line yAxisId="right" type="monotone" dataKey="TQQQ_DD" stroke="#f97316" strokeWidth={1} strokeDasharray="3 3" dot={false} name="TQQQ Drawdown %" connectNulls={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Event Matching Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a2a] bg-white/[0.02] flex items-center justify-between">
            <h4 className="text-sm font-semibold">Macro Pressure Runs (MPS {'>'}= 70)</h4>
            <span className="text-[10px] text-slate-400">{summary.events.macro_events.length} Events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-[#2a2a2a]">
                  <th className="text-left px-5 py-3 font-medium">Start</th>
                  <th className="text-left px-5 py-3 font-medium">End</th>
                  <th className="text-left px-5 py-3 font-medium">Peak MPS</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.events.macro_events.map((e, i) => {
                  // Check if this was a false alarm
                  const mStart = new Date(e.start_date)
                  const mPlus20 = new Date(mStart)
                  mPlus20.setDate(mPlus20.getDate() + 30) // Appx 20 trading days
                  const stressStarts = [...summary.events.vix_events, ...summary.events.dd_events].map(ev => new Date(ev.start_date))
                  const hit = stressStarts.some(s => s >= mStart && s <= mPlus20)

                  return (
                    <tr key={i} className="border-b border-[#262626] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-300">{e.start_date}</td>
                      <td className="px-5 py-3 text-slate-300">{e.end_date}</td>
                      <td className="px-5 py-3 font-semibold text-white">{e.peak.toFixed(0)}</td>
                      <td className="px-5 py-3">
                        {hit ? (
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3 h-3" /> Validated</span>
                        ) : (
                          <span className="text-amber-500/80">False Alarm</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a2a] bg-white/[0.02] flex items-center justify-between">
            <h4 className="text-sm font-semibold text-red-300">Stress Events (VIX/DD)</h4>
            <span className="text-[10px] text-slate-400">{summary.events.vix_events.length + summary.events.dd_events.length} Events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-[#2a2a2a]">
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Start Date</th>
                  <th className="text-left px-5 py-3 font-medium">Intensity</th>
                  <th className="text-left px-5 py-3 font-medium">Macro Lead</th>
                </tr>
              </thead>
              <tbody>
                {summary.events.vix_events.map((e, i) => {
                  const vStart = new Date(e.start_date)
                  const priorM = summary.events.macro_events.filter(me => new Date(me.start_date) <= vStart)
                  const lead = priorM.length > 0 ? 'Lead' : 'Late'
                  return (
                    <tr key={`vix-${i}`} className="border-b border-[#262626] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-400">VIX {'>'}= 25</td>
                      <td className="px-5 py-3 text-slate-300">{e.start_date}</td>
                      <td className="px-5 py-3 text-white">Peak {e.peak.toFixed(1)}</td>
                      <td className={`px-5 py-3 ${lead === 'Lead' ? 'text-emerald-400' : 'text-red-400'}`}>{lead}</td>
                    </tr>
                  )
                })}
                {summary.events.dd_events.map((e, i) => {
                  const dStart = new Date(e.start_date)
                  const priorM = summary.events.macro_events.filter(me => new Date(me.start_date) <= dStart)
                  const lead = priorM.length > 0 ? 'Lead' : 'Late'
                  return (
                    <tr key={`dd-${i}`} className="border-b border-[#262626] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-400">DD {'<'}= -10%</td>
                      <td className="px-5 py-3 text-slate-300">{e.start_date}</td>
                      <td className="px-5 py-3 text-white">Trough {(e.peak * 100).toFixed(1)}%</td>
                      <td className={`px-5 py-3 ${lead === 'Lead' ? 'text-emerald-400' : 'text-red-400'}`}>{lead}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-500/10 flex gap-3 text-xs text-sky-200">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          This validation report uses a rolling 5Y rank percentile (identical to Production) to demonstrate how macro signals
          behaved during past volatility regimes. Note that "Lead Time" refers to when MPS first crossed 70 relative to stress events.
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon, trend }: any) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-[#2a2a2a] relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${trend === 'Positive Lead' || trend === 'Excellent' || trend === 'Stable'
              ? 'border-emerald-400/20 text-emerald-400 bg-emerald-500/5'
              : 'border-slate-400/20 text-slate-400 bg-white/5'
            }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">{title}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-[11px] text-slate-500">{subtitle}</div>
    </div>
  )
}
