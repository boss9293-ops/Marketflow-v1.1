'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Tone = 'neutral' | 'info' | 'good' | 'watch' | 'warn' | 'danger'

type ToneStyles = {
  border: string
  bg: string
  fg: string
  accent: string
}

const TONE_STYLES: Record<Tone, ToneStyles> = {
  neutral: {
    border: 'rgba(148, 163, 184, 0.16)',
    bg: 'rgba(15, 23, 42, 0.86)',
    fg: '#e2e8f0',
    accent: '#94a3b8',
  },
  info: {
    border: 'rgba(56, 189, 248, 0.28)',
    bg: 'rgba(8, 22, 38, 0.96)',
    fg: '#e0f2fe',
    accent: '#7dd3fc',
  },
  good: {
    border: 'rgba(34, 197, 94, 0.28)',
    bg: 'rgba(9, 25, 18, 0.96)',
    fg: '#dcfce7',
    accent: '#86efac',
  },
  watch: {
    border: 'rgba(245, 158, 11, 0.30)',
    bg: 'rgba(34, 24, 8, 0.96)',
    fg: '#fef3c7',
    accent: '#fbbf24',
  },
  warn: {
    border: 'rgba(249, 115, 22, 0.30)',
    bg: 'rgba(40, 17, 6, 0.96)',
    fg: '#ffedd5',
    accent: '#fdba74',
  },
  danger: {
    border: 'rgba(244, 63, 94, 0.34)',
    bg: 'rgba(35, 8, 16, 0.96)',
    fg: '#ffe4e6',
    accent: '#fda4af',
  },
}

type SoxxPlaybackPoint = {
  d: string
  qqq_n?: number | null
  soxx_n?: number | null
  ma50_n?: number | null
  ma200_n?: number | null
  tqqq_n?: number | null
  soxl_n?: number | null
  score?: number | null
  level?: number | null
  state?: string | null
  pool_pct?: number | null
  exposure_pct?: number | null
  bh_10k?: number | null
  vr_10k?: number | null
  in_ev?: boolean
  dd_pct?: number | null
  tqqq_dd?: number | null
}

type SoxxPlaybackEvent = {
  id: number
  name: string
  start: string
  end: string
  risk_on?: string | null
  risk_off?: string | null
  shock_dates?: string[]
  struct_dates?: string[]
  stats?: {
    soxx_trough?: number | null
    soxl_trough?: number | null
    bh_trough?: number | null
    vr_trough?: number | null
    bh_final?: number | null
    vr_final?: number | null
    capital_saved_pct?: number | null
  }
  playback: SoxxPlaybackPoint[]
}

export type SoxxSurvivalPlaybackArchive = {
  run_id?: string
  events?: SoxxPlaybackEvent[]
}

function toneStyles(tone: Tone): ToneStyles {
  return TONE_STYLES[tone] ?? TONE_STYLES.neutral
}

function toneFromState(state: string | null | undefined): Tone {
  const upper = String(state ?? '').toUpperCase()
  if (upper === 'NORMAL') return 'good'
  if (upper === 'GRINDING') return 'warn'
  if (upper === 'STRUCTURAL' || upper === 'SHOCK') return 'danger'
  if (upper === 'CAUTION') return 'watch'
  return 'neutral'
}

function toneFromSavedPct(value: number | null | undefined): Tone {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'
  if (value >= 60) return 'good'
  if (value >= 35) return 'info'
  if (value >= 15) return 'watch'
  return 'warn'
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '--'
  return value.slice(5)
}

function formatDate(value: string | null | undefined): string {
  return value ?? '--'
}

