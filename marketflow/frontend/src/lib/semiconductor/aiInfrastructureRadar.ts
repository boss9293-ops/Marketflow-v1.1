export type AIInfrastructureMomentumState =
  | 'strong'
  | 'watch'
  | 'neutral'
  | 'weak'

export type AIInfrastructureSoxxLinkType =
  | 'direct'
  | 'indirect'
  | 'outside'

export type AIInfrastructureDataStatus =
  | 'placeholder'
  | 'manual'
  | 'partial'
  | 'live'

export type AIInfraThemeDataStatus = AIInfrastructureDataStatus

export const RELATED_SOXX_BUCKET_LABELS = [
  'AI Compute',
  'Memory',
  'Equipment',
  'Foundry / Packaging',
  'Residual / None',
] as const

export type RelatedSoxxBucket = (typeof RELATED_SOXX_BUCKET_LABELS)[number]

export type AIInfrastructureTheme = {
  id: string
  name: string
  category: string
  description: string
  momentumState: AIInfrastructureMomentumState
  soxxLinkType: AIInfrastructureSoxxLinkType
  relatedSoxxBuckets: RelatedSoxxBucket[]
  whyItMatters: string
  risk: string
  dataStatus: AIInfrastructureDataStatus
}

export const SOXX_LINK_TYPE_DEFINITIONS: Record<
  AIInfrastructureSoxxLinkType,
  {
    label: string
    short: string
    detail: string
  }
> = {
  direct: {
    label: 'Direct SOXX',
    short: 'Directly represented inside SOXX holdings.',
    detail:
      'This theme includes companies or exposures that are directly represented inside SOXX holdings.',
  },
  indirect: {
    label: 'Indirect SOXX',
    short: 'Connected through demand, capex, or supply-chain pathways.',
    detail:
      'This theme may influence SOXX through AI demand, cloud capex, semiconductor supply chain activity, or deployment constraints.',
  },
  outside: {
    label: 'Outside SOXX',
    short: 'Broader AI infrastructure theme outside direct SOXX attribution.',
    detail:
      'This theme sits outside direct SOXX attribution but may represent a broader AI infrastructure opportunity or bottleneck.',
  },
}

export const INITIAL_AI_INFRASTRUCTURE_THEMES: AIInfrastructureTheme[] = [
  {
    id: 'data_center_power',
    name: 'Data Center Power',
    category: 'Power Demand',
    description:
      'Tracks power demand pressure created by AI data center expansion.',
    momentumState: 'watch',
    soxxLinkType: 'indirect',
    relatedSoxxBuckets: ['AI Compute', 'Equipment'],
    whyItMatters:
      'Power availability can influence the pace of AI server deployment and related semiconductor demand.',
    risk:
      'Power bottlenecks can delay data center expansion and reduce near-term deployment visibility.',
    dataStatus: 'placeholder',
  },
  {
    id: 'grid_electrical_equipment',
    name: 'Grid / Electrical Equipment',
    category: 'Power Infrastructure',
    description:
      'Monitors grid upgrades, transformers, electrical equipment, and power distribution constraints.',
    momentumState: 'watch',
    soxxLinkType: 'outside',
    relatedSoxxBuckets: [],
    whyItMatters:
      'Grid investment can become a secondary AI infrastructure beneficiary outside direct SOXX attribution.',
    risk:
      'This theme may benefit from AI infrastructure growth without directly contributing to SOXX movement.',
    dataStatus: 'placeholder',
  },
  {
    id: 'cooling',
    name: 'Cooling',
    category: 'Data Center Infrastructure',
    description:
      'Tracks cooling demand and thermal management needs for AI data centers.',
    momentumState: 'watch',
    soxxLinkType: 'indirect',
    relatedSoxxBuckets: ['AI Compute'],
    whyItMatters:
      'Cooling capacity can affect AI data center density, efficiency, and deployment timelines.',
    risk:
      'Cooling is an enabling infrastructure theme and should not be treated as direct SOXX contribution.',
    dataStatus: 'placeholder',
  },
  {
    id: 'cloud_capex',
    name: 'Cloud CAPEX',
    category: 'AI Demand Signal',
    description:
      'Monitors cloud hyperscaler capital expenditure as a demand signal for AI infrastructure.',
    momentumState: 'watch',
    soxxLinkType: 'indirect',
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    whyItMatters:
      'Cloud capex is a key upstream demand signal for AI accelerators, memory, and semiconductor equipment.',
    risk:
      'Capex plans can change quickly if AI monetization or macro conditions weaken.',
    dataStatus: 'placeholder',
  },
  {
    id: 'nuclear_smr',
    name: 'Nuclear / SMR',
    category: 'Long-Term Power Supply',
    description:
      'Tracks nuclear and small modular reactor themes related to long-term AI power supply.',
    momentumState: 'watch',
    soxxLinkType: 'outside',
    relatedSoxxBuckets: [],
    whyItMatters:
      'Long-term AI power demand may increase interest in stable clean baseload power solutions.',
    risk:
      'Nuclear and SMR projects are long-cycle themes with regulatory, funding, and timeline risk.',
    dataStatus: 'placeholder',
  },
]

export function getSoxxLinkLabel(
  linkType: AIInfrastructureSoxxLinkType,
): string {
  return SOXX_LINK_TYPE_DEFINITIONS[linkType]?.label ?? 'Unknown'
}

export function getDataStatusLabel(
  status: AIInfrastructureDataStatus,
): string {
  switch (status) {
    case 'live':
      return 'Live'
    case 'partial':
      return 'Partial'
    case 'manual':
      return 'Manual'
    case 'placeholder':
      return 'Placeholder'
    default:
      return 'Unknown'
  }
}

export function getSoxxLinkExplanation(
  theme: AIInfrastructureTheme,
): string {
  const definition = SOXX_LINK_TYPE_DEFINITIONS[theme.soxxLinkType]

  if (!definition) {
    return 'SOXX link type is not defined.'
  }

  const buckets = theme.relatedSoxxBuckets.length > 0
    ? ` Related SOXX bucket: ${theme.relatedSoxxBuckets.join(', ')}.`
    : ' No direct SOXX bucket is mapped.'

  return `${definition.label}: ${definition.short}${buckets}`
}

export function getSoxxLinkUserSummary(
  theme: AIInfrastructureTheme,
): string {
  if (theme.soxxLinkType === 'direct') {
    return 'Directly represented inside SOXX holdings.'
  }

  if (theme.soxxLinkType === 'indirect') {
    return 'Connected through demand, capex, or supply-chain pathways.'
  }

  return 'Broader AI infrastructure theme outside direct SOXX attribution.'
}
