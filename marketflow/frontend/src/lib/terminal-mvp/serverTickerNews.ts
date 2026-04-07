import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

import { ET_TIMEZONE, type ETDateString, type NewsDetail, type TickerNewsItem } from '@/lib/terminal-mvp/types'

// ── Alpaca Benzinga news item ─────────────────────────────────────────────────
type AlpacaNewsItem = {
  id: number
  headline: string
  summary: string
  author: string
  created_at: string   // ISO8601
  updated_at: string
  url: string
  images: Array<{ size: string; url: string }>
  symbols: string[]
  source: string       // e.g. "benzinga"
}

const decodeHtml = (raw: string): string =>
  raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

const stripHtml = (raw: string): string => raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const toDateET = (value: Date): ETDateString =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)

const toTimeET = (value: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(value).replace(/^24:/, '00:')

const buildIdFromAlpaca = (symbol: string, item: AlpacaNewsItem): string => {
  const raw = `${symbol}|${item.id}|${item.created_at}`
  return `${symbol.toLowerCase()}-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`
}

const inferTags = (headline: string, source: string): string[] => {
  const tokens = `${headline} ${source}`.toLowerCase()
  const tags = new Set<string>()
  if (tokens.includes('upgrade') || tokens.includes('downgrade') || tokens.includes('analyst')) tags.add('analyst')
  if (tokens.includes('earnings') || tokens.includes('revenue')) tags.add('earnings')
  if (tokens.includes('guidance')) tags.add('guidance')
  if (tokens.includes('sec') || tokens.includes('doj') || tokens.includes('investigation')) tags.add('regulatory')
  if (!tags.size) tags.add('news')
  return [...tags]
}

const inferRelevanceScore = (symbol: string, headline: string, summary: string): number => {
  const text = `${headline} ${summary}`.toUpperCase()
  const directMentionBoost = text.includes(symbol.toUpperCase()) ? 0.2 : 0
  const base = 0.5 + directMentionBoost
  return Math.max(0.35, Math.min(0.98, Number(base.toFixed(2))))
}

export type BuiltTickerNewsPayload = {
  timeline: TickerNewsItem[]
  details: NewsDetail[]
}

const TICKER_NEWS_CACHE_TTL_MS = 1000 * 60 * 30
const TICKER_NEWS_HISTORY_MAX_ITEMS = 50  // 당일치만 보관
const TICKER_NEWS_FETCH_ATTEMPTS = 2
const TICKER_NEWS_RETRY_DELAY_MS = 250
const TICKER_NEWS_HISTORY_PATH = path.join(process.cwd(), '.cache', 'ticker-news-history.json')
const tickerNewsCache = new Map<string, { expiresAt: number; payload: BuiltTickerNewsPayload }>()
const tickerNewsHistory = new Map<
  string,
  { timelineById: Map<string, TickerNewsItem>; detailsById: Map<string, NewsDetail> }
>()
let tickerHistoryLoaded = false
let tickerHistoryWriteQueue: Promise<void> = Promise.resolve()

type StoredTickerNewsPayload = {
  updatedAt: string
  symbols: Record<
    string,
    {
      timeline: TickerNewsItem[]
      details: NewsDetail[]
    }
  >
}

const clonePayload = (payload: BuiltTickerNewsPayload): BuiltTickerNewsPayload => ({
  timeline: payload.timeline.map((item) => ({ ...item })),
  details: payload.details.map((item) => ({ ...item })),
})

const sortNewsItems = <T extends { publishedAtET: string; dateET: ETDateString }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const byTimestamp = b.publishedAtET.localeCompare(a.publishedAtET)
    if (byTimestamp !== 0) return byTimestamp
    return b.dateET.localeCompare(a.dateET)
  })

const isTickerNewsItem = (value: unknown): value is TickerNewsItem => {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.symbol === 'string' &&
    typeof row.dateET === 'string' &&
    typeof row.publishedAtET === 'string' &&
    typeof row.timeET === 'string' &&
    typeof row.headline === 'string' &&
    typeof row.source === 'string' &&
    typeof row.summary === 'string' &&
    typeof row.url === 'string'
  )
}

const isNewsDetail = (value: unknown): value is NewsDetail => {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.dateET === 'string' &&
    typeof row.publishedAtET === 'string' &&
    typeof row.headline === 'string' &&
    typeof row.source === 'string' &&
    typeof row.summary === 'string'
  )
}

