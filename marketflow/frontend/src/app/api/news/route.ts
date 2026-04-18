import { NextResponse } from 'next/server'

import { hasPromoSignals, isFreeNewsSource, scoreNewsSource, scoreNewsText } from '@/lib/newsQuality'

const FETCH_ATTEMPTS = 2
const RETRY_DELAY_MS = 250
const MIN_BRIEF_SCORE = 3

type BriefItem = {
  id: string
  ticker?: string
  symbol: string
  checkpointET?: string
  headline: string
  source?: string
  summary?: string
  url?: string
  dateET?: string
  publishedAtET?: string
  score?: number
}

type FinnhubNewsItem = {
  id?: number
  datetime?: number
  headline?: string
  source?: string
  url?: string
  summary?: string
}

type YahooSearchNewsItem = {
  uuid?: string
  title?: string
  link?: string
  providerPublishTime?: number
  publisher?: string
  summary?: string
}

type YahooFinanceNewsItem = {
  id?: string | number
  uuid?: string
  title?: string
  headline?: string
  link?: string
  url?: string
  publisher?: string
  source?: string
  summary?: string
  description?: string
  pubTime?: number
  providerPublishTime?: number
  clickThroughUrl?: { url?: string }
  canonicalUrl?: { url?: string }
}

type AlphaVantageNewsItem = {
  title?: string
  url?: string
  source?: string
  summary?: string
  time_published?: string
}

const formatDate = (date: Date) => date.toISOString().split('T')[0]

const toETDate = (value: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)

const toETTime = (value: Date): string =>
  `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)} ET`

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs = 4500,
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
  timeoutMs = 4500,
  attempts = FETCH_ATTEMPTS,
): Promise<Response | null> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs)
      if (response.ok) return response
    } catch {
      // noop
    }
    if (attempt < attempts) {
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
  return null
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const normalizeHeadline = (value: string): string =>
  value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
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

const recencyScore = (publishedAt?: string): number => {
  if (!publishedAt) return 0
  const ts = Date.parse(publishedAt)
  if (!Number.isFinite(ts)) return 0
  const ageHours = (Date.now() - ts) / 36e5
  if (ageHours <= 6) return 3
  if (ageHours <= 24) return 2
  if (ageHours <= 48) return 1
  return 0
}

const scoreBriefItem = (item: BriefItem): number => {
  const text = `${item.headline || ''} ${item.summary || ''}`
  return scoreNewsText(text) * 2 + recencyScore(item.publishedAtET || item.dateET) + scoreNewsSource(item.source)
}

const mapFinnhubItem = (symbol: string, item: FinnhubNewsItem, idx: number): BriefItem | null => {
  if (!item || typeof item !== 'object') return null
  const headline = String(item.headline || '').trim()
  const source = String(item.source || '').trim()
  const url = String(item.url || '').trim()
  const timestampSec = Number(item.datetime || 0)
  if (!headline || !source || !url || !Number.isFinite(timestampSec) || timestampSec <= 0) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null

  const dt = new Date(timestampSec * 1000)
  const dateET = toETDate(dt)
  return {
    id: `news-fh-${symbol}-${item.id ?? `${timestampSec}-${idx}`}`,
    ticker: symbol,
    symbol,
    checkpointET: toETTime(dt),
    headline,
    source,
    summary: String(item.summary || '').trim() || `${headline}.`,
    url,
    dateET,
    publishedAtET: dt.toISOString(),
  }
}

const mapYahooSearchItem = (symbol: string, item: YahooSearchNewsItem, idx: number): BriefItem | null => {
  const headline = String(item.title || '').trim()
  const source = String(item.publisher || 'Yahoo Finance').trim()
  const url = String(item.link || '').trim()
  if (!headline || !source || !url) return null
  if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null

  const pubTime = item.providerPublishTime ? new Date(item.providerPublishTime * 1000) : new Date()
  const dateET = toETDate(pubTime)
  return {
    id: `news-yh-${symbol}-${item.uuid || `${idx}`}`,
    ticker: symbol,
    symbol,
    checkpointET: toETTime(pubTime),
    headline,
    source,
    summary: String(item.summary || '').trim() || `${headline}.`,
    url,
    dateET,
    publishedAtET: pubTime.toISOString(),
  }
}

const dedupeAndRank = (rows: BriefItem[], maxItems = 5): BriefItem[] => {
  const sorted = [...rows].sort((a, b) => scoreBriefItem(b) - scoreBriefItem(a))
  const seenHeadline = new Set<string>()
  const seenUrl = new Set<string>()
  const output: BriefItem[] = []

  for (const row of sorted) {
    const score = scoreBriefItem(row)
    if (score < MIN_BRIEF_SCORE) continue
    const headlineKey = normalizeHeadline(row.headline)
    const urlKey = normalizeUrl(row.url || '')
    if (!headlineKey || !urlKey) continue
    if (seenHeadline.has(headlineKey) || seenUrl.has(urlKey)) continue
    seenHeadline.add(headlineKey)
    seenUrl.add(urlKey)
    output.push(row)
    if (output.length >= maxItems) break
  }

  return output
}

async function fetchFinnhubNews(symbol: string, fromDate: Date, toDate: Date): Promise<BriefItem[]> {
  const finnhubKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || ''
  if (!finnhubKey) return []

  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${formatDate(fromDate)}&to=${formatDate(toDate)}&token=${finnhubKey}`
    const res = await fetchWithRetry(url, { cache: 'no-store' }, 4500)
    if (!res) return []
    const data = await res.json()
    if (!Array.isArray(data) || !data.length) return []
    return data
      .slice(0, 12)
      .map((item, idx) => mapFinnhubItem(symbol, item as FinnhubNewsItem, idx))
      .filter((item: BriefItem | null): item is BriefItem => Boolean(item))
  } catch (err) {
    console.warn('[news API] Finnhub fetch failed:', err)
    return []
  }
}

async function fetchYahooFinanceNews(symbol: string): Promise<BriefItem[]> {
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
      cache: 'no-store',
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    }, 4500)
    if (directRes) {
      const data = await directRes.json()
      const items: YahooFinanceNewsItem[] = (data?.items?.result ?? data?.news ?? []) as YahooFinanceNewsItem[]
      if (Array.isArray(items) && items.length) {
        return items
          .slice(0, 12)
          .map((item, idx): BriefItem | null => {
            const headline = String(item.title || item.headline || '').trim()
            const source = String(item.publisher || item.source || 'Yahoo Finance').trim()
            const url = String(
              item.link
              || item.url
              || item.clickThroughUrl?.url
              || item.canonicalUrl?.url
              || '',
            ).trim()
            if (!headline || !source || !url) return null
            if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null
            const pubTime = item.pubTime
              ? new Date(item.pubTime * 1000)
              : (item.providerPublishTime ? new Date(item.providerPublishTime * 1000) : new Date())
            return {
              id: `news-yf-${symbol}-${item.uuid || item.id || `${idx}`}`,
              ticker: symbol,
              symbol,
              checkpointET: toETTime(pubTime),
              headline,
              source,
              summary: String(item.summary || item.description || '').trim() || `${headline}.`,
              url,
              dateET: toETDate(pubTime),
              publishedAtET: pubTime.toISOString(),
            }
          })
          .filter((item: BriefItem | null): item is BriefItem => Boolean(item))
      }
    }

    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(`${symbol} stock`)}&quotesCount=0&newsCount=20&enableFuzzyQuery=false&enableNews=true${crumbParam}`
    const searchRes = await fetchWithRetry(searchUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    }, 4500)
    if (!searchRes) return []
    const searchData = await searchRes.json()
    if (!searchData || !Array.isArray(searchData.news) || !searchData.news.length) return []
    return searchData.news
      .slice(0, 12)
      .map((item: YahooSearchNewsItem, idx: number): BriefItem | null => mapYahooSearchItem(symbol, item, idx))
      .filter((item: BriefItem | null): item is BriefItem => Boolean(item))
  } catch (err) {
    console.warn('[news API] Yahoo Finance fetch failed:', err)
    return []
  }
}

