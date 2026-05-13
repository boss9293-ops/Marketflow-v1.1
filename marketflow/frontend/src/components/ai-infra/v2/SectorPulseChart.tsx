'use client'
// AI 인프라 V2 — Sector Pulse Card Section B: 90일 가격 추이 SVG 라인 차트 (툴팁 포함)

import { useState } from 'react'
import { buildPriceSeries } from '@/lib/ai-infra/v2/findNearestPricePoint'
import { ChartHoverLayer } from './ChartHoverLayer'
import { ChartTooltip } from './ChartTooltip'
import type { TooltipData } from './ChartTooltip'

const V = {
  text: '#f1f5f9', text2: '#cbd5e1', text3: '#94a3b8',
  positive: '#22c55e', negative: '#ef4444',
  border: 'rgba(148,163,184,0.24)',
  ui: "Inter, Pretendard, 'Noto Sans KR', sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
} as const

interface Props {
  symbol: string | null
  prices: number[]
  asOf?:  string | null
}

const W   = 360
const H   = 130
const PAD = 8

function buildLinePath(prices: number[], width: number, height: number, pad: number): string {
  if (prices.length < 2) return ''
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1
  const innerW = width  - pad * 2
  const innerH = height - pad * 2
  return prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * innerW
    const y = pad + innerH - ((p - min) / range) * innerH
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function buildAreaPath(prices: number[], width: number, height: number, pad: number): string {
  const line = buildLinePath(prices, width, height, pad)
  if (!line) return ''
  return `${line} L ${(width - pad).toFixed(2)} ${(height - pad).toFixed(2)} L ${pad.toFixed(2)} ${(height - pad).toFixed(2)} Z`
}

export function SectorPulseChart({ symbol, prices, asOf }: Props) {
  const [hoverData, setHoverData] = useState<TooltipData | null>(null)

  if (!symbol || prices.length < 2) {
    return (
      <div style={{
        padding: 14, border: `1px solid ${V.border}`, borderRadius: 4,
        background: 'rgba(255,255,255,0.02)', minHeight: H,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: V.mono, fontSize: 10, color: V.text3,
          letterSpacing: '0.10em', marginBottom: 6,
        }}>
          90일 가격 흐름
        </div>
        <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
          차트 데이터 준비 중
        </div>
      </div>
    )
  }

  const first     = prices[0]
  const last      = prices[prices.length - 1]
  const changePct = ((last - first) / first) * 100
  const isUp      = changePct >= 0
  const lineCol   = isUp ? V.positive : V.negative
  const gradId    = `pulse-gradient-${symbol}`
  const series    = buildPriceSeries(prices, asOf ?? null)

  return (
    <div style={{
      position: 'relative',
      padding: 12, border: `1px solid ${V.border}`, borderRadius: 4,
      background: 'rgba(255,255,255,0.02)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div>
          <div style={{
            fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em',
          }}>
            90일 가격 흐름
          </div>
          <div style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, marginTop: 2 }}>
            대표 추적 종목: <span style={{ color: V.text, fontWeight: 700 }}>{symbol}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: V.mono, fontSize: 14, fontWeight: 700, color: lineCol }}>
            {(changePct >= 0 ? '+' : '') + changePct.toFixed(1)}%
          </div>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em', marginTop: 1 }}>
            / 90D
          </div>
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        aria-label="가격 추이 차트, 90일"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineCol} stopOpacity={0.28} />
            <stop offset="100%" stopColor={lineCol} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <line
          x1={PAD} y1={H - PAD}
          x2={W - PAD} y2={H - PAD}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
        <path d={buildAreaPath(prices, W, H, PAD)} fill={`url(#${gradId})`} />
        <path
          d={buildLinePath(prices, W, H, PAD)}
          fill="none"
          stroke={lineCol}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <ChartHoverLayer
          W={W} H={H} PAD={PAD}
          series={series}
          lineColor={lineCol}
          hoverData={hoverData}
          onHover={setHoverData}
        />
      </svg>

      {hoverData && <ChartTooltip data={hoverData} />}

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em',
      }}>
        <span>{prices.length}D</span>
        <span>가격 추이 (투자 신호 아님)</span>
        {asOf && <span>{asOf}</span>}
      </div>
    </div>
  )
}
