'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Tone = 'neutral' | 'info' | 'good' | 'watch' | 'warn' | 'danger'

type LeadershipSeriesConfig = {
  key: string
  label: string
  color: string
  strokeWidth?: number
  dash?: string
}

type LeadershipChartPoint = {
  date: string
  soxx?: number | null
  nvda?: number | null
  tsm?: number | null
  avgo?: number | null
  mu?: number | null
  equip?: number | null
  amd?: number | null
  demand?: number | null
  fab_spend?: number | null
  memory_spend?: number | null
  capacity?: number | null
}

type LeadershipChartSummary = {
  state?: string
  score?: number
  summary?: string
  leaders?: string[]
  laggards?: string[]
  positive_count?: number
  total?: number
}

type LeadershipChart = {
  basis?: string
  window?: number
  as_of?: string
  note?: string
  series?: LeadershipSeriesConfig[]
  rows?: LeadershipChartPoint[]
  summary?: LeadershipChartSummary
}

type SupplyDemandOutlookCard = {
  label?: string
  state?: string
  value?: string
  detail?: string
  tone?: Tone
}

type SupplyDemandOutlook = {
  state?: string
  headline?: string
  summary?: string
  cards?: SupplyDemandOutlookCard[]
  chart?: {
    basis?: string
    as_of?: string
    note?: string
    series?: LeadershipSeriesConfig[]
    rows?: LeadershipChartPoint[]
  }
  sources?: Array<{ name?: string; details?: string }>
  notes?: string[]
}

type RunwayView = {
  as_of?: string
  state?: string
  horizon?: string
  stance?: string
  headline?: string
  summary?: string
  next_review?: string
  confidence?: string
  signals?: string[]
  implication?: string
}

type SoxxCurrentPayload = {
  physical_layer?: {
    tsmc_util_pct?: number
    cowos_lead_time_months?: number
    hbm_yield_pct?: number
  }
  economic_layer?: {
    capex_revenue_ratio?: number
    token_cost_index?: number
  }
  financial_layer?: {
    breadth_score?: number
    breadth_state?: string
    rs_60d_vs_qqq_pct?: number
    soxl_atr_band_proxy?: number
  }
  edge_cases?: {
    custom_silicon_share_pct?: number
    macro_beta_score?: number
  }
  ai_cycle?: {
    stage?: string
    score?: number
    explanation?: string
    components?: {
      shock_probability_30d?: number
      vri?: number
      mps?: number
      put_call?: number
      weighted_density?: number
      event_count?: number
      capex_count?: number
    }
  }
  guidance?: {
    headline?: string
    detail?: string
  }
  relative_strength?: {
    rs_60d_vs_qqq_pct?: number
    rs_252d_vs_qqq_pct?: number
    lead_state?: string
  }
  risk?: {
    soxx_ma200_state?: string
    soxx_ma200_distance_pct?: number
    soxl_proxy_dd_pct?: number
    soxl_guard_band?: string
    soxx_dd_pct?: number
  }
  soxx?: {
    close?: number
    ma200?: number
    dd_pct?: number
  }
  qqq?: {
    close?: number
  }
}

export type SoxxContextPayload = {
  schema_version?: string
  generated_at?: string
  data_as_of?: string
  history_window?: number
  current?: SoxxCurrentPayload
  leadership?: LeadershipChartSummary
  leadership_chart?: LeadershipChart
  supply_demand_outlook?: SupplyDemandOutlook
  runway?: RunwayView
  notes?: string[]
}

const DEFAULT_SERIES: LeadershipSeriesConfig[] = [
  { key: 'soxx', label: 'SOXX', color: '#7dd3fc', strokeWidth: 3.2 },
  { key: 'nvda', label: 'NVDA', color: '#a78bfa', strokeWidth: 2.2 },
  { key: 'tsm', label: 'TSM', color: '#34d399', strokeWidth: 2.2 },
  { key: 'avgo', label: 'AVGO', color: '#f59e0b', strokeWidth: 2.1 },
  { key: 'mu', label: 'MU', color: '#f472b6', strokeWidth: 2.1 },
  { key: 'equip', label: 'AMAT / LRCX / KLAC', color: '#fb7185', strokeWidth: 2.1, dash: '5 4' },
  { key: 'amd', label: 'AMD', color: '#c084fc', strokeWidth: 2.1 },
]

