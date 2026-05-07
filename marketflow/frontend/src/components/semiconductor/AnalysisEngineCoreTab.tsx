// 반도체 산업 사이클 분석 엔진 — ENGINE 탭 메인 컴포넌트 (3-Layer Pyramid 기반)
'use client'
import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ── Design Tokens ───────────────────────────────────────────────────────────
const UI_FONT   = "'IBM Plex Sans', sans-serif"   // labels, descriptions, UI text
const DATA_FONT = "'IBM Plex Mono', monospace"     // numbers, percentages, tickers, dates

const C = {
  bg:       '#0C1628',
  panel:    '#111d35',
  border:   '#1e3a5f',
  teal:     '#3FB6A8',
  amber:    '#F2A93B',
  red:      '#E55A5A',
  gold:     '#D4B36A',
  blue:     '#4A9EFF',
  muted:    '#8b9bb4',
  text:     '#c9d4e8',
  white:    '#ffffff',
} as const

// ── Types ───────────────────────────────────────────────────────────────────
interface LensKpis {
  engine_score: number
  strategy_score: number
  stage: string
  cycle_position: number
  has_conflict: boolean
  conflict_type: string
  breadth_pct: number
  breadth_label: string
  advancing_pct: number
  declining_pct: number
  market_regime: string
  soxx_price: number
  confidence_score: number
  confidence_label: string
  primary_driver: string
  primary_risk: string
  internal_signal: number
  domain_signals: Record<string, number>
  conflict_note: string
  leader_concentration_top5: number | null
  equal_weight_vs_cap_spread: number | null
}

interface LensData {
  as_of: string
  kpis: LensKpis
  buckets: Array<{ name: string; color: string; price: string; m6: string; vs_soxx: string; rs: string; up: boolean }>
  rs_table: Array<{ name: string; rs: string; vs: string; up: boolean }>
  breadth_detail: {
    pct_above_ma20: number | null
    pct_above_ma50: number | null
    pct_above_ma200: number | null
    universe_count: number
    breadth_history: Array<{
      date: string; breadth_score: number
      advancing_pct: number | null; declining_pct: number | null
    }>
  } | null
  momentum_detail: {
    rsi_14: number | null
    macd: { value: number | null; signal: number | null; histogram: number | null; state: string } | null
    roc_1m: number | null; roc_3m: number | null; roc_6m: number | null
    momentum_history: Array<{
      date: string; momentum_score: number | null; rsi_14?: number | null
    }>
  } | null
  market_cap_weights: Array<{
    ticker: string; bucket: string
    market_cap: number | null; weight: number | null
    return_1d: number | null; return_1m: number | null
  }> | null
  bucket_weights: Array<{ bucket: string; weight: number | null; return_1m: number | null }> | null
  ai_infra_concentration_history: Array<{
    date: string; top5_weight: number | null; ew_vs_cw_spread: number | null
  }> | null
}

type InterpData = {
  summary: string; alignment: string; support: string[]; weakness: string[]
  interpretation: string; context?: string; confidence: string
  regime_context?: string
  ai_regime?: {
    regime_label: string; regime_confidence: string; data_mode: string
    ai_infra: { state: string; signal: number; spread: number; note: string; sources: string[] }
    memory: { state: string; signal: number; spread: number; note: string; sources: string[] }
    foundry: { state: string; signal: number; spread: number; note: string; sources: string[] }
    equipment: { state: string; signal: number; spread: number; note: string; sources: string[] }
    rotation_risk: { state: string; signal: number; spread: number; note: string; sources: string[] }
  }
} | null

type HistoryData = {
  rows: Array<{ date: string; soxx: number; ai: number; mem: number; foundry: number; equip: number; comp: number; avg: number; phase: string }>
  phase_probability: { early: number; expansion: number; peak: number; contraction: number }
  current_composite: number
} | null

interface Props {
  live: LensData | null
  interpData: InterpData
  history: HistoryData
}

// ── Mock Phase 2 Data (TSMC / CapEx / B2B pending real API) ─────────────────
const MOCK_TSMC_YOY   = +18.4   // %YoY — placeholder until TSMC API live
const MOCK_CAPEX_QOQ  = +6.2    // %QoQ — placeholder until CapEx API live
const MOCK_B2B_RATIO  = 1.08    // ratio — placeholder until B2B API live

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number | null, unit = '%', digits = 1): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}${unit}`
}

function stageColor(stage: string): string {
  const s = stage.toUpperCase()
  if (s.includes('CONTRACTION') || s.includes('PEAK')) return C.red
  if (s.includes('LATE')) return C.amber
  if (s.includes('MID') || s.includes('EXPANSION')) return C.teal
  if (s.includes('RECOVERY') || s.includes('TROUGH') || s.includes('EARLY')) return C.blue
  return C.muted
}

function scoreToAngle(score: number): number {
  return -135 + (score / 100) * 270
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col justify-center px-4 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ fontFamily: UI_FONT, color: C.muted }}>{label}</span>
      <span className="text-[26px] font-black leading-none mt-1 truncate" style={{ fontFamily: DATA_FONT, color }}>{value}</span>
      <span className="text-[11px] mt-1 truncate" style={{ fontFamily: UI_FONT, color: C.muted }}>{sub}</span>
    </div>
  )
}

function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border flex flex-col ${className}`} style={{ backgroundColor: C.panel, borderColor: C.border }}>
      {title && (
        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: C.border }}>
          <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ fontFamily: UI_FONT, color: C.muted }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  )
}

