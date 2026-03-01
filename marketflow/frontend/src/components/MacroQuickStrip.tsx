import { Fragment } from 'react'
import { readCacheJson } from '@/lib/readCacheJson'
import BilLabel from '@/components/BilLabel'

// ── Types ─────────────────────────────────────────────────────────────────────

type TapeItem = {
  symbol: string
  name?: string
  last: number
  chg?: number
  chg_pct: number
  spark_1d: number[]
}

type MarketTapeCache = {
  data_date?: string
  items: TapeItem[]
}

type BreadthGreed = {
  greed_proxy?: number | null
  label?: string | null
  as_of_date?: string | null
}

type HealthSnapshot = {
  data_date?: string | null
  breadth_greed?: BreadthGreed
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bull:       '#00C853',
  defensive:  '#FF7043',
  neutral:    '#5E6A75',
  text:       '#9ca3af',
  muted:      '#4b5563',
  accent:     '#60a5fa',
} as const

// ── Sparkline ─────────────────────────────────────────────────────────────────

function MiniSpark({ pts, inverted }: { pts: number[]; inverted?: boolean }) {
  if (!pts || pts.length < 2) {
    return <svg width={44} height={18} />
  }
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const W = 44
  const H = 18
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W)
  const ys = pts.map((v) => H - ((v - min) / range) * (H - 2) - 1)
  const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const up = inverted ? last < first : last >= first
  const color = up ? C.bull : C.defensive
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  )
}

// ── Strip card ─────────────────────────────────────────────────────────────────

function StripCard({
  symbol,
  last,
  chgPct,
  spark,
  inverted,
  label,
}: {
  symbol: string
  last: number | null
  chgPct: number | null
  spark: number[]
  inverted?: boolean
  label?: string
}) {
  const up = inverted
    ? chgPct !== null && chgPct < 0
    : chgPct !== null && chgPct >= 0
  const chgColor = chgPct === null ? C.muted : up ? C.bull : C.defensive

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.2rem 0.6rem',
        flexShrink: 0,
      }}
    >
      {/* Symbol + label */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 42 }}>
        <span
          style={{
            fontSize: '0.76rem',
            fontWeight: 700,
            color: '#e5e7eb',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          {symbol}
        </span>
        {label && (
          <span style={{ fontSize: '0.68rem', color: C.muted, lineHeight: 1.25 }}>
            {label}
          </span>
        )}
      </div>

      {/* Value + chg% */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 54 }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e5e7eb', lineHeight: 1.2 }}>
          {last !== null ? last.toFixed(last >= 100 ? 1 : 2) : '--'}
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: chgColor, lineHeight: 1.15 }}>
          {chgPct !== null
            ? `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
            : '--'}
        </span>
      </div>

      {/* Sparkline */}
      <MiniSpark pts={spark} inverted={inverted} />
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: 'rgba(255,255,255,0.07)',
        margin: '0 0.25rem',
        flexShrink: 0,
      }}
    />
  )
}

function GroupLabelCell({ ko, en }: { ko: string; en: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.2rem 0.55rem 0.2rem 0.6rem',
        minWidth: 64,
        flexShrink: 0,
      }}
    >
      <div style={{ color: C.text }}>
        <BilLabel ko={ko} en={en} variant="micro" />
      </div>
    </div>
  )
}

// ── Fear/Greed tile ────────────────────────────────────────────────────────────

function FearGreedCard({
  value,
  label,
  stale,
}: {
  value: number | null
  label: string | null
  stale?: boolean
}) {
  const color =
    value === null
      ? C.muted
      : value > 65
      ? C.bull
      : value < 35
      ? C.defensive
      : '#FFB300'
  const displayLabel =
    label ||
    (value === null
      ? 'N/A'
      : value > 65
      ? 'Greed'
      : value < 35
      ? 'Fear'
      : 'Neutral')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.2rem 0.6rem',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.68rem', color: C.muted, letterSpacing: '0.06em', lineHeight: 1.25 }}>
          <BilLabel ko="공포/탐욕" en="FEAR/GREED" variant="micro" />
        </span>
        <span style={{ fontSize: '0.74rem', color, fontWeight: 600, lineHeight: 1.2 }}>
          {displayLabel}
        </span>
        {stale && (
          <span style={{ fontSize: '0.48rem', color: '#374151', lineHeight: 1.1, marginTop: 1 }}>
            data may be delayed
          </span>
        )}
      </div>
      <span style={{ fontSize: '1.15rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value !== null ? value.toFixed(0) : '--'}
      </span>
    </div>
  )
}

// ── Groups config ──────────────────────────────────────────────────────────────

const GROUPS: { syms: string[]; inverted?: boolean; label: { ko: string; en: string } }[] = [
  { syms: ['SPY', 'QQQ', 'DIA', 'IWM'], label: { ko: '지수', en: 'INDEX' } },
  { syms: ['VIX'], inverted: true, label: { ko: '변동성', en: 'VOL' } },
  { syms: ['US10Y', 'US2Y', 'DXY'], label: { ko: '거시', en: 'MACRO' } },
  { syms: ['BTCUSD', 'ETHUSD'], label: { ko: '암호화폐', en: 'CRYPTO' } },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default async function MacroQuickStrip() {
  const [tape, health] = await Promise.all([
    readCacheJson<MarketTapeCache>('market_tape.json', { items: [] }),
    readCacheJson<HealthSnapshot>('health_snapshot.json', {}),
  ])

  const tapeMap = new Map<string, TapeItem>()
  for (const item of tape.items || []) {
    tapeMap.set(item.symbol, item)
  }

  const greedProxy  = health.breadth_greed?.greed_proxy ?? null
  const greedLabel  = health.breadth_greed?.label ?? null
  const greedAsOf   = health.breadth_greed?.as_of_date ?? null
  const healthDate  = health.data_date ?? null
  // Stale when the sentiment source date is older than the latest data date
  const greedStale  = greedAsOf !== null && healthDate !== null && greedAsOf < healthDate

  // Build visible groups (only groups with ≥1 matching symbol)
  const visibleGroups = GROUPS.map((g) => ({
    inverted: g.inverted,
    label: g.label,
    items: g.syms.map((s) => tapeMap.get(s)).filter(Boolean) as TapeItem[],
  })).filter((g) => g.items.length > 0)

  const hasSentiment = greedProxy !== null

  // If nothing to show, render nothing
  if (visibleGroups.length === 0 && !hasSentiment) return null

  return (
    <div
      className="relative"
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mf-macro-edge-fade left" />
      <div className="mf-macro-edge-fade right" />
      <div
        className="mf-hide-scrollbar overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            minWidth: 'max-content',
            height: 44,
          }}
        >
          {visibleGroups.map((g, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <Divider />}
              <div style={{ scrollSnapAlign: 'start' as const }}>
                <GroupLabelCell ko={g.label.ko} en={g.label.en} />
              </div>
              {g.items.map((item) => (
                <div key={item.symbol} style={{ scrollSnapAlign: 'start' as const }}>
                  <StripCard
                    symbol={item.symbol}
                    last={item.last}
                    chgPct={item.chg_pct}
                    spark={item.spark_1d || []}
                    inverted={g.inverted}
                  />
                </div>
              ))}
            </Fragment>
          ))}

          {/* Fear/Greed sentinel */}
          {hasSentiment && (
            <>
              <Divider />
              <div style={{ scrollSnapAlign: 'start' as const }}>
                <FearGreedCard value={greedProxy} label={greedLabel} stale={greedStale} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
