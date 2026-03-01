type BilLabelVariant = 'title' | 'label' | 'micro'

interface BilLabelProps {
  ko: string
  en: string
  variant?: BilLabelVariant
  showEn?: boolean
}

const SIZES: Record<BilLabelVariant, { ko: string; en: string; gap: number }> = {
  title: { ko: '1.14rem', en: '0.94rem', gap: 2 },
  label: { ko: '0.98rem', en: '0.82rem', gap: 2 },
  micro: { ko: '0.84rem', en: '0.74rem', gap: 1 },
}

export default function BilLabel({ ko, en, variant = 'label', showEn = true }: BilLabelProps) {
  const size = SIZES[variant]

  return (
    <span className="mf-bil-label" style={{ display: 'inline-flex', flexDirection: 'column', gap: size.gap, lineHeight: 1.2 }}>
      <span className="mf-bil-ko" style={{ fontSize: size.ko, color: 'inherit', fontWeight: 650, lineHeight: 1.18 }}>
        {ko}
      </span>
      {showEn && (
        <span className="mf-bil-en" style={{ fontSize: size.en, color: 'var(--text-secondary)', fontWeight: 550, lineHeight: 1.15 }}>
          {en}
        </span>
      )}
    </span>
  )
}
