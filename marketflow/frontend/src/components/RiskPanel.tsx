import { readCacheJson } from '@/lib/readCacheJson'
import BilLabel from '@/components/BilLabel'
import { SECTION_TITLES } from '@/lib/text'

// ── Types ────────────────────────────────────────────────────────────────────

type RiskSnapshot = {
  var95_1d?: number | null
  cvar95_1d?: number | null
  ulcer_252d?: number | null
  mdd_252d?: number | null
  rv20?: number | null
  vol_ratio?: number | null
}

type HealthSnapshot = {
  data_date?: string | null
  risk?: RiskSnapshot
}

type OverviewCache = {
  gate_score?: number | null
  risk_level?: string | null
  phase_shift_flag?: number | null
}

type TapeItem = {
  symbol: string
  last: number
  chg_pct: number
  spark_1d: number[]
}

type MarketTapeCache = {
  items: TapeItem[]
}

// ── Palette (institutional terminal) ─────────────────────────────────────────

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  shock:      '#D32F2F',
  neutral:    '#5E6A75',
  warn:       '#FF7043',   // same as defensive in new palette
} as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function card(extra?: object) {
  return {
    background: '#11161C',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '1rem 1.1rem',
    ...extra,
  } as const
}

function fmtPct(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '--'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtNum(v?: number | null, dec = 2) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '--'
  return v.toFixed(dec)
}

/** Crash weather state based on gate score + risk level + VIX */
function crashWeather(
  gateScore: number | null,
  riskLevel: string | null,
  vix: number | null,
): { icon: string; label: string; color: string; desc: string } {
  const g = gateScore ?? 50
  const r = (riskLevel || '').toUpperCase()
  const v = vix ?? 20
  if (g > 60 && r !== 'HIGH' && v < 20)
    return { icon: '\u{1F7E2}', label: 'CLEAR',   color: C.bull,       desc: 'Low probability of near-term shock' }
  if (g > 40 && r !== 'HIGH')
    return { icon: '\u{1F7E1}', label: 'WATCH',   color: C.transition, desc: 'Elevated caution, monitor conditions' }
  if (g > 20 || r === 'MEDIUM')
    return { icon: '\u{1F7E0}', label: 'PREPARE', color: C.warn,       desc: 'Risk environment deteriorating' }
  return   { icon: '\u{1F534}', label: 'STRESS',  color: C.shock,      desc: 'Extreme risk — reduce exposure' }
}

/** Tail risk score 0–100 (higher = worse) */
function tailRiskScore(
  gateScore: number | null,
  var95: number | null,
  volRatio: number | null,
): number {
  let score = 0
  if (gateScore !== null) score += (100 - gateScore) * 0.5
  if (var95 !== null) score += Math.min(40, Math.abs(var95) * 10)
  if (volRatio !== null) score += Math.min(10, Math.max(0, (volRatio - 0.8) * 20))
  return Math.min(100, Math.max(0, score))
}

/** 4-zone classification: Stable 0–30, Elevated 30–60, Caution 60–80, Stress 80–100 */
function thermoZone(score: number): { label: string; color: string } {
  if (score < 30) return { label: 'STABLE',   color: C.bull }
  if (score < 60) return { label: 'ELEVATED', color: C.transition }
  if (score < 80) return { label: 'CAUTION',  color: C.defensive }
  return              { label: 'STRESS',    color: C.shock }
}

