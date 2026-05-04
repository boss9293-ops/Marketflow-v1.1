export type EventType =
  | 'FOMC'
  | 'INFLATION'
  | 'EARNINGS'
  | 'GUIDANCE'
  | 'CAPEX'
  | 'AI_INFRASTRUCTURE'
  | 'SEMICONDUCTOR'
  | 'ENERGY_SHOCK'
  | 'GEOPOLITICAL'
  | 'REGULATION'
  | 'SUPPLY_CHAIN'
  | 'ANALYST_ACTION'
  | 'CREDIT_LIQUIDITY'
  | 'MARKET_STRUCTURE'
  | 'MACRO'
  | 'OTHER'

export type EventRole = 'LEAD' | 'SUPPORTING' | 'BACKGROUND'

export interface RankableItem {
  id: string
  headline: string
  title?: string
  summary?: string
  source?: string
  publishedAtET?: string
  dateET?: string
  timeET?: string
  relevanceScore?: number
  tags?: string[]
  ticker?: string
  tickers?: string[]
}

export type RankedItem<T extends RankableItem> = T & {
  rank: number
  is_lead: boolean
  role: EventRole
  eventType: EventType
  rankingReason: string
  eventRankScore: number
}

// ─── Event classification rules (ordered by priority) ───────────────────────

const EVENT_RULES: Array<{ type: EventType; pattern: RegExp; bonus: number }> = [
  {
    type: 'FOMC',
    pattern: /\b(fomc|federal reserve|fed funds|rate cut|rate hike|basis point|powell|dot plot|quantitative easing|qt taper)\b/i,
    bonus: 25,
  },
  {
    type: 'INFLATION',
    pattern: /\b(cpi|ppi|core pce|consumer price index|producer price|inflation|deflation|price index)\b/i,
    bonus: 24,
  },
  {
    type: 'ENERGY_SHOCK',
    pattern: /\b(crude oil|wti|brent|opec|hormuz|oil price|oil shock|energy crisis|natural gas|lng|refinery)\b/i,
    bonus: 23,
  },
  {
    type: 'GEOPOLITICAL',
    pattern: /\b(trade war|proxy war|war risk|civil war|military strike|armed conflict|sanction|tariff|taiwan strait|north korea|middle east|iran|ukraine|russia|geopolit)\b/i,
    bonus: 20,
  },
  {
    type: 'AI_INFRASTRUCTURE',
    pattern: /\b(ai spending|ai training|ai chip demand|data center build|gpu demand|llm training|large language model|cloud capex|hyperscaler spending|ai infrastructure)\b/i,
    bonus: 20,
  },
  {
    type: 'SEMICONDUCTOR',
    pattern: /\b(nvidia|nvda|amd|intel|tsmc|arm holdings|semiconductor|chip shortage|wafer|soxx|soxl|micron|asml|applied materials)\b/i,
    bonus: 18,
  },
  {
    type: 'CAPEX',
    pattern: /\b(capital expenditure|capex|spending plan|investment plan|hyperscaler capex|data center investment)\b/i,
    bonus: 18,
  },
  {
    type: 'CREDIT_LIQUIDITY',
    pattern: /\b(credit spread|liquidity crunch|yield curve|treasury yield|bond market|default risk|debt ceiling|high yield)\b/i,
    bonus: 18,
  },
  {
    type: 'MARKET_STRUCTURE',
    pattern: /\b(vix spike[s]?|vix jump[s]?|volatility regime|options expiry|gamma squeeze|short squeeze|margin call|circuit breaker|put.call ratio)\b/i,
    bonus: 16,
  },
  {
    type: 'EARNINGS',
    pattern: /\b(earnings|eps|revenue|net income|beat|miss|quarterly results|q[1-4] (results|earnings)|profit|loss)\b/i,
    bonus: 14,
  },
  {
    type: 'GUIDANCE',
    pattern: /\b(guidance|outlook|forecast|full.?year|fy2\d|raised guidance|lowered guidance|cut forecast|revised outlook)\b/i,
    bonus: 14,
  },
  {
    type: 'MACRO',
    pattern: /\b(gdp|unemployment|jobless claims|nonfarm payroll|nfp|jobs report|recession|economic growth|macro data|ism)\b/i,
    bonus: 14,
  },
  {
    type: 'REGULATION',
    pattern: /\b(sec filing|ftc|doj|antitrust|regulation|compliance fine|penalty|investigation|subpoena|class action|lawsuit)\b/i,
    bonus: 10,
  },
  {
    type: 'SUPPLY_CHAIN',
    pattern: /\b(supply chain|inventory buildup|stockpile|component shortage|oversupply|lead time|logistics disruption)\b/i,
    bonus: 10,
  },
  {
    type: 'ANALYST_ACTION',
    pattern: /\b(upgrade|downgrade|price target|initiated coverage|reiterated|outperform|underperform|overweight|underweight|buy rating|sell rating)\b/i,
    bonus: 8,
  },
]

