import Link from 'next/link'
import BilLabel from '@/components/BilLabel'
import type { RiskToken } from '@/lib/riskPalette'
import { UI_TEXT } from '@/lib/uiText'

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
        background: '#091018',
        border: '1px solid rgba(148,163,184,0.14)',
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
            <BilLabel ko={UI_TEXT.dashboard.riskEngine.ko} en={UI_TEXT.dashboard.riskEngine.en} variant="label" />
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
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#F8FAFC' }}>{UI_TEXT.dashboard.proprietary.ko}</span>
              <span style={{ fontSize: '0.58rem', color: '#D1D5DB', fontWeight: 600 }}>{UI_TEXT.dashboard.proprietary.en}</span>
            </span>
          </span>
        </div>
        <Link
          href={href}
          style={{
            color: '#C7DBFF',
            fontSize: '0.76rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <BilLabel ko={UI_TEXT.dashboard.riskEngine.ko} en={UI_TEXT.common.open.en} variant="micro" />
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
            <div style={{ color: '#C7D2E1', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em' }}>
              {pill.label}
            </div>
            <div style={{ color: pill.tone || '#F8FAFC', fontSize: '0.98rem', fontWeight: 800, lineHeight: 1.08 }}>
              {pill.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
