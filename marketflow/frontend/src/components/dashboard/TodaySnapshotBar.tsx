import Link from 'next/link'
import type { RiskToken } from '@/lib/riskPalette'

type ExplainRow = { keyLabel: string; value: string }

export default function TodaySnapshotBar({
  summaryKo,
  summaryEn,
  riskToken,
  explainRows,
  macroHref = '/macro',
}: {
  summaryKo: string
  summaryEn: string
  riskToken: RiskToken
  explainRows: ExplainRow[]
  macroHref?: string
}) {
  return (
    <section
      style={{
        background: '#0B0F14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '0.65rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 320px' }}>
        <div className="line-clamp-1" style={{ color: '#E2E8F0', fontSize: '0.88rem', fontWeight: 700 }}>
          {summaryKo}
        </div>
        <div className="line-clamp-1" style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
          {summaryEn}
        </div>
      </div>
      <span
        style={{
          borderRadius: 999,
          border: `1px solid ${riskToken.borderVar}`,
          background: riskToken.bgVar,
          color: riskToken.colorVar,
          padding: '2px 10px',
          fontSize: '0.72rem',
          fontWeight: 800,
        }}
      >
        {riskToken.key}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link
          href={macroHref}
          style={{
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#E2E8F0',
            borderRadius: 8,
            padding: '0.35rem 0.6rem',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}
        >
          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>매크로</span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: 600 }}>Open Macro</span>
          </span>
        </Link>
        <details style={{ position: 'relative' }}>
          <summary
            style={{
              listStyle: 'none',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.04)',
              color: '#D8E6F5',
              borderRadius: 8,
              padding: '0.35rem 0.6rem',
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
