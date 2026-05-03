export const TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION = 'v1.5'
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
}

const buildContextSection = (companyName?: string, marketContext?: string): string[] => [
  companyName?.trim() ? `Company: ${companyName.trim()}` : '',
  marketContext?.trim() ? `Market context: ${marketContext.trim()}` : '',
].filter((line) => line.length > 0)

const buildItemLines = (items: TerminalNewsPromptItem[]): string =>
  items
    .slice(0, 15)
    .map((it) => {
      const timestamp = it.publishedAtET?.trim() || (it.dateET && it.timeET ? `${it.dateET} ${it.timeET}` : it.timeET || '')
      const rankPrefix = it.rank != null
        ? `[#${it.rank}|${it.role ?? (it.is_lead ? 'LEAD' : 'OTHER')}|${it.eventType ?? 'OTHER'}] `
        : ''
      return `${rankPrefix}${timestamp} - ${it.headline}${it.summary && it.summary !== it.headline ? ' | ' + it.summary : ''}`
    })
    .join('\n')

export const buildTerminalKoSystemPrompt = (): string =>
  [
    'You are a MarketFlow research terminal editor.',
    'Write a catalyst-driven Korean commentary following this structure:',
    '  1. What happened — the catalyst, not the price move',
    '  2. Why it matters — causal chain: catalyst → market reaction → implication',
    '  3. Thesis/bucket impact — does this confirm, weaken, or leave uncertain the investment thesis?',
    '  4. Watch next — 1-2 specific signals to monitor in the next 1-3 sessions',
    '',
    'The first sentence is provided — copy it exactly as the opening, then continue in Korean.',
    'Do not open with index percentage moves or broad market recap.',
    'Focus on company-specific catalysts and directly relevant policy or macro factors.',
    'Merge multiple articles about the same catalyst into one explanation.',
    'Do not write technical-analysis language, chart talk, or broad index comparisons.',
    'Do not mention source names, outlet names, URLs, or citations in the body.',
    'Write 2-3 dense paragraphs. Sound like a human market analyst, not a data reader.',
    '',
    'News items include a rank prefix: [#N|ROLE|EVENT_TYPE].',
    'LEAD = primary story candidate. SUPPORTING = secondary driver. BACKGROUND = context only.',
    'Treat the LEAD item as the anchor of your synthesis.',
    'Do not follow chronological order alone — use the ranking signals.',
    'Your Core Question should reflect the highest-ranked market driver.',
    '',
    'Commentary type — pick one that best fits:',
    'THESIS_CONFIRMATION | CONTRADICTION_ALERT | EVENT_SETUP | MOMENTUM_STRETCH |',
    'MACRO_PRESSURE | RISK_RELIEF | PULLBACK_WATCH | BREADTH_CHECK | LEADERSHIP_ROTATION',
    '',
    'Forbidden: buy, sell, target price, recommendation, must buy, must sell, guaranteed.',
    'Use instead: thesis reinforced, thesis weakened, needs confirmation, constructive setup, watchpoint.',
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
  const itemLines = buildItemLines(items)

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
