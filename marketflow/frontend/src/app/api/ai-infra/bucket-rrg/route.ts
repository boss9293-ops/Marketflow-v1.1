// AI 인프라 병목 버킷 RRG 경로 캐시를 반환하는 API 라우트 — Phase D-3
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { RrgPathPayload } from '@/lib/semiconductor/rrgPathData'
import { PENDING_RRG_PAYLOAD } from '@/lib/semiconductor/rrgPathData'

const CACHE_PATH = join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'
)

const PENDING_BOTTLENECK: RrgPathPayload = {
  ...PENDING_RRG_PAYLOAD,
  note: 'Run marketflow/scripts/build_bottleneck_rrg.py to generate AI Bottleneck RRG cache.',
}

export async function GET() {
  try {
    const raw     = await readFile(CACHE_PATH, 'utf-8')
    const payload = JSON.parse(raw) as RrgPathPayload
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
        'X-Data-Source': 'cache',
      },
    })
  } catch {
    return NextResponse.json(
      { ...PENDING_BOTTLENECK, generatedAt: new Date().toISOString(), _source: 'pending' },
      { status: 200, headers: { 'X-Data-Source': 'pending' } },
    )
  }
}
