import Link from 'next/link'
import BilLabel from '@/components/BilLabel'
import type React from 'react'

type ExplainRow = { keyLabel: string; value: string }

export default function AIMarketBrief({
  linesKo = [],
  linesEn = [],
  environmentFit,
  explainRows,
  reportHref = '/briefing',
  style,
}: {
  linesKo?: string[]
  linesEn?: string[]
  environmentFit?: string
  explainRows: ExplainRow[]
  reportHref?: string
  style?: React.CSSProperties
}) {
  const maxLen = Math.max(linesKo.length, linesEn.length)
  const safePairs = Array.from({ length: maxLen }).map((_, i) => ({
    ko: linesKo[i] || '',
    en: linesEn[i] || '',
  }))
    .filter((row) => row.ko || row.en)
    .slice(0, 3)

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
        <BilLabel ko="AI 마켓 브리프" en="AI Market Brief" variant="label" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {safePairs.map((row, i) => (
          <div key={`brief-line-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {row.ko && (
              <div className="line-clamp-1" style={{ color: '#E2E8F0', fontSize: '0.84rem', lineHeight: 1.3 }}>
                {row.ko}
              </div>
            )}
            {row.en && (
              <div className="line-clamp-1" style={{ color: '#94A3B8', fontSize: '0.76rem', lineHeight: 1.3 }}>
                {row.en}
              </div>
            )}
          </div>
        ))}
        {safePairs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="line-clamp-1" style={{ color: '#E2E8F0', fontSize: '0.84rem' }}>
              브리핑 준비중입니다.
            </div>
            <div className="line-clamp-1" style={{ color: '#94A3B8', fontSize: '0.76rem' }}>
              Briefing not available yet.
            </div>
          </div>
        )}
      </div>
      {environmentFit && (() => {
        const fitColor =
          environmentFit === 'High' ? '#22C55E'
          : environmentFit === 'Medium' ? '#FACC15'
          : environmentFit === 'Low' ? '#F97316'
          : '#EF4444'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700 }}>환경 적합 / Environment Fit</span>
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
      })()}
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
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>근거</span>
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
