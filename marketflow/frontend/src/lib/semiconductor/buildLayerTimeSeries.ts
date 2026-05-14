// AI Compute / Legacy Layer 90일 누적수익률 시계열 빌더 — 카드 3 메인 차트용
import path from 'path'
import fs from 'fs'

// AI Compute Layer: AI 수요 직접 수혜 (GPU + HBM)
const AI_COMPUTE_BUCKETS = ['aiCompute', 'memoryHbm'] as const

// Legacy Layer: 전통 반도체 공급망 (Foundry + Equipment)
const LEGACY_BUCKETS = ['foundryPackaging', 'equipment'] as const

const BUCKET_PRICES_PATH = path.join(
  process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_bucket_prices_latest.json'
)

export interface LayerTimeSeriesPoint {
  date: string
  ai_compute: number  // AI Layer 누적수익률 (%)
  legacy: number      // Legacy Layer 누적수익률 (%)
  spread: number      // AI - Legacy (pp)
}

export interface LayerTimeSeries {
  series: LayerTimeSeriesPoint[]
  base_date: string
  current: {
    ai_compute: number
    legacy: number
    spread: number
  }
  ai_buckets: string[]
  legacy_buckets: string[]
}

type BucketSeries = { date: string; value: number }[]
type BucketPayload = { id: string; series: BucketSeries }

function sliceLast(series: BucketSeries, days: number): BucketSeries {
  return series.slice(-days)
}

function computeLayerReturn(
  bucketMap: Map<string, BucketSeries>,
  bucketIds: readonly string[],
  dates: string[]
): number[] {
  const validBuckets = bucketIds
    .map(id => bucketMap.get(id))
    .filter((s): s is BucketSeries => !!s && s.length > 0)

  if (validBuckets.length === 0) return dates.map(() => 0)

  return dates.map((date, i) => {
    const returns = validBuckets.map(series => {
      const baseVal = series[0].value
      const pt = series[i]
      if (!pt || baseVal === 0) return 0
      return ((pt.value / baseVal) - 1) * 100
    })
    return Math.round((returns.reduce((a, b) => a + b, 0) / returns.length) * 100) / 100
  })
}

export function buildLayerTimeSeries(days = 90): LayerTimeSeries | null {
  try {
    if (!fs.existsSync(BUCKET_PRICES_PATH)) return null
    const raw = JSON.parse(fs.readFileSync(BUCKET_PRICES_PATH, 'utf-8')) as {
      buckets: BucketPayload[]
    }

    const bucketMap = new Map<string, BucketSeries>()
    for (const b of raw.buckets) {
      if (b.series && b.series.length > 0) {
        bucketMap.set(b.id, sliceLast(b.series, days))
      }
    }

    // 공통 날짜 추출 (모든 버킷에 있는 날짜)
    const allBuckets = [...AI_COMPUTE_BUCKETS, ...LEGACY_BUCKETS]
    const dateSets = allBuckets
      .map(id => bucketMap.get(id))
      .filter((s): s is BucketSeries => !!s)
      .map(s => new Set(s.map(p => p.date)))

    if (dateSets.length === 0) return null

    const commonDates = [...dateSets[0]].filter(d => dateSets.every(ds => ds.has(d))).sort()

    if (commonDates.length < 5) return null

    // 날짜 기준으로 각 버킷 재정렬
    for (const id of allBuckets) {
      const s = bucketMap.get(id)
      if (s) {
        const filtered = s.filter(p => commonDates.includes(p.date))
        bucketMap.set(id, filtered)
      }
    }

    const aiReturns = computeLayerReturn(bucketMap, AI_COMPUTE_BUCKETS, commonDates)
    const legacyReturns = computeLayerReturn(bucketMap, LEGACY_BUCKETS, commonDates)

    const series: LayerTimeSeriesPoint[] = commonDates.map((date, i) => ({
      date,
      ai_compute: aiReturns[i],
      legacy: legacyReturns[i],
      spread: Math.round((aiReturns[i] - legacyReturns[i]) * 100) / 100,
    }))

    const last = series[series.length - 1]

    return {
      series,
      base_date: commonDates[0],
      current: {
        ai_compute: last.ai_compute,
        legacy: last.legacy,
        spread: last.spread,
      },
      ai_buckets: [...AI_COMPUTE_BUCKETS],
      legacy_buckets: [...LEGACY_BUCKETS],
    }
  } catch {
    return null
  }
}
