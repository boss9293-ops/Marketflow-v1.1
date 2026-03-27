'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  normalizeAiBriefing,
  selectBriefingParagraphs,
  selectBriefingWarnings,
  type AiBriefing,
} from '@/lib/aiBriefing'
import { pickLang, useLangMode } from '@/lib/useLangMode'
import type { UiLang } from '@/lib/uiLang'
import { UI_TEXT } from '@/lib/uiText'

type GeminiBriefingPanelProps = {
  asofDay?: string | null
  outputLang?: UiLang
}

const CACHE_KEY_PREFIX = 'ai-brief:integrated:'
const API_PATH = '/api/ai/integrated'

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function GeminiBriefingPanel({ asofDay, outputLang }: GeminiBriefingPanelProps) {
  const uiLang = useLangMode()
  const resolvedOutputLang = outputLang ?? uiLang
  const [briefing, setBriefing] = useState<AiBriefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const effectiveAsof = useMemo(() => asofDay || formatLocalDate(new Date()), [asofDay])
  const cacheKey = useMemo(
    () => `${CACHE_KEY_PREFIX}${effectiveAsof}:${resolvedOutputLang}`,
    [effectiveAsof, resolvedOutputLang]
  )

  useEffect(() => {
    if (!effectiveAsof) return

    let active = true
    let cacheHit = false

    try {
      const cachedRaw = localStorage.getItem(cacheKey)
      if (cachedRaw) {
        setBriefing(normalizeAiBriefing(JSON.parse(cachedRaw)))
        cacheHit = true
      }
    } catch {
      // ignore cache errors
    }

    setLoading(!cacheHit)
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    fetch(API_PATH, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let rerunHint = ''
          try {
            const payload = await res.json()
            if (payload && typeof payload === 'object' && typeof payload.rerun_hint === 'string') {
              rerunHint = ` ${payload.rerun_hint}`
            }
          } catch {
            // ignore error body parsing
          }
          throw new Error(`Cached integrated brief unavailable (${res.status}).${rerunHint}`)
        }
        return normalizeAiBriefing(await res.json())
      })
      .then((data) => {
        if (!active) return
        setBriefing(data)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {
          // ignore cache write errors
        }
      })
      .catch((err: Error) => {
        if (!active || cacheHit) return
        setError(err.name === 'AbortError' ? 'Timeout' : err.message)
        setBriefing(null)
      })
      .finally(() => {
        if (!active) return
        clearTimeout(timeout)
        setLoading(false)
      })

    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [cacheKey, effectiveAsof, refreshToken])

  const paragraphs = briefing ? selectBriefingParagraphs(briefing, resolvedOutputLang) : []
  const warnings = briefing ? selectBriefingWarnings(briefing, resolvedOutputLang) : []
  const provider = briefing?.provider || 'cache'
  const model = briefing?.model || ''

  const handleRefresh = () => {
    if (!cacheKey) return
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      // ignore storage errors
    }
    setBriefing(null)
    setError(null)
    setLoading(true)
    setRefreshToken((v) => v + 1)
  }

  if (!effectiveAsof) {
    return (
      <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
        {pickLang(uiLang, '일간 브리핑을 표시할 날짜가 없습니다.', 'Daily briefing unavailable (missing date).')}
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: '0.75rem 0.9rem',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: '#60a5fa', fontWeight: 700 }}>
          {pickLang(uiLang, 'AI 통합 브리핑', 'AI Integrated Brief')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            {provider.toUpperCase()}{model ? ` · ${model}` : ''}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: '#e5e7eb',
              borderRadius: 999,
              fontSize: '0.65rem',
              padding: '0.15rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            {UI_TEXT.common.refresh[uiLang]}
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          color: '#e5e7eb',
          fontSize: '0.78rem',
          lineHeight: 1.6,
        }}
      >
        {loading && <div style={{ color: '#9ca3af' }}>{UI_TEXT.common.loading[uiLang]}</div>}
        {!loading && error && (
          <div style={{ color: '#f87171' }}>
            {pickLang(uiLang, '캐시된 통합 브리핑을 불러오지 못했습니다.', 'Failed to load cached integrated brief.')}: {error}
          </div>
        )}
        {!loading && !error && paragraphs.length === 0 && (
          <div style={{ color: '#9ca3af' }}>
            {pickLang(uiLang, '통합 브리핑이 아직 준비되지 않았습니다.', 'Integrated briefing is not ready yet.')}
          </div>
        )}
        {!loading && !error && paragraphs.map((p, idx) => (
          <div key={`gemini-${idx}`}>{p}</div>
        ))}
        {!loading && !error && warnings.length > 0 && (
          <div style={{ marginTop: 6, color: '#cbd5f5', fontSize: '0.72rem' }}>
            {warnings.map((w, idx) => (
              <div key={`warn-${idx}`}>{w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
