'use client'

import React, { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { HoldingsTS, HoldingsPoint, TabStats } from '@/app/my-holdings/page'

// ─── colour palette per tab index ────────────────────────────────────────────
const TAB_COLORS = ['#00D9FF', '#22c55e', '#f59e0b', '#f43f5e', '#a78bfa', '#38bdf8', '#4ade80']
function tabColor(idx: number): string {
  return TAB_COLORS[idx % TAB_COLORS.length]
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtMoney(v: number | null | undefined): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '-'
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtPct(v: number | null | undefined): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '-'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtDate(d: string): string {
  // Show YYYY-MM as label to save space
  return d.length >= 7 ? d.slice(0, 7) : d
}

// ─── subcomponents ────────────────────────────────────────────────────────────
function KpiCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '0.85rem 1rem',
        minWidth: 140,
        flex: '1 1 140px',
      }}
    >
      <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginBottom: 5 }}>{title}</div>
      <div style={{ color, fontWeight: 800, fontSize: '1.08rem', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
interface TooltipEntry {
  name: string
  value: number | null
  color: string
  dataKey: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div
      style={{
        background: '#1a1d26',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '0.65rem 0.9rem',
        fontSize: '0.78rem',
        minWidth: 180,
      }}
    >
      <div style={{ color: '#9ca3af', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 3 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>
            {p.dataKey.endsWith('_pct')
              ? fmtPct(p.value)
              : fmtMoney(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Chart line config ────────────────────────────────────────────────────────
type ChartMode = 'total_in' | 'pl' | 'pl_pct'

const CHART_MODES: { key: ChartMode; label: string }[] = [
  { key: 'total_in', label: 'Total / In' },
  { key: 'pl', label: 'P&L ($)' },
  { key: 'pl_pct', label: 'P&L (%)' },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function HoldingsChart({ data }: { data: HoldingsTS }) {
  const tabsFromPayload = (data.tabs ?? []).filter((t) => t?.name)
  const allTabs = tabsFromPayload.length ? tabsFromPayload.map((t) => t.name as string) : data.selected_tabs ?? []
  const [activeTab, setActiveTab] = useState<string>(allTabs[0] ?? '')
  const [chartMode, setChartMode] = useState<ChartMode>('total_in')
  const [showRefreshHint, setShowRefreshHint] = useState(false)

  const series: Record<string, HoldingsPoint[]> = { ...(data.series ?? {}) }
  if (tabsFromPayload.length) {
    for (const t of tabsFromPayload) {
      series[t.name as string] = (t.history as HoldingsPoint[]) || []
    }
  }

  const latest: Record<string, HoldingsPoint> = { ...(data.latest ?? {}) }
  const stats: Record<string, TabStats> = { ...(data.stats ?? {}) }
  if (tabsFromPayload.length) {
    for (const tab of allTabs) {
      const pts = series[tab] || []
      if (pts.length) latest[tab] = pts[pts.length - 1]
      if (!stats[tab]) {
        const totals = pts.map((p) => p.total).filter((v): v is number => typeof v === 'number')
        const plPcts = pts.map((p) => p.pl_pct).filter((v): v is number => typeof v === 'number')
        stats[tab] = {
          max_total: totals.length ? Math.max(...totals) : null,
          min_total: totals.length ? Math.min(...totals) : null,
          last5_pl_pct: plPcts.slice(-5),
          last5_pl_pct_changes: plPcts.slice(-5).map((v, i, arr) => (i === 0 ? null : v - arr[i - 1])),
          data_points: pts.length,
        }
      }
    }
  }

  // ── KPI values for active tab ──────────────────────────────────────────────
  const latestPt: HoldingsPoint | undefined = latest[activeTab]
  const tabStats = stats[activeTab]

  const kpis = [
    {
      title: 'Total Asset',
      value: fmtMoney(latestPt?.total),
      color: '#f3f4f6',
    },
    {
      title: 'Invested (In)',
      value: fmtMoney(latestPt?.in),
      color: '#9cdcfe',
    },
    {
      title: 'P&L ($)',
      value: fmtMoney(latestPt?.pl),
      color: (latestPt?.pl ?? 0) >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      title: 'P&L (%)',
      value: fmtPct(latestPt?.pl_pct),
      color: (latestPt?.pl_pct ?? 0) >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      title: 'Max Total',
      value: fmtMoney(tabStats?.max_total),
      color: '#f59e0b',
    },
    {
      title: 'Data Points',
      value: String(tabStats?.data_points ?? '-'),
      color: '#94a3b8',
    },
  ]

  // ── Build chart data ───────────────────────────────────────────────────────
  // Merge all dates from ALL tabs so x-axis aligns
  const dateSet = new Set<string>()
  for (const tab of allTabs) {
    for (const pt of series[tab] ?? []) {
      dateSet.add(pt.date)
    }
  }
  const allDates = Array.from(dateSet).sort()

  // Index series by date for fast lookup
  const byDate: Record<string, Record<string, HoldingsPoint>> = {}
  for (const tab of allTabs) {
    for (const pt of series[tab] ?? []) {
      if (!byDate[pt.date]) byDate[pt.date] = {}
      byDate[pt.date][tab] = pt
    }
  }

  // Build flattened chart rows
  const chartData = allDates.map((d) => {
    const row: Record<string, string | number | null> = { date: d }
    for (const tab of allTabs) {
      const pt = byDate[d]?.[tab]
      if (pt) {
        row[`${tab}_total`] = pt.total
        row[`${tab}_in`] = pt.in
        row[`${tab}_pl`] = pt.pl
        row[`${tab}_pl_pct`] = pt.pl_pct
      }
    }
    return row
  })

  // ── Determine which lines to render ───────────────────────────────────────
  type LineSpec = {
    dataKey: string
    name: string
    color: string
    yAxisId: 'left' | 'right'
    strokeDash?: string
  }

  const lines: LineSpec[] = []

  if (chartMode === 'total_in') {
    allTabs.forEach((tab, i) => {
      lines.push({ dataKey: `${tab}_total`, name: `${tab} Total`, color: tabColor(i), yAxisId: 'left' })
      lines.push({ dataKey: `${tab}_in`, name: `${tab} In`, color: tabColor(i), yAxisId: 'left', strokeDash: '5 3' })
    })
  } else if (chartMode === 'pl') {
    allTabs.forEach((tab, i) => {
      lines.push({ dataKey: `${tab}_pl`, name: `${tab} P&L`, color: tabColor(i), yAxisId: 'left' })
    })
  } else {
    allTabs.forEach((tab, i) => {
      lines.push({ dataKey: `${tab}_pl_pct`, name: `${tab} P&L%`, color: tabColor(i), yAxisId: 'right' })
    })
  }

  // Subsample dates for X-axis ticks (at most 12 labels)
  const tickIndices = (() => {
    const n = allDates.length
    if (n <= 12) return allDates.map((_, i) => i)
    const step = Math.ceil(n / 12)
    const idxs: number[] = []
    for (let i = 0; i < n; i += step) idxs.push(i)
    return idxs
  })()
  const tickDates = new Set(tickIndices.map((i) => allDates[i]))

  const xTickFormatter = (d: string) => (tickDates.has(d) ? fmtDate(d) : '')

  return (
    <div style={{ padding: '1.5rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800, color: '#f3f4f6' }}>
            My <span style={{ color: '#00D9FF' }}>Holdings</span>
          </h1>
          <div style={{ color: '#8b93a8', fontSize: '0.78rem', marginTop: 4 }}>
            As of: {data.date ?? '-'} &nbsp;|&nbsp; Generated: {data.generated_at ?? '-'} &nbsp;|&nbsp; Status: {data.status ?? '-'}
          </div>
        </div>

        {/* Refresh hint button */}
        <button
          onClick={() => setShowRefreshHint((v) => !v)}
          style={{
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.04)',
            color: '#cbd5e1',
            borderRadius: 8,
            padding: '0.38rem 0.75rem',
            fontSize: '0.76rem',
            cursor: 'pointer',
          }}
        >
          {showRefreshHint ? '▲ Hide Refresh Steps' : '↻ Refresh Data'}
        </button>
      </div>

      {/* ── Refresh hint panel ── */}
      {showRefreshHint && (
        <div
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '0.9rem 1.1rem',
          }}
        >
          <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginBottom: 8 }}>
            데이터를 업데이트하려면 서버에서 아래 명령 실행 후 페이지를 새로고침하세요.
          </div>
          <pre
            style={{
              margin: 0,
              color: '#86efac',
              fontSize: '0.76rem',
              overflowX: 'auto',
              background: 'transparent',
            }}
          >
            {data.rerun_hint ?? 'python backend/scripts/import_holdings_tabs.py --sheet_id <ID> --tabs Goal,<tab> && python backend/scripts/build_holdings_ts_cache.py'}
          </pre>
        </div>
      )}

      {/* ── Missing input warning ── */}
      {Array.isArray(data.missing_inputs) && data.missing_inputs.length > 0 && (
        <div
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 10,
            padding: '0.75rem 1rem',
            color: '#fbbf24',
            fontSize: '0.8rem',
          }}
        >
          Missing inputs: {data.missing_inputs.join(', ')}
        </div>
      )}

      {/* ── Tab switcher ── */}
      {allTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allTabs.map((tab, i) => {
            const active = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  border: active ? `1px solid ${tabColor(i)}88` : '1px solid rgba(255,255,255,0.14)',
                  background: active ? `${tabColor(i)}22` : 'rgba(255,255,255,0.04)',
                  color: active ? tabColor(i) : '#9ca3af',
                  borderRadius: 8,
                  padding: '0.32rem 0.72rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {kpis.map((k) => (
          <KpiCard key={k.title} title={k.title} value={k.value} color={k.color} />
        ))}
      </div>

      {/* ── Chart mode selector ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#6b7280', fontSize: '0.76rem', marginRight: 4 }}>Chart:</span>
        {CHART_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setChartMode(m.key)}
            style={{
              border: chartMode === m.key ? '1px solid rgba(0,217,255,0.45)' : '1px solid rgba(255,255,255,0.14)',
              background: chartMode === m.key ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: chartMode === m.key ? '#67e8f9' : '#9ca3af',
              borderRadius: 7,
              padding: '0.28rem 0.6rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Main chart ── */}
      {chartData.length === 0 ? (
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '3rem',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          데이터 없음 — 먼저 import_holdings_tabs.py 를 실행하세요.
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '1rem 0.5rem 0.5rem',
          }}
        >
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={xTickFormatter}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              {/* Left Y axis — amounts */}
              <YAxis
                yAxisId="left"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `$${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                    ? `$${(v / 1_000).toFixed(0)}K`
                    : `$${v}`
                }
                width={64}
              />
              {/* Right Y axis — percent */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '0.76rem', color: '#9ca3af', paddingTop: 8 }}
              />
              {lines.map((l) => (
                <Line
                  key={l.dataKey}
                  yAxisId={l.yAxisId}
                  type="monotone"
                  dataKey={l.dataKey}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray={l.strokeDash}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Last 5 P&L% ── */}
      {tabStats && Array.isArray(tabStats.last5_pl_pct) && tabStats.last5_pl_pct.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '0.85rem 1rem',
          }}
        >
          <div style={{ color: '#9ca3af', fontSize: '0.74rem', marginBottom: 8 }}>
            {activeTab} — Last 5 P&L% Points
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {tabStats.last5_pl_pct.map((v, i) => {
              const change = tabStats.last5_pl_pct_changes?.[i]
              const isUp = change !== null && change !== undefined && change >= 0
              return (
                <div
                  key={i}
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '0.42rem 0.7rem',
                    textAlign: 'center',
                    minWidth: 72,
                  }}
                >
                  <div style={{ color: v >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                    {fmtPct(v)}
                  </div>
                  {change !== null && change !== undefined && (
                    <div style={{ color: isUp ? '#4ade80' : '#f87171', fontSize: '0.68rem', marginTop: 2 }}>
                      {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}pp
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 4 }}>
        sheet_id: {data.sheet_id ?? '-'} &nbsp;|&nbsp; data_version: {data.data_version ?? '-'}
      </div>
    </div>
  )
}
