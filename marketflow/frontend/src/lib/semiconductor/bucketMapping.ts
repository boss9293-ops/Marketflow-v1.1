export type SemiconductorBucketMapping = {
  bucketId: string
  label: string
  representativeTickers: string[]
  driverClass: 'internal_driver' | 'external_confirmer' | 'ai_theme'
  soxxLinkage: 'high' | 'medium' | 'low'
  confidence: 'high' | 'medium' | 'low'
  note: string
}

export const SEMICONDUCTOR_BUCKET_MAPPINGS: SemiconductorBucketMapping[] = [
  {
    bucketId: 'ai_compute',
    label: 'AI Compute',
    representativeTickers: ['NVDA', 'AVGO', 'AMD'],
    driverClass: 'internal_driver',
    soxxLinkage: 'high',
    confidence: 'high',
    note: 'Selected SOXX internal compute drivers.',
  },
  {
    bucketId: 'memory',
    label: 'Memory / HBM',
    representativeTickers: ['MU'],
    driverClass: 'internal_driver',
    soxxLinkage: 'medium',
    confidence: 'high',
    note: 'SOXX internal memory exposure is currently concentrated in Micron.',
  },
  {
    bucketId: 'equipment',
    label: 'Equipment',
    representativeTickers: ['AMAT', 'ASML', 'LRCX', 'KLAC'],
    driverClass: 'internal_driver',
    soxxLinkage: 'high',
    confidence: 'high',
    note: 'Selected SOXX internal semiconductor equipment drivers.',
  },
  {
    bucketId: 'foundry_packaging',
    label: 'Foundry / Packaging',
    representativeTickers: ['TSM'],
    driverClass: 'internal_driver',
    soxxLinkage: 'medium',
    confidence: 'medium',
    note: 'SOXX internal foundry exposure exists, but current selected coverage is narrower than the full supply chain.',
  },
  {
    bucketId: 'external_hbm_confirmers',
    label: 'External HBM Confirmers',
    representativeTickers: ['Samsung', 'SK Hynix'],
    driverClass: 'external_confirmer',
    soxxLinkage: 'low',
    confidence: 'medium',
    note: 'External HBM signals provide supply-chain context, not direct SOXX attribution.',
  },
]

export const SEMICONDUCTOR_BUCKET_MAPPING_BY_ID =
  SEMICONDUCTOR_BUCKET_MAPPINGS.reduce<Record<string, SemiconductorBucketMapping>>((acc, mapping) => {
    acc[mapping.bucketId] = mapping
    return acc
  }, {})

const SEMICONDUCTOR_BUCKET_ALIASES: Record<string, string> = {
  ai: 'ai_compute',
  ai_infra: 'ai_compute',
  aiCompute: 'ai_compute',
  'AI Compute': 'ai_compute',
  'AI Infrastructure': 'ai_compute',
  mem: 'memory',
  memory: 'memory',
  'Memory': 'memory',
  'Memory / HBM': 'memory',
  foundry: 'foundry_packaging',
  foundryPackaging: 'foundry_packaging',
  'Foundry': 'foundry_packaging',
  'Foundry / Packaging': 'foundry_packaging',
  equip: 'equipment',
  equipment: 'equipment',
  'Equipment': 'equipment',
  external_hbm_confirmers: 'external_hbm_confirmers',
  'External HBM Confirmers': 'external_hbm_confirmers',
}

export function getSemiconductorBucketMapping(bucketKey: string): SemiconductorBucketMapping | null {
  const normalizedKey = SEMICONDUCTOR_BUCKET_ALIASES[bucketKey] ?? bucketKey
  return SEMICONDUCTOR_BUCKET_MAPPING_BY_ID[normalizedKey] ?? null
}

export function formatBucketTickerHint(mapping: SemiconductorBucketMapping) {
  return mapping.representativeTickers.join(' / ')
}

export function formatBucketClassificationHint(mapping: SemiconductorBucketMapping) {
  const driverClassLabel: Record<SemiconductorBucketMapping['driverClass'], string> = {
    internal_driver: 'Internal Driver',
    external_confirmer: 'External Confirmer',
    ai_theme: 'AI Theme',
  }

  return `${driverClassLabel[mapping.driverClass]} | ${mapping.soxxLinkage.toUpperCase()} SOXX linkage | ${mapping.confidence.toUpperCase()} confidence`
}
