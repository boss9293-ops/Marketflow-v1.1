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
  summary?: string
  source?: string
  publishedAtET?: string
  dateET?: string
  timeET?: string
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
    bonus: 2.5,
  },
  {
    type: 'INFLATION',
    pattern: /\b(cpi|ppi|core pce|consumer price index|producer price|inflation|deflation|price index)\b/i,
    bonus: 2.2,
  },
  {
    type: 'EARNINGS',
    pattern: /\b(earnings|eps|revenue|net income|beat|miss|quarterly results|q[1-4] (results|earnings)|profit|loss)\b/i,
    bonus: 2.0,
  },
  {
    type: 'GUIDANCE',
    pattern: /\b(guidance|outlook|forecast|full.?year|fy2\d|raised guidance|lowered guidance|cut forecast|revised outlook)\b/i,
    bonus: 2.0,
  },
  {
    type: 'AI_INFRASTRUCTURE',
    pattern: /\b(ai spending|data center build|gpu demand|llm training|large language model|cloud capex|hyperscaler spending|ai infrastructure)\b/i,
    bonus: 1.8,
  },
  {
    type: 'ENERGY_SHOCK',
    pattern: /\b(crude oil|wti|brent|opec|hormuz|oil price|oil shock|energy crisis|natural gas|lng|refinery)\b/i,
    bonus: 1.8,
  },
  {
    type: 'MACRO',
    pattern: /\b(gdp|unemployment|jobless claims|nonfarm payroll|nfp|jobs report|recession|economic growth|macro data|ism)\b/i,
    bonus: 1.8,
  },
  {
    type: 'GEOPOLITICAL',
    pattern: /\b(war|sanction|trade war|tariff|taiwan strait|north korea|middle east|iran|ukraine|russia|geopolit)\b/i,
    bonus: 1.6,
  },
  {
    type: 'SEMICONDUCTOR',
    pattern: /\b(nvidia|nvda|amd|intel|tsmc|arm holdings|semiconductor|chip shortage|wafer|soxx|soxl|micron|asml|applied materials)\b/i,
    bonus: 1.6,
  },
  {
    type: 'CAPEX',
    pattern: /\b(capital expenditure|capex|spending plan|investment plan|hyperscaler capex|data center investment)\b/i,
    bonus: 1.6,
  },
  {
    type: 'ANALYST_ACTION',
    pattern: /\b(upgrade|downgrade|price target|initiated coverage|reiterated|outperform|underperform|overweight|underweight|buy rating|sell rating)\b/i,
    bonus: 1.2,
  },
  {
    type: 'REGULATION',
    pattern: /\b(sec filing|ftc|doj|antitrust|regulation|compliance fine|penalty|investigation|subpoena|class action|lawsuit)\b/i,
    bonus: 1.3,
  },
  {
    type: 'SUPPLY_CHAIN',
    pattern: /\b(supply chain|inventory buildup|stockpile|component shortage|oversupply|lead time|logistics disruption)\b/i,
    bonus: 1.2,
  },
  {
    type: 'CREDIT_LIQUIDITY',
    pattern: /\b(credit spread|liquidity crunch|yield curve|treasury yield|bond market|default risk|debt ceiling|high yield)\b/i,
    bonus: 1.4,
  },
  {
    type: 'MARKET_STRUCTURE',
    pattern: /\b(vix spike|volatility regime|options expiry|gamma squeeze|short squeeze|margin call|circuit breaker|put.call ratio)\b/i,
    bonus: 1.3,
  },
]

// Source prominence bonus (additive, small)
const SOURCE_BONUS: Array<{ pattern: RegExp; value: number }> = [
  { pattern: /reuters|associated press|\bap\b|bloomberg/i, value: 0.3 },
  { pattern: /wall street journal|wsj|financial times|\bft\b/i, value: 0.25 },
  { pattern: /cnbc|barron|marketwatch/i, value: 0.15 },
  { pattern: /yahoo finance|seeking alpha/i, value: 0.05 },
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

// ─── Classification ──────────────────────────────────────────────────────────

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
  if (isNaN(ageH)) return 0
  // Small bonus — recency must not dominate structural event importance
  if (ageH < 1) return 0.15
  if (ageH < 4) return 0.08
  if (ageH < 12) return 0.03
  return 0
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function rankEvents<T extends RankableItem>(items: T[]): RankedItem<T>[] {
  if (items.length === 0) return []

  const scored = items.map((item) => {
    const text = `${item.headline} ${item.summary ?? ''}`
    const { eventType, bonus, matched } = classifyEvent(text)
    const srcBonus = getSourceBonus(item.source)
    const recBonus = getRecencyBonus(item.publishedAtET, item.dateET)
    const eventRankScore = parseFloat((bonus + srcBonus + recBonus).toFixed(3))
    const base = RANKING_REASONS[eventType]
    const rankingReason = matched ? `${base} [matched: ${matched}]` : base
    return { item, eventType, eventRankScore, rankingReason }
  })

  // Sort by score descending; tie-break by original position (stable)
  scored.sort((a, b) => {
    const diff = b.eventRankScore - a.eventRankScore
    if (Math.abs(diff) > 0.001) return diff
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
