'use client'
// AI 인프라 V2 — 5-스테이지 밸류체인 흐름 시각화 (SVG, 종목 미니카드 포함)

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type { AIInfraEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { buildFlowMapLayout } from '@/lib/ai-infra/v2/flowMapLayout'
import { buildLeadSymbolMap } from '@/lib/ai-infra/v2/leadSymbolResolver'
import { resolveLeadSymbolsForBucket } from '@/lib/ai-infra/v2/resolveLeadSymbolsForBucket'
import { getSymbolReturn } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { buildMoversMarker } from '@/lib/ai-infra/v2/buildMoversMarker'
import type { SymbolReturnsMap } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { useFlowMapLayout } from '@/lib/ai-infra/v2/useFlowMapLayout'
import { useFlowMapUrlSync } from '@/lib/ai-infra/v2/useFlowMapUrlSync'
import { FlowMapNode } from './FlowMapNode'
import type { SymbolNodeOverlay } from './FlowMapNode'
import { FlowMapConnector, FlowMapArrowDefs } from './FlowMapConnector'
import { FlowMapStageVertical } from './FlowMapStageVertical'
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
  selectedId?:        string | null
  onSelect?:          (id: string | null) => void
  symbolReturns:      SymbolReturnsMap
  symbolPriceSeries:  Record<string, number[]>
  earningsCompanies:  AIInfraEarningsEvidence[]
  earningsBuckets:    AIInfraBucketEarningsConfirmation[]
  companyPurity:      AIInfraCompanyPurityMetadata[]
  asOf?:              string | null
}

// Public export wraps with Suspense for useSearchParams
export function LiveFlowMap(props: Props) {
  return (
    <Suspense fallback={null}>
      <LiveFlowMapCore {...props} />
    </Suspense>
  )
}

function LiveFlowMapCore({
  states, symbolReturns, symbolPriceSeries,
  earningsCompanies, earningsBuckets, companyPurity, asOf,
}: Props) {
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

  const orientation = useFlowMapLayout()
  const layout      = buildFlowMapLayout(states, width)
  const leadMap     = buildLeadSymbolMap(companyPurity, earningsCompanies)

  // URL validation data
  const validBuckets = useMemo(
    () => states.map(s => s.bucket_id),
    [states],
  )
  const validSymbolsByBucket = useMemo(() => {
    const map: Record<string, string[]> = {}
    states.forEach(s => {
      const result = resolveLeadSymbolsForBucket({
        bucket_id: s.bucket_id, companyPurity, earningsCompanies, limit: 5,
      })
      map[s.bucket_id] = result.symbols.map(sym => sym.symbol)
    })
    return map
  }, [states, companyPurity, earningsCompanies])

  const {
    selectedBucket, selectedSymbol,
    openBucket, openSymbol, openBucketSymbol, closeSymbol, closeBucket,
  } = useFlowMapUrlSync(validBuckets, validSymbolsByBucket)

  // Derive mini card data from URL-selected symbol
  const activeMiniCardData = useMemo((): SymbolMiniCardData | null => {
    if (!selectedSymbol || !selectedBucket) return null
    const state  = states.find(s => s.bucket_id === selectedBucket)
    const ret    = getSymbolReturn(selectedSymbol, symbolReturns)
    const mark   = buildMoversMarker(ret.five_day)
    const eEntry = earningsCompanies.find(e => e.symbol === selectedSymbol)
    const pEntry = companyPurity.find(c => c.symbol === selectedSymbol)
    return {
      symbol:             selectedSymbol,
      company_name:       pEntry?.company_name ?? selectedSymbol,
      bucket_label:       state?.display_name ?? selectedBucket,
      return_1w:          ret.five_day,
      return_1m:          ret.one_month,
      return_3m:          ret.three_month,
      prices:             symbolPriceSeries[selectedSymbol] ?? [],
      asOf,
      marker_type:        mark.marker_type,
      confirmation_level: eEntry?.confirmation_level,
      evidence_note:      eEntry?.evidence_notes?.[0],
      caution_note:       eEntry?.caution_notes?.[0] ?? pEntry?.notes?.[0],
      is_indirect:        pEntry?.indirect_exposure || pEntry?.company_theme_purity === 'INDIRECT_EXPOSURE' || false,
      is_story_heavy:     pEntry?.story_risk || pEntry?.company_theme_purity === 'STORY_HEAVY' || false,
    }
  }, [selectedSymbol, selectedBucket, states, symbolReturns, symbolPriceSeries,
      earningsCompanies, companyPurity, asOf])

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
    openBucketSymbol(bucketId, symbol)
  }

  const modals = (
    <>
      {activeMiniCardData && (
        <SymbolMiniCard
          data={activeMiniCardData}
          onClose={closeSymbol}
        />
      )}
      {selectedBucket && !selectedSymbol && (() => {
        const selState = states.find(s => s.bucket_id === selectedBucket)
        if (!selState) return null
        const selEarn  = earningsBuckets.find(b => b.bucket_id === selectedBucket)
        return (
          <SectorPulseCard
            state={selState}
            earnings={selEarn}
            companyPurity={companyPurity}
            earningsCompanies={earningsCompanies}
            symbolReturns={symbolReturns}
            symbolPriceSeries={symbolPriceSeries}
            asOf={asOf}
            onClose={closeBucket}
            onSymbolClick={openSymbol}
          />
        )
      })()}
    </>
  )

  if (orientation === 'vertical') {
    return (
      <div>
        <FlowMapStageVertical
          stages={layout.stages}
          selectedId={selectedBucket}
          onSelect={id => id ? openBucket(id) : closeBucket()}
          getOverlay={getOverlay}
          onSymbolClick={handleSymbolClick}
        />
        {modals}
      </div>
    )
  }

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg
          viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
          width="100%"
          style={{ display: 'block' }}
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
              fontSize={11}
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
                selected={selectedBucket === node.bucket_id}
                onClick={id => selectedBucket === id ? closeBucket() : openBucket(id)}
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

      {modals}
    </div>
  )
}
