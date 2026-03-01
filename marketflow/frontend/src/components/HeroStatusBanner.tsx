import { readCacheJson } from '@/lib/readCacheJson'
import type { BiText } from '@/lib/lang'

// ── Types ────────────────────────────────────────────────────────────────────

type MsPill = {
  value?: string | number | null
  label: string
  color: string
  detail: string
  avg10d?: number | null
  delta5d?: number | null
  vol_pct?: number | null
  var95?: number | null
  pct_from_sma200?: number | null
}

type MarketStateCache = {
  data_date?: string | null
  phase: MsPill
  gate: MsPill
  risk: MsPill
  trend: MsPill
  vr: MsPill
}

type TapeItem = {
  symbol: string
  name: string
  last: number
  chg: number
  chg_pct: number
  spark_1d: number[]
}

type MarketTapeCache = {
  data_date?: string | null
  items: TapeItem[]
}

type OverviewCache = {
  market_phase?: string | null
  gate_score?: number | null
  risk_trend?: string | null
  risk_level?: string | null
  gate_delta5d?: number | null
  phase_shift_flag?: number | null
  pct_from_sma200?: number | null
}

type ActionCache = {
  exposure_guidance?: {
    action_label?: string | null
    exposure_band?: string | null
  }
}

const MS_FALLBACK: MarketStateCache = {
  phase: { label: '--', color: '#6b7280', detail: '' },
  gate:  { label: '--', color: '#6b7280', detail: '' },
  risk:  { label: '--', color: '#6b7280', detail: '' },
  trend: { label: '--', color: '#6b7280', detail: '' },
  vr:    { label: '--', color: '#6b7280', detail: '' },
}

// ── Palette (institutional terminal) ─────────────────────────────────────────

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  shock:      '#D32F2F',
  neutral:    '#5E6A75',
  accent:     '#0A5AFF',   // institutional deep blue
} as const

// ── Helpers ──────────────────────────────────────────────────────────────────

type RegimeInfo = { label: string; color: string; bg: string; bgMid: string }

function resolveRegime(
  phaseVal: string | null | undefined,
  phaseShift: number | null | undefined,
  riskLevel: string | null | undefined,
): RegimeInfo {
  const p = String(phaseVal || '').toUpperCase()
  const isShock = riskLevel === 'HIGH' && p === 'BEAR'
  const isAccel = p === 'BULL' && phaseShift === 1
  if (isShock) return { label: 'SHOCK',        color: C.shock,      bg: 'rgba(211,47,47,0.16)',  bgMid: 'rgba(211,47,47,0.06)' }
  if (isAccel) return { label: 'ACCELERATION', color: C.accent,     bg: 'rgba(10,90,255,0.14)',  bgMid: 'rgba(10,90,255,0.05)' }
  if (p === 'BULL')    return { label: 'BULL MARKET',  color: C.bull,       bg: 'rgba(0,200,83,0.13)',   bgMid: 'rgba(0,200,83,0.04)' }
  if (p === 'BEAR')    return { label: 'DEFENSIVE',    color: C.defensive,  bg: 'rgba(255,112,67,0.13)', bgMid: 'rgba(255,112,67,0.04)' }
  if (p === 'NEUTRAL') return { label: 'TRANSITION',   color: C.transition, bg: 'rgba(255,179,0,0.13)',  bgMid: 'rgba(255,179,0,0.04)' }
  return { label: p || '--', color: C.neutral, bg: 'rgba(94,106,117,0.10)', bgMid: 'rgba(94,106,117,0.03)' }
}

function resolveVolMode(vix: number | null): { label: string; color: string } {
  if (vix === null) return { label: 'N/A',       color: C.neutral }
  if (vix > 25)    return { label: 'EXPANSION',  color: C.defensive }
  if (vix < 15)    return { label: 'COMPRESSION',color: C.bull }
  return              { label: 'NORMAL',       color: C.transition }
}