function volStructureNote(volRatio: number | null): string {
  if (volRatio === null) return 'N/A'
  if (volRatio >= 1.2) return 'Vol Expansion — elevated near-term risk'
  if (volRatio <= 0.85) return 'Vol Compression — watch for breakout'
  return 'Vol in normal range'
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function RiskPanel() {
  const [health, overview, tape] = await Promise.all([
    readCacheJson<HealthSnapshot>('health_snapshot.json', {}),
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<MarketTapeCache>('market_tape.json', { items: [] }),
  ])

  const risk         = health.risk || {}
  const gateScore    = typeof overview.gate_score === 'number' ? overview.gate_score : null
  const riskLevel    = overview.risk_level || null
  const isPhaseShift = overview.phase_shift_flag === 1

  const vixItem = tape.items.find((i) => i.symbol === 'VIX')
  const vixLast = typeof vixItem?.last === 'number' ? vixItem.last : null

  const tRiskScore = tailRiskScore(gateScore, risk.var95_1d ?? null, risk.vol_ratio ?? null)
  const zone       = thermoZone(tRiskScore)
  const weather    = crashWeather(gateScore, riskLevel, vixLast)

  const vixDesc =
    vixLast !== null
      ? vixLast < 15
        ? 'Low — complacency zone'
        : vixLast < 20
        ? 'Normal range'
        : vixLast < 30
        ? 'Elevated — risk-off conditions'
        : 'Extreme fear zone'
      : 'N/A'

  const volNote = volStructureNote(risk.vol_ratio ?? null)

  // 4-zone segment bounds: [0–30], [30–60], [60–80], [80–100]
  const ZONES = [
    { label: 'STABLE',   min: 0,  max: 30,  color: C.bull       },
    { label: 'ELEVATED', min: 30, max: 60,  color: C.transition },
    { label: 'CAUTION',  min: 60, max: 80,  color: C.defensive  },
    { label: 'STRESS',   min: 80, max: 100, color: C.shock      },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ color: 'var(--text-primary)', fontSize: '1.02rem', letterSpacing: '0.02em' }}>
        <BilLabel {...SECTION_TITLES.risk} variant="label" />
      </div>

      {/* ── Tail Risk Thermometer ───────────────────────────────────── */}
      <section style={card()}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: 12 }}>
          <BilLabel {...SECTION_TITLES.tailRisk} variant="label" />
        </div>

        {/* 4-zone bar with value above needle */}
        <div style={{ position: 'relative', marginBottom: 6, marginTop: 22 }}>
          {/* Score value above needle position */}
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(96, Math.max(4, tRiskScore))}%`,
              top: -20,
              transform: 'translateX(-50%)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: zone.color,
              whiteSpace: 'nowrap',
            }}
          >
            {tRiskScore.toFixed(0)}
          </div>

          <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {ZONES.map((z) => {
              const active = tRiskScore >= z.min && (z.max === 100 ? true : tRiskScore < z.max)
              return (
                <div
                  key={z.label}
                  style={{
                    flex: z.max - z.min,
                    background: z.color,
                    opacity: active ? 1 : 0.22,
                    borderRadius:
                      z.min === 0 ? '5px 0 0 5px' : z.max === 100 ? '0 5px 5px 0' : 0,
                  }}
                />
              )
            })}
          </div>
          {/* Score needle */}
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(99, Math.max(1, tRiskScore))}%`,
              top: -4,
              transform: 'translateX(-50%)',
              width: 3,
              height: 20,
              background: '#fff',
              borderRadius: 2,
              boxShadow: '0 0 5px rgba(255,255,255,0.45)',
            }}
          />
        </div>

        {/* Zone labels — 4 zones: flex 30/30/20/20 */}
        <div
          style={{
            display: 'flex',
            fontSize: '0.58rem',
            color: '#4b5563',
            marginBottom: 14,
          }}
        >
          <span style={{ flex: 30, textAlign: 'left' }}>STABLE</span>
          <span style={{ flex: 30, textAlign: 'center' }}>ELEVATED</span>
          <span style={{ flex: 20, textAlign: 'center' }}>CAUTION</span>
          <span style={{ flex: 20, textAlign: 'right' }}>STRESS</span>
        </div>

        {/* Score + zone label — Primary Metric: 1.5rem */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: zone.color, lineHeight: 1 }}>
              {tRiskScore.toFixed(0)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>RISK SCORE</div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: zone.color,
              background: zone.color + '18',
              border: `1px solid ${zone.color}38`,
              borderRadius: 6,
              padding: '4px 12px',
            }}
          >
            {zone.label}
          </span>
        </div>

        {/* Metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px 12px' }}>
          {[
            { label: 'VaR95 (1d)',  val: fmtPct(risk.var95_1d)  },
            { label: 'CVaR95 (1d)', val: fmtPct(risk.cvar95_1d) },
            { label: 'Ulcer 252d',  val: fmtNum(risk.ulcer_252d) },
            { label: 'Vol Ratio',   val: fmtNum(risk.vol_ratio)  },
          ].map((m) => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: '#6b7280' }}>{m.label}</span>
              <span style={{ color: '#d1d5db', fontWeight: 600 }}>{m.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Volatility Structure ──────────────────────────────────────── */}
      <section style={card()}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: 10 }}>
          <BilLabel {...SECTION_TITLES.volatility} variant="label" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>VIX </span>
            <span
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color:
                  vixLast !== null
                    ? vixLast > 25
                      ? C.shock
                      : vixLast > 18
                      ? C.transition
                      : C.bull
                    : '#6b7280',
              }}
            >
              {vixLast !== null ? vixLast.toFixed(2) : '--'}
            </span>
          </div>
          {typeof risk.rv20 === 'number' && (
            <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#6b7280' }}>
              <div>RV20 {risk.rv20.toFixed(1)}%</div>
              {typeof risk.vol_ratio === 'number' && (
                <div
                  style={{
                    color: risk.vol_ratio > 1.2 ? C.shock : risk.vol_ratio < 0.85 ? C.bull : C.transition,
                    fontWeight: 600,
                  }}
                >
                  Ratio {risk.vol_ratio.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.4 }}>{vixDesc}</div>
        <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 4, lineHeight: 1.35 }}>{volNote}</div>
      </section>

      {/* ── Crash Weather ──────────────────────────────────────────────── */}
      <section style={card()}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: 10 }}>
          <BilLabel {...SECTION_TITLES.crashWeather} variant="label" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: 8 }}>
          <span style={{ fontSize: '2rem' }}>{weather.icon}</span>
          <div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: weather.color,
                letterSpacing: '0.03em',
              }}
            >
              {weather.label}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 2 }}>
              {weather.desc}
            </div>
          </div>
        </div>

        {isPhaseShift && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 7,
              padding: '4px 10px',
              fontSize: '0.7rem',
              color: '#fbbf24',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '0.8rem' }}>&#9888;</span>
            Regime shift detected — treat signals with caution
          </div>
        )}
      </section>
    </div>
  )
}
