export type OutputLang = 'ko' | 'en'

export interface HealthInput {
  totalScore: number
  trend: { score: number; label: string; conf: number }
  volatility: { score: number; label: string; conf: number }
  breadth: { score: number; label: string; conf: number }
  liquidity: { score: number; label: string; conf: number }
}

export interface NarrationOutput {
  hero: string
  totalNarration: string
  trendNarration: string
  volatilityNarration: string
  breadthNarration: string
  liquidityNarration: string
  closingAdvice: string
}

export type NarrationPrompt = {
  system: string
  user: string
}

export const MARKET_HEALTH_NARRATION_PROMPT_VERSION = 'v1.1'

export function normalizeOutputLang(value?: string | null): OutputLang {
  return value === 'en' ? 'en' : 'ko'
}

export function getTotalLabel(score: number, locale: OutputLang): string {
  if (locale === 'en') {
    if (score >= 75) return 'Healthy'
    if (score >= 55) return 'Rising Risk'
    if (score >= 40) return 'Caution'
    if (score >= 20) return 'Warning'
    return 'Stress'
  }

  if (score >= 75) return '嫄닿컯'
  if (score >= 55) return '?꾪뿕'
  if (score >= 40) return '以묐┰'
  if (score >= 20) return '寃쎄퀎'
  return '?꾧린'
}

export function buildHealthNarrationPrompt(input: HealthInput, locale: OutputLang): NarrationPrompt {
  const totalLabel = getTotalLabel(input.totalScore, locale)

  const system =
    locale === 'en'
      ? [
          'You are a calm, institutional US market analyst.',
          'Write in English only.',
          'Be descriptive, not predictive.',
          'Use weather-dashboard style framing for risk.',
          'Return JSON only.',
        ].join('\n')
      : [
          '?뱀떊? ?곕쑜?섍퀬 媛먯꽦?곸씤 ?쒓뎅???쒖옣 遺꾩꽍媛?낅땲??',
          '?덉륫?섏? 留먭퀬, 吏湲덉쓽 ?쒖옣 援ъ“瑜??ㅻ챸?섏꽭??',
          '?좎뵪 由ъ뒪????쒕낫?쒖쿂??李⑤텇?섍퀬 湲곌??ъ옄???ㅼ쑝濡??묒꽦?섏꽭??',
          'JSON留?諛섑솚?섏꽭??',
        ].join('\n')

  const user =
    locale === 'en'
      ? [
          'Generate a market health narration from the following inputs.',
          '',
          `Total score: ${input.totalScore}/100 (${totalLabel})`,
          `Trend: ${input.trend.score}/25 (${input.trend.label}, confidence ${input.trend.conf}%)`,
          `Volatility: ${input.volatility.score}/25 (${input.volatility.label}, confidence ${input.volatility.conf}%)`,
          `Breadth: ${input.breadth.score}/25 (${input.breadth.label}, confidence ${input.breadth.conf}%)`,
          `Liquidity: ${input.liquidity.score}/25 (${input.liquidity.label}, confidence ${input.liquidity.conf}%)`,
          '',
          'Return JSON with this exact shape:',
          '{',
          '  "hero": "short title",',
          '  "totalNarration": "2 sentences",',
          '  "trendNarration": "1 sentence",',
          '  "volatilityNarration": "1 sentence",',
          '  "breadthNarration": "1 sentence",',
          '  "liquidityNarration": "1 sentence",',
          '  "closingAdvice": "2 sentences"',
          '}',
        ].join('\n')
      : [
          '?꾨옒 ?곗씠?곕줈 Market Health narration???묒꽦?섏꽭??',
          '',
          `珥앹젏: ${input.totalScore}/100 (${totalLabel})`,
          `異붿꽭: ${input.trend.score}/25 (${input.trend.label}, ?좊ː??${input.trend.conf}%)`,
          `蹂?숈꽦: ${input.volatility.score}/25 (${input.volatility.label}, ?좊ː??${input.volatility.conf}%)`,
          `Breadth: ${input.breadth.score}/25 (${input.breadth.label}, ?좊ː??${input.breadth.conf}%)`,
          `Liquidity: ${input.liquidity.score}/25 (${input.liquidity.label}, ?좊ː??${input.liquidity.conf}%)`,
          '',
          '?ㅼ쓬 JSON ?뺤떇留?諛섑솚?섏꽭??',
          '{',
          '  "hero": "吏㏃? ?쒕ぉ",',
          '  "totalNarration": "2臾몄옣",',
          '  "trendNarration": "1臾몄옣",',
          '  "volatilityNarration": "1臾몄옣",',
          '  "breadthNarration": "1臾몄옣",',
          '  "liquidityNarration": "1臾몄옣",',
          '  "closingAdvice": "2臾몄옣"',
          '}',
        ].join('\n')

  return { system, user }
}

