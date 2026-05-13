'use client'
// AI 인프라 V2 — 차트 호버 감지 오버레이 + 크로스헤어 SVG 레이어

import { useRef, useCallback } from 'react'
import { findNearestPricePoint } from '@/lib/ai-infra/v2/findNearestPricePoint'
import type { PricePoint } from '@/lib/ai-infra/v2/findNearestPricePoint'
import type { TooltipData } from './ChartTooltip'

interface Props {
  W:         number
  H:         number
  PAD:       number
  series:    PricePoint[]
  lineColor: string
  hoverData: TooltipData | null
  onHover:   (data: TooltipData | null) => void
}

export function ChartHoverLayer({ W, H, PAD, series, lineColor, hoverData, onHover }: Props) {
  const rectRef     = useRef<SVGRectElement>(null)
  const touchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const computeHover = useCallback((
    clientX: number,
    clientY: number,
    isTouch: boolean,
  ): TooltipData | null => {
    const svgEl = rectRef.current?.ownerSVGElement
    if (!svgEl) return null
    const rect = svgEl.getBoundingClientRect()
    if (rect.width === 0) return null

    const scaleX = W / rect.width
    const domX   = clientX - rect.left
    const domY   = clientY - rect.top
    const svgX   = domX * scaleX

    const nearest = findNearestPricePoint(svgX, W, H, PAD, series)
    if (!nearest) return null

    const startPrice = series[0].close
    const returnPct  = startPrice !== 0
      ? ((nearest.point.close - startPrice) / startPrice) * 100
      : 0

    return {
      date:        nearest.point.date,
      price:       nearest.point.close,
      returnPct,
      domX,
      domY,
      svgX:        nearest.svgX,
      svgY:        nearest.svgY,
      isRightHalf: domX > rect.width / 2,
      isTouch,
    }
  }, [W, H, PAD, series])

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    onHover(computeHover(e.clientX, e.clientY, false))
  }

  function handleMouseLeave() {
    onHover(null)
  }

  function handleTouchStart(e: React.TouchEvent<SVGRectElement>) {
    e.preventDefault()
    if (touchTimer.current) clearTimeout(touchTimer.current)
    const t = e.touches[0]
    if (t) onHover(computeHover(t.clientX, t.clientY, true))
  }

  function handleTouchMove(e: React.TouchEvent<SVGRectElement>) {
    e.preventDefault()
    const t = e.touches[0]
    if (t) onHover(computeHover(t.clientX, t.clientY, true))
  }

  function handleTouchEnd() {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => onHover(null), 3000)
  }

  return (
    <g>
      {/* 크로스헤어 + 포인트 마커 */}
      {hoverData && (
        <>
          <line
            x1={hoverData.svgX} y1={PAD}
            x2={hoverData.svgX} y2={H - PAD}
            stroke="rgba(255,255,255,0.30)"
            strokeWidth={1}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
          <circle
            cx={hoverData.svgX}
            cy={hoverData.svgY}
            r={4}
            fill={lineColor}
            stroke="#14181f"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        </>
      )}

      {/* 투명 이벤트 캡처 레이어 */}
      <rect
        ref={rectRef}
        x={PAD}
        y={PAD}
        width={W - PAD * 2}
        height={H - PAD * 2}
        fill="transparent"
        style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </g>
  )
}
