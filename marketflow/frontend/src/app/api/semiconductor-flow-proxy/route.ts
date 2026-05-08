// 반도체 버킷 거래량 프록시 캐시를 반환하는 API 라우트
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SemiconductorFlowProxyPayload } from '@/lib/semiconductor/flowProxy'
import { PENDING_FLOW_PROXY } from '@/lib/semiconductor/flowProxy'

const CACHE_PATH = join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_flow_proxy_latest.json'
)

export async function GET() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8')
    const payload = JSON.parse(raw) as SemiconductorFlowProxyPayload
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
        'X-Data-Source': 'cache',
      },
    })
  } catch {
    return NextResponse.json(
      { ...PENDING_FLOW_PROXY, generatedAt: new Date().toISOString() },
      { status: 200, headers: { 'X-Data-Source': 'pending' } }
    )
  }
}
