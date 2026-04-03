import { NextResponse } from 'next/server'
import { readCachedAiBriefing } from '@/lib/server/aiBriefingStore'
import { projectAiBriefingByLang } from '@/lib/aiBriefing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const langParam = new URL(request.url).searchParams.get('lang')
    const lang = langParam === 'ko' || langParam === 'en' ? langParam : null
    const result = await readCachedAiBriefing('macro')
    if (!result) {
      return NextResponse.json(
        {
          error: 'macro latest.json not found',
          rerun_hint: 'python backend/scripts/build_ai_briefings.py',
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    if (lang) {
      const projected = projectAiBriefingByLang(result.briefing, lang)
      return NextResponse.json(projected, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(result.briefing, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
        rerun_hint: 'python backend/scripts/build_ai_briefings.py',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
