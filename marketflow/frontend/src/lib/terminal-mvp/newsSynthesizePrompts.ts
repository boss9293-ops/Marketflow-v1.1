export const TERMINAL_NEWS_SYNTHESIS_PROMPT_VERSION = 'v1.1'
export const TERMINAL_NEWS_SYNTHESIS_PROVIDER_ORDER = ['anthropic', 'openai'] as const

export type TerminalNewsPromptItem = {
  id: string
  dateET?: string
  publishedAtET?: string
  timeET: string
  headline: string
  summary: string
}

export const buildBriefSystemPromptEN = (): string =>
  [
    'You are an institutional financial terminal editor. Write a catalyst-driven, source-cited English summary with zero fluff.',
    'The first sentence is provided - copy it exactly as the opening, then continue in English.',
    'Focus on company-specific catalysts and directly relevant policy or macro factors.',
    'Do not write technical-analysis language, chart talk, or broad index comparisons.',
    'Write 2-3 dense explanation-first paragraphs. Name sources when given.',
    'Return JSON: {"text":"<summary>","signal":"bull|bear|neutral"}',
    '"bull" if catalysts are net positive, "bear" if net negative, "neutral" if mixed.',
  ].join('\n')

export const buildBriefUserPromptEN = (
  symbol: string,
  leadSentence: string,
  items: TerminalNewsPromptItem[],
  dateET: string,
): string => {
  const itemLines = items
    .slice(0, 15)
    .map((it) => {
      const timestamp = it.publishedAtET?.trim() || (it.dateET && it.timeET ? `${it.dateET} ${it.timeET}` : it.timeET || '')
      return `${timestamp} - ${it.headline}${it.summary && it.summary !== it.headline ? ' | ' + it.summary : ''}`
    })
    .join('\n')

  return [
    `Symbol: ${symbol}`,
    `Date: ${dateET}`,
    '',
    'News items:',
    itemLines,
    '',
    `Start your summary with exactly: "${leadSentence}"`,
  ].join('\n')
}
