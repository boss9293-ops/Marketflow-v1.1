'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SoxxSymbolState = {
  symbol?: string
  name?: string
  role?: string
  history_rows?: number
  first_date?: string
  last_date?: string
  close?: number
  ma20?: number
  ma50?: number
  ma200?: number
  dist_ma20_pct?: number
  dist_ma50_pct?: number
  dist_ma200_pct?: number
  dd_pct?: number
  dd_bucket?: string
  vol20_pct?: number
  ret_20d_pct?: number
  ret_60d_pct?: number
  ret_252d_pct?: number
  above_ma200?: boolean
  trend_stack?: boolean
  ma200_state?: string
  trend_state?: string
}

type SoxxMacroOverlay = {
  model?: string
  phase?: string
  phase_gate?: number
  progress?: number
  mps?: number
  vri?: number
  vri_state?: string
  shock_probability_30d?: number
  shock_state?: string
  put_call?: number
  put_call_state?: string
  csi?: number
  csi_state?: string
  rpi?: number
  rpi_state?: string
  lpi?: number
  lpi_state?: string
  defensive_mode?: string
  defensive_reasons?: string[]
  reasons?: string[]
  score?: number
  state?: string
  summary?: string
  components?: {
    phase_gate?: number
    mps?: number
    vri_health?: number
    shock_health?: number
    csi_health?: number
    rpi_health?: number
    lpi_health?: number
    put_call_health?: number
  }
}

type SoxxEarningsEvent = {
  ticker?: string
  name?: string
  date?: string
  days_out?: number
  importance?: number
  capex?: boolean
  ai?: boolean
  proximity?: number
}

type SoxxEarningsOverlay = {
  model?: string
  window_days?: number
  as_of?: string
  event_count?: number
  ai_count?: number
  capex_count?: number
  score?: number
  state?: string
  summary?: string
  next_nvda_days?: number | null
  next_tsm_days?: number | null
  next_event?: SoxxEarningsEvent | null
  events?: SoxxEarningsEvent[]
  weighted_density?: number
}

export type SoxxContextPayload = {
  schema_version?: string
  generated_at?: string
  data_as_of?: string
  history_window?: number
  current?: {
    date?: string
    soxx?: SoxxSymbolState
    qqq?: SoxxSymbolState
    peers?: {
      NVDA?: SoxxSymbolState
      TSM?: SoxxSymbolState
      SOXL?: SoxxSymbolState
    }
    macro?: SoxxMacroOverlay
    earnings?: SoxxEarningsOverlay
    relative_strength?: {
      soxx_vs_qqq_ratio?: number
      soxx_vs_qqq_ratio_base100?: number
      rs_20d_vs_qqq_pct?: number
      rs_60d_vs_qqq_pct?: number
      rs_252d_vs_qqq_pct?: number
      lead_state?: string
    }
    ai_cycle?: {
      model?: string
      score?: number
      stage?: string
      explanation?: string
      components?: {
        ma200?: number
        trend_stack?: number
        rs_20d?: number
        rs_60d?: number
        nvda_60d?: number
        tsm_60d?: number
        drawdown?: number
        volatility?: number
        price?: number
        macro?: number
        earnings?: number
        weight_price?: number
        weight_macro?: number
        weight_earnings?: number
        phase_gate?: number
        mps?: number
        vri?: number
        shock_probability_30d?: number
        put_call?: number
        csi?: number
        rpi?: number
        lpi?: number
        event_count?: number
        capex_count?: number
        weighted_density?: number
        next_nvda_days?: number | null
        next_tsm_days?: number | null
        defensive_mode?: string
      }
    }
    risk?: {
      soxx_dd_pct?: number
      soxx_dd_bucket?: string
      soxx_ma200_state?: string
      soxx_ma200_distance_pct?: number
      soxl_proxy_dd_pct?: number
      soxl_guard_band?: string
    }
    guidance?: {
      headline?: string
      detail?: string
    }
    signals?: string[]
  }
  thresholds?: {
    soxx_dd?: {
      watch?: number
      caution?: number
      defense?: number
    }
    soxl_proxy_dd?: {
      watch?: number
      caution?: number
      defense?: number
    }
    ai_cycle_score?: {
      expectation?: number
      monetization?: number
      overinvestment?: number
      contraction?: number
    }
  }
  model?: {
    name?: string
    version?: string
    inputs?: string[]
    notes?: string[]
  }
  notes?: string[]
}