function resolveLiquidity(delta: number | null | undefined): { label: string; color: string } {
  if (typeof delta !== 'number') return { label: 'N/A',       color: C.neutral }
  if (delta > 2)                 return { label: 'EXPANDING', color: C.bull }
  if (delta < -5)                return { label: 'TIGHTENING',color: C.defensive }
  return                                { label: 'NEUTRAL',   color: C.transition }
}

/** Analytical structural summary — returns bilingual { ko, en } */
function buildSubtitle(opts: {
  regimeLabel: string
  gateScore: number | null
  pctFromSma200: number | null
  riskLevel: string | null
  riskTrend: string | null
  gateDelta: number | null
  vixLast: number | null
}): BiText {
  const { gateScore, pctFromSma200, riskLevel, riskTrend, gateDelta } = opts

  const trendAbove    = pctFromSma200 !== null && pctFromSma200 > 0
  const trendBelow    = pctFromSma200 !== null && pctFromSma200 < 0
  const trendNear     = pctFromSma200 !== null && Math.abs(pctFromSma200) <= 1
  const structStrong  = gateScore !== null && gateScore > 60
  const structWeak    = gateScore !== null && gateScore < 40
  const narrowing     = gateScore !== null && gateDelta !== null && gateScore > 50 && gateDelta < -3
  const riskDet       = riskTrend === 'Deteriorating'
  const riskImp       = riskTrend === 'Improving'

  if (trendBelow && structWeak && riskDet)
    return { ko: '장기 추세 하단에서 구조 악화 — 리스크 환경 침체 중', en: 'Structure deteriorating below long-term trend — risk conditions worsening.' }
  if (trendBelow && structWeak)
    return { ko: '장기 추세 하단에서 시장 구조 약화 중', en: 'Structure weakening below long-term trend.' }
  if (trendBelow && riskDet)
    return { ko: '장기 추세 하단, 리스크 추세 동시 악화 중', en: 'Below long-term trend while risk trend deteriorates.' }
  if (trendNear && structWeak)
    return { ko: '장기 추세 근접, 시장 구조 약화 신호', en: 'Near long-term trend with weakening market structure.' }
  if (trendAbove && structStrong && riskDet)
    return { ko: '추세 유지 중이나 리스크 환경 악화 — 모니터링 필요', en: 'Trend intact while risk environment deteriorates — monitor conditions.' }
  if (trendAbove && narrowing && !riskDet)
    return { ko: '장기 추세 상단, 참여 폭 축소 중', en: 'Above long-term trend with narrowing participation.' }
  if (trendAbove && structStrong && riskImp)
    return { ko: '장기 추세 상단, 구조 건전, 리스크 개선 중', en: 'Above long-term trend, structure supportive, risk improving.' }
  if (trendAbove && structStrong)
    return { ko: '장기 추세 상단, 시장 구조 우호적', en: 'Above long-term trend with supportive market structure.' }
  if (trendAbove && structWeak)
    return { ko: '장기 추세 상단이나 시장 구조 약화 신호', en: 'Above long-term trend but market structure weakening.' }
  if (trendAbove && riskDet)
    return { ko: '장기 추세 상단, 리스크 레짐 악화 중', en: 'Above long-term trend with deteriorating risk regime.' }
  if (trendAbove) {
    const rl  = riskLevel === 'LOW' ? '낮은' : riskLevel === 'MEDIUM' ? '보통' : '높은'
    const rle = riskLevel === 'LOW' ? 'low'  : riskLevel === 'MEDIUM' ? 'moderate' : 'elevated'
    return { ko: `장기 추세 상단, ${rl} 리스크 레짐`, en: `Above long-term trend with ${rle} risk regime.` }
  }
  if (trendBelow)
    return { ko: '장기 추세 하단 — 주의 필요', en: 'Below long-term trend — exercise caution.' }
  if (gateScore !== null)
    return { ko: `게이트 ${gateScore.toFixed(0)} — 추세 확인 대기 중`, en: `Gate ${gateScore.toFixed(0)} — awaiting trend confirmation.` }
  return { ko: '데이터 대기 중 — 파이프라인 실행 필요', en: 'Awaiting data — run pipeline to update.' }
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function HeroStatusBanner() {
  const [ms, tape, overview, action] = await Promise.all([
    readCacheJson<MarketStateCache>('market_state.json', MS_FALLBACK),
    readCacheJson<MarketTapeCache>('market_tape.json', { items: [] }),
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<ActionCache>('action_snapshot.json', {}),
  ])

  const vixItem   = tape.items.find((i) => i.symbol === 'VIX')
  const vixLast   = typeof vixItem?.last === 'number' ? vixItem.last : null
  const regime    = resolveRegime(
    String(ms.phase.value ?? ms.phase.label),
    overview.phase_shift_flag,
    String(ms.risk.value ?? ''),
  )
  const volMode   = resolveVolMode(vixLast)
  const liquidity = resolveLiquidity(overview.gate_delta5d)

  const riskTrend      = overview.risk_trend || null
  const riskTrendColor = riskTrend === 'Improving' ? C.bull : riskTrend === 'Deteriorating' ? C.defensive : C.neutral
  const exposureBand   = action.exposure_guidance?.exposure_band || null
  const isPhaseShift   = overview.phase_shift_flag === 1

  const gateScore = typeof overview.gate_score === 'number' ? overview.gate_score : null
  const gateAvg   = typeof ms.gate.avg10d  === 'number' ? ms.gate.avg10d  : null
  const gateDelta = typeof ms.gate.delta5d === 'number'
    ? ms.gate.delta5d
    : typeof overview.gate_delta5d === 'number' ? overview.gate_delta5d : null
  const pctFromSma200 = typeof ms.trend.pct_from_sma200 === 'number'
    ? ms.trend.pct_from_sma200
    : typeof overview.pct_from_sma200 === 'number' ? overview.pct_from_sma200 : null

  const subtitle = buildSubtitle({
    regimeLabel: regime.label,
    gateScore,
    pctFromSma200,
    riskLevel: overview.risk_level ?? null,
    riskTrend,
    gateDelta,
    vixLast,
  })

  const indexOrder = ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX']
  const indexItems = indexOrder
    .map((sym) => tape.items.find((i) => i.symbol === sym))
    .filter((x): x is TapeItem => x !== undefined)

  const actionPills = [
    { key: 'RISK', val: ms.risk.label, color: ms.risk.color },
    ...(exposureBand ? [{ key: 'EXPOSURE', val: exposureBand, color: C.accent }] : []),
  ]
  const evidencePills = [
    ...(riskTrend ? [{ key: 'R.TREND', val: riskTrend, color: riskTrendColor }] : []),
    { key: 'LIQUIDITY', val: liquidity.label, color: liquidity.color },
    { key: 'VOL', val: volMode.label, color: volMode.color },
  ]

  return (
    <section
      style={{
        // 3% regime-color tint over dark base — no gradient wash
        background: `linear-gradient(135deg, ${regime.color}08 0%, transparent 70%), #0B0F14`,
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 18,
        padding: '40px 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* ── Row 1: Regime label + underline + REGIME SHIFT chip ──────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* ▌ REGIME LABEL — 48px, institutional terminal anchor */}
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '48px',
                  fontWeight: 700,
                  color: regime.color,
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {regime.label}
              </h1>
              {/* 2px underline spanning text width */}
              <div
                style={{
                  height: 2,
                  background: regime.color,
                  borderRadius: 1,
                  marginTop: 4,
                  opacity: 0.7,
                }}
              />
            </div>
            {isPhaseShift && (
              <span
                style={{
                  fontSize: '0.6rem',
                  color: '#fbbf24',
                  background: 'rgba(251,191,36,0.14)',
                  border: '1px solid rgba(251,191,36,0.40)',
                  borderRadius: 5,
                  padding: '3px 8px',
                  letterSpacing: '0.07em',
                  fontWeight: 700,
                  alignSelf: 'center',
                }}
              >
                REGIME SHIFT
              </span>
            )}
          </div>

          {/* ▌ Subtitle — bilingual stacked, 1-line clamp each with hover tooltip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <p
              title={subtitle.ko}
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#9ca3af',
                letterSpacing: '0.005em',
                lineHeight: 1.45,
                fontWeight: 500,
                maxWidth: 560,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              {subtitle.ko}
            </p>
            <p
              title={subtitle.en}
              style={{
                margin: 0,
                fontSize: '0.78rem',
                color: 'rgba(156,163,175,0.75)',
                letterSpacing: '0.005em',
                lineHeight: 1.4,
                fontWeight: 400,
                maxWidth: 560,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              {subtitle.en}
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Status pills ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {actionPills.map((pill) => (
            <span
              key={pill.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: pill.color + '22',
                border: `1px solid ${pill.color}52`,
                borderRadius: 999,
                padding: '3px 10px',
              }}
            >
              <span style={{ fontSize: '0.64rem', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                {pill.key}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: pill.color }}>
                {pill.val}
              </span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {evidencePills.map((pill) => (
            <span
              key={pill.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: pill.color + '10',
                border: `1px solid ${pill.color}24`,
                borderRadius: 999,
                padding: '2px 8px',
                opacity: 0.95,
              }}
            >
              <span style={{ fontSize: '0.62rem', color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {pill.key}
              </span>
              <span style={{ fontSize: '0.76rem', fontWeight: 650, color: pill.color }}>
                {pill.val}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Row 3: Gate sub-line ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#9ca3af', flexWrap: 'wrap' }}>
        <span>
          Gate{' '}
          <b style={{ color: ms.gate.color, fontSize: '0.875rem' }}>{ms.gate.label}</b>
        </span>
        {gateAvg !== null && (
          <span style={{ color: '#6b7280' }}>10d avg {gateAvg.toFixed(1)}</span>
        )}
        {gateDelta !== null && (
          <span style={{ color: gateDelta >= 0 ? C.bull : C.defensive, fontWeight: 600 }}>
            {'\u03945d '}{gateDelta >= 0 ? '+' : ''}{gateDelta.toFixed(1)}
          </span>
        )}
        {ms.data_date && (
          <span style={{ marginLeft: 'auto', color: '#374151', fontSize: '0.65rem' }}>
            as of {ms.data_date}
          </span>
        )}
      </div>

      {/* ── Row 4: Index strip — compact pill badges ─────────────────── */}
      {indexItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.3rem',
            flexWrap: 'wrap',
            paddingTop: '0.65rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {indexItems.map((item) => {
            const isVix      = item.symbol === 'VIX'
            const isPositive = isVix ? item.chg_pct < 0 : item.chg_pct >= 0
            const chgColor   = isPositive ? C.bull : C.defensive
            const chgStr     = `${item.chg_pct >= 0 ? '+' : ''}${(item.chg_pct || 0).toFixed(2)}%`
            return (
              <span
                key={item.symbol}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: `${chgColor}10`,
                  border: `1px solid ${chgColor}28`,
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d1d5db' }}>
                  {item.symbol}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: chgColor }}>
                  {chgStr}
                </span>
              </span>
            )
          })}
          {pctFromSma200 !== null && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: `${ms.trend.color}10`,
                border: `1px solid ${ms.trend.color}28`,
                borderRadius: 999,
                padding: '3px 10px',
              }}
            >
              <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>SMA200</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: ms.trend.color }}>
                {pctFromSma200 >= 0 ? '+' : ''}{pctFromSma200.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
