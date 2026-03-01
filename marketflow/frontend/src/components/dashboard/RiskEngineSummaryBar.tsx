import Link from 'next/link'
import BilLabel from '@/components/BilLabel'
import type { RiskToken } from '@/lib/riskPalette'

type SummaryPill = {
  label: string
  value: string
  tone?: string
}

export default function RiskEngineSummaryBar({
  pills,
  riskToken,
  href = '/risk-engine',
}: {
  pills: SummaryPill[]
  riskToken: RiskToken
  href?: string
}) {
  return (
    <section
      style={{
        background: '#070B10',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '0.7rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 26, borderRadius: 999, background: riskToken.colorVar }} />
          <div style={{ color: '#F8FAFC' }}>
            <BilLabel ko="리스크 엔진" en="Risk Engine" variant="label" />
          </div>
          <span
            style={{
              borderRadius: 999,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#F87171',
              padding: '0.2rem 0.55rem',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 700 }}>독점 지표</span>
              <span style={{ fontSize: '0.58rem', color: '#FCA5A5', fontWeight: 600 }}>Proprietary</span>
            </span>
          </span>
        </div>
        <Link
          href={href}
          style={{
            color: '#93C5FD',
            fontSize: '0.76rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>리스크 엔진</span>
            <span style={{ fontSize: '0.6rem', color: '#BFDBFE', fontWeight: 600 }}>Open</span>
          </span>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ minWidth: 0 }}>
        {pills.map((pill) => (
          <div
            key={pill.label}
            style={{
              border: `1px solid ${riskToken.borderVar}`,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              padding: '0.5rem 0.6rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ color: '#94A3B8', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em' }}>
              {pill.label}
            </div>
            <div style={{ color: pill.tone || '#F8FAFC', fontSize: '0.95rem', fontWeight: 800 }}>
              {pill.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
