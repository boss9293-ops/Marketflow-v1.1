'use client'
// AI 인프라 V2 — URL ↔ 모달 상태 양방향 동기화 훅 (Next.js App Router, SSR 안전)

import { useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { parseFlowMapUrlParams } from './parseFlowMapUrlParams'

export interface FlowMapUrlState {
  selectedBucket:    string | null
  selectedSymbol:    string | null
  openBucket:        (bucketId: string) => void
  openSymbol:        (symbolTicker: string) => void
  openBucketSymbol:  (bucketId: string, symbolTicker: string) => void
  closeSymbol:       () => void
  closeBucket:       () => void
}

export function useFlowMapUrlSync(
  validBuckets:         string[],
  validSymbolsByBucket: Record<string, string[]>,
): FlowMapUrlState {
  const router       = useRouter()
  const pathname     = usePathname() ?? '/'
  const searchParams = useSearchParams()

  const rawBucket = searchParams?.get('bucket') ?? null
  const rawSymbol = searchParams?.get('symbol') ?? null

  // Derive bucket/symbol directly from URL (no separate useState)
  const bucket = rawBucket && validBuckets.length > 0 && validBuckets.includes(rawBucket)
    ? rawBucket
    : null

  const symbol = bucket && rawSymbol &&
    (validSymbolsByBucket[bucket] ?? []).includes(rawSymbol)
    ? rawSymbol
    : null

  const needsSanitize = validBuckets.length > 0 && (
    (rawBucket !== null && bucket === null) ||
    (!rawBucket && rawSymbol !== null) ||
    (rawSymbol !== null && symbol === null)
  )

  // Sanitize invalid params — router.replace (no history entry)
  useEffect(() => {
    if (!needsSanitize) return
    const clean = new URLSearchParams()
    if (bucket) clean.set('bucket', bucket)
    const cleanStr = clean.toString()
    router.replace(cleanStr ? `${pathname}?${cleanStr}` : pathname, { scroll: false })
  }, [needsSanitize, bucket, pathname, router])

  const openBucket = useCallback((bucketId: string) => {
    if (bucketId === bucket) return
    router.push(`${pathname}?bucket=${encodeURIComponent(bucketId)}`, { scroll: false })
  }, [router, pathname, bucket])

  const openSymbol = useCallback((symbolTicker: string) => {
    if (!bucket) return
    const p = new URLSearchParams()
    p.set('bucket', bucket)
    p.set('symbol', symbolTicker)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }, [router, pathname, bucket])

  const openBucketSymbol = useCallback((bucketId: string, symbolTicker: string) => {
    const p = new URLSearchParams()
    p.set('bucket', bucketId)
    p.set('symbol', symbolTicker)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }, [router, pathname])

  const closeSymbol = useCallback(() => {
    if (!bucket) return
    router.push(`${pathname}?bucket=${encodeURIComponent(bucket)}`, { scroll: false })
  }, [router, pathname, bucket])

  const closeBucket = useCallback(() => {
    router.push(pathname, { scroll: false })
  }, [router, pathname])

  return {
    selectedBucket: bucket,
    selectedSymbol: symbol,
    openBucket,
    openSymbol,
    openBucketSymbol,
    closeSymbol,
    closeBucket,
  }
}

// Re-export parser for consumers that need direct access
export { parseFlowMapUrlParams }