type Tone = 'neutral' | 'info' | 'good' | 'watch' | 'warn' | 'danger'

type ToneStyles = {
  border: string
  bg: string
  fg: string
  accent: string
}

const TONE_STYLES: Record<Tone, ToneStyles> = {
  neutral: {
    border: 'rgba(148, 163, 184, 0.18)',
    bg: 'rgba(15, 23, 42, 0.86)',
    fg: '#e2e8f0',
    accent: '#94a3b8',
  },
  info: {
    border: 'rgba(56, 189, 248, 0.30)',
    bg: 'rgba(8, 22, 38, 0.96)',
    fg: '#e0f2fe',
    accent: '#7dd3fc',
  },
  good: {
    border: 'rgba(34, 197, 94, 0.30)',
    bg: 'rgba(9, 25, 18, 0.96)',
    fg: '#dcfce7',
    accent: '#86efac',
  },
  watch: {
    border: 'rgba(245, 158, 11, 0.34)',
    bg: 'rgba(34, 24, 8, 0.96)',
    fg: '#fef3c7',
    accent: '#fbbf24',
  },
  warn: {
    border: 'rgba(249, 115, 22, 0.34)',
    bg: 'rgba(40, 17, 6, 0.96)',
    fg: '#ffedd5',
    accent: '#fdba74',
  },
  danger: {
    border: 'rgba(244, 63, 94, 0.36)',
    bg: 'rgba(35, 8, 16, 0.96)',
    fg: '#ffe4e6',
    accent: '#fda4af',
  },
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toFixed(2)
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function formatDate(value: string | null | undefined): string {
  return value ?? '--'
}

function normalizeTone(value: string | null | undefined): Tone {
  const upper = String(value ?? '').toUpperCase()
  if (upper === 'MONETIZATION' || upper === 'GREEN' || upper === 'LEADING' || upper === 'ABOVE') return 'good'
  if (upper === 'EXPECTATION') return 'info'
  if (upper === 'OVERINVESTMENT' || upper === 'WATCH') return 'watch'
  if (upper === 'CAUTION') return 'warn'
  if (upper === 'CONTRACTION' || upper === 'DEFENSE' || upper === 'BELOW' || upper === 'LAGGING') return 'danger'
  return 'neutral'
}

function toneStyles(tone: Tone): ToneStyles {
  return TONE_STYLES[tone] ?? TONE_STYLES.neutral
}

function metricTone(value?: number | null, reverse = false): Tone {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'
  if (reverse) {
    if (value <= -20) return 'danger'
    if (value <= -10) return 'warn'
    if (value <= -5) return 'watch'
    return 'good'
  }
  if (value >= 80) return 'good'
  if (value >= 65) return 'watch'
  if (value >= 50) return 'info'
  if (value >= 40) return 'warn'
  return 'danger'
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

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  fullWidth = false,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  fullWidth?: boolean
}) {
  return (
    <section
      style={{
        gridColumn: fullWidth ? '1 / -1' : 'auto',
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
      <div style={{ fontSize: '1.18rem', fontWeight: 900, color: styles.fg, lineHeight: 1.1 }}>{value}</div>
      {detail ? <div style={{ fontSize: '0.78rem', lineHeight: 1.55, color: '#cbd5e1' }}>{detail}</div> : null}
    </div>
  )
}

function ScoreBar({ value, tone }: { value: number | null | undefined; tone: Tone }) {
  const styles = toneStyles(tone)
  const pct = Math.max(0, Math.min(100, typeof value === 'number' && Number.isFinite(value) ? value : 0))
  return (
    <div
      style={{
        height: 12,
        borderRadius: 999,
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 999,
          background: `linear-gradient(90deg, ${styles.accent}, ${styles.fg})`,
          boxShadow: `0 0 18px ${styles.accent}55`,
        }}
      />
    </div>
  )
}

function CycleChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as { note?: string } | undefined
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(56, 189, 248, 0.22)',
        background: 'rgba(8, 12, 20, 0.98)',
        padding: '0.8rem 0.9rem',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
        color: '#e2e8f0',
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.95rem', fontWeight: 900 }}>
        {payload[0]?.name ?? 'Value'}: {formatNumber(payload[0]?.value, 1)}
      </div>
      {row?.note ? (
        <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
          {row.note}
        </div>
      ) : null}
    </div>
  )
}

