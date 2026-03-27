type BilLabelVariant = 'title' | 'label' | 'micro'

interface BilLabelProps {
  ko: string
  en: string
  variant?: BilLabelVariant
  showEn?: boolean
}

const SIZES: Record<BilLabelVariant, { ko: string; en: string; gap: number }> = {
  title: { ko: '1.18rem', en: '0.96rem', gap: 2 },
  label: { ko: '1.00rem', en: '0.84rem', gap: 2 },
  micro: { ko: '0.88rem', en: '0.76rem', gap: 1 },
}

export default function BilLabel({ ko, en, variant = 'label', showEn = true }: BilLabelProps) {
  const size = SIZES[variant]

  return (
    <span className="mf-bil-label" style={{ display: 'inline-flex', flexDirection: 'column', gap: size.gap, lineHeight: 1.12, textRendering: 'optimizeLegibility' }}>
      <span className="mf-bil-ko" style={{ fontSize: size.ko, color: 'inherit', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.01em' }}>
        {ko}
      </span>
      {showEn && (
        <span className="mf-bil-en" style={{ fontSize: size.en, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '0.005em' }}>
          {en}
        </span>
      )}
    </span>
  )
}
