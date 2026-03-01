import fs from 'fs/promises'
import path from 'path'

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bull:      '#22c55e',
  defensive: '#dc2626',
} as const

// ── Types ──────────────────────────────────────────────────────────────────────
export type TapeItem = {
  symbol: string
  name: string
  last: number | null
  chg: number | null
  chg_pct: number | null
  spark_1d: number[]
}

type MarketTapeData = {
  data_date?: string | null
  generated_at?: string | null
  items?: TapeItem[]
}

// ── Cache helper ────────────────────────────────────────────────────────────────
async function readTapeCache(): Promise<MarketTapeData> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'market_tape.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'market_tape.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'market_tape.json'),
  ]
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')) as MarketTapeData } catch { /* next */ }
  }
  return { items: [] }
}

// ── Inline SVG sparkline ────────────────────────────────────────────────────────
function Spark({ values, color, w = 56, h = 22 }: {
  values: number[]
  color: string
  w?: number
  h?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 3) - 1.5
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Individual tile ──────────────────────────────────────────────────────────────
function TapeTile({ item }: { item: TapeItem }) {
  const isVix = item.symbol === 'VIX'
  const up = (item.chg_pct ?? 0) >= 0

  // VIX: green = falling (good), red = rising (bad)
  const color = isVix
    ? (up ? C.defensive : C.bull)
    : (up ? C.bull : C.defensive)

  const fmtLast = item.last != null
    ? item.last.toFixed(2)
    : '\u2014'

  const fmtChg = item.chg != null
    ? (item.chg >= 0 ? '+' : '') + item.chg.toFixed(2)
    : '\u2014'

  const fmtPct = item.chg_pct != null
    ? (item.chg_pct >= 0 ? '+' : '') + item.chg_pct.toFixed(2) + '%'
    : '\u2014'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.55rem 0.875rem',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      minWidth: 148,
      flex: '1 1 140px',
    }}>
      {/* Left: symbol + name + price */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#e8edf9' }}>
            {item.symbol}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#4b5563', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: 2 }}>
          <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
            {fmtLast}
          </span>
          <span style={{ fontSize: '0.7rem', color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmtChg}
          </span>
        </div>
        <div style={{ fontSize: '0.68rem', color, fontWeight: 700, marginTop: 1 }}>
          {fmtPct}
        </div>
      </div>

      {/* Right: sparkline */}
      {item.spark_1d.length >= 2 && (
        <Spark values={item.spark_1d} color={color} />
      )}
    </div>
  )
}

// ── Main server component ────────────────────────────────────────────────────────
export default async function MarketTape() {
  const data = await readTapeCache()
  const items = data.items ?? []

  if (items.length === 0) {
    return (
      <div style={{
        padding: '0.5rem 0.875rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        color: '#374151',
        fontSize: '0.72rem',
      }}>
        Market tape not available — run{' '}
        <code style={{ color: '#fcd34d', fontSize: '0.7rem' }}>
          python backend/scripts/build_market_tape.py
        </code>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {items.map(item => <TapeTile key={item.symbol} item={item} />)}
      </div>
      {data.data_date && (
        <div style={{ marginTop: '0.3rem', fontSize: '0.58rem', color: '#374151', paddingLeft: 2 }}>
          data: {data.data_date}
        </div>
      )}
    </div>
  )
}
