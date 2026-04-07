// app/api/terminal/news-synthesize/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NewsInputItem = {
  id: string
  timeET: string
  headline: string
  summary: string
}

type SynthesizeRequest = {
  symbol: string
  items: NewsInputItem[]
  lang: 'ko' | 'en'
}

const MAX_ITEMS_PER_BATCH = 20

export async function POST(req: Request) {
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 503 })
  }

  let body: SynthesizeRequest
  try {
    body = (await req.json()) as SynthesizeRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { symbol, items, lang } = body
  if (!symbol || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Missing symbol or items.' }, { status: 400 })
  }

  const batch = items.slice(0, MAX_ITEMS_PER_BATCH)

  const itemsText = batch
    .map((it, i) => `[ITEM-${i}|id:${it.id}]\nHeadline: ${it.headline}\nSummary: ${it.summary}`)
    .join('\n\n')

  const systemPrompt = lang === 'ko'
    ? `You are a Korean financial journalist. For each news item, write a natural, fluent 2-3 sentence summary IN KOREAN ONLY (한국어만 사용). Include price movements, analyst actions, key catalysts and risks. Format: one item per line, separated by |||. No numbering, no English.`
    : `You are a financial journalist. For each news item, write a sharp, informative 2-3 sentence synthesis in English. Include price movements, analyst actions, key catalysts and risks. Format: one item per line, separated by |||. No numbering.`

  const userPrompt = lang === 'ko'
    ? `다음 ${symbol} 뉴스 ${batch.length}개를 각각 한국어로 요약하세요. 반드시 한국어로만 작성하고 ||| 로 구분하세요.\n\n${itemsText}`
    : `Synthesize the following ${batch.length} news items for ${symbol}. Separate each with |||.\n\n${itemsText}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[news-synthesize] OpenAI error:', err)
      return NextResponse.json({ error: 'OpenAI request failed.' }, { status: 502 })
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const parts = raw.split('|||').map((s) => s.trim()).filter(Boolean)

    const results = batch.map((item, i) => ({
      id: item.id,
      text: parts[i] ?? `${item.headline} ${item.summary}`.trim(),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[news-synthesize] error:', err)
    return NextResponse.json({ error: 'Synthesis failed.' }, { status: 500 })
  }
}
