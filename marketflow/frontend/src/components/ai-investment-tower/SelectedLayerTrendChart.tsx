'use client'
// 선택된 AI Investment Tower 레이어 바스켓 트렌드 차트 — 정규화 100 기준 비교

import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { LayerTrendResponse } from '@/app/api/ai-investment-tower/layer-trend/route'

type Range = '1M' | '3M' | '6M' | '1Y'

const RANGES: Range[] = ['1M', '3M', '6M', '1Y']

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  // 'YYYY-MM-DD' → 'M/D'
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

function interpretPerformance(
  basketLast: number | undefined,
  bmLast: number | undefined,
): string | null {
  if (basketLast === undefined || bmLast === undefined) return null
  const diff = basketLast - bmLast
  if (diff > 4)  return '선택한 레이어가 기준 지수보다 강하게 움직이고 있습니다.'
  if (diff < -4) return '선택한 레이어가 기준 지수보다 약하게 움직이고 있습니다.'
  return '선택한 레이어와 기준 지수의 흐름이 비슷합니다.'
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

type TooltipPayloadItem = {
  name: string
  value: number
  color: string
  dataKey: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{
      background:   '#1a1e27',
      border:       `1px solid ${V.border}`,
      borderRadius: 6,
      padding:      '8px 12px',
      fontFamily:   V.mono,
      fontSize:     11,
      lineHeight:   1.8,
    }}>
      <div style={{ color: V.text3, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SelectedLayerTrendChart({
  layerId,
  koreanLabel,
}: {
  layerId:     string
  koreanLabel: string
}) {
  const [range, setRange]   = useState<Range>('3M')
  const [data, setData]     = useState<LayerTrendResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!layerId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/ai-investment-tower/layer-trend?layerId=${encodeURIComponent(layerId)}&range=${range}`)
      .then(r => r.json())
      .then((json: LayerTrendResponse) => {
        if (!cancelled) { setData(json); setLoading(false) }
      })
      .catch(() => {
        if (!cancelled) { setError('데이터를 불러오지 못했습니다.'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [layerId, range])

  // ── Merge basket + benchmark by date ──────────────────────────────────────

  const chartData = (() => {
    if (!data) return []
    const allDates = new Set([
      ...data.basket.points.map(p => p.date),
      ...(data.benchmark?.points.map(p => p.date) ?? []),
    ])
    const bMap  = new Map(data.basket.points.map(p => [p.date, p.value]))
    const bmMap = new Map(data.benchmark?.points.map(p => [p.date, p.value]) ?? [])
    return Array.from(allDates)
      .sort()
      .map(date => ({
        date,
        label:     fmtDate(date),
        basket:    bMap.get(date)  ?? null,
        benchmark: bmMap.get(date) ?? null,
      }))
  })()

  const basketLast    = data?.basket.points.at(-1)?.value
  const bmLast        = data?.benchmark?.points.at(-1)?.value
  const interpretation = interpretPerformance(basketLast, bmLast)

  const noBasketData = !loading && data !== null && data.basket.points.length === 0

  // ── Range buttons ────────────────────────────────────────────────────────

  const RangeButton = ({ r }: { r: Range }) => (
    <button
      onClick={() => setRange(r)}
      style={{
        fontFamily:   V.mono,
        fontSize:     11,
        padding:      '2px 10px',
        borderRadius: 4,
        border:       `1px solid ${range === r ? V.teal : V.border}`,
        background:   range === r ? `${V.teal}18` : 'transparent',
        color:        range === r ? V.teal : V.text3,
        cursor:       'pointer',
        letterSpacing:'0.06em',
      }}
    >
      {r}
    </button>
  )

  return (
    <div style={{
      background:   V.bg2,
      border:       `1px solid ${V.border}`,
      borderRadius: 6,
      marginBottom: 16,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '9px 16px 8px',
        borderBottom: `1px solid ${V.border}`,
      }}>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', flex: 1 }}>
          TREND — {koreanLabel || (data?.koreanLabel ?? '')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => <RangeButton key={r} r={r} />)}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ padding: '8px 4px 0' }}>
        {loading && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
            데이터를 불러오는 중...
          </div>
        )}

        {error && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
            {error}
          </div>
        )}

        {noBasketData && !loading && !error && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
            이 레이어의 차트 데이터가 아직 충분하지 않습니다.
          </div>
        )}

        {!loading && !error && !noBasketData && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: V.text2, fontFamily: 'IBM Plex Mono' }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: V.border }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: V.text2, fontFamily: 'IBM Plex Mono' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(0)}
                width={48}
              />
              <ReferenceLine y={100} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="basket"
                name={data?.koreanLabel ?? '바스켓'}
                stroke={V.teal}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              {data?.benchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name={data.benchmark.symbol}
                  stroke={V.text2}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: legend + interpretation */}
      {!loading && data && !noBasketData && (
        <div style={{
          padding:    '6px 16px 10px',
          display:    'flex',
          flexWrap:   'wrap',
          alignItems: 'center',
          gap:        12,
        }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 16, height: 2, background: V.teal }} />
              바스켓
            </span>
            {data.benchmark && (
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: `2px dashed ${V.text2}` }} />
                {data.benchmark.symbol}
              </span>
            )}
            <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2 }}>
              기준: 100 (시작일 정규화)
            </span>
          </div>
          {/* Interpretation */}
          {interpretation && (
            <span style={{
              fontFamily: V.ui,
              fontSize:   12,
              color:      V.text2,
              flex:       1,
              minWidth:   0,
            }}>
              {interpretation}
            </span>
          )}
          {/* Coverage note */}
          {data.coveragePct < 1 && (
            <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text2 }}>
              커버리지 {Math.round(data.coveragePct * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
