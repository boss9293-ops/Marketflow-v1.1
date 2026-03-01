'use client'

import { useMemo, useState } from 'react'
import BilLabel from '@/components/BilLabel'
import AlertDetailDrawer, {
  type AlertEvidenceContext,
  type AlertItemDetail,
} from '@/components/AlertDetailDrawer'

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  neutral: '#5E6A75',
} as const

function severityStyle(s?: string) {
  if (s === 'HIGH') return { color: '#fecaca', bg: `${C.defensive}28`, border: `${C.defensive}50` }
  if (s === 'MED') return { color: '#fde68a', bg: `${C.transition}22`, border: `${C.transition}45` }
  return { color: '#bbf7d0', bg: `${C.bull}22`, border: `${C.bull}45` }
}

function regimeStyle(r?: string) {
  if (r === 'STRUCTURAL') return { color: '#ddd6fe', bg: 'rgba(139,92,246,0.16)', border: 'rgba(139,92,246,0.32)' }
  if (r === 'EVENT') return { color: '#fed7aa', bg: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.32)' }
  return { color: '#d1d5db', bg: 'rgba(107,114,128,0.16)', border: 'rgba(107,114,128,0.32)' }
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function sevKo(sev: string) {
  if (sev === 'HIGH') return '높음'
  if (sev === 'MED') return '중간'
  return '낮음'
}

function regimeKo(rg: string) {
  if (rg === 'EVENT') return '이벤트'
  if (rg === 'STRUCTURAL') return '구조'
  return '노이즈'
}

export default function RecentAlertsCard({
  alerts,
  severityCount,
  maxStreak,
  evidence,
}: {
  alerts: AlertItemDetail[]
  severityCount: { HIGH: number; MED: number; LOW: number }
  maxStreak: number
  evidence: AlertEvidenceContext
}) {
  const safeAlerts = useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts])
  const topAlerts = safeAlerts.slice(0, 5)
  const [selected, setSelected] = useState<AlertItemDetail | null>(topAlerts[0] ?? null)
  const [open, setOpen] = useState(false)

  const openAlert = (a: AlertItemDetail) => {
    setSelected(a)
    setOpen(true)
  }

  return (
    <>
      <section
        style={{
          background: '#11161C',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: '1.1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <div style={{ color: '#e5e7eb' }}>
            <BilLabel ko="최근 알림" en="Recent Alerts" variant="label" />
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: '0.65rem' }}>
            <span style={{ color: C.defensive }}>H{severityCount.HIGH}</span>
            <span style={{ color: C.transition }}>M{severityCount.MED}</span>
            <span style={{ color: C.bull }}>L{severityCount.LOW}</span>
          </div>
        </div>

        {topAlerts.length === 0 ? (
          <div style={{ color: '#374151', fontSize: '0.8rem' }}>No alerts</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {topAlerts.map((x, idx) => {
              const sev = (x.severity_label || 'LOW').toUpperCase()
              const reg = (x.regime_label || 'NOISE').toUpperCase()
              const sv = severityStyle(sev)
              const rg = regimeStyle(reg)

              return (
                <button
                  type="button"
                  key={`${x.date ?? 'na'}-${idx}`}
                  onClick={() => openAlert(x)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    width: '100%',
                    textAlign: 'left',
                    color: 'inherit',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 8,
                    padding: '4px 4px 6px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ color: '#6b7280', minWidth: 52, fontSize: '0.68rem' }}>{x.date ?? '-'}</span>
                  <span style={{ color: '#fca5a5', fontWeight: 600, fontSize: '0.75rem' }}>
                    {typeof x.score === 'number' ? x.score.toFixed(0) : '-'}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ border: `1px solid ${sv.border}`, background: sv.bg, borderRadius: 999, padding: '1px 6px' }}>
                      <span style={{ color: sv.color }}>
                        <BilLabel ko={sevKo(sev)} en={sev} variant="micro" />
                      </span>
                    </span>
                    <span style={{ border: `1px solid ${rg.border}`, background: rg.bg, borderRadius: 999, padding: '1px 6px' }}>
                      <span style={{ color: rg.color }}>
                        <BilLabel ko={regimeKo(reg)} en={reg} variant="micro" />
                      </span>
                    </span>
                    <span style={{ color: '#4b5563', display: 'inline-flex', alignItems: 'center' }}>
                      <Chevron />
                    </span>
                  </span>
                </button>
              )
            })}
            {maxStreak > 0 && (
              <div style={{ fontSize: '0.65rem', color: '#374151' }}>Max streak: {maxStreak}</div>
            )}
          </div>
        )}
      </section>

      <AlertDetailDrawer
        open={open}
        selected={selected}
        alerts={safeAlerts}
        evidence={evidence}
        onClose={() => setOpen(false)}
        onSelect={setSelected}
      />
    </>
  )
}
