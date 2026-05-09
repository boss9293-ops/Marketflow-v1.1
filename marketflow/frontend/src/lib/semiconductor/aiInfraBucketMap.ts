// AI 인프라 병목 버킷 분류 — 13개 버킷 기반 밸류체인 레이더 데이터 계약

// ── Primitive types ───────────────────────────────────────────────────────────

export type AIInfraBucketId =
  | 'AI_CHIP'
  | 'HBM_MEMORY'
  | 'PACKAGING'
  | 'COOLING'
  | 'PCB_SUBSTRATE'
  | 'TEST_EQUIPMENT'
  | 'GLASS_SUBSTRATE'
  | 'OPTICAL_NETWORK'
  | 'POWER_INFRA'
  | 'CLEANROOM_WATER'
  | 'SPECIALTY_GAS'
  | 'DATA_CENTER_INFRA'
  | 'RAW_MATERIAL'

export type AIInfraStage =
  | 'STAGE_1_AI_CHIP'
  | 'STAGE_2_MEMORY_PACKAGING'
  | 'STAGE_3_SERVER_INTERNAL_BOTTLENECK'
  | 'STAGE_4_EXTERNAL_INFRA'
  | 'STAGE_5_PHYSICAL_RESOURCE'

export type AIInfraDataQuality =
  | 'REAL'
  | 'PARTIAL'
  | 'PLACEHOLDER'
  | 'MANUAL'
  | 'DATA_INSUFFICIENT'

// ── Core contract ─────────────────────────────────────────────────────────────

export interface AIInfraBucket {
  bucket_id: AIInfraBucketId
  display_name: string
  stage: AIInfraStage
  description: string
  value_chain_position: number  // 1–5, matches stage ordinal
  default_benchmark: 'SOXX' | 'QQQ' | 'SPY'
  risk_notes: string[]
  data_quality: AIInfraDataQuality
  symbols: string[]  // US-listed tickers available in ohlcv_daily
}

// ── Stage ordering ────────────────────────────────────────────────────────────

export const AI_INFRA_STAGE_ORDER: AIInfraStage[] = [
  'STAGE_1_AI_CHIP',
  'STAGE_2_MEMORY_PACKAGING',
  'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  'STAGE_4_EXTERNAL_INFRA',
  'STAGE_5_PHYSICAL_RESOURCE',
]

export const AI_INFRA_STAGE_LABEL: Record<AIInfraStage, string> = {
  STAGE_1_AI_CHIP:                     'Stage 1 — AI Chip',
  STAGE_2_MEMORY_PACKAGING:            'Stage 2 — Memory & Packaging',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK:  'Stage 3 — Server Internal Bottleneck',
  STAGE_4_EXTERNAL_INFRA:              'Stage 4 — External Infrastructure',
  STAGE_5_PHYSICAL_RESOURCE:           'Stage 5 — Physical Resource',
}

// ── 13-bucket definitions ─────────────────────────────────────────────────────

