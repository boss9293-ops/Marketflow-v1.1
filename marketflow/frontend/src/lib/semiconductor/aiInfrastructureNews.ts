import type { AIInfraThemeNewsItem } from './aiInfrastructureManualData'

export function getNewsByTheme(
  news: AIInfraThemeNewsItem[],
  themeId: string,
): AIInfraThemeNewsItem[] {
  return news.filter((item) => item.themeId === themeId)
}

export function getLatestThemeNews(
  news: AIInfraThemeNewsItem[],
  themeId: string,
  limit = 3,
): AIInfraThemeNewsItem[] {
  return getNewsByTheme(news, themeId)
    .slice()
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, limit)
}

export function getThemeNewsCount(
  news: AIInfraThemeNewsItem[],
  themeId: string,
): number {
  return getNewsByTheme(news, themeId).length
}

export function getThemeNewsRelevanceLabel(
  item: AIInfraThemeNewsItem,
): string {
  if (item.relevance === 'high') return 'High relevance'
  if (item.relevance === 'medium') return 'Medium relevance'
  return 'Low relevance'
}

export function getThemeNewsStatus(params: {
  newsCount: number
  dataStatus?: string
}): string {
  if (params.newsCount > 0) return 'Manual news available'
  return 'No curated news yet'
}
