// SOXL 변동성 감쇠 캐시를 반환하는 API 라우트
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SoxlDecayPayload } from '@/lib/semiconductor/soxlDecay'
import { PENDING_SOXL_DECAY } from '@/lib/semiconductor/soxlDecay'

const CACHE_PATH = join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'soxl_decay_latest.json'
)

export async function GET() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8')
    const payload = JSON.parse(raw) as SoxlDecayPayload
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
        'X-Data-Source': 'cache',
      },
    })
  } catch {
    return NextResponse.json(
      { ...PENDING_SOXL_DECAY, generatedAt: new Date().toISOString() },
      { status: 200, headers: { 'X-Data-Source': 'pending' } }
    )
  }
}
