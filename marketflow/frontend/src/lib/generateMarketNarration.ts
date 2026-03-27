type OutputLang = 'ko' | 'en'

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

type NarrationPrompt = {
  system: string
  user: string
}

function normalizeOutputLang(value?: string | null): OutputLang {
  return value === 'en' ? 'en' : 'ko'
}

function getTotalLabel(score: number, locale: OutputLang): string {
  if (locale === 'en') {
    if (score >= 75) return 'Healthy'
    if (score >= 55) return 'Rising Risk'
    if (score >= 40) return 'Caution'
    if (score >= 20) return 'Warning'
    return 'Stress'
  }

  if (score >= 75) return '건강'
  if (score >= 55) return '위험'
  if (score >= 40) return '중립'
  if (score >= 20) return '경계'
  return '위기'
}

function buildPrompt(input: HealthInput, locale: OutputLang): NarrationPrompt {
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
          '당신은 따뜻하고 감성적인 한국어 시장 분석가입니다.',
          '예측하지 말고, 지금의 시장 구조를 설명하세요.',
          '날씨 리스크 대시보드처럼 차분하고 기관투자자 톤으로 작성하세요.',
          'JSON만 반환하세요.',
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
          '아래 데이터로 Market Health narration을 작성하세요.',
          '',
          `총점: ${input.totalScore}/100 (${totalLabel})`,
          `추세: ${input.trend.score}/25 (${input.trend.label}, 신뢰도 ${input.trend.conf}%)`,
          `변동성: ${input.volatility.score}/25 (${input.volatility.label}, 신뢰도 ${input.volatility.conf}%)`,
          `Breadth: ${input.breadth.score}/25 (${input.breadth.label}, 신뢰도 ${input.breadth.conf}%)`,
          `Liquidity: ${input.liquidity.score}/25 (${input.liquidity.label}, 신뢰도 ${input.liquidity.conf}%)`,
          '',
          '다음 JSON 형식만 반환하세요:',
          '{',
          '  "hero": "짧은 제목",',
          '  "totalNarration": "2문장",',
          '  "trendNarration": "1문장",',
          '  "volatilityNarration": "1문장",',
          '  "breadthNarration": "1문장",',
          '  "liquidityNarration": "1문장",',
          '  "closingAdvice": "2문장"',
          '}',
        ].join('\n')

  return { system, user }
}

function parseNarrationJson(text: string): NarrationOutput {
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as NarrationOutput
}

function buildFallbackNarration(input: HealthInput, locale: OutputLang): NarrationOutput {
  const totalLabel = getTotalLabel(input.totalScore, locale)
  const totalNarration =
    locale === 'en'
      ? `Market structure is currently ${totalLabel.toLowerCase()} at ${input.totalScore}/100. This is a descriptive read of conditions, not a forecast.`
      : `시장 구조는 현재 ${totalLabel} 구간에 있으며 총점은 ${input.totalScore}/100입니다. 이는 현재 조건에 대한 설명이지 예측이 아닙니다.`

  const tone = (score: number) => {
    if (score >= 18) return locale === 'en' ? 'elevated' : '높아진'
    if (score >= 12) return locale === 'en' ? 'moderate' : '중간 수준의'
    return locale === 'en' ? 'contained' : '완만한'
  }

  return {
    hero: locale === 'en' ? 'Market Health' : '시장 건강도',
    totalNarration,
    trendNarration:
      locale === 'en'
        ? `Trend pressure is ${tone(input.trend.score)} and the trend layer remains ${input.trend.label.toLowerCase()}.`
        : `추세 압력은 ${tone(input.trend.score)} 수준이며 추세 레이어는 ${input.trend.label} 상태입니다.`,
    volatilityNarration:
      locale === 'en'
        ? `Volatility is ${tone(input.volatility.score)} with the current label ${input.volatility.label}.`
        : `변동성은 ${tone(input.volatility.score)} 수준이며 현재 라벨은 ${input.volatility.label}입니다.`,
    breadthNarration:
      locale === 'en'
        ? `Breadth is ${tone(input.breadth.score)} and participation remains ${input.breadth.label.toLowerCase()}.`
        : `Breadth는 ${tone(input.breadth.score)} 수준이며 참여도는 ${input.breadth.label} 상태입니다.`,
    liquidityNarration:
      locale === 'en'
        ? `Liquidity remains ${tone(input.liquidity.score)} and should be treated as a key context variable.`
        : `유동성은 ${tone(input.liquidity.score)} 수준이며 핵심 콘텍스트 변수로 봐야 합니다.`,
    closingAdvice:
      locale === 'en'
        ? 'Treat this as a descriptive dashboard. Confirm any change in posture with broader regime evidence before acting.'
        : '이 내용은 해석용 대시보드로 보세요. 포지션 변화는 더 넓은 레짐 근거를 확인한 뒤 결정하세요.',
  }
}

async function callAnthropicNarration(userPrompt: string, locale: OutputLang): Promise<NarrationOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: buildPrompt({ totalScore: 0, trend: { score: 0, label: '', conf: 0 }, volatility: { score: 0, label: '', conf: 0 }, breadth: { score: 0, label: '', conf: 0 }, liquidity: { score: 0, label: '', conf: 0 } }, locale).system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) throw new Error(`Anthropic API ${response.status}`)
  const data = await response.json()
  const text: string | undefined = data?.content?.[0]?.text
  if (!text) throw new Error('Anthropic empty response')
  return parseNarrationJson(text)
}

async function callGeminiNarration(userPrompt: string, locale: OutputLang): Promise<NarrationOutput> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
  if (!apiKey) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY missing')

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [{ text: buildPrompt({ totalScore: 0, trend: { score: 0, label: '', conf: 0 }, volatility: { score: 0, label: '', conf: 0 }, breadth: { score: 0, label: '', conf: 0 }, liquidity: { score: 0, label: '', conf: 0 } }, locale).system }],
      },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    }),
  })

  if (!response.ok) throw new Error(`Gemini API ${response.status}`)
  const data = await response.json()
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim()
  if (!text) throw new Error('Gemini empty response')
  return parseNarrationJson(text)
}

export async function generateMarketNarration(
  input: HealthInput,
  options?: { outputLang?: OutputLang | null }
): Promise<NarrationOutput> {
  const locale = normalizeOutputLang(options?.outputLang ?? 'ko')
  const prompt = buildPrompt(input, locale)

  try {
    return await callAnthropicNarration(prompt.user, locale)
  } catch (anthropicErr) {
    console.error('Anthropic narration failed, trying Gemini:', anthropicErr)
  }

  try {
    return await callGeminiNarration(prompt.user, locale)
  } catch (geminiErr) {
    console.error('Gemini narration failed, using fallback:', geminiErr)
    return buildFallbackNarration(input, locale)
  }
}
