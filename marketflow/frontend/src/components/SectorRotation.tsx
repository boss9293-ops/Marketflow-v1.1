'use client'

import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { clientApiUrl } from '@/lib/backendApi'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'

interface SectorRow {
  symbol: string
  name: string
  price: number
  change_1d: number
  change_1w: number
  change_1m: number
  change_3m: number
  change_6m: number
  change_1y: number
}

interface SectorPerformanceResponse {
  timestamp: string
  sectors: SectorRow[]
}

type PerfKey = 'change_1d' | 'change_1w' | 'change_1m' | 'change_3m' | 'change_6m' | 'change_1y'

type ChartRow = SectorRow & {
  barValue: number
  signedValue: number
}

function sortByKey(data: SectorRow[], key: PerfKey) {
  return [...data].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
}

function chartPanelStyle(): CSSProperties {
  return {
    background: 'linear-gradient(180deg, rgba(31, 35, 46, 0.98) 0%, rgba(24, 28, 37, 0.98) 100%)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
    padding: '1rem 1rem 1.1rem',
    width: '80%',
    margin: '0 auto',
    boxSizing: 'border-box',
  }
}

function formatAxisPct(value: number) {
  if (!Number.isFinite(value)) return '--'
  const rounded = Number(value.toFixed(1))
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}

function getTickStep(maxValue: number) {
  if (maxValue <= 3) return 0.5
  if (maxValue <= 6) return 1
  if (maxValue <= 12) return 2
  if (maxValue <= 25) return 5
  return 10
}

function buildAxisTicks(maxValue: number) {
  const step = getTickStep(maxValue)
  const axisMax = Math.max(step, Math.ceil(maxValue / step) * step)
  const tickCount = Math.round(axisMax / step)
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => Number((index * step).toFixed(2)))
  return { axisMax, ticks }
}

function SignedValueLabel({ x, y, width, height, value }: any) {
  const signedValue = typeof value === 'number' ? value : null

  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof width !== 'number'
    || typeof height !== 'number'
    || typeof signedValue !== 'number'
  ) {
    return null
  }

  const labelX = x + width + 6

  return (
    <text
      x={labelX}
      y={y + height / 2}
      fill="#ffffff"
      fontSize={12}
      fontWeight={700}
      dominantBaseline="middle"
      textAnchor="start"
      style={{
        paintOrder: 'stroke',
        stroke: 'rgba(17, 24, 39, 0.88)',
        strokeWidth: 3,
      }}
    >
      <tspan>{`${signedValue > 0 ? '+' : ''}${signedValue.toFixed(2)}`}</tspan>
      <tspan dx={1} fontSize={11}>%</tspan>
    </text>
  )
}

function PerformanceChart({
  title,
  data,
  dataKey,
}: {
  title: string
  data: SectorRow[]
  dataKey: PerfKey
}) {
  const positiveGradientId = `sector-positive-${dataKey}`
  const negativeGradientId = `sector-negative-${dataKey}`

  const chartData = useMemo<ChartRow[]>(() => {
    return data.map((entry) => {
      const signedValue = entry[dataKey] ?? 0
      return {
        ...entry,
        barValue: Math.abs(signedValue),
        signedValue,
      }
    })
  }, [data, dataKey])

  const { ticks } = useMemo(() => buildAxisTicks(
    chartData.reduce((max, entry) => Math.max(max, entry.barValue), 0),
  ), [chartData])

  return (
    <div style={chartPanelStyle()}>
      <h2 style={{ textAlign: 'left', color: '#d1d5db', fontWeight: 800, letterSpacing: '0.08em', fontSize: '1rem', marginBottom: '0.85rem' }}>
        {title}
      </h2>

      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 56, left: 10, bottom: 10 }}
            barCategoryGap="24%"
          >
            <defs>
              <linearGradient id={positiveGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.82} />
              </linearGradient>
              <linearGradient id={negativeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.82} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 4" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 'dataMax + 0.3']}
              ticks={ticks}
              tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
              tickFormatter={formatAxisPct}
              axisLine={false}
              tickLine={false}
              allowDecimals
            />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tick={{ fill: '#cbd5e1', fontSize: 13, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
            />
            <Bar dataKey="barValue" radius={6} minPointSize={3}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.symbol}-${index}`}
                  fill={entry.signedValue >= 0 ? `url(#${positiveGradientId})` : `url(#${negativeGradientId})`}
                />
              ))}
              <LabelList dataKey="signedValue" content={SignedValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// clientApiUrl() is used inline: /api/flask proxy in production, localhost in dev

export default function SectorRotation() {
  const [data, setData] = useState<SectorPerformanceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(clientApiUrl('/api/sector-performance'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  const rows = data?.sectors || []
  const data1d = useMemo(() => sortByKey(rows, 'change_1d'), [rows])
  const data1w = useMemo(() => sortByKey(rows, 'change_1w'), [rows])
  const data1m = useMemo(() => sortByKey(rows, 'change_1m'), [rows])
  const data3m = useMemo(() => sortByKey(rows, 'change_3m'), [rows])
  const data6m = useMemo(() => sortByKey(rows, 'change_6m'), [rows])
  const data1y = useMemo(() => sortByKey(rows, 'change_1y'), [rows])

  if (error) {
    return (
      <div style={{ color: '#f87171', fontSize: '0.95rem', padding: '1rem', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10 }}>
        Failed to load sector performance: {error}
      </div>
    )
  }

  if (!data) {
    return <div style={{ color: '#9ca3af', padding: '2rem 0', textAlign: 'center' }}>Loading sector rotation...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PerformanceChart title="1 DAY PERFORMANCE"   data={data1d} dataKey="change_1d" />
      <PerformanceChart title="1 WEEK PERFORMANCE"  data={data1w} dataKey="change_1w" />
      <PerformanceChart title="1 MONTH PERFORMANCE" data={data1m} dataKey="change_1m" />
      <PerformanceChart title="3 MONTH PERFORMANCE" data={data3m} dataKey="change_3m" />
      <PerformanceChart title="HALF YEAR PERFORMANCE" data={data6m} dataKey="change_6m" />
      <PerformanceChart title="1 YEAR PERFORMANCE"  data={data1y} dataKey="change_1y" />
    </div>
  )
}
