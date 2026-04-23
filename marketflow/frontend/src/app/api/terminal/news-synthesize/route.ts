import { NextResponse } from 'next/server'
import {
  TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION,
  TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER,
  buildBriefSystemPromptEN,
  buildBriefUserPromptEN,
} from '@/lib/terminal-mvp/newsSynthesizePrompts'

import fs from 'fs'
import pathModule from 'path'
import { createHash } from 'crypto'


export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NewsInputItem = {
  id: string
  dateET?: string
  publishedAtET?: string
  timeET: string
  headline: string
  summary: string
  source?: string
  url?: string
}

type SynthesizeRequest = {
  symbol: string
  companyName?: string
  marketContext?: string
  dateET?: string
  price?: number | null
  changePct?: number | null
  items: NewsInputItem[]
  lang: 'ko' | 'en'
}

type SynthesizedItem = {
  id: string
  text: string
  signal?: 'bull' | 'bear' | 'neutral'
}

type TerminalNewsProviderName = (typeof TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER)[number]

type SynthesizedBatchResult = {
  items: SynthesizedItem[]
  providerUsed?: TerminalNewsProviderName
}

const MAX_ITEMS_PER_BATCH = 20
const LOW_DENSITY_ITEM_THRESHOLD = 0
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const OPENAI_API = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'
const SYNTH_CACHE_VERSION = `v7_${TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION}_context_bound`

const containsAny = (value: string, keywords: string[]): boolean =>
  keywords.some((keyword) => value.includes(keyword))

const COMPANY_NAME_STOPWORDS = new Set([
  'inc',
  'incorporated',
  'corporation',
  'corp',
  'company',
  'co',
  'ltd',
  'limited',
  'holdings',
  'holding',
  'class',
  'common',
  'shares',
  'share',
])

const NEWS_CATALYST_KEYWORDS = [
  'earnings',
  'guidance',
  'analyst',
  'target',
  'rating',
  'upgrade',
  'downgrade',
  'revenue',
  'margin',
  'delivery',
  'deliveries',
  'shipment',
  'shipments',
  'order',
  'orders',
  'contract',
  'deal',
  'approval',
  'regulation',
  'probe',
  'tariff',
  'export',
  'supply chain',
  'ai',
  'artificial intelligence',
  'chip',
  'chips',
  'semiconductor',
  'semiconductors',
  'gpu',
  'data center',
  'datacenter',
  'cloud',
  'hyperscaler',
  'blackwell',
  'cuda',
  'inference',
  'server',
  'power',
  'oil',
  'crude',
  'rate',
  'rates',
  'inflation',
  'fed',
  'cpi',
  'ppi',
  'yield',
  'treasury',
  'geopolitical',
  'china',
  'iran',
  'israel',
  'cyber',
  'hack',
  'antitrust',
]

const NEWS_NOISE_KEYWORDS = [
  'sneaker',
  'fashion',
  'movie',
  'concert',
  'recipe',
  'celebrity',
  'sports',
  'wedding',
  'gossip',
  'travel',
  'airline',
  'hotel',
  'restaurant',
  'music',
  'beauty',
  'lifestyle',
]

const normalizeForMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[^a-z0-9\uac00-\ud7a3\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const scoreNewsItem = (
  item: NewsInputItem,
  symbol: string,
  companyName?: string,
): number => {
  const text = normalizeForMatch(`${item.headline || ''} ${item.summary || ''}`)
  const normalizedSymbol = normalizeForMatch(symbol)
  let score = 0

  if (normalizedSymbol && text.includes(normalizedSymbol)) {
    score += 6
  }

  const companyTokens = normalizeForMatch(companyName ?? '')
    .split(' ')
    .filter((token) => token.length >= 4 && !COMPANY_NAME_STOPWORDS.has(token))

  if (companyTokens.some((token) => text.includes(token))) {
    score += 4
  }

  if (containsAny(text, NEWS_CATALYST_KEYWORDS)) {
    score += 3
  }

  if (containsAny(text, NEWS_NOISE_KEYWORDS)) {
    score -= 3
  }

  if (!normalizedSymbol && !companyTokens.length) {
    score -= 1
  }

  return score
}

const selectRelevantItems = (
  batch: NewsInputItem[],
  symbol: string,
  companyName?: string,
): NewsInputItem[] => {
  const scored = batch.map((item, index) => ({
    item,
    index,
    score: scoreNewsItem(item, symbol, companyName),
  }))

  let selected = scored.filter((entry) => entry.score >= 1)

  if (selected.length > 12) {
    selected = [...selected]
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 12)
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.item)
}



