import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

import { NextResponse } from 'next/server'
import { hasPromoSignals, isFreeNewsSource, scoreNewsSource, scoreNewsText } from '@/lib/newsQuality'
import { resolveNewsHistoryPath } from '@/lib/newsHistoryPaths'

export const dynamic = 'force-dynamic'

const LIVE_TARGET_HEADLINES = 5
const MIN_HEADLINES = 5
const MAX_PER_SOURCE = 1
const MAX_HISTORY_ITEMS = 720
const MAX_RESPONSE_ITEMS = 25
const SOURCE_FETCH_ATTEMPTS = 2
const SOURCE_RETRY_DELAY_MS = 250
const MIN_FEED_SCORE = 2.5
const YAHOO_MARKET_SYMBOLS = ['^GSPC', '^IXIC', '^DJI']
const HISTORY_CACHE_PATH = resolveNewsHistoryPath('market-headlines-history.json')
const GOOGLE_KR_LOCALE = { hl: 'ko-KR', gl: 'KR', ceid: 'KR:ko' }
const GOOGLE_KR_QUERIES = [
  '미국 증시',
  '뉴욕증시',
  '나스닥',
  'S&P500',
  '월가',
  '연준',
  '미국 금리',
  '엔비디아',
  '테슬라',
]

type FeedHeadline = {
  id: string
  dateET: string
  publishedAtET: string
  timeET: string
  headline: string
  source: string
  summary: string
  url: string
}

type StoredHeadlineCache = {
  updatedAt: string
  headlines: FeedHeadline[]
}

type FinnhubNewsItem = {
  id?: number
  datetime?: number
  headline?: string
  source?: string
  url?: string
  summary?: string
}

type YahooRssItem = {
  title: string
  link: string
  pubDateRaw: string
  source: string
  description: string
}

type YahooFinanceNewsItem = {
  id?: string | number
  uuid?: string
  title?: string
  headline?: string
  link?: string
  url?: string
  source?: string
  publisher?: string
  summary?: string
  description?: string
  pubTime?: number
  providerPublishTime?: number
  clickThroughUrl?: { url?: string }
  canonicalUrl?: { url?: string }
}

type SourceHealthName = 'finnhub' | 'yahoo_finance' | 'google_news_kr'

type SourceHealth = {
  name: SourceHealthName
  status: 'ok' | 'degraded' | 'down'
  items: number
  attempts: number
  error?: string
}

type HeadlinesHealth = {
  status: 'ok' | 'degraded' | 'down'
  updatedAt: string
  sources: SourceHealth[]
  message?: string
}

const normalizeHeadline = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeUrl = (value: string): string => {
  try {
    const u = new URL(value)
    return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/+$/, '')
  } catch {
    return value.toLowerCase().trim()
  }
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

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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

const parseGoogleNewsRss = (xml: string): YahooRssItem[] => {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return itemBlocks
    .map((itemXml) => {
      const rawTitle = decodeHtml(readTag(itemXml, 'title'))
      const source = decodeHtml(readTag(itemXml, 'source')) || 'Google News'
      const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)).trim() : rawTitle
      const link = decodeHtml(readTag(itemXml, 'link'))
      const pubDateRaw = decodeHtml(readTag(itemXml, 'pubDate'))
      const description = stripHtml(decodeHtml(readTag(itemXml, 'description')))
      return { title, link, pubDateRaw, source, description }
    })
    .filter((item) => item.title && item.link && item.pubDateRaw)
}

const formatDateET = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const formatTimeET = (date: Date): string =>
  `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)} ET`

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs = 4000,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
  attempts = SOURCE_FETCH_ATTEMPTS,
): Promise<{ response: Response | null; attempts: number; error?: string }> => {
  let lastError = ''
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs)
      if (response.ok) {
        return { response, attempts: attempt }
      }
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Request failed'
    }

    if (attempt < attempts) {
      await sleep(SOURCE_RETRY_DELAY_MS * attempt)
    }
  }

  return { response: null, attempts, error: lastError || 'Request failed' }
}

