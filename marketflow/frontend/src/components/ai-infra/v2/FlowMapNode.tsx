// AI 인프라 V2 — FlowMap 버킷 노드 (순수 SVG rect + text, 종목 서브행 포함)

import { STATE_COLORS, STATE_DISPLAY_LABELS } from '@/lib/ai-infra/aiInfraStateLabels'
import type { FlowMapNodeLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import type { MarkerType } from '@/lib/ai-infra/v2/buildMoversMarker'
import { FlowMapNodeSymbol } from './FlowMapNodeSymbol'

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

// Split long bucket names into two lines (for names > 20 chars)
function splitName(name: string): [string, string | null] {
  if (name.length <= 20) return [name, null]
  const mid = Math.floor(name.length / 2)
  let spaceIdx = -1
  for (let r = 0; r <= 8; r++) {
    if (mid - r > 0 && name[mid - r] === ' ') { spaceIdx = mid - r; break }
    if (mid + r < name.length && name[mid + r] === ' ') { spaceIdx = mid + r; break }
  }
  if (spaceIdx === -1) {
    return [name.slice(0, 19) + '…', null]
  }
  const l1 = name.slice(0, spaceIdx)
  const l2 = name.slice(spaceIdx + 1)
  return [
    l1.length > 20 ? l1.slice(0, 19) + '…' : l1,
    l2.length > 20 ? l2.slice(0, 19) + '…' : l2,
  ]
}

export function FlowMapNode({ node, selected, onClick, symbolOverlay, onSymbolClick }: Props) {
  const { state } = node
  const col     = STATE_COLORS[state.state_label]
  const isInsuf = state.state_label === 'DATA_INSUFFICIENT'
  const hasSymbol = !!symbolOverlay?.symbol

  const [line1, line2] = splitName(node.display_name)
  const isTwoLine = line2 !== null

  // Y offsets relative to node.y
  const bucketY1   = node.y + 18
  const bucketY2   = node.y + 34
  const dotCY      = isTwoLine ? node.y + 52 : node.y + 40
  const labelY     = dotCY + 4
  const symbolRowY = isTwoLine ? node.y + 70 : node.y + 56

  return (
    <g role="button" aria-label={node.display_name}>
      {/* Node background */}
      <g onClick={() => onClick(node.bucket_id)} style={{ cursor: 'pointer' }}>
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={4} ry={4}
          fill={selected ? `${col}1e` : 'rgba(255,255,255,0.04)'}
          stroke={selected ? col : isInsuf ? 'rgba(255,255,255,0.10)' : `${col}55`}
          strokeWidth={selected ? 1.5 : 1}
          strokeDasharray={isInsuf ? '3 2' : undefined}
        />

        {/* SVG tooltip for full name */}
        <title>{node.display_name}</title>

        {/* Bucket name — line 1 */}
        <text
          x={node.x + 10}
          y={bucketY1}
          fontFamily="'IBM Plex Sans', sans-serif"
          fontSize={14}
          fontWeight={600}
          fill="#E8F0F8"
        >
          {line1}
        </text>

        {/* Bucket name — line 2 (if needed) */}
        {isTwoLine && (
          <text
            x={node.x + 10}
            y={bucketY2}
            fontFamily="'IBM Plex Sans', sans-serif"
            fontSize={14}
            fontWeight={600}
            fill="#E8F0F8"
          >
            {line2}
          </text>
        )}

        {/* State dot */}
        <circle cx={node.x + 12} cy={dotCY} r={4} fill={col} />

        {/* State label */}
        <text
          x={node.x + 22}
          y={labelY}
          fontFamily="'IBM Plex Mono', monospace"
          fontSize={12}
          fill={col}
          letterSpacing="0.04em"
        >
          {STATE_DISPLAY_LABELS[state.state_label]}
        </text>

        {/* Score — only when no symbol */}
        {state.state_score != null && !hasSymbol && (
          <text
            x={node.x + node.width - 8}
            y={labelY}
            fontFamily="'IBM Plex Mono', monospace"
            fontSize={12}
            fill="#8b9098"
            textAnchor="end"
          >
            {state.state_score}
          </text>
        )}
      </g>

      {/* Symbol sub-row */}
      {hasSymbol && (
        <FlowMapNodeSymbol
          nodeX={node.x}
          y={symbolRowY}
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
