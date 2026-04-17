import { NextResponse } from 'next/server'
import { readCacheJsonOrNull } from '@/lib/readCacheJson'
import { truncateText } from '@/lib/text/vrTone'
import { clusterNewsItems } from '@/lib/terminal-mvp/clusterEngine'
import { buildConfidenceProfile } from '@/lib/terminal-mvp/confidenceEngine'
import { buildRelativeView, type MarketTapeItem } from '@/lib/terminal-mvp/multiSymbolEngine'
import { buildNarrativeSpine } from '@/lib/terminal-mvp/narrativeSpineBuilder'
import { renderNarrativeBrief } from '@/lib/terminal-mvp/narrativeRenderer'
import { buildPriceAnchorLayer } from '@/lib/terminal-mvp/priceAnchorLayer'
import { buildSessionThesis } from '@/lib/terminal-mvp/sessionThesisEngine'
import { buildTimelineFlow } from '@/lib/terminal-mvp/timelineEngine'

import fs from 'fs'
import pathModule from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NewsInputItem = {
  id: string
  timeET: string
  headline: string
  summary: string
}

type NewsSynthSession = 'morning' | 'afternoon' | 'auto'

type SynthesizeRequest = {
  symbol: string
  companyName?: string
  dateET?: string
  price?: number | null
  changePct?: number | null
  items: NewsInputItem[]
  lang: 'ko' | 'en'
  marketContext?: string
  session?: NewsSynthSession
}

type SynthesizedItem = {
  id: string
  text: string
  signal?: 'bull' | 'bear' | 'neutral'
}

type ItemBlock = {
  item: NewsInputItem
  sessionHint: 'morning' | 'afternoon'
}

const MAX_ITEMS_PER_BATCH = 20
const LOW_DENSITY_ITEM_THRESHOLD = 0
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const OPENAI_API = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'

const stripCodeFences = (value: string): string =>
  value.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9\uac00-\ud7a3\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseClockMinutes = (value: string): number | null => {
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const inferSessionHint = (timeET: string): 'morning' | 'afternoon' => {
  const minutes = parseClockMinutes(timeET)
  if (minutes == null) return 'afternoon'
  return minutes < 12 * 60 ? 'morning' : 'afternoon'
}

const sentenceCount = (value: string): number =>
  value
    .split(/[.!?]+/u)
    .map((part) => part.trim())
    .filter(Boolean).length

const countNonSpaceChars = (value: string): number => value.replace(/\s+/gu, '').length

const containsAny = (value: string, keywords: string[]): boolean =>
  keywords.some((keyword) => value.includes(keyword))

const hasKoreanFinal = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  const last = trimmed.charCodeAt(trimmed.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return false
  return (last - 0xac00) % 28 !== 0
}

const particle = (value: string, consonant: string, vowel: string): string =>
  hasKoreanFinal(value) ? consonant : vowel

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



type EventCard = {
  eventType: string
  summary: string
  direction: 'positive' | 'negative' | 'neutral'
  impactHint: string
  source: string
  timeET: string
  sessionHint: 'morning' | 'afternoon'
  score: number
  confidence: number
}

type NarrativeSlot = {
  event: string
  why: string
  direction: 'positive' | 'negative' | 'neutral'
  score: number
  source: string
}

const EVENT_TYPE_RULES: Array<{
  type: string
  keywords: string[]
  impactHint: string
  priority: number
}> = [
  { type: 'analyst_action', keywords: ['price target', 'target', 'upgrade', 'downgrade', 'rating', 'analyst'], impactHint: 'valuation / expectations', priority: 5 },
  { type: 'earnings', keywords: ['earnings', 'guidance', 'revenue', 'margin', 'eps', 'sales'], impactHint: 'earnings / margin', priority: 5 },
  { type: 'delivery', keywords: ['delivery', 'deliveries', 'shipment', 'shipments', 'production', 'orders'], impactHint: 'demand / supply', priority: 4 },
  { type: 'macro_event', keywords: ['cpi', 'ppi', 'fed', 'powell', 'rates', 'yield', 'inflation', 'dollar', 'treasury'], impactHint: 'macro / rates', priority: 4 },
  { type: 'geopolitical', keywords: ['iran', 'hormuz', 'tariff', 'trump', 'war', 'attack', 'strike', 'ceasefire'], impactHint: 'geo / policy', priority: 4 },
  { type: 'product_cycle', keywords: ['launch', 'release', 'product', 'model', 'chip', 'platform', 'software', 'ai', 'gpu', 'data center', 'blackwell', 'cuda'], impactHint: 'product cycle', priority: 3 },
  { type: 'risk', keywords: ['probe', 'lawsuit', 'recall', 'investigation', 'ban', 'regulation', 'fraud'], impactHint: 'risk / legal', priority: 5 },
  { type: 'technical_setup', keywords: ['breakout', 'support', 'resistance', 'record high', 'record low', 'range'], impactHint: 'technical setup', priority: 3 },
  { type: 'sector_rotation', keywords: ['semiconductor', 'energy', 'oil', 'gold', 'utilities', 'software', 'health care', 'bank'], impactHint: 'sector rotation', priority: 3 },
]

const POSITIVE_HINTS = [
  'beat',
  'beats',
  'raise',
  'raised',
  'upgrade',
  'higher',
  'increase',
  'increased',
  'surge',
  'rally',
  'gain',
  'gains',
  'support',
  'approval',
  'launch',
  'deal',
  'contract',
  'record',
  'strong',
  'improve',
  'improved',
  'expansion',
  'buy',
  'outperform',
  'breakout',
  'recover',
  'recovery',
  'bull',
  'upside',
]

const NEGATIVE_HINTS = [
  'miss',
  'cuts',
  'cut',
  'lower',
  'downgrade',
  'weak',
  'decline',
  'slump',
  'pressure',
  'probe',
  'investigation',
  'risk',
  'concern',
  'tariff',
  'ban',
  'lawsuit',
  'recall',
  'delay',
  'shortfall',
  'selloff',
  'drop',
  'fall',
  'negative',
  'downside',
]

const eventDirection = (text: string): 'positive' | 'negative' | 'neutral' => {
  const lower = normalizeForMatch(text)
  const pos = POSITIVE_HINTS.filter((hint) => lower.includes(hint)).length
  const neg = NEGATIVE_HINTS.filter((hint) => lower.includes(hint)).length
  if (pos > neg + 1) return 'positive'
  if (neg > pos + 1) return 'negative'
  return 'neutral'
}

const eventTypeFromText = (text: string): { eventType: string; impactHint: string; direction: 'positive' | 'negative' | 'neutral'; priority: number } => {
  const lower = normalizeForMatch(text)
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      const direction = rule.type === 'risk' ? 'negative' : eventDirection(lower)
      return {
        eventType: rule.type,
        impactHint: rule.impactHint,
        direction,
        priority: rule.priority,
      }
    }
  }
  return {
    eventType: 'market_update',
    impactHint: 'broad market read-through',
    direction: eventDirection(lower),
    priority: 1,
  }
}

