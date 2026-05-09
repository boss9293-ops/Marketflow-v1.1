'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { isPortfolioTradingDay } from '@/lib/portfolio-sheet/marketCalendar'
import type { PortfolioDailySnapshotRecord } from '@/lib/portfolio-sheet/types'

type PortfolioHistoryChartProps = {
  history: PortfolioDailySnapshotRecord[]
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `$${currencyFormatter.format(value)}`
}

function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatCurrency(value)}`
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${value.toFixed(2)}%`
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1_000_000) return `$${numberFormatter.format(value / 1_000_000)}M`
  if (Math.abs(value) >= 1_000) return `$${numberFormatter.format(value / 1_000)}K`
  return `$${numberFormatter.format(value)}`
}

export function PortfolioHistoryChart({ history }: PortfolioHistoryChartProps) {
  const tradingHistory = history.filter((snapshot) => isPortfolioTradingDay(snapshot.date))

  if (tradingHistory.length === 0) {
    return (
      <div
        style={{
          height: 300,
          border: '1px dashed rgba(148,163,184,0.28)',
          borderRadius: 8,
          background:
            'repeating-linear-gradient(90deg, rgba(148,163,184,0.04) 0, rgba(148,163,184,0.04) 1px, transparent 1px, transparent 72px), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        No trading-day snapshot history yet. Click Save Snapshot on a market day to create the first daily record.
      </div>
    )
  }

  const data = tradingHistory.map((snapshot) => ({
    date: snapshot.date,
    totalValue: Number(snapshot.total_value) || 0,
    totalCost: Number(snapshot.total_cost) || 0,
    pnl: Number(snapshot.pnl) || 0,
    pnlPct: (Number(snapshot.pnl_pct) || 0) * 100,
    delta: Number(snapshot.delta) || 0,
  }))

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          height: 390,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          background:
            'repeating-linear-gradient(90deg, rgba(148,163,184,0.035) 0, rgba(148,163,184,0.035) 1px, transparent 1px, transparent 72px), linear-gradient(180deg, rgba(15,23,42,0.62), rgba(2,6,23,0.35))',
          padding: '0.65rem 0.25rem 0.25rem',
          minWidth: 0,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 28, left: 8, bottom: 18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,163,184,0.24)' }}
            />
            <YAxis
              yAxisId="left"
              width={64}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,163,184,0.24)' }}
              tickFormatter={(value) => formatCompact(Number(value))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={52}
              tick={{ fill: '#34d399', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,163,184,0.24)' }}
              tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
            />
            <Tooltip
              formatter={(value, name) => {
                const numeric = Number(value)
                if (name === '수익률 % (PnL%)') return [formatPercent(numeric), name]
                if (name === 'Delta') return [formatSignedCurrency(numeric), name]
                return [formatCurrency(numeric), name]
              }}
              labelStyle={{ color: '#e5e7eb' }}
              contentStyle={{
                background: 'rgba(15,23,42,0.96)',
                border: '1px solid rgba(148,163,184,0.26)',
                borderRadius: 8,
                color: '#e5e7eb',
                fontSize: '0.75rem',
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              height={32}
              wrapperStyle={{ color: '#9ca3af', fontSize: '0.72rem' }}
            />
            <ReferenceLine yAxisId="left" y={0} stroke="rgba(148,163,184,0.24)" />
            <Bar
              yAxisId="left"
              dataKey="delta"
              name="Delta"
              fill="#93c5fd"
              opacity={0.38}
              barSize={data.length <= 14 ? 18 : 6}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalValue"
              name="총액 (Total)"
              stroke="#f8fafc"
              strokeWidth={2}
              dot={data.length <= 8 ? { r: 2, fill: '#f8fafc', strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: '#f8fafc', stroke: '#0f172a', strokeWidth: 1 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalCost"
              name="투자금 (In)"
              stroke="#ef4444"
              strokeWidth={2}
              dot={data.length <= 8 ? { r: 2, fill: '#fca5a5', strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: '#fca5a5', stroke: '#0f172a', strokeWidth: 1 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="pnl"
              name="수익금 (PnL)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={data.length <= 8 ? { r: 2, fill: '#fbbf24', strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 1 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="pnlPct"
              name="수익률 % (PnL%)"
              stroke="#34d399"
              strokeWidth={2}
              dot={data.length <= 8 ? { r: 2, fill: '#86efac', strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: '#86efac', stroke: '#0f172a', strokeWidth: 1 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
