/**
 * eventExtractor.ts — Stage 1
 * Rule-based event extraction with directness scoring.
 * No LLM. Transforms raw news array → MarketEvent[] filtered by directness >= threshold.
 */

export type EventCluster =
  | 'fed'
  | 'macro'
  | 'earnings'
  | 'geopolitical'
  | 'sector'
  | 'general'

export type EventSentiment = 'bullish' | 'bearish' | 'neutral'

export type MarketEvent = {
  id: string
  headline: string
  source: string
  publishedAt: string
  timeET: string
  // Extracted
  subject: string      // e.g. "Fed", "Apple", "NVIDIA"
  actionVerb: string   // e.g. "cuts", "beats", "surges"
  magnitude: string    // e.g. "25bp", "12%", "$2.1B" — empty if none
  // Scores
  directness: number   // 0–10
  cluster: EventCluster
  sentiment: EventSentiment
  assets: string[]     // ticker mentions in CAPS
  tags: string[]
}

type RawNewsItem = {
  id: string
  headline: string
  source: string
  summary?: string
  publishedAt?: string
  publishedAtET?: string
  timeET?: string
  tags?: string[]
}

// ─── CONFIG ────────────────────────────────────────────────────────────────

const DIRECTNESS_THRESHOLD = 4

// Phrases/patterns that boost directness
const CONCRETE_NUMBER_RE =
  /\$[\d,]+(\.[\d]+)?|\b[\d,]+(\.[\d]+)?\s*(%|bp|bps|basis points?|billion|million|trillion)|\b(up|down|fell?|rose?|drop|surge|gain|lost?)\s+[\d]/i

const ACTION_VERBS: string[] = [
  // Price-action verbs (headline-first targets)
  'closed up', 'closed down', 'trading up', 'trading down',
  'surged', 'surges', 'plunged', 'plunges', 'rallied', 'rallies',
  'dropped', 'drops', 'fell', 'falls', 'rose', 'rises', 'gained', 'gains',
  'retraces', 'retracing',
  // Corporate actions
  'cuts', 'cut', 'raises', 'raised', 'hikes', 'hiked',
  'beats', 'beat', 'misses', 'missed',
  'collapses', 'collapsed', 'warns', 'warned',
  'halts', 'halted', 'suspends', 'suspended',
  'announces', 'announced', 'approves', 'approved', 'rejects', 'rejected',
  'fires', 'fired', 'acquires', 'acquired', 'merges', 'merged',
  'reports', 'reported', 'lowers', 'lowered',
  'upgrades', 'upgraded', 'downgrades', 'downgraded',
  'launches', 'launched', 'forecasts', 'forecast',
  // Options / flow verbs
  'opened', 'open',
  // Macro movement verbs
  'triggers', 'triggered', 'climbed', 'climbs',
  'jumped', 'jumps', 'sank', 'slid', 'retreated', 'retreats',
  'hit', 'hits', 'tested', 'breached', 'crossed',
]

// Vague language that reduces directness
const VAGUE_SIGNALS: RegExp[] = [
  /\b(could|might|possibly|expected to|likely|reportedly|sources say|according to analysts)\b/i,
  /\bmay\b(?![-\d])/i,  // 'may' but not 'May-26' (options expiry)
]

// Opinion markers
const OPINION_MARKERS: RegExp[] = [
  /\b(analysts? say|according to|sources familiar|reportedly|rumored?|speculation)\b/i,
]

// Ticker pattern: 2–5 uppercase letters in word boundary
const TICKER_RE = /\b([A-Z]{2,5})\b/g

// Known non-ticker caps words to exclude
const NON_TICKERS = new Set([
  'A', 'AT', 'BE', 'FOR', 'IN', 'ON', 'IS', 'TO', 'THE', 'AND', 'OR', 'OF',
  'BY', 'IT', 'IF', 'US', 'UK', 'EU', 'UN', 'AS', 'UP', 'AN', 'DO', 'GO',
  'AI', 'CEO', 'CFO', 'COO', 'CTO', 'IPO', 'GDP', 'CPI', 'PPI', 'PCE',
  'FED', 'SEC', 'DOJ', 'FDA', 'ETF', 'VIX', 'DOW', 'S&P', 'SP',
  'QE', 'QT', 'RRP', 'MBS', 'ETF', 'OMB', 'CBO', 'IMF',
  'HYG', 'JNK', 'TLT', 'GLD', 'SLV', 'OIL', 'USO',
])

// ─── CLUSTER RULES ─────────────────────────────────────────────────────────

const CLUSTER_RULES: Array<{ cluster: EventCluster; words: string[] }> = [
  {
    cluster: 'fed',
    words: ['fed', 'powell', 'fomc', 'rate hike', 'rate cut', 'basis point', 'federal reserve', 'monetary policy'],
  },
  {
    cluster: 'macro',
    words: ['cpi', 'ppi', 'gdp', 'inflation', 'unemployment', 'jobs', 'nonfarm', 'payroll', 'yield', 'treasury', 'recession', 'tariff', 'trade war'],
  },
  {
    cluster: 'earnings',
    words: ['earnings', 'revenue', 'eps', 'guidance', 'quarter', 'q1', 'q2', 'q3', 'q4', 'beat', 'miss', 'forecast'],
  },
  {
    cluster: 'geopolitical',
    words: ['war', 'sanction', 'china', 'russia', 'ukraine', 'taiwan', 'geopolit', 'conflict', 'election', 'trump', 'biden'],
  },
  {
    cluster: 'sector',
    words: ['oil', 'energy', 'semiconductor', 'chip', 'bank', 'financial', 'pharma', 'biotech', 'tech', 'retail', 'housing'],
  },
]

// ─── SENTIMENT RULES ───────────────────────────────────────────────────────

