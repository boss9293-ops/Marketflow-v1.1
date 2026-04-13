'use client'

import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'

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

function sortByKey(data: SectorRow[], key: PerfKey) {
  return [...data].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
}

function chartPanelStyle(): CSSProperties {
  return {
    background: '#1a1a1a',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1rem 1rem 1.1rem',
  }
}

function formatPct(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
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
  return (
    <div style={chartPanelStyle()}>
      <h2 style={{ textAlign: 'center', color: '#d1d5db', fontWeight: 800, letterSpacing: '0.08em', fontSize: '1rem', marginBottom: '0.85rem' }}>
        {title}
      </h2>

      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 18, right: 44, top: 10, bottom: 10 }}
          >
            <XAxis
              type="number"
              stroke="#666"
              tick={{ fill: '#999', fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#666"
              tick={{ fill: '#d1d5db', fontSize: 12 }}
              width={142}
            />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.symbol}-${index}`}
                  fill={entry[dataKey] >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
              <LabelList
                dataKey={dataKey}
                position="right"
                formatter={(value: number) => formatPct(value)}
                style={{ fill: '#ffffff', fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

export default function SectorRotation() {
  const [data, setData] = useState<SectorPerformanceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/sector-performance`)
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
