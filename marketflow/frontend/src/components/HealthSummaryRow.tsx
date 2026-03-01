import { readCacheJson } from '@/lib/readCacheJson'
import DataPlaceholder from '@/components/DataPlaceholder'

type TrendSnapshot = {
  qqq_close?: number | null
  sma200?: number | null
  dist_pct?: number | null
  sma50?: number | null
  sma20?: number | null
}

type RiskSnapshot = {
  var95_1d?: number | null
  cvar95_1d?: number | null
  ulcer_252d?: number | null
  mdd_252d?: number | null
  rv20?: number | null
  rv252?: number | null
  vol_ratio?: number | null
}

type BreadthGreed = {
  greed_proxy?: number | null
  label?: string | null
  explain?: string | null
}

type HealthSnapshot = {
  data_date?: string | null
  trend?: TrendSnapshot
  risk?: RiskSnapshot
  breadth_greed?: BreadthGreed
}

const MISSING = {
  reason: 'health snapshot unavailable',
  cacheFile: 'cache/health_snapshot.json',
  script: 'python backend/scripts/build_health_snapshot.py',
}

function fmtPct(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtNum(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return v.toFixed(2)
}

function riskLabel(volRatio?: number | null) {
  if (typeof volRatio !== 'number') return { label: null, color: '#6b7280' }
  if (volRatio >= 1.2) return { label: 'High', color: '#ef4444' }
  if (volRatio <= 0.9) return { label: 'Low', color: '#22c55e' }
  return { label: 'Med', color: '#f59e0b' }
}

function card(extra?: object) {
  return {
    background: 'linear-gradient(145deg, #17181c 0%, #141518 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '0.72rem 0.8rem',
    minHeight: 102,
    ...extra,
  } as const
}

function SparkMini({ values, color = '#9ca3af' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const w = 64, h = 16
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.8 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default async function HealthSummaryRow() {
  const data = await readCacheJson<HealthSnapshot>('health_snapshot.json', {})
  const trend = data.trend || {}
  const risk = data.risk || {}
  const greed = data.breadth_greed || {}

  const dist = typeof trend.dist_pct === 'number' ? trend.dist_pct : null
  const distText = dist === null ? null : `${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%`
  const riskBadge = riskLabel(risk.vol_ratio ?? null)
  const greedVal = typeof greed.greed_proxy === 'number' ? greed.greed_proxy : null
  const greedLabel = greed.label || null
  const greedExplain = (greed.explain || '').split('\n').slice(0, 2)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: '0.875rem' }}>
      {/* Trend */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem', letterSpacing: '0.1em' }}>TREND</span>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
            {data.data_date || <DataPlaceholder {...MISSING} />}
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: '0.9rem', fontWeight: 700, color: '#e5e7eb' }}>
          QQQ vs SMA200: {distText ?? <DataPlaceholder {...MISSING} />}
        </div>
        <div style={{ marginTop: 4 }}>
          {typeof trend.sma20 === 'number' && typeof trend.sma50 === 'number' && typeof trend.qqq_close === 'number'
            ? <SparkMini values={[trend.sma20, trend.sma50, trend.qqq_close]} color="#4f9cf0" />
            : <DataPlaceholder {...MISSING} />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)', padding: '2px 8px', borderRadius: 999 }}>
            SMA20 {typeof trend.sma20 === 'number' ? trend.sma20 : <DataPlaceholder {...MISSING} />}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#a7f3d0', border: '1px solid rgba(16,185,129,0.35)', padding: '2px 8px', borderRadius: 999 }}>
            SMA50 {typeof trend.sma50 === 'number' ? trend.sma50 : <DataPlaceholder {...MISSING} />}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.35)', padding: '2px 8px', borderRadius: 999 }}>
            Close {typeof trend.qqq_close === 'number' ? trend.qqq_close : <DataPlaceholder {...MISSING} />}
          </span>
        </div>
      </section>

      {/* Risk */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem', letterSpacing: '0.1em' }}>RISK</span>
          <span style={{ color: riskBadge.color, fontSize: '0.7rem', fontWeight: 700 }}>
            {riskBadge.label || <DataPlaceholder {...MISSING} />}
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          {typeof risk.var95_1d === 'number' && typeof risk.cvar95_1d === 'number' && typeof risk.vol_ratio === 'number'
            ? <SparkMini values={[risk.var95_1d, risk.cvar95_1d, risk.vol_ratio]} color="#f0b44f" />
            : <DataPlaceholder {...MISSING} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 6 }}>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', opacity: 0.55 }}>VaR95</div>
          <div style={{ fontSize: '0.76rem', color: '#e5e7eb', textAlign: 'right' }}>
            {fmtPct(risk.var95_1d) || <DataPlaceholder {...MISSING} />}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', opacity: 0.55 }}>CVaR95</div>
          <div style={{ fontSize: '0.76rem', color: '#e5e7eb', textAlign: 'right' }}>
            {fmtPct(risk.cvar95_1d) || <DataPlaceholder {...MISSING} />}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', opacity: 0.55 }}>Ulcer</div>
          <div style={{ fontSize: '0.76rem', color: '#e5e7eb', textAlign: 'right' }}>
            {fmtNum(risk.ulcer_252d) || <DataPlaceholder {...MISSING} />}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', opacity: 0.55 }}>VolRatio</div>
          <div style={{ fontSize: '0.76rem', color: '#e5e7eb', textAlign: 'right' }}>
            {fmtNum(risk.vol_ratio) || <DataPlaceholder {...MISSING} />}
          </div>
        </div>
      </section>

      {/* Breadth / Greed */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem', letterSpacing: '0.1em' }}>BREADTH / GREED</span>
          <span style={{ color: '#e5e7eb', fontSize: '0.7rem', fontWeight: 700 }}>
            {greedLabel || <DataPlaceholder {...MISSING} />}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${greedVal ?? 0}%`,
              background: 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#6b7280', marginTop: 4 }}>
            <span>0</span>
            <span>{greedVal ?? <DataPlaceholder {...MISSING} />}</span>
            <span>100</span>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          {typeof greedVal === 'number'
            ? <SparkMini values={[Math.max(0, greedVal - 10), greedVal, Math.min(100, greedVal + 10)]} color="#4fd18b" />
            : <DataPlaceholder {...MISSING} />}
        </div>
        <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.35 }}>
          {greedExplain.length ? (
            greedExplain.map((line, idx) => <div key={idx}>{line}</div>)
          ) : (
            <div><DataPlaceholder {...MISSING} /></div>
          )}
        </div>
      </section>
    </div>
  )
}
