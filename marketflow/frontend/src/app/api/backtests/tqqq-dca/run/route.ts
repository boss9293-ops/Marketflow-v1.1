import { NextRequest, NextResponse } from 'next/server'
import { backendApiUrl } from '@/lib/backendApi'

const BACKEND_PATH = '/api/backtests/tqqq-dca/run'

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const upstream = await fetch(backendApiUrl(BACKEND_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
      cache: 'no-store',
    })

    const raw = await upstream.text()
    let payload: unknown = null

    if (raw.trim()) {
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = {
          error: `Invalid JSON from backend (${upstream.status})`,
          details: raw.slice(0, 600),
        }
      }
    } else {
      payload = {
        error: `Empty response from backend (${upstream.status})`,
      }
    }

    if (!upstream.ok && payload && typeof payload === 'object') {
      return NextResponse.json(payload, { status: upstream.status })
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `Backtest API failed (${upstream.status})`,
          details: asText(payload).slice(0, 600),
        },
        { status: upstream.status },
      )
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
