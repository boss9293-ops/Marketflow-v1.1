import { readCacheJson } from '@/lib/readCacheJson'
import BilLabel from '@/components/BilLabel'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatePill = {
  label?: string | null
  color?: string | null
  detail?: string | null
}

type MarketStateCache = {
  phase?: StatePill
  gate?:  StatePill
  risk?:  StatePill
  trend?: StatePill
  vr?:    StatePill
}

type OverviewCache = {
  gate_score?:  number | null
  risk_level?:  string | null
  trend_state?: string | null
  gate_avg10d?: number | null
}

type TapeItem = {
  symbol:  string
  last:    number
  chg_pct: number
}

type MarketTapeCache = {
  items: TapeItem[]
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  shock:      '#D32F2F',
  neutral:    '#5E6A75',
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function tileCard(borderColor: string) {
  return {
    background:   '#11161C',
    border:       `1px solid ${borderColor}`,
    borderRadius: 12,
    padding:      '0.75rem 0.875rem',
    flex:         1,
    minWidth:     0,
    display:      'flex' as const,
    flexDirection:'column' as const,
    gap:          '0.25rem',
  }
}

function pulseColor(riskLevel: string | null | undefined): string {
  const r = (riskLevel || '').toUpperCase()
  if (r === 'LOW')    return C.bull
  if (r === 'MEDIUM') return C.transition
  if (r === 'HIGH')   return C.defensive
  return C.neutral
}

function gateColor(score: number | null): string {
  if (score === null) return C.neutral
  if (score > 60)     return C.bull
  if (score > 40)     return C.transition
  return C.defensive
}

function vixColor(vix: number | null): string {
  if (vix === null) return C.neutral
  if (vix < 15)     return C.bull
  if (vix < 20)     return C.transition
  if (vix < 30)     return C.defensive
  return C.shock
}

// ── Component ─────────────────────────────────────────────────────────────────

export default async function MarketMap() {
  const [state, overview, tape] = await Promise.all([
    readCacheJson<MarketStateCache>('market_state.json', {}),
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<MarketTapeCache>('market_tape.json', { items: [] }),
  ])

  const gateScore  = typeof overview.gate_score === 'number' ? overview.gate_score : null
  const gateAvg10d = typeof overview.gate_avg10d === 'number' ? overview.gate_avg10d : null
  const riskLevel  = overview.risk_level || null
  const trendState = overview.trend_state || state.trend?.label || null

  const vixItem = (tape.items || []).find((i) => i.symbol === 'VIX')
  const vixLast = typeof vixItem?.last === 'number' ? vixItem.last : null

  // Pulse — driven by phase + risk
  const phaseLabel  = state.phase?.label || riskLevel || '--'
  const phaseColor  = state.phase?.color || pulseColor(riskLevel)
  const pulseDetail = state.phase?.detail || trendState || null

  // Breadth — gate score
  const gc          = gateColor(gateScore)
  const gateLabel   = gateScore !== null ? gateScore.toFixed(1) : '--'
  const gateDetail  = gateAvg10d !== null
    ? `10d avg ${gateAvg10d.toFixed(1)}`
    : state.gate?.detail || null

  // Vol — VIX + risk
  const vc         = vixColor(vixLast)
  const vixLabel   = vixLast !== null ? vixLast.toFixed(2) : '--'
  const volDetail  = state.vr?.detail || (vixLast !== null
    ? vixLast < 15
      ? 'Low vol — complacency'
      : vixLast < 20
      ? 'Normal range'
      : vixLast < 30
      ? 'Elevated — risk-off'
      : 'Extreme fear zone'
    : null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {/* Section label */}
      <div style={{ fontSize: 'var(--font-label)', color: '#4b5563', letterSpacing: '0.06em' }}>
        <BilLabel ko="시장 지도" en="Market Map" variant="micro" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2" style={{ minWidth: 0 }}>

        {/* Tile 1: Market Pulse */}
        <div style={tileCard(`${phaseColor}30`)}>
          <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', letterSpacing: '0.06em' }}>
            <BilLabel ko="시장 국면" en="MARKET PULSE" variant="micro" />
          </div>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: phaseColor,
              lineHeight: 1.1,
              letterSpacing: '0.02em',
            }}
          >
            {phaseLabel}
          </div>
          {pulseDetail && (
            <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', lineHeight: 1.35, marginTop: 2 }}>
              {pulseDetail}
            </div>
          )}
          {/* Risk level badge */}
          {riskLevel && (
            <div style={{ marginTop: 4 }}>
              <span
                style={{
                  fontSize: 'var(--font-micro)',
                  fontWeight: 700,
                  color: pulseColor(riskLevel),
                  background: pulseColor(riskLevel) + '18',
                  border: `1px solid ${pulseColor(riskLevel)}35`,
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {riskLevel} RISK
              </span>
            </div>
          )}
        </div>

        {/* Tile 2: Breadth Health (Gate Score) */}
        <div style={tileCard(`${gc}28`)}>
          <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', letterSpacing: '0.06em' }}>
            <BilLabel ko="시장 폭" en="BREADTH HEALTH" variant="micro" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: gc,
                lineHeight: 1,
              }}
            >
              {gateLabel}
            </span>
            <span style={{ fontSize: 'var(--font-micro)', color: '#6b7280' }}>/100</span>
          </div>
          <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', marginTop: 2 }}>GATE SCORE</div>
          {/* Mini segmented bar */}
          <div
            style={{
              display: 'flex',
              height: 4,
              borderRadius: 2,
              overflow: 'hidden',
              gap: 1,
              marginTop: 5,
            }}
          >
            {[C.defensive, '#FFB300', C.transition, C.bull, C.bull].map((col, i) => {
              const segMin = i * 20
              const active = gateScore !== null && gateScore >= segMin && (i === 4 ? true : gateScore < segMin + 20)
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: col,
                    opacity: active ? 1 : 0.18,
                    borderRadius: i === 0 ? '2px 0 0 2px' : i === 4 ? '0 2px 2px 0' : 0,
                  }}
                />
              )
            })}
          </div>
          {gateDetail && (
            <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', marginTop: 4, lineHeight: 1.35 }}>
              {gateDetail}
            </div>
          )}
        </div>

        {/* Tile 3: Vol Structure */}
        <div style={tileCard(`${vc}28`)}>
          <div style={{ fontSize: 'var(--font-micro)', color: '#6b7280', letterSpacing: '0.06em' }}>
            <BilLabel ko="변동성 구조" en="VOL STRUCTURE" variant="micro" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span
              style={{
                fontSize: '0.62rem',
                color: '#6b7280',
                lineHeight: 1,
                paddingBottom: 1,
              }}
            >
              VIX
            </span>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: vc,
                lineHeight: 1,
              }}
            >
              {vixLabel}
            </span>
          </div>
          {volDetail && (
            <div style={{ fontSize: '0.62rem', color: '#6b7280', lineHeight: 1.3, marginTop: 3 }}>
              {volDetail}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
