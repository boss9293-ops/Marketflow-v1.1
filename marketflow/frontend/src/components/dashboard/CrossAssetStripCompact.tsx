import BilLabel from '@/components/BilLabel'

type TapeItem = {
  symbol?: string | null
  last?: number | null
  chg_pct?: number | null
}

const DEFAULT_TABS = ['All', 'Indices', 'Rates', 'FX', 'Commodities', 'Crypto'] as const
const TAB_LABELS: Record<string, { ko: string; en: string }> = {
  All: { ko: '전체', en: 'All' },
  Indices: { ko: '지수', en: 'Indices' },
  Rates: { ko: '금리', en: 'Rates' },
  FX: { ko: '환율', en: 'FX' },
  Commodities: { ko: '원자재', en: 'Commodities' },
  Crypto: { ko: '크립토', en: 'Crypto' },
}

const DEFAULT_ROWS = [
  { label: 'SPY', key: 'SPY' },
  { label: 'QQQ', key: 'QQQ' },
  { label: 'IWM', key: 'IWM' },
  { label: 'VIX', key: 'VIX' },
  { label: 'US10Y', key: 'US10Y' },
  { label: 'DXY', key: 'DXY' },
  { label: 'GOLD', key: 'GOLD' },
  { label: 'BTC', key: 'BTCUSD' },
]

function fmt(v: number | null | undefined, digits = 2) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '--'
}

export default function CrossAssetStripCompact({
  items,
  tabs = DEFAULT_TABS,
  activeTab = 'All',
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
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '0.65rem 0.75rem',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ color: '#F8FAFC' }}>
          <BilLabel ko="크로스 에셋" en="Cross Asset" variant="label" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const active = tab === activeTab
            const label = TAB_LABELS[tab] || { ko: tab, en: tab }
            return (
              <span
                key={tab}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)',
                  color: '#D8E6F5',
                  padding: '0.18rem 0.4rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                }}
              >
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700 }}>{label.ko}</span>
                  <span style={{ fontSize: '0.58rem', color: '#94A3B8', fontWeight: 600 }}>{label.en}</span>
                </span>
              </span>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2" style={{ marginTop: 8 }}>
        {DEFAULT_ROWS.map(({ label, key }) => {
          const item = map.get(key)
          const chg = typeof item?.chg_pct === 'number' ? item.chg_pct : null
          const up = (chg ?? 0) >= 0
          const col = chg == null ? '#D8E6F5' : up ? '#22C55E' : '#F97316'
          const arrow = chg == null ? '' : up ? '▲' : '▼'
          return (
            <div
              key={label}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                padding: '0.35rem 0.4rem',
                minHeight: 46,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ color: '#D8E6F5', fontSize: '0.64rem', fontWeight: 800 }}>{label}</div>
              <div style={{ color: '#F8FAFC', fontSize: '0.8rem', fontWeight: 800 }}>{fmt(item?.last ?? null)}</div>
              <div style={{ color: col, fontSize: '0.68rem', fontWeight: 800 }}>
                {chg == null ? '--' : `${arrow} ${Math.abs(chg).toFixed(2)}%`}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
