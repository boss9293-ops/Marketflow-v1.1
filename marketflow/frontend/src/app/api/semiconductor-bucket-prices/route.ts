// 반도체 버킷 가격 프록시 캐시를 반환하는 API 라우트
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const CACHE_PATH = join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_bucket_prices_latest.json'
)

const PENDING_PAYLOAD = {
  generatedAt: '',
  buckets: [],
  status: 'PENDING' as const,
  note: 'Bucket price cache not generated',
}

export async function GET() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8')
    const payload = JSON.parse(raw) as object
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
        'X-Data-Source': 'cache',
      },
    })
  } catch {
    return NextResponse.json(
      { ...PENDING_PAYLOAD, generatedAt: new Date().toISOString(), _source: 'pending' },
      { status: 200, headers: { 'X-Data-Source': 'pending' } }
    )
  }
}
