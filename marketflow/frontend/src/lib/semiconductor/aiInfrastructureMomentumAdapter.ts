import type {
  AIInfraMomentumDataStatus,
  AIInfraThemeMomentumSnapshot,
  AIInfraTickerReturn,
} from './aiInfrastructureMomentum'

export type AIInfraTickerReturnsLoadResult = {
  tickerReturns: AIInfraTickerReturn[]
  soxxReturnPct: {
    return1D?: number | null
    return5D?: number | null
    return1M?: number | null
  }
  source: string
  status: AIInfraMomentumDataStatus
  warnings: string[]
}

export async function loadAIInfraTickerReturns(): Promise<AIInfraTickerReturnsLoadResult> {
  return {
    tickerReturns: [],
    soxxReturnPct: {},
    source: 'not_connected',
    status: 'unavailable',
    warnings: ['Theme basket momentum price source is not connected yet.'],
  }
}

export type AIInfraThemeMomentumLoadResult = {
  source: string
  asOf?: string | null
  status: AIInfraMomentumDataStatus
  themes: AIInfraThemeMomentumSnapshot[]
  warnings: string[]
}

const UNAVAILABLE_THEME_MOMENTUM: AIInfraThemeMomentumLoadResult = {
  source: 'not_connected',
  asOf: null,
  status: 'unavailable',
  themes: [],
  warnings: ['Theme basket momentum price source is not connected yet.'],
}

export async function loadAIInfraThemeMomentum(): Promise<AIInfraThemeMomentumLoadResult> {
  try {
    const response = await fetch('/api/ai-infra/theme-momentum', {
      cache: 'no-store',
    })

    if (!response.ok) {
      return UNAVAILABLE_THEME_MOMENTUM
    }

    const payload = (await response.json()) as AIInfraThemeMomentumLoadResult

    if (!payload || !Array.isArray(payload.themes)) {
      return UNAVAILABLE_THEME_MOMENTUM
    }

    return {
      source: payload.source || 'unknown',
      asOf: payload.asOf ?? null,
      status: payload.status || 'unavailable',
      themes: payload.themes,
      warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    }
  } catch {
    return UNAVAILABLE_THEME_MOMENTUM
  }
}
