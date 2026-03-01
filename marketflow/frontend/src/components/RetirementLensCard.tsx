import BilLabel from '@/components/BilLabel'

export default function RetirementLensCard() {
  const bullets = [
    {
      ko: '리스크 온/오프보다 먼저 낙폭 관리 규칙(손실 허용 한도)을 고정하세요.',
      en: 'Set drawdown control rules first, before reacting to risk-on/off signals.',
    },
    {
      ko: '인출 생활비 관점에서 현금 풀(Pool)·현금흐름 런웨이를 분리해 보세요.',
      en: 'Separate your cash pool and spending runway when planning withdrawals.',
    },
    {
      ko: 'TQQQ/SOXL 같은 레버리지는 보조 수단으로만 제한하고 비중·기간을 짧게 관리하세요.',
      en: 'Treat leveraged ETFs like TQQQ/SOXL as tactical tools with tighter size and duration limits.',
    },
  ]

  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div style={{ color: 'var(--text-primary)' }}>
        <BilLabel ko="은퇴 관점 체크" en="Retirement Lens" variant="label" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map((b, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 5, height: 5, marginTop: 5, borderRadius: 999, background: 'var(--state-transition)', flexShrink: 0 }} />
            <div style={{ color: 'var(--text-secondary)' }}>
              <BilLabel ko={b.ko} en={b.en} variant="micro" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

