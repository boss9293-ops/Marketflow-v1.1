import { NextResponse } from 'next/server'
import { backendApiUrl } from '@/lib/backendApi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const res = await fetch(backendApiUrl('/api/current-90d'), { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `Railway ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