function toneStyles(tone: Tone) {
  switch (tone) {
    case 'info':
      return { border: 'rgba(56, 189, 248, 0.26)', bg: 'rgba(8, 22, 38, 0.94)', fg: '#e0f2fe', accent: '#7dd3fc' }
    case 'good':
      return { border: 'rgba(34, 197, 94, 0.26)', bg: 'rgba(9, 25, 18, 0.94)', fg: '#dcfce7', accent: '#86efac' }
    case 'watch':
      return { border: 'rgba(245, 158, 11, 0.28)', bg: 'rgba(34, 24, 8, 0.94)', fg: '#fef3c7', accent: '#fbbf24' }
    case 'warn':
      return { border: 'rgba(249, 115, 22, 0.28)', bg: 'rgba(40, 17, 6, 0.94)', fg: '#ffedd5', accent: '#fdba74' }
    case 'danger':
      return { border: 'rgba(244, 63, 94, 0.30)', bg: 'rgba(35, 8, 16, 0.94)', fg: '#ffe4e6', accent: '#fda4af' }
    default:
      return { border: 'rgba(148, 163, 184, 0.18)', bg: 'rgba(15, 23, 42, 0.88)', fg: '#e2e8f0', accent: '#94a3b8' }
  }
}

function toneFromState(state: string | null | undefined): Tone {
  const upper = String(state ?? '').toUpperCase()
  if (['BROADENING', 'LEADING', 'ABOVE', 'MONETIZATION'].includes(upper)) return 'good'
  if (upper.includes('TIGHT')) return 'watch'
  if (['CONCENTRATED', 'MIXED', 'OVERINVESTMENT', 'WATCH'].includes(upper)) return 'watch'
  if (['WEAK', 'STRESS', 'BELOW', 'DEFENSE', 'CONTRACTION'].includes(upper)) return 'danger'
  if (['MILD', 'CAUTION', 'EXPECTATION'].includes(upper)) return 'warn'
  if (upper) return 'info'
  return 'neutral'
}

