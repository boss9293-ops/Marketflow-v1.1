'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  normalizeAiBriefing,
  selectBriefingParagraphs,
  selectBriefingSummary,
  selectBriefingWarnings,
  type AiBriefing,
} from '@/lib/aiBriefing'
import { pickLang, useContentLang, useLangMode } from '@/lib/useLangMode'
import type { UiLang } from '@/lib/uiLang'
import { UI_TEXT } from '@/lib/uiText'

type GeminiBriefingPanelProps = {
  asofDay?: string | null
  outputLang?: UiLang
}

const CACHE_KEY_PREFIX = 'ai-brief:integrated:'
const API_PATH = '/api/ai/integrated'
const SUMMARY_TITLE = { ko: '오늘 요약', en: 'Session Summary' }
const SECTION_TITLES = new Set([
  '주요 지수 실적',
  '섹터별 수익률',
  '원자재 및 채권 시장',
  '주요 종목 및 이슈',
  '경제지표 및 연준',
  '시장 포지셔닝',
  'Major Index Performance',
  'Sector Returns',
  'Commodities and Bonds',
  'Key Stocks and Issues',
  'Macro Data and Fed',
  'Market Positioning',
])

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const stripLeadingMarker = (line: string) => line.replace(/^\s*[xX×]\s+/, '').trim()
const stripBulletMarker = (line: string) => line.replace(/^\s*[•\-]\s*/, '').trim()

export default function GeminiBriefingPanel({ asofDay, outputLang }: GeminiBriefingPanelProps) {
  const uiLang = useLangMode()
  const contentLang = useContentLang()
  const resolvedOutputLang = outputLang ?? contentLang
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

    const fetchPath = `${API_PATH}?lang=${resolvedOutputLang}`
    fetch(fetchPath, {
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
  const isSectionTitle = (line: string) => SECTION_TITLES.has(line.trim())
  const isBulletLine = (line: string) => /^\s*[•\-]\s+/.test(line)
  const normalizedParagraphs = paragraphs.map(stripLeadingMarker).filter(Boolean)
  const rawSummaryLine = briefing ? selectBriefingSummary(briefing, resolvedOutputLang) : ''
  const summaryLine = stripLeadingMarker(rawSummaryLine || normalizedParagraphs[0] || '')
  const bodyLines =
    normalizedParagraphs.length > 0 && summaryLine && normalizedParagraphs[0] === summaryLine
      ? normalizedParagraphs.slice(1)
      : normalizedParagraphs
  const sectionBlocks = useMemo(() => {
    const blocks: Array<{ title: string; lines: string[] }> = []
    let current: { title: string; lines: string[] } | null = null
    for (const line of bodyLines) {
      if (isSectionTitle(line)) {
        current = { title: line.trim(), lines: [] }
        blocks.push(current)
        continue
      }
      if (!current) {
        current = { title: '', lines: [] }
        blocks.push(current)
      }
      current.lines.push(line)
    }
    return blocks.filter((block) => block.title || block.lines.length > 0)
  }, [bodyLines])

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
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
      <div
        style={{
          marginTop: 6,
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
        {!loading && !error && summaryLine && (
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ color: '#334155', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', minWidth: 18 }}>
                01
              </span>
              <div style={{ width: 20, height: 1, background: 'rgba(34,211,238,0.45)', flexShrink: 0 }} />
              <span
                style={{
                  color: '#e6efff',
                  fontSize: '1.44rem',
                  lineHeight: 1.25,
                  fontWeight: 900,
                  letterSpacing: '-0.015em',
                }}
              >
                {resolvedOutputLang === 'ko' ? SUMMARY_TITLE.ko : SUMMARY_TITLE.en}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.12)' }} />
            </div>
            <div
              style={{
                marginLeft: 30,
                padding: '0.1rem 0 0.55rem 0.2rem',
                color: '#f1f5f9',
                fontSize: '1.04rem',
                lineHeight: 1.62,
                fontWeight: 700,
                borderLeft: '1px solid rgba(148,163,184,0.16)',
              }}
            >
              {summaryLine}
            </div>
            <div style={{ height: 1, background: 'rgba(148,163,184,0.10)', margin: '2px 0 14px' }} />
          </div>
        )}

        {!loading &&
          !error &&
          sectionBlocks.map((block, idx) => {
            const sectionNo = String(idx + 2).padStart(2, '0')
            const lines = block.lines.filter(Boolean)
            const hasTitle = !!block.title
            return (
              <div key={`gemini-sec-${idx}`}>
                {hasTitle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <span style={{ color: '#334155', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', minWidth: 18 }}>
                      {sectionNo}
                    </span>
                    <div style={{ width: 20, height: 1, background: 'rgba(125,211,252,0.45)', flexShrink: 0 }} />
                    <span
                      style={{
                        color: '#e2e8f0',
                        fontSize: '1.42rem',
                        lineHeight: 1.26,
                        fontWeight: 900,
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {block.title}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.12)' }} />
                  </div>
                )}

                <div style={{ marginLeft: 30, marginBottom: 12, borderLeft: '1px solid rgba(148,163,184,0.16)', paddingLeft: 10 }}>
                  {lines.map((line, lineIdx) => {
                    if (isBulletLine(line)) {
                      return (
                        <div
                          key={`gemini-line-${idx}-${lineIdx}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '10px minmax(0,1fr)',
                            gap: 8,
                            alignItems: 'start',
                            color: '#dbe7f8',
                            fontSize: '0.97rem',
                            lineHeight: 1.62,
                            marginBottom: 2,
                          }}
                        >
                          <span style={{ color: '#8ddcff', fontWeight: 900 }}>•</span>
                          <span>{stripBulletMarker(line)}</span>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={`gemini-line-${idx}-${lineIdx}`}
                        style={{
                          color: '#cbd5e1',
                          fontSize: '0.97rem',
                          lineHeight: 1.68,
                          marginTop: lineIdx === 0 ? 0 : 6,
                        }}
                      >
                        {line}
                      </div>
                    )
                  })}
                </div>

                {idx < sectionBlocks.length - 1 && (
                  <div style={{ height: 1, background: 'rgba(148,163,184,0.10)', margin: '2px 0 14px' }} />
                )}
              </div>
            )
          })}
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
