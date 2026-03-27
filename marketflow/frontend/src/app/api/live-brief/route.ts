import { NextResponse } from 'next/server'
import { readCachedAiBriefing } from '@/lib/server/aiBriefingStore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function respond() {
  const result = await readCachedAiBriefing('integrated')
  if (!result) {
    return NextResponse.json(
      {
        error: 'integrated latest.json not found',
        rerun_hint: 'python backend/scripts/build_ai_briefings.py',
      },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(result.briefing, { headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  try {
    return await respond()
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

export async function POST() {
  return GET()
}
