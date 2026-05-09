import type {
  AIInfraThemeDataStatus,
  AIInfrastructureSoxxLinkType,
  RelatedSoxxBucket,
} from './aiInfrastructureRadar'

export type AIInfraThemeWatchlistItem = {
  ticker: string
  name: string
  role: string
  themeIds: string[]
  soxxLinkType: AIInfrastructureSoxxLinkType
  dataStatus: AIInfraThemeDataStatus
}

export type AIInfraNewsRelevance = 'high' | 'medium' | 'low'

export type AIInfraThemeNewsItem = {
  id: string
  themeId: string
  headline: string
  source: string
  publishedDate: string
  url?: string
  summary?: string
  whyItMatters: string
  riskOrContradiction?: string
  soxxLinkType: AIInfrastructureSoxxLinkType
  relevance: AIInfraNewsRelevance
  dataStatus: AIInfraThemeDataStatus
}

export type AIInfraCapexDirection = 'up' | 'flat' | 'down' | 'unclear'

export type AIInfraCapexSourceType =
  | 'earnings_release'
  | 'transcript'
  | 'filing'
  | 'manual_note'

export type AIInfraThemeCapexItem = {
  company: string
  ticker: string
  quarter: string
  capexDirection: AIInfraCapexDirection
  aiRelatedComment: string
  relatedThemes: string[]
  relatedSoxxBuckets: RelatedSoxxBucket[]
  source?: string
  sourceType?: AIInfraCapexSourceType
  lastUpdated: string
  dataStatus: AIInfraThemeDataStatus
}

export type AIInfraCapexCompany = {
  ticker: string
  company: string
  role: string
  relatedThemes: string[]
  relatedSoxxBuckets: RelatedSoxxBucket[]
  soxxLinkType: AIInfrastructureSoxxLinkType
}