const loadTickerHistoryFromDisk = async (): Promise<void> => {
  if (tickerHistoryLoaded) return
  tickerHistoryLoaded = true

  try {
    const raw = await fs.readFile(TICKER_NEWS_HISTORY_PATH, 'utf8')
    const parsed = JSON.parse(raw) as StoredTickerNewsPayload
    if (!parsed || typeof parsed !== 'object' || !parsed.symbols || typeof parsed.symbols !== 'object') {
      return
    }

    for (const [symbol, payload] of Object.entries(parsed.symbols)) {
      if (!payload || typeof payload !== 'object') continue
      const timeline = Array.isArray(payload.timeline)
        ? payload.timeline.filter(isTickerNewsItem).slice(0, TICKER_NEWS_HISTORY_MAX_ITEMS)
        : []
      if (!timeline.length) continue
      const keepIds = new Set(timeline.map((item) => item.id))
      const details = Array.isArray(payload.details)
        ? payload.details.filter(isNewsDetail).filter((item) => keepIds.has(item.id))
        : []
      tickerNewsHistory.set(symbol, {
        timelineById: new Map(sortNewsItems(timeline).map((item) => [item.id, item])),
        detailsById: new Map(sortNewsItems(details).map((item) => [item.id, item])),
      })
    }
  } catch {
    // No prior cache file, or parse issue.
  }
}

const persistTickerHistoryNow = async (): Promise<void> => {
  const symbols: StoredTickerNewsPayload['symbols'] = {}

  for (const [symbol, history] of tickerNewsHistory.entries()) {
    const timeline = sortNewsItems(Array.from(history.timelineById.values())).slice(0, TICKER_NEWS_HISTORY_MAX_ITEMS)
    if (!timeline.length) continue
    const keepIds = new Set(timeline.map((item) => item.id))
    const details = sortNewsItems(Array.from(history.detailsById.values())).filter((item) => keepIds.has(item.id))
    symbols[symbol] = { timeline, details }
  }

  await fs.mkdir(path.dirname(TICKER_NEWS_HISTORY_PATH), { recursive: true })
  const payload: StoredTickerNewsPayload = {
    updatedAt: new Date().toISOString(),
    symbols,
  }
  await fs.writeFile(TICKER_NEWS_HISTORY_PATH, JSON.stringify(payload, null, 2), 'utf8')
}

const persistTickerHistoryQueued = (): Promise<void> => {
  tickerHistoryWriteQueue = tickerHistoryWriteQueue
    .then(() => persistTickerHistoryNow())
    .catch((error) => {
      console.warn('[terminal-ticker-news] history cache write failed:', error)
    })
  return tickerHistoryWriteQueue
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs = 6000,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchWithRetry = async (
  input: string,
  init: RequestInit,
  timeoutMs = 6000,
  attempts = TICKER_NEWS_FETCH_ATTEMPTS,
): Promise<Response | null> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs)
      if (response.ok) return response
    } catch {
      // noop
    }

    if (attempt < attempts) {
      await sleep(TICKER_NEWS_RETRY_DELAY_MS * attempt)
    }
  }

  return null
}

// ── Alpaca Benzinga fetch ─────────────────────────────────────────────────────
const fetchAlpacaNews = async (symbol: string): Promise<AlpacaNewsItem[]> => {
  const apiKey = (process.env.ALPACA_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()
  const secretKey = (process.env.ALPACA_SECRET_KEY ?? '').replace(/^["']|["']$/g, '').trim()
  if (!apiKey || !secretKey) return []

  // Fetch last 30 days, up to 50 articles
  const end = new Date()
  const start = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000)  // 3일치
  const params = new URLSearchParams({
    symbols: symbol,
    limit: '50',
    sort: 'desc',
    start: start.toISOString(),
    end: end.toISOString(),
  })

  const url = `https://data.alpaca.markets/v1beta1/news?${params.toString()}`
  const res = await fetchWithRetry(url, {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
    },
    next: { revalidate: 1800 },
  }, 6000)

  if (!res) return []

  const data = await res.json() as { news?: AlpacaNewsItem[] }
  return data.news ?? []
}

// ── Yahoo RSS fallback ────────────────────────────────────────────────────────
type YahooRssItem = {
  title: string
  link: string
  pubDateRaw: string
  source: string
  description: string
}

const readTag = (xmlBlock: string, tag: string): string => {
  const match = xmlBlock.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!match?.[1]) return ''
  return match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
}

