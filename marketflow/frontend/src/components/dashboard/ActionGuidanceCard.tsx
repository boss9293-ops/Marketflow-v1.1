import BilLabel from '@/components/BilLabel'
import type React from 'react'

export default function ActionGuidanceCard({
  headline,
  band,
  subKo,
  subEn,
  progress,
  speedLine,
  style,
}: {
  headline: string
  band: string
  subKo?: string
  subEn?: string
  progress?: number | null
  speedLine?: string
  style?: React.CSSProperties
}) {
  const pct = typeof progress === 'number' ? Math.max(6, Math.min(100, progress)) : 55

  return (
    <section
      style={{
        background: '#0B0F14',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '0.75rem',
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#D8E6F5' }}>
            <BilLabel ko="액션 가이던스" en="Action Guidance" variant="micro" />
          </div>
          <div style={{ marginTop: 3, color: '#F8FAFC', fontSize: '1.18rem', fontWeight: 900 }}>{headline}</div>
          {(subKo || subEn) && (
            <div style={{ marginTop: 3, color: '#D7FF37', fontSize: '0.82rem', fontWeight: 700 }}>
              <BilLabel ko={subKo || ''} en={subEn || ''} variant="micro" />
            </div>
          )}
        </div>
        <div style={{ color: '#F8FAFC', fontSize: '1.15rem', fontWeight: 900 }}>{band}</div>
      </div>
      <div style={{ marginTop: 9, height: 6, borderRadius: 999, background: 'rgba(59,130,246,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#D7FF37' }} />
      </div>
      {speedLine && (
        <div className="line-clamp-1" style={{ marginTop: 8, color: '#D8E6F5', fontSize: '0.78rem' }}>
          {speedLine}
        </div>
      )}
    </section>
  )
}