// ─── Tag bonus map ───────────────────────────────────────────────────────────

const TAG_BONUSES: Record<string, number> = {
  macro: 5,
  risk: 5,
  inflation: 5,
  rates: 5,
  oil: 4,
  ai: 4,
  semiconductor: 4,
  earnings: 3,
  guidance: 3,
  watchlist: 6,
}

// ─── High-signal ticker set ──────────────────────────────────────────────────

const HIGH_SIGNAL_TICKERS = new Set([
  'QQQ', 'SPY', 'SOXX', 'TQQQ', 'SOXL',
  'NVDA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'TSLA',
  'AVGO', 'AMD', 'MU', 'ASML', 'TSM', 'VRT', 'ETN',
])

// Source prominence bonus
const SOURCE_BONUS: Array<{ pattern: RegExp; value: number }> = [
  { pattern: /reuters|associated press|\bap\b|bloomberg/i, value: 4 },
  { pattern: /wall street journal|wsj|financial times|\bft\b/i, value: 3 },
  { pattern: /cnbc|barron|marketwatch/i, value: 2 },
  { pattern: /yahoo finance|seeking alpha/i, value: 1 },
]

const RANKING_REASONS: Record<EventType, string> = {
  FOMC: 'Fed/rates signal — directly drives equity risk premium and valuation multiple',
  INFLATION: 'Inflation data — determines rate trajectory and growth/value rotation',
  EARNINGS: 'Earnings event — primary EPS/revenue catalyst for consensus revision',
  GUIDANCE: 'Forward guidance change — revises analyst models and near-term positioning',
  AI_INFRASTRUCTURE: 'AI infra/capex signal — demand visibility for GPU and cloud supply chain',
  ENERGY_SHOCK: 'Energy price shock — feeds inflation expectations and margin compression',
  MACRO: 'Macro data release — broad growth and employment signal for risk appetite',
  GEOPOLITICAL: 'Geopolitical event — risk premium, supply disruption, and sector rotation driver',
  SEMICONDUCTOR: 'Semiconductor-specific catalyst — cycle positioning and demand signal',
  CAPEX: 'Capital spending signal — demand pull for infrastructure and equipment suppliers',
  ANALYST_ACTION: 'Analyst rating/target change — near-term price level and momentum catalyst',
  REGULATION: 'Regulatory event — structural risk or operational constraint',
  SUPPLY_CHAIN: 'Supply chain development — inventory, margin, and delivery schedule implications',
  CREDIT_LIQUIDITY: 'Credit/liquidity signal — systemic risk indicator and risk appetite shift',
  MARKET_STRUCTURE: 'Market structure event — positioning, vol regime, and flow dynamics',
  OTHER: 'General news — no dominant thematic category matched',
}

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function classifyEvent(text: string): { eventType: EventType; bonus: number; matched: string } {
  for (const rule of EVENT_RULES) {
    const m = text.match(rule.pattern)
    if (m) return { eventType: rule.type, bonus: rule.bonus, matched: m[0] }
  }
  return { eventType: 'OTHER', bonus: 0, matched: '' }
}

