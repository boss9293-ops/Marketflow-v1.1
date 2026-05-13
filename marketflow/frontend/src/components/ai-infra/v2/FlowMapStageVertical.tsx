'use client'
// AI 인프라 V2 — 모바일 세로 레이아웃 스테이지 섹션 (HTML/CSS 기반, 2열 노드 그리드)

import { STATE_COLORS, STATE_DISPLAY_LABELS } from '@/lib/ai-infra/aiInfraStateLabels'
import type { FlowMapStageLayout, FlowMapNodeLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import type { SymbolNodeOverlay } from './FlowMapNode'

const STAGE_SHORT: Record<string, string> = {
  STAGE_1_AI_CHIP:                    'S1 · AI CORE',
  STAGE_2_MEMORY_PACKAGING:           'S2 · MEMORY',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: 'S3 · MFG / PKG',
  STAGE_4_EXTERNAL_INFRA:             'S4 · NET / THERMAL',
  STAGE_5_PHYSICAL_RESOURCE:          'S5 · POWER / DC',
}

interface Props {
  stages:        FlowMapStageLayout[]
  selectedId:    string | null
  onSelect:      (id: string | null) => void
  getOverlay:    (bucketId: string) => SymbolNodeOverlay
  onSymbolClick: (bucketId: string, symbol: string) => void
}

const V = {
  mono:   "'IBM Plex Mono', monospace",
  ui:     "'IBM Plex Sans', sans-serif",
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  teal:   '#3FB6A8',
} as const

function retColor(v: number | null): string {
  if (v === null) return V.text3
  return v >= 0 ? '#22c55e' : '#ef4444'
}

function NodeCard({
  node, selected, onSelect, overlay, onSymbolClick,
}: {
  node:          FlowMapNodeLayout
  selected:      boolean
  onSelect:      (id: string) => void
  overlay:       SymbolNodeOverlay
  onSymbolClick: (bucketId: string, symbol: string) => void
}) {
  const col     = STATE_COLORS[node.state.state_label]
  const isInsuf = node.state.state_label === 'DATA_INSUFFICIENT'
  const { symbol, return_1w, marker_type, is_indirect, is_story_heavy } = overlay

  return (
    <div
      onClick={() => onSelect(node.bucket_id)}
      style={{
        padding: '8px 10px',
        background: selected ? `${col}14` : 'rgba(255,255,255,0.03)',
        border: `1px ${isInsuf ? 'dashed' : 'solid'} ${selected ? col : isInsuf ? V.border : `${col}55`}`,
        borderRadius: 4,
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      {/* Bucket name */}
      <div style={{
        fontFamily: V.ui, fontSize: 11, fontWeight: 600, color: V.text,
        marginBottom: 4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {node.display_name}
      </div>

      {/* State row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: col, flexShrink: 0, display: 'inline-block',
        }} />
        <span style={{
          fontFamily: V.mono, fontSize: 10, color: col, letterSpacing: '0.04em',
        }}>
          {STATE_DISPLAY_LABELS[node.state.state_label]}
        </span>
      </div>

      {/* Symbol strip */}
      {symbol && (
        <div
          onClick={e => { e.stopPropagation(); onSymbolClick(node.bucket_id, symbol) }}
          style={{
            marginTop: 6, paddingTop: 5,
            borderTop: `1px solid ${V.border}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
            <span style={{
              fontFamily: V.mono, fontSize: 11, fontWeight: 700,
              color: V.text2, letterSpacing: '0.04em',
            }}>
              {symbol}
            </span>
            {return_1w !== null && (
              <span style={{
                fontFamily: V.mono, fontSize: 11, color: retColor(return_1w),
              }}>
                {(return_1w >= 0 ? '+' : '') + return_1w.toFixed(1)}%
              </span>
            )}
            {marker_type === 'fire' && (
              <span style={{ fontSize: 11 }}>🔥</span>
            )}
            {is_story_heavy && (
              <span style={{
                fontFamily: V.mono, fontSize: 10, color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.35)', borderRadius: 2,
                padding: '0 4px', letterSpacing: '0.04em', flexShrink: 0,
              }}>
                S
              </span>
            )}
            {is_indirect && (
              <span style={{
                fontFamily: V.mono, fontSize: 10, color: V.text3,
                border: `1px solid rgba(139,144,152,0.35)`, borderRadius: 2,
                padding: '0 4px', letterSpacing: '0.04em', flexShrink: 0,
              }}>
                I
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function FlowMapStageVertical({
  stages, selectedId, onSelect, getOverlay, onSymbolClick,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {stages.map(stage => (
        <div key={stage.stage}>
          {/* Stage header */}
          <div style={{
            fontFamily: V.mono, fontSize: 11, fontWeight: 700, color: V.teal,
            letterSpacing: '0.10em', marginBottom: 6, paddingLeft: 2,
          }}>
            {STAGE_SHORT[stage.stage] ?? stage.stage}
          </div>
          <div style={{
            height: 1, background: 'rgba(63,182,168,0.15)', marginBottom: 8,
          }} />

          {/* 2-column node grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            {stage.nodes.map(node => (
              <NodeCard
                key={node.bucket_id}
                node={node}
                selected={selectedId === node.bucket_id}
                onSelect={id => onSelect(selectedId === id ? null : id)}
                overlay={getOverlay(node.bucket_id)}
                onSymbolClick={onSymbolClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
