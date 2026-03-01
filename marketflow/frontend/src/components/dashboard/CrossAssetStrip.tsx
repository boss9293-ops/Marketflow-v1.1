type TapeItem = {
  symbol?: string | null
  last?: number | null
  chg_pct?: number | null
  spark_1d?: number[] | null
}

const DEFAULT_TABS = ['Indices', 'Rates', 'FX', 'Commodities', 'Crypto'] as const

const DEFAULT_ROWS = [
  { label: 'SPY', key: 'SPY' },
  { label: 'QQQ', key: 'QQQ' },
  { label: 'IWM', key: 'IWM' },
  { label: 'DIA', key: 'DIA' },
  { label: 'VIX', key: 'VIX' },
  { label: 'US10Y', key: 'US10Y' },
  { label: 'DXY', key: 'DXY' },
  { label: 'GOLD', key: 'GOLD' },
  { label: 'BTC', key: 'BTCUSD' },
]

function fmt(v: number | null | undefined, digits = 2) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '--'
}

function miniSparkPath(pts?: number[] | null) {
  if (!Array.isArray(pts) || pts.length < 2) return null
  const w = 46
  const h = 14
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export default function CrossAssetStrip({
  items,
  tabs = DEFAULT_TABS,
  activeTab = 'Indices',
}: {
  items: TapeItem[]
  tabs?: readonly string[]
  activeTab?: string
}) {
  const map = new Map((items || []).map((it) => [String(it.symbol || '').toUpperCase(), it]))

  return (
    <section
      style={{
        background: '#0B0F14',
        border: '1px solid rgba(59,130,246,0.12)',
        borderRadius: 14,
        padding: '0.75rem',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ color: '#F8FAFC', fontSize: '1.02rem', fontWeight: 800 }}>Cross Asset</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const active = tab === activeTab
            return (
              <span
                key={tab}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)',
                  color: '#D8E6F5',
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {tab}
              </span>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2" style={{ marginTop: 8 }}>
        {DEFAULT_ROWS.map(({ label, key }) => {
          const item = map.get(key)
          const chg = typeof item?.chg_pct === 'number' ? item.chg_pct : null
          const up = (chg ?? 0) >= 0
          const col = chg == null ? '#D8E6F5' : up ? '#22C55E' : '#F97316'
          const arrow = chg == null ? '' : up ? '▲' : '▼'
          const spark = miniSparkPath(item?.spark_1d || null)
          return (
            <div
              key={label}
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                padding: '0.45rem 0.55rem',
                minHeight: 62,
                display: 'grid',
                gap: 3,
              }}
            >
              <div style={{ color: '#D8E6F5', fontSize: '0.68rem', fontWeight: 800 }}>{label}</div>
              <div style={{ color: col, fontSize: '0.74rem', fontWeight: 800 }}>
                {chg == null ? '--' : `${arrow} ${Math.abs(chg).toFixed(2)}%`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ color: '#F8FAFC', fontSize: '0.9rem', fontWeight: 800 }}>
                  {fmt(item?.last ?? null)}
                </div>
                {spark ? (
                  <svg width="50" height="16" viewBox="0 0 46 14">
                    <polyline points={spark} fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