export const AI_INFRA_BUCKETS: AIInfraBucket[] = [
  {
    bucket_id: 'AI_CHIP',
    display_name: 'AI Chip',
    stage: 'STAGE_1_AI_CHIP',
    description: 'AI accelerator and custom silicon leaders directly driving semiconductor cycle demand.',
    value_chain_position: 1,
    default_benchmark: 'SOXX',
    risk_notes: [
      'Concentration risk — NVDA dominates earnings and RS contribution.',
      'Hyperscaler capex sensitivity: slowdown in cloud spend impacts demand.',
    ],
    data_quality: 'REAL',
    symbols: ['NVDA', 'AMD', 'AVGO', 'MRVL'],
  },
  {
    bucket_id: 'HBM_MEMORY',
    display_name: 'HBM Memory',
    stage: 'STAGE_2_MEMORY_PACKAGING',
    description: 'High-bandwidth memory suppliers providing core AI accelerator memory.',
    value_chain_position: 2,
    default_benchmark: 'SOXX',
    risk_notes: [
      'Samsung and SK Hynix are Korean-listed — excluded from live calculation until KIS pipeline is connected.',
      'Micron (MU) is the primary US proxy; may not fully represent HBM supply dynamics.',
    ],
    data_quality: 'PARTIAL',
    symbols: ['MU'],
    // Future: add '005930.KS' (Samsung), '000660.KS' (SK Hynix) when KR pipeline ready
  },
  {
    bucket_id: 'PACKAGING',
    display_name: 'Advanced Packaging',
    stage: 'STAGE_2_MEMORY_PACKAGING',
    description: 'Advanced packaging, chiplet integration, CoWoS-style capacity, and back-end equipment.',
    value_chain_position: 2,
    default_benchmark: 'SOXX',
    risk_notes: [
      'TSMC packaging exposure is only accessible via ADR (TSM).',
      'AMAT and KLAC overlap with equipment bucket — RS calculation may double-count.',
    ],
    data_quality: 'REAL',
    symbols: ['AMAT', 'KLAC', 'ACMR', 'TSM'],
  },
  {
    bucket_id: 'COOLING',
    display_name: 'Cooling',
    stage: 'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
    description: 'Liquid cooling, immersion cooling, and thermal management for AI servers and data centers.',
    value_chain_position: 3,
    default_benchmark: 'SOXX',
    risk_notes: [
      'Pure-play AI exposure varies — Vertiv (VRT) has strong DC exposure; others are more diversified.',
      'Cooling is an enabling theme, not a direct SOXX driver.',
    ],
    data_quality: 'REAL',
    symbols: ['VRT', 'ETN', 'TT', 'MOD', 'NVT'],
  },
  {
    bucket_id: 'PCB_SUBSTRATE',
    display_name: 'PCB & Substrate',
    stage: 'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
    description: 'High-layer PCB, FC-BGA substrates, and AI server board infrastructure.',
    value_chain_position: 3,
    default_benchmark: 'SOXX',
    risk_notes: [
      'Korean substrate names (Unimicron, Kinsus) are not in US price data — excluded.',
      'US proxies (TTM, SANM) have limited pure-play AI server substrate exposure.',
    ],
    data_quality: 'PARTIAL',
    symbols: ['TTMI', 'SANM', 'CLS', 'FLEX'],
  },
  {
    bucket_id: 'TEST_EQUIPMENT',
    display_name: 'Test Equipment',
    stage: 'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
    description: 'Semiconductor test, inspection, probe, socket, and metrology.',
    value_chain_position: 3,
    default_benchmark: 'SOXX',
    risk_notes: [
      'KLAC overlaps with PACKAGING bucket — shared ticker in multiple baskets is intentional.',
      'COHU and FORM are smaller caps; volume data may be sparse.',
    ],
    data_quality: 'REAL',
    symbols: ['TER', 'COHU', 'FORM', 'KLAC', 'ONTO'],
  },
  {
    bucket_id: 'GLASS_SUBSTRATE',
    display_name: 'Glass Substrate',
    stage: 'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
    description: 'Next-generation glass substrate and related tooling or materials for advanced packaging.',
    value_chain_position: 3,
    default_benchmark: 'SOXX',
    risk_notes: [
      'Commercialization timing uncertainty is high — most exposure remains story-level.',
      'GLW has broader diversified revenue; pure AI glass substrate revenue is a small fraction.',
      'Intel glass substrate initiative adds demand visibility but mass production timeline is unclear.',
    ],
    data_quality: 'PARTIAL',
    symbols: ['GLW', 'AMAT'],
  },
  {
    bucket_id: 'OPTICAL_NETWORK',
    display_name: 'Optical Network',
    stage: 'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
    description: 'Optical interconnect, networking, transceivers, and data center connectivity.',
    value_chain_position: 3,
    default_benchmark: 'QQQ',
    risk_notes: [
      'AVGO overlaps with AI_CHIP bucket — intentional, as AVGO has significant networking exposure.',
      'Macro sensitivity to hyperscaler networking capex is high.',
    ],
    data_quality: 'REAL',
    symbols: ['ANET', 'CIEN', 'LITE', 'COHR', 'AVGO'],
  },
  {
    bucket_id: 'POWER_INFRA',
    display_name: 'Power Infrastructure',
    stage: 'STAGE_4_EXTERNAL_INFRA',
    description: 'Power equipment, electrical infrastructure, grid hardware, transformers, and power management.',
    value_chain_position: 4,
    default_benchmark: 'SPY',
    risk_notes: [
      'Revenue purity: most names have broad industrial exposure beyond AI power demand.',
      'Valuation has expanded significantly — overheat risk is elevated.',
      'Maps from legacy placeholder themes: data_center_power and grid_electrical_equipment.',
    ],
    data_quality: 'REAL',
    symbols: ['ETN', 'PWR', 'HUBB', 'GEV', 'VRT', 'NVT'],
  },
  {
    bucket_id: 'CLEANROOM_WATER',
    display_name: 'Cleanroom & Water',
    stage: 'STAGE_4_EXTERNAL_INFRA',
    description: 'Cleanroom infrastructure, ultra-pure water, and facility support for semiconductor fabs.',
    value_chain_position: 4,
    default_benchmark: 'SPY',
    risk_notes: [
      'AI/semiconductor revenue purity varies — verify exposure before upgrading data_quality.',
      'ACM Research (ACMR) is a stronger semiconductor pure-play than XYL or ECL.',
    ],
    data_quality: 'PARTIAL',
    symbols: ['ACMR', 'XYL', 'ECL', 'WTS'],
  },
  {
    bucket_id: 'SPECIALTY_GAS',
    display_name: 'Specialty Gas',
    stage: 'STAGE_4_EXTERNAL_INFRA',
    description: 'Specialty gases, chemicals, and semiconductor process materials.',
    value_chain_position: 4,
    default_benchmark: 'SPY',
    risk_notes: [
      'LIN and APD are diversified industrial gas — semiconductor is one segment.',
      'ENTG and CCMP have stronger semiconductor materials purity.',
    ],
    data_quality: 'REAL',
    symbols: ['LIN', 'APD', 'ENTG'],
    // CCMP (CMC Materials) acquired by Entegris 2022 — delisted, replaced by ENTG
  },
  {
    bucket_id: 'DATA_CENTER_INFRA',
    display_name: 'Data Center Infrastructure',
    stage: 'STAGE_5_PHYSICAL_RESOURCE',
    description: 'Data center operators, digital REIT infrastructure, and server infrastructure beneficiaries.',
    value_chain_position: 5,
    default_benchmark: 'SPY',
    risk_notes: [
      'REITs (EQIX, DLR, IRM) are rate-sensitive — RS vs SPY may reflect macro not AI demand.',
      'Maps from legacy placeholder theme: cloud_capex.',
    ],
    data_quality: 'REAL',
    symbols: ['EQIX', 'DLR', 'IRM', 'VRT'],
  },
  {
    bucket_id: 'RAW_MATERIAL',
    display_name: 'Raw Material',
    stage: 'STAGE_5_PHYSICAL_RESOURCE',
    description: 'Copper and power metals linked to AI infrastructure build-out demand.',
    value_chain_position: 5,
    default_benchmark: 'SPY',
    risk_notes: [
      'Commodity price cycles dominate RS vs SPY — may lag or lead AI cycle independently.',
      'COPX is an ETF proxy, not a single-name ticker.',
    ],
    data_quality: 'PARTIAL',
    symbols: ['FCX', 'SCCO', 'TECK', 'COPX'],
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export const AI_INFRA_BUCKET_IDS: AIInfraBucketId[] = AI_INFRA_BUCKETS.map(b => b.bucket_id)

export const AI_INFRA_BUCKET_BY_ID: Record<AIInfraBucketId, AIInfraBucket> =
  Object.fromEntries(AI_INFRA_BUCKETS.map(b => [b.bucket_id, b])) as Record<AIInfraBucketId, AIInfraBucket>

export function getAIInfraBucket(id: AIInfraBucketId): AIInfraBucket {
  return AI_INFRA_BUCKET_BY_ID[id]
}

export function getAIInfraBucketsByStage(stage: AIInfraStage): AIInfraBucket[] {
  return AI_INFRA_BUCKETS.filter(b => b.stage === stage)
}

// ── Legacy placeholder migration map ─────────────────────────────────────────
// Maps old aiInfrastructureRadar.ts theme IDs to the new 13-bucket taxonomy.
// null = no direct mapping; handled as future ENERGY_INFRA extension.

export const LEGACY_THEME_TO_BUCKET: Record<string, AIInfraBucketId | null> = {
  'data_center_power':         'POWER_INFRA',
  'grid_electrical_equipment': 'POWER_INFRA',
  'cooling':                   'COOLING',
  'cloud_capex':               'DATA_CENTER_INFRA',
  'nuclear_smr':               null,  // future: ENERGY_INFRA — do not force into core 13
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface AIInfraBucketMapValidationResult {
  valid: boolean
  errors: string[]
}

export function validateAIInfraBucketMap(): AIInfraBucketMapValidationResult {
  const errors: string[] = []
  const buckets = AI_INFRA_BUCKETS

  if (buckets.length !== 13)
    errors.push(`Expected 13 buckets, found ${buckets.length}`)

  const seen = new Set<string>()
  for (const b of buckets) {
    if (seen.has(b.bucket_id)) errors.push(`Duplicate bucket_id: ${b.bucket_id}`)
    seen.add(b.bucket_id)
  }

  for (const b of buckets) {
    if (b.symbols.length === 0 && b.data_quality !== 'DATA_INSUFFICIENT')
      errors.push(`${b.bucket_id}: symbols empty but data_quality is not DATA_INSUFFICIENT`)

    if (!AI_INFRA_STAGE_ORDER.includes(b.stage))
      errors.push(`${b.bucket_id}: unknown stage '${b.stage}'`)

    if (b.value_chain_position < 1 || b.value_chain_position > 5)
      errors.push(`${b.bucket_id}: value_chain_position must be 1–5, got ${b.value_chain_position}`)
  }

  for (const [legacyId, newId] of Object.entries(LEGACY_THEME_TO_BUCKET)) {
    if (newId !== null && !seen.has(newId))
      errors.push(`Legacy migration target '${newId}' (from '${legacyId}') not found in bucket list`)
  }

  return { valid: errors.length === 0, errors }
}
