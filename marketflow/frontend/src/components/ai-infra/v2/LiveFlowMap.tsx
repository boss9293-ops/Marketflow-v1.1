'use client'
// AI 인프라 V2 — 5-스테이지 밸류체인 흐름 시각화 (SVG)

import { useEffect, useRef, useState } from 'react'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { buildFlowMapLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import { FlowMapNode } from './FlowMapNode'
import { FlowMapConnector, FlowMapArrowDefs } from './FlowMapConnector'

const STAGE_SHORT: Record<string, string> = {
  STAGE_1_AI_CHIP:                    'S1 · AI CORE',
  STAGE_2_MEMORY_PACKAGING:           'S2 · MEMORY',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: 'S3 · MFG / PKG',
  STAGE_4_EXTERNAL_INFRA:             'S4 · NET / THERMAL',
  STAGE_5_PHYSICAL_RESOURCE:          'S5 · POWER / DC',
}

interface Props {
  states:     AIInfraBucketState[]
  selectedId: string | null
  onSelect:   (id: string | null) => void
}

export function LiveFlowMap({ states, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    if (w > 0) setWidth(w)
    const ro = new ResizeObserver(entries => {
      const cw = entries[0]?.contentRect.width
      if (cw > 0) setWidth(Math.floor(cw))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = buildFlowMapLayout(states, width)

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: 600 }}>
          <svg
            viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
            width={layout.viewBoxWidth}
            height={layout.viewBoxHeight}
            style={{ display: 'block', maxWidth: '100%' }}
          >
            <FlowMapArrowDefs />

            {/* Stage column headers */}
            {layout.stages.map(stage => (
              <text
                key={`lbl-${stage.stage}`}
                x={stage.x}
                y={stage.y + 14}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={9}
                fontWeight={700}
                fill="#3FB6A8"
                letterSpacing="0.10em"
              >
                {STAGE_SHORT[stage.stage] ?? stage.stage}
              </text>
            ))}

            {/* Stage top divider lines */}
            {layout.stages.map(stage => (
              <line
                key={`div-${stage.stage}`}
                x1={stage.x - stage.width / 2 + 4}
                y1={stage.y + 18}
                x2={stage.x + stage.width / 2 - 4}
                y2={stage.y + 18}
                stroke="rgba(63,182,168,0.15)"
                strokeWidth={1}
              />
            ))}

            {/* Connectors */}
            {layout.connectors.map((c, i) => (
              <FlowMapConnector key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} />
            ))}

            {/* Nodes */}
            {layout.stages.flatMap(stage =>
              stage.nodes.map(node => (
                <FlowMapNode
                  key={node.bucket_id}
                  node={node}
                  selected={selectedId === node.bucket_id}
                  onClick={id => onSelect(selectedId === id ? null : id)}
                />
              ))
            )}

            {states.length === 0 && (
              <text
                x={layout.viewBoxWidth / 2}
                y={layout.viewBoxHeight / 2}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={12}
                fill="#8b9098"
              >
                데이터 로드 중…
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* Selected bucket hint */}
      {selectedId && (
        <div style={{
          marginTop: 4, paddingLeft: 8,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, color: '#3FB6A8', letterSpacing: '0.06em',
        }}>
          ▸ {states.find(s => s.bucket_id === selectedId)?.display_name ?? selectedId} — 아래 전문가 탭에서 상세 확인
        </div>
      )}
    </div>
  )
}
