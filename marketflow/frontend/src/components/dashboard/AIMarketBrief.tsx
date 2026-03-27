'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BilLabel from '@/components/BilLabel'
import { normalizeAiBriefing, selectBriefingParagraphs, type AiBriefing } from '@/lib/aiBriefing'

type ExplainRow = { keyLabel: string; value: string }

type Props = {
  linesKo?: string[]
  linesEn?: string[]
  environmentFit?: string
  explainRows: ExplainRow[]
  reportHref?: string
  style?: React.CSSProperties
}

export default function AIMarketBrief({
  linesKo = [],
  linesEn = [],
  environmentFit,
  explainRows,
  reportHref = '/briefing',
  style,
}: Props) {
  const [briefing, setBriefing] = useState<AiBriefing | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/ai/std-risk', { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`std-risk cache ${res.status}`)
        return normalizeAiBriefing(await res.json())
      })
      .then((data) => {
        if (active) setBriefing(data)
      })
      .catch(() => {
        // Keep the static fallback text already rendered by the server.
      })
    return () => {
      active = false
    }
  }, [])

  const displayKo = useMemo(
    () => (briefing ? selectBriefingParagraphs(briefing, 'ko') : linesKo).slice(0, 3),
    [briefing, linesKo]
  )
  const displayEn = useMemo(
    () => (briefing ? selectBriefingParagraphs(briefing, 'en') : linesEn).slice(0, 3),
    [briefing, linesEn]
  )

  const maxLen = Math.max(displayKo.length, displayEn.length)
  const safePairs = Array.from({ length: maxLen })
    .map((_, index) => ({
      ko: displayKo[index] || '',
      en: displayEn[index] || '',
    }))
    .filter((row) => row.ko || row.en)

  return (
    <section
      style={{
        background: '#0B0F14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '0.75rem',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
        ...style,
      }}
    >
      <div style={{ color: '#F8FAFC' }}>
        <BilLabel ko="AI 시장 브리프" en="AI Market Brief" variant="label" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {safePairs.map((row, index) => (
          <div key={`brief-line-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {row.ko ? (
              <div className="line-clamp-1" style={{ color: '#E2E8F0', fontSize: '0.84rem', lineHeight: 1.3 }}>
                {row.ko}
              </div>
            ) : null}
            {row.en ? (
              <div className="line-clamp-1" style={{ color: '#94A3B8', fontSize: '0.76rem', lineHeight: 1.3 }}>
                {row.en}
              </div>
            ) : null}
          </div>
        ))}
        {safePairs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="line-clamp-1" style={{ color: '#E2E8F0', fontSize: '0.84rem' }}>
              브리프를 준비 중입니다.
            </div>
            <div className="line-clamp-1" style={{ color: '#94A3B8', fontSize: '0.76rem' }}>
              Briefing is not ready yet.
            </div>
          </div>
        ) : null}
      </div>

      {environmentFit ? (
        (() => {
          const fitColor =
            environmentFit === 'High' ? '#22C55E'
            : environmentFit === 'Medium' ? '#FACC15'
            : environmentFit === 'Low' ? '#F97316'
            : '#EF4444'
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700 }}>환경 적합도 / Environment Fit</span>
              <span
                style={{
                  borderRadius: 999,
                  border: `1px solid ${fitColor}55`,
                  background: `${fitColor}18`,
                  color: fitColor,
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                {environmentFit}
              </span>
            </div>
          )
        })()
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <Link
          href={reportHref}
          style={{
            border: '1px solid rgba(255,255,255,0.18)',
            background: '#F8FAFC',
            color: '#020617',
            borderRadius: 8,
            padding: '0.4rem 0.62rem',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 800,
          }}
        >
          <BilLabel ko="전체 리포트" en="Full Report" variant="micro" />
        </Link>
        <details style={{ position: 'relative' }}>
          <summary
            style={{
              listStyle: 'none',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.03)',
              color: '#D8E6F5',
              borderRadius: 8,
              padding: '0.36rem 0.58rem',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>설명</span>
              <span style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: 600 }}>Explain</span>
            </span>
          </summary>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 'min(92vw, 340px)',
              zIndex: 20,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.10)',
              background: '#0B0F14',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              padding: '0.7rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 8px' }}>
              {explainRows.map((row) => (
                <div key={row.keyLabel} style={{ display: 'contents' }}>
                  <div style={{ color: '#D8E6F5', fontSize: '0.72rem' }}>{row.keyLabel}</div>
                  <div style={{ color: '#F8FAFC', fontSize: '0.74rem', fontWeight: 700, textAlign: 'right' }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
