import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

import { backendApiUrl } from '@/lib/backendApi'
import { AI_INFRA_BUCKETS } from '@/lib/semiconductor/aiInfraBucketMap'
import type {
  RrgDirection,
  RrgPathPayload,
  RrgPoint,
  RrgQuadrant,
  RrgSeries,
} from '@/lib/semiconductor/rrgPathData'
import { PENDING_RRG_PAYLOAD } from '@/lib/semiconductor/rrgPathData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type BenchmarkParam = 'SOXX' | 'QQQ' | 'SPY'

type CandidateDPoint = {
  date?: unknown
  rs_ratio?: unknown
  rs_momentum?: unknown
  ratio?: unknown
  momentum?: unknown
}

type CandidateDSymbol = {
  symbol?: unknown
  error?: unknown
  latest?: CandidateDPoint
  tail?: CandidateDPoint[]
  trail?: CandidateDPoint[]
}

type CandidateDResponse = {
  timestamp?: unknown
  symbols?: CandidateDSymbol[]
  sectors?: CandidateDSymbol[]
}

const CACHE_FILES: Record<BenchmarkParam, string> = {
  SOXX: join(process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_latest.json'),
  QQQ: join(process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_qqq_latest.json'),
  SPY: join(process.cwd(), '..', 'backend', 'output', 'cache', 'bottleneck_rrg_spy_latest.json'),
}

const PENDING_BOTTLENECK: RrgPathPayload = {
  ...PENDING_RRG_PAYLOAD,
  note: 'Run marketflow/scripts/build_bottleneck_rrg.py to generate AI Bottleneck RRG cache.',
}

const REMOTE_TIMEOUT_MS = 12000
const REMOTE_BATCH_SIZE = 20
const REMOTE_CONCURRENCY = 3
const REMOTE_TAIL = 12

function parseBenchmark(param: string | null): BenchmarkParam {
  if (param === 'QQQ' || param === 'SPY' || param === 'SOXX') return param
  return 'SOXX'
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function inferQuadrant(rsRatio: number, rsMomentum: number): RrgQuadrant {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'Leading'
  if (rsRatio >= 100 && rsMomentum < 100) return 'Weakening'
  if (rsRatio < 100 && rsMomentum >= 100) return 'Improving'
  return 'Lagging'
}

function inferDirection(points: RrgPoint[]): RrgDirection {
  if (points.length < 2) return 'Pending'
  const last = points.at(-1)
  const prev1 = points.at(-2)
  if (
    !last ||
    !prev1 ||
    last.rsRatio == null ||
    last.rsMomentum == null ||
    prev1.rsRatio == null ||
    prev1.rsMomentum == null
  ) {
    return 'Pending'
  }

  const prev4 = points.at(Math.max(0, points.length - 5)) ?? points[0]
  const prev12 = points.at(Math.max(0, points.length - 13)) ?? points[0]
  if (
    !prev4 ||
    !prev12 ||
    prev4.rsRatio == null ||
    prev4.rsMomentum == null ||
    prev12.rsRatio == null ||
    prev12.rsMomentum == null
  ) {
    return 'Pending'
  }

  const currentQuadrant = inferQuadrant(last.rsRatio, last.rsMomentum)
  const oldQuadrant = inferQuadrant(prev12.rsRatio, prev12.rsMomentum)
  const drs4 = last.rsRatio - prev4.rsRatio
  const dmom4 = last.rsMomentum - prev4.rsMomentum
  const dmom1 = last.rsMomentum - prev1.rsMomentum

  if (
    (oldQuadrant === 'Lagging' || oldQuadrant === 'Weakening') &&
    (currentQuadrant === 'Improving' || currentQuadrant === 'Leading')
  ) {
    return 'Recovering'
  }
  if (currentQuadrant === 'Leading' && dmom1 < -0.1) return 'Rolling Over'
  if (drs4 > 0.8 && dmom4 > 0.25 && dmom1 >= 0) return 'Accelerating'
  if (currentQuadrant === 'Leading' && Math.abs(dmom1) < 0.08) return 'Flattening'
  if (drs4 > 0 || dmom4 > 0) return 'Sustaining'
  return 'Flattening'
}

function normalizeCandidateSymbol(raw: CandidateDSymbol): { symbol: string; points: RrgPoint[] } | null {
  const symbol = toStringValue(raw.symbol)?.toUpperCase()
  if (!symbol) return null
  if (raw.error != null) return null

  const tail = Array.isArray(raw.tail) ? raw.tail : Array.isArray(raw.trail) ? raw.trail : []
  const points = tail
    .map((point, index) => {
      const rsRatio = toNumber(point.rs_ratio ?? point.ratio)
      const rsMomentum = toNumber(point.rs_momentum ?? point.momentum)
      const date = toStringValue(point.date) ?? `t${String(index + 1).padStart(3, '0')}`
      return rsRatio == null || rsMomentum == null ? null : { date, rsRatio, rsMomentum }
    })
    .filter(
      (
        point,
      ): point is {
        date: string
        rsRatio: number
        rsMomentum: number
      } => point !== null,
    )

  if (points.length === 0) {
    const latestRatio = toNumber(raw.latest?.rs_ratio ?? raw.latest?.ratio)
    const latestMomentum = toNumber(raw.latest?.rs_momentum ?? raw.latest?.momentum)
    if (latestRatio == null || latestMomentum == null) return null
    points.push({
      date: toStringValue(raw.latest?.date) ?? new Date().toISOString().slice(0, 10),
      rsRatio: latestRatio,
      rsMomentum: latestMomentum,
    })
  }

  return { symbol, points }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function aggregateBucketPoints(symbolSeries: Array<{ symbol: string; points: RrgPoint[] }>): RrgPoint[] {
  const byDate = new Map<
    string,
    { ratioSum: number; ratioCount: number; momentumSum: number; momentumCount: number }
  >()

  for (const series of symbolSeries) {
    for (const point of series.points) {
      if (point.rsRatio == null || point.rsMomentum == null) continue
      const current = byDate.get(point.date) ?? {
        ratioSum: 0,
        ratioCount: 0,
        momentumSum: 0,
        momentumCount: 0,
      }
      current.ratioSum += point.rsRatio
      current.ratioCount += 1
      current.momentumSum += point.rsMomentum
      current.momentumCount += 1
      byDate.set(point.date, current)
    }
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      if (value.ratioCount === 0 || value.momentumCount === 0) return null
      return {
        date,
        rsRatio: value.ratioSum / value.ratioCount,
        rsMomentum: value.momentumSum / value.momentumCount,
      }
    })
    .filter(
      (
        point,
      ): point is {
        date: string
        rsRatio: number
        rsMomentum: number
      } => point !== null,
    )

  return points
}

async function fetchRemoteBuckets(benchmark: BenchmarkParam): Promise<RrgPathPayload | null> {
  const uniqueSymbols = Array.from(
    new Set(AI_INFRA_BUCKETS.flatMap((bucket) => bucket.symbols.map((symbol) => symbol.toUpperCase()))),
  )
  const batches = chunk(uniqueSymbols, REMOTE_BATCH_SIZE)
  const batchResults = await mapWithConcurrency(batches, REMOTE_CONCURRENCY, async (batch) => {
    const params = new URLSearchParams({
      symbols: batch.join(','),
      benchmark,
      period: 'daily',
      tail: String(REMOTE_TAIL),
    })
    const url = backendApiUrl(`/api/rrg/candidate-d?${params.toString()}`)
    const response = await fetchWithTimeout(url, REMOTE_TIMEOUT_MS)
    if (!response || !response.ok) return null
    try {
      return (await response.json()) as CandidateDResponse
    } catch {
      return null
    }
  })

  const symbolMap = new Map<string, { symbol: string; points: RrgPoint[] }>()
  let generatedAt: string | null = null

  for (const payload of batchResults) {
    if (!payload) continue
    const timestamp = toStringValue(payload.timestamp)
    if (timestamp && (!generatedAt || timestamp > generatedAt)) generatedAt = timestamp
    const symbols = Array.isArray(payload.symbols)
      ? payload.symbols
      : Array.isArray(payload.sectors)
        ? payload.sectors
        : []
    for (const rawSymbol of symbols) {
      const normalized = normalizeCandidateSymbol(rawSymbol)
      if (!normalized) continue
      symbolMap.set(normalized.symbol, normalized)
    }
  }

  const series: RrgSeries[] = AI_INFRA_BUCKETS.map((bucket) => {
    const present = bucket.symbols
      .map((symbol) => symbolMap.get(symbol.toUpperCase()))
      .filter((entry): entry is { symbol: string; points: RrgPoint[] } => entry != null)
    const points = aggregateBucketPoints(present)
    if (points.length === 0) {
      return {
        id: bucket.bucket_id,
        label: bucket.display_name,
        benchmark,
        source: 'PENDING',
        quadrant: 'Pending',
        direction: 'Pending',
        points: [],
        note: `No live symbol data (${present.length}/${bucket.symbols.length})`,
      }
    }

    const last = points.at(-1)!
    const quadrant = inferQuadrant(last.rsRatio ?? 100, last.rsMomentum ?? 100)
    return {
      id: bucket.bucket_id,
      label: bucket.display_name,
      benchmark,
      source: 'PROXY',
      quadrant,
      direction: inferDirection(points),
      points,
      note: `${present.length}/${bucket.symbols.length} symbols`,
    }
  })

  const hasBucketPath = series.some((entry) => entry.source !== 'PENDING' && entry.points.length > 0)
  if (!hasBucketPath) return null

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    benchmark,
    lookback: '8W',
    series,
    dataStatus: {
      hasBenchmarkPath: true,
      hasBucketPath,
      pendingReason: hasBucketPath ? null : 'Remote candidate-d returned no live bucket points',
    },
    note: 'Remote fallback: candidate-d symbol paths were aggregated into AI infra buckets.',
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const benchmark = parseBenchmark(searchParams.get('benchmark'))
  const cachePath = CACHE_FILES[benchmark]

  try {
    const raw = await readFile(cachePath, 'utf-8')
    const payload = JSON.parse(raw) as RrgPathPayload
    return NextResponse.json(
      { ...payload, selected_benchmark: benchmark },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
          'X-Data-Source': 'cache',
        },
      },
    )
  } catch {
    // Cache is not available in serverless runtime. Continue to backend fallback.
  }

  try {
    const remotePayload = await fetchRemoteBuckets(benchmark)
    if (remotePayload) {
      return NextResponse.json(
        { ...remotePayload, selected_benchmark: benchmark },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
            'X-Data-Source': 'proxy',
          },
        },
      )
    }
  } catch {
    // Continue to pending payload.
  }

  return NextResponse.json(
    {
      ...PENDING_BOTTLENECK,
      generatedAt: new Date().toISOString(),
      selected_benchmark: benchmark,
      _source: 'pending',
    },
    { status: 200, headers: { 'X-Data-Source': 'pending' } },
  )
}