const getCurrentEtDate = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.')
  }

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 3200,
      temperature: 0.35,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Anthropic API ${response.status}: ${errorText}`)
  }

  const data = await response.json() as {
    content?: Array<{ type?: string; text?: string }>
    model?: string
  }
  const text = data.content?.find((part) => part.type === 'text')?.text?.trim() ?? ''
  if (!text) {
    throw new Error('Anthropic empty response.')
  }
  return text
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`OpenAI API ${response.status}: ${errorText}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) {
    throw new Error('OpenAI empty response.')
  }
  return text
}

const KO_NAMES: Record<string, string> = {
  TSLA: '테슬라', NVDA: '엔비디아', AAPL: '애플', MSFT: '마이크로소프트',
  GOOGL: '구글', GOOG: '구글', META: '메타', AMZN: '아마존', NFLX: '넷플릭스',
  AMD: 'AMD', INTC: '인텔', COIN: '코인베이스', PLTR: '팔란티어',
  SOXL: 'SOXL', TQQQ: 'TQQQ', SQQQ: 'SQQQ', SPY: 'S&P500 ETF', QQQ: '나스닥100 ETF',
  MSTR: '마이크로스트래티지', MARA: '마라홀딩스', RIOT: '라이엇플랫폼스',
  SMCI: 'SMCI', CRWD: '크라우드스트라이크', SNOW: '스노우플레이크',
  UBER: '우버', SHOP: '쇼피파이', ABNB: '에어비앤비', SQ: '블록',
}

// Module-level synthesis cache: key = "{symbol}:{dateET}:{lang}"
const synthCache = new Map<string, { result: SynthesizedItem[]; providerUsed?: TerminalNewsProviderName; cachedAt: number }>()
const SYNTH_CACHE_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

// -- Trading day utilities --
const US_MARKET_HOLIDAYS = new Set([
  '2025-01-01','2025-01-20','2025-02-17','2025-04-18','2025-05-26',
  '2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
])

function isMarketOpen(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z')
  const dow = d.getUTCDay()
  return dow !== 0 && dow !== 6 && !US_MARKET_HOLIDAYS.has(dateStr)
}