// ── Cycle Gauge SVG ──────────────────────────────────────────────────────────
function CycleGauge({ score, stage }: { score: number; stage: string }) {
  const angle = scoreToAngle(score)
  const rad   = (angle * Math.PI) / 180
  const cx = 80, cy = 80, r = 62
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)
  const color = stageColor(stage)

  // Arc segments (4 zones)
  function describeArc(startDeg: number, endDeg: number) {
    const s = ((startDeg - 90) * Math.PI) / 180
    const e = ((endDeg   - 90) * Math.PI) / 180
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const zones = [
    { start: -135, end: -67, color: C.blue,  label: 'Recovery' },
    { start: -67,  end:  0,  color: C.teal,  label: 'Expansion' },
    { start: 0,    end:  67, color: C.amber, label: 'Peak' },
    { start: 67,   end: 135, color: C.red,   label: 'Contraction' },
  ]

  return (
    <svg width="160" height="110" viewBox="0 0 160 110">
      {zones.map(z => {
        const s = ((z.start) * Math.PI) / 180
        const e = ((z.end)   * Math.PI) / 180
        const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
        const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
        const large = Math.abs(z.end - z.start) > 180 ? 1 : 0
        return (
          <path key={z.label}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
            fill="none" stroke={z.color} strokeWidth={10} strokeOpacity={0.25}
          />
        )
      })}
      {/* Active arc up to current score */}
      {(() => {
        const s = ((-135) * Math.PI) / 180
        const e = (angle * Math.PI) / 180
        const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
        const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
        const large = score > 50 ? 1 : 0
        return (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        )
      })()}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={color} />
      {/* Score label */}
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={28} fontWeight={900}
        fill={color} fontFamily="'IBM Plex Mono', monospace">{score}</text>
      <text x={cx} y={cy + 40} textAnchor="middle" fontSize={11}
        fill={C.muted} fontFamily="'IBM Plex Sans', sans-serif">CYCLE SCORE</text>
    </svg>
  )
}

// ── Stage Timeline ───────────────────────────────────────────────────────────
const STAGE_SEQUENCE = ['Recovery', 'Expansion', 'Peak', 'Contraction']
const STAGE_COLORS: Record<string, string> = {
  Recovery: C.blue, Expansion: C.teal, Peak: C.amber, Contraction: C.red,
}

