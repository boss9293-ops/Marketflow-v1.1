// 벤치마크 상대강도(SOXX/QQQ/SPY) 캐시를 반환하는 API 라우트
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkRSPayload } from '@/lib/semiconductor/benchmarkRelativeStrength'
import { PENDING_RS_PAYLOAD } from '@/lib/semiconductor/benchmarkRelativeStrength'

const CACHE_PATH = join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'benchmark_rs_latest.json'
)

export async function GET() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8')
    const payload = JSON.parse(raw) as BenchmarkRSPayload
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200',
        'X-Data-Source': 'cache',
      },
    })
  } catch {
    return NextResponse.json(
      { ...PENDING_RS_PAYLOAD, generatedAt: new Date().toISOString(), _source: 'pending' },
      {
        status: 200,
        headers: { 'X-Data-Source': 'pending' },
      }
    )
  }
}