// Exploratory manual watchlist only. These are not recommendations or trading signals.
export const AI_INFRA_THEME_WATCHLIST: AIInfraThemeWatchlistItem[] = [
  {
    ticker: 'VST',
    name: 'Vistra',
    role: 'Power generation exposure linked to rising data center electricity demand.',
    themeIds: ['data_center_power', 'nuclear_smr'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'CEG',
    name: 'Constellation Energy',
    role: 'Nuclear and power generation exposure tied to AI data center power demand.',
    themeIds: ['data_center_power', 'nuclear_smr'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'ETR',
    name: 'Entergy',
    role: 'Utility exposure in regions with growing industrial and data center load.',
    themeIds: ['data_center_power'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'D',
    name: 'Dominion Energy',
    role: 'Utility exposure tied to data center-heavy regions.',
    themeIds: ['data_center_power'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'NEE',
    name: 'NextEra Energy',
    role: 'Renewable and utility infrastructure exposure relevant to long-term power demand.',
    themeIds: ['data_center_power'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'PWR',
    name: 'Quanta Services',
    role: 'Grid construction and power infrastructure services.',
    themeIds: ['data_center_power', 'grid_electrical_equipment'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'ETN',
    name: 'Eaton',
    role: 'Electrical equipment and power management exposure.',
    themeIds: ['grid_electrical_equipment'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'GEV',
    name: 'GE Vernova',
    role: 'Grid, electrification, and power infrastructure exposure.',
    themeIds: ['grid_electrical_equipment'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'HUBB',
    name: 'Hubbell',
    role: 'Electrical and utility infrastructure components.',
    themeIds: ['grid_electrical_equipment'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'EME',
    name: 'EMCOR Group',
    role: 'Electrical and mechanical construction exposure for infrastructure buildout.',
    themeIds: ['grid_electrical_equipment'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'VRT',
    name: 'Vertiv',
    role: 'Data center power and thermal management systems.',
    themeIds: ['cooling'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'TT',
    name: 'Trane Technologies',
    role: 'Cooling and thermal management exposure.',
    themeIds: ['cooling'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'CARR',
    name: 'Carrier Global',
    role: 'HVAC and cooling infrastructure exposure.',
    themeIds: ['cooling'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'JCI',
    name: 'Johnson Controls',
    role: 'Building systems and thermal management exposure.',
    themeIds: ['cooling'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    role: 'Hyperscaler AI capex signal.',
    themeIds: ['cloud_capex'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet',
    role: 'Hyperscaler AI capex signal.',
    themeIds: ['cloud_capex'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'AMZN',
    name: 'Amazon',
    role: 'AWS AI infrastructure capex signal.',
    themeIds: ['cloud_capex'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'META',
    name: 'Meta Platforms',
    role: 'AI infrastructure and data center capex signal.',
    themeIds: ['cloud_capex'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'ORCL',
    name: 'Oracle',
    role: 'Cloud infrastructure and AI data center demand signal.',
    themeIds: ['cloud_capex'],
    soxxLinkType: 'indirect',
    dataStatus: 'manual',
  },
  {
    ticker: 'OKLO',
    name: 'Oklo',
    role: 'Small modular reactor / advanced nuclear exposure.',
    themeIds: ['nuclear_smr'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'SMR',
    name: 'NuScale Power',
    role: 'Small modular reactor exposure.',
    themeIds: ['nuclear_smr'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'BWXT',
    name: 'BWX Technologies',
    role: 'Nuclear components and services exposure.',
    themeIds: ['nuclear_smr'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
  {
    ticker: 'CCJ',
    name: 'Cameco',
    role: 'Uranium and nuclear fuel cycle exposure.',
    themeIds: ['nuclear_smr'],
    soxxLinkType: 'outside',
    dataStatus: 'manual',
  },
]

export const AI_INFRA_CAPEX_COMPANIES: AIInfraCapexCompany[] = [
  {
    ticker: 'MSFT',
    company: 'Microsoft',
    role: 'Azure and AI infrastructure capex signal.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    soxxLinkType: 'indirect',
  },
  {
    ticker: 'GOOGL',
    company: 'Alphabet',
    role: 'Google Cloud and AI infrastructure capex signal.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    soxxLinkType: 'indirect',
  },
  {
    ticker: 'AMZN',
    company: 'Amazon',
    role: 'AWS AI infrastructure capex signal.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    soxxLinkType: 'indirect',
  },
  {
    ticker: 'META',
    company: 'Meta Platforms',
    role: 'AI data center and GPU infrastructure capex signal.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    soxxLinkType: 'indirect',
  },
  {
    ticker: 'ORCL',
    company: 'Oracle',
    role: 'Cloud infrastructure and AI capacity demand signal.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    soxxLinkType: 'indirect',
  },
]

export const AI_INFRA_MANUAL_NEWS: AIInfraThemeNewsItem[] = [
  {
    id: 'data_center_power_iea_energy_ai_2025',
    themeId: 'data_center_power',
    headline: 'IEA projects data center electricity demand to double by 2030',
    source: 'IEA Energy and AI report',
    publishedDate: '2025-04-10',
    url: 'https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai',
    summary:
      'IEA estimates global data center electricity consumption at about 415 TWh in 2024 and projects about 945 TWh by 2030 in its base case.',
    whyItMatters:
      'Power availability remains a key bottleneck for AI server deployment and related semiconductor demand.',
    riskOrContradiction:
      'Efficiency gains, slower AI uptake, or delayed data center builds could reduce the load-growth path.',
    soxxLinkType: 'indirect',
    relevance: 'high',
    dataStatus: 'manual',
  },
  {
    id: 'grid_electrical_equipment_eaton_switchgear_2026',
    themeId: 'grid_electrical_equipment',
    headline: 'Eaton adds Nebraska switchgear capacity for AI data center demand',
    source: 'Eaton news release',
    publishedDate: '2026-04-08',
    url: 'https://www.eaton.com/us/en-us/company/news-insights/news-releases/2026/eaton-expands-operations-in-nebraska-with-new-manufacturing-facility.html',
    summary:
      'Eaton announced a new Nebraska facility and more than $30 million of investment to expand medium-voltage switchgear production.',
    whyItMatters:
      'Switchgear capacity is a practical grid and electrical-equipment bottleneck for data center speed-to-power.',
    riskOrContradiction:
      'New manufacturing capacity may not relieve near-term constraints until production ramps.',
    soxxLinkType: 'outside',
    relevance: 'high',
    dataStatus: 'manual',
  },
  {
    id: 'cooling_vertiv_nvidia_dsx_2026',
    themeId: 'cooling',
    headline: 'Vertiv contributes power and cooling models for NVIDIA Vera Rubin DSX AI factories',
    source: 'Vertiv news release',
    publishedDate: '2026-03-16',
    url: 'https://www.vertiv.com/en-latam/about/news-and-insights/news-releases/2026/vertiv-brings-converged-physical-infrastructure-to-nvidia-vera-rubin-dsx-ai-factories/',
    summary:
      'Vertiv described simulation-ready power and cooling infrastructure assets for the NVIDIA Vera Rubin DSX AI factory reference design.',
    whyItMatters:
      'High-density AI clusters need integrated power and thermal designs before compute capacity can be deployed reliably.',
    riskOrContradiction:
      'Reference designs and infrastructure models do not guarantee immediate deployments or hardware orders.',
    soxxLinkType: 'indirect',
    relevance: 'medium',
    dataStatus: 'manual',
  },
  {
    id: 'nuclear_smr_google_kairos_2024',
    themeId: 'nuclear_smr',
    headline: 'Google signs SMR agreement with Kairos Power for long-term clean electricity',
    source: 'Google Keyword blog',
    publishedDate: '2024-10-14',
    url: 'https://blog.google/company-news/outreach-and-initiatives/sustainability/google-kairos-power-nuclear-energy-agreement/',
    summary:
      'Google announced an agreement to purchase nuclear energy from multiple Kairos Power SMRs, targeting up to 500 MW of new 24/7 carbon-free power.',
    whyItMatters:
      'Advanced nuclear is emerging as a long-term power-supply option for AI data center load growth.',
    riskOrContradiction:
      'SMR projects remain long-cycle and depend on regulatory, construction, financing, and timeline execution.',
    soxxLinkType: 'outside',
    relevance: 'medium',
    dataStatus: 'manual',
  },
]

export const AI_INFRA_CAPEX_NOTES: AIInfraThemeCapexItem[] = [
  {
    company: 'Microsoft',
    ticker: 'MSFT',
    quarter: 'FY2026 Q3',
    capexDirection: 'up',
    aiRelatedComment:
      'Additions to property and equipment were $30.9B in FY2026 Q3 versus $16.7B in the prior-year quarter, while Azure and other cloud services revenue grew 40%.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    source:
      'Microsoft FY26 Q3 earnings release - https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q3/press-release-webcast',
    sourceType: 'earnings_release',
    lastUpdated: '2026-04-29',
    dataStatus: 'manual',
  },
  {
    company: 'Alphabet',
    ticker: 'GOOGL',
    quarter: '2026 Q1',
    capexDirection: 'up',
    aiRelatedComment:
      'Purchases of property and equipment were $35.7B in Q1 2026 versus $17.2B in Q1 2025, and Google Cloud revenue growth was led by enterprise AI Infrastructure.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    source:
      'Alphabet Q1 2026 earnings release - https://www.sec.gov/Archives/edgar/data/1652044/000165204426000043/googexhibit991q12026.htm',
    sourceType: 'earnings_release',
    lastUpdated: '2026-04-29',
    dataStatus: 'manual',
  },
  {
    company: 'Amazon',
    ticker: 'AMZN',
    quarter: '2026 Q1',
    capexDirection: 'up',
    aiRelatedComment:
      'Purchases of property and equipment were $44.2B in Q1 2026 versus $25.0B in Q1 2025; Amazon said the trailing free-cash-flow decline primarily reflected AI-related property and equipment investment.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    source:
      'Amazon Q1 2026 earnings release - https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-First-Quarter-Results/default.aspx',
    sourceType: 'earnings_release',
    lastUpdated: '2026-04-29',
    dataStatus: 'manual',
  },
  {
    company: 'Meta Platforms',
    ticker: 'META',
    quarter: '2026 Q1',
    capexDirection: 'up',
    aiRelatedComment:
      'Meta reported $19.84B of Q1 2026 capital expenditures and raised its 2026 capital-expenditure outlook to $125B-$145B from $115B-$135B.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    source:
      'Meta Q1 2026 earnings release - https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-First-Quarter-2026-Results/default.aspx',
    sourceType: 'earnings_release',
    lastUpdated: '2026-04-29',
    dataStatus: 'manual',
  },
  {
    company: 'Oracle',
    ticker: 'ORCL',
    quarter: 'FY2026 Q3',
    capexDirection: 'flat',
    aiRelatedComment:
      'Oracle kept FY2026 capital-expenditure guidance at $50B while citing large-scale AI contracts and 84% year-over-year Cloud Infrastructure revenue growth.',
    relatedThemes: ['cloud_capex'],
    relatedSoxxBuckets: ['AI Compute', 'Memory', 'Equipment'],
    source:
      'Oracle FY2026 Q3 earnings release - https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Fiscal-Year-2026-Third-Quarter-Financial-Results/default.aspx',
    sourceType: 'earnings_release',
    lastUpdated: '2026-03-10',
    dataStatus: 'manual',
  },
]

export function getWatchlistByTheme(
  themeId: string,
): AIInfraThemeWatchlistItem[] {
  return AI_INFRA_THEME_WATCHLIST.filter((item) =>
    item.themeIds.includes(themeId),
  )
}

export function getManualNewsByTheme(
  themeId: string,
): AIInfraThemeNewsItem[] {
  return AI_INFRA_MANUAL_NEWS.filter((item) => item.themeId === themeId)
}

export function getCapexNotesByCompany(
  company: string,
): AIInfraThemeCapexItem[] {
  return AI_INFRA_CAPEX_NOTES.filter((item) => item.company === company)
}

export function getCapexNotesByTheme(
  themeId: string,
): AIInfraThemeCapexItem[] {
  return AI_INFRA_CAPEX_NOTES.filter((item) =>
    item.relatedThemes.includes(themeId),
  )
}