const buildHeadlinesHealth = (
  sources: SourceHealth[],
  liveItemCount: number,
  historyItemCount: number,
): HeadlinesHealth => {
  const activeSources = sources.filter((source) => source.status !== 'down').length
  const hasDown = sources.some((source) => source.status === 'down')
  const hasDegraded = sources.some((source) => source.status === 'degraded')
  const status: HeadlinesHealth['status'] =
    activeSources === 0 ? 'down' : hasDown || hasDegraded ? 'degraded' : 'ok'

  let message = ''
  if (activeSources === 0 && historyItemCount > 0) {
    message = 'Live providers unavailable. Serving cumulative cache.'
  } else if (activeSources === 0) {
    message = 'Live providers unavailable.'
  } else if (status === 'degraded' && liveItemCount === 0 && historyItemCount > 0) {
    message = 'Live feed partial. Showing cached headlines first.'
  } else if (status === 'degraded') {
    message = 'Live feed partial. Some providers are degraded.'
  } else {
    message = 'Live providers healthy.'
  }

  return {
    status,
    updatedAt: new Date().toISOString(),
    sources,
    message,
  }
}

const getHeadlineEpoch = (item: FeedHeadline): number => {
  const ts = Date.parse(item.publishedAtET || '')
  if (Number.isFinite(ts)) return ts
  const fallback = Date.parse(`${item.dateET}T00:00:00-05:00`)
  return Number.isFinite(fallback) ? fallback : 0
}

const sortDescByTimestamp = <T extends FeedHeadline>(items: T[]): T[] =>
  [...items].sort((a, b) => getHeadlineEpoch(b) - getHeadlineEpoch(a))

const scoreFeedHeadline = (item: FeedHeadline): number =>
  scoreNewsText(`${item.headline} ${item.summary}`) * 2 + scoreNewsSource(item.source) + getHeadlineEpoch(item) / 1e13

const isLegacyFallbackHeadline = (item: FeedHeadline): boolean =>
  item.id.startsWith('mh-fallback-')

const isFeedHeadline = (value: unknown): value is FeedHeadline => {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.dateET === 'string' &&
    typeof row.publishedAtET === 'string' &&
    typeof row.timeET === 'string' &&
    typeof row.headline === 'string' &&
    typeof row.source === 'string' &&
    typeof row.summary === 'string' &&
    typeof row.url === 'string'
  )
}

const dedupeHeadlines = (rows: FeedHeadline[], maxItems = Number.POSITIVE_INFINITY): FeedHeadline[] => {
  const seenHeadline = new Set<string>()
  const seenUrl = new Set<string>()
  const output: FeedHeadline[] = []

  for (const row of sortDescByTimestamp(rows)) {
    const hKey = normalizeHeadline(row.headline)
    const uKey = normalizeUrl(row.url)
    if (!hKey || !uKey) continue
    if (seenHeadline.has(hKey) || seenUrl.has(uKey)) continue
    seenHeadline.add(hKey)
    seenUrl.add(uKey)
    output.push(row)
    if (output.length >= maxItems) break
  }

  return output
}

const dedupeAndDiversify = (rows: FeedHeadline[]): FeedHeadline[] => {
  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = scoreFeedHeadline(b) - scoreFeedHeadline(a)
    if (scoreDiff !== 0) return scoreDiff
    return getHeadlineEpoch(b) - getHeadlineEpoch(a)
  })
  const seenHeadline = new Set<string>()
  const seenUrl = new Set<string>()
  const sourceCount = new Map<string, number>()
  const selected: FeedHeadline[] = []
  const overflow: FeedHeadline[] = []

  for (const row of sorted) {
    const hKey = normalizeHeadline(row.headline)
    const uKey = normalizeUrl(row.url)
    if (!hKey || !uKey) continue
    if (seenHeadline.has(hKey) || seenUrl.has(uKey)) continue

    const rowScore = scoreFeedHeadline(row)
    if (rowScore < MIN_FEED_SCORE) continue

    const sourceKey = row.source.toLowerCase().trim()
    const count = sourceCount.get(sourceKey) ?? 0
    if (count >= MAX_PER_SOURCE) {
      overflow.push(row)
      continue
    }

    seenHeadline.add(hKey)
    seenUrl.add(uKey)
    sourceCount.set(sourceKey, count + 1)
    selected.push(row)
    if (selected.length >= LIVE_TARGET_HEADLINES) break
  }

  if (selected.length < MIN_HEADLINES) {
    for (const row of overflow) {
      const hKey = normalizeHeadline(row.headline)
      const uKey = normalizeUrl(row.url)
      if (!hKey || !uKey) continue
      if (seenHeadline.has(hKey) || seenUrl.has(uKey)) continue
      seenHeadline.add(hKey)
      seenUrl.add(uKey)
      selected.push(row)
      if (selected.length >= LIVE_TARGET_HEADLINES) break
    }
  }

  return selected.slice(0, LIVE_TARGET_HEADLINES)
}

