import fs from 'fs/promises'
import path from 'path'
import { readCacheJson } from '@/lib/readCacheJson'
import BilLabel from '@/components/BilLabel'
import { SECTION_TITLES } from '@/lib/text'

// ── Types ────────────────────────────────────────────────────────────────────

type OverviewCache = {
  gate_score?: number | null
  market_phase?: string | null
  gate_avg10d?: number | null
  gate_delta5d?: number | null
  phase_shift_flag?: number | null
}

type TrendSnapshot = {
  qqq_close?: number | null
  sma200?: number | null
  dist_pct?: number | null
  sma50?: number | null
  sma20?: number | null
}

type BreadthGreed = {
  greed_proxy?: number | null
  label?: string | null
  explain?: string | null
}

type HealthSnapshot = {
  data_date?: string | null
  trend?: TrendSnapshot
  breadth_greed?: BreadthGreed
}

type SectorPerfItem = {
  symbol: string
  name: string
  price?: number | null
  change_1d?: number | null
  change_1w?: number | null
  change_1m?: number | null
  change_3m?: number | null
  rank_3m?: number | null
}

type SectorRotationCache = {
  phase?: string | null
  phase_label?: string | null
  phase_color?: string | null
  leading_sectors?: string[]
  lagging_sectors?: string[]
  sector_perf?: SectorPerfItem[]
}

// ── Data helpers ──────────────────────────────────────────────────────────────

async function readOutputJson<T>(filename: string, fallback: T): Promise<T> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
  ]
  for (const c of candidates) {
    try { return JSON.parse(await fs.readFile(c, 'utf-8')) as T } catch { /* next */ }
  }
  return fallback
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  neutral:    '#5E6A75',
} as const

function card(extra?: object) {
  return {
    background: '#11161C',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '1rem 1.1rem',
    ...extra,
  } as const
}

function gateScoreColor(score: number): string {
  if (score > 60) return C.bull
  if (score > 40) return C.transition
  return C.defensive
}

// Muted segment colors — no neon
const SEGMENT_COLORS = ['#dc2626', '#f97316', '#d97706', '#84cc16', '#22c55e']

// ── Component ────────────────────────────────────────────────────────────────

