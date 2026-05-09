import { NextRequest, NextResponse } from 'next/server'
import { readCacheJsonOrNull } from '@/lib/readCacheJson'
import { backendApiUrl } from '@/lib/backendApi'

export const dynamic = 'force-dynamic'

async function parseUpstreamJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : { value: parsed }
  } catch {
    return {
      ok: false,
      error: `Upstream returned non-JSON (status ${res.status}).`,
      raw: raw.slice(0, 500),
    }
  }
}

export async function GET() {
  const data = await readCacheJsonOrNull<Record<string, unknown>>('daily_briefing_v5.json')
  if (!data) {
    return NextResponse.json(
      {
        error: 'daily_briefing_v5.json not found',
        rerun_hint: 'python backend/scripts/build_daily_briefing_v5.py',
        fallback_hint: 'python backend/scripts/build_daily_briefing_v4.py',
      },
      { status: 404 },
    )
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { force = false, slot } = body as { force?: boolean; slot?: string }

  try {
    const res = await fetch(backendApiUrl('/api/briefing/v5/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force, slot }),
      signal: AbortSignal.timeout(380_000),
      cache: 'no-store',
    })
    const data = await parseUpstreamJson(res)
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 })
  }
}
