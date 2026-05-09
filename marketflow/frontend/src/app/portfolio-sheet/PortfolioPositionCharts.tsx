'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { PortfolioAccountSummary, PortfolioSheetRow } from '@/lib/portfolio-sheet/types'

type PortfolioPositionChartsProps = {
  rows: PortfolioSheetRow[]
  summary: PortfolioAccountSummary
}

type DonutRow = {
  symbol: string
  pct: number
}

const DONUT_COLORS = ['#22c55e', '#60a5fa', '#f59e0b', '#ef4444', '#14b8a6', '#a78bfa', '#eab308', '#f43f5e', '#38bdf8', '#4ade80']

function finite(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${value.toFixed(1)}%`
}

function renderPieLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props
  const labelName = String(name || '')
  if (!labelName) return null

  const radian = Math.PI / 180
  const distance = outerRadius + 18
  const x = cx + distance * Math.cos(-midAngle * radian)
  const y = cy + distance * Math.sin(-midAngle * radian)
  const textAnchor = x > cx ? 'start' : 'end'
  const pct = typeof percent === 'number' ? ` ${formatPct(percent * 100)}` : ''

  return (
    <text x={x} y={y} fill="#cbd5e1" textAnchor={textAnchor} dominantBaseline="central" fontSize={11}>
      {labelName}
      {pct}
    </text>
  )
}

function buildDonutRows(rows: PortfolioSheetRow[], summary: PortfolioAccountSummary): DonutRow[] {
  const baseRows = rows
    .filter((row) => row.active !== false && finite(row.marketValue) > 0)
    .map((row) => ({
      symbol: row.ticker,
      pct: summary.marketValue > 0 ? (finite(row.marketValue) / summary.marketValue) * 100 : finite(row.positionPct),
    }))
    .filter((row) => row.pct > 0)
    .sort((a, b) => b.pct - a.pct)

  if (baseRows.length <= 10) return baseRows

  const visible = baseRows.slice(0, 9)
  const othersPct = baseRows.slice(9).reduce((sum, row) => sum + row.pct, 0)
  return [...visible, { symbol: 'Other', pct: othersPct }]
}

export function PortfolioPositionCharts({ rows, summary }: PortfolioPositionChartsProps) {
  const activeRows = rows.filter((row) => row.active !== false && (finite(row.marketValue) > 0 || finite(row.costBasis) > 0))
  const barRows = activeRows.map((row) => ({
    symbol: row.ticker,
    valuation: finite(row.marketValue),
    buyAmount: finite(row.costBasis),
  }))
  const donutRows = buildDonutRows(rows, summary)

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
      <div style={{ flex: 1.6, minWidth: 280 }}>
        <div style={{ color: '#bfdbfe', fontSize: '0.72rem', marginBottom: 5 }}>평가액 / 매수액</div>
        {barRows.length === 0 ? (
          <div style={{ color: '#8b93a8', fontSize: '0.82rem', padding: '1rem', border: '1px dashed rgba(148,163,184,0.22)', borderRadius: 8 }}>
            No position values.
          </div>
        ) : (
          <div style={{ width: '100%', height: 218 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="symbol" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.24)' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}K`} />
                <Tooltip
                  formatter={(value, name) => [formatMoney(Number(value)), name]}
                  contentStyle={{
                    background: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(148,163,184,0.26)',
                    borderRadius: 8,
                    color: '#e5e7eb',
                    fontSize: '0.75rem',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '0.72rem' }} />
                <Bar dataKey="valuation" name="평가액" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="buyAmount" name="매수액" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ color: '#bfdbfe', fontSize: '0.72rem', minWidth: 120 }}>Weights Donut</div>
        {donutRows.length === 0 ? (
          <div style={{ color: '#8b93a8', fontSize: '0.82rem', padding: '1rem', border: '1px dashed rgba(148,163,184,0.22)', borderRadius: 8 }}>
            No position weights.
          </div>
        ) : (
          <div style={{ width: '100%', height: 228 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 26, right: 34, left: 34, bottom: 26 }}>
                <Pie
                  data={donutRows}
                  dataKey="pct"
                  nameKey="symbol"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={1}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {donutRows.map((entry, index) => (
                    <Cell key={`portfolio-position-${entry.symbol}-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatPct(Number(value)), name]}
                  contentStyle={{
                    background: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(148,163,184,0.26)',
                    borderRadius: 8,
                    color: '#e5e7eb',
                    fontSize: '0.75rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