const eventCardScore = (card: EventCard, rank: number, total: number): number => {
  const directWeight =
    card.eventType === 'analyst_action' || card.eventType === 'earnings'
      ? 1.0
      : card.eventType === 'delivery' || card.eventType === 'macro_event' || card.eventType === 'geopolitical'
        ? 0.95
        : card.eventType === 'risk'
          ? 0.9
          : card.eventType === 'product_cycle'
            ? 0.8
            : 0.65

  const recency = 1.0 - ((rank / Math.max(1, total - 1)) * 0.3)
  const magnitude = containsAny(
    `${card.summary} ${card.impactHint}`,
    ['record', 'target', 'beat', 'miss', 'guidance', 'delivery', 'cpi', 'fed', 'tariff', 'breakout', 'deal', 'approval'],
  )
    ? 1.0
    : 0.6
  const directionBoost = card.direction === 'neutral' ? 0.78 : 1.0
  const score = (directWeight * 0.4) + (recency * 0.2) + (magnitude * 0.2) + (directionBoost * 0.2)
  return Math.max(0.05, Math.min(0.99, Number(score.toFixed(3))))
}

const buildEventCards = (batch: ItemBlock[], symbol: string, companyName?: string): EventCard[] => {
  const symbolToken = normalizeForMatch(symbol)
  const companyTokens = normalizeForMatch(companyName ?? '')
    .split(' ')
    .filter((token) => token.length >= 4)

  const cards = batch.map((block, rank) => {
    const combined = `${block.item.headline || ''} ${block.item.summary || ''}`.trim()
    const classified = eventTypeFromText(combined)
    const summary = stripLeadingNumbering(
      truncateText(
        block.item.summary?.trim()
          ? `${block.item.headline.trim()}. ${block.item.summary.trim()}`
          : block.item.headline.trim(),
        240,
      ),
    )
    const symbolHit = symbolToken && normalizeForMatch(combined).includes(symbolToken)
    const companyHit = companyTokens.some((token) => normalizeForMatch(combined).includes(token))
    const catalystHit = containsAny(normalizeForMatch(combined), NEWS_CATALYST_KEYWORDS)
    const noiseHit = containsAny(normalizeForMatch(combined), NEWS_NOISE_KEYWORDS)
    const boostedDirection =
      classified.direction === 'neutral'
        ? (symbolHit || companyHit || catalystHit ? eventDirection(combined) : 'neutral')
        : classified.direction

    const card: EventCard = {
      eventType: classified.eventType,
      summary,
      direction: boostedDirection,
      impactHint: classified.impactHint,
      source: 'news-batch',
      timeET: block.item.timeET || '',
      sessionHint: block.sessionHint,
      score: 0,
      confidence: 0,
    }

    const score = eventCardScore(card, rank, batch.length)
    const penalty = noiseHit ? 0.12 : 0
    card.score = Math.max(0.05, Math.min(0.99, Number((score - penalty).toFixed(3))))
    card.confidence = Math.max(0.1, Math.min(0.99, Number((card.score + (symbolHit || companyHit ? 0.05 : 0)).toFixed(2))))
    return card
  })

  return cards
    .sort((a, b) => b.score - a.score || a.timeET.localeCompare(b.timeET))
    .slice(0, 12)
}