function Badge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: Tone
}) {
  const styles = toneStyles(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.fg,
        padding: '0.34rem 0.7rem',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail?: string
  tone?: Tone
}) {
  const styles = toneStyles(tone)
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        padding: '0.85rem 0.95rem',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontSize: '0.67rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: styles.accent, fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.16rem', fontWeight: 900, color: styles.fg, lineHeight: 1.1 }}>{value}</div>
      {detail ? <div style={{ fontSize: '0.78rem', lineHeight: 1.55, color: '#cbd5e1' }}>{detail}</div> : null}
    </div>
  )
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        borderRadius: 22,
        border: '1px solid rgba(148, 163, 184, 0.14)',
        background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.98), rgba(7, 11, 18, 0.98))',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(56, 189, 248, 0.04) inset',
        padding: '1.1rem 1.1rem 1.15rem',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
          {eyebrow}
        </div>
        <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.08rem', color: '#f8fafc', fontWeight: 900 }}>{title}</h3>
        {description ? (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: 1.7, color: '#94a3b8' }}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function samplePoints(points: SoxxPlaybackPoint[], desired = 10): SoxxPlaybackPoint[] {
  if (points.length <= desired) return points
  const out: SoxxPlaybackPoint[] = []
  const seen = new Set<string>()
  const step = (points.length - 1) / Math.max(1, desired - 1)
  for (let i = 0; i < desired; i += 1) {
    const idx = Math.min(points.length - 1, Math.round(i * step))
    const point = points[idx]
    if (!seen.has(point.d)) {
      seen.add(point.d)
      out.push(point)
    }
  }
  if (out[out.length - 1]?.d !== points[points.length - 1]?.d) {
    out.push(points[points.length - 1])
  }
  return out
}

