import { clientApiUrl } from '@/lib/backendApi'
import {
  McpPriceConfirmation,
  McpOutputMeta,
  McpRiskPressure,
  McpSignalQuality,
  McpTerminalEventFeedContext,
  McpTerminalEventItem,
  McpWatchlistNewsContext,
  McpWatchlistNewsItem,
  sampleTerminalWatchlistMcpContext,
} from '@/lib/mcp/terminalWatchlistContract'

const DEFAULT_UNIVERSE = ['SPY', 'QQQ', 'SOXX', 'NVDA', 'TSLA', 'AMD', 'AVGO']
const PRICE_CONFIRMATION_VALUES = new Set<McpPriceConfirmation>(['confirmed', 'weak', 'conflict', 'unclear'])
const RISK_PRESSURE_VALUES = new Set<McpRiskPressure>(['low', 'medium', 'high', 'unclear'])
const SIGNAL_QUALITY_VALUES = new Set<McpSignalQuality>([
  'strong_confirmation',
  'weak_confirmation',
  'conflict',
  'noise',
  'unclear',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function normalizeMeta(value: unknown): McpOutputMeta {
  const meta = asRecord(value)
  const source: McpOutputMeta['source'] = meta.source === 'cache' ? 'cache' : 'fallback'
  return {
    ...meta,
    source,
    live_api_call_attempted: false as const,
  }
}

function normalizeTerminalItem(value: unknown, index: number): McpTerminalEventItem {
  const item = asRecord(value)
  const rawConfirmation = asString(item.price_confirmation, 'unclear') as McpPriceConfirmation
  const priceConfirmation = PRICE_CONFIRMATION_VALUES.has(rawConfirmation) ? rawConfirmation : 'unclear'

  return {
    rank: asNumber(item.rank, index + 1, 1, 999),
    symbol: asString(item.symbol, 'MARKET'),
    event_type: asString(item.event_type, 'news'),
    headline: asString(item.headline, 'MCP context is not available yet.'),
    event_strength: asNumber(item.event_strength, 0, 0, 1),
    price_confirmation: priceConfirmation,
    risk_context: asString(item.risk_context, 'Risk Pressure unclear.'),
    why_it_matters: asString(item.why_it_matters, 'MCP context is not available yet.'),
    terminal_line: asString(item.terminal_line, 'MCP context is not available yet.'),
  }
}

function normalizeWatchlistItem(value: unknown): McpWatchlistNewsItem {
  const item = asRecord(value)
  const rawRisk = asString(item.risk_pressure, 'unclear') as McpRiskPressure
  const riskPressure = RISK_PRESSURE_VALUES.has(rawRisk) ? rawRisk : 'unclear'
  const rawSignal = asString(item.signal_quality, 'unclear') as McpSignalQuality
  const signalQuality = SIGNAL_QUALITY_VALUES.has(rawSignal) ? rawSignal : 'unclear'

  return {
    symbol: asString(item.symbol, 'MARKET'),
    attention_score: asNumber(item.attention_score, 0, 0, 100),
    main_event: asString(item.main_event, 'MCP context is not available yet.'),
    related_events: asStringArray(item.related_events),
    risk_pressure: riskPressure,
    signal_quality: signalQuality,
    watchlist_line: asString(item.watchlist_line, 'MCP context is not available yet.'),
  }
}

export function normalizeTerminalEventFeedContext(payload: unknown): McpTerminalEventFeedContext {
  const fallback = sampleTerminalWatchlistMcpContext.terminal_event_feed_context
  const record = asRecord(payload)
  const rows = Array.isArray(record.top_events) ? record.top_events : fallback.top_events

  return {
    date: asString(record.date, fallback.date),
    mode: 'terminal',
    top_events: rows.map(normalizeTerminalItem),
    market_context: asRecord(record.market_context),
    risk_context: asRecord(record.risk_context),
    _meta: normalizeMeta(record._meta),
  }
}

export function normalizeWatchlistNewsContext(payload: unknown): McpWatchlistNewsContext {
  const fallback = sampleTerminalWatchlistMcpContext.watchlist_news_context
  const record = asRecord(payload)
  const rows = Array.isArray(record.ranked_watchlist_news)
    ? record.ranked_watchlist_news
    : fallback.ranked_watchlist_news

  return {
    mode: 'watchlist',
    ranked_watchlist_news: rows.map(normalizeWatchlistItem),
    _meta: normalizeMeta(record._meta),
  }
}

async function fetchJsonOrNull(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function fetchTerminalEventFeedContext(): Promise<McpTerminalEventFeedContext> {
  const query = new URLSearchParams({
    universe: DEFAULT_UNIVERSE.join(','),
    lookback_days: '3',
    mode: 'terminal',
  })
  const payload = await fetchJsonOrNull(clientApiUrl(`/api/mcp/terminal-event-feed-context?${query.toString()}`))
  return normalizeTerminalEventFeedContext(payload)
}

export async function fetchWatchlistNewsContext(): Promise<McpWatchlistNewsContext> {
  const query = new URLSearchParams({
    symbols: DEFAULT_UNIVERSE.join(','),
    lookback_days: '3',
    mode: 'watchlist',
  })
  const payload = await fetchJsonOrNull(clientApiUrl(`/api/mcp/watchlist-news-context?${query.toString()}`))
  return normalizeWatchlistNewsContext(payload)
}
