import BilLabel from '@/components/BilLabel'

export default function SignalCard({
  title,
  status,
  statusColor,
  values,
  note,
}: {
  title: { ko: string; en: string }
  status?: { ko: string; en: string } | null
  statusColor?: string
  values: Array<{ label: { ko: string; en: string }; value: string; color?: string }>
  note?: { ko: string; en: string } | null
}) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '0.8rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--text-primary)' }}>
          <BilLabel ko={title.ko} en={title.en} variant="label" />
        </div>
        {status && (
          <span
            style={{
              borderRadius: 999,
              padding: '2px 7px',
              border: `1px solid ${statusColor || 'rgba(255,255,255,0.1)'}`,
              background: `${statusColor || '#6E7681'}18`,
              color: statusColor || 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            <BilLabel ko={status.ko} en={status.en} variant="micro" />
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 10px' }}>
        {values.slice(0, 4).map((v) => (
          <div key={v.label.en} style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              <BilLabel ko={v.label.ko} en={v.label.en} variant="micro" />
            </div>
            <div style={{ color: v.color || 'var(--text-primary)', fontSize: '0.86rem', fontWeight: 700, marginTop: 3, wordBreak: 'break-word' }}>
              {v.value}
            </div>
          </div>
        ))}
      </div>

      {note && (
        <div style={{ color: 'var(--text-secondary)' }}>
          <BilLabel ko={note.ko} en={note.en} variant="micro" />
        </div>
      )}
    </div>
  )
}
