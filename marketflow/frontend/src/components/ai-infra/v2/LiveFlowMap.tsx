'use client'
// AI 인프라 V2 — 5-스테이지 밸류체인 흐름 시각화 (SVG, 종목 미니카드 포함)

import { useEffect, useRef, useState } from 'react'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type { AIInfraEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { buildFlowMapLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import { buildLeadSymbolMap } from '@/lib/ai-infra/v2/leadSymbolResolver'
import { getSymbolReturn } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { buildMoversMarker } from '@/lib/ai-infra/v2/buildMoversMarker'
import type { SymbolReturnsMap } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { FlowMapNode } from './FlowMapNode'
import type { SymbolNodeOverlay } from './FlowMapNode'
import { FlowMapConnector, FlowMapArrowDefs } from './FlowMapConnector'
import { SymbolMiniCard } from './SymbolMiniCard'
import type { SymbolMiniCardData } from './SymbolMiniCard'
import { SectorPulseCard } from './SectorPulseCard'
import type { AIInfraBucketEarningsConfirmation } from '@/lib/ai-infra/aiInfraEarningsConfirmation'

const STAGE_SHORT: Record<string, string> = {
  STAGE_1_AI_CHIP:                    'S1 · AI CORE',
  STAGE_2_MEMORY_PACKAGING:           'S2 · MEMORY',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: 'S3 · MFG / PKG',
  STAGE_4_EXTERNAL_INFRA:             'S4 · NET / THERMAL',
  STAGE_5_PHYSICAL_RESOURCE:          'S5 · POWER / DC',
}

interface Props {
  states:             AIInfraBucketState[]
  selectedId:         string | null
  onSelect:           (id: string | null) => void
  symbolReturns:      SymbolReturnsMap
  symbolPriceSeries:  Record<string, number[]>
  earningsCompanies:  AIInfraEarningsEvidence[]
  earningsBuckets:    AIInfraBucketEarningsConfirmation[]
  companyPurity:      AIInfraCompanyPurityMetadata[]
  asOf?:              string | null
}

export function LiveFlowMap({
  states, selectedId, onSelect,
  symbolReturns, symbolPriceSeries,
  earningsCompanies, earningsBuckets, companyPurity,
  asOf,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [activeMiniCard, setActiveMiniCard] = useState<SymbolMiniCardData | null>(null)

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

  const layout   = buildFlowMapLayout(states, width)
  const leadMap  = buildLeadSymbolMap(companyPurity, earningsCompanies)

  function getOverlay(bucketId: string): SymbolNodeOverlay {
    const lead = leadMap.get(bucketId)
    const ret  = getSymbolReturn(lead?.symbol ?? null, symbolReturns)
    const mark = buildMoversMarker(ret.five_day)
    return {
      symbol:         lead?.symbol         ?? null,
      return_1w:      ret.five_day,
      marker_type:    mark.marker_type,
      is_indirect:    lead?.is_indirect    ?? false,
      is_story_heavy: lead?.is_story_heavy ?? false,
    }
  }

  function handleSymbolClick(bucketId: string, symbol: string) {
    const state       = states.find(s => s.bucket_id === bucketId)
    const lead        = leadMap.get(bucketId)
    const ret         = getSymbolReturn(symbol, symbolReturns)
    const mark        = buildMoversMarker(ret.five_day)
    const earnings    = earningsCompanies.find(e => e.symbol === symbol)
    const purityEntry = companyPurity.find(c => c.symbol === symbol)

    setActiveMiniCard({
      symbol,
      company_name:       lead?.company_name ?? symbol,
      bucket_label:       state?.display_name ?? bucketId,
      return_1w:          ret.five_day,
      return_1m:          ret.one_month,
      return_3m:          ret.three_month,
      prices:             symbolPriceSeries[symbol] ?? [],
      marker_type:        mark.marker_type,
      confirmation_level: earnings?.confirmation_level,
      evidence_note:      earnings?.evidence_notes?.[0],
      caution_note:       earnings?.caution_notes?.[0] ?? purityEntry?.notes?.[0],
      is_indirect:        lead?.is_indirect    ?? false,
      is_story_heavy:     lead?.is_story_heavy ?? false,
    })
  }

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

            {/* Stage divider lines */}
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
                  symbolOverlay={getOverlay(node.bucket_id)}
                  onSymbolClick={handleSymbolClick}
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

      {/* Symbol Mini Card modal (V2-3 — direct ticker click) */}
      {activeMiniCard && (
        <SymbolMiniCard
          data={activeMiniCard}
          onClose={() => setActiveMiniCard(null)}
        />
      )}

      {/* Sector Pulse Card modal (V2-4 — node body click) */}
      {selectedId && !activeMiniCard && (() => {
        const selState   = states.find(s => s.bucket_id === selectedId)
        if (!selState) return null
        const selEarn    = earningsBuckets.find(b => b.bucket_id === selectedId)
        return (
          <SectorPulseCard
            state={selState}
            earnings={selEarn}
            companyPurity={companyPurity}
            earningsCompanies={earningsCompanies}
            symbolReturns={symbolReturns}
            symbolPriceSeries={symbolPriceSeries}
            asOf={asOf}
            onClose={() => onSelect(null)}
          />
        )
      })()}
    </div>
  )
}