function ListChips({
  items,
  tone = 'neutral',
}: {
  items: string[]
  tone?: Tone
}) {
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <Badge key={item} label={item} tone={tone} />
      ))}
    </div>
  )
}

function buildFallbackStyle(): CSSProperties {
  return {
    borderRadius: 22,
    border: '1px dashed rgba(148,163,184,0.24)',
    background: 'rgba(15, 23, 42, 0.76)',
    padding: '1.1rem',
    color: '#cbd5e1',
    lineHeight: 1.7,
  }
}

export default function SoxlContextPanel({ context }: { context: SoxxContextPayload | null }) {
  if (!context || !context.current) {
    return (
      <section style={buildFallbackStyle()}>
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
          SOXL view
        </div>
        <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.35rem', color: '#f8fafc', fontWeight: 900 }}>
          SOXX context is still missing
        </h2>
        <p style={{ margin: '0.6rem 0 0', maxWidth: 760 }}>
          Run <code style={{ background: 'rgba(15,23,42,0.9)', padding: '0.18rem 0.42rem', borderRadius: 6 }}>python marketflow/backend/scripts/build_soxx_context.py</code>
          {' '}to rebuild the SOXX context cache, then refresh this page.
        </p>
      </section>
    )
  }

  const current = context.current
  const soxx = current.soxx
  const qqq = current.qqq
  const peers = current.peers ?? {}
  const macro = current.macro
  const earnings = current.earnings
  const aiCycle = current.ai_cycle
  const relative = current.relative_strength
  const risk = current.risk
  const guidance = current.guidance
  const score = aiCycle?.score ?? null
  const scoreTone = metricTone(score)
  const stageTone = normalizeTone(aiCycle?.stage)
  const leadTone = normalizeTone(relative?.lead_state)
  const guardTone = normalizeTone(risk?.soxl_guard_band)
  const cycleThresholds = context.thresholds?.ai_cycle_score ?? {}
  const soxxThresholds = context.thresholds?.soxx_dd ?? {}
  const soxlThresholds = context.thresholds?.soxl_proxy_dd ?? {}
  const nextCatalyst = earnings?.next_event ?? earnings?.events?.[0] ?? null

  const driverLabels = [
    aiCycle?.components?.ma200 != null ? `MA200 ${formatNumber(aiCycle.components.ma200, 1)}` : 'MA200 --',
    aiCycle?.components?.trend_stack != null ? `Trend ${formatNumber(aiCycle.components.trend_stack, 1)}` : 'Trend --',
    aiCycle?.components?.rs_20d != null ? `RS 20D ${formatNumber(aiCycle.components.rs_20d, 1)}` : 'RS 20D --',
    aiCycle?.components?.rs_60d != null ? `RS 60D ${formatNumber(aiCycle.components.rs_60d, 1)}` : 'RS 60D --',
    peers.NVDA?.ret_60d_pct != null ? `NVDA 60D ${formatPct(peers.NVDA.ret_60d_pct, 1)}` : 'NVDA 60D --',
    peers.TSM?.ret_60d_pct != null ? `TSM 60D ${formatPct(peers.TSM.ret_60d_pct, 1)}` : 'TSM 60D --',
    macro?.phase ? `Macro ${macro.phase}` : 'Macro --',
    macro?.score != null ? `Macro ${formatNumber(macro.score, 1)}` : 'Macro --',
    earnings?.event_count != null ? `Events ${formatNumber(earnings.event_count, 0)} / ${earnings.window_days ?? 45}D` : 'Events --',
    nextCatalyst?.ticker ? `Next ${nextCatalyst.ticker} ${formatNumber(nextCatalyst.days_out, 0)}D` : 'Next catalyst --',
  ]

  const signalLabels = current.signals ?? []
  const modelInputs = context.model?.inputs ?? []
  const modelNotes = context.model?.notes ?? []
  const extraNotes = context.notes ?? []
  const [chartsReady, setChartsReady] = useState(false)

  useEffect(() => {
    setChartsReady(true)
  }, [])

  const cycleChartRows = [
    { label: 'Price', value: Math.max(0, Math.min(100, aiCycle?.components?.price ?? 0)), tone: 'good' as Tone, note: 'Price composite' },
    { label: 'Macro', value: Math.max(0, Math.min(100, aiCycle?.components?.macro ?? 0)), tone: 'info' as Tone, note: 'Macro overlay' },
    { label: 'Earnings', value: Math.max(0, Math.min(100, aiCycle?.components?.earnings ?? 0)), tone: 'watch' as Tone, note: 'Earnings / capex density' },
    { label: 'Phase', value: Math.max(0, Math.min(100, aiCycle?.components?.phase_gate ?? 0)), tone: stageTone, note: 'Phase gate' },
  ]

  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
      }}
    >
      <div
        style={{
          borderRadius: 24,
          border: '1px solid rgba(56, 189, 248, 0.16)',
          background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))',
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)',
          padding: '1.15rem 1.15rem 1.2rem',
          display: 'grid',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
              Leverage Lens / SOXL
            </div>
            <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.1, color: '#f8fafc', fontWeight: 950 }}>
              Semiconductor & AI Momentum Board
            </h2>
            <p style={{ margin: 0, maxWidth: 820, fontSize: '0.95rem', lineHeight: 1.75, color: '#cbd5e1' }}>
              SOXX를 기준으로 QQQ 상대강도, NVDA/TSM 모멘텀, SOXL proxy stress를 분리해서 봅니다.
              현재 사이클이 팽창인지, 과열인지, 수축인지 먼저 확인한 뒤 SOXL 접근 강도를 정합니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Data ${formatDate(context.data_as_of)}`} tone="neutral" />
              <Badge label={`Generated ${formatDate(context.generated_at)}`} tone="neutral" />
              <Badge label={`${context.history_window ?? 252}D window`} tone="neutral" />
              <Badge label={context.schema_version ?? 'soxx_context_v1'} tone="neutral" />
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              border: `1px solid ${toneStyles(scoreTone).border}`,
              background: toneStyles(scoreTone).bg,
              padding: '1rem',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: '0.68rem', color: toneStyles(scoreTone).accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                  AI Cycle Score
                </div>
                <div style={{ fontSize: '2.2rem', lineHeight: 1, fontWeight: 950, color: toneStyles(scoreTone).fg }}>
                  {formatNumber(score, 1)}
                  <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}> / 100</span>
                </div>
              </div>
              <Badge label={aiCycle?.stage ?? 'UNKNOWN'} tone={stageTone} />
            </div>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.65, color: '#cbd5e1' }}>
              {aiCycle?.explanation ?? 'No cycle explanation available yet.'}
            </div>
            <ScoreBar value={score} tone={scoreTone} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Expectation ${cycleThresholds.expectation ?? 50}`} tone="info" />
              <Badge label={`Monetization ${cycleThresholds.monetization ?? 65}`} tone="good" />
              <Badge label={`Overinvestment ${cycleThresholds.overinvestment ?? 80}`} tone="watch" />
              <Badge label={`Contraction ${cycleThresholds.contraction ?? 40}`} tone="danger" />
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        eyebrow="Cycle Chart"
        title="AI Cycle component breakdown"
        description="A quick visual read on the current SOXX cycle: the blended score is shown as a reference line, and the bars show the major component layers."
        fullWidth
      >
        {chartsReady ? (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cycleChartRows} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CycleChartTooltip />} />
                <ReferenceLine y={score ?? 0} stroke="#7dd3fc" strokeDasharray="4 4" />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {cycleChartRows.map((row) => (
                    <Cell key={row.label} fill={toneStyles(row.tone).accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            style={{
              height: 280,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 16,
              border: '1px dashed rgba(148,163,184,0.2)',
              color: '#94a3b8',
              background: 'rgba(15,23,42,0.45)',
            }}
          >
            Chart loading...
          </div>
        )}
      </SectionCard>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        <SectionCard
          eyebrow="Macro / Thematic"
          title="AI & CAPEX Momentum Board"
          description="가격 action proxy를 먼저 보고, 모멘텀 드라이버와 모델 입력을 함께 읽습니다."
          fullWidth
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <MetricCard
                label="Model"
                value={`${context.model?.name ?? 'semi_cycle_proxy'} ${context.model?.version ?? 'v0'}`}
                detail="Price, macro, and earnings overlay blend"
                tone="info"
              />
              <MetricCard
                label="SOXX Stage"
                value={aiCycle?.stage ?? '--'}
                detail={aiCycle?.explanation ?? 'No explanation available'}
                tone={stageTone}
              />
              <MetricCard
                label="SOXX Score"
                value={`${formatNumber(score, 1)} / 100`}
                detail="Combined macro-thematic proxy"
                tone={scoreTone}
              />
              <MetricCard
                label="Macro Phase"
                value={macro?.phase ?? '--'}
                detail={macro?.summary ?? 'Macro snapshot overlay'}
                tone={normalizeTone(macro?.state ?? macro?.phase)}
              />
              <MetricCard
                label="Macro Score"
                value={`${formatNumber(macro?.score, 1)} / 100`}
                detail={`Gate ${formatNumber(macro?.phase_gate, 1)} | MPS ${formatNumber(macro?.mps, 1)}`}
                tone={metricTone(macro?.score)}
              />
              <MetricCard
                label="Earnings Window"
                value={`${formatNumber(earnings?.score, 1)} / 100`}
                detail={earnings?.summary ?? 'Catalyst density proxy'}
                tone={metricTone(earnings?.score)}
              />
              <MetricCard
                label="Driver Blend"
                value={aiCycle?.components?.price != null && aiCycle?.components?.macro != null ? 'Price + Macro' : '--'}
                detail="56% price / 29% macro / 15% earnings"
                tone="neutral"
              />
              <MetricCard
                label="Horizon"
                value="Tactical / short-term"
                detail="SOXL is not framed as a long-term hold asset"
                tone="watch"
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {driverLabels.map((label) => (
                <Badge key={label} label={label} tone="neutral" />
              ))}
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <MetricCard
                label="SOXX vs QQQ"
                value={`${formatNumber(relative?.soxx_vs_qqq_ratio_base100, 1)} base100`}
                detail={`Raw ratio ${formatNumber(relative?.soxx_vs_qqq_ratio, 2)}`}
                tone={leadTone}
              />
              <MetricCard
                label="20D RS"
                value={formatPct(relative?.rs_20d_vs_qqq_pct, 1)}
                detail="Semis vs Nasdaq-100"
                tone={relative?.rs_20d_vs_qqq_pct != null && relative.rs_20d_vs_qqq_pct >= 0 ? 'good' : 'danger'}
              />
              <MetricCard
                label="60D RS"
                value={formatPct(relative?.rs_60d_vs_qqq_pct, 1)}
                detail="Trend confirmation layer"
                tone={relative?.rs_60d_vs_qqq_pct != null && relative.rs_60d_vs_qqq_pct >= 0 ? 'good' : 'danger'}
              />
              <MetricCard
                label="252D RS"
                value={formatPct(relative?.rs_252d_vs_qqq_pct, 1)}
                detail="Longer-cycle leadership"
                tone={relative?.rs_252d_vs_qqq_pct != null && relative.rs_252d_vs_qqq_pct >= 0 ? 'good' : 'danger'}
              />
              <MetricCard
                label="QQQ Close"
                value={formatPrice(qqq?.close)}
                detail={`MA200 ${formatPrice(qqq?.ma200)}`}
                tone="neutral"
              />
              <MetricCard
                label="QQQ 60D"
                value={formatPct(qqq?.ret_60d_pct, 1)}
                detail={`DD ${formatPct(qqq?.dd_pct, 1)}`}
                tone={qqq?.ret_60d_pct != null && qqq.ret_60d_pct >= 0 ? 'good' : 'danger'}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {modelInputs.map((input) => (
                <Badge key={input} label={input} tone="neutral" />
              ))}
            </div>
            {modelNotes.length ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.65 }}>
                {modelNotes.join(' ')}
              </div>
            ) : null}
            {earnings?.events?.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Upcoming Catalysts
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {earnings.events.slice(0, 8).map((event) => (
                    <Badge
                      key={`${event.ticker}-${event.date}`}
                      label={`${event.ticker ?? '--'} ${formatNumber(event.days_out, 0)}D`}
                      tone={event.capex ? 'watch' : 'neutral'}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Structure / Risk"
          title="SOXX Price Layer"
          fullWidth
          description="SOXX 기준선과 SOXL proxy stress를 분리해서 봅니다."
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 4,
              alignItems: 'stretch',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x proximity',
            }}
          >
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="SOXX Close" value={formatPrice(soxx?.close)} detail={formatDate(current.date)} tone="info" />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="MA20" value={formatPrice(soxx?.ma20)} detail={formatPct(soxx?.dist_ma20_pct, 1)} tone={soxx?.dist_ma20_pct != null && soxx.dist_ma20_pct >= 0 ? 'good' : 'danger'} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="MA50" value={formatPrice(soxx?.ma50)} detail={formatPct(soxx?.dist_ma50_pct, 1)} tone={soxx?.dist_ma50_pct != null && soxx.dist_ma50_pct >= 0 ? 'good' : 'danger'} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="MA200" value={formatPrice(soxx?.ma200)} detail={formatPct(soxx?.dist_ma200_pct, 1)} tone={soxx?.dist_ma200_pct != null && soxx.dist_ma200_pct >= 0 ? 'good' : 'danger'} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="Drawdown" value={formatPct(risk?.soxx_dd_pct, 1)} detail={risk?.soxx_dd_bucket ?? 'No bucket'} tone={metricTone(risk?.soxx_dd_pct, true)} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="MA200 State" value={risk?.soxx_ma200_state ?? soxx?.ma200_state ?? '--'} detail={`Trend ${soxx?.trend_state ?? '--'}`} tone={normalizeTone(risk?.soxx_ma200_state ?? soxx?.ma200_state)} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="Volatility" value={formatPct(soxx?.vol20_pct, 1)} detail="20D realized vol" tone={soxx?.vol20_pct != null && soxx.vol20_pct >= 60 ? 'watch' : 'good'} />
            </div>
            <div style={{ flex: '0 0 176px', minWidth: 176, scrollSnapAlign: 'start' }}>
              <MetricCard label="SOXL Proxy DD" value={formatPct(risk?.soxl_proxy_dd_pct, 1)} detail={risk?.soxl_guard_band ?? 'Guard band pending'} tone={guardTone} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
              Thresholds
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`SOXX watch ${soxxThresholds.watch ?? -5}%`} tone="watch" />
              <Badge label={`SOXX caution ${soxxThresholds.caution ?? -10}%`} tone="warn" />
              <Badge label={`SOXX defense ${soxxThresholds.defense ?? -20}%`} tone="danger" />
              <Badge label={`SOXL watch ${soxlThresholds.watch ?? -15}%`} tone="watch" />
              <Badge label={`SOXL caution ${soxlThresholds.caution ?? -30}%`} tone="warn" />
              <Badge label={`SOXL defense ${soxlThresholds.defense ?? -60}%`} tone="danger" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Action Layer"
          title="SOXL Tactical Playbook"
          description="SOXL은 SOXX보다 훨씬 큰 변동성을 가지므로, 규칙은 더 느슨한 추세가 아니라 더 빠른 방어가 기준입니다."
          fullWidth
        >
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div style={{ borderRadius: 18, border: `1px solid ${toneStyles(guardTone).border}`, background: toneStyles(guardTone).bg, padding: '0.95rem 1rem', display: 'grid', gap: 8 }}>
              <div style={{ fontSize: '0.68rem', color: toneStyles(guardTone).accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                Guard Band
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 950, color: toneStyles(guardTone).fg }}>
                {risk?.soxl_guard_band ?? '--'}
              </div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: '#cbd5e1' }}>
                SOXL proxy DD {formatPct(risk?.soxl_proxy_dd_pct, 1)}.
                {' '}현재 구조가 방어 구간인지, 관망 구간인지, 혹은 공격적 비중 확대가 가능한지 여기서 확인합니다.
              </div>
            </div>

            <div style={{ borderRadius: 18, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.82)', padding: '0.95rem 1rem', display: 'grid', gap: 8 }}>
              <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                Guidance
              </div>
              <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#f8fafc', lineHeight: 1.45 }}>
                {guidance?.headline ?? 'No guidance headline available'}
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#cbd5e1' }}>
                {guidance?.detail ?? 'No guidance detail available'}
              </div>
            </div>

            <div style={{ borderRadius: 18, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.82)', padding: '0.95rem 1rem', display: 'grid', gap: 8 }}>
              <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                Signals
              </div>
              <ListChips items={signalLabels} tone="neutral" />
              {signalLabels.length === 0 ? (
                <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>No signal list available yet.</div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, fontSize: '0.82rem', lineHeight: 1.7, color: '#94a3b8' }}>
            {extraNotes.map((note) => (
              <div key={note}>• {note}</div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  )
}
