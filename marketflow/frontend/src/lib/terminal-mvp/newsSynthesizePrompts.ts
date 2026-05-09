export const TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION = 'v1.8'
export const TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER = ['anthropic', 'openai'] as const

export type TerminalNewsPromptItem = {
  id: string
  dateET?: string
  publishedAtET?: string
  timeET: string
  headline: string
  summary: string
  source?: string
  url?: string
  // Event ranking fields — injected by eventRanker.ts before LLM call
  rank?: number
  is_lead?: boolean
  role?: 'LEAD' | 'SUPPORTING' | 'BACKGROUND'
  eventType?: string
  rankingReason?: string
  eventRankScore?: number
  tags?: string[]
  relevanceScore?: number
}

// ─── Briefing hierarchy types ─────────────────────────────────────────────────

export type BriefingTopStory = {
  rank: 1
  role: 'LEAD'
  eventType: string
  headline: string
  summary?: string
  rankingReason: string
  tags?: string[]
  relevanceScore?: number
  eventRankScore: number
}

export type BriefingDriver = {
  rank: number
  role: 'SUPPORTING'
  eventType: string
  headline: string
  rankingReason: string
  tags?: string[]
}

export type BriefingContext = {
  top_story: BriefingTopStory
  supporting_drivers: BriefingDriver[]
  background_items: TerminalNewsPromptItem[]
}