export function buildFallbackNarration(input: HealthInput, locale: OutputLang): NarrationOutput {
  const totalLabel = getTotalLabel(input.totalScore, locale)
  const totalNarration =
    locale === 'en'
      ? `Market structure is currently ${totalLabel.toLowerCase()} at ${input.totalScore}/100. This is a descriptive read of conditions, not a forecast.`
      : `?쒖옣 援ъ“???꾩옱 ${totalLabel} 援ш컙???덉쑝硫?珥앹젏? ${input.totalScore}/100?낅땲?? ?대뒗 ?꾩옱 議곌굔??????ㅻ챸?댁? ?덉륫???꾨떃?덈떎.`

  const tone = (score: number) => {
    if (score >= 18) return locale === 'en' ? 'elevated' : '?믪븘吏?'
    if (score >= 12) return locale === 'en' ? 'moderate' : '以묎컙 ?섏???'
    return locale === 'en' ? 'contained' : '?꾨쭔??'
  }

  return {
    hero: locale === 'en' ? 'Market Health' : '?쒖옣 嫄닿컯??',
    totalNarration,
    trendNarration:
      locale === 'en'
        ? `Trend pressure is ${tone(input.trend.score)} and the trend layer remains ${input.trend.label.toLowerCase()}.`
        : `異붿꽭 ?뺣젰? ${tone(input.trend.score)} ?섏??대ŉ 異붿꽭 ?덉씠?대뒗 ${input.trend.label} ?곹깭?낅땲??`,
    volatilityNarration:
      locale === 'en'
        ? `Volatility is ${tone(input.volatility.score)} with the current label ${input.volatility.label}.`
        : `蹂?숈꽦? ${tone(input.volatility.score)} ?섏??대ŉ ?꾩옱 ?쇰꺼? ${input.volatility.label}?낅땲??`,
    breadthNarration:
      locale === 'en'
        ? `Breadth is ${tone(input.breadth.score)} and participation remains ${input.breadth.label.toLowerCase()}.`
        : `Breadth??${tone(input.breadth.score)} ?섏??대ŉ 李몄뿬?꾨뒗 ${input.breadth.label} ?곹깭?낅땲??`,
    liquidityNarration:
      locale === 'en'
        ? `Liquidity remains ${tone(input.liquidity.score)} and should be treated as a key context variable.`
        : `?좊룞?깆? ${tone(input.liquidity.score)} ?섏??대ŉ ?듭떖 肄섑뀓?ㅽ듃 蹂?섎줈 遊먯빞 ?⑸땲??`,
    closingAdvice:
      locale === 'en'
        ? 'Treat this as a descriptive dashboard. Confirm any change in posture with broader regime evidence before acting.'
        : '???댁슜? ?댁꽍????쒕낫?쒕줈 蹂댁꽭?? ?ъ???蹂?붾뒗 ???볦? ?덉쭚 洹쇨굅瑜??뺤씤????寃곗젙?섏꽭??',
  }
}
