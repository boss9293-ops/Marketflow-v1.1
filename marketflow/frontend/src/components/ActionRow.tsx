import Link from 'next/link'
import { readCacheJson } from '@/lib/readCacheJson'
import DataPlaceholder from '@/components/DataPlaceholder'

type ExposureGuidance = {
  action_label?: string | null
  exposure_band?: string | null
  reason?: string | null
}

type PortfolioTop = {
  symbol?: string | null
  value?: number | null
  pct?: number | null
}

type PortfolioSnapshot = {
  has_holdings?: boolean | null
  total_value?: number | null
  day_pnl?: number | null
  cash_pct?: number | null
  top_positions?: PortfolioTop[]
}

type WatchlistMove = {
  symbol?: string | null
  name?: string | null
  chg_pct?: number | null
  badge?: string | null
  badge_reason?: string | null
}

type ActionSnapshot = {
  data_date?: string | null
  exposure_guidance?: ExposureGuidance
  portfolio?: PortfolioSnapshot
  watchlist_moves?: WatchlistMove[]
}

function card(extra?: object) {
  return {
    background: 'linear-gradient(145deg, #191a1d 0%, #16171a 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '0.85rem 0.95rem',
    minHeight: 132,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0.5rem',
    ...extra,
  } as const
}

function fmtMoney(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtMoneySigned(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  const sign = v >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtPctPlain(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return `${v.toFixed(2)}%`
}

function actionColor(label?: string | null) {
  const v = (label || '').toLowerCase()
  if (v.includes('increase')) return '#22c55e'
  if (v.includes('reduce')) return '#ef4444'
  if (v.includes('hold')) return '#f59e0b'
  return '#9ca3af'
}

function badgeColor(badge?: string | null) {
  const v = (badge || '').toLowerCase()
  if (v.includes('volatile')) return '#f59e0b'
  if (v.includes('overextended')) return '#ef4444'
  return '#22c55e'
}

function parseBand(band?: string | null) {
  if (!band) return null
  const m = String(band).match(/(\d{1,3})\s*[–-]\s*(\d{1,3})/)
  if (!m) return null
  const min = Number(m[1])
  const max = Number(m[2])
  if (Number.isNaN(min) || Number.isNaN(max)) return null
  return { min, max }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export default async function ActionRow() {
  const data = await readCacheJson<ActionSnapshot>('action_snapshot.json', {})
  const exposure = data.exposure_guidance || {}
  const portfolio = data.portfolio || {}
  const moves = (data.watchlist_moves || []).slice(0, 5)

  const placeholder = (
    <DataPlaceholder
      reason="action snapshot unavailable"
      cacheFile="cache/action_snapshot.json"
      script="python backend/scripts/build_action_snapshot.py"
    />
  )

  const actionLabel = exposure.action_label || null
  const actionBand = exposure.exposure_band || null
  const actionReason = exposure.reason || null
  const actionClr = actionColor(actionLabel)

  const hasHoldings = Boolean(portfolio.has_holdings)
  const topPositions = (portfolio.top_positions || []).filter((p) => p?.symbol)

  const topMover = moves[0]

  const band = parseBand(actionBand)
  const currentExposure = typeof portfolio.cash_pct === 'number' ? clamp(100 - portfolio.cash_pct, 0, 100) : null
  const deviation = band && typeof currentExposure === 'number'
    ? (currentExposure < band.min ? currentExposure - band.min : currentExposure > band.max ? currentExposure - band.max : 0)
    : null
  const deviationColor = deviation && deviation !== 0 ? '#ef4444' : '#22c55e'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: '0.875rem' }}>
      {/* Exposure Guidance */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ color: '#6b7280', fontSize: '0.65rem', letterSpacing: '0.1em' }}>EXPOSURE GUIDANCE</span>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{data.data_date || placeholder}</span>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: actionClr }}>{actionLabel || placeholder}</div>
        <div style={{ fontSize: '0.86rem', color: '#e5e7eb' }}>Band: {actionBand || placeholder}</div>
        <div style={{ width: '100%', marginTop: 2 }}>
          <div style={{ position: 'relative', height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
            {band && (
              <div style={{
                position: 'absolute',
                left: `${band.min}%`,
                width: `${band.max - band.min}%`,
                height: '100%',
                background: `${actionClr}33`,
                borderRadius: 999,
              }} />
            )}
            {typeof currentExposure === 'number' && (
              <div style={{
                position: 'absolute',
                left: `${currentExposure}%`,
                top: -3,
                width: 2,
                height: 12,
                background: deviationColor,
              }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#6b7280', marginTop: 4 }}>
            <span style={{ fontWeight: 500 }}>Current {typeof currentExposure === 'number' ? `${currentExposure.toFixed(0)}%` : placeholder}</span>
            <span style={{ fontWeight: 500 }}>Target {actionBand || placeholder}</span>
          </div>
          {typeof deviation === 'number' && deviation !== 0 && (
            <div style={{ marginTop: 4, fontSize: '0.7rem', color: deviationColor, fontWeight: 600 }}>
              Deviation {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%
            </div>
          )}
        </div>
        <div style={{ marginTop: 'auto', fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.35 }}>
          {actionReason || placeholder}
        </div>
      </section>

      {/* Portfolio Quick View */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem', letterSpacing: '0.1em' }}>PORTFOLIO QUICK VIEW</span>
          <Link href="/portfolio" style={{ fontSize: '0.62rem', color: '#374151', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '1px 6px' }}>
            Connect →
          </Link>
        </div>
        {!hasHoldings ? (
          <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4 }}>
            No holdings configured. Connect holdings to see live exposure and P/L.
          </div>
        ) : (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: '#e5e7eb' }}>
              {fmtMoney(portfolio.total_value) || placeholder}
            </div>
            <div style={{ fontSize: '0.78rem', color: (portfolio.day_pnl || 0) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
              {fmtMoneySigned(portfolio.day_pnl) || placeholder}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', width: '100%' }}>
            <span>Today P/L</span>
            <span>Cash {fmtPctPlain(portfolio.cash_pct) || placeholder}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.3 }}>
            Top: {topPositions.length
              ? topPositions.map((p) => `${p.symbol}${typeof p.pct === 'number' ? ` ${p.pct.toFixed(1)}%` : ''}`).join(', ')
              : placeholder}
          </div>
        </>
      )}
    </section>

      {/* Watchlist Moves */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem', letterSpacing: '0.1em' }}>WATCHLIST MOVES</span>
          <span style={{ color: '#4b5563', fontSize: '0.62rem' }}>Top 5</span>
        </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e5e7eb' }}>
            {topMover?.symbol || placeholder}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 500 }}>
            {typeof topMover?.chg_pct === 'number' ? fmtPct(topMover.chg_pct) : placeholder}
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#9ca3af' }}>
          {topMover?.badge_reason || placeholder}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {moves.length ? moves.map((m) => (
            <div key={`${m.symbol}-${m.badge}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: '#e5e7eb' }}>{m.symbol || placeholder}</span>
              <span style={{ color: '#9ca3af' }}>{typeof m.chg_pct === 'number' ? fmtPct(m.chg_pct) : placeholder}</span>
              <span style={{ color: badgeColor(m.badge), fontSize: '0.64rem' }}>{m.badge || placeholder}</span>
            </div>
          )) : (
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{placeholder}</div>
          )}
        </div>
      </section>
    </div>
  )
}
