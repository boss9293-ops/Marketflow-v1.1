const BLOCKED_SOURCE_PATTERNS: RegExp[] = [
  /tipranks/i,
  /barron'?s/i,
  /seeking alpha/i,
  /\bwsj\b/i,
  /wall street journal/i,
  /financial times/i,
  /bloomberg/i,
  /sponsored/i,
  /partner content/i,
  /paid content/i,
  /보도자료/i,
  /협찬/i,
  /스폰서/i,
  /유료광고/i,
]

const PREFERRED_SOURCE_BONUSES: Array<{ pattern: RegExp; bonus: number }> = [
  { pattern: /reuters/i, bonus: 2.6 },
  { pattern: /associated press|\bap news\b|\bap\b/i, bonus: 2.4 },
  { pattern: /yahoo finance/i, bonus: 1.8 },
  { pattern: /finnhub/i, bonus: 1.2 },
  { pattern: /alpha vantage/i, bonus: 1.1 },
  { pattern: /marketwatch/i, bonus: 1.5 },
  { pattern: /cnbc/i, bonus: 1.3 },
  { pattern: /nasdaq/i, bonus: 1.2 },
  { pattern: /benzinga/i, bonus: 0.9 },
  { pattern: /simply wall st/i, bonus: 0.7 },
  { pattern: /연합뉴스/i, bonus: 2.0 },
  { pattern: /연합뉴스tv/i, bonus: 1.8 },
  { pattern: /연합인포맥스/i, bonus: 1.9 },
  { pattern: /한국경제/i, bonus: 1.5 },
  { pattern: /매일경제/i, bonus: 1.4 },
  { pattern: /서울경제/i, bonus: 1.4 },
  { pattern: /이데일리/i, bonus: 1.3 },
  { pattern: /머니투데이/i, bonus: 1.2 },
  { pattern: /아시아경제/i, bonus: 1.1 },
  { pattern: /파이낸셜뉴스/i, bonus: 1.1 },
  { pattern: /조선비즈/i, bonus: 1.0 },
  { pattern: /뉴스1/i, bonus: 1.0 },
  { pattern: /인포스탁/i, bonus: 0.9 },
  { pattern: /naver search/i, bonus: 0.7 },
]

const NEWS_KEYWORDS = [
  'fed',
  'powell',
  'rate',
  'yield',
  'treasury',
  'cpi',
  'inflation',
  'ppi',
  'liquidity',
  'qt',
  'qe',
  'balance sheet',
  'rrp',
  'repo',
  'credit spread',
  'vix',
  'volatility',
  'bitcoin',
  'btc',
  'gold',
  'real yield',
  'tips',
  'm2',
  'earnings',
  'guidance',
  'margins',
  'tariff',
  'oil',
  'geopolitical',
  'delivery',
  'orders',
  'margin',
  '미국 증시',
  '미국 주식',
  '뉴욕증시',
  '나스닥',
  's&p500',
  '월가',
  '연준',
  '미국 금리',
  '미국 국채',
  '국채',
  '달러',
  '환율',
  '엔비디아',
  '테슬라',
  '애플',
  '마이크로소프트',
  '반도체',
  '빅테크',
  '실적',
  '가이던스',
  '변동성',
  '프리마켓',
  '애프터마켓',
]

export const isBlockedNewsSource = (source?: string | null): boolean => {
  const normalized = String(source || '').toLowerCase()
  if (!normalized) return false
  return BLOCKED_SOURCE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const isFreeNewsSource = (source?: string | null): boolean => !isBlockedNewsSource(source)

export const scoreNewsSource = (source?: string | null): number => {
  const normalized = String(source || '')
  if (isBlockedNewsSource(normalized)) return -4

  let bonus = 0
  for (const { pattern, bonus: candidate } of PREFERRED_SOURCE_BONUSES) {
    if (pattern.test(normalized)) {
      bonus = Math.max(bonus, candidate)
    }
  }
  return bonus
}

export const scoreNewsText = (text: string): number => {
  const lower = String(text || '').toLowerCase()
  let hits = 0
  for (const keyword of NEWS_KEYWORDS) {
    if (lower.includes(keyword)) hits += 1
  }
  return hits
}

export const hasPromoSignals = (text: string): boolean => {
  const lower = String(text || '').toLowerCase()
  return /press release|sponsored|partner content|paid content|보도자료|협찬|스폰서|유료광고/.test(lower)
}
