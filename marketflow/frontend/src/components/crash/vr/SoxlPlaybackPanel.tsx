'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Brush,
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

type MacroLegendItem = {
  label: string
  detail: string
  color: string
  altColor?: string
  kind: 'line' | 'dash' | 'bar'
}

type PlaybackTooltipItem = {
  name?: string
  value?: number | null
  color?: string
  fill?: string
  stroke?: string
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
  story?: {
    regime?: string | null
    summary?: string | null
    driver?: string | null
    lesson?: string | null
  }
  risk_on?: string | null
  risk_off?: string | null
  shock_dates?: string[]
  struct_dates?: string[]
  macro_window?: {
    window_start?: string | null
    window_end?: string | null
    phase?: string | null
    headline?: string | null
    summary?: string | null
    demand_avg?: number | null
    supply_avg?: number | null
    inventory_avg?: number | null
    balance_avg?: number | null
    points?: Array<{
      d: string
      demand?: number | null
      supply?: number | null
      inventory?: number | null
      balance?: number | null
      orders?: number | null
      shipments?: number | null
      ipg?: number | null
      caput?: number | null
      inventories?: number | null
      inv_ship?: number | null
      capacity?: number | null
      unfilled?: number | null
      in_event?: boolean
    }>
  } | null
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
  macro_sources?: Record<string, { label?: string; source?: string; points?: number }>
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

function toneFromMacroPhase(phase: string | null | undefined): Tone {
  const upper = String(phase ?? '').toUpperCase()
  if (upper.includes('EXPANSION')) return 'good'
  if (upper.includes('TIGHT')) return 'info'
  if (upper.includes('DIGEST') || upper.includes('TRANSITION')) return 'watch'
  if (upper.includes('DOWN') || upper.includes('CORRECTION') || upper.includes('SUPPLY BUILD')) return 'danger'
  if (upper.includes('TROUGH') || upper.includes('REPAIR')) return 'neutral'
  return 'neutral'
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

function formatMonthTick(value: string | null | undefined): string {
  if (!value) return '--'
  return value.slice(0, 7).replace('-', '/')
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
  payload?: PlaybackTooltipItem[]
  label?: string
  variant: 'path' | 'capital' | 'macro'
}) {
  if (!active || !payload?.length) return null
  const title = variant === 'path' ? 'Selected path' : variant === 'capital' ? 'Capital curve' : 'Monthly tape'
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: item.color ?? item.stroke ?? item.fill ?? '#cbd5e1',
                  boxShadow: '0 0 0 2px rgba(8, 12, 20, 0.96)',
                  flex: '0 0 auto',
                }}
              />
              <div
                style={{
                  fontSize: '0.82rem',
                  color: item.color ?? item.stroke ?? item.fill ?? '#cbd5e1',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.name ?? 'Value'}
              </div>
            </div>
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
  const macroSourceCount = Object.keys(archive.macro_sources ?? {}).length
  const initialSelectedId = events[events.length - 1]?.id ?? events[0]?.id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(() => initialSelectedId)
  const selected = events.find((event) => event.id === selectedId) ?? events[events.length - 1] ?? events[0]
  const selectedPlayback = selected?.playback ?? []
  const selectedChartRows = buildPlaybackChartRows(selectedPlayback)
  const selectedMacro = selected?.macro_window ?? null
  const selectedMacroRows = selectedMacro?.points ?? []
  const selectedMacroChartRows = selectedMacroRows.map((row) => ({
    ...row,
    demandArea: row.demand != null && row.supply != null && row.demand > row.supply ? [row.supply, row.demand] : [row.demand ?? 0, row.demand ?? 0],
  }))
  const selectedMacroTicks = selectedMacroRows
    .filter((_, index) => index % 3 === 0 || index === selectedMacroRows.length - 1)
    .map((row) => row.d)
  const selectedMacroLegend: MacroLegendItem[] = [
    {
      label: 'Demand momentum',
      detail: 'orders + shipments',
      color: '#10b981',
      kind: 'line' as const,
    },
    {
      label: 'Supply tightness',
      detail: 'capacity + fab load',
      color: '#3b82f6',
      kind: 'line' as const,
    },
    {
      label: 'Inventory pressure',
      detail: 'inventory / backlog',
      color: '#f59e0b',
      kind: 'dash' as const,
    },
    {
      label: 'Balance bars',
      detail: 'green = demand-led, blue = supply-led',
      color: '#10b981',
      altColor: '#3b82f6',
      kind: 'bar' as const,
    },
  ]
  const selectedMacroTone = toneFromMacroPhase(selectedMacro?.phase)
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
              L6. Historical Playback Appendix
            </div>
            <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.1, color: '#f8fafc', fontWeight: 950 }}>
              Why prior cycles mattered
            </h2>
            <p style={{ margin: 0, maxWidth: 860, fontSize: '0.95rem', lineHeight: 1.75, color: '#cbd5e1' }}>
              이 부록은 페이지의 마지막 단계입니다. 과거 SOXX 급락 구간에서 SOXL 프록시가 어떻게 반응했는지 시뮬레이션합니다.{' '}
              각 구간을 클릭하면 <b>SOXX 낙폭</b>, <b>SOXL 낙폭</b>, <b>방어 전략으로 보존된 자본(Capital Saved)</b>을 확인할 수 있습니다.{' '}
              학습 포인트: ① 3배 레버리지는 하락폭도 3배라는 것을 데이터로 확인하고, ② Hold가 기본값인 이유를, ③ 어떤 조건(breadth + 수급)에서만 전술적 진입이 유효했는지를 직접 읽어보세요.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Run ${archive.run_id ?? 'unknown'}`} tone="neutral" />
              <Badge label={`${events.length} events`} tone="info" />
              {macroSourceCount ? <Badge label={`${macroSourceCount} monthly sources`} tone="good" /> : null}
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
        description="선택한 구간의 SOXX·SOXL 경로와 자본곡선을 시간축으로 펼쳐 봅니다. 주목할 점: ① Valuation Reset — 주가가 기업 가치로 복귀하는 가격 조정 구간, ② Long Digestion — 급등 후 몇 개월간의 지루한 횡보/하락으로 시장이 상승을 소화하는 과정. 업황(수요/공급)은 여전히 건강한데 SOXL이 우하향하는 이유는 '사이클 재평가 기간'이기 때문입니다. 이 구간에서 자본 보존(Hold or Reduce)이 왜 필수인지를 차트로 직접 확인하세요."
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
        description="각 구간은 Monetization 사이클의 서로 다른 단계를 보여줍니다. 어떤 구간은 '기대감 과열(First-wave excitement)' 후 조정이고, 어떤 구간은 '수익 증명 단계(Monetization proof)'의 지루한 레인지입니다. 각 카드를 열어 (1) SOXX 낙폭 vs SOXL 낙폭 비교, (2) 방어 전략 효과, (3) 그 당시 수급 환경(수요/공급/재고)이 각각 어떤 상태였는지를 읽어보세요. 이를 통해 '업황이 좋아도 조정 구간에서 레버리지는 위험하다'는 교훈을 체득할 수 있습니다."
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
        {selected?.story ? (
          <div
            style={{
              borderRadius: 18,
              border: '1px solid rgba(245, 158, 11, 0.18)',
              background: 'linear-gradient(180deg, rgba(34, 24, 8, 0.92), rgba(15, 23, 42, 0.84))',
              padding: '1rem',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.68rem', color: '#fcd34d', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                Story / Why it happened
              </div>
              <Badge label={selected.story.regime ?? 'Unknown'} tone="watch" />
            </div>
            <div style={{ fontSize: '0.93rem', lineHeight: 1.75, color: '#fef3c7', fontWeight: 700 }}>
              {selected.story.summary ?? 'No narrative is attached to this event yet.'}
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.86rem', lineHeight: 1.7, color: '#fde68a' }}>
              <div>
                <b>Driver:</b> {selected.story.driver ?? '--'}
              </div>
              <div>
                <b>Lesson:</b> {selected.story.lesson ?? '--'}
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            borderRadius: 18,
            border: '1px solid rgba(56, 189, 248, 0.14)',
            background: 'rgba(8, 16, 30, 0.82)',
            padding: '1rem',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                Historical Drivers — Monetization Reset Cycle
              </div>
              <div style={{ fontSize: '1.02rem', color: '#f8fafc', fontWeight: 900 }}>
                Monthly semiconductor tape (첫 물결 → 수익화 증명)
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', lineHeight: 1.65, color: '#cbd5e1' }}>
                AI 산업은 두 단계를 거칩니다: ① <b style={{ color: '#10b981' }}>First-wave excitement</b> (GPU 주문·CAPEX 폭증) → ② <b style={{ color: '#f59e0b' }}>Monetization Reset</b> (실제 이익 창출 증명).
                아래 차트는 수요-공급-재고의 변화를 통해 각 구간이 어느 단계에 있는지 보여줍니다.
              </p>
            </div>
            <Badge label={selectedMacro?.phase ?? 'No macro tape'} tone={selectedMacroTone} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={`${selectedMacroRows.length} months`} tone="neutral" />
            <Badge label={`${selectedMacro?.window_start ?? '--'} → ${selectedMacro?.window_end ?? '--'}`} tone="neutral" />
          </div>

          <div
            style={{
              padding: '0.7rem 0.9rem',
              borderRadius: 12,
              border: '1px solid rgba(16, 185, 129, 0.18)',
              background: 'rgba(8, 22, 16, 0.72)',
              fontSize: '0.84rem',
              lineHeight: 1.78,
              color: '#d1fae5',
            }}
          >
            <b style={{ color: '#34d399' }}>이 차트가 보여주는 것</b>{' '}—{' '}
            FRED(미국 연방준비제도 경제 데이터)에서 수집한 반도체 월간 수급 테이프입니다.{' '}
            <b>수요(초록)</b>와 <b>공급(파랑)</b>을 0~100 척도로 정규화해 비교합니다. <b>50이 중립선</b>이며,
            50 초과 = 해당 지표 확장 국면, 50 미만 = 수축 국면입니다.{' '}
            <b>재고 압력(주황 점선)</b>은 오른쪽 축으로, 이 값이 급등하면 공급 과잉 전환의 초기 경고입니다.{' '}
            하단 막대는 수요-공급 스프레드(Balance)를 표시합니다 — 초록 막대가 위로 클수록 수요 우위, 파랑 막대가 아래로 클수록 공급 우위입니다.
          </div>

          <div
            style={{
              display: 'grid',
              gap: 8,
              borderRadius: 16,
              border: '1px solid rgba(148, 163, 184, 0.12)',
              background: 'rgba(15, 23, 42, 0.56)',
              padding: '0.75rem 0.85rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedMacroLegend.map((item) => {
                const swatch =
                  item.kind === 'dash' ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 18,
                        borderTop: `2px dashed ${item.color}`,
                      }}
                    />
                  ) : item.kind === 'bar' ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 14,
                        borderRadius: 3,
                        background: `linear-gradient(180deg, ${item.color}, ${item.altColor ?? item.color})`,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 18,
                        height: 3,
                        borderRadius: 999,
                        background: item.color,
                      }}
                    />
                  )

                return (
                  <div
                    key={item.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 999,
                      border: `1px solid ${item.color}66`,
                      background: `linear-gradient(90deg, ${item.color}24 0%, rgba(8, 16, 30, 0.96) 58%)`,
                      boxShadow: `inset 0 0 0 1px ${item.color}12`,
                      padding: '0.34rem 0.7rem',
                      minHeight: 38,
                    }}
                  >
                    {swatch}
                    <div style={{ display: 'grid', gap: 1 }}>
                      <div style={{ color: item.color, fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.04em' }}>
                        {item.label}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem', lineHeight: 1.2 }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.78 }}>
              <b style={{ color: '#34d399' }}>읽는 법:</b>{' '}
              초록(수요) &gt; 파랑(공급) 구간 = 수요 주도 확장 → 반도체 주식에 우호적.{' '}
              파랑이 초록에 수렴하거나 역전되면 공급이 따라잡히는 신호.{' '}
              주황 점선(재고 압력)이 <b>급등</b>하면 재고 과잉 위험 → 사이클 둔화 초기 경보.{' '}
              <b>임계값:</b> 두 선 모두 50 이상이면 건강한 확장; 어느 한 선이 40 아래로 내려가면 주의 구간.
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', lineHeight: 1.75, color: '#cbd5e1' }}>
            {selectedMacro?.headline ?? 'Monthly FRED semiconductor data is not available yet for this event.'}
            <span style={{ color: '#94a3b8' }}>
              {' '}
              {selectedMacro?.summary ?? 'Build the playback archive after the monthly tape is populated.'}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <MetricCard
              label="Demand Avg"
              value={formatNumber(selectedMacro?.demand_avg, 1)}
              detail="주문+출하 모멘텀 (50=중립 / 50↑=확장 / 50↓=수축)"
              tone="good"
            />
            <MetricCard
              label="Supply Avg"
              value={formatNumber(selectedMacro?.supply_avg, 1)}
              detail="캐파+팹 가동률 (50↓=공급 부족→가격 지지)"
              tone="info"
            />
            <MetricCard
              label="Balance"
              value={formatNumber(selectedMacro?.balance_avg, 1)}
              detail="수요-공급 차 (+= 수요 우위, 레버리지 우호)"
              tone={selectedMacroTone}
            />
            <MetricCard
              label="Inventory Avg"
              value={formatNumber(selectedMacro?.inventory_avg, 1)}
              detail="재고 압력 (30↓=재고 타이트 / 60↑=과잉 경보)"
              tone="watch"
            />
          </div>
          <div
            style={{
              marginTop: 4,
              padding: '0.65rem 0.9rem',
              borderRadius: 10,
              border: '1px solid rgba(245, 158, 11, 0.18)',
              background: 'rgba(20, 14, 4, 0.72)',
              fontSize: '0.8rem',
              lineHeight: 1.75,
              color: '#fde68a',
            }}
          >
            <b style={{ color: '#fcd34d' }}>값 해석 가이드 (Monetization 사이클)</b>{' '}—{' '}
            <b style={{ color: '#10b981' }}>First-wave 단계</b>: Demand &gt; 50 &amp; Supply &lt; 50 &amp; Inventory 낮음 → GPU 주문 폭증, 공급 병목, 재고 타이트.
            {' '}이 구간에서는 주가도 가팔라지는 경향. SOXL 진입 최적 구간.{' '}
            <b style={{ color: '#f59e0b' }}>Monetization Reset 단계</b>: Balance 여전히 양수지만 수요 증속 둔화, 재고 축적 시작.
            {' '}시장이 '실제 이익이 얼마나 될 것인가'를 재평가하는 기간. 주가 조정, SOXL 우하향 리스크 높음.{' '}
            <b>핵심 교훈</b>: 업황 수치가 양호해도 사이클 전환기에는 SOXL이 손실을 볼 수 있습니다. 자본 보존(Hold/Exit)이 필수.
          </div>

        {chartsReady && selectedMacroRows.length ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={selectedMacroChartRows}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    syncId="macroSync"
                    syncMethod="value"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="d"
                      hide
                      allowDuplicatedCategory={false}
                      ticks={selectedMacroTicks}
                      type="category"
                    />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} width={52} domain={[0, 100]} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#f59e0b', fontSize: 11 }}
                      width={52}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<PlaybackChartTooltip variant="macro" />} />
                    <ReferenceLine yAxisId="left" y={50} stroke="rgba(148,163,184,0.45)" strokeDasharray="4 4" />
                    
                    <Area yAxisId="left" type="monotone" dataKey="demandArea" name=" " fill="rgba(16, 185, 129, 0.15)" stroke="none" activeDot={false} legendType="none" />
                    
                    <Line yAxisId="left" type="monotone" dataKey="demand" name="Demand momentum" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="supply" name="Supply tightness" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="inventory" name="Inventory pressure" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ height: 144 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={selectedMacroRows}
                    margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    syncId="macroSync"
                    syncMethod="value"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="d"
                      allowDuplicatedCategory={false}
                      ticks={selectedMacroTicks}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={formatMonthTick}
                      interval={0}
                      type="category"
                    />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} width={52} domain={['auto', 'auto']} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: 'transparent', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<PlaybackChartTooltip variant="macro" />} />
                    <ReferenceLine yAxisId="left" y={0} stroke="rgba(148,163,184,0.6)" strokeWidth={1.5} />
                    <Bar yAxisId="left" dataKey="balance" name="Balance" radius={[2, 2, 0, 0]} maxBarSize={40}>
                      {selectedMacroRows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry.balance ?? 0) >= 0 ? '#10b981' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Brush
                      dataKey="d"
                      height={18}
                      travellerWidth={10}
                      stroke="#3b82f6"
                      fill="rgba(15, 23, 42, 0.72)"
                      tickFormatter={formatMonthTick}
                      startIndex={0}
                      endIndex={selectedMacroRows.length - 1}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div
              style={{
                minHeight: 180,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 16,
                border: '1px dashed rgba(148,163,184,0.18)',
                color: '#94a3b8',
                background: 'rgba(15,23,42,0.45)',
                textAlign: 'center',
                padding: '0.8rem 1rem',
              }}
            >
              Monthly tape loading...
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <MetricCard label="SOXX Trough" value={`${formatNumber(selected?.stats?.soxx_trough, 1)} base100`} detail="Selected event low" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
          <MetricCard label="SOXL Trough" value={`${formatNumber(selected?.stats?.soxl_trough, 1)} base100`} detail="Proxy leverage low" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
          <MetricCard label="Capital Saved" value={formatPct(selected?.stats?.capital_saved_pct, 1)} detail="Tactical replay vs buy-and-hold" tone={toneFromSavedPct(selected?.stats?.capital_saved_pct)} />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
            Key Dates
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={`Risk on ${formatDate(selected?.risk_on)}`} tone="watch" />
            <Badge label={`Risk off ${formatDate(selected?.risk_off)}`} tone="good" />
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