function buildStateMix(points: SoxxPlaybackPoint[]) {
  const counts = new Map<string, number>()
  for (const point of points) {
    const state = String(point.state ?? 'UNKNOWN').toUpperCase()
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
}

function buildPlaybackChartRows(points: SoxxPlaybackPoint[]) {
  return points.map((point) => ({
    d: point.d,
    state: point.state ?? 'UNKNOWN',
    soxx: point.soxx_n ?? point.qqq_n ?? null,
    soxl: point.soxl_n ?? point.tqqq_n ?? null,
    ma50: point.ma50_n ?? null,
    ma200: point.ma200_n ?? null,
    bh: point.bh_10k ?? null,
    vr: point.vr_10k ?? null,
    pool: point.pool_pct ?? null,
    exposure: point.exposure_pct ?? null,
    dd: point.dd_pct ?? null,
  }))
}

function PlaybackChartTooltip({
  active,
  payload,
  label,
  variant,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null }>
  label?: string
  variant: 'path' | 'capital'
}) {
  if (!active || !payload?.length) return null
  const title = variant === 'path' ? 'Selected path' : 'Capital curve'
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(56, 189, 248, 0.22)',
        background: 'rgba(8, 12, 20, 0.98)',
        padding: '0.8rem 0.9rem',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
        color: '#e2e8f0',
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.84rem', color: '#94a3b8' }}>{label ?? '--'}</div>
      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
        {payload.map((item) => (
          <div key={item.name ?? String(item.value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{item.name ?? 'Value'}</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#f8fafc' }}>
              {variant === 'capital' ? formatMoney(item.value) : formatNumber(item.value, 1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildSummary(archive: SoxxSurvivalPlaybackArchive) {
  const events = archive.events ?? []
  const savedValues = events
    .map((event) => event.stats?.capital_saved_pct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const bestSaved = savedValues.length ? Math.max(...savedValues) : null
  const avgSaved = savedValues.length ? savedValues.reduce((sum, value) => sum + value, 0) / savedValues.length : null
  return {
    events,
    bestSaved,
    avgSaved,
    coverageStart: events[0]?.start ?? null,
    coverageEnd: events[events.length - 1]?.end ?? null,
  }
}

export default function SoxlPlaybackPanel({ archive }: { archive: SoxxSurvivalPlaybackArchive | null }) {
  if (!archive?.events?.length) {
    return (
      <section
        style={{
          borderRadius: 22,
          border: '1px dashed rgba(148,163,184,0.24)',
          background: 'rgba(15, 23, 42, 0.76)',
          padding: '1.1rem',
          color: '#cbd5e1',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
          SOXX Cycle Playback
        </div>
        <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.35rem', color: '#f8fafc', fontWeight: 900 }}>
          Playback archive is not available yet
        </h2>
        <p style={{ margin: '0.6rem 0 0', maxWidth: 820 }}>
          Run <code style={{ background: 'rgba(15,23,42,0.9)', padding: '0.18rem 0.42rem', borderRadius: 6 }}>python marketflow/backend/scripts/build_soxx_survival_playback.py</code>
          {' '}to rebuild the SOXX survival archive, then refresh this page.
        </p>
      </section>
    )
  }

  const { events, bestSaved, avgSaved, coverageStart, coverageEnd } = buildSummary(archive)
  const initialSelectedId = events[events.length - 1]?.id ?? events[0]?.id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(() => initialSelectedId)
  const selected = events.find((event) => event.id === selectedId) ?? events[events.length - 1] ?? events[0]
  const selectedPlayback = selected?.playback ?? []
  const selectedSample = samplePoints(selectedPlayback, 10)
  const selectedChartRows = buildPlaybackChartRows(selectedPlayback)
  const stateMix = buildStateMix(selectedPlayback)
  const selectedInEvent = selectedPlayback.filter((point) => point.in_ev)
  const selectedDuration = selectedInEvent.length || selectedPlayback.length
  const [chartsReady, setChartsReady] = useState(false)

  useEffect(() => {
    setChartsReady(true)
  }, [])

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          borderRadius: 24,
          border: '1px solid rgba(56, 189, 248, 0.14)',
          background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))',
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)',
          padding: '1.15rem 1.15rem 1.2rem',
          display: 'grid',
          gap: 14,
        }}
      >
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
              Playback / Archive
            </div>
            <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.1, color: '#f8fafc', fontWeight: 950 }}>
              SOXX Cycle Archive
            </h2>
            <p style={{ margin: 0, maxWidth: 860, fontSize: '0.95rem', lineHeight: 1.75, color: '#cbd5e1' }}>
              Historical SOXX stress windows are mapped against a SOXL proxy so you can inspect timing, regime shifts, and where tactical entries would have mattered.
              The selection below lets you flip through the cycle archive without leaving the SOXL view.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Run ${archive.run_id ?? 'unknown'}`} tone="neutral" />
              <Badge label={`${events.length} events`} tone="info" />
              <Badge label={`${coverageStart ?? '--'} → ${coverageEnd ?? '--'}`} tone="neutral" />
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              border: `1px solid ${toneStyles(toneFromSavedPct(bestSaved)).border}`,
              background: toneStyles(toneFromSavedPct(bestSaved)).bg,
              padding: '1rem',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: '0.68rem', color: toneStyles(toneFromSavedPct(bestSaved)).accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Archive Scoreboard
                </div>
                <div style={{ fontSize: '2.2rem', lineHeight: 1, fontWeight: 950, color: toneStyles(toneFromSavedPct(bestSaved)).fg }}>
                  {formatPct(bestSaved, 1)}
                  <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}> best saved</span>
                </div>
              </div>
              <Badge label="SOXL tactical replay" tone="watch" />
            </div>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.65, color: '#cbd5e1' }}>
              Average capital saved across the archive: {formatPct(avgSaved, 1)}.
              {' '}This panel is a tactical replay lens, not a long-term holding signal.
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <MetricCard label="Event Count" value={`${events.length}`} detail="Crash windows archived" tone="info" />
              <MetricCard label="Coverage" value={`${coverageStart ?? '--'} → ${coverageEnd ?? '--'}`} detail="Archive span" tone="neutral" />
              <MetricCard label="Best Saved" value={formatPct(bestSaved, 1)} detail="Peak capital preservation" tone={toneFromSavedPct(bestSaved)} />
              <MetricCard label="Average Saved" value={formatPct(avgSaved, 1)} detail="Mean capital preservation" tone={toneFromSavedPct(avgSaved)} />
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        eyebrow="Replay Charts"
        title="Selected event path and capital curve"
        description="These charts turn the selected crash window into a timeline so the SOXL defense rule is easier to read at a glance."
      >
        {chartsReady ? (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(148, 163, 184, 0.14)',
                background: 'rgba(15, 23, 42, 0.82)',
                padding: '0.95rem',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                    Price / Structure
                  </div>
                  <div style={{ fontSize: '1.05rem', color: '#f8fafc', fontWeight: 900 }}>SOXX and SOXL proxy path</div>
                </div>
                <Badge label={selected?.name ?? 'Selected event'} tone="info" />
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selectedChartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="d" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatShortDate} minTickGap={28} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip content={<PlaybackChartTooltip variant="path" />} />
                    <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 11 }} />
                    <ReferenceLine y={100} stroke="rgba(148,163,184,0.45)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="soxx" name="SOXX" stroke="#7dd3fc" strokeWidth={2.4} dot={false} />
                    <Line type="monotone" dataKey="soxl" name="SOXL proxy" stroke="#f97316" strokeWidth={2.2} dot={false} />
                    <Line type="monotone" dataKey="ma50" name="MA50" stroke="#a78bfa" strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
                    <Line type="monotone" dataKey="ma200" name="MA200" stroke="#94a3b8" strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(148, 163, 184, 0.14)',
                background: 'rgba(15, 23, 42, 0.82)',
                padding: '0.95rem',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                    Capital Curve
                  </div>
                  <div style={{ fontSize: '1.05rem', color: '#f8fafc', fontWeight: 900 }}>Buy and hold vs VR defense</div>
                </div>
                <Badge label={formatPct(selected?.stats?.capital_saved_pct, 1)} tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selectedChartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="d" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatShortDate} minTickGap={28} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatMoney} />
                    <Tooltip content={<PlaybackChartTooltip variant="capital" />} />
                    <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 11 }} />
                    <Line type="monotone" dataKey="bh" name="Buy & Hold" stroke="#94a3b8" strokeWidth={2.2} dot={false} />
                    <Line type="monotone" dataKey="vr" name="VR defense" stroke="#22c55e" strokeWidth={2.4} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              minHeight: 280,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 18,
              border: '1px dashed rgba(148,163,184,0.2)',
              color: '#94a3b8',
              background: 'rgba(15,23,42,0.45)',
            }}
          >
            Chart loading...
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Archive Selection"
        title="Choose a historical SOXX shock window"
        description="Each card below opens a curated SOXX crash window with a SOXL proxy replay and capital-preservation stats."
      >
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {events.map((event) => {
            const savedTone = toneFromSavedPct(event.stats?.capital_saved_pct)
            const active = selected?.id === event.id
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                aria-pressed={active}
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 18,
                  border: `1px solid ${active ? toneStyles(savedTone).border : 'rgba(148,163,184,0.16)'}`,
                  background: active
                    ? `linear-gradient(180deg, ${toneStyles(savedTone).bg}, rgba(8,16,30,0.96))`
                    : 'rgba(15, 23, 42, 0.82)',
                  padding: '0.95rem 1rem',
                  display: 'grid',
                  gap: 8,
                  boxShadow: active ? `0 0 0 1px ${toneStyles(savedTone).border} inset, 0 18px 42px rgba(0,0,0,0.18)` : 'none',
                  transform: active ? 'translateY(-1px)' : 'none',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  color: '#e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: '0.98rem', lineHeight: 1.35, fontWeight: 900, color: '#f8fafc' }}>{event.name}</div>
                  <Badge label={active ? 'Selected' : 'Open'} tone={active ? 'good' : 'neutral'} />
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', letterSpacing: '0.06em' }}>
                  {formatDate(event.start)} → {formatDate(event.end)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Badge label={`Saved ${formatPct(event.stats?.capital_saved_pct, 1)}`} tone={savedTone} />
                  <Badge label={`SOXX trough ${formatNumber(event.stats?.soxx_trough, 1)} base100`} tone="neutral" />
                  <Badge label={`SOXL trough ${formatNumber(event.stats?.soxl_trough, 1)} base100`} tone="neutral" />
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Playback Focus"
        title={selected?.name ?? 'Selected event'}
        description={`Selected window ${formatDate(selected?.start)} → ${formatDate(selected?.end)}. This is the replay lens for the SOXL defensive rules.`}
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <MetricCard label="SOXX Trough" value={`${formatNumber(selected?.stats?.soxx_trough, 1)} base100`} detail="Selected event low" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
          <MetricCard label="SOXL Trough" value={`${formatNumber(selected?.stats?.soxl_trough, 1)} base100`} detail="Proxy leverage low" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
          <MetricCard label="Capital Saved" value={formatPct(selected?.stats?.capital_saved_pct, 1)} detail="Tactical replay vs buy-and-hold" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
          <MetricCard label="BH Final" value={formatNumber(selected?.stats?.bh_final, 0)} detail="Portfolio at window end" tone="neutral" />
          <MetricCard label="VR Final" value={formatNumber(selected?.stats?.vr_final, 0)} detail="Defensive replay at window end" tone="good" />
          <MetricCard label="Event Days" value={`${selectedDuration}`} detail="Days inside the active window" tone="info" />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
            Key Dates
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={`Risk on ${formatDate(selected?.risk_on)}`} tone="watch" />
            <Badge label={`Risk off ${formatDate(selected?.risk_off)}`} tone="good" />
            <Badge label={`Shock days ${selected?.shock_dates?.length ?? 0}`} tone="danger" />
            <Badge label={`Structural days ${selected?.struct_dates?.length ?? 0}`} tone="warn" />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
            State Mix
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stateMix.length ? stateMix.map(([state, count]) => (
              <Badge key={state} label={`${state} ${count}`} tone={toneFromState(state)} />
            )) : <Badge label="No state data" tone="neutral" />}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
            Playback Samples
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {selectedSample.map((point) => {
              const stateTone = toneFromState(point.state)
              const activeTone = point.in_ev ? stateTone : 'neutral'
              return (
                <div
                  key={point.d}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${toneStyles(activeTone).border}`,
                    background: toneStyles(activeTone).bg,
                    padding: '0.82rem 0.88rem',
                    display: 'grid',
                    gap: 6,
                    minHeight: 146,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: '0.74rem', color: toneStyles(activeTone).accent, letterSpacing: '0.08em', fontWeight: 800 }}>
                      {formatDate(point.d)}
                    </div>
                    <Badge label={point.state ?? 'UNKNOWN'} tone={activeTone} />
                  </div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 950, color: toneStyles(activeTone).fg }}>
                    SOXX {formatNumber(point.soxx_n ?? point.qqq_n, 1)}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                    SOXL proxy {formatNumber(point.soxl_n ?? point.tqqq_n, 1)} base100
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Badge label={`Pool ${formatNumber(point.pool_pct, 0)}%`} tone={point.pool_pct != null && point.pool_pct > 75 ? 'danger' : 'neutral'} />
                    <Badge label={`DD ${formatPct(point.dd_pct, 1)}`} tone={point.dd_pct != null && point.dd_pct <= -15 ? 'danger' : 'watch'} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
                    Level {formatNumber(point.level, 0)} | Score {formatNumber(point.score, 1)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href="/api/data/soxx_survival_playback.json"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.78rem',
            color: '#7dd3fc',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(125, 211, 252, 0.35)',
            paddingBottom: 2,
          }}
        >
          Open raw SOXX cycle playback JSON
        </a>
      </div>
    </section>
  )
}