const mapFinnhubItem = (item: FinnhubNewsItem, idx: number): FeedHeadline | null => {
  if (!item || typeof item !== 'object') return null
  const headline = String(item.headline || '').trim()
  const source = String(item.source || '').trim()
  const url = String(item.url || '').trim()
  const timestampSec = Number(item.datetime || 0)
  if (!headline || !source || !url || !Number.isFinite(timestampSec) || timestampSec <= 0) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null
  const dt = new Date(timestampSec * 1000)
  return {
    id: `mh-fh-${item.id ?? `${timestampSec}-${idx}`}`,
    dateET: formatDateET(dt),
    publishedAtET: dt.toISOString(),
    timeET: formatTimeET(dt),
    headline,
    source,
    summary: '',
    url,
  }
}

const mapYahooRssItem = (symbol: string, item: YahooRssItem): FeedHeadline | null => {
  const published = new Date(item.pubDateRaw)
  if (Number.isNaN(published.valueOf())) return null
  const title = item.title.trim()
  const source = item.source.trim()
  const link = item.link.trim()
  if (!title || !source || !link) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(title) || hasPromoSignals(item.description)) return null
  const rawId = `${symbol}|${link}|${item.pubDateRaw}|${title}`
  return {
    id: `mh-yr-${createHash('sha1').update(rawId).digest('hex').slice(0, 16)}`,
    dateET: formatDateET(published),
    publishedAtET: published.toISOString(),
    timeET: formatTimeET(published),
    headline: title,
    source,
    summary: item.description || '',
    url: link,
  }
}

const mapYahooFinanceItem = (symbol: string, item: YahooFinanceNewsItem, idx: number): FeedHeadline | null => {
  if (!item || typeof item !== 'object') return null
  const headline = String(item.title || item.headline || '').trim()
  const source = String(item.publisher || item.source || 'Yahoo Finance').trim()
  const url = String(item.link || item.url || item.clickThroughUrl?.url || item.canonicalUrl?.url || '').trim()
  if (!headline || !source || !url) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null

  const epoch = Number(item.pubTime || item.providerPublishTime || 0)
  const published = Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000) : new Date()
  return {
    id: `mh-yf-${symbol}-${item.uuid ?? item.id ?? `${idx}`}`,
    dateET: formatDateET(published),
    publishedAtET: published.toISOString(),
    timeET: formatTimeET(published),
    headline,
    source,
    summary: String(item.summary || item.description || '').trim(),
    url,
  }
}

const mapGoogleNewsItem = (query: string, item: YahooRssItem, idx: number): FeedHeadline | null => {
  const published = new Date(item.pubDateRaw)
  if (Number.isNaN(published.valueOf())) return null
  const title = item.title.trim()
  const source = item.source.trim()
  const link = item.link.trim()
  if (!title || !source || !link) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(title) || hasPromoSignals(item.description)) return null
  return {
    id: `mh-gk-${createHash('sha1').update(`${query}|${link}|${item.pubDateRaw}|${title}`).digest('hex').slice(0, 16)}`,
    dateET: formatDateET(published),
    publishedAtET: published.toISOString(),
    timeET: formatTimeET(published),
    headline: title,
    source,
    summary: item.description || '',
    url: link,
  }
}

