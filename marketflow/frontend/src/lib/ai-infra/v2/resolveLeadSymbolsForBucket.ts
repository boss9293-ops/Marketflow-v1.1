// AI 인프라 V2 — Sector Pulse Card Section D 다종목 결정 (top 3-5 by earnings + relevance)

import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type { AIInfraEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'

export interface LeadSymbolDetail {
  symbol:              string
  company_name:        string
  is_indirect:         boolean
  is_story_heavy:      boolean
  confirmation_level?: string
}

export interface LeadSymbolsForBucket {
  symbols:           LeadSymbolDetail[]
  not_listed_note?:  string
}

const EARNINGS_PRIORITY: Record<string, number> = {
  CONFIRMED:     5,
  PARTIAL:       4,
  WATCH:         3,
  NOT_CONFIRMED: 2,
  DATA_LIMITED:  1,
  UNKNOWN:       0,
}

// 미상장 종목 안내 메모 (시장 대표성 보강)
const NOT_LISTED_NOTES: Record<string, string> = {
  HBM_MEMORY:        'SK하이닉스 · 삼성전자 → 미상장',
  PACKAGING:         'TSMC 외 주요 파운드리 미상장',
  TEST_EQUIPMENT:    '디스코 / 일본 후공정 장비 → 미상장',
  GLASS_SUBSTRATE:   '국내 SKC / 삼성전기 → 미상장',
}

export function resolveLeadSymbolsForBucket(input: {
  bucket_id:         string
  companyPurity:     AIInfraCompanyPurityMetadata[]
  earningsCompanies: AIInfraEarningsEvidence[]
  limit?:            number
}): LeadSymbolsForBucket {
  const { bucket_id, companyPurity, earningsCompanies, limit = 5 } = input

  // primary OR secondary 매핑 모두 포함
  const candidates = companyPurity.filter(c =>
    c.primary_bucket === bucket_id ||
    (c.secondary_buckets ?? []).includes(bucket_id as never),
  )

  const sorted = [...candidates].sort((a, b) => {
    const ea = earningsCompanies.find(e => e.symbol === a.symbol)
    const eb = earningsCompanies.find(e => e.symbol === b.symbol)
    const pa = EARNINGS_PRIORITY[ea?.confirmation_level ?? 'UNKNOWN'] ?? 0
    const pb = EARNINGS_PRIORITY[eb?.confirmation_level ?? 'UNKNOWN'] ?? 0
    if (pa !== pb) return pb - pa
    return b.ai_infra_relevance_score - a.ai_infra_relevance_score
  })

  const top = sorted.slice(0, Math.max(3, Math.min(limit, sorted.length)))

  const symbols: LeadSymbolDetail[] = top.map(c => {
    const earnings = earningsCompanies.find(e => e.symbol === c.symbol)
    return {
      symbol:              c.symbol,
      company_name:        c.company_name ?? c.symbol,
      is_indirect:         c.indirect_exposure || c.company_theme_purity === 'INDIRECT_EXPOSURE',
      is_story_heavy:      c.story_risk || c.company_theme_purity === 'STORY_HEAVY',
      confirmation_level:  earnings?.confirmation_level,
    }
  })

  return {
    symbols,
    not_listed_note: NOT_LISTED_NOTES[bucket_id],
  }
}
