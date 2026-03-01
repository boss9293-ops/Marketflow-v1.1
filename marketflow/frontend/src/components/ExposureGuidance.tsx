import { readCacheJson } from '@/lib/readCacheJson'
import BilLabel from '@/components/BilLabel'
import { SECTION_TITLES, EXPOSURE_TEXT } from '@/lib/text'

// ── Types ────────────────────────────────────────────────────────────────────

type ExposureGuidanceData = {
  action_label?: string | null
  exposure_band?: string | null
  reason?: string | null
}

type PortfolioSnapshot = {
  has_holdings?: boolean | null
  cash_pct?: number | null
}

type ActionSnapshot = {
  data_date?: string | null
  exposure_guidance?: ExposureGuidanceData
  portfolio?: PortfolioSnapshot
}

type OverviewCache = {
  gate_score?: number | null
  risk_level?: string | null
  risk_trend?: string | null
  pct_from_sma200?: number | null
}

// ── Palette (institutional terminal) ─────────────────────────────────────────

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  neutral:    '#5E6A75',
} as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseExposureBand(band: string | null | undefined): { min: number; max: number } | null {
  if (!band) return null
  const m = String(band).match(/(\d{1,3})\s*[^\d]\s*(\d{1,3})/)
  if (!m) return null
  const min = Number(m[1])
  const max = Number(m[2])
  if (Number.isNaN(min) || Number.isNaN(max) || max <= min) return null
  return { min, max }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function actionColor(label: string | null | undefined): string {
  const v = (label || '').toLowerCase()
  if (v.includes('increase')) return C.bull
  if (v.includes('reduce'))   return C.defensive
  if (v.includes('hold'))     return C.transition
  return C.neutral
}

function buildReasonBullets(
  reason: string | null,
  gateScore: number | null,
  riskLevel: string | null,
  riskTrend: string | null,
  pctFromSma200: number | null,
): string[] {
  const bullets: string[] = []
  if (reason) bullets.push(reason)
  if (gateScore !== null) {
    if (gateScore > 60) bullets.push(`Gate score ${gateScore.toFixed(0)} — structural health supportive`)
    else if (gateScore < 40) bullets.push(`Gate score ${gateScore.toFixed(0)} — structural health weak`)
  }
  if (riskTrend === 'Deteriorating') bullets.push('Risk trend deteriorating — maintain conservative bias')
  if (riskTrend === 'Improving')     bullets.push('Risk trend improving — cautious increase warranted')
  if (riskLevel === 'HIGH')          bullets.push('Risk level HIGH — tail risk elevated, favor capital preservation')
  return bullets.slice(0, 2)
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function ExposureGuidance() {
  const [action, overview] = await Promise.all([
    readCacheJson<ActionSnapshot>('action_snapshot.json', {}),
    readCacheJson<OverviewCache>('overview.json', {}),
  ])

  const exposure   = action.exposure_guidance || {}
  const portfolio  = action.portfolio || {}

  const actionLabel = exposure.action_label || null
  const band        = parseExposureBand(exposure.exposure_band)
  const bandStr     = exposure.exposure_band || null
  const acColor     = actionColor(actionLabel)

  const hasHoldings = Boolean(portfolio.has_holdings)
  const currentExp  = hasHoldings && typeof portfolio.cash_pct === 'number'
    ? clamp(100 - portfolio.cash_pct, 0, 100)
    : null

  const deviation = band && currentExp !== null
    ? currentExp < band.min
      ? currentExp - band.min
      : currentExp > band.max
      ? currentExp - band.max
      : 0
    : null

  const isOutsideBand  = deviation !== null && deviation !== 0
  const isHighDeviation = isOutsideBand && deviation !== null && Math.abs(deviation) > 15

  const gateScore     = typeof overview.gate_score     === 'number' ? overview.gate_score     : null
  const pctFromSma200 = typeof overview.pct_from_sma200 === 'number' ? overview.pct_from_sma200 : null

  const bullets = buildReasonBullets(
    exposure.reason ?? null,
    gateScore,
    overview.risk_level ?? null,
    overview.risk_trend ?? null,
    pctFromSma200,
  )

  return (
    <section
      style={{
        background: '#161C24',
        border: isHighDeviation
          ? `1.5px solid ${acColor}60`
          : `1px solid ${acColor}38`,
        borderRadius: 16,
        padding: '1.5rem 1.75rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.12em', marginBottom: 5 }}>
            <BilLabel {...SECTION_TITLES.exposure} variant="label" />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.875rem',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: acColor,
                letterSpacing: '0.02em',
              }}
            >
              {actionLabel || '--'}
            </span>
            {bandStr && (
              <span style={{ fontSize: '0.95rem', color: '#e5e7eb', fontWeight: 600 }}>
                {bandStr} recommended band
              </span>
            )}
          </div>
        </div>
        {action.data_date && (
          <span style={{ fontSize: '0.65rem', color: '#374151' }}>as of {action.data_date}</span>
        )}
      </div>

      {/* ── Band Gauge — 32px track (+23% vs previous 26px) ──────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        {/* Track: 32px */}
        <div style={{ position: 'relative', height: 32, borderRadius: 14, background: 'rgba(255,255,255,0.05)', marginBottom: 10 }}>
          {/* Recommended band highlight */}
          {band && (
            <div
              style={{
                position: 'absolute',
                left: `${band.min}%`,
                width: `${band.max - band.min}%`,
                height: '100%',
                background: acColor + '28',
                border: `1px solid ${acColor}50`,
                borderRadius: 12,
              }}
            />
          )}
          {/* Current exposure marker — 9px wide for visibility */}
          {currentExp !== null && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: `${clamp(currentExp, 0.5, 99.5)}%`,
                  top: 0,
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  width: 9,
                  background: isOutsideBand ? C.defensive : C.bull,
                  borderRadius: 5,
                  boxShadow: isOutsideBand
                    ? `0 0 0 2px ${C.defensive}44, 0 0 8px ${C.defensive}30`
                    : '0 0 6px rgba(0,200,83,0.35)',
                }}
              />
              {/* Label on marker */}
              <div
                style={{
                  position: 'absolute',
                  left: `${clamp(currentExp, 7, 90)}%`,
                  top: -22,
                  transform: 'translateX(-50%)',
                  fontSize: '0.65rem',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
              >
                Current {currentExp.toFixed(0)}%
              </div>
            </>
          )}
          {/* Endpoint labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              position: 'absolute',
              left: 6,
              right: 6,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>0%</span>
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>50%</span>
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>100%</span>
          </div>
        </div>

        {/* Legend row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ color: '#9ca3af' }}>
            Target band{' '}
            <b style={{ color: acColor }}>{bandStr || '--'}</b>
          </span>
          {currentExp !== null ? (
            isOutsideBand && deviation !== null ? (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ color: C.defensive, fontWeight: 700, fontSize: '0.8rem' }}>
                  {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}% {EXPOSURE_TEXT[deviation > 0 ? 'overweight' : 'underweight'].ko}
                </span>
                <span style={{ color: 'rgba(255,112,67,0.75)', fontWeight: 500, fontSize: '0.7rem' }}>
                  {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}% {EXPOSURE_TEXT[deviation > 0 ? 'overweight' : 'underweight'].en}
                </span>
              </span>
            ) : (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ color: C.bull, fontWeight: 400, fontSize: '0.72rem' }}>
                  {EXPOSURE_TEXT.withinBand.ko}
                </span>
                <span style={{ color: 'rgba(0,200,83,0.75)', fontWeight: 400, fontSize: '0.63rem' }}>
                  {EXPOSURE_TEXT.withinBand.en}
                </span>
              </span>
            )
          ) : (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{EXPOSURE_TEXT.connectHoldings.ko}</span>
              <span style={{ color: 'rgba(75,85,99,0.75)', fontSize: '0.63rem' }}>{EXPOSURE_TEXT.connectHoldings.en}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Reason bullets ───────────────────────────────────────────── */}
      {bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem' }}>
          {bullets.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: acColor, flexShrink: 0, marginTop: 1 }}>&#8250;</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conservative disclaimer */}
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.65rem',
          color: '#374151',
          lineHeight: 1.35,
        }}
      >
        Guidance is probabilistic, not a hard instruction. Adjust for personal risk tolerance, tax considerations, and position sizing rules.
      </div>
    </section>
  )
}
