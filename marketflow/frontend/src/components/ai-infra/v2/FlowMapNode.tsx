// AI 인프라 V2 — FlowMap 버킷 노드 (순수 SVG rect + text, 종목 서브행 포함)

import { STATE_COLORS, STATE_DISPLAY_LABELS } from '@/lib/ai-infra/aiInfraStateLabels'
import type { FlowMapNodeLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import type { MarkerType } from '@/lib/ai-infra/v2/buildMoversMarker'
import { FlowMapNodeSymbol } from './FlowMapNodeSymbol'

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export interface SymbolNodeOverlay {
  symbol:         string | null
  return_1w:      number | null
  marker_type:    MarkerType
  is_indirect:    boolean
  is_story_heavy: boolean
}

interface Props {
  node:           FlowMapNodeLayout
  selected:       boolean
  onClick:        (bucketId: string) => void
  symbolOverlay?: SymbolNodeOverlay
  onSymbolClick?: (bucketId: string, symbol: string) => void
}

export function FlowMapNode({ node, selected, onClick, symbolOverlay, onSymbolClick }: Props) {
  const { state } = node
  const col     = STATE_COLORS[state.state_label]
  const isInsuf = state.state_label === 'DATA_INSUFFICIENT'
  const hasSymbol = !!symbolOverlay?.symbol

  return (
    <g role="button" aria-label={node.display_name}>
      {/* Node background (clicking this highlights the node) */}
      <g onClick={() => onClick(node.bucket_id)} style={{ cursor: 'pointer' }}>
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={4}
          ry={4}
          fill={selected ? `${col}1e` : 'rgba(255,255,255,0.04)'}
          stroke={selected ? col : isInsuf ? 'rgba(255,255,255,0.10)' : `${col}55`}
          strokeWidth={selected ? 1.5 : 1}
          strokeDasharray={isInsuf ? '3 2' : undefined}
        />
        {/* Bucket name */}
        <text
          x={node.x + 8}
          y={node.y + 15}
          fontFamily="'IBM Plex Sans', sans-serif"
          fontSize={11}
          fontWeight={600}
          fill="#E8F0F8"
        >
          {trunc(node.display_name, 18)}
        </text>
        {/* State dot */}
        <circle cx={node.x + 11} cy={node.y + 28} r={2.5} fill={col} />
        {/* State label */}
        <text
          x={node.x + 19}
          y={node.y + 31}
          fontFamily="'IBM Plex Mono', monospace"
          fontSize={10}
          fill={col}
          letterSpacing="0.04em"
        >
          {STATE_DISPLAY_LABELS[state.state_label]}
        </text>
        {/* Score — only shown when no symbol (avoids crowding) */}
        {state.state_score != null && !hasSymbol && (
          <text
            x={node.x + node.width - 6}
            y={node.y + 31}
            fontFamily="'IBM Plex Mono', monospace"
            fontSize={10}
            fill="#8b9098"
            textAnchor="end"
          >
            {state.state_score}
          </text>
        )}
      </g>

      {/* Symbol sub-row — separate click handler (stopPropagation inside) */}
      {hasSymbol && (
        <FlowMapNodeSymbol
          nodeX={node.x}
          y={node.y + 38}
          nodeWidth={node.width}
          symbol={symbolOverlay!.symbol!}
          return_1w={symbolOverlay!.return_1w}
          marker_type={symbolOverlay!.marker_type}
          is_indirect={symbolOverlay!.is_indirect}
          is_story_heavy={symbolOverlay!.is_story_heavy}
          onSymbolClick={() => onSymbolClick?.(node.bucket_id, symbolOverlay!.symbol!)}
        />
      )}
    </g>
  )
}