function getLastTradingDays(fromDateET: string, count = 4): Set<string> {
  const result: string[] = []
  const d = new Date(fromDateET + 'T12:00:00Z')
  while (result.length < count) {
    const ds = d.toISOString().slice(0, 10)
    if (isMarketOpen(ds)) result.push(ds)
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return new Set(result)
}

function pruneToTradingDays<T>(cache: Record<string, T>, todayET: string): Record<string, T> {
  const keep = getLastTradingDays(todayET, 4)
  const pruned: Record<string, T> = {}
  for (const [k, v] of Object.entries(cache)) {
    const dateKey = k.split(':')[1] ?? ''
    if (keep.has(dateKey)) pruned[k] = v
  }
  return pruned
}

// -- EN synthesis file cache (prevents repeated LLM calls after server restart) --
const SYNTH_EN_CACHE_FILE = pathModule.join(process.cwd(), '.cache', 'synth-en-cache.json')
type SynthEnEntry = { text: string; signal: string; provider_used?: TerminalNewsProviderName }

function loadSynthEnCache(): Record<string, SynthEnEntry> {
  try {
    const dir = pathModule.dirname(SYNTH_EN_CACHE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(SYNTH_EN_CACHE_FILE)) return {}
    return JSON.parse(fs.readFileSync(SYNTH_EN_CACHE_FILE, 'utf-8')) as Record<string, SynthEnEntry>
  } catch { return {} }
}

function saveSynthEnCache(cache: Record<string, SynthEnEntry>): void {
  try { fs.writeFileSync(SYNTH_EN_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8') }
  catch (err) { console.error('[synth-en-cache] write error:', err) }
}

// -- DeepL translation with 5-trading-day file cache --
const DEEPL_CACHE_FILE = pathModule.join(process.cwd(), '.cache', 'deepl-ko-cache.json')

function loadDeeplFileCache(): Record<string, string> {
  try {
    const dir = pathModule.dirname(DEEPL_CACHE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DEEPL_CACHE_FILE)) return {}
    return JSON.parse(fs.readFileSync(DEEPL_CACHE_FILE, 'utf-8')) as Record<string, string>
  } catch { return {} }
}

function saveDeeplFileCache(cache: Record<string, string>): void {
  try { fs.writeFileSync(DEEPL_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8') }
  catch (err) { console.error('[deepl-cache] write error:', err) }
}

const cachePriceKey = (price?: number | null): string =>
  price != null && Number.isFinite(price) ? price.toFixed(2) : 'na'

const cacheChangeKey = (changePct?: number | null): string =>
  changePct != null && Number.isFinite(changePct) ? changePct.toFixed(2) : 'na'

const cacheTextKey = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const buildBatchSignature = (items: NewsInputItem[]): string =>
  createHash('sha1')
    .update(
      items
        .map((item) =>
          [
            item.id,
            item.dateET ?? '',
            item.publishedAtET ?? '',
            item.timeET ?? '',
            item.headline ?? '',
            item.summary ?? '',
          ].join('|'),
        )
        .join('\n'),
    )
    .digest('hex')
    .slice(0, 12)

async function translateToKoViaDeepl(
  enText: string,
  symbol: string,
  dateET: string,
  priceKey: string,
  changeKey: string,
  companyKey: string,
  marketContextKey: string,
  batchSignature: string,
): Promise<string | null> {
  const DEEPL_KEY = Object.entries(process.env).find(([k]) => k.trim().toLowerCase() === 'deepl_api_key')?.[1]?.trim() ?? ''
  if (!DEEPL_KEY) return null

  const cacheKey = `${symbol}:${dateET}:${SYNTH_CACHE_VERSION}:${priceKey}:${changeKey}:${companyKey}:${marketContextKey}:${batchSignature}`
  let fileCache = pruneToTradingDays(loadDeeplFileCache(), dateET)
  if (fileCache[cacheKey]) {
    console.log(`[deepl] cache hit: ${cacheKey}`)
    return fileCache[cacheKey]
  }
  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [enText], target_lang: 'KO' }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) { console.error('[deepl] error:', res.status); return null }
    const data = await res.json() as { translations?: { text: string }[] }
    const koText = data.translations?.[0]?.text ?? null
    if (koText) { fileCache[cacheKey] = koText; saveDeeplFileCache(fileCache); console.log(`[deepl] cached: ${cacheKey}`) }
    return koText
  } catch (err) { console.error('[deepl] exception:', err); return null }
}


function getSynthCacheKey(symbol: string, dateET: string, lang: string, priceKey: string) {
  return `${symbol}:${dateET}:${lang}:${SYNTH_CACHE_VERSION}:${priceKey}`
}

function cleanSynthCache(keepDateET: string) {
  const cutoff = Date.now() - SYNTH_CACHE_TTL_MS
  for (const [key, entry] of synthCache) {
    if (entry.cachedAt < cutoff || !key.includes(`:${keepDateET}:`)) {
      synthCache.delete(key)
    }
  }
}

const TERMINAL_NEWS_PROVIDER_CALLS: Record<TerminalNewsProviderName, (systemPrompt: string, userPrompt: string) => Promise<string>> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
}

