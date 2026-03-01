import BilLabel from '@/components/BilLabel'

export default function EmptyState({
  title,
  description,
  icon = '∅',
  action,
}: {
  title: { ko: string; en: string }
  description: { ko: string; en: string }
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
        }}
      >
        {icon}
      </div>
      <div style={{ color: 'var(--text-primary)' }}>
        <BilLabel ko={title.ko} en={title.en} variant="label" />
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        <BilLabel ko={description.ko} en={description.en} variant="micro" />
      </div>
      {action && <div style={{ marginTop: 2 }}>{action}</div>}
    </div>
  )
}