function StageTimeline({ stage }: { stage: string }) {
  const normalized = STAGE_SEQUENCE.find(s =>
    stage.toUpperCase().includes(s.toUpperCase())
  ) ?? 'Expansion'
  const activeIdx = STAGE_SEQUENCE.indexOf(normalized)

  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGE_SEQUENCE.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex-1 h-[3px] rounded-full transition-all`}
            style={{ backgroundColor: i <= activeIdx ? STAGE_COLORS[s] : C.border }} />
          <div className="relative flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full border`}
              style={{
                backgroundColor: i === activeIdx ? STAGE_COLORS[s] : 'transparent',
                borderColor: i <= activeIdx ? STAGE_COLORS[s] : C.border,
              }} />
            <span className="text-[9px] absolute -bottom-4 whitespace-nowrap"
              style={{ color: i === activeIdx ? STAGE_COLORS[s] : C.muted, fontFamily: UI_FONT }}>
              {s}
            </span>
          </div>
          {i < STAGE_SEQUENCE.length - 1 && (
            <div className={`flex-1 h-[3px] rounded-full`}
              style={{ backgroundColor: i < activeIdx ? STAGE_COLORS[s] : C.border }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── 5Y Cycle Band Chart ──────────────────────────────────────────────────────
type HistoryRow = NonNullable<HistoryData>['rows'][number]

function CycleBandChart({ historyRows }: { historyRows: NonNullable<HistoryData>['rows'] | null }) {
  if (!historyRows || historyRows.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[11px]" style={{ color: C.muted, fontFamily: UI_FONT }}>
        Cycle history pending
      </div>
    )
  }

  const data = historyRows.slice(-60).map((r: HistoryRow) => ({
    date: r.date.slice(5), // MM-DD
    avg: r.avg,
    ai:  r.ai,
  }))

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="eng-avg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.teal} stopOpacity={0.3} />
            <stop offset="95%" stopColor={C.teal} stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="eng-ai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={C.blue} stopOpacity={0.2} />
            <stop offset="95%" stopColor={C.blue} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false}
          tick={{ fill: C.muted, fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} axisLine={false} tickLine={false}
          tick={{ fill: C.muted, fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontSize: 11 }}
          formatter={(v: unknown, name: string) => [String(v), name === 'avg' ? 'Composite' : 'AI Infra']} />
        <Area type="monotone" dataKey="avg" stroke={C.teal} strokeWidth={2} fill="url(#eng-avg)" dot={false} />
        <Area type="monotone" dataKey="ai"  stroke={C.blue} strokeWidth={1.5} fill="url(#eng-ai)" dot={false} strokeDasharray="4 2" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Domain Signal Row ────────────────────────────────────────────────────────
function DomainRow({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const clr = value >= 60 ? C.teal : value >= 40 ? C.amber : C.red
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[11px] w-[90px] shrink-0 truncate" style={{ fontFamily: UI_FONT, color: C.muted }}>{label}</span>
      <div className="flex-1 h-[4px] rounded-full" style={{ backgroundColor: C.border }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: clr }} />
      </div>
      <span className="text-[12px] font-bold w-[32px] text-right" style={{ fontFamily: DATA_FONT, color: clr }}>{value}</span>
    </div>
  )
}

// ── Concentration Gauge ──────────────────────────────────────────────────────
function ConcentrationGauge({ top5Pct, ewCwSpread }: { top5Pct: number | null; ewCwSpread: number | null }) {
  const pct   = top5Pct ?? 0
  const angle = -90 + (pct / 100) * 180
  const rad   = (angle * Math.PI) / 180
  const cx = 60, cy = 50, r = 40
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)
  const clr = pct > 65 ? C.red : pct > 50 ? C.amber : C.teal

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="65" viewBox="0 0 120 65">
        {/* Background arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={C.border} strokeWidth={10} />
        {/* Fill arc */}
        {pct > 0 && (() => {
          const ea = -90 + (pct / 100) * 180
          const er = (ea * Math.PI) / 180
          const x2 = cx + r * Math.cos(er)
          const y2 = cy + r * Math.sin(er)
          const large = pct > 50 ? 1 : 0
          return (
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none" stroke={clr} strokeWidth={10} strokeLinecap="round" />
          )
        })()}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={clr} strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={3} fill={clr} />
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={16} fontWeight={900}
          fill={clr} fontFamily="'IBM Plex Mono', monospace">
          {top5Pct !== null ? `${top5Pct.toFixed(0)}%` : '—'}
        </text>
      </svg>
      <div className="text-center mt-1">
        <div className="text-[10px] uppercase tracking-[0.10em]" style={{ color: C.muted, fontFamily: UI_FONT }}>Top-5 Weight</div>
        {ewCwSpread !== null && (
          <div className="text-[11px] mt-0.5" style={{ color: C.muted, fontFamily: DATA_FONT }}>
            EW–CW: <span style={{ color: ewCwSpread < 0 ? C.red : C.teal }}>{fmt(ewCwSpread)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bucket Map ───────────────────────────────────────────────────────────────
function BucketMap({ buckets }: { buckets: LensData['buckets'] }) {
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {buckets.map(b => {
        const rsNum = parseFloat(b.rs)
        const isUp  = !isNaN(rsNum) ? rsNum > 0 : b.up
        const clr   = isUp ? C.teal : C.red
        return (
          <div key={b.name} className="rounded border p-2 flex flex-col gap-0.5"
            style={{ borderColor: clr + '33', backgroundColor: clr + '11' }}>
            <span className="text-[10px] font-bold uppercase truncate" style={{ fontFamily: UI_FONT, color: C.text }}>{b.name}</span>
            <span className="text-[14px] font-black" style={{ fontFamily: DATA_FONT, color: clr }}>{b.vs_soxx}</span>
            <span className="text-[10px]" style={{ color: C.muted, fontFamily: DATA_FONT }}>RS: {b.rs}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Breadth Chart ────────────────────────────────────────────────────────────
function BreadthChart({ breadthHistory }: { breadthHistory: LensData['breadth_detail'] }) {
  if (!breadthHistory) return (
    <div className="h-[160px] flex items-center justify-center text-[11px]" style={{ color: C.muted }}>Breadth data pending</div>
  )
  const data = breadthHistory.breadth_history.slice(-60).map(r => ({
    date: r.date.slice(5),
    score: r.breadth_score,
    adv: r.advancing_pct ?? null,
    dec: r.declining_pct ?? null,
  }))
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontSize: 11 }} />
        <ReferenceLine y={50} stroke={C.border} strokeDasharray="2 4" />
        <Line type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2} dot={false} name="Breadth" />
        <Line type="monotone" dataKey="adv"   stroke={C.blue} strokeWidth={1} dot={false} name="Advancing" strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Performance Table ────────────────────────────────────────────────────────
function PerformanceTable({ buckets, bucketWeights }: { buckets: LensData['buckets']; bucketWeights: LensData['bucket_weights'] }) {
  const weightMap = useMemo(() => {
    const m: Record<string, number | null> = {}
    bucketWeights?.forEach(b => { m[b.bucket] = b.weight })
    return m
  }, [bucketWeights])

  return (
    <div className="overflow-auto">
      <table className="w-full text-[12px]" style={{ fontFamily: DATA_FONT }}>
        <thead>
          <tr className="border-b" style={{ borderColor: C.border }}>
            {['BUCKET', 'WEIGHT', '6M', 'vs SOXX', 'RS'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.10em] font-bold"
                style={{ color: C.muted, fontFamily: UI_FONT }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const rsNum  = parseFloat(b.rs)
            const clr    = !isNaN(rsNum) && rsNum > 0 ? C.teal : C.red
            const weight = weightMap[b.name]
            return (
              <tr key={b.name} className="border-b" style={{ borderColor: C.border + '44' }}>
                <td className="px-3 py-1.5 font-bold text-[11px]" style={{ color: C.text, fontFamily: UI_FONT }}>{b.name}</td>
                <td className="px-3 py-1.5" style={{ color: C.muted }}>
                  {weight !== undefined && weight !== null ? `${weight.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-1.5" style={{ color: b.up ? C.teal : C.red }}>{b.m6}</td>
                <td className="px-3 py-1.5" style={{ color: clr }}>{b.vs_soxx}</td>
                <td className="px-3 py-1.5 font-bold" style={{ color: clr }}>{b.rs}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Health Panel ─────────────────────────────────────────────────────────────
function HealthPanel({ live }: { live: LensData }) {
  const mom  = live.momentum_detail
  const rsi  = mom?.rsi_14
  const macd = mom?.macd

  const rsiColor = rsi == null ? C.muted : rsi > 70 ? C.red : rsi < 30 ? C.blue : C.teal
  const macdColor = macd?.histogram === null || macd?.histogram === undefined ? C.muted
    : macd.histogram > 0 ? C.teal : C.red

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-1" style={{ fontFamily: UI_FONT, color: C.muted }}>MOMENTUM INDICATORS</div>
        <div className="flex justify-between items-baseline py-1.5 border-b" style={{ borderColor: C.border + '44' }}>
          <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>RSI (14)</span>
          <span className="text-[18px] font-black" style={{ fontFamily: DATA_FONT, color: rsiColor }}>
            {rsi !== null && rsi !== undefined ? rsi.toFixed(1) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-baseline py-1.5 border-b" style={{ borderColor: C.border + '44' }}>
          <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>MACD Hist</span>
          <span className="text-[18px] font-black" style={{ fontFamily: DATA_FONT, color: macdColor }}>
            {macd?.histogram !== null && macd?.histogram !== undefined ? macd.histogram.toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-baseline py-1.5 border-b" style={{ borderColor: C.border + '44' }}>
          <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>ROC 1M</span>
          <span className="text-[16px] font-bold" style={{ fontFamily: DATA_FONT, color: mom?.roc_1m != null && mom.roc_1m > 0 ? C.teal : C.red }}>
            {mom?.roc_1m != null ? fmt(mom.roc_1m) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-baseline py-1.5" style={{ borderColor: C.border + '44' }}>
          <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>ROC 3M</span>
          <span className="text-[16px] font-bold" style={{ fontFamily: DATA_FONT, color: mom?.roc_3m != null && mom.roc_3m > 0 ? C.teal : C.red }}>
            {mom?.roc_3m != null ? fmt(mom.roc_3m) : '—'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-1" style={{ fontFamily: UI_FONT, color: C.muted }}>BREADTH SNAPSHOT</div>
        {[
          { label: 'Above MA20',  val: live.breadth_detail?.pct_above_ma20  },
          { label: 'Above MA50',  val: live.breadth_detail?.pct_above_ma50  },
          { label: 'Above MA200', val: live.breadth_detail?.pct_above_ma200 },
        ].map(row => (
          <div key={row.label} className="flex justify-between items-baseline py-1.5 border-b" style={{ borderColor: C.border + '44' }}>
            <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>{row.label}</span>
            <span className="text-[16px] font-bold"
              style={{ fontFamily: DATA_FONT, color: row.val != null && row.val > 50 ? C.teal : row.val != null ? C.amber : C.muted }}>
              {row.val != null ? `${row.val.toFixed(0)}%` : '—'}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-baseline py-1.5" style={{ borderColor: C.border + '44' }}>
          <span className="text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>Universe</span>
          <span className="text-[16px] font-bold" style={{ fontFamily: DATA_FONT, color: C.text }}>
            {live.breadth_detail?.universe_count ?? '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── SOXL Environment Panel ───────────────────────────────────────────────────
function SoxlEnvPanel({ live, interpData }: { live: LensData; interpData: InterpData }) {
  const regime    = interpData?.ai_regime?.regime_label ?? 'UNKNOWN'
  const regConf   = interpData?.ai_regime?.regime_confidence ?? '?'
  const rotRisk   = interpData?.ai_regime?.rotation_risk
  const engineScore = live.kpis.engine_score
  const stratScore  = live.kpis.strategy_score

  const envColor = engineScore >= 65 ? C.teal : engineScore >= 40 ? C.amber : C.red
  const envLabel = engineScore >= 65 ? 'FAVORABLE' : engineScore >= 40 ? 'NEUTRAL' : 'HOSTILE'

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Environment badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: envColor + '44', backgroundColor: envColor + '11' }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-0.5" style={{ fontFamily: UI_FONT, color: C.muted }}>SOXL ENVIRONMENT</div>
          <div className="text-[24px] font-black" style={{ fontFamily: DATA_FONT, color: envColor }}>{envLabel}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px]" style={{ color: C.muted, fontFamily: UI_FONT }}>Strategy Score</div>
          <div className="text-[22px] font-black" style={{ fontFamily: DATA_FONT, color: envColor }}>{stratScore}</div>
        </div>
      </div>

      {/* AI Regime */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border p-3" style={{ borderColor: C.border }}>
          <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-1" style={{ fontFamily: UI_FONT, color: C.muted }}>AI REGIME</div>
          <div className="text-[16px] font-bold truncate" style={{ fontFamily: DATA_FONT, color: C.blue }}>{regime}</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted, fontFamily: UI_FONT }}>Confidence: {regConf}</div>
        </div>
        <div className="rounded border p-3" style={{ borderColor: C.border }}>
          <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-1" style={{ fontFamily: UI_FONT, color: C.muted }}>ROTATION RISK</div>
          <div className="text-[16px] font-bold truncate"
            style={{ fontFamily: DATA_FONT, color: rotRisk?.signal != null && rotRisk.signal < 40 ? C.red : C.amber }}>
            {rotRisk?.state ?? '—'}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted, fontFamily: UI_FONT }}>
            Signal: {rotRisk?.signal != null ? rotRisk.signal : '—'}
          </div>
        </div>
      </div>

      {/* L1 Fundamental layer note */}
      <div className="rounded border p-3 text-[12px]" style={{ borderColor: C.border }}>
        <div className="text-[10px] uppercase tracking-[0.10em] font-bold mb-2" style={{ fontFamily: UI_FONT, color: C.muted }}>L1 FUNDAMENTAL SIGNALS (PHASE 2 PENDING)</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div style={{ color: C.muted, fontFamily: UI_FONT, fontSize: 10 }}>TSMC YoY</div>
            <div style={{ fontFamily: DATA_FONT, color: MOCK_TSMC_YOY > 0 ? C.teal : C.red, fontWeight: 700 }}>
              {fmt(MOCK_TSMC_YOY)} <span style={{ fontSize: 9, opacity: 0.6 }}>mock</span>
            </div>
          </div>
          <div>
            <div style={{ color: C.muted, fontFamily: UI_FONT, fontSize: 10 }}>CapEx QoQ</div>
            <div style={{ fontFamily: DATA_FONT, color: MOCK_CAPEX_QOQ > 0 ? C.teal : C.red, fontWeight: 700 }}>
              {fmt(MOCK_CAPEX_QOQ)} <span style={{ fontSize: 9, opacity: 0.6 }}>mock</span>
            </div>
          </div>
          <div>
            <div style={{ color: C.muted, fontFamily: UI_FONT, fontSize: 10 }}>B2B Ratio</div>
            <div style={{ fontFamily: DATA_FONT, color: MOCK_B2B_RATIO >= 1 ? C.teal : C.red, fontWeight: 700 }}>
              {MOCK_B2B_RATIO.toFixed(2)} <span style={{ fontSize: 9, opacity: 0.6 }}>mock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Right Panel: AI vs Legacy ────────────────────────────────────────────────
function AiVsLegacyPanel({ interpData, domainSignals }: { interpData: InterpData; domainSignals: Record<string, number> }) {
  const ai  = interpData?.ai_regime?.ai_infra
  const mem = interpData?.ai_regime?.memory

  return (
    <Panel title="AI vs LEGACY SPLIT" className="flex-1">
      <div className="p-3 flex flex-col gap-2">
        {ai && (
          <div className="rounded border p-2.5" style={{ borderColor: C.blue + '44', backgroundColor: C.blue + '0a' }}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] font-bold uppercase" style={{ fontFamily: UI_FONT, color: C.blue }}>AI INFRA</span>
              <span className="text-[14px] font-black" style={{ fontFamily: DATA_FONT, color: C.blue }}>{ai.signal}</span>
            </div>
            <div className="text-[10px] truncate" style={{ color: C.muted, fontFamily: UI_FONT }}>{ai.state}</div>
          </div>
        )}
        {mem && (
          <div className="rounded border p-2.5" style={{ borderColor: C.amber + '44', backgroundColor: C.amber + '0a' }}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] font-bold uppercase" style={{ fontFamily: UI_FONT, color: C.amber }}>MEMORY</span>
              <span className="text-[14px] font-black" style={{ fontFamily: DATA_FONT, color: C.amber }}>{mem.signal}</span>
            </div>
            <div className="text-[10px] truncate" style={{ color: C.muted, fontFamily: UI_FONT }}>{mem.state}</div>
          </div>
        )}
        <div className="mt-1">
          {Object.entries(domainSignals).slice(0, 4).map(([k, v]) => (
            <DomainRow key={k} label={k} value={v} />
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── Interpretation Card (6 blocks) ───────────────────────────────────────────
function InterpCard({ interpData, live }: { interpData: InterpData; live: LensData }) {
  if (!interpData) return (
    <Panel title="INTERPRETATION" className="flex-1">
      <div className="p-4 text-[12px]" style={{ color: C.muted, fontFamily: UI_FONT }}>Loading interpretation…</div>
    </Panel>
  )

  const blocks = [
    { id: '①', label: 'SUMMARY',    text: interpData.summary },
    { id: '②', label: 'STATE',      text: interpData.alignment },
    { id: '③', label: 'WHY',        text: interpData.interpretation },
    { id: '④', label: 'CONSTRAINT', text: interpData.context ?? interpData.regime_context ?? '—' },
    { id: '⑤', label: 'DELTA',      text: interpData.support.join(' · ') || '—' },
    { id: '⑥', label: 'WATCH',      text: interpData.weakness.join(' · ') || '—' },
  ]

  return (
    <Panel title="INTERPRETATION ENGINE" className="flex-1">
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px]" style={{ color: C.muted, fontFamily: UI_FONT }}>Confidence</span>
          <span className="text-[13px] font-bold" style={{ fontFamily: DATA_FONT, color: live.kpis.confidence_score >= 70 ? C.teal : C.amber }}>
            {live.kpis.confidence_label} ({live.kpis.confidence_score})
          </span>
        </div>
        {blocks.map(b => (
          <div key={b.id} className="border-l-2 pl-2.5 py-0.5" style={{ borderColor: C.border }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-0.5" style={{ color: C.muted, fontFamily: UI_FONT }}>
              {b.id} {b.label}
            </div>
            <div className="text-[11px] leading-snug" style={{ color: C.text, fontFamily: UI_FONT }}>{b.text}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
const CENTER_TABS = ['MAP', 'CYCLE VIEW', 'PERFORMANCE', 'HEALTH', '⚡ SOXL ENV'] as const
type CenterTab = typeof CENTER_TABS[number]

export default function AnalysisEngineCoreTab({ live, interpData, history }: Props) {
  const [centerTab, setCenterTab] = useState<CenterTab>('MAP')

  const kpis    = live?.kpis
  const score   = kpis?.engine_score   ?? 0
  const stage   = kpis?.stage          ?? 'EXPANSION'
  const breadth = kpis?.breadth_pct    ?? 0
  const conf    = kpis?.confidence_score ?? 0

  // ── ENGINE KPI Strip values ──────────────────────────────────────────────
  const soxxMirror = useMemo(() => {
    // Approximation: how well SOXX price reflects L1 fundamentals
    if (!kpis) return null
    const raw = (kpis.internal_signal + kpis.engine_score) / 2
    return Math.round(raw)
  }, [kpis])

  const domainSignals = kpis?.domain_signals ?? {}

  return (
    <div className="flex flex-col gap-0" style={{ backgroundColor: C.bg }}>

      {/* ── ENGINE KPI Strip ─────────────────────────────────────────────── */}
      <div className="h-[80px] w-full shrink-0 border-b grid grid-cols-5 divide-x divide-[#1e3a5f]"
        style={{ borderColor: C.border, backgroundColor: '#0a1628' }}>

        <KpiCard
          label="CYCLE SCORE"
          value={live ? String(score) : '—'}
          sub={stage}
          color={stageColor(stage)}
        />
        <KpiCard
          label="TSMC YoY"
          value={`${fmt(MOCK_TSMC_YOY)}`}
          sub="L1 Fundamental · mock"
          color={MOCK_TSMC_YOY > 0 ? C.teal : C.red}
        />
        <KpiCard
          label="HYPERSCALER CAPEX"
          value={`${fmt(MOCK_CAPEX_QOQ)}`}
          sub="L2 AI Capital · mock"
          color={MOCK_CAPEX_QOQ > 0 ? C.blue : C.red}
        />
        <KpiCard
          label="SOXX 반영도"
          value={soxxMirror !== null ? String(soxxMirror) : '—'}
          sub="L3 Market Pricing"
          color={soxxMirror !== null && soxxMirror >= 60 ? C.teal : C.amber}
        />
        <KpiCard
          label="SOXL ENVIRONMENT"
          value={score >= 65 ? 'FAVORABLE' : score >= 40 ? 'NEUTRAL' : 'HOSTILE'}
          sub={`Strategy: ${kpis?.strategy_score ?? '—'}`}
          color={score >= 65 ? C.teal : score >= 40 ? C.amber : C.red}
        />
      </div>

      {/* ── 3-Column Layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-[10px] px-4 md:px-6 xl:px-10 2xl:px-14 py-3 flex-1" style={{ minHeight: 'calc(100vh - 200px)' }}>

        {/* ── LEFT 22% ──────────────────────────────────────────────────── */}
        <aside className="w-[22%] shrink-0 flex flex-col gap-[10px]">

          {/* Cycle Gauge */}
          <Panel title="CYCLE POSITION">
            <div className="p-3 flex flex-col items-center">
              <CycleGauge score={score} stage={stage} />
              <StageTimeline stage={stage} />
              <div className="mt-6 w-full">
                <div className="flex justify-between text-[11px] mt-1" style={{ fontFamily: UI_FONT }}>
                  <span style={{ color: C.muted }}>Breadth</span>
                  <span style={{ color: breadth >= 60 ? C.teal : breadth >= 40 ? C.amber : C.red, fontFamily: DATA_FONT, fontWeight: 700 }}>
                    {breadth.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[11px] mt-1" style={{ fontFamily: UI_FONT }}>
                  <span style={{ color: C.muted }}>Confidence</span>
                  <span style={{ color: conf >= 70 ? C.teal : C.amber, fontFamily: DATA_FONT, fontWeight: 700 }}>
                    {kpis?.confidence_label ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] mt-1" style={{ fontFamily: UI_FONT }}>
                  <span style={{ color: C.muted }}>Primary Driver</span>
                  <span className="text-right ml-2 truncate" style={{ color: C.text, fontFamily: DATA_FONT, maxWidth: '60%' }}>
                    {kpis?.primary_driver ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          {/* 5Y Cycle Band */}
          <Panel title="5Y CYCLE BAND">
            <div className="p-2">
              <CycleBandChart historyRows={history?.rows ?? null} />
              <div className="flex gap-3 mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-[2px]" style={{ backgroundColor: C.teal }} />
                  <span className="text-[10px]" style={{ color: C.muted, fontFamily: UI_FONT }}>Composite</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 border-t border-dashed" style={{ borderColor: C.blue }} />
                  <span className="text-[10px]" style={{ color: C.muted, fontFamily: UI_FONT }}>AI Infra</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Domain Signals */}
          <Panel title="DOMAIN SIGNALS">
            <div className="p-3">
              {Object.keys(domainSignals).length > 0 ? (
                Object.entries(domainSignals).map(([k, v]) => (
                  <DomainRow key={k} label={k} value={v} />
                ))
              ) : (
                <div className="text-[11px] py-2" style={{ color: C.muted, fontFamily: UI_FONT }}>Domain signals pending</div>
              )}
            </div>
          </Panel>

          {/* 3-Layer Pyramid legend */}
          <Panel title="3-LAYER PYRAMID">
            <div className="p-3 flex flex-col gap-2">
              {[
                { layer: 'L1', label: 'Fundamental Reality', sub: 'TSMC / CapEx / B2B', color: C.teal },
                { layer: 'L2', label: 'AI Capital Flow',     sub: 'Hyperscaler intent', color: C.blue },
                { layer: 'L3', label: 'Market Pricing',      sub: 'SOXX reflection',    color: C.amber },
              ].map(l => (
                <div key={l.layer} className="flex items-start gap-2.5">
                  <div className="w-[26px] h-[26px] rounded flex items-center justify-center shrink-0 text-[10px] font-black"
                    style={{ backgroundColor: l.color + '22', color: l.color, fontFamily: DATA_FONT }}>{l.layer}</div>
                  <div>
                    <div className="text-[11px] font-bold" style={{ color: C.text, fontFamily: UI_FONT }}>{l.label}</div>
                    <div className="text-[10px]" style={{ color: C.muted, fontFamily: UI_FONT }}>{l.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

        </aside>

        {/* ── CENTER 50% ────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col gap-[10px] min-w-0">

          {/* Tab bar */}
          <div className="flex border-b shrink-0" style={{ borderColor: C.border }}>
            {CENTER_TABS.map(t => (
              <button key={t} onClick={() => setCenterTab(t)}
                className="px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] border-b-2 -mb-[1px] transition-all"
                style={{
                  fontFamily: UI_FONT,
                  borderColor: centerTab === t ? C.teal : 'transparent',
                  color: centerTab === t ? C.teal : C.muted,
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 flex flex-col">

            {centerTab === 'MAP' && (
              <Panel className="flex-1">
                {live ? (
                  <>
                    <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                      <span className="text-[10px] uppercase tracking-[0.10em] font-bold" style={{ color: C.muted, fontFamily: UI_FONT }}>
                        SEMICONDUCTOR BUCKET STRUCTURE MAP
                      </span>
                    </div>
                    <BucketMap buckets={live.buckets} />
                    <div className="px-4 py-2 border-t" style={{ borderColor: C.border }}>
                      <div className="text-[11px]" style={{ color: C.muted, fontFamily: UI_FONT }}>
                        Primary Risk: <span style={{ color: C.amber }}>{kpis?.primary_risk ?? '—'}</span>
                        {kpis?.has_conflict && (
                          <span className="ml-3" style={{ color: C.red }}>⚠ {kpis.conflict_note}</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[12px]" style={{ color: C.muted }}>
                    Engine data loading…
                  </div>
                )}
              </Panel>
            )}

            {centerTab === 'CYCLE VIEW' && (
              <Panel className="flex-1">
                <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-[10px] uppercase tracking-[0.10em] font-bold" style={{ color: C.muted, fontFamily: UI_FONT }}>
                    CYCLE COMPOSITE HISTORY
                  </span>
                </div>
                <div className="p-3 flex-1">
                  <CycleBandChart historyRows={history?.rows ?? null} />
                  {history?.phase_probability && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {Object.entries(history.phase_probability).map(([phase, prob]) => (
                        <div key={phase} className="rounded border p-2 text-center" style={{ borderColor: C.border }}>
                          <div className="text-[9px] uppercase tracking-[0.10em] mb-0.5" style={{ color: C.muted, fontFamily: UI_FONT }}>{phase}</div>
                          <div className="text-[18px] font-black" style={{ fontFamily: DATA_FONT, color: C.text }}>
                            {(prob * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {centerTab === 'PERFORMANCE' && (
              <Panel className="flex-1">
                <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-[10px] uppercase tracking-[0.10em] font-bold" style={{ color: C.muted, fontFamily: UI_FONT }}>
                    BUCKET PERFORMANCE vs SOXX
                  </span>
                </div>
                {live ? (
                  <PerformanceTable buckets={live.buckets} bucketWeights={live.bucket_weights} />
                ) : (
                  <div className="flex items-center justify-center p-8 text-[12px]" style={{ color: C.muted }}>Data pending</div>
                )}
              </Panel>
            )}

            {centerTab === 'HEALTH' && (
              <Panel className="flex-1">
                <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-[10px] uppercase tracking-[0.10em] font-bold" style={{ color: C.muted, fontFamily: UI_FONT }}>
                    MARKET HEALTH INDICATORS
                  </span>
                </div>
                {live ? <HealthPanel live={live} /> : (
                  <div className="flex items-center justify-center p-8 text-[12px]" style={{ color: C.muted }}>Data pending</div>
                )}
                {live && (
                  <div className="p-3 pt-0">
                    <BreadthChart breadthHistory={live.breadth_detail} />
                  </div>
                )}
              </Panel>
            )}

            {centerTab === '⚡ SOXL ENV' && (
              <Panel className="flex-1">
                <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-[10px] uppercase tracking-[0.10em] font-bold" style={{ color: C.muted, fontFamily: UI_FONT }}>
                    SOXL ENVIRONMENT ANALYSIS
                  </span>
                </div>
                {live ? (
                  <SoxlEnvPanel live={live} interpData={interpData} />
                ) : (
                  <div className="flex items-center justify-center p-8 text-[12px]" style={{ color: C.muted }}>Data pending</div>
                )}
              </Panel>
            )}

          </div>
        </main>

        {/* ── RIGHT 25% ──────────────────────────────────────────────────── */}
        <aside className="w-[25%] shrink-0 flex flex-col gap-[10px]">

          {/* Concentration Gauge */}
          <Panel title="CONCENTRATION">
            <div className="p-3 flex justify-center">
              {live ? (
                <ConcentrationGauge
                  top5Pct={kpis?.leader_concentration_top5 ?? null}
                  ewCwSpread={kpis?.equal_weight_vs_cap_spread ?? null}
                />
              ) : (
                <div className="h-[80px] flex items-center justify-center text-[11px]" style={{ color: C.muted }}>—</div>
              )}
            </div>
          </Panel>

          {/* AI vs Legacy */}
          {live && <AiVsLegacyPanel interpData={interpData} domainSignals={kpis?.domain_signals ?? {}} />}

          {/* Interpretation Card */}
          {live && <InterpCard interpData={interpData} live={live} />}

          {/* Quick Nav */}
          <Panel title="ENGINE QUICK NAV">
            <div className="p-3 flex flex-col gap-1.5">
              {CENTER_TABS.map(t => (
                <button key={t} onClick={() => setCenterTab(t)}
                  className="w-full text-left px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-[0.06em] transition-all"
                  style={{
                    fontFamily: UI_FONT,
                    backgroundColor: centerTab === t ? C.teal + '22' : 'transparent',
                    color: centerTab === t ? C.teal : C.muted,
                    borderLeft: centerTab === t ? `2px solid ${C.teal}` : '2px solid transparent',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </Panel>

        </aside>
      </div>
    </div>
  )
}
