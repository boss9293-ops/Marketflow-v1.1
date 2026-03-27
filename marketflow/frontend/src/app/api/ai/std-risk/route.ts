import { NextResponse } from 'next/server'
import { readCachedAiBriefing } from '@/lib/server/aiBriefingStore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const result = await readCachedAiBriefing('std_risk')
    if (!result) {
      return NextResponse.json(
        {
          error: 'std_risk latest.json not found',
          rerun_hint: 'python backend/scripts/build_ai_briefings.py',
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
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
