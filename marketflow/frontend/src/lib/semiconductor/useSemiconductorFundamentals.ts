'use client'
// 반도체 펀더멘털 API를 클라이언트에서 fetching하는 훅 — 실패 시 fallback 제공

import { useState, useEffect } from 'react'
import type { SemiconductorFundamentalsPayload } from './fundamentalDataContract'
import { normalizeFundamentalsPayload } from './normalizeFundamentals'

export interface FundamentalsState {
  data: SemiconductorFundamentalsPayload | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  source: 'cache' | 'fixture' | null
}

const FALLBACK_STATE: FundamentalsState = {
  data: normalizeFundamentalsPayload(null),
  loading: false,
  error: null,
  lastUpdated: null,
  source: null,
}

export function useSemiconductorFundamentals(): FundamentalsState {
  const [state, setState] = useState<FundamentalsState>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
    source: null,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/semiconductor-fundamentals')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((raw: Record<string, unknown>) => {
        if (cancelled) return
        const data = normalizeFundamentalsPayload(raw)
        setState({
          data,
          loading: false,
          error: null,
          lastUpdated: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
          source: (raw._source as 'cache' | 'fixture') ?? null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ ...FALLBACK_STATE, error: err instanceof Error ? err.message : String(err) })
      })

    return () => { cancelled = true }
  }, [])

  return state
}