const invokeTerminalProvider = (
  providerName: TerminalNewsProviderName,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => TERMINAL_NEWS_PROVIDER_CALLS[providerName](systemPrompt, userPrompt)

const runTerminalProviderSequence = async (
  providerOrder: readonly TerminalNewsProviderName[],
  systemPrompt: string,
  userPrompt: string,
): Promise<{ raw: string; provider: TerminalNewsProviderName } | null> => {
  for (const providerName of providerOrder) {
    try {
      const raw = await invokeTerminalProvider(providerName, systemPrompt, userPrompt)
      if (raw.trim()) {
        return { raw, provider: providerName }
      }
    } catch (err) {
      console.error(`[news-synthesize] provider error (${providerName}):`, err)
    }
  }

  return null
}

// ── DeepL translation with daily file cache ──
async function synthesizeBatch(
  symbol: string,
  batch: NewsInputItem[],
  lang: 'ko' | 'en',
  companyName?: string,
  marketContext?: string,
  price?: number | null,
  changePct?: number | null,
  dateET?: string,
): Promise<SynthesizedBatchResult> {
  const selected = selectRelevantItems(batch, symbol, companyName)
  if (selected.length === 0) return { items: [] }
  const priceKey = cachePriceKey(price)
  const changeKey = cacheChangeKey(changePct)
  const companyKey = cacheTextKey(companyName)
  const marketContextKey = cacheTextKey(marketContext)
  const batchSignature = buildBatchSignature(selected)

  // Build price-lead first sentence
  const direction = (changePct ?? 0) > 0 ? 'up' : (changePct ?? 0) < 0 ? 'down' : 'unchanged'
  const priceStr = price != null ? ` at $${price.toFixed(2)}` : ''
  const pctStr = changePct != null ? ` ${(changePct > 0 ? '+' : '') + changePct.toFixed(2)}%` : ''
  const koName = KO_NAMES[symbol] || (companyName ? companyName.replace(/\s*(Inc|Corp|Ltd|LLC|Co)\.?$/i, '') : symbol)
  const koDir = (changePct ?? 0) > 0 ? '상승' : (changePct ?? 0) < 0 ? '하락' : '보합'
  const koPct = changePct != null ? `${Math.abs(changePct).toFixed(2)}%` : ''
  const koPrice = price != null ? ` $${price.toFixed(2)}에` : ''
  const leadSentenceEN = `${symbol} closed ${direction}${pctStr}${priceStr},`
  const leadSentence = lang === 'ko'
    ? `${koName}(${symbol})는 ${koPct} ${koDir}하며${koPrice} 마감했다,`
    : leadSentenceEN

  // Check in-memory cache
  const effectiveDateET = dateET || getCurrentEtDate()
  const cacheKey = `${getSynthCacheKey(symbol, effectiveDateET, lang, priceKey)}:${changeKey}:${companyKey}:${marketContextKey}:${batchSignature}`
  const cached = synthCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < SYNTH_CACHE_TTL_MS) {
    return { items: cached.result, providerUsed: cached.providerUsed }
  }
  cleanSynthCache(effectiveDateET)

  // EN file cache check — zero token cost on hit
  const enCacheKey = `${symbol}:${effectiveDateET}:${SYNTH_CACHE_VERSION}:${priceKey}:${changeKey}:${companyKey}:${marketContextKey}:${batchSignature}`
  let enFileCache = loadSynthEnCache()
  const cachedEN = enFileCache[enCacheKey]
  let enText: string
  let signal: 'bull' | 'bear' | 'neutral'
  let providerUsed: TerminalNewsProviderName | undefined

  if (cachedEN) {
    enText = cachedEN.text
    signal = (cachedEN.signal as 'bull' | 'bear' | 'neutral') ?? 'neutral'
    providerUsed = cachedEN.provider_used
    console.log(`[synth-en] file cache hit: ${enCacheKey}`)
  } else {
    // LLM call — always English (one call serves both EN display and DeepL-KO)
    const systemPrompt = buildBriefSystemPromptEN()
    const userPrompt = buildBriefUserPromptEN(
      symbol,
      leadSentenceEN,
      selected,
      effectiveDateET,
      companyName || undefined,
      marketContext || undefined,
    )
    const providerResult = await runTerminalProviderSequence(
      TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER,
      systemPrompt,
      userPrompt,
    )
    if (!providerResult) {
      return { items: [{ id: selected[0].id, text: leadSentenceEN, signal: 'neutral' as const }] }
    }

    providerUsed = providerResult.provider
    const raw = providerResult.raw
    enText = raw.trim()
    signal = 'neutral'
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>
        enText = typeof parsed.text === 'string' ? parsed.text.trim() : raw.trim()
        const rawSig = parsed.signal
        signal = rawSig === 'bull' || rawSig === 'bear' ? rawSig : 'neutral'
      }
    } catch {}
    // Persist EN — no re-LLM after server restart
    enFileCache = pruneToTradingDays(enFileCache, effectiveDateET)
    enFileCache[enCacheKey] = { text: enText, signal, provider_used: providerUsed }
    saveSynthEnCache(enFileCache)
  }

  if (lang === 'en') {
    const result = [{ id: selected[0].id, text: enText, signal }]
    synthCache.set(cacheKey, { result, providerUsed, cachedAt: Date.now() })
    return { items: result, providerUsed }
  }

  // KO: DeepL translation (file-cached per 5 trading days) — zero token cost
  const koText = await translateToKoViaDeepl(
    enText,
    symbol,
    effectiveDateET,
    priceKey,
    changeKey,
    companyKey,
    marketContextKey,
    batchSignature,
  ) ?? leadSentence
  const result = [{ id: selected[0].id, text: koText, signal }]
  synthCache.set(cacheKey, { result, providerUsed, cachedAt: Date.now() })
  return { items: result, providerUsed }
}

