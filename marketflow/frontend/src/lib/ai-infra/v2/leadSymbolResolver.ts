// AI 인프라 V2 — 버킷별 대표 종목 결정 (earnings 확인도 > purity score 우선순위)

import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type { AIInfraEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'

export interface LeadSymbol {
  bucket_id:      string
  symbol:         string | null
  company_name:   string | null
  is_indirect:    boolean
  is_story_heavy: boolean
  fallback_reason?: 'not-listed' | 'indirect-only' | 'data-limited'
}

const EARNINGS_PRIORITY: Record<string, number> = {
  CONFIRMED:     5,
  PARTIAL:       4,
  WATCH:         3,
  NOT_CONFIRMED: 2,
  DATA_LIMITED:  1,
  UNKNOWN:       0,
}

export function resolveLeadSymbol(
  bucket_id: string,
  companyPurity: AIInfraCompanyPurityMetadata[],
  earningsCompanies: AIInfraEarningsEvidence[] = [],
): LeadSymbol {
  const candidates = companyPurity.filter(c => c.primary_bucket === bucket_id)

  if (candidates.length === 0) {
    return {
      bucket_id, symbol: null, company_name: null,
      is_indirect: false, is_story_heavy: false,
      fallback_reason: 'not-listed',
    }
  }

  const sorted = [...candidates].sort((a, b) => {
    const ea = earningsCompanies.find(e => e.symbol === a.symbol)
    const eb = earningsCompanies.find(e => e.symbol === b.symbol)
    const pa = EARNINGS_PRIORITY[ea?.confirmation_level ?? 'UNKNOWN'] ?? 0
    const pb = EARNINGS_PRIORITY[eb?.confirmation_level ?? 'UNKNOWN'] ?? 0
    if (pa !== pb) return pb - pa
    return b.ai_infra_relevance_score - a.ai_infra_relevance_score
  })

  const top        = sorted[0]!
  const isIndirect  = top.indirect_exposure || top.company_theme_purity === 'INDIRECT_EXPOSURE'
  const isStoryHeavy = top.story_risk || top.company_theme_purity === 'STORY_HEAVY'

  return {
    bucket_id,
    symbol:       top.symbol,
    company_name: top.company_name ?? top.symbol,
    is_indirect:    isIndirect,
    is_story_heavy: isStoryHeavy,
    fallback_reason: isStoryHeavy ? 'data-limited' : isIndirect ? 'indirect-only' : undefined,
  }
}

export function buildLeadSymbolMap(
  companyPurity: AIInfraCompanyPurityMetadata[],
  earningsCompanies: AIInfraEarningsEvidence[] = [],
): Map<string, LeadSymbol> {
  const buckets = [...new Set(companyPurity.map(c => c.primary_bucket as string))]
  const map = new Map<string, LeadSymbol>()
  for (const bucket_id of buckets) {
    map.set(bucket_id, resolveLeadSymbol(bucket_id, companyPurity, earningsCompanies))
  }
  return map
}