async function fetchAlphaVantageNews(symbol: string): Promise<BriefItem[]> {
  const avKey = process.env.ALPHA_VANTAGE_KEY || ''
  if (!avKey) return []

  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=20&apikey=${encodeURIComponent(avKey)}`
    const res = await fetchWithRetry(url, { cache: 'no-store' }, 4500)
    if (!res) return []
    const data = await res.json()
    if (data?.Note || data?.Information) return []
    const feed: AlphaVantageNewsItem[] = Array.isArray(data?.feed) ? data.feed : []
    return feed
      .slice(0, 12)
      .map((item, idx): BriefItem | null => {
        const headline = String(item.title || '').trim()
        const source = String(item.source || 'Alpha Vantage').trim()
        const url = String(item.url || '').trim()
        if (!headline || !source || !url) return null
        if (!isFreeNewsSource(source) || hasPromoSignals(headline)) return null
        const pubTime = item.time_published
          ? new Date(`${item.time_published.slice(0, 4)}-${item.time_published.slice(4, 6)}-${item.time_published.slice(6, 8)}T${item.time_published.slice(9, 11)}:${item.time_published.slice(11, 13)}:${item.time_published.slice(13, 15)}Z`)
          : new Date()
        return {
          id: `news-av-${symbol}-${item.time_published || idx}`,
          ticker: symbol,
          symbol,
          checkpointET: toETTime(pubTime),
          headline,
          source,
          summary: String(item.summary || '').trim() || `${headline}.`,
          url,
          dateET: toETDate(pubTime),
          publishedAtET: pubTime.toISOString(),
        }
      })
      .filter((item: BriefItem | null): item is BriefItem => Boolean(item))
  } catch (err) {
    console.warn('[news API] Alpha Vantage fetch failed:', err)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 })
  }

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(toDate.getDate() - 7)

  const [finnhubItems, yahooItems, avItems] = await Promise.all([
    fetchFinnhubNews(symbol, fromDate, toDate),
    fetchYahooFinanceNews(symbol),
    fetchAlphaVantageNews(symbol),
  ])

  const mapped = dedupeAndRank([...finnhubItems, ...yahooItems, ...avItems], 5)
  return NextResponse.json({ briefs: mapped })
}
