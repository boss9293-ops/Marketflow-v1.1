import { NextResponse } from 'next/server'
import { backendApiUrl } from '@/lib/backendApi'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(backendApiUrl('/api/sector-rotation'), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `Backend returned ${res.status}` }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