export default async function StructurePanel() {
  const [overview, health, sectorRotation] = await Promise.all([
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<HealthSnapshot>('health_snapshot.json', {}),
    readOutputJson<SectorRotationCache>('sector_rotation.json', { sector_perf: [] }),
  ])

  const gateScore   = typeof overview.gate_score  === 'number' ? overview.gate_score  : null
  const gateAvg10d  = typeof overview.gate_avg10d === 'number' ? overview.gate_avg10d : null
  const greed       = health.breadth_greed || {}
  const trend       = health.trend || {}
  const greedVal    = typeof greed.greed_proxy === 'number' ? greed.greed_proxy : null
  const sectorPerf  = sectorRotation.sector_perf || []
  const sortedSectors = [...sectorPerf].sort((a, b) => (a.rank_3m ?? 99) - (b.rank_3m ?? 99))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ color: 'var(--text-primary)', fontSize: '1.02rem', letterSpacing: '0.02em' }}>
        <BilLabel {...SECTION_TITLES.structure} variant="label" />
      </div>

      {/* ── Regime Gauge ─────────────────────────────────────────────── */}
      <section style={card()}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: 10 }}>
          <BilLabel {...SECTION_TITLES.regimeGauge} variant="label" />
        </div>

        {/* Segmented bar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              const segMin = i * 20
              const segMax = segMin + 20
              const active = gateScore !== null && gateScore >= segMin && (i === 4 ? true : gateScore < segMax)
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: SEGMENT_COLORS[i],
                    opacity: active ? 1 : 0.28,
                    borderRadius:
                      i === 0 ? '4px 0 0 4px' : i === 4 ? '0 4px 4px 0' : 0,
                  }}
                />
              )
            })}
          </div>
          {/* Position marker */}
          {gateScore !== null && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(99, Math.max(1, gateScore))}%`,
                top: -4,
                transform: 'translateX(-50%)',
                width: 3,
                height: 18,
                background: '#ffffff',
                borderRadius: 2,
                boxShadow: '0 0 5px rgba(255,255,255,0.45)',
              }}
            />
          )}
          {/* Scale labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.6rem',
              color: '#4b5563',
              marginTop: 6,
            }}
          >
            <span>BEAR</span>
            <span>DEF</span>
            <span>NEUT</span>
            <span>BULL</span>
            <span>ACCEL</span>
          </div>
        </div>

        {/* Score + avg — Primary Metric: ~20px */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div
              style={{
                fontSize: '1.9rem',
                fontWeight: 800,
                color: gateScore !== null ? gateScoreColor(gateScore) : '#6b7280',
                lineHeight: 1,
              }}
            >
              {gateScore !== null ? gateScore.toFixed(1) : '--'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>GATE SCORE</div>
          </div>
          {gateAvg10d !== null && (
            <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#6b7280' }}>
              <div>10d avg</div>
              <div style={{ color: '#9ca3af', fontWeight: 700, fontSize: '0.8rem' }}>{gateAvg10d.toFixed(1)}</div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color:
                    gateScore !== null && gateScore > gateAvg10d ? C.bull : C.defensive,
                  marginTop: 1,
                }}
              >
                {gateScore !== null
                  ? gateScore > gateAvg10d
                    ? '\u2191 Above avg'
                    : '\u2193 Below avg'
                  : ''}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Breadth & Sentiment ──────────────────────────────────────── */}
      <section style={card()}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em', marginBottom: 10 }}>
          <BilLabel {...SECTION_TITLES.breadth} variant="label" />
        </div>

        {/* Greed/Fear bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{greed.label || 'Greed Proxy'}</span>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#e5e7eb', lineHeight: 1 }}>
              {greedVal !== null ? greedVal.toFixed(0) : '--'}
              <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 400, marginLeft: 2 }}>/100</span>
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${greedVal ?? 0}%`,
                background:
                  greedVal !== null
                    ? greedVal > 60
                      ? C.bull
                      : greedVal < 30
                      ? C.defensive
                      : C.transition
                    : '#374151',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.6rem',
              color: '#4b5563',
              marginTop: 4,
            }}
          >
            <span>Fear</span>
            <span>Neutral</span>
            <span>Greed</span>
          </div>
        </div>

        {/* QQQ metric pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {[
            {
              label: 'vs SMA200',
              val:
                typeof trend.dist_pct === 'number'
                  ? `${trend.dist_pct >= 0 ? '+' : ''}${trend.dist_pct.toFixed(2)}%`
                  : null,
              color:
                typeof trend.dist_pct === 'number'
                  ? trend.dist_pct >= 0
                    ? C.bull
                    : C.defensive
                  : '#6b7280',
            },
            {
              label: 'SMA50',
              val: typeof trend.sma50 === 'number' ? trend.sma50.toFixed(0) : null,
              color: '#93c5fd',
            },
            {
              label: 'SMA20',
              val: typeof trend.sma20 === 'number' ? trend.sma20.toFixed(0) : null,
              color: '#86efac',
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '6px 7px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: m.color }}>
                {m.val ?? '--'}
              </div>
            </div>
          ))}
        </div>

        {greed.explain && (
          <div style={{ marginTop: 8, fontSize: '0.68rem', color: '#6b7280', lineHeight: 1.4 }}>
            {String(greed.explain)
              .split('\n')
              .slice(0, 2)
              .map((line, i) => (
                <div key={i}>{line}</div>
              ))}
          </div>
        )}
      </section>

      {/* ── Sector Rotation Tiles ──────────────────────────────────────── */}
      <section style={card()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.1em' }}>
            <BilLabel {...SECTION_TITLES.sectorRotation} variant="label" />
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              color: sectorRotation.phase_color || '#6b7280',
              fontWeight: 600,
            }}
          >
            {sectorRotation.phase_label || sectorRotation.phase || '--'}
          </span>
        </div>

        {sortedSectors.length === 0 ? (
          <div style={{ color: '#374151', fontSize: '0.75rem' }}>
            Run build_sector_rotation_cache.py
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
              gap: 4,
            }}
          >
            {sortedSectors.slice(0, 11).map((s) => {
              const isLeading = (sectorRotation.leading_sectors || []).includes(s.symbol)
              const isLagging = (sectorRotation.lagging_sectors || []).includes(s.symbol)
              const tileColor = isLeading ? C.bull : isLagging ? C.defensive : '#6b7280'
              // Text-only coloring — no colored backgrounds per tile
              const tileBorder = isLeading
                ? `1px solid ${tileColor}45`
                : isLagging
                ? `1px solid ${tileColor}35`
                : '1px solid rgba(255,255,255,0.04)'
              const ret1d = typeof s.change_1d === 'number' ? s.change_1d : null
              const ret3m = typeof s.change_3m === 'number' ? s.change_3m : null
              return (
                <div
                  key={s.symbol}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: tileBorder,
                    borderRadius: 8,
                    padding: '6px 6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tileColor }}>
                    {s.symbol}
                  </div>
                  {ret1d !== null && (
                    <div
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: ret1d >= 0 ? C.bull : C.defensive,
                        marginTop: 1,
                      }}
                    >
                      {ret1d >= 0 ? '+' : ''}
                      {ret1d.toFixed(1)}%
                    </div>
                  )}
                  {ret3m !== null && (
                    <div style={{ fontSize: '0.58rem', fontWeight: 400, color: '#4b5563', marginTop: 1 }}>
                      3M {ret3m >= 0 ? '+' : ''}
                      {ret3m.toFixed(0)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