const parseYahooRss = (xml: string): YahooRssItem[] => {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return itemBlocks
    .map((itemXml) => {
      const title = decodeHtml(readTag(itemXml, 'title'))
      const link = decodeHtml(readTag(itemXml, 'link'))
      const pubDateRaw = decodeHtml(readTag(itemXml, 'pubDate'))
      const source = decodeHtml(readTag(itemXml, 'source')) || 'Yahoo Finance'
      const description = stripHtml(decodeHtml(readTag(itemXml, 'description')))
      return { title, link, pubDateRaw, source, description }
    })
    .filter((item) => item.title && item.link && item.pubDateRaw)
}

const buildIdFromYahoo = (symbol: string, item: YahooRssItem): string => {
  const raw = `${symbol}|${item.link}|${item.pubDateRaw}|${item.title}`
  return `${symbol.toLowerCase()}-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`
}

// ── Build payload from Alpaca items ──────────────────────────────────────────
const buildPayloadFromAlpaca = (
  symbol: string,
  items: AlpacaNewsItem[],
): { timeline: TickerNewsItem[]; details: NewsDetail[] } => {
  const timeline: TickerNewsItem[] = []
  const details: NewsDetail[] = []

  for (const item of items) {
    const published = new Date(item.created_at)
    if (Number.isNaN(published.valueOf())) continue

    const dateET = toDateET(published)
    const timeStr = toTimeET(published)  // e.g. "09:42"
    const timeET = `${timeStr} ET`
    const publishedAtET = `${dateET}T${timeStr}:00 ET`
    const id = buildIdFromAlpaca(symbol, item)

    const headline = item.headline || ''
    const summary = item.summary || item.headline || 'Summary unavailable.'
    const source = item.source === 'benzinga' ? 'Benzinga' : (item.source || 'Alpaca News')
    const url = item.url || ''
    const tags = inferTags(headline, source)
    const relevanceScore = inferRelevanceScore(symbol, headline, summary)

    timeline.push({ id, symbol, dateET, publishedAtET, timeET, headline, source, summary, url })
    details.push({ id, symbol, dateET, publishedAtET, headline, source, summary, url, tags, relevanceScore })
  }

  return { timeline, details }
}

// ── Build payload from Yahoo RSS items (AM/PM bucket) ─────────────────────────
const buildPayloadFromYahoo = (
  symbol: string,
  parsedItems: YahooRssItem[],
): { timeline: TickerNewsItem[]; details: NewsDetail[] } => {
  type BucketSlot = { item: YahooRssItem; minuteGap: number } | null
  const buckets: Record<string, { am: BucketSlot; pm: BucketSlot }> = {}

  for (const item of parsedItems) {
    const published = new Date(item.pubDateRaw)
    if (Number.isNaN(published.valueOf())) continue

    const publishedDateET = toDateET(published)
    if (!buckets[publishedDateET]) buckets[publishedDateET] = { am: null, pm: null }

    const hhmm = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE, hour12: false, hour: '2-digit', minute: '2-digit',
    }).format(published)
    const [hourRaw, minuteRaw] = hhmm.split(':')
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue

    const slot = hour < 12 ? 'am' : 'pm'
    const minutesSinceMidnight = hour * 60 + minute
    const targetMinutes = slot === 'am' ? 9 * 60 + 30 : 16 * 60
    const minuteGap = Math.abs(minutesSinceMidnight - targetMinutes)

    const current = buckets[publishedDateET][slot]
    if (!current || minuteGap < current.minuteGap) {
      buckets[publishedDateET][slot] = { item, minuteGap }
    }
  }

  const timeline: TickerNewsItem[] = []
  const details: NewsDetail[] = []

  Object.keys(buckets).sort((a, b) => b.localeCompare(a)).forEach((d) => {
    const b = buckets[d]
    const processSlot = (slotEntry: BucketSlot, isAm: boolean) => {
      if (!slotEntry) return
      const item = slotEntry.item
      const id = buildIdFromYahoo(symbol, item)
      const summary = item.description || 'Summary unavailable from source metadata.'
      const tags = inferTags(item.title, item.source)
      const relevanceScore = inferRelevanceScore(symbol, item.title, summary)
      const timeSlot = isAm ? '09:30' : '16:00'
      const timeET = `${timeSlot} EDT`
      const publishedAtET = `${d}T${timeSlot}:00 EDT`

      timeline.push({ id, symbol, dateET: d, publishedAtET, timeET, headline: item.title, source: item.source, summary, url: item.link })
      details.push({ id, symbol, dateET: d, publishedAtET, headline: item.title, source: item.source, summary, url: item.link, tags, relevanceScore })
    }
    processSlot(b.pm, false)
    processSlot(b.am, true)
  })

  return { timeline, details }
}

