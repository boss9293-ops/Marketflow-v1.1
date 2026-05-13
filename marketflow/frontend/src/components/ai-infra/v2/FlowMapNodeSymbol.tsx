// AI 인프라 V2 — FlowMap 노드 종목 서브행 (SVG — 티커 + 1주 수익률 + 🔥 마커)

import { fmtReturn, returnColor } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import type { MarkerType } from '@/lib/ai-infra/v2/buildMoversMarker'
import { MoversMarker } from './MoversMarker'

interface Props {
  nodeX:         number
  y:             number
  nodeWidth:     number
  symbol:        string
  return_1w:     number | null
  marker_type:   MarkerType
  is_indirect:   boolean
  is_story_heavy: boolean
  onSymbolClick: () => void
}

export function FlowMapNodeSymbol({
  nodeX, y, nodeWidth,
  symbol, return_1w, marker_type,
  is_indirect, is_story_heavy,
  onSymbolClick,
}: Props) {
  const retStr  = fmtReturn(return_1w)
  const retCol  = returnColor(return_1w)
  const hasFire = marker_type === 'fire'

  const labelColor = is_story_heavy ? '#fbbf24' : is_indirect ? '#8b9098' : '#B8C8DC'

  return (
    <g
      onClick={e => { e.stopPropagation(); onSymbolClick() }}
      style={{ cursor: 'pointer' }}
    >
      {/* Separator line */}
      <line
        x1={nodeX + 6}
        y1={y}
        x2={nodeX + nodeWidth - 6}
        y2={y}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={0.5}
      />
      {/* Ticker */}
      <text
        x={nodeX + 8}
        y={y + 12}
        fontFamily="'IBM Plex Mono', monospace"
        fontSize={11}
        fontWeight={700}
        fill={labelColor}
        style={{ textDecoration: 'underline', textDecorationColor: 'rgba(184,200,220,0.3)' }}
      >
        {symbol}
      </text>
      {/* Return */}
      <text
        x={nodeX + nodeWidth - (hasFire ? 22 : 8)}
        y={y + 12}
        fontFamily="'IBM Plex Mono', monospace"
        fontSize={10}
        fill={retCol}
        textAnchor="end"
      >
        {retStr}
      </text>
      {/* 🔥 Marker */}
      {hasFire && (
        <MoversMarker
          marker_type={marker_type}
          x={nodeX + nodeWidth - 18}
          y={y + 12}
        />
      )}
    </g>
  )
}
