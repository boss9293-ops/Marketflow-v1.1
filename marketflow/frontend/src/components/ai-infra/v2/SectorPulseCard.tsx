'use client'
// AI 인프라 V2 — Sector Pulse Card 메인 컨테이너 (모달 + 5 섹션)

import { useEffect, useState } from 'react'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type {
  AIInfraBucketEarningsConfirmation,
  AIInfraEarningsEvidence,
} from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import type { SymbolReturnsMap } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { getSymbolReturn } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { buildLeadSymbolMap } from '@/lib/ai-infra/v2/leadSymbolResolver'
import { resolveLeadSymbolsForBucket } from '@/lib/ai-infra/v2/resolveLeadSymbolsForBucket'
import { buildSectorPulseSummary } from '@/lib/ai-infra/v2/buildSectorPulseSummary'
import { buildWatchPoints } from '@/lib/ai-infra/v2/buildWatchPoints'

import { SectorPulseHeader } from './SectorPulseHeader'
import { SectorPulseChart } from './SectorPulseChart'
import { SectorPulseSummary } from './SectorPulseSummary'
import { SectorPulseLeadSymbols } from './SectorPulseLeadSymbols'
import { SectorPulseWatchPoints } from './SectorPulseWatchPoints'

interface Props {
  state:              AIInfraBucketState
  earnings?:          AIInfraBucketEarningsConfirmation
  companyPurity:      AIInfraCompanyPurityMetadata[]
  earningsCompanies:  AIInfraEarningsEvidence[]
  symbolReturns:      SymbolReturnsMap
  symbolPriceSeries:  Record<string, number[]>
  asOf?:              string | null
  onClose:            () => void
  onSymbolClick?:     (symbol: string) => void
}

export function SectorPulseCard({
  state, earnings,
  companyPurity, earningsCompanies,
  symbolReturns, symbolPriceSeries,
  asOf, onClose, onSymbolClick,
}: Props) {
  const [isWide, setIsWide] = useState(true)

  // ESC: close card
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Width-based layout
  useEffect(() => {
    const update = () => setIsWide(typeof window !== 'undefined' && window.innerWidth >= 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Resolve lead symbol (top 1) for chart
  const leadMap     = buildLeadSymbolMap(companyPurity, earningsCompanies)
  const lead        = leadMap.get(state.bucket_id)
  const leadSymbol  = lead?.symbol ?? null
  const leadReturn  = getSymbolReturn(leadSymbol, symbolReturns)
  const leadPrices  = leadSymbol ? (symbolPriceSeries[leadSymbol] ?? []) : []

  // Build Section C summary
  const summary = buildSectorPulseSummary({ state, earnings })

  // Build Section D list (top 3-5)
  const leadList = resolveLeadSymbolsForBucket({
    bucket_id: state.bucket_id,
    companyPurity, earningsCompanies,
    limit: 5,
  })

  // Build Section E watch points
  const watchPoints = buildWatchPoints({ state, earnings })

  function handleSymbolClick(symbol: string) {
    onSymbolClick?.(symbol)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.62)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 800, maxHeight: '90vh',
            overflowY: 'auto',
            background: '#171d25',
            border: '1px solid rgba(148,163,184,0.24)',
            borderRadius: 8,
          }}
        >
          {/* Section A */}
          <SectorPulseHeader state={state} onClose={onClose} />

          {/* Body */}
          <div style={{
            padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {/* B + C row */}
            <div style={{
              display: isWide ? 'grid' : 'flex',
              gridTemplateColumns: isWide ? '1fr 1fr' : undefined,
              flexDirection: isWide ? undefined : 'column',
              gap: 12,
            }}>
              <SectorPulseChart
                symbol={leadSymbol}
                prices={leadPrices}
                asOf={asOf}
              />
              <SectorPulseSummary
                summary={summary}
                return_1w={leadReturn.five_day}
                return_1m={leadReturn.one_month}
                return_3m={leadReturn.three_month}
                symbol={leadSymbol}
              />
            </div>

            {/* D */}
            <SectorPulseLeadSymbols
              data={leadList}
              symbolReturns={symbolReturns}
              onSymbolClick={handleSymbolClick}
            />

            {/* E */}
            <SectorPulseWatchPoints points={watchPoints} />
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px 14px',
            borderTop: '1px solid rgba(148,163,184,0.18)',
            fontFamily: "Inter, Pretendard, 'Noto Sans KR', sans-serif",
            fontSize: 10, color: '#8b9098', lineHeight: 1.5,
            letterSpacing: '0.04em',
          }}>
            Sector Pulse는 가격 / 실적 / 테마 순도 룰에 기반한 관찰 도구입니다. 매수 / 매도 추천이 아닙니다.
          </div>
        </div>
      </div>

    </>
  )
}
