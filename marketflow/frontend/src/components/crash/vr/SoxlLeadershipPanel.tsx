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
  series?: LeadershipSeriesConfig[]
  rows?: LeadershipChartPoint[]
  summary?: LeadershipChartSummary
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
  if (['CONCENTRATED', 'MIXED', 'OVERINVESTMENT', 'WATCH'].includes(upper)) return 'watch'
  if (['WEAK', 'STRESS', 'BELOW', 'DEFENSE', 'CONTRACTION'].includes(upper)) return 'danger'
  if (['MILD', 'CAUTION', 'EXPECTATION'].includes(upper)) return 'warn'
  if (upper) return 'info'
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

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '--'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
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

function LeadershipTooltip({ active, label, payload }: any) {
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
        {formatShortDate(label)}
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
                tickFormatter={formatShortDate}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                domain={[`dataMin - ${domainPadding}`, `dataMax + ${domainPadding}`]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={42}
              />
              <Tooltip content={<LeadershipTooltip />} />
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
          Semiconductor Regime Monitor
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
  
  // Financial Layer Data (from legacy layout)
  const comparisonSeries = series.filter((item) => item.key === 'soxx' || PRIMARY_LEADER_KEYS.has(item.key))
  
  const cycleTone = toneFromState(current?.ai_cycle?.stage)
  const stateTone = toneFromState(summary?.state)
  const maTone = toneFromState(current?.risk?.soxx_ma200_state)
  
  const physical = current?.physical_layer || {}
  const economic = current?.economic_layer || {}
  const edge = current?.edge_cases || {}

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
            Semiconductor Regime Monitor
          </div>
          <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.08, color: '#f8fafc', fontWeight: 950 }}>
            SOXL 3-Layer Sensitivity Dashboard
          </h2>
          <p style={{ margin: 0, maxWidth: 960, fontSize: '0.97rem', lineHeight: 1.82, color: '#cbd5e1' }}>
            This monitor tracks the Semiconductor Cycle across three distinct layers: <b>Physical</b> (Supply Chain Bottlenecks), <b>Economic</b> (Demand & Monetization), and <b>Financial</b> (Price & Momentum). It uses these layers to dictate an actionable SOXL risk management strategy.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <Badge label={`Macro Beta: ${edge.macro_beta_score ?? '--'}`} tone="warn" />
            <Badge label={`Cycle Stage: ${current?.ai_cycle?.stage ?? 'UNKNOWN'}`} tone={cycleTone} />
            <Badge label={`Breadth Score: ${formatNumber(summary?.score, 1)} / 100`} tone={stateTone} />
            <Badge label={`Data As Of: ${context.data_as_of ?? '--'}`} tone="neutral" />
          </div>
        </div>
      </div>

      {/* 2. Top Section - Physical Layer (Supply & Bottlenecks) */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: '0 0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 800 }}>L1. Physical Layer (Supply & Bottlenecks)</h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Tracking TSMC utilization, Advanced Packaging (CoWoS) lead times, and HBM yields to identify physical constraints.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <MetricCard
            title="TSMC Utilization"
            value={formatPct(physical.tsmc_util_pct, 1)}
            detail="Foundry capacity utilization rate."
            tone={physical.tsmc_util_pct && physical.tsmc_util_pct > 90 ? 'good' : 'neutral'}
          />
          <MetricCard
            title="CoWoS Lead Time"
            value={`${physical.cowos_lead_time_months ?? '--'} Months`}
            detail="Advanced Packaging Equipment backlog."
            tone="watch"
          />
          <MetricCard
            title="HBM Yield"
            value={formatPct(physical.hbm_yield_pct, 1)}
            detail="Memory bottleneck processing rate."
            tone="info"
          />
          <MetricCard
            title="Custom Silicon Share"
            value={formatPct(edge.custom_silicon_share_pct, 1)}
            detail="Hyperscaler ASICs vs Merchant Silicon."
            tone="warn"
          />
        </div>
      </section>

      {/* 3. Middle Section - Economic Layer (Demand & Monetization) */}
      <section style={{ display: 'grid', gap: 12, marginTop: '1rem' }}>
        <div style={{ padding: '0 0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 800 }}>L2. Economic Layer (Demand & Monetization)</h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Comparing Hyperscaler CapEx against AI Revenue Yields to evaluate the "Monetization Gap".
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <MetricCard
            title="CapEx / Revenue Ratio"
            value={`${economic.capex_revenue_ratio ?? '--'}x`}
            detail="Capital Intensity relative to service monetization. Higher values indicate over-investment risk."
            tone={economic.capex_revenue_ratio && economic.capex_revenue_ratio > 1.2 ? 'danger' : 'good'}
          />
          <MetricCard
            title="Token Cost Index"
            value={formatNumber(economic.token_cost_index, 1)}
            detail="Inference cost proxy. Decaying costs drive broader AI service adoption."
            tone="good"
          />
        </div>
      </section>

      {/* 4. Bottom Section - Financial Layer (Price & Momentum) */}
      <div style={{ marginTop: '1rem' }}>
        <ChartBlock
          chartsReady={chartsReady}
          eyebrow="L3. Financial Layer"
          title="Leadership Breadth & Momentum"
          description="Monitoring the relative strength of core leaders (NVDA, TSM, AVGO, MU) vs SOXX. Broadening breadth confirms cycle health; concentrated leadership flags risk."
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
          <div style={{ fontSize: '0.75rem', color: '#fcd34d', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 900 }}>
            Practical Investment Strategy (SOXL)
          </div>
          <p style={{ margin: '0.45rem 0 0', fontSize: '1.05rem', lineHeight: 1.6, color: '#fef3c7', fontWeight: 700 }}>
            Actionable Guidance: {current?.guidance?.headline ?? 'Hold SOXL allocation based on ATR bands'}
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: '0.92rem', lineHeight: 1.75, color: '#fde68a' }}>
          <div>
            <b>Entry Signals:</b> Wait for Breadth expansion (leadership dispersion) and upward guidance revisions in the Physical Layer.
          </div>
          <div>
            <b>Risk Management:</b> Employ an ATR-based Volatility Band approach. Reduce exposure if the Monetization Gap widens or Macro Beta spikes.
          </div>
          <div>
            <b>Current Guard Band:</b> <Badge label={current?.risk?.soxl_guard_band ?? 'UNKNOWN'} tone="danger" />
            <span style={{ marginLeft: 8, color: '#fbbf24' }}>
              ATR Volatility Constraint: Proxy {formatPct(current?.risk?.soxl_proxy_dd_pct, 1)}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: '0.84rem', lineHeight: 1.7, color: '#d97706', marginTop: 8 }}>
          <div>* Leaders: {summary?.leaders?.length ? summary.leaders.join(' / ') : 'None'}</div>
          <div>* Laggards: {summary?.laggards?.length ? summary.laggards.join(' / ') : 'None'}</div>
        </div>
      </section>

    </section>
  )
}
