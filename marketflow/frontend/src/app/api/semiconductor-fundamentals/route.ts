// 반도체 L1/L2 펀더멘털 데이터를 캐시 또는 픽스처에서 반환하는 API 라우트

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { normalizeFundamentalsPayload } from '@/lib/semiconductor/normalizeFundamentals'

const CACHE_PATH = join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_fundamentals_latest.json')
const FIXTURE_PATH = join(process.cwd(), 'src', 'lib', 'semiconductor', 'fixtures', 'semiconductorFundamentals.sample.json')

async function loadJson(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function GET() {
  const cached  = await loadJson(CACHE_PATH)
  const fixture = await loadJson(FIXTURE_PATH)

  const raw = cached ?? fixture

  if (!raw) {
    return NextResponse.json(
      { error: 'No fundamental data available', generatedAt: new Date().toISOString() },
      { status: 503 }
    )
  }

  const payload = normalizeFundamentalsPayload(raw)
  const isFixture = !cached

  return NextResponse.json(
    { ...payload, _source: isFixture ? 'fixture' : 'cache' },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Data-Source': isFixture ? 'fixture' : 'cache',
      },
    }
  )
}
