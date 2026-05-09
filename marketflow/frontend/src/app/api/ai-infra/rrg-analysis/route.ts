// AI Bottleneck Radar RRG 로테이션 분석 — Claude API 호출 라우트
import { NextResponse } from 'next/server'
import type { RrgSeries } from '@/lib/semiconductor/rrgPathData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── In-memory cache ───────────────────────────────────────────────────────────
const analysisCache = new Map<string, { text: string; ts: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheKey(data: unknown): string {
  const s = JSON.stringify(data)
  // lightweight deterministic key
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return h.toString(36)
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a sector rotation analyst embedded in the MarketFlow app.

Your task: analyze the RRG (Relative Rotation Graph) data provided and write a concise Korean-language market rotation briefing.

## Output Rules

1. Write in Korean. Natural, professional tone — like a senior analyst briefing a portfolio manager.
2. NEVER list raw RS-Ratio or RS-Momentum numbers. Users already see the table. Your job is interpretation, not data recitation.
3. NEVER use bullet points or numbered lists. Write in flowing prose paragraphs.
4. Total length: 150–250 words (Korean). Strict. Do not exceed.
5. Do not say "투자 조언이 아닙니다" or any disclaimer — the app already displays this.
6. Do not mention the RRG formula, z-score, EMA, or any calculation methodology.
7. Do not use emoji.

## Analysis Framework

Structure your response in exactly 3 paragraphs:

**Paragraph 1 — 전체 흐름 (Overall Rotation Picture)**
Describe the current rotation phase of the entire universe in one sweep.
- Is the energy concentrated in Leading, or scattered across Lagging?
- Is there a dominant rotation direction (clockwise progression) or stalling?
- How many sectors are in each quadrant? Summarize as a ratio feel, not exact counts.

**Paragraph 2 — 강세 축과 약세 축 (Strength vs Weakness)**
Name the strongest sectors (Leading + high momentum) and explain WHY they are strong in rotation terms (e.g., "sustained outperformance accelerating" vs "peaking and starting to cool").
Then name the weakest sectors (deep Lagging, falling momentum) and characterize their state.
For Weakening quadrant sectors, note whether they are just entering (early warning) or deep into weakening (imminent rotation to Lagging).

**Paragraph 3 — 주목할 변화 (Key Rotation Signals)**
Identify 1-2 sectors showing the most meaningful movement:
- A sector crossing from one quadrant to another (or about to)
- A sector whose tail direction is diverging from its quadrant
- A sector accelerating away from center or decelerating toward center
End with one sentence on what to watch next.

## Interpreting the Data

- RS-Ratio far above 100 → "확고한 강세", near 100 → "중립 경계", far below → "뚜렷한 약세"
- RS-Momentum above 100 → "상승 모멘텀", below 100 → "하락 모멘텀"
- Tail moving right+up → "강세 가속", left+down → "약세 심화", right+down → "강세이나 둔화", left+up → "약세이나 회복 조짐"
- Distance from center (100,100) → energy level. Close to center = low conviction, far = high conviction
- Clockwise rotation is normal cycle. Counter-clockwise is reversal signal.`

// ── Data formatter ────────────────────────────────────────────────────────────
function formatForAnalysis(series: RrgSeries[], lookback: number) {
  return series
    .filter(s => s.source === 'LOCAL_DB' && s.points.length > 0)
    .map(s => {
      const last = s.points.at(-1)
      const tail = s.points.slice(-Math.max(lookback, 4)).map(p => ({
        rs_ratio:    p.rsRatio,
        rs_momentum: p.rsMomentum,
      }))
      return {
        name:        s.label,
        quadrant:    s.quadrant.toLowerCase(),
        rs_ratio:    last?.rsRatio    ?? null,
        rs_momentum: last?.rsMomentum ?? null,
        tail,
      }
    })
    .filter(s => s.rs_ratio != null)
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? ''
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 503 })
  }

  let body: { series: RrgSeries[]; benchmark: string; date: string; lookback?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { series, benchmark, date, lookback = 8 } = body

  if (!Array.isArray(series) || series.length < 3) {
    return NextResponse.json({ error: '분석에 최소 3개 이상의 섹터가 필요합니다.' }, { status: 400 })
  }

  const rrgData = formatForAnalysis(series, lookback)
  if (rrgData.length < 3) {
    return NextResponse.json({ error: '분석에 최소 3개 이상의 섹터가 필요합니다.' }, { status: 400 })
  }

  // Cache check
  const key = cacheKey({ rrgData, benchmark })
  const hit = analysisCache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json({ analysis: hit.text, cached: true })
  }

  const userMessage = `아래 RRG 데이터를 분석하여 시장 로테이션 브리핑을 작성하라.

Universe: AI Bottleneck Radar (13 AI Infrastructure Buckets)
Benchmark: ${benchmark}
Timeframe: 24주
Date: ${date}

Data:
${JSON.stringify(rrgData, null, 2)}`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-chat',
        max_tokens:  1000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage   },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[rrg-analysis] DeepSeek error', res.status, errText)
      return NextResponse.json({ error: '분석을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    if (!text) return NextResponse.json({ error: '빈 응답이 반환되었습니다.' }, { status: 502 })

    analysisCache.set(key, { text, ts: Date.now() })
    return NextResponse.json({ analysis: text, cached: false })

  } catch (err) {
    console.error('[rrg-analysis] fetch error', err)
    return NextResponse.json({ error: '분석을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