function toneFromStage(stage: string | null | undefined): Tone {
  return toneFromState(stage)
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

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '--'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatYearLabel(value: string | null | undefined): string {
  if (!value) return '--'
  const year = String(value).slice(0, 4)
  if (/^\d{4}$/.test(year)) return year
  return formatShortDate(value)
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
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
        padding: '0.34rem 0.72rem',
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

function MetricCard({ title, value, detail, tone = 'neutral' }: { title: string; value: string; detail: string; tone?: Tone }) {
  const styles = toneStyles(tone)
  return (
    <div style={{
      padding: '0.8rem 1rem',
      borderRadius: 16,
      border: `1px solid ${styles.border}`,
      background: 'rgba(15, 23, 42, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }}>
      <div style={{ fontSize: '0.7rem', color: styles.accent, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
        {detail}
      </div>
    </div>
  )
}

function SeriesPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        border: '1px solid rgba(148, 163, 184, 0.16)',
        background: 'rgba(15, 23, 42, 0.78)',
        color: '#e2e8f0',
        padding: '0.34rem 0.7rem',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 14px ${color}66`,
        }}
      />
      {label}
    </span>
  )
}

function Row({
  label,
  value,
  detail,
  tone = 'neutral',
  compact = false,
}: {
  label: string
  value: string
  detail: string
  tone?: Tone
  compact?: boolean
}) {
  const styles = toneStyles(tone)
  if (compact) {
    return (
      <div
        style={{
          flex: '1 0 240px',
          minWidth: 240,
          borderRadius: 18,
          border: `1px solid ${styles.border}`,
          background: `linear-gradient(180deg, ${styles.bg}, rgba(10, 14, 24, 0.98))`,
          boxShadow: '0 14px 30px rgba(0, 0, 0, 0.12)',
          padding: '0.95rem 1rem 1rem',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: '0.76rem', color: styles.accent, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: '1.15rem', color: '#f8fafc', fontWeight: 900, textAlign: 'right' }}>
            {value}
          </div>
        </div>
        <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#cbd5e1' }}>
          {detail}
        </div>
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: '0.95rem 0',
        borderTop: '1px solid rgba(148, 163, 184, 0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.76rem', color: styles.accent, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.15rem', color: '#f8fafc', fontWeight: 900 }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#cbd5e1' }}>
        {detail}
      </div>
    </div>
  )
}

function LeadershipTooltip({ active, label, payload, labelFormatter = formatShortDate }: any) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((item: any) => typeof item?.value === 'number')
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
        {labelFormatter(String(label))}
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        {rows.map((item: any) => (
          <div key={String(item.dataKey)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: item.color ?? '#e2e8f0', fontSize: '0.82rem', fontWeight: 800 }}>{item.name}</span>
            <strong style={{ fontSize: '0.88rem', fontWeight: 900 }}>{formatNumber(item.value, 1)}</strong>
          </div>
        ))}
      </div>
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

const PRIMARY_LEADER_KEYS = new Set(['nvda', 'tsm', 'avgo', 'mu'])

const OUTLOOK_SERIES: LeadershipSeriesConfig[] = [
  { key: 'demand', label: 'Industry Demand (Gartner)', color: '#f472b6', strokeWidth: 2.8 },
  { key: 'fab_spend', label: '300mm Fab Spend (SEMI)', color: '#7dd3fc', strokeWidth: 2.4 },
  { key: 'memory_spend', label: 'Memory Equipment Spend (SEMI)', color: '#34d399', strokeWidth: 2.2, dash: '5 4' },
]

type ChartBlockProps = {
  chartsReady: boolean
  eyebrow: string
  title: string
  description: string
  note?: string
  badges?: Array<{ label: string; tone?: Tone }>
  data: LeadershipChartPoint[]
  series: LeadershipSeriesConfig[]
  height: number
  syncId: string
  domainPadding?: number
  xTickFormatter?: (value: string) => string
  tooltipLabelFormatter?: (value: string) => string
}

function ChartBlock({
  chartsReady,
  eyebrow,
  title,
  description,
  note,
  badges,
  data,
  series,
  height,
  syncId,
  domainPadding = 10,
  xTickFormatter,
  tooltipLabelFormatter,
}: ChartBlockProps) {
  return (
    <section
      style={{
        borderRadius: 24,
        border: '1px solid rgba(56, 189, 248, 0.14)',
        background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))',
        boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)',
        padding: '1.15rem 1.15rem 1.2rem',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
            {eyebrow}
          </div>
          <h3 style={{ margin: '0.3rem 0 0', fontSize: '1.22rem', lineHeight: 1.2, color: '#f8fafc', fontWeight: 900 }}>
            {title}
          </h3>
          <p style={{ margin: '0.38rem 0 0', maxWidth: 920, fontSize: '0.92rem', lineHeight: 1.72, color: '#cbd5e1' }}>
            {description}
          </p>
        </div>
        {note ? <Badge label={note} tone="neutral" /> : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {series.map((item) => (
          <SeriesPill key={item.key} label={item.label} color={item.color} />
        ))}
      </div>

      {badges?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {badges.map((badge) => (
            <Badge key={badge.label} label={badge.label} tone={badge.tone ?? 'neutral'} />
          ))}
        </div>
      ) : null}

      {chartsReady ? (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId={syncId} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={xTickFormatter ?? formatShortDate}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                domain={[`dataMin - ${domainPadding}`, `dataMax + ${domainPadding}`]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={42}
              />
              <Tooltip content={<LeadershipTooltip labelFormatter={tooltipLabelFormatter ?? formatShortDate} />} />
              <ReferenceLine y={100} stroke="#475569" strokeDasharray="4 4" />
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={item.strokeWidth ?? 2}
                  strokeDasharray={item.dash}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            height,
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
    </section>
  )
}

export default function SoxlLeadershipPanel({ context }: { context: SoxxContextPayload | null }) {
  const [chartsReady, setChartsReady] = useState(false)

  useEffect(() => {
    setChartsReady(true)
  }, [])

  if (!context || !context.leadership_chart?.rows?.length) {
    return (
      <section style={buildFallbackStyle()}>
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
          반도체 레짐 모니터
        </div>
        <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.35rem', color: '#f8fafc', fontWeight: 900 }}>
          Data is not available yet
        </h2>
        <p style={{ margin: '0.6rem 0 0', maxWidth: 760 }}>
          Run <code style={{ background: 'rgba(15,23,42,0.9)', padding: '0.18rem 0.42rem', borderRadius: 6 }}>python marketflow/backend/scripts/build_soxx_context.py</code>
          {' '}to rebuild the context cache, then refresh this page.
        </p>
      </section>
    )
  }

  const current = context.current
  const chart = context.leadership_chart
  const summary = chart?.summary ?? context.leadership
  const series = chart?.series?.length ? chart.series : DEFAULT_SERIES
  const rows = chart?.rows ?? []
  const outlook = context.supply_demand_outlook
  const runway = context.runway

  // Leadership map data and tactical signal inputs
  const comparisonSeries = series.filter((item) => item.key === 'soxx' || PRIMARY_LEADER_KEYS.has(item.key))
  
  const cycleTone = toneFromState(current?.ai_cycle?.stage)
  const stateTone = toneFromState(summary?.state)
  const maTone = toneFromState(current?.risk?.soxx_ma200_state)
  const edge = current?.edge_cases || {}
  const outlookTone = toneFromState(outlook?.state)
  const runwayTone = toneFromState(runway?.state)
  const physicalDrivers = [
    {
      label: '파운드리 공급 / 가동률',
      value: formatPct(current?.physical_layer?.tsmc_util_pct, 1),
      detail: 'TSMC 가동률이 높을수록 웨이퍼 캐파가 타이트 → 가격 하방 지지. 85% 이상이면 공급 병목 지속.',
      tone: (current?.physical_layer?.tsmc_util_pct ?? 0) >= 85 ? 'watch' : 'good',
    },
    {
      label: '첨단 패키징 병목 (CoWoS)',
      value: `${formatNumber(current?.physical_layer?.cowos_lead_time_months, 0)} mo`,
      detail: 'CoWoS 리드타임이 길수록 패키징이 병목 → 사이클 제약 유지. 9개월 이상이면 공급 추가 여력 제한.',
      tone: (current?.physical_layer?.cowos_lead_time_months ?? 0) >= 9 ? 'watch' : 'info',
    },
    {
      label: '메모리 수율 / HBM',
      value: formatPct(current?.physical_layer?.hbm_yield_pct, 1),
      detail: 'HBM 수율이 낮을수록 메모리 공급 제약 → 가격 강세. 70% 이상이면 수율 안정화, 공급 여유 생길 수 있음.',
      tone: (current?.physical_layer?.hbm_yield_pct ?? 0) >= 70 ? 'good' : 'warn',
    },
  ] as const
  const economicDrivers = [
    {
      label: '수익화 / AI ROI (Capex/Rev)',
      value: `${formatNumber(current?.economic_layer?.capex_revenue_ratio, 2)}x`,
      detail: '1.0x 초과 = 번 돈보다 투자가 많음(Monetization Reset 경고). 1.0x 이하로 내려올 때 수익성 재평가 완료.',
      tone: (current?.economic_layer?.capex_revenue_ratio ?? 0) >= 1.2 ? 'warn' : 'info',
    },
    {
      label: '토큰 비용 곡선 / AI 확산',
      value: formatNumber(current?.economic_layer?.token_cost_index, 1),
      detail: '추론 비용이 낮아질수록 AI 사용이 넓어지고 수요 기반이 확대. 50 이하면 AI 확산 우호 환경.',
      tone: (current?.economic_layer?.token_cost_index ?? 0) <= 50 ? 'good' : 'watch',
    },
  ] as const

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      {/* 1. Header & Context */}
      <div
        style={{
          borderRadius: 24,
          border: '1px solid rgba(56, 189, 248, 0.14)',
          background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))',
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)',
          padding: '1.15rem 1.15rem 1.2rem',
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
            반도체 레짐 모니터
          </div>
          <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.08, color: '#f8fafc', fontWeight: 950 }}>
            SOXL Tactical Board
          </h2>
          <p style={{ margin: 0, maxWidth: 960, fontSize: '0.97rem', lineHeight: 1.82, color: '#cbd5e1' }}>
            This board tracks 3-4Y supply and demand, leadership breadth, and external shock risk. It is built to answer one question: does SOXL deserve leverage now, or should SOXX keep the anchor seat?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <Badge label="Base stance: HOLD" tone="good" />
            <Badge label={`Macro Beta: ${edge.macro_beta_score ?? '--'}`} tone="warn" />
            <Badge label={`Cycle Stage: ${current?.ai_cycle?.stage ?? 'UNKNOWN'}`} tone={cycleTone} />
            <Badge label={`Outlook: ${outlook?.state ?? 'UNKNOWN'}`} tone={outlookTone} />
            <Badge label={`Breadth Score: ${formatNumber(summary?.score, 1)} / 100`} tone={stateTone} />
            <Badge label={`Data As Of: ${context.data_as_of ?? '--'}`} tone="neutral" />
          </div>
        </div>
      </div>

      {runway ? (
        <section
          style={{
            display: 'grid',
            gap: 10,
            borderRadius: 22,
            border: '1px solid rgba(245, 158, 11, 0.18)',
            background: 'linear-gradient(180deg, rgba(20, 15, 5, 0.96), rgba(12, 10, 6, 0.98))',
            boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(245, 158, 11, 0.05) inset',
            padding: '1.05rem 1.1rem 1.08rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', color: '#fcd34d', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
              L1. Runway(전망)
            </div>
            <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.08rem', color: '#fef3c7', fontWeight: 900 }}>
              {runway.headline ?? '붐 런웨이는 2027년까지 이어질 가능성이 높습니다'}
            </h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: 1.72, color: '#fde68a' }}>
              {runway.summary ?? '수요 전망은 2027년까지 건설적으로 유지되고, 공급 측 CAPEX와 캐파는 계속 증가합니다 into 2029. Base stance is Hold; SOXL stays tactical because price can lead fundamentals by months.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={`Window: ${runway.horizon ?? '2027+'}`} tone={runwayTone} />
            <Badge label={`Stance: ${runway.stance ?? '보유 / 전술적 운용'}`} tone="watch" />
            <Badge label={`Next review: ${runway.next_review ?? '2026 Q3'}`} tone="neutral" />
            <Badge label={`Confidence: ${runway.confidence ?? '보통'}`} tone="info" />
          </div>

          <div style={{ fontSize: '0.84rem', lineHeight: 1.7, color: '#d97706' }}>
            <b>시사점 (Monetization 사이클):</b> {' '}
            3~4년 수급 전망이 긍정적이어도, 현재 우리가 어느 Monetization 단계(First-wave vs Reset)에 있는지 확인하세요.{' '}
            {runway.implication ?? 'SOXX는 계속 보유 가능하지만, SOXL 레버리지는 Valuation Reset(조정) 구간에서는 자본 보존 모드가 기본입니다. 넓은 수급 우위가 명확해질 때만 전술적으로 사용하세요.'}
          </div>
        </section>
      ) : null}

      {/* 2. Cycle Drivers */}
      <section
        style={{
          display: 'grid',
          gap: 14,
          marginTop: '0.2rem',
          borderRadius: 22,
          border: '1px solid rgba(148, 163, 184, 0.12)',
          background: 'linear-gradient(180deg, rgba(8, 15, 27, 0.96), rgba(10, 14, 24, 0.98))',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.04) inset',
          padding: '1.05rem 1.1rem 1.08rem',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
            L2. Cycle Drivers
          </div>
          <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc', fontWeight: 900 }}>
            현재 사이클이 존재하는 이유
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.72, color: '#cbd5e1' }}>
            반도체 사이클이 &quot;왜 지금 이 위치에 있는지&quot;를 설명하는 원인 레이어입니다.{' '}
            <b style={{ color: '#fbbf24' }}>Physical Layer(공급측)</b>는 TSMC 가동률·CoWoS 리드타임 등 공급 병목이 얼마나 타이트한지를 보여줍니다.{' '}
            <b style={{ color: '#7dd3fc' }}>Economic Layer(수요측)</b>는 AI 투자(capex)가 실제 매출로 전환되고 있는지—즉 버블이 아닌 진짜 수요인지를 확인합니다.{' '}
            두 레이어가 모두 양호할 때 사이클이 지속됩니다. 하나라도 꺾이면 경고 신호입니다.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge label="Physical Layer" tone="watch" />
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              공급 병목 지표 — TSMC 가동률이 높고 CoWoS 리드타임이 길수록 공급이 수요를 못 따라가는 상태 → 가격 지지 + 상승 여건
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {physicalDrivers.map((card) => (
              <MetricCard
                key={card.label}
                title={card.label}
                value={card.value}
                detail={card.detail}
                tone={card.tone}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge label="Economic Layer" tone="info" />
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              수요·수익화 지표 — Capex/Revenue &gt; 1.0 = 번 돈보다 투자가 많은 상태 → Monetization Reset 경고. 이 비율이 개선될 때 비로소 주가 재평가 가능
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {economicDrivers.map((card) => (
              <MetricCard
                key={card.label}
                title={card.label}
                value={card.value}
                detail={card.detail}
                tone={card.tone}
              />
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.84rem', lineHeight: 1.7, color: '#d97706' }}>
          <b>Structural note:</b> Custom silicon 비중 {formatPct(edge.custom_silicon_share_pct, 1)}.{' '}
          이 수치가 높아질수록 AI 수요가 NVDA 같은 Merchant GPU에서 하이퍼스케일러 자체 칩(TPU·Trainium 등)으로 분산 중.{' '}
          NVDA가 Laggard로 빠지는 구간과 자주 겹칩니다 — 리더십 재편의 초기 신호로 읽으세요.
        </div>
      </section>

      {/* 3. Outlook Section - Supply / Demand (3-4Y) */}
      {outlook ? (
        <section style={{ display: 'grid', gap: 12, marginTop: '1rem' }}>
          <div style={{ padding: '0 0.5rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>L3. Supply/Demand Outlook</div>
            <h3 style={{ margin: '0.3rem 0 0', fontSize: '1.08rem', color: '#f8fafc', fontWeight: 800 }}>3-4Y 수급 전망 (사이클 러닝웨이)</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              장기 수급 전망입니다. AI 수요가 계속 공급을 앞서갈 것인가, CAPEX 확충 속도는 얼마나 빠를 것인가를 결정하는 층입니다.{' '}
              <b>핵심</b>: 이 층이 긍정적이어도, 현재는 Monetization Reset(수익화 재평가) 단계일 수 있으므로, 단기 조정 리스크는 여전합니다. catches up into 2028-2029.
            </p>
          </div>

          {outlook.cards?.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {outlook.cards.map((card) => (
                <MetricCard
                  key={card.label ?? card.value ?? 'outlook-card'}
                  title={card.label ?? 'Outlook'}
                  value={card.value ?? '--'}
                  detail={card.detail ?? ''}
                  tone={card.tone ?? toneFromState(card.state)}
                />
              ))}
            </div>
          ) : null}

          {outlook.chart ? (
            <ChartBlock
              chartsReady={chartsReady}
              eyebrow="수급 전망 구간"
              title="수요 vs 공급 압력 (3~4년)"
              description={outlook.summary ?? '수요 전망은 2027년까지 명확하고, 공급 측 CAPEX와 캐파 확충은 2029년까지 이어집니다. 두 곡선이 교차하는 시점이 사이클 전환점입니다.'}
              note={outlook.chart.note}
              badges={[
                { label: `State: ${outlook.state ?? 'UNKNOWN'}`, tone: toneFromState(outlook.state) },
                { label: 'Demand through 2027', tone: 'watch' },
                { label: 'Supply through 2029', tone: 'info' },
              ]}
              data={outlook.chart.rows ?? []}
              series={outlook.chart.series?.length ? outlook.chart.series : OUTLOOK_SERIES}
              height={320}
              syncId="supply-demand-outlook"
              domainPadding={8}
              xTickFormatter={formatYearLabel}
              tooltipLabelFormatter={formatYearLabel}
            />
          ) : null}

          {outlook.sources?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 0.5rem', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }}>
              <span style={{ color: '#7dd3fc', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sources:</span>
              {outlook.sources.map((source) => (
                <span key={source.name} style={{ color: '#cbd5e1' }}>
                  {source.name}{source.details ? ` | ${source.details}` : ''}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 4. Leadership Map */}
      <div style={{ marginTop: '1rem' }}>
        <ChartBlock
          chartsReady={chartsReady}
          eyebrow="L4. Leadership Map"
          title="SOXX anchor with core leaders"
          description="SOXX를 앵커로 두고, NVDA/TSM/AVGO/MU 같은 코어 리더들이 함께 따라가는지 확인합니다. First-wave 단계에서는 리더십 확산이 명확하지만, Monetization Reset 단계에서는 리더십이 좁혀질 수 있습니다. 현재 구간이 First-wave인지 Reset인지 판단하는 데 이 지표가 중요합니다. whether the tape stays too concentrated for leverage."
          badges={[
            { label: `State: ${summary?.state ?? 'UNKNOWN'}`, tone: stateTone },
            { label: `SOXX MA200: ${current?.risk?.soxx_ma200_state ?? '--'}`, tone: maTone },
            { label: `RS 60D vs QQQ: ${formatPct(current?.relative_strength?.rs_60d_vs_qqq_pct, 1)}`, tone: 'info' },
          ]}
          data={rows}
          series={comparisonSeries}
          height={380}
          syncId="financial-layer"
        />
      </div>

      {/* 5. Investment Strategy Panel */}
      <section
        style={{
          borderRadius: 22,
          border: '1px solid rgba(245, 158, 11, 0.2)',
          background: 'linear-gradient(180deg, rgba(20, 15, 5, 0.98), rgba(15, 10, 5, 0.98))',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(245, 158, 11, 0.05) inset',
          padding: '1.25rem 1.4rem',
          display: 'grid',
          gap: 12,
          marginTop: '0.5rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.68rem', color: '#fcd34d', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 900 }}>
            L5. Decision Rules / Action Layer
          </div>
          <p style={{ margin: '0.45rem 0 0', fontSize: '1.05rem', lineHeight: 1.6, color: '#fef3c7', fontWeight: 700 }}>
            Actionable Guidance: {current?.guidance?.headline ?? 'SOXX를 기본으로 보유하세요. breadth와 수급이 확인될 때만 레버리지를 추가하세요'}
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: '0.92rem', lineHeight: 1.75, color: '#fde68a' }}>
          <div>
            <b>진입 신호 (Entry):</b> 기본값 Hold를 유지하세요.{' '}
            NVDA·TSM·AVGO 등 주요 리더들이 <b>함께</b> 오르는 Breadth 확장이 확인되고, 수급이 demand &gt; supply를 유지할 때만 SOXL 비중 추가를 검토합니다.{' '}
            대장주(NVDA)가 Laggard로 분류된 현 구간에서는 SOXL의 상승 동력이 제한적입니다 — Breadth가 좁은 랠리는 지속성이 낮습니다.
          </div>
          <div>
            <b>리스크 관리 (Risk Mgmt):</b> Monetization gap(AI 투자 vs 실제 매출 격차)이 벌어지면 노출을 줄이세요.{' '}
            Capex/Revenue &gt; 1.5x는 수익성 재평가 가속화 신호. 거시 충격 확률 상승 또는 SOXX MA200 이탈 시 즉시 Hold로 복귀합니다.
          </div>
          <div>
            <b>Current Guard Band:</b> <Badge label={current?.risk?.soxl_guard_band ?? 'UNKNOWN'} tone={(() => { const v = String(current?.risk?.soxl_guard_band ?? '').toUpperCase(); if (v.includes('GREEN')) return 'good' as const; if (v.includes('YELLOW') || v.includes('AMBER')) return 'warn' as const; if (v.includes('RED')) return 'danger' as const; if (v.includes('ORANGE')) return 'watch' as const; return 'neutral' as const; })()} />
            <span style={{ marginLeft: 8, color: '#fbbf24' }}>
              ATR Volatility Constraint: Proxy {formatPct(current?.risk?.soxl_proxy_dd_pct, 1)}
            </span>
          </div>
          <div>
            <b>무효화 조건 (Invalidation):</b> ① SOXX MA200 이탈 ② 리더십이 NVDA 1개 종목에 집중(Breadth 붕괴) ③ 3~4년 수급 전망이 tight → balanced로 조기 전환.{' '}
            이 중 하나라도 발생하면 — 업황이 살아있어도 — SOXL을 Hold 이하로 줄입니다.
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: '0.84rem', lineHeight: 1.7, color: '#d97706', marginTop: 8 }}>
          <div>* Leaders: {summary?.leaders?.length ? summary.leaders.join(' / ') : 'None'}</div>
          <div>* Laggards: {summary?.laggards?.length ? summary.laggards.join(' / ') : 'None'}</div>
        </div>
        <div
          style={{
            marginTop: 12,
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(245, 158, 11, 0.2)',
            background: 'rgba(20, 14, 4, 0.72)',
            fontSize: '0.82rem',
            lineHeight: 1.72,
            color: '#fde68a',
          }}
        >
          <b style={{ color: '#fcd34d' }}>왜 이 규칙인가? (Monetization Reset 관점)</b>{' '}—{' '}
          SOXL은 변동성이 QQQ의 3~4배입니다. 단순히 '업황이 좋다'고 해서 안전하지 않습니다.{' '}
          AI 산업은 두 단계를 거칩니다: ① <b>First-wave excitement</b> (GPU 주문 폭증) → ② <b>Monetization Reset</b> (실제 이익 재평가).{' '}
          Reset 단계에서는 <b>수급 지표가 여전히 양호해도</b> 주가는 조정됩니다 (Valuation Reset + Long Digestion).{' '}
          따라서 ① breadth + ② 수급 우위가 <b>동시에 확인</b>될 때만 SOXL 진입하고, SOXX MA200 이탈·수익 악화·재고 급등이 보이면 즉시 축소합니다.{' '}
          결론: "업황 좋음 = SOXL 매수"가 아니라 "업황 좋음 + 사이클 초기 + 넓은 수급 우위 = SOXL 전술"입니다.
        </div>
      </section>

      {/* 현재 상황 요약 박스 */}
      <section
        style={{
          borderRadius: 16,
          border: '1px solid rgba(56, 189, 248, 0.22)',
          background: 'linear-gradient(135deg, rgba(8, 20, 36, 0.98), rgba(10, 16, 28, 0.96))',
          padding: '1.1rem 1.25rem',
          display: 'grid',
          gap: 12,
          marginTop: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
          현재 대시보드 결론 / Today&apos;s Dashboard Reading
        </div>
        <p style={{ margin: 0, fontSize: '1.0rem', fontWeight: 800, lineHeight: 1.65, color: '#e0f2fe' }}>
          반도체 산업의 장기 성장은 의심할 여지가 없으나(Constructive),{' '}
          지금은 수익성 검증(Monetization Reset) 구간에 있어 SOXL의 높은 변동성에 노출되기 쉬운 시기입니다.
        </p>
        <div style={{ display: 'grid', gap: 8, fontSize: '0.88rem', lineHeight: 1.7, color: '#cbd5e1' }}>
          <div>
            <b style={{ color: '#34d399' }}>장기 뷰 (Constructive):</b>{' '}
            TSMC 가동률·CoWoS 병목·AI Capex 흐름이 3~4년 수급 우위를 지지 중. SOXX 보유는 유효합니다.
          </div>
          <div>
            <b style={{ color: '#fbbf24' }}>단기 리스크 (Reset):</b>{' '}
            Capex/Revenue 비율이 아직 1.0x 초과이고 대장주 리더십이 MIXED 또는 Laggard 구간. 주가는 수급보다 앞서 달렸고,
            시장은 '실제 이익이 얼마인가'를 재평가 중입니다. 이 구간에서 SOXL을 추가하는 것은 비대칭 리스크입니다.
          </div>
          <div>
            <b style={{ color: '#7dd3fc' }}>대응 전략:</b>{' '}
            SOXX 앵커 유지 → Breadth 확장 신호(주요 리더 전반 상승) 확인 → 그때 SOXL 전술 비중 소량 추가.
            대장주가 다시 Leader로 복귀하고 Capex/Revenue가 개선 추세를 보이면 리셋 구간 종료 신호로 해석합니다.
          </div>
        </div>
      </section>

    </section>
  )
}

