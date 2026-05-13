'use client'
// AI 인프라 V2 — 종목 미니카드용 90일 가격 추이 SVG 라인 차트 (툴팁 포함)

import { useState } from 'react'
import { buildSymbolChartData } from '@/lib/ai-infra/v2/buildSymbolChartData'
import { buildPriceSeries } from '@/lib/ai-infra/v2/findNearestPricePoint'
import { ChartHoverLayer } from './ChartHoverLayer'
import { ChartTooltip } from './ChartTooltip'
import type { TooltipData } from './ChartTooltip'

const V = {
  text3:  '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  mono:   "'IBM Plex Mono', monospace",
  ui:     "'IBM Plex Sans', sans-serif",
} as const

interface Props {
  symbol: string | null
  prices: number[]
  asOf?:  string | null
}

const W   = 440
const H   = 120
const PAD = 8

export function SymbolMiniChart({ symbol, prices, asOf }: Props) {
  const [hoverData, setHoverData] = useState<TooltipData | null>(null)

  if (!symbol || prices.length < 2) {
    return (
      <div style={{
        height: H,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: `1px solid ${V.border}`,
      }}>
        <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
          차트 데이터 준비 중
        </span>
      </div>
    )
  }

  const { linePath, areaPath, lineColor, changePct, gradientId } =
    buildSymbolChartData(symbol, prices, W, H, PAD)
  const series = buildPriceSeries(prices, asOf ?? null)

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(255,255,255,0.02)',
      borderBottom: `1px solid ${V.border}`,
    }}>
      {/* 90D label — top-left */}
      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 1, pointerEvents: 'none',
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em',
      }}>
        90D PRICE
      </div>

      {/* Change % — top-right (호버 중 숨김) */}
      {changePct !== null && !hoverData && (
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 1, pointerEvents: 'none',
          fontFamily: V.mono, fontSize: 13, fontWeight: 700, color: lineColor,
        }}>
          {(changePct >= 0 ? '+' : '') + changePct.toFixed(1)}%
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        aria-label="가격 추이 차트, 90일"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <line
          x1={PAD} y1={H - PAD}
          x2={W - PAD} y2={H - PAD}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <ChartHoverLayer
          W={W} H={H} PAD={PAD}
          series={series}
          lineColor={lineColor}
          hoverData={hoverData}
          onHover={setHoverData}
        />
      </svg>

      {hoverData && <ChartTooltip data={hoverData} />}

      {/* Disclaimer — bottom-right */}
      <div style={{
        position: 'absolute', bottom: 4, right: 12, pointerEvents: 'none',
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em',
      }}>
        가격 추이 (투자 신호 아님)
      </div>
    </div>
  )
}