export function buildBriefingContext(
  ranked: TerminalNewsPromptItem[],
): BriefingContext | null {
  if (ranked.length === 0) return null
  const lead = ranked[0]
  const supporting = ranked.slice(1, 4)
  const background = ranked.slice(4)
  return {
    top_story: {
      rank: 1,
      role: 'LEAD',
      eventType: lead.eventType ?? 'OTHER',
      headline: lead.headline,
      summary: lead.summary || undefined,
      rankingReason: lead.rankingReason ?? '',
      tags: lead.tags,
      relevanceScore: lead.relevanceScore,
      eventRankScore: lead.eventRankScore ?? 0,
    },
    supporting_drivers: supporting.map((it) => ({
      rank: it.rank ?? 0,
      role: 'SUPPORTING' as const,
      eventType: it.eventType ?? 'OTHER',
      headline: it.headline,
      rankingReason: it.rankingReason ?? '',
      tags: it.tags,
    })),
    background_items: background,
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const buildContextSection = (companyName?: string, marketContext?: string): string[] => [
  companyName?.trim() ? `Company: ${companyName.trim()}` : '',
  marketContext?.trim() ? `Market context: ${marketContext.trim()}` : '',
].filter((line) => line.length > 0)

function buildItemTimestamp(it: TerminalNewsPromptItem): string {
  return it.publishedAtET?.trim() || (it.dateET && it.timeET ? `${it.dateET} ${it.timeET}` : it.timeET || '')
}

function buildStructuredItemLines(items: TerminalNewsPromptItem[]): string {
  const lead = items.filter((it) => it.role === 'LEAD' || it.is_lead)
  const supporting = items.filter((it) => it.role === 'SUPPORTING')
  const background = items.filter((it) => it.role === 'BACKGROUND').slice(0, 5)

  const fmt = (it: TerminalNewsPromptItem): string => {
    const ts = buildItemTimestamp(it)
    const prefix = `[#${it.rank}|${it.role ?? 'OTHER'}|${it.eventType ?? 'OTHER'}]`
    const body = `${it.headline}${it.summary && it.summary !== it.headline ? ' | ' + it.summary : ''}`
    return `${prefix} ${ts} - ${body}`
  }

  const sections: string[] = []

  if (lead.length > 0) {
    sections.push('TOP STORY (anchor — build Core Question from this):')
    sections.push(fmt(lead[0]))
  }

  if (supporting.length > 0) {
    sections.push('')
    sections.push('SUPPORTING DRIVERS (secondary context only):')
    supporting.forEach((it) => sections.push(fmt(it)))
  }

  if (background.length > 0) {
    sections.push('')
    sections.push('BACKGROUND (use only if directly reinforces top story):')
    background.forEach((it) => sections.push(fmt(it)))
  }

  return sections.join('\n')
}

export const buildTerminalKoSystemPrompt = (): string =>
  [
    'You are a MarketFlow research terminal editor.',
    'Write a catalyst-driven Korean commentary following this structure:',
    '  1. What happened — the catalyst, not the price move',
    '  2. Why it matters — evidence chain: catalyst → possible market read-through → implication',
    '  3. Thesis/bucket impact — does this confirm, weaken, or leave uncertain the investment thesis?',
    '  4. Watch next — 1-2 specific signals to monitor in the next 1-3 sessions',
    '',
    'The first sentence is provided — copy it exactly as the opening, then continue in Korean.',
    'Do not open with index percentage moves or broad market recap.',
    'Focus on company-specific catalysts and directly relevant policy or macro factors.',
    'Merge multiple articles about the same catalyst into one explanation.',
    'Do not claim the price move was caused by the article unless the provided evidence explicitly supports that causal link.',
    'If the evidence is mixed or indirect, say that clearly instead of filling the gap.',
    'Do not write technical-analysis language, chart talk, or broad index comparisons.',
    'Do not mention source names, outlet names, URLs, or citations in the body.',
    'Write 2-3 dense paragraphs. Sound like a human market analyst, not a data reader.',
    '',
    'BRIEFING HIERARCHY — strictly enforce:',
    '  TOP STORY = rank 1, pre-determined by event ranker. Your Core Question MUST be based on this.',
    '  SUPPORTING DRIVERS = rank 2-4. Use only as secondary context to reinforce or contrast top story.',
    '  BACKGROUND = context only. Do NOT let background items override the top story.',
    '  Do NOT reorder by time. The hierarchy is already determined — follow it.',
    '  Do NOT lead with an index recap unless the top story itself is a MARKET_STRUCTURE event.',
    '  If you believe the ranking is wrong, you may note it in one short sentence — but still anchor to the top story.',
    '',
    'Commentary type — pick one that best fits:',
    'THESIS_CONFIRMATION | CONTRADICTION_ALERT | CATALYST_WATCH | MOMENTUM_STRETCH |',
    'MACRO_PRESSURE | RISK_RELIEF | PULLBACK_WATCH | BREADTH_CHECK | LEADERSHIP_ROTATION',
    '',
    'Forbidden: buy, sell, target price, recommendation, must buy, must sell, guaranteed.',
    'Use instead: thesis reinforced, thesis weakened, needs confirmation, developing catalyst, watchpoint.',
    '',
    'Return JSON only — no markdown, no code block:',
    '{"text":"<Korean commentary>","signal":"bull|bear|neutral","commentary_type":"<TYPE>","core_question":"<one Korean sentence question>","watch_next":["<signal 1>","<signal 2>"]}',
    '"bull" if net positive, "bear" if net negative, "neutral" if mixed.',
  ].join('\n')

export const buildTerminalKoUserPrompt = (
  symbol: string,
  leadSentence: string,
  items: TerminalNewsPromptItem[],
  dateET: string,
  companyName?: string,
  marketContext?: string,
): string => {
  const contextSection = buildContextSection(companyName, marketContext)
  const itemLines = buildStructuredItemLines(items)

  return [
    `Symbol: ${symbol}`,
    `Date: ${dateET}`,
    '',
    ...contextSection,
    ...(contextSection.length ? [''] : []),
    'News items:',
    itemLines,
    '',
    `Start your summary with exactly: "${leadSentence}"`,
  ].join('\n')
}

export const buildTerminalEnSystemPrompt = (): string =>
  [
    'You are an institutional financial terminal translator.',
    'Translate the provided Korean terminal summary into natural English for a market professional.',
    'Preserve tickers, numbers, company names, and the causal structure.',
    'Do not add source names, URLs, citations, or extra commentary.',
    'Return JSON: {"text":"<English translation>"}',
  ].join('\n')

export const buildTerminalEnUserPrompt = (
  symbol: string,
  koreanText: string,
  dateET: string,
  companyName?: string,
  marketContext?: string,
): string => {
  const contextSection = buildContextSection(companyName, marketContext)

  return [
    `Symbol: ${symbol}`,
    `Date: ${dateET}`,
    '',
    ...contextSection,
    ...(contextSection.length ? [''] : []),
    'Korean summary to translate:',
    koreanText.trim(),
  ].join('\n')
}

// Backwards-compatible aliases for any older imports.
export const buildBriefSystemPromptKO = buildTerminalKoSystemPrompt
export const buildBriefUserPromptKO = buildTerminalKoUserPrompt
export const buildBriefSystemPromptEN = buildTerminalEnSystemPrompt
export const buildBriefUserPromptEN = buildTerminalEnUserPrompt
