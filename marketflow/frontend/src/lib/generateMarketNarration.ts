import {
  buildFallbackNarration as buildFallbackNarrationShared,
  buildHealthNarrationPrompt as buildHealthNarrationPromptShared,
  normalizeOutputLang as normalizeOutputLangShared,
} from './marketHealthNarrationPrompts'

export type { HealthInput, NarrationOutput, OutputLang } from './marketHealthNarrationPrompts'

function parseNarrationJson(text: string): import('./marketHealthNarrationPrompts').NarrationOutput {
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as import('./marketHealthNarrationPrompts').NarrationOutput
}

async function callAnthropicNarration(systemPrompt: string, userPrompt: string): Promise<import('./marketHealthNarrationPrompts').NarrationOutput> {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) throw new Error(`Anthropic API ${response.status}`)
  const data = await response.json()
  const text: string | undefined = data?.content?.[0]?.text
  if (!text) throw new Error('Anthropic empty response')
  return parseNarrationJson(text)
}

async function callGeminiNarration(systemPrompt: string, userPrompt: string): Promise<import('./marketHealthNarrationPrompts').NarrationOutput> {
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
        parts: [{ text: systemPrompt }],
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
  input: import('./marketHealthNarrationPrompts').HealthInput,
  options?: { outputLang?: import('./marketHealthNarrationPrompts').OutputLang | null }
): Promise<import('./marketHealthNarrationPrompts').NarrationOutput> {
  const locale = normalizeOutputLangShared(options?.outputLang ?? 'ko')
  const prompt = buildHealthNarrationPromptShared(input, locale)

  try {
    return await callAnthropicNarration(prompt.system, prompt.user)
  } catch (anthropicErr) {
    console.error('Anthropic narration failed, trying Gemini:', anthropicErr)
  }

  try {
    return await callGeminiNarration(prompt.system, prompt.user)
  } catch (geminiErr) {
    console.error('Gemini narration failed, using fallback:', geminiErr)
    return buildFallbackNarrationShared(input, locale)
  }
}
