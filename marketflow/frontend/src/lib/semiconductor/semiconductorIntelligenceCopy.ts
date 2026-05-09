export const SEMICONDUCTOR_INTELLIGENCE_COPY = {
  sectionName: 'Semiconductor Intelligence',
  coreTagline: 'Quantify what moves SOXX. Monitor where AI capital may move next.',
  shortSubtitle: 'SOXX structure analysis + AI infrastructure monitoring.',
  soxxLens: {
    label: 'SOXX/SOXL Lens',
    shortDescription:
      'Quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.',
    expandedDescription:
      'The SOXX/SOXL Lens uses SOXX holdings, selected bucket contribution, and residual participation to help interpret the internal structure behind SOXX movement and SOXL daily sensitivity.',
  },
  aiInfrastructureRadar: {
    label: 'AI Infrastructure Radar',
    shortDescription:
      'Monitors broader AI infrastructure themes outside direct SOXX attribution.',
    expandedDescription:
      'The AI Infrastructure Radar monitors broader AI infrastructure themes such as power, grid, cooling, cloud capex, and nuclear/SMR, while classifying each theme by its relevance to SOXX/SOXL.',
  },
  soxxLinkLayer: {
    shortDescription:
      'Classifies AI infrastructure themes as Direct SOXX, Indirect SOXX, or Outside SOXX.',
    expandedDescription:
      'The SOXX Link Layer explains whether a broader AI infrastructure theme is directly represented in SOXX holdings, indirectly connected through demand/capex/supply-chain pathways, or outside direct SOXX attribution.',
  },
  guardrails: {
    historical: 'Historical context only. Not a forecast or trading signal.',
    exploratory: 'Exploratory context only. Not a forecast or trading signal.',
    soxlDailySensitivity:
      'SOXL daily sensitivity context, not a multi-day 3x forecast.',
  },
} as const
