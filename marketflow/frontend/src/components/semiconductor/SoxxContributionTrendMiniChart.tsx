'use client'

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SoxxContributionTrendSeriesPoint } from '@/lib/semiconductor/soxxContributionHistory'


export type SoxxContributionTrendMiniChartProps = {
  data: SoxxContributionTrendSeriesPoint[]
  periodLabel?: string
  helpTitle?: string
}

function formatPctPoint(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%p`
}

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export function SoxxContributionTrendMiniChart({
  data,
  periodLabel = '1D',
  helpTitle,
}: SoxxContributionTrendMiniChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="pb-2.5 border-b border-slate-800/60">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }} title={helpTitle}>
          Contribution Trend
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-[1.6]">
          Contribution trend unavailable. Historical price data is not connected yet.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-2.5 border-b border-slate-800/60">
      <div className="mb-2 flex items-center justify-between gap-[14px]">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }} title={helpTitle}>
            Contribution Trend
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Selected vs Residual - {periodLabel}
          </div>
        </div>
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                typeof value === 'number' ? value.toFixed(1) : ''
              }
              width={28}
            />
            <Tooltip
              formatter={(value) => formatPctPoint(value)}
              contentStyle={{
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: 8,
                color: '#cbd5e1',
                fontSize: 11,
              }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="selected_total"
              name="Selected Total"
              stroke="#38bdf8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="residual"
              name="Residual"
              stroke="#94a3b8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 leading-[1.6]">
        Backward-looking contribution trend. Unit: %p. Not a forecast.
      </p>
    </div>
  )
}