const compactEventLabel = (value: string): string => {
  const cleaned = stripLeadingNumbering(value)
    .replace(/\s+/gu, ' ')
    .trim()

  if (!cleaned) return ''

  const driverMatch = cleaned.match(
    /(?:driven by|supported by|backed by|helped by|boosted by|from|amid|on|as)\s+(.+?)(?:[.;]|, while|, with| while | with |$)/i,
  )
  if (driverMatch?.[1]) {
    return truncateText(driverMatch[1].trim(), 140)
  }

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/u)[0] ?? cleaned
  return truncateText(firstSentence.replace(/[^a-z0-9가-힣\s.,;:/'"()\-+%$]/giu, '').trim(), 140)
}

const buildNarrativePlan = (
  cards: EventCard[],
  symbol: string,
  companyName?: string,
  marketContext?: string,
): {
  price_context: string
  primary_driver: NarrativeSlot
  secondary_driver: NarrativeSlot
  counterweight: NarrativeSlot
  watchpoint: NarrativeSlot
  supporting_events: NarrativeSlot[]
} => {
  const marketContextHint = marketContext?.trim() || 'N/A'
  const label = [symbol, companyName].filter(Boolean).join(' / ') || symbol
  const priceContext = cards[0]?.summary?.trim()
    || (marketContextHint !== 'N/A' ? `Market context: ${marketContextHint}` : `Ticker context: ${label}`)

  if (!cards.length) {
    return {
      price_context: priceContext,
      primary_driver: { event: '', why: '', direction: 'neutral', score: 0, source: '' },
      secondary_driver: { event: '', why: '', direction: 'neutral', score: 0, source: '' },
      counterweight: { event: '', why: '', direction: 'neutral', score: 0, source: '' },
      watchpoint: { event: '', why: '', direction: 'neutral', score: 0, source: '' },
      supporting_events: [],
    }
  }

  const primary = [...cards].sort((a, b) => b.score - a.score)[0]
  const secondary = cards.find((card) => card.summary !== primary.summary && card.eventType !== primary.eventType)
  const counterweight =
    cards.find((card) => card.summary !== primary.summary && (
      (card.direction !== 'neutral' && card.direction !== primary.direction)
      || card.eventType === 'risk'
      || card.eventType === 'macro_event'
    ))
    ?? cards.find((card) => card.summary !== primary.summary)
  const watchpoint =
    cards.find((card) => (
      card.eventType === 'earnings'
      || card.eventType === 'macro_event'
      || card.eventType === 'geopolitical'
      || containsAny(normalizeForMatch(card.summary), ['next', 'upcoming', 'tomorrow', 'later', 'watch', 'this week'])
    ))
    ?? cards.find((card) => card.summary !== primary.summary && card.summary !== (secondary?.summary ?? ''))
    ?? primary

  const used = new Set([
    primary.summary,
    secondary?.summary ?? '',
    counterweight?.summary ?? '',
    watchpoint?.summary ?? '',
  ])

  const supporting_events = cards
    .filter((card) => !used.has(card.summary))
    .slice(0, 4)
    .map((card) => ({
      event: card.summary,
      why: card.impactHint,
      direction: card.direction,
      score: card.score,
      source: card.source,
    }))

  const slot = (card?: EventCard): NarrativeSlot => card ? {
    event: compactEventLabel(card.summary),
    why: card.impactHint,
    direction: card.direction,
    score: card.score,
    source: card.source,
  } : { event: '', why: '', direction: 'neutral', score: 0, source: '' }

  return {
    price_context: priceContext,
    primary_driver: slot(primary),
    secondary_driver: slot(secondary),
    counterweight: slot(counterweight),
    watchpoint: slot(watchpoint),
    supporting_events,
  }
}


type DigestResult = {
  text: string
  signal?: 'bull' | 'bear' | 'neutral'
}

const getCurrentEtDate = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const buildDigestSystemPrompt = (lang: 'ko' | 'en'): string =>
  lang === 'ko'
    ? [
        'You are an institutional financial terminal editor writing Korean outputs.',
        'Use the rendered narrative draft and structured spine as the only primary sources.',
        'Do not reference raw news or headlines.',
        'Write a 5 to 7 line market brief in a Terminal X style.',
        'Line 1 must include price, time, and change.',
        'Line 2 must describe the intraday progression or timeline flow.',
        'Later lines must name the specific news events that drove the price: analyst upgrades/downgrades, earnings beats/misses, product launches, legal rulings, or management comments. Be concrete. Market index comparisons are secondary.',
        'The final line must be the forward risk or checkpoint.',
        'Keep the tone dense, analytical, and explanation-first.',
        'Add a signal field: "bull" if the overall session is net positive, "bear" if net negative, "neutral" if mixed.',
        'Return JSON only in this exact shape: {"text":"...","signal":"bull|bear|neutral"}',
      ].join('\n')
    : [
        'You are an institutional financial terminal editor.',
        'Use the rendered narrative draft and structured spine as the only primary sources.',
        'Do not reference raw news or headlines.',
        'Write a 5 to 7 line market brief in a Terminal X style.',
        'Line 1 must include price, time, and change.',
        'Line 2 must describe the intraday progression or timeline flow.',
        'Later lines must name the specific news events that drove the price: analyst upgrades/downgrades, earnings beats/misses, product launches, legal rulings, or management comments. Be concrete. Market index comparisons are secondary.',
        'The final line must be the forward risk or checkpoint.',
        'Keep the tone dense, analytical, and explanation-first.',
        'Add a signal field: "bull" if the overall session is net positive, "bear" if net negative, "neutral" if mixed.',
        'Return JSON only in this exact shape: {"text":"...","signal":"bull|bear|neutral"}',
      ].join('\n')

const buildDigestPrompt = (
  symbol: string,
  _lang: 'ko' | 'en',
  marketContext?: string,
  companyName?: string,
  renderedDraft?: string,
  spineJson?: string,
  price?: number | null,
  changePct?: number | null,
  dateET?: string,
): string => {
  const marketContextBlock = marketContext?.trim() ? marketContext.trim() : 'N/A'
  const companyNameBlock = companyName?.trim() ? companyName.trim() : 'N/A'
  const renderedDraftBlock = renderedDraft?.trim() || '[]'
  const spineBlock = spineJson?.trim() || '{}'
  const priceBlock = Number.isFinite(price ?? NaN) ? `${Number(price).toFixed(2)}` : 'N/A'
  const changeBlock = Number.isFinite(changePct ?? NaN)
    ? `${Number(changePct) >= 0 ? '+' : ''}${Number(changePct).toFixed(2)}%`
    : 'N/A'
  const dateBlock = dateET?.trim() || 'N/A'

  return [
    `Symbol: ${symbol}`,
    `Company name: ${companyNameBlock}`,
    `Market context: ${marketContextBlock}`,
    `Date ET: ${dateBlock}`,
    `Price: ${priceBlock}`,
    `Change: ${changeBlock}`,
    '',
    'Write one digest note for the whole batch, not separate item notes.',
    'Use the rendered narrative draft and narrative spine as the only primary sources.',
    'Do not repeat headlines or mention raw items.',
    'The output should read like a Terminal X daily note: explanation-first, not headline-first.',
    'Use the spine fields in this priority order: PRICE, CATALYST, TIMELINE, NUMBERS, RISK. Name the actual news events. Reference INSTITUTION or RELATIVE_VIEW only if they directly explain the price move.',
    'Keep the narrative anchored to specific news events, price reaction, and concrete numbers. Reference market indices only if the stock moved against the tape.',
    'The rendered draft is the preferred shape; improve fluency, but keep the causal chain and line order.',
    'Return JSON only: {"text":"..."}',
    '',
    'RENDERER DRAFT (Layer 5, line draft):',
    renderedDraftBlock,
    '',
    'NARRATIVE SPINE (Layer 3-6, primary source):',
    spineBlock,
  ].join('\n')
}

const buildSystemPrompt = (_lang: 'ko' | 'en'): string =>
  [
    'You are an institutional financial terminal editor.',
    'Turn each news item into a dense, explanation-first Terminal X-style note with Terminal X-level length.',
    'Treat the batch as a compact evidence pack, not isolated clips; if several items point to the same catalyst, connect them into one storyline.',
    'Do not repeat the headline verbatim. Use the headline and summary to explain why the item matters to the stock.',
    'Each item should be 3 to 5 sentences, not a headline fragment.',
    'Lead with the actual news event (what was announced, upgraded, beaten, or decided). Then explain the price reaction and context. Include one specific forward risk or checkpoint.',
    'Korean outputs should target 300 to 400 characters excluding spaces. English outputs should target around 600 characters excluding spaces.',
    'If marketContext is provided, use it only to explain the news reaction; do not mechanically restate it.',
    'Morning-like items should emphasize premarket/open implications.',
    'Afternoon-like items should emphasize close/session reaction and the next checkpoint.',
    'Avoid hype, sensational language, and unsupported speculation.',
    'If evidence is thin, note that fresh material is limited without collapsing into a headline.',
    'Add a signal field per item: "bull" if net positive for stock price, "bear" if net negative, "neutral" if mixed.',
    'Return JSON only in this exact shape: {"items":[{"id":"...","text":"...","signal":"bull|bear|neutral"}]}',
  ].join('\n')

const buildDigestRetryPrompt = (
  originalPrompt: string,
  validationReasons: string[],
  lang: 'ko' | 'en',
): string => {
  const reasons = validationReasons.join(', ')

  if (lang === 'ko') {
    return [
      'The previous Korean digest output failed Terminal X quality check.',
      `Failure reasons: ${reasons}`,
      '',
      'Rewrite entirely in Korean.',
      'Requirements: Korean output only. JSON only. 5 to 7 lines.',
      'Line 1: price, time (ET), and change percentage.',
      'Line 2: intraday progression or timeline flow in Korean.',
      'Remaining lines: name the specific news events that drove the price in Korean.',
      'Final line: risk or next checkpoint in Korean.',
      'Write dense explanation-first Korean prose.',
      '',
      originalPrompt,
    ].join('\n')
  }

  return [
    'The previous output failed the Terminal X-style quality check.',
    `Failure reasons: ${reasons}`,
    '',
    'Rewrite the entire batch.',
    '',
    'Requirements:',
    '- English only',
    '- JSON only',
    '- 5 to 7 lines',
    '- First line must include price, time, and change',
    '- Second line must describe intraday progression or timeline flow',
    '- Do not repeat headlines',
    '- Lead with the specific news event (what was announced or decided). Add a secondary factor, then risk and a concrete forward checkpoint.',
    '- The final line must close on risk or the next checkpoint',
    '- Write dense explanation-first prose',
    '',
    'Keep the original intent, but make the output more explanatory and Terminal X-level in length.',
    '',
    originalPrompt,
  ].join('\n')
}

const buildDigestFallbackText = (
  symbol: string,
  _lang: 'ko' | 'en',
  spine: {
    PRICE: string
    TIMELINE: string
    CATALYST: string
    INSTITUTION: string
    NUMBERS: string
    RELATIVE_VIEW: string
    CONFIDENCE: string
    RISK: string
  },
  renderedDraft?: string,
  marketContext?: string,
): string => {
  if (renderedDraft?.trim()) {
    return renderedDraft.trim()
  }

  const lines = [
    spine.PRICE,
    spine.TIMELINE,
    spine.CATALYST,
    spine.INSTITUTION,
    spine.NUMBERS,
    [spine.CONFIDENCE, spine.RELATIVE_VIEW].filter(Boolean).join(' '),
    spine.RISK || (marketContext?.trim() ? `Market context: ${marketContext.trim()}` : `${symbol} remains tied to the tape and the next session follow-through.`),
  ]

  return lines.join('\n')
}

const parseDigestResponse = (raw: string): string | null => {
  const cleaned = stripCodeFences(raw)

  try {
    const parsed = JSON.parse(cleaned) as { text?: string } | string | null
    if (typeof parsed === 'string') {
      const text = parsed.trim()
      return text || null
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      const text = parsed.text.trim()
      return text || null
    }
  } catch {
    // Fall through to plain text.
  }

  const plain = cleaned.trim()
  return plain || null
}

const validateDigestText = (
  text: string,
  lang: 'ko' | 'en',
): { passed: boolean; reasons: string[] } => {
  const reasons: string[] = []
  const chars = countNonSpaceChars(text)
  const lines = text
    .split(/\r?\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)

  const minChars = lang === 'ko' ? 300 : 520
  const maxChars = lang === 'ko' ? 2200 : 2600
  const priceKeywords =
    lang === 'ko'
      ? ['가격', '등락', '시각', '마감', '장중', '오전', '오후', 'ET', '%']
      : ['price', 'time', 'change', 'opened', 'closed', '%', 'session']
  const timelineKeywords =
    lang === 'ko'
      ? ['장초반', '장중', '마감', '개장', '후반', '초반', '흐름', 'timeline']
      : ['premarket', 'open', 'midday', 'afternoon', 'close', 'early', 'late', 'timeline']
  const relativeKeywords =
    lang === 'ko'
      ? ['상대', '대비', '비교', 'QQQ', 'SPY', '시장', '업종']
      : ['relative', 'vs', 'outperform', 'underperform', 'QQQ', 'SPY', 'market', 'sector']
  const confidenceKeywords =
    lang === 'ko'
      ? ['확신', '신뢰', '강함', '혼재', '약함', 'conviction']
      : ['confidence', 'conviction', 'strong', 'mixed', 'weak', 'high conviction']
  const causeKeywords =
    lang === 'ko'
      ? ['영향', '반영', '힘입어', '지지', '부담', '촉매', '원인', '드라이버']
      : ['driven by', 'because', 'due to', 'catalyst', 'support', 'pressure', 'backed by', 'anchor']
  const riskKeywords =
    lang === 'ko'
      ? ['다만', '리스크', '주의', '관전', '주목', '향후', '다음', '변수', '점검']
      : ['however', 'risk', 'watch', 'checkpoint', 'next', 'variable', 'caution']
  const institutionKeywords =
    lang === 'ko'
      ? ['애널리스트', '기관', '목표가', '평가', '증권사', '매크로', '금리', '국채']
      : ['analyst', 'institution', 'target', 'rating', 'macro', 'rates', 'yield', 'wall street']

  if (chars < minChars) reasons.push('too_short')
  if (chars > maxChars) reasons.push('too_long')
  if (lines.length < 5) reasons.push('too_few_lines')
  if (lines.length > 7) reasons.push('too_many_lines')

  const firstLine = lines[0] || ''
  const lastLine = lines[lines.length - 1] || ''

  if (!containsAny(firstLine, priceKeywords)) {
    reasons.push('missing_price_context')
  }
  if (lines[1] && !containsAny(lines[1], timelineKeywords)) {
    reasons.push('missing_timeline')
  }
  if (!containsAny(text, relativeKeywords)) {
    reasons.push('missing_relative_view')
  }
  if (!containsAny(text, confidenceKeywords)) {
    reasons.push('missing_confidence')
  }
  if (!containsAny(text, causeKeywords)) {
    reasons.push('missing_cause')
  }
  if (!containsAny(text, riskKeywords)) {
    reasons.push('missing_risk')
  }
  if (!(containsAny(text, institutionKeywords) || containsAny(text, ['macro', 'rate', 'yield', 'inflation']))) {
    reasons.push('missing_institution_or_macro')
  }
  if (!containsAny(lastLine, riskKeywords)) {
    reasons.push('final_line_missing_risk')
  }
  if (!/\d/.test(text)) {
    reasons.push('missing_numbers')
  }
  if (lines.length <= 1) {
    reasons.push('headline_like')
  }

  return { passed: reasons.length === 0, reasons }
}

const buildItemBlocks = (batch: NewsInputItem[]): ItemBlock[] =>
  batch.map((item) => ({
    item,
    sessionHint: inferSessionHint(item.timeET),
  }))

const buildUserPrompt = (
  symbol: string,
  items: ItemBlock[],
  lang: 'ko' | 'en',
  marketContext?: string,
  companyName?: string,
  eventCardsJson?: string,
  narrativePlanJson?: string,
): string => {
  const marketContextBlock = marketContext?.trim()
    ? marketContext.trim()
    : 'N/A'
  const companyNameBlock = companyName?.trim()
    ? companyName.trim()
    : 'N/A'
  const eventCardsBlock = eventCardsJson?.trim() || '[]'
  const narrativePlanBlock = narrativePlanJson?.trim() || '{}'
  const layerHint = 'Primary sources are EVENT CARDS and NARRATIVE PLAN; raw items are supporting evidence only.'

  const itemText = items
    .map(({ item, sessionHint }, index) =>
      [
        `[ITEM-${index}]`,
        `id: ${item.id}`,
        `session_hint: ${sessionHint}`,
        `timeET: ${item.timeET}`,
        `headline: ${item.headline || ''}`,
        `summary: ${item.summary || ''}`,
      ].join('\n'),
    )
    .join('\n\n')

  if (lang === 'ko') {
    return [
      `Symbol: ${symbol}`,
      `Company: ${companyNameBlock}`,
      `Market context: ${marketContextBlock}`,
      '',
      'Translate each news item below into fluent Korean in Terminal X financial style.',
      'Write 3 to 4 Korean sentences per item. Do not copy the headline verbatim.',
      'Lead with the actual news event (what was announced or decided).',
      'Connect related items sharing the same catalyst into one storyline.',
      layerHint,
      'Use market context only to explain price reaction, not to repeat it.',
      'Morning items: emphasize premarket and open implications in Korean.',
      'Afternoon items: emphasize session reaction and next checkpoint in Korean.',
      'Add a signal field per item: "bull" if net positive, "bear" if net negative, "neutral" if mixed.',
      'Output Korean language only. Return JSON: {"items":[{"id":"...","text":"...","signal":"bull|bear|neutral"}]}',
      '',
      'EVENT CARDS (Layer 1-2, scored evidence pack):',
      eventCardsBlock,
      '',
      'NARRATIVE PLAN (Layer 3-4, storyline spine):',
      narrativePlanBlock,
      '',
      itemText,
    ].join('\n')
  }

  return [
    `Symbol: ${symbol}`,
    `Company name: ${companyNameBlock}`,
    `Market context: ${marketContextBlock}`,
    '',
    'Rewrite each news item as a dense, explanation-first terminal note.',
    'Treat the batch as a research packet and connect items that share the same catalyst or market reaction.',
    layerHint,
    'Keep each item to 3 to 5 sentences, preserve the input order, and keep the original ids.',
    'Korean outputs should target 300 to 400 characters excluding spaces. English outputs should target around 600 characters excluding spaces.',
    'Use the market context only to explain why the item matters; do not restate it mechanically.',
    'Morning-like items should emphasize premarket/open implications; afternoon-like items should emphasize session reaction and the next checkpoint.',
    'Return JSON only: {"items":[{"id":"...","text":"..."}]}',
    '',
    'EVENT CARDS (Layer 1-2, scored evidence pack):',
    eventCardsBlock,
    '',
    'NARRATIVE PLAN (Layer 3-4, storyline spine):',
    narrativePlanBlock,
    '',
    itemText,
  ].join('\n')
}

const stripLeadingNumbering = (text: string): string =>
  text.replace(/^\s*(?:\d+[.)]|[-*])\s*/u, '').trim()

const parseResponseItems = (raw: string, batch: NewsInputItem[]): SynthesizedItem[] | null => {
  const cleaned = stripCodeFences(raw)

  try {
    const parsed = JSON.parse(cleaned) as
      | { items?: Array<{ id?: string; text?: string }> | string[] }
      | Array<{ id?: string; text?: string }>
      | null
    const items = Array.isArray(parsed) ? parsed : parsed?.items
    if (Array.isArray(items) && items.length) {
      const mapped = items
        .map((entry, index) => {
          if (typeof entry === 'string') {
            return { id: batch[index]?.id ?? `item-${index}`, text: entry.trim() }
          }
          if (entry && typeof entry === 'object') {
            const id = typeof entry.id === 'string' && entry.id.trim()
              ? entry.id.trim()
              : batch[index]?.id ?? `item-${index}`
            const text = typeof entry.text === 'string' ? entry.text.trim() : ''
            const rawSignal = (entry as Record<string, unknown>).signal
            const signal = rawSignal === 'bull' || rawSignal === 'bear' ? rawSignal : 'neutral'
            return { id, text, signal } as SynthesizedItem
          }
          return null
        })
        .filter((entry): entry is SynthesizedItem => Boolean(entry && entry.text))

      if (mapped.length === batch.length) {
        return mapped
      }
    }
  } catch {
    // Fall through to delimiter parsing.
  }

  const delimiterParts = cleaned
    .split('|||')
    .map((part) => stripLeadingNumbering(part.trim()))
    .filter(Boolean)

  if (delimiterParts.length === batch.length) {
    return batch.map((item, index) => ({
      id: item.id,
      text: delimiterParts[index] ?? '',
    }))
  }

  return null
}

const validateResponseItems = (
  items: SynthesizedItem[],
  lang: 'ko' | 'en',
): { passed: boolean; reasons: string[] } => {
  const reasons: string[] = []
  const minChars = lang === 'ko' ? 300 : 520
  const maxChars = lang === 'ko' ? 420 : 720
  const causeKeywords =
    lang === 'ko'
      ? ['영향', '반영', '힘입어', '지지', '부담', '촉매', '원인', '드라이버', '가이던스', '계약', '규제']
      : ['driven by', 'because', 'due to', 'support', 'pressure', 'catalyst', 'risk', 'guidance', 'contract', 'regulation']
  const riskKeywords =
    lang === 'ko'
      ? ['다만', '리스크', '주의', '관전', '주목', '향후', '다음', '변수', '점검']
      : ['however', 'risk', 'watch', 'checkpoint', 'next', 'variable', 'limited']

  if (!items.length) {
    return { passed: false, reasons: ['no_items_returned'] }
  }

  items.forEach((item, index) => {
    const text = item.text.trim()
    const chars = countNonSpaceChars(text)
    const sentences = sentenceCount(text)
    const headlineLike = sentences <= 1 || chars < minChars

    if (chars < minChars) reasons.push(`item_${index}_too_short`)
    if (chars > maxChars) reasons.push(`item_${index}_too_long`)
    if (headlineLike) reasons.push(`item_${index}_headline_like`)
    if (sentences < 3) reasons.push(`item_${index}_too_few_sentences`)
    if (!containsAny(text, causeKeywords)) reasons.push(`item_${index}_missing_cause`)
    if (!containsAny(text, riskKeywords)) reasons.push(`item_${index}_missing_risk`)
  })

  return { passed: reasons.length === 0, reasons }
}

const validateResponseItem = (
  text: string,
  lang: 'ko' | 'en',
): { passed: boolean; reasons: string[] } => {
  return validateResponseItems([{ id: 'item', text }], lang)
}

const buildRetryPrompt = (
  originalPrompt: string,
  validationReasons: string[],
  lang: 'ko' | 'en',
): string => {
  const reasons = validationReasons.join(', ')

  if (lang === 'ko') {
    return [
      'The previous Korean item output failed Terminal X quality check.',
      `Failure reasons: ${reasons}`,
      '',
      'Rewrite in Korean.',
      'Requirements: Korean only. JSON only. 3 to 5 sentences per item.',
      'Lead with the actual news event in Korean.',
      'Include: main catalyst, secondary factor, risk or checkpoint.',
      'Write dense explanation-first Korean prose.',
      '',
      originalPrompt,
    ].join('\n')
  }

  return [
    'The previous output failed the Terminal X-style quality check.',
    `Failure reasons: ${reasons}`,
    '',
    'Rewrite the entire batch.',
    '',
    'Requirements:',
    '- English only',
    '- JSON only',
    '- 3 to 5 sentences per item',
    '- Korean outputs should target 300 to 400 characters excluding spaces.',
    '- English outputs should target around 600 characters excluding spaces.',
    '- Do not write headline fragments',
    '- Avoid news bullet lists',
    '- Include a main catalyst, secondary factor, and a risk or forward checkpoint',
    '- Use market context only for interpretation, not repetition',
    '',
    'Keep the original intent, but make the output more explanatory and Terminal X-level in length.',
    '',
    originalPrompt,
  ].join('\n')
}

const buildFallbackText = (
  item: NewsInputItem,
  lang: 'ko' | 'en',
  sessionHint: 'morning' | 'afternoon',
): string => {
  const headline = compactEventLabel(item.summary || item.headline || (lang === 'ko' ? '해당 뉴스' : 'This item'))
  const summary = item.summary.trim()

  if (lang === 'ko') {
    const koHead = sessionHint === 'morning'
      ? `${headline} — 장 초반 흐름에서 읽어야 할 이슈다.`
      : `${headline} — 장 마감 전후로 평가가 필요한 이슈다.`
    const koBody = summary
      ? `${summary} 륙렷한 새 재료는 제한적이며, 시장 흐름과 포지션이 핵심 변수로 남아 있다.`
      : '륙렷한 새 재료는 제한적이며, 시장 흐름과 포지션이 핵심 변수로 남아 있다.'
    const koWatch = sessionHint === 'morning'
      ? '시장은 오늘 추가 뉴스의 초반 세션 반응을 주시하고 있다.'
      : '시장은 다음 거래일 추가 뉴스의 최종 흐름을 확인할 전망이다.'
    return `${koHead} ${koBody} ${koWatch}`
  }

  const lead =
    sessionHint === 'morning'
      ? `${headline} should be read against the early-session tape.`
      : `${headline} should be read against the closing tape.`
  const body = summary && summary !== headline
    ? `${summary} Fresh material appears limited, so the broader market tone and positioning remain the key context.`
    : 'Fresh material appears limited, so the broader market tone and positioning remain the key context.'
  const watch =
    sessionHint === 'morning'
      ? 'The market will watch for follow-through in the session ahead.'
      : 'The next session will likely confirm whether the move has follow-through.'
  return `${lead} ${body} ${watch}`
}

async function synthesizeDigest(
  symbol: string,
  batch: NewsInputItem[],
  lang: 'ko' | 'en',
  marketContext: string | undefined,
  companyName: string | undefined,
  price?: number | null,
  changePct?: number | null,
  dateET?: string,
  session?: NewsSynthSession,
): Promise<DigestResult | null> {
  const selectedBatch = selectRelevantItems(batch, symbol, companyName)
  if (selectedBatch.length < 1) {
    return null
  }

  const digestDateET = dateET?.trim() || getCurrentEtDate()
  const clusters = clusterNewsItems(
    symbol,
    digestDateET,
    selectedBatch.map((item) => ({
      id: item.id,
      timeET: item.timeET,
      headline: item.headline,
      summary: item.summary || item.headline,
    })),
  ).clusters

  const thesis = buildSessionThesis(symbol, changePct ?? null, clusters)
  const sessionHint = session === 'morning' || session === 'afternoon' ? session : 'auto'
  const marketTape = await readCacheJsonOrNull<{ items?: MarketTapeItem[] | null }>('market_tape.json')
  const timeline = buildTimelineFlow({
    symbol,
    items: selectedBatch.map((item) => ({
      id: item.id,
      timeET: item.timeET,
      headline: item.headline,
      summary: item.summary || item.headline,
    })),
    clusters,
    priceChangePct: changePct ?? null,
    session: sessionHint,
  })
  const relativeView = buildRelativeView({
    symbol,
    companyName,
    priceChangePct: changePct ?? null,
    marketTapeItems: marketTape?.items ?? [],
    clusters,
  })
  const confidence = buildConfidenceProfile({
    symbol,
    priceChangePct: changePct ?? null,
    clusters,
    timeline,
    relativeView,
    rawCount: batch.length,
    selectedCount: selectedBatch.length,
  })
  const priceAnchor = buildPriceAnchorLayer({
    symbol,
    price: price ?? null,
    changePct: changePct ?? null,
    timeline,
    session: sessionHint,
  })
  const spine = buildNarrativeSpine({
    symbol,
    price: price ?? null,
    changePct: changePct ?? null,
    thesis: thesis.thesis,
    clusters,
    session: sessionHint,
    timeline,
    confidence,
    relativeView,
    priceAnchor,
  })
  const renderedDraft = renderNarrativeBrief({
    priceAnchor,
    spine,
  })

  if (selectedBatch.length <= LOW_DENSITY_ITEM_THRESHOLD) {
    return { text: renderedDraft.text }
  }

  const systemPrompt = buildDigestSystemPrompt(lang)
  const baseUserPrompt = buildDigestPrompt(
    symbol,
    lang,
    marketContext,
    companyName,
    renderedDraft.text,
    JSON.stringify(spine, null, 2),
    price ?? null,
    changePct ?? null,
    digestDateET,
  )

  const providers: Array<() => Promise<string>> = [
    () => callAnthropic(systemPrompt, baseUserPrompt),
    () => callOpenAI(systemPrompt, baseUserPrompt),
  ]

  for (const [providerIndex, provider] of providers.entries()) {
    try {
      const raw = await provider()
      const parsed = parseDigestResponse(raw)
      if (!parsed) continue
      const validation = validateDigestText(parsed, lang)
      if (validation.passed) {
        return { text: parsed }
      }

      const retryPrompt = buildDigestRetryPrompt(baseUserPrompt, validation.reasons, lang)
      const retryRaw = providerIndex === 0
        ? await callAnthropic(systemPrompt, retryPrompt)
        : await callOpenAI(systemPrompt, retryPrompt)
      const retryParsed = parseDigestResponse(retryRaw)
      if (!retryParsed) continue
      const retryValidation = validateDigestText(retryParsed, lang)
      if (retryValidation.passed) {
        return { text: retryParsed }
      }
    } catch (err) {
      console.error('[news-synthesize][digest] provider failed:', err)
      continue
    }
  }

  const fallback = buildDigestFallbackText(symbol, lang, spine, renderedDraft.text, marketContext)
  return { text: fallback }
}

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
const synthCache = new Map<string, { result: SynthesizedItem[]; cachedAt: number }>()
const SYNTH_CACHE_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function getSynthCacheKey(symbol: string, dateET: string, lang: string) {
  return `${symbol}:${dateET}:${lang}`
}

function cleanSynthCache(keepDateET: string) {
  const cutoff = Date.now() - SYNTH_CACHE_TTL_MS
  for (const [key, entry] of synthCache) {
    if (entry.cachedAt < cutoff || !key.includes(`:${keepDateET}:`)) {
      synthCache.delete(key)
    }
  }
}

const buildBriefSystemPrompt = (): string =>
  [
    'You are a Korean financial terminal editor.',
    'Write a Korean news summary (~500 characters) for the given stock.',
    'The FIRST sentence must follow this exact pattern:',
    '  {회사명}({심볼})는 [핵심 이벤트/촉매]로 X% 상승/하락하며 $Y에 마감했다.',
    'Fill [핵심 이벤트/촉매] with the single most important catalyst from the news (15자 이내, 명사형 어구).',
    'Example: "넷플릭스(NFLX)는 1분기 실적 발표 기대감으로 3.02% 상승하며 $106.28에 마감했다."',
    'Focus only on specific news events: analyst upgrades/downgrades, earnings, product launches, regulatory decisions, or management comments. Name the source when given.',
    'Do not mention S&P 500, Nasdaq, or other index comparisons.',
    'Write 2-3 dense explanation-first Korean paragraphs.',
    'Return JSON: {"text":"<summary>","signal":"bull|bear|neutral"}',
    '"bull" if catalysts are net positive for the stock, "bear" if net negative, "neutral" if mixed.',
  ].join('\n')

const buildBriefSystemPromptEN = (): string =>
  [
    'You are an institutional financial terminal editor. Write like Bloomberg Terminal — catalyst-driven, source-cited, zero fluff.',
    'Write an English news summary (~500 characters) for the given stock.',
    'The first sentence is provided — copy it exactly as the opening, then continue in English.',
    '',
    'ALLOWED topics only:',
    '  - Earnings beats/misses, guidance (cite EPS/revenue figures when available)',
    '  - Analyst upgrades/downgrades with price target changes (name the firm)',
    '  - Product launches, regulatory approvals/rejections, FDA/FCC decisions',
    '  - Management guidance, CEO/CFO comments, investor day announcements',
    '  - M&A activity, partnerships, licensing deals, share buybacks',
    '  - Macro factors directly affecting this company (tariffs on its products, sector-specific policy)',
    '',
    'STRICTLY FORBIDDEN — never write about:',
    '  - Moving averages (MA20/50/200, SMA, EMA), RSI, MACD, Bollinger Bands',
    '  - Support/resistance levels, chart patterns, technical breakouts or bounces',
    '  - Volume patterns, momentum indicators, candlestick signals',
    '  - Broad index comparisons (S&P 500, Nasdaq, market-wide moves)',
    '',
    'Write 2-3 dense explanation-first paragraphs. Name sources when given.',
    'Return JSON: {"text":"<summary>","signal":"bull|bear|neutral"}',
    '"bull" if catalysts are net positive, "bear" if net negative, "neutral" if mixed.',
  ].join('\n')


const buildBriefUserPromptKO = (
  symbol: string,
  koName: string,
  koPct: string,
  koDir: string,
  koPrice: string,
  items: NewsInputItem[],
  dateET: string,
): string => {
  const itemLines = items
    .slice(0, 15)
    .map(it => `${it.timeET || ''} — ${it.headline}${it.summary && it.summary !== it.headline ? ' | ' + it.summary : ''}`)
    .join('\n')
  const template = koPct
    ? `${koName}(${symbol})는 [핵심 이벤트]로 ${koPct} ${koDir}하며${koPrice} 마감했다.`
    : `${koName}(${symbol})는 [핵심 이벤트]로 장을 마쳤다.`
  return [
    `Symbol: ${symbol}`,
    `Company: ${koName}`,
    `Date: ${dateET}`,
    'Output language: Korean',
    '',
    'News items:',
    itemLines,
    '',
    `First sentence template (fill [핵심 이벤트] with the main catalyst, 15자 이내):`,
    `"${template}"`,
  ].join('\n')
}

const buildBriefUserPromptEN = (
  symbol: string,
  leadSentence: string,
  items: NewsInputItem[],
  dateET: string,
): string => {
  const itemLines = items
    .slice(0, 15)
    .map(it => `${it.timeET || ''} — ${it.headline}${it.summary && it.summary !== it.headline ? ' | ' + it.summary : ''}`)
    .join('\n')
  return [
    `Symbol: ${symbol}`,
    `Date: ${dateET}`,
    'Output language: English',
    '',
    'News items:',
    itemLines,
    '',
    `Start your summary with exactly: "${leadSentence}"`,
  ].join('\n')
}

// ── DeepL translation with daily file cache ──
const DEEPL_CACHE_FILE = pathModule.join(process.cwd(), '.cache', 'deepl-ko-cache.json')

function loadDeeplFileCache(): Record<string, string> {
  try {
    const dir = pathModule.dirname(DEEPL_CACHE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DEEPL_CACHE_FILE)) return {}
    return JSON.parse(fs.readFileSync(DEEPL_CACHE_FILE, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function saveDeeplFileCache(cache: Record<string, string>): void {
  try {
    fs.writeFileSync(DEEPL_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (err) {
    console.error('[deepl-cache] write error:', err)
  }
}

function pruneDeeplCache(cache: Record<string, string>, todayET: string): Record<string, string> {
  // Keep only entries for today's date
  const pruned: Record<string, string> = {}
  for (const [k, v] of Object.entries(cache)) {
    if (k.endsWith(':' + todayET)) pruned[k] = v
  }
  return pruned
}

async function translateToKoViaDeepl(enText: string, symbol: string, dateET: string): Promise<string | null> {
  const DEEPL_KEY = Object.entries(process.env).find(([k]) => k.trim().toLowerCase() === 'deepl_api_key')?.[1]?.trim() ?? ''
  if (!DEEPL_KEY) return null

  const cacheKey = `${symbol}:${dateET}`
  let fileCache = loadDeeplFileCache()
  // Prune stale entries
  fileCache = pruneDeeplCache(fileCache, dateET)

  if (fileCache[cacheKey]) {
    console.log(`[deepl] cache hit: ${cacheKey}`)
    return fileCache[cacheKey]
  }

  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [enText], target_lang: 'KO' }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[deepl] translate error:', res.status)
      return null
    }
    const data = await res.json() as { translations?: { text: string }[] }
    const koText = data.translations?.[0]?.text ?? null
    if (koText) {
      fileCache[cacheKey] = koText
      saveDeeplFileCache(fileCache)
      console.log(`[deepl] translated + cached: ${cacheKey}`)
    }
    return koText
  } catch (err) {
    console.error('[deepl] translate exception:', err)
    return null
  }
}

async function synthesizeBatch(
  symbol: string,
  batch: NewsInputItem[],
  lang: 'ko' | 'en',
  marketContext?: string,
  companyName?: string,
  price?: number | null,
  changePct?: number | null,
  dateET?: string,
): Promise<SynthesizedItem[]> {
  const selected = selectRelevantItems(batch, symbol, companyName)
  if (selected.length === 0) return []

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
  const cacheKey = getSynthCacheKey(symbol, effectiveDateET, lang)
  const cached = synthCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < SYNTH_CACHE_TTL_MS) {
    return cached.result
  }
  cleanSynthCache(effectiveDateET)

  // Always synthesize in English; KO result obtained via DeepL (once per day, file-cached)
  const systemPrompt = buildBriefSystemPromptEN()
  const userPrompt = buildBriefUserPromptEN(symbol, leadSentenceEN, selected, effectiveDateET)

  let raw: string | null = null
  for (const provider of [
    () => callAnthropic(systemPrompt, userPrompt),
    () => callOpenAI(systemPrompt, userPrompt),
  ]) {
    try {
      raw = await provider()
      if (raw) break
    } catch (err) {
      console.error('[news-synthesize] provider error:', err)
    }
  }

  if (!raw) {
    return [{ id: selected[0].id, text: leadSentence, signal: 'neutral' as const }]
  }

  // Parse JSON response
  let enText = raw.trim()
  let signal: 'bull' | 'bear' | 'neutral' = 'neutral'
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>
      enText = typeof parsed.text === 'string' ? parsed.text.trim() : raw.trim()
      const rawSig = parsed.signal
      signal = rawSig === 'bull' || rawSig === 'bear' ? rawSig : 'neutral'
    }
  } catch {}

  if (lang === 'en') {
    const result = [{ id: selected[0].id, text: enText, signal }]
    synthCache.set(cacheKey, { result, cachedAt: Date.now() })
    return result
  }

  // KO: translate via DeepL once per day (file-cached); fallback to KO lead sentence
  const koText = await translateToKoViaDeepl(enText, symbol, effectiveDateET) ?? leadSentence
  const result = [{ id: selected[0].id, text: koText, signal }]
  synthCache.set(cacheKey, { result, cachedAt: Date.now() })
  return result
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
  const session = body.session === 'morning' || body.session === 'afternoon' ? body.session : 'auto'
  const price = typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : null
  const changePct = typeof body.changePct === 'number' && Number.isFinite(body.changePct) ? body.changePct : null

  // Non-trading day guard (weekends)
  if (dateET) {
    const d = new Date(dateET + 'T12:00:00Z')
    const dow = d.getUTCDay() // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) {
      return NextResponse.json({ results: [], digest: null, digestSignal: null, meta: { inputItems: 0, selectedItems: 0, digestAvailable: false, skipped: true } })
    }
  }

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol.' }, { status: 400 })
  }
  if (!items.length) {
    return NextResponse.json({ error: 'Missing items.' }, { status: 400 })
  }

  const batch = items
    .slice(0, MAX_ITEMS_PER_BATCH)
    .map((item, index) => ({
      id: String(item.id || `item-${index}`),
      timeET: String(item.timeET || (index % 2 === 0 ? '09:30' : '16:30')),
      headline: String(item.headline || '').trim(),
      summary: String(item.summary || '').trim(),
    }))
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''

  try {
    const results = await synthesizeBatch(
      symbol,
      batch,
      lang,
      marketContext || undefined,
      companyName || undefined,
      price,
      changePct,
      dateET || undefined,
    )
    return NextResponse.json({
      results,
      digest: results[0]?.text ?? null,
      digestSignal: results[0]?.signal ?? null,
      meta: {
        inputItems: batch.length,
        selectedItems: results.length,
        digestAvailable: results.length > 0,
      },
    })
  } catch (err) {
    console.error('[news-synthesize] error:', err)
    return NextResponse.json({ error: 'Synthesis failed.' }, { status: 500 })
  }
}
