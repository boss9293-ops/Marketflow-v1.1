import Link from 'next/link'

export type MacroStateChip = {
  label: string
  value: string
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
}

const TONE_COLOR: Record<NonNullable<MacroStateChip['tone']>, string> = {
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  blue: '#60A5FA',
  neutral: '#94A3B8',
}

export default function StructuralStateStrip({
  marketRegime,
  macroState,
  href = '/macro',
}: {
  marketRegime: string
  macroState: MacroStateChip[]
  href?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <section
        style={{
          background: '#0B0F14',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '0.7rem 0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#D8E6F5', fontSize: '0.78rem', letterSpacing: '0.08em', fontWeight: 800 }}>
            STRUCTURAL STATE
          </span>
          <span style={{ color: '#F8FAFC', fontSize: '0.95rem', fontWeight: 900 }}>
            {marketRegime}
          </span>
          <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700 }}>
            Open Macro
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {macroState.map((chip) => {
            const color = TONE_COLOR[chip.tone || 'neutral']
            return (
              <span
                key={chip.label}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${color}40`,
                  background: `${color}15`,
                  color: '#E2E8F0',
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  gap: 6,
                }}
              >
                <span style={{ color }}>{chip.label}</span>
                <span>{chip.value}</span>
              </span>
            )
          })}
        </div>
      </section>
    </Link>
  )
}