function getSourceBonus(source?: string): number {
  if (!source) return 0
  for (const s of SOURCE_BONUS) {
    if (s.pattern.test(source)) return s.value
  }
  return 0
}

function getRecencyBonus(publishedAtET?: string, dateET?: string): number {
  const ts = publishedAtET || dateET
  if (!ts) return 0
  const ageH = (Date.now() - new Date(ts).getTime()) / 3_600_000
  if (isNaN(ageH) || ageH < 0) return 0
  if (ageH < 6) return 5
  if (ageH < 24) return 3
  return 0
}

function getTagBonus(tags?: string[]): { bonus: number; matched: string[] } {
  if (!tags || tags.length === 0) return { bonus: 0, matched: [] }
  let total = 0
  const matched: string[] = []
  for (const tag of tags) {
    const key = tag.toLowerCase()
    const val = TAG_BONUSES[key]
    if (val !== undefined) {
      total += val
      matched.push(tag)
    }
  }
  return { bonus: total, matched }
}

function getTickerBonus(item: RankableItem): { bonus: number; matched: string[] } {
  const candidates = new Set<string>()
  if (item.ticker) candidates.add(item.ticker.toUpperCase())
  if (item.tickers) item.tickers.forEach((t) => candidates.add(t.toUpperCase()))

  const matched: string[] = []
  let bonus = 0
  for (const t of candidates) {
    if (HIGH_SIGNAL_TICKERS.has(t)) {
      matched.push(t)
      bonus += 3
    }
  }
  return { bonus, matched }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function rankEvents<T extends RankableItem>(items: T[]): RankedItem<T>[] {
  if (items.length === 0) return []

  const scored = items.map((item) => {
    const classifyText = `${item.title ?? ''} ${item.headline}`.trim() || `${item.summary ?? ''}`
    const { eventType, bonus: eventTypeBonus, matched } = classifyEvent(classifyText)
    const srcBonus = getSourceBonus(item.source)
    const recBonus = getRecencyBonus(item.publishedAtET, item.dateET)
    const { bonus: tagBonus, matched: tagMatches } = getTagBonus(item.tags)
    const { bonus: tickerBonus, matched: tickerMatches } = getTickerBonus(item)
    const relevanceBase = (item.relevanceScore ?? 0.5) * 50

    const eventRankScore = parseFloat(
      (relevanceBase + eventTypeBonus + tagBonus + tickerBonus + srcBonus + recBonus).toFixed(2)
    )

    const base = RANKING_REASONS[eventType]
    const extras: string[] = []
    if (matched) extras.push(`matched: ${matched}`)
    if (tagMatches.length) extras.push(`tags: ${tagMatches.join(',')}`)
    if (tickerMatches.length) extras.push(`tickers: ${tickerMatches.join(',')}`)
    const rankingReason = extras.length ? `${base} [${extras.join(' | ')}]` : base

    return { item, eventType, eventRankScore, rankingReason }
  })

  scored.sort((a, b) => {
    const diff = b.eventRankScore - a.eventRankScore
    if (Math.abs(diff) > 0.01) return diff
    return items.indexOf(a.item) - items.indexOf(b.item)
  })

  return scored.map((entry, i) => {
    const role: EventRole = i === 0 ? 'LEAD' : i <= 3 ? 'SUPPORTING' : 'BACKGROUND'
    return {
      ...entry.item,
      rank: i + 1,
      is_lead: i === 0,
      role,
      eventType: entry.eventType,
      rankingReason: entry.rankingReason,
      eventRankScore: entry.eventRankScore,
    }
  })
}
