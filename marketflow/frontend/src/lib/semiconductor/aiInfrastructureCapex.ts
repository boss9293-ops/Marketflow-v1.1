import {
  AI_INFRA_CAPEX_COMPANIES,
  AI_INFRA_CAPEX_NOTES,
  type AIInfraCapexCompany,
  type AIInfraThemeCapexItem,
} from './aiInfrastructureManualData'

export function getCapexCompanies(): AIInfraCapexCompany[] {
  return [...AI_INFRA_CAPEX_COMPANIES]
}

export function getCapexNotesByTicker(
  ticker: string,
): AIInfraThemeCapexItem[] {
  const normalized = ticker.trim().toUpperCase()
  return AI_INFRA_CAPEX_NOTES.filter((item) => item.ticker.toUpperCase() === normalized)
}

export function getCapexNotesByTheme(
  themeId: string,
): AIInfraThemeCapexItem[] {
  return AI_INFRA_CAPEX_NOTES.filter((item) =>
    item.relatedThemes.includes(themeId),
  )
}

export function getLatestCapexNotes(
  limit = 5,
): AIInfraThemeCapexItem[] {
  return AI_INFRA_CAPEX_NOTES.slice()
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, limit)
}

export function getCapexDirectionLabel(
  direction: AIInfraThemeCapexItem['capexDirection'],
): string {
  if (direction === 'up') return 'Increasing'
  if (direction === 'flat') return 'Stable'
  if (direction === 'down') return 'Slowing'
  return 'Unclear'
}

export function getCapexDirectionTone(
  direction: AIInfraThemeCapexItem['capexDirection'],
): 'positive' | 'neutral' | 'negative' | 'unknown' {
  if (direction === 'up') return 'positive'
  if (direction === 'flat') return 'neutral'
  if (direction === 'down') return 'negative'
  return 'unknown'
}