// ── Main export: Alpaca first, Yahoo fallback ─────────────────────────────────
export async function fetchTickerNewsFromYahoo(symbol: string, dateET: ETDateString): Promise<BuiltTickerNewsPayload> {
  await loadTickerHistoryFromDisk()
  void dateET  // kept for API compatibility

  const cacheKey = symbol
  const now = Date.now()
  const cached = tickerNewsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return clonePayload(cached.payload)
  if (cached && cached.expiresAt <= now) tickerNewsCache.delete(cacheKey)

  let freshTimeline: TickerNewsItem[] = []
  let freshDetails: NewsDetail[] = []
  let fetchSource = 'unknown'

  // ── Try Alpaca first ────────────────────────────────────────────────────────
  try {
    const alpacaItems = await fetchAlpacaNews(symbol)
    if (alpacaItems.length > 0) {
      const built = buildPayloadFromAlpaca(symbol, alpacaItems)
      freshTimeline = built.timeline
      freshDetails = built.details
      fetchSource = 'alpaca_benzinga'
    }
  } catch {
    // fall through to Yahoo
  }

  // ── Fallback: Yahoo RSS ─────────────────────────────────────────────────────
  if (freshTimeline.length === 0) {
    try {
      const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
      const res = await fetchWithRetry(rssUrl, { next: { revalidate: 3600 } }, 4500)
      if (!res) throw new Error('Yahoo RSS request failed after retries')
      const xml = await res.text()
      const built = buildPayloadFromYahoo(symbol, parseYahooRss(xml))
      freshTimeline = built.timeline
      freshDetails = built.details
      fetchSource = 'yahoo_rss'
    } catch (error) {
      // Return stale history if available
      const stale = tickerNewsHistory.get(symbol)
      if (stale?.timelineById?.size && stale?.detailsById?.size) {
        return clonePayload({
          timeline: sortNewsItems(Array.from(stale.timelineById.values())),
          details: sortNewsItems(Array.from(stale.detailsById.values())),
        })
      }
      throw error
    }
  }

  console.log(`[ticker-news] ${symbol}: ${freshTimeline.length} items via ${fetchSource}`)

  // ── Merge into history ──────────────────────────────────────────────────────
  const symbolHistory = tickerNewsHistory.get(symbol) ?? {
    timelineById: new Map<string, TickerNewsItem>(),
    detailsById: new Map<string, NewsDetail>(),
  }

  freshTimeline.forEach((item) => symbolHistory.timelineById.set(item.id, item))
  freshDetails.forEach((item) => symbolHistory.detailsById.set(item.id, item))

  // 당일치만 보관: 오늘 ET 날짜 기준 필터링
  const todayET = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  let mergedTimeline = sortNewsItems(
    Array.from(symbolHistory.timelineById.values()).filter(item => item.dateET >= todayET)
  )
  let mergedDetails = sortNewsItems(
    Array.from(symbolHistory.detailsById.values()).filter(item => item.dateET >= todayET)
  )

  if (mergedTimeline.length > TICKER_NEWS_HISTORY_MAX_ITEMS) {
    mergedTimeline = mergedTimeline.slice(0, TICKER_NEWS_HISTORY_MAX_ITEMS)
    const keepIds = new Set(mergedTimeline.map((item) => item.id))
    mergedDetails = mergedDetails.filter((item) => keepIds.has(item.id))
  }

  symbolHistory.timelineById = new Map(mergedTimeline.map((item) => [item.id, item]))
  symbolHistory.detailsById = new Map(mergedDetails.map((item) => [item.id, item]))
  tickerNewsHistory.set(symbol, symbolHistory)
  await persistTickerHistoryQueued()

  const payload: BuiltTickerNewsPayload = { timeline: mergedTimeline, details: mergedDetails }
  tickerNewsCache.set(cacheKey, { expiresAt: now + TICKER_NEWS_CACHE_TTL_MS, payload })
  return clonePayload(payload)
}
