// AI 인프라 V2 — 🔥 모버스 마커 SVG 렌더러

import type { MarkerType } from '@/lib/ai-infra/v2/buildMoversMarker'

interface Props {
  marker_type: MarkerType
  x:           number
  y:           number
}

export function MoversMarker({ marker_type, x, y }: Props) {
  if (marker_type !== 'fire') return null
  return (
    <text
      x={x}
      y={y}
      fontSize={11}
      style={{ userSelect: 'none', pointerEvents: 'none' }}
    >
      🔥
    </text>
  )
}