export async function POST(req: Request) {
  let body: SynthesizeRequest
  try {
    body = (await req.json()) as SynthesizeRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : ''
  const items = Array.isArray(body.items) ? body.items : []
  const lang = body.lang === 'en' ? 'en' : 'ko'
  const marketContext = typeof body.marketContext === 'string' ? body.marketContext.trim() : ''
  const dateET = typeof body.dateET === 'string' ? body.dateET.trim() : ''
  const price = typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : null
  const changePct = typeof body.changePct === 'number' && Number.isFinite(body.changePct) ? body.changePct : null

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol.' }, { status: 400 })
  }
  if (!items.length) {
    return NextResponse.json({ error: 'Missing items.' }, { status: 400 })
  }

  const effectiveDateET = dateET || getCurrentEtDate()
  const resolvedDateET = Array.from(getLastTradingDays(effectiveDateET, 1))[0] ?? effectiveDateET

  const batch = items
    .slice(0, MAX_ITEMS_PER_BATCH)
    .map((item, index) => ({
      id: String(item.id || `item-${index}`),
      dateET: typeof item.dateET === 'string' ? item.dateET.trim() : '',
      publishedAtET: typeof item.publishedAtET === 'string' ? item.publishedAtET.trim() : '',
      timeET: String(item.timeET || (index % 2 === 0 ? '09:30' : '16:30')),
      headline: String(item.headline || '').trim(),
      summary: String(item.summary || '').trim(),
      source: String(item.source || '').trim(),
      url: String(item.url || '').trim(),
    }))
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''

  try {
    const synthesis = await synthesizeBatch(
      symbol,
      batch,
      lang,
      companyName || undefined,
      marketContext || undefined,
      price,
      changePct,
      resolvedDateET,
    )
    const results = synthesis.items
    return NextResponse.json({
      results,
      digest: results[0]?.text ?? null,
      digestSignal: results[0]?.signal ?? null,
      meta: {
        inputItems: batch.length,
        selectedItems: results.length,
        digestAvailable: results.length > 0,
        prompt_version: TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION,
        provider_order: TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER,
        provider_used: synthesis.providerUsed ?? null,
      },
    })
  } catch (err) {
    console.error('[news-synthesize] error:', err)
    return NextResponse.json({ error: 'Synthesis failed.' }, { status: 500 })
  }
}