const BULLISH_WORDS = [
  'beats', 'beat', 'surges', 'surged', 'rises', 'rose', 'gains', 'gained',
  'record', 'high', 'upgrade', 'upgraded', 'growth', 'profit', 'revenue',
  'recovery', 'rally', 'strong', 'positive', 'buys', 'buy',
]

const BEARISH_WORDS = [
  'misses', 'missed', 'falls', 'fell', 'drops', 'dropped', 'plunges', 'plunged',
  'collapses', 'collapsed', 'warns', 'warned', 'cuts guidance', 'lower', 'loss',
  'recession', 'downgrade', 'downgraded', 'weak', 'negative', 'sells', 'tariff',
  'layoffs', 'halts', 'suspended', 'fraud', 'investigation',
]

// ─── HELPERS ───────────────────────────────────────────────────────────────

function hoursFromNow(ts?: string): number {
  if (!ts) return 999
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return 999
  return Math.max(0, (Date.now() - date.getTime()) / 36e5)
}

function extractSubject(headline: string): string {
  // Priority 1: ALL-CAPS ticker at start (NVDA, AAPL, TSLA ...)
  const tickerStart = headline.match(/^([A-Z]{2,5})/)
  if (tickerStart && !NON_TICKERS.has(tickerStart[1])) return tickerStart[1]

  // Priority 2: Fed / macro authority
  const fedMatch = headline.match(/(Fed|Federal Reserve|FOMC|Powell|Treasury|Bank of America|BofA|SemiAccurate)/i)
  if (fedMatch) return fedMatch[0]

  // Priority 3: Proper-name company at start
  const corpMatch = headline.match(/^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+/)
  if (corpMatch) return corpMatch[1]

  return ''
}

function extractActionVerb(headline: string): string {
  // Scan headline only — prevents summary noise picking irrelevant verbs
  const lower = headline.toLowerCase()
  return ACTION_VERBS.find((v) => lower.includes(v)) ?? ''
}

function extractMagnitude(text: string): string {
  const m = text.match(/[\$€]?\d+(?:\.\d+)?(?:\s*(?:billion|million|trillion|%|bp|bps|basis points?))/i)
  return m ? m[0].trim() : ''
}

function extractAssets(headline: string, summary: string): string[] {
  const text = `${headline} ${summary ?? ''}`
  const found = new Set<string>()
  let m: RegExpExecArray | null
  TICKER_RE.lastIndex = 0
  while ((m = TICKER_RE.exec(text)) !== null) {
    if (!NON_TICKERS.has(m[1])) found.add(m[1])
  }
  return [...found].slice(0, 5)
}

function classifyCluster(text: string): EventCluster {
  const lower = text.toLowerCase()
  let best: EventCluster = 'general'
  let bestHits = 0
  for (const { cluster, words } of CLUSTER_RULES) {
    const hits = words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0)
    if (hits > bestHits) { bestHits = hits; best = cluster }
  }
  return best
}

function classifySentiment(text: string): EventSentiment {
  const lower = text.toLowerCase()
  const bull = BULLISH_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0)
  const bear = BEARISH_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0)
  if (bull > bear) return 'bullish'
  if (bear > bull) return 'bearish'
  return 'neutral'
}

function scoreDirectness(headline: string, summary: string, source: string, publishedAt?: string): number {
  const text = `${headline} ${summary ?? ''}`
  let score = 0

  // +3: Concrete number / magnitude
  if (CONCRETE_NUMBER_RE.test(text)) score += 3

  // +2: Action verb present
  if (ACTION_VERBS.some((v) => text.toLowerCase().includes(v))) score += 2

  // +2: Specific asset/ticker in headline (caps word ≥ 2 chars, not stop word)
  const hasTickerInHeadline = (() => {
    TICKER_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TICKER_RE.exec(headline)) !== null) {
      if (!NON_TICKERS.has(m[1])) return true
    }
    return false
  })()
  if (hasTickerInHeadline) score += 2

  // +1: Recency bonus (< 4 hours)
  const hours = hoursFromNow(publishedAt)
  if (hours < 4) score += 1
  else if (hours > 48) score -= 1

  // +1: Preferred source
  if (/reuters|associated press|ap news|\bap\b/i.test(source)) score += 1

  // -2: Vague language
  if (VAGUE_SIGNALS.some((re) => re.test(text))) score -= 2

  // -1: Opinion markers
  if (OPINION_MARKERS.some((re) => re.test(text))) score -= 1

  return Math.max(0, Math.min(10, score))
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────

export function extractEvents(
  items: RawNewsItem[],
  options: { threshold?: number; maxItems?: number } = {},
): MarketEvent[] {
  const { threshold = DIRECTNESS_THRESHOLD, maxItems = 20 } = options

  const events: MarketEvent[] = items.map((item) => {
    const text = `${item.headline} ${item.summary ?? ''}`
    const publishedAt = item.publishedAt ?? item.publishedAtET ?? ''

    const directness = scoreDirectness(
      item.headline,
      item.summary ?? '',
      item.source,
      publishedAt,
    )

    return {
      id: item.id,
      headline: item.headline,
      source: item.source,
      publishedAt,
      timeET: item.timeET ?? '',
      subject: extractSubject(item.headline),
      actionVerb: extractActionVerb(item.headline),
      magnitude: extractMagnitude(text),
      directness,
      cluster: classifyCluster(text),
      sentiment: classifySentiment(text),
      assets: extractAssets(item.headline, item.summary ?? ''),
      tags: item.tags ?? [classifyCluster(text)],
    }
  })

  return events
    .filter((e) => e.directness >= threshold)
    .sort((a, b) => b.directness - a.directness)
    .slice(0, maxItems)
}
