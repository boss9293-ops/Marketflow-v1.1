import BilLabel from '@/components/BilLabel'

type KV = {
  label: { ko: string; en: string }
  value: string
  color?: string
}

export default function RiskNowPanel({
  phase,
  phaseColor,
  summary,
  metrics,
  needsVerification,
}: {
  phase: { ko: string; en: string }
  phaseColor: string
  summary: { ko: string; en: string }
  metrics: KV[]
  needsVerification?: boolean
}) {
  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text-primary)' }}>
          <BilLabel ko="현재 리스크 상태" en="Risk Now" variant="label" />
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            border: `1px solid ${phaseColor}55`,
            background: `${phaseColor}18`,
            color: phaseColor,
            padding: '2px 8px',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: phaseColor, flexShrink: 0 }} />
          <BilLabel ko={phase.ko} en={phase.en} variant="micro" />
        </span>
      </div>

      <div style={{ color: 'var(--text-secondary)' }}>
        <BilLabel ko={summary.ko} en={summary.en} variant="micro" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ minWidth: 0 }}>
        {metrics.map((m) => (
          <div
            key={m.label.en}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: '0.65rem 0.75rem',
              minWidth: 0,
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>
              <BilLabel ko={m.label.ko} en={m.label.en} variant="micro" />
            </div>
            <div style={{ marginTop: 4, color: m.color || 'var(--text-primary)', fontSize: '0.84rem', fontWeight: 700, wordBreak: 'break-word' }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {needsVerification && (
        <div style={{ color: 'var(--text-muted)' }}>
          <BilLabel ko="일부 필드 누락으로 확인 필요" en="Needs verification due to missing fields" variant="micro" />
        </div>
      )}
    </section>
  )
}