const readHistoryCache = async (): Promise<FeedHeadline[]> => {
  try {
    const raw = await fs.readFile(HISTORY_CACHE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as StoredHeadlineCache
    if (!parsed || !Array.isArray(parsed.headlines)) return []
    return dedupeHeadlines(
      parsed.headlines
        .filter(isFeedHeadline)
        .filter((row) => !isLegacyFallbackHeadline(row))
        .filter((row) => isFreeNewsSource(row.source) && !hasPromoSignals(`${row.headline} ${row.summary}`))
        .filter((row) => scoreFeedHeadline(row) >= MIN_FEED_SCORE),
      MAX_HISTORY_ITEMS,
    )
  } catch {
    return []
  }
}
const writeHistoryCache = async (headlines: FeedHeadline[]): Promise<void> => {
  const payload: StoredHeadlineCache = {
    updatedAt: new Date().toISOString(),
    headlines: dedupeHeadlines(headlines, MAX_HISTORY_ITEMS),
  }

  try {
    await fs.mkdir(path.dirname(HISTORY_CACHE_PATH), { recursive: true })
    await fs.writeFile(HISTORY_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf8')
  } catch (error) {
    console.warn('[market-headlines] cache write failed:', error)
  }
}

const fetchFinnhubHeadlines = async (
  key: string,
): Promise<{ items: FeedHeadline[]; health: SourceHealth }> => {
  if (!key) {
    return {
      items: [],
      health: {
        name: 'finnhub',
        status: 'down',
        items: 0,
        attempts: 0,
        error: 'FINNHUB_API_KEY missing',
      },
    }
  }

  const request = await fetchWithRetry(
    `https://finnhub.io/api/v1/news?category=general&token=${key}`,
    { cache: 'no-store' },
    4500,
  )

  if (!request.response) {
    console.warn('[market-headlines] Finnhub fetch failed:', request.error)
    return {
      items: [],
      health: {
        name: 'finnhub',
        status: 'down',
        items: 0,
        attempts: request.attempts,
        error: request.error || 'request failed',
      },
    }
  }

  try {
    const data = await request.response.json()
    const items = Array.isArray(data)
      ? data
          .map((item, idx) => mapFinnhubItem(item as FinnhubNewsItem, idx))
          .filter((row): row is FeedHeadline => Boolean(row))
      : []
    return {
      items,
      health: {
        name: 'finnhub',
        status: request.attempts > 1 ? 'degraded' : 'ok',
        items: items.length,
        attempts: request.attempts,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'json parse failed'
    console.warn('[market-headlines] Finnhub parse failed:', message)
    return {
      items: [],
      health: {
        name: 'finnhub',
        status: 'down',
        items: 0,
        attempts: request.attempts,
        error: message,
      },
    }
  }
}

const fetchYahooMarketHeadlines = async (): Promise<{ items: FeedHeadline[]; health: SourceHealth }> => {
  const results = await Promise.all(
    YAHOO_MARKET_SYMBOLS.map(async (symbol) => {
      try {
        const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
          headers: { 'User-Agent': CHROME_UA, Accept: '*/*' },
          cache: 'no-store',
        })
        const cookie = crumbRes.headers.get('set-cookie') ?? ''
        const crumbText = crumbRes.ok ? await crumbRes.text() : ''
        const crumb = crumbText.trim()
        const crumbParam = crumb && !crumb.includes('<') ? `&crumb=${encodeURIComponent(crumb)}` : ''

        const directUrl = `https://query2.finance.yahoo.com/v2/finance/news?symbols=${encodeURIComponent(symbol)}&count=20${crumbParam}`
        const directRes = await fetchWithRetry(directUrl, {
          headers: { 'User-Agent': CHROME_UA, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
          next: { revalidate: 300 },
        }, 3500)
        const directItems: YahooFinanceNewsItem[] = []
        if (directRes.response) {
          const data = await directRes.response.json()
          directItems.push(...((data?.items?.result ?? data?.news ?? []) as YahooFinanceNewsItem[]))
        }

        const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(`${symbol} stock`)}&quotesCount=0&newsCount=20&enableFuzzyQuery=false&enableNews=true${crumbParam}`
        const searchRes = await fetchWithRetry(searchUrl, {
          headers: { 'User-Agent': CHROME_UA, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
          next: { revalidate: 300 },
        }, 3500)
        const searchItems: YahooFinanceNewsItem[] = []
        if (searchRes.response) {
          const data = await searchRes.response.json()
          searchItems.push(...(Array.isArray(data?.news) ? data.news : []))
        }

        const mapped = [...directItems, ...searchItems]
          .map((item, idx) => mapYahooFinanceItem(symbol, item, idx))
          .filter((row): row is FeedHeadline => Boolean(row))

        if (!mapped.length) {
          console.warn(`[market-headlines] Yahoo Finance fetch returned no items for ${symbol}`)
          return {
            symbol,
            attempts: 1,
            items: [] as FeedHeadline[],
            error: 'no results',
          }
        }

        return {
          symbol,
          attempts: 1,
          items: mapped,
          error: '',
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed'
        console.warn(`[market-headlines] Yahoo Finance fetch failed for ${symbol}:`, message)
        return {
          symbol,
          attempts: 1,
          items: [] as FeedHeadline[],
          error: message,
        }
      }
    }),
  )

  const items = results.flatMap((row) => row.items)
  const failedCount = results.filter((row) => !!row.error).length
  const attempts = results.reduce((sum, row) => sum + row.attempts, 0)
  const hadRetry = results.some((row) => row.attempts > 1)
  const allFailed = failedCount === results.length

  return {
    items,
    health: {
      name: 'yahoo_finance',
      status: allFailed ? 'down' : failedCount > 0 || hadRetry ? 'degraded' : 'ok',
      items: items.length,
      attempts,
      error: failedCount > 0 ? `${failedCount}/${results.length} feeds failed` : undefined,
    },
  }
}

const fetchGoogleKoreanHeadlines = async (): Promise<{ items: FeedHeadline[]; health: SourceHealth }> => {
  const queries = GOOGLE_KR_QUERIES.slice(0, 6)
  const results = await Promise.allSettled(
    queries.map(async (query) => {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${GOOGLE_KR_LOCALE.hl}&gl=${GOOGLE_KR_LOCALE.gl}&ceid=${GOOGLE_KR_LOCALE.ceid}`
      const res = await fetchWithRetry(rssUrl, { next: { revalidate: 3600 } }, 3500)
      if (!res.response) return [] as YahooRssItem[]
      const xml = await res.response.text()
      return parseGoogleNewsRss(xml)
    }),
  )

  const items: FeedHeadline[] = []
  for (const [queryIdx, result] of results.entries()) {
    const parsed = result.status === 'fulfilled' ? result.value : []
    for (const [idx, item] of parsed.slice(0, 8).entries()) {
      const mapped = mapGoogleNewsItem(`${queryIdx}`, item, idx)
      if (mapped) items.push(mapped)
    }
  }

  const failedCount = results.filter((result) => result.status === 'rejected').length
  const hadRetry = false
  return {
    items,
    health: {
      name: 'google_news_kr',
      status: failedCount === results.length ? 'down' : failedCount > 0 || hadRetry ? 'degraded' : 'ok',
      items: items.length,
      attempts: results.length,
      error: failedCount > 0 ? `${failedCount}/${results.length} queries failed` : undefined,
    },
  }
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || ''
  const history = await readHistoryCache()

  const [finnhubResult, yahooResult] = await Promise.all([
    fetchFinnhubHeadlines(key),
    fetchYahooMarketHeadlines(),
  ])
  const googleKrResult = await fetchGoogleKoreanHeadlines()

  const liveFeed = dedupeAndDiversify([...finnhubResult.items, ...yahooResult.items, ...googleKrResult.items])
  const mergedHistory = dedupeHeadlines([...liveFeed, ...history], MAX_HISTORY_ITEMS)
  const health = buildHeadlinesHealth(
    [finnhubResult.health, yahooResult.health, googleKrResult.health],
    liveFeed.length,
    mergedHistory.length,
  )

  if (mergedHistory.length) {
    await writeHistoryCache(mergedHistory)
    return NextResponse.json({
      headlines: mergedHistory.slice(0, MAX_RESPONSE_ITEMS),
      health,
    })
  }

  return NextResponse.json({ headlines: [], health })
}
