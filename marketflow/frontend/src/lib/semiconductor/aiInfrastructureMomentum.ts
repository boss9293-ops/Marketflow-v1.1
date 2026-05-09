import { AI_INFRA_THEME_WATCHLIST } from './aiInfrastructureManualData'

export type AIInfraMomentumPeriod = '1D' | '5D' | '1M'

export type AIInfraMomentumDataStatus =
  | 'unavailable'
  | 'partial'
  | 'available'

export type AIInfraTickerReturn = {
  ticker: string
  return1D?: number | null
  return5D?: number | null
  return1M?: number | null
  dataStatus: AIInfraMomentumDataStatus
}

export type AIInfraThemeMomentum = {
  themeId: string
  themeName: string
  period: AIInfraMomentumPeriod
  basketReturnPct: number | null
  soxxReturnPct: number | null
  relativeToSoxxPct: number | null
  tickerCount: number
  availableTickerCount: number
  missingTickers: string[]
  dataStatus: AIInfraMomentumDataStatus
}

export const AI_INFRA_MOMENTUM_PERIODS: AIInfraMomentumPeriod[] = ['1D', '5D', '1M']

export type AIInfraThemeMomentumPeriods = Record<
  AIInfraMomentumPeriod,
  AIInfraThemeMomentum
>

export type AIInfraThemeMomentumSnapshot = {
  themeId: string
  themeName: string
  periods: AIInfraThemeMomentumPeriods
}

function getReturnForPeriod(
  item: AIInfraTickerReturn | undefined,
  period: AIInfraMomentumPeriod,
): number | null {
  if (!item) return null

  const value =
    period === '1D'
      ? item.return1D
      : period === '5D'
        ? item.return5D
        : item.return1M

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildThemeMomentumFromReturns(params: {
  themeId: string
  themeName: string
  period: AIInfraMomentumPeriod
  tickerReturns: AIInfraTickerReturn[]
  soxxReturnPct?: number | null
}): AIInfraThemeMomentum {
  const watchlist = AI_INFRA_THEME_WATCHLIST.filter((item) =>
    item.themeIds.includes(params.themeId),
  )
  const tickers = watchlist.map((item) => item.ticker)
  const byTicker = new Map(
    params.tickerReturns.map((item) => [item.ticker.toUpperCase(), item]),
  )

  const values = tickers
    .map((ticker) => getReturnForPeriod(byTicker.get(ticker.toUpperCase()), params.period))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const missingTickers = tickers.filter((ticker) => {
    const item = byTicker.get(ticker.toUpperCase())
    return getReturnForPeriod(item, params.period) === null
  })

  const basketReturnPct =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null

  const soxxReturnPct =
    typeof params.soxxReturnPct === 'number' && Number.isFinite(params.soxxReturnPct)
      ? params.soxxReturnPct
      : null

  const relativeToSoxxPct =
    basketReturnPct !== null && soxxReturnPct !== null
      ? basketReturnPct - soxxReturnPct
      : null

  const dataStatus =
    values.length === 0
      ? 'unavailable'
      : missingTickers.length > 0
        ? 'partial'
        : 'available'

  return {
    themeId: params.themeId,
    themeName: params.themeName,
    period: params.period,
    basketReturnPct,
    soxxReturnPct,
    relativeToSoxxPct,
    tickerCount: tickers.length,
    availableTickerCount: values.length,
    missingTickers,
    dataStatus,
  }
}

export function buildThemeMomentumForPeriods(params: {
  themeId: string
  themeName: string
  tickerReturns: AIInfraTickerReturn[]
  soxxReturns?: {
    return1D?: number | null
    return5D?: number | null
    return1M?: number | null
  }
}): AIInfraThemeMomentum[] {
  const soxxByPeriod: Record<AIInfraMomentumPeriod, number | null | undefined> = {
    '1D': params.soxxReturns?.return1D,
    '5D': params.soxxReturns?.return5D,
    '1M': params.soxxReturns?.return1M,
  }

  return AI_INFRA_MOMENTUM_PERIODS.map((period) =>
    buildThemeMomentumFromReturns({
      themeId: params.themeId,
      themeName: params.themeName,
      period,
      tickerReturns: params.tickerReturns,
      soxxReturnPct: soxxByPeriod[period],
    }),
  )
}

export function formatMomentumPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function getMomentumStatusLabel(
  status: AIInfraThemeMomentum['dataStatus'],
): string {
  if (status === 'available') return 'Available'
  if (status === 'partial') return 'Partial'
  return 'Unavailable'
}
