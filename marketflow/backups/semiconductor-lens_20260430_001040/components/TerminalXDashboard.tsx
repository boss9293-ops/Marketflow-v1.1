'use client'
import React, { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Cpu, TrendingUp, Activity, Bell, History, Maximize2, X, RotateCcw } from 'lucide-react'
import SoxxSoxlTranslationTab    from './SoxxSoxlTranslationTab'
import SemiconductorPlaybackTab  from './SemiconductorPlaybackTab'

// ???? Mock Data ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const N = 130
const CHART_DATA = Array.from({ length: N }, (_, i) => {
  const t = i / N
  return {
    d: (() => {
      const base = new Date(2024, 10, 1)
      base.setDate(base.getDate() + Math.floor(i * 1.4))
      return `${base.getMonth() + 1}/${base.getDate()}`
    })(),
    soxx:    +(t * 23.8 + Math.sin(i / 8)  *  4 - Math.sin(i / 20) * 2).toFixed(1),
    ai:      +(t * 38.5 + Math.sin(i / 6)  *  6 + Math.cos(i / 15) * 3).toFixed(1),
    mem:     +(- t * 6.2 + Math.sin(i / 10) *  5 - Math.cos(i / 8)  * 2).toFixed(1),
    foundry: +(t * 12.4 + Math.sin(i / 12) *  3).toFixed(1),
    equip:   +(- t * 3.1 + Math.sin(i / 7)  *  4).toFixed(1),
    comp:    +(50 + Math.sin(i / 12) * 22 + t * 20).toFixed(1),
    avg:     +(50 + t * 18).toFixed(1),
  }
})

const DRILLDOWN_DATA = Array.from({ length: 120 }, (_, i) => {
  const base = new Date(2024, 10, 1)
  base.setDate(base.getDate() + i)
  const label = i % 20 === 0
    ? `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    : ''
  return {
    i, d: label,
    v: +(407 + i * 1.35 + Math.sin(i / 6) * 22 + Math.sin(i / 20) * 15).toFixed(2),
  }
})

const CYCLE_TIMELINE = [
  { range: '2024.11 ~ 2025.04', phase: 'Expansion',       now: true,  pct: 68,  color: '#3b82f6' },
  { range: '2024.08 ~ 2024.10', phase: 'Early Expansion', now: false, pct: 100, color: '#10b981' },
  { range: '2024.04 ~ 2024.07', phase: 'Contraction',     now: false, pct: 100, color: '#ef4444' },
  { range: '2023.11 ~ 2024.04', phase: 'Early Cycle',     now: false, pct: 100, color: '#6366f1' },
  { range: '2023.06 ~ 2023.10', phase: 'Expansion',       now: false, pct: 100, color: '#3b82f6' },
  { range: '2023.01 ~ 2023.05', phase: 'Peak',            now: false, pct: 100, color: '#f97316' },
  { range: '2022.07 ~ 2022.12', phase: 'Contraction',     now: false, pct: 100, color: '#ef4444' },
  { range: '2022.03 ~ 2022.06', phase: 'Early Cycle',     now: false, pct: 100, color: '#6366f1' },
]

const BUCKET_PERF = [
  { name: 'SOXX Index',       price: '568.23',   m6: '+18.7%', up: true,  color: '#3b82f6' },
  { name: 'AI Infrastructure',price: '1,248.67', m6: '+32.1%', up: true,  color: '#10b981' },
  { name: 'Memory',           price: '842.15',   m6: '-4.3%',  up: false, color: '#f97316' },
  { name: 'Foundry',          price: '187.32',   m6: '+11.2%', up: true,  color: '#ec4899' },
  { name: 'Logic / MCU',      price: '156.78',   m6: '+7.8%',  up: true,  color: '#8b5cf6' },
  { name: 'Analog / Power',   price: '243.11',   m6: '+3.2%',  up: true,  color: '#06b6d4' },
  { name: 'Equipment',        price: '1,023.45', m6: '-2.1%',  up: false, color: '#eab308' },
  { name: 'Packaging / OSAT', price: '178.68',   m6: '+6.4%',  up: true,  color: '#a78bfa' },
]

const RS_TABLE = [
  { name: 'AI Infrastructure', rs: '1.42', vs: '+0.62', up: true  },
  { name: 'Memory',            rs: '0.78', vs: '-0.64', up: false },
  { name: 'Foundry',           rs: '1.11', vs: '+0.11', up: true  },
  { name: 'Logic / MCU',       rs: '1.03', vs: '+0.03', up: true  },
  { name: 'Analog / Power',    rs: '0.96', vs: '-0.04', up: false },
  { name: 'Equipment',         rs: '0.89', vs: '-0.15', up: false },
  { name: 'Packaging / OSAT',  rs: '1.08', vs: '+0.08', up: true  },
]

const HISTORY_ROWS = [
  { date: '2025-05-21', stage: 'Expansion', eng: 72.4, str: 67.1, conflict: 'Momentum Div.',  breadth: '61.3%', mom: 'Strengthening', regime: 'RISK ON',  note: 'AI Infra Leading' },
  { date: '2025-05-20', stage: 'Expansion', eng: 67.1, str: 62.7, conflict: 'No Conflict',    breadth: '56.6%', mom: 'Strengthening', regime: 'RISK ON',  note: '-' },
  { date: '2025-05-19', stage: 'Expansion', eng: 64.3, str: 61.5, conflict: 'Sector Div.',    breadth: '54.1%', mom: 'Neutral',       regime: 'NEUTRAL', note: 'Memory Weakness' },
  { date: '2025-05-16', stage: 'Expansion', eng: 60.2, str: 58.9, conflict: 'No Conflict',    breadth: '49.8%', mom: 'Weakening',     regime: 'NEUTRAL', note: '-' },
  { date: '2025-05-15', stage: 'Expansion', eng: 58.7, str: 55.4, conflict: 'No Conflict',    breadth: '46.2%', mom: 'Weakening',     regime: 'NEUTRAL', note: 'Liquidity Watch' },
]

// ???? Shared UI ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

interface PanelProps {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  className?: string
  headerExtra?: React.ReactNode
}

const Panel = ({ title, icon: Icon, children, className = '', headerExtra }: PanelProps) => (
  <div className={`border border-slate-800 bg-[#04070d] rounded-sm flex flex-col ${className}`}>
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 bg-slate-900/20 shrink-0">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-slate-400" />}
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {headerExtra}
        <Maximize2 size={10} className="text-slate-400 cursor-pointer hover:text-slate-400" />
      </div>
    </div>
    <div className="p-2 flex-1 flex flex-col">{children}</div>
  </div>
)

const Spark = ({ color, seed = 0, h = 14, w = 50 }: { color: string; seed?: number; h?: number; w?: number }) => {
  const points = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      `${(i / 11) * w},${h - (Math.sin((i + seed) / 1.5) * (h / 3) + h / 2)}`
    ).join(' ')
  , [seed, h, w])
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
}

// ???? Live Data Types ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

interface LensData {
  as_of: string
  kpis: {
    engine_score: number; strategy_score: number; stage: string; cycle_position: number
    conflict_type: string; has_conflict: boolean
    breadth_pct: number; breadth_label: string; advancing_pct: number; declining_pct: number
    market_regime: string; soxx_price: number
    confidence_score: number
    confidence_label: string
    primary_driver: string
    primary_risk: string
    internal_signal: number
    domain_signals: Record<string, number>
    conflict_note: string
    leader_concentration_top5:  number | null
    equal_weight_vs_cap_spread: number | null
  }
  buckets: Array<{ name: string; color: string; price: string; m6: string; vs_soxx: string; rs: string; up: boolean }>
  rs_table: Array<{ name: string; rs: string; vs: string; up: boolean }>
  breadth_detail: {
    pct_above_ma20:  number | null
    pct_above_ma50:  number | null
    pct_above_ma200: number | null
    universe_count:  number
    breadth_history: Array<{
      date: string; breadth_score: number
      advancing_pct: number | null; declining_pct: number | null
      pct_above_ma20: number | null; pct_above_ma50: number | null; pct_above_ma200: number | null
    }>
  } | null
  momentum_detail: {
    rsi_14: number | null
    macd: { value: number | null; signal: number | null; histogram: number | null; state: string } | null
    roc_1m: number | null
    roc_3m: number | null
    roc_6m: number | null
    momentum_history: Array<{
      date: string; momentum_score: number | null
      rsi_14?: number | null; macd_histogram?: number | null; roc_1m?: number | null
    }>
  } | null
  correlation_matrix: {
    window_days: number
    labels: string[]
    values: number[][]
  } | null
  market_cap_weights: Array<{
    ticker: string; bucket: string
    market_cap: number | null; weight: number | null
    return_1d: number | null; return_5d: number | null; return_1m: number | null
  }> | null
  bucket_weights: Array<{
    bucket: string; weight: number | null; return_1m: number | null
  }> | null
  ai_infra_concentration_history: Array<{
    date: string
    top5_weight: number | null
    ew_vs_cw_spread: number | null
    ai_vs_soxx_spread: number | null
  }> | null
}

// ???? Helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function assessmentLabel(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'Highly Favorable', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' }
  if (score >= 65) return { label: 'Favorable',        cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' }
  if (score >= 50) return { label: 'Neutral',          cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'   }
  if (score >= 35) return { label: 'Caution',          cls: 'text-orange-400 border-orange-500/30 bg-orange-500/10'   }
  return                   { label: 'Unfavorable',     cls: 'text-red-400 border-red-500/30 bg-red-500/10'            }
}

function fmtRet(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}
function retColor(v: number | null): string {
  if (v === null) return 'text-slate-500'
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400'
}

function conflictSeverity(ct: string): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' {
  if (ct === 'NO_CONFLICT' || ct === '—') return 'NONE'
  if (ct === 'MACRO_OVERRIDE' || ct === 'MULTIPLE_CONFLICTS') return 'HIGH'
  if (['AI_DISTORTION','AI_INFRA_SUSTAINABILITY_RISK','BREADTH_DIVERGENCE',
       'MOMENTUM_DIVERGENCE','VALUATION_STRETCH'].includes(ct)) return 'MEDIUM'
  return 'LOW'
}

const CONFLICT_DISPLAY: Record<string, string> = {
  NO_CONFLICT:                   'No Conflict',
  AI_DISTORTION:                 'AI Leadership Narrow',
  BREADTH_DIVERGENCE:            'Breadth Diverging',
  MOMENTUM_DIVERGENCE:           'Momentum Diverging',
  SECTOR_ROTATION:               'Sector Rotation',
  MACRO_OVERRIDE:                'Macro Override',
  VALUATION_STRETCH:             'Valuation Stretch',
  AI_INFRA_SUSTAINABILITY_RISK:  'Concentration Risk',
  MULTIPLE_CONFLICTS:            'Multiple Conflicts',
}
function displayConflict(ct: string): string {
  return CONFLICT_DISPLAY[ct] ?? ct.replace(/_/g, ' ')
}

const REGIME_DISPLAY: Record<string, string> = {
  AI_LED_BROAD:   'AI-led Broadening',
  AI_LED_NARROW:  'Narrow AI Leadership',
  ROTATING:       'Capital Rotation',
  BROAD_RECOVERY: 'Broad Recovery',
  CONTRACTION:    'Semiconductor Contraction',
}

// Phase E: labels centralized for future KR/EN toggle.
const LABELS = {
  summary:        'Summary',
  alignment:      'Alignment',
  supporting:     'Supporting',
  weakening:      'Weakening',
  interpretation: 'Interpretation',
  context:        'Historical Context',
  confidence:     'Confidence',
  dataStatus:     'Data Status',
  delta:          'Delta',
  watch:          'Watch',
}

const TAB_TIPS: Record<string, string> = {
  'CYCLE VIEW':  'Semiconductor cycle phase and daily progression across structural stages.',
  PERFORMANCE:   'Relative bucket performance versus SOXX benchmark over the period.',
  CORRELATION:   'Cross-bucket correlation ??rising correlation reduces diversification benefit.',
  BREADTH:       'Measures whether participation is broad across semiconductor buckets.',
  MOMENTUM:      'Price strength across semiconductor segments over rolling periods.',
  MAP:           'Market structure score based on relative trend and stability conditions.',
}

// ???? Main Component ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

export default function TerminalXDashboard() {
  const [mainTab,  setMainTab]  = useState<'MASTER' | 'ENGINE' | 'STRATEGY' | 'PLAYBACK'>('ENGINE')
  const [centerTab,setCenterTab]= useState('CYCLE VIEW')
  const [zoom,     setZoom]     = useState('6M')
  const [histTab,  setHistTab]  = useState('HISTORY TABLE')
  const [drillTab, setDrillTab] = useState('SUMMARY')
  const [live,     setLive]     = useState<LensData | null>(null)
  const [history,  setHistory]  = useState<{
    rows: Array<{ date:string; soxx:number; ai:number; mem:number; foundry:number; equip:number; comp:number; avg:number; phase:string }>
    phase_probability: { early:number; expansion:number; peak:number; contraction:number }
    current_composite: number
  } | null>(null)
  const [prevSnap, setPrevSnap] = useState<{
    stageName: string; conflictType: string; breadthPct: number; structure: string; savedAt: string
  } | null>(null)
  type AIRegimeComp = { state: string; signal: number; spread: number; note: string; sources: string[] }
  const [interpData, setInterpData] = useState<{
    summary: string; alignment: string; support: string[]; weakness: string[]
    interpretation: string; context?: string; confidence: string
    regime_context?: string
    ai_regime?: {
      regime_label: string; regime_confidence: string; data_mode: string
      ai_infra: AIRegimeComp; memory: AIRegimeComp; foundry: AIRegimeComp
      equipment: AIRegimeComp; rotation_risk: AIRegimeComp
    }
  } | null>(null)

  useEffect(() => {
    fetch('/api/semiconductor-lens')
      .then(r => r.ok ? r.json() : null).then(d => d && setLive(d)).catch(() => {})
    fetch('/api/semiconductor-lens/history?days=180')
      .then(r => r.ok ? r.json() : null).then(d => d && setHistory(d)).catch(() => {})
    fetch('/api/interpretation')
      .then(r => r.ok ? r.json() : null).then(d => d && setInterpData(d)).catch(() => {})
    try {
      const stored = localStorage.getItem('termx_interp_snap')
      if (stored) setPrevSnap(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!live) return
    const nc = live.kpis.conflict_type === 'NO_CONFLICT' || live.kpis.conflict_type === '—'
    const bp = live.kpis.breadth_pct
    const ct = live.kpis.conflict_type
    const str =
      ct === 'AI_INFRA_SUSTAINABILITY_RISK' ? 'Fragile'   :
      ct === 'AI_DISTORTION'                ? 'Narrow'    :
      (nc && bp >= 70)                      ? 'Broad'     :
      bp < 40                               ? 'Weak'      :
      ct === 'BREADTH_DIVERGENCE'           ? 'Diverging' : 'Moderate'
    try {
      localStorage.setItem('termx_interp_snap', JSON.stringify({
        stageName: live.kpis.stage, conflictType: ct,
        breadthPct: bp, structure: str, savedAt: new Date().toISOString(),
      }))
    } catch { /* ignore */ }
  }, [live])

  const totalRows  = history?.rows?.length ?? 0
  const inspectIdx = totalRows - 1

  const currentComp = history?.rows?.[inspectIdx]?.comp ?? history?.current_composite ?? null

  const phaseProb: { early: number; expansion: number; peak: number; contraction: number } | null = (() => {
    if (!history?.rows?.length) return history?.phase_probability ?? null
    const w60 = history.rows.slice(Math.max(0, inspectIdx - 59), inspectIdx + 1)
    const total = w60.length || 1
    const c = { EARLY_CYCLE: 0, EXPANSION: 0, PEAK: 0, CONTRACTION: 0 }
    const toPhase = (v: number) => v >= 70 ? 'PEAK' : v >= 40 ? 'EXPANSION' : v >= 20 ? 'EARLY_CYCLE' : 'CONTRACTION'
    for (const r of w60) c[toPhase(r.comp) as keyof typeof c]++
    return {
      early:       Math.round((c.EARLY_CYCLE  / total) * 100),
      expansion:   Math.round((c.EXPANSION    / total) * 100),
      peak:        Math.round((c.PEAK         / total) * 100),
      contraction: Math.round((c.CONTRACTION  / total) * 100),
    }
  })()

  const sourceData = history?.rows ?? []
  const visibleData = useMemo(() => {
    const n: Record<string, number> = { '1M': 22, '3M': 65, '6M': 130, 'YTD': 110, '1Y': 180, '3Y': 180, '5Y': 180, 'MAX': 180 }
    const window = n[zoom] ?? 130
    const end = inspectIdx + 1
    return sourceData.slice(Math.max(0, end - window), end)
  }, [zoom, sourceData, inspectIdx])

  // Period returns computed from full sourceData (not zoom-sliced)
  const periodReturns = useMemo(() => {
    if (!sourceData.length) return null
    const n   = sourceData.length
    const at  = (off: number) => sourceData[Math.max(0, n - 1 - off)]
    const lst = sourceData[n - 1]
    const keys = ['soxx', 'ai', 'mem', 'foundry', 'equip'] as const
    const res: Record<string, Record<string, number | null>> = {}
    for (const k of keys) {
      res[k] = {
        '1D': n >   1 ? Math.round((lst[k] - at(1)[k])   * 10) / 10 : null,
        '5D': n >   5 ? Math.round((lst[k] - at(5)[k])   * 10) / 10 : null,
        '1M': n >  22 ? Math.round((lst[k] - at(22)[k])  * 10) / 10 : null,
        '3M': n >  65 ? Math.round((lst[k] - at(65)[k])  * 10) / 10 : null,
        '6M': n > 130 ? Math.round((lst[k] - at(130)[k]) * 10) / 10 : null,
      }
    }
    return res
  }, [sourceData])

  // bucket_returns: rebase each series to the first visible point of the zoom window
  const rebasedData = useMemo(() => {
    if (!visibleData.length) return []
    const b = visibleData[0]
    return visibleData.map(r => ({
      ...r,
      soxx:    Math.round((r.soxx    - b.soxx)    * 10) / 10,
      ai:      Math.round((r.ai      - b.ai)      * 10) / 10,
      mem:     Math.round((r.mem     - b.mem)      * 10) / 10,
      foundry: Math.round((r.foundry - b.foundry)  * 10) / 10,
      equip:   Math.round((r.equip   - b.equip)    * 10) / 10,
    }))
  }, [visibleData])

  // Relative spread: each bucket minus SOXX for the visible zoom window
  const spreadData = useMemo(() => {
    if (!rebasedData.length) return []
    return rebasedData.map(r => ({
      date:    r.date,
      ai:      Math.round((r.ai      - r.soxx) * 10) / 10,
      mem:     Math.round((r.mem     - r.soxx) * 10) / 10,
      foundry: Math.round((r.foundry - r.soxx) * 10) / 10,
      equip:   Math.round((r.equip   - r.soxx) * 10) / 10,
    }))
  }, [rebasedData])

  const kpis           = live?.kpis
  const engineScore    = kpis?.engine_score    ?? 0
  const strategyScore  = kpis?.strategy_score  ?? 0
  const stageName      = kpis?.stage           ?? '—'
  const cyclePos       = kpis?.cycle_position  ?? 0
  const conflictType   = kpis?.conflict_type   ?? '—'
  const hasConflict    = kpis?.has_conflict    ?? false
  const breadthPct     = kpis?.breadth_pct     ?? 0
  const breadthLabel   = kpis?.breadth_label   ?? '—'
  const advPct         = kpis?.advancing_pct   ?? 0
  const decPct         = kpis?.declining_pct   ?? 0
  const marketRegime   = kpis?.market_regime   ?? '—'
  const asOf           = live?.as_of           ?? '—'
  const domainSignals   = kpis?.domain_signals   ?? {}
  const primaryDriver   = kpis?.primary_driver   ?? '—'
  const primaryRisk     = kpis?.primary_risk     ?? '—'
  const conflictNote    = kpis?.conflict_note    ?? ''
  const confidenceScore = kpis?.confidence_score           ?? 0
  const confidenceLabel = kpis?.confidence_label           ?? '—'
  const concentration   = kpis?.leader_concentration_top5  ?? null
  const ewVsCw          = kpis?.equal_weight_vs_cap_spread ?? null
  const severity        = conflictSeverity(conflictType)
  const engAssess       = assessmentLabel(engineScore)
  const strAssess       = assessmentLabel(strategyScore)

  const bucketPerf = (live?.buckets ?? []).map(b => ({ name: b.name, color: b.color, price: b.price, m6: b.m6, up: b.up }))
  const rsTable    = (live?.rs_table ?? []).map(r => ({ name: r.name, rs: r.rs, vs: r.vs, up: r.up }))

  // ???? Task 7: data hooks prepared for future chart wiring (no UI yet) ??????????????????
  // cycle_indicator_score    ??currentComp       (history?.current_composite)
  // cycle_phase_probability  ??phaseProb         (computed above from history.rows)
  // bucket_returns           ??sourceData fields  (soxx / ai / mem / foundry / equip per row)

  const historyRows = useMemo(() => {
    if (!history?.rows?.length) return []
    return history.rows.slice(-8).reverse().map(r => ({
      date:     r.date,
      stage:    r.phase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
      eng:      r.comp,
      str:      Math.round(r.comp * 0.88),
      conflict: '—',
      breadth:  '—',
      mom:      r.comp > r.avg ? 'Strengthening' : 'Weakening',
      regime:   r.comp >= 55 ? 'RISK ON' : r.comp >= 35 ? 'NEUTRAL' : 'RISK OFF',
      note:     '—',
    }))
  }, [history])

  return (
    <div
      className="flex flex-col bg-[#020408] text-slate-300 min-h-screen selection:bg-blue-500/30 px-4 md:px-6 xl:px-10 2xl:px-14"
      style={{ fontSize: 14, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}
    >

      {/* ???? HEADER 40px ???? */}
      <header className="h-[40px] flex items-center justify-between bg-[#06090f] border-b border-slate-800 px-4 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-blue-500" />
            <span className="text-[16px] font-black text-white tracking-tighter">TERMINAL X</span>
            <span className="text-[11px] text-slate-400 uppercase tracking-widest hidden lg:block ml-1">SEMICONDUCTOR ANALYSIS ENGINE</span>
          </div>
          <nav className="flex gap-1">
            {(['MASTER', 'ENGINE', 'STRATEGY', 'PLAYBACK'] as const).map(t => (
              <button key={t} onClick={() => setMainTab(t)}
                className={`px-4 h-[40px] text-[12px] font-bold tracking-widest border-b-2 transition-all ${
                  mainTab === t ? 'border-blue-500 text-white bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}>{t}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-slate-400">{asOf}  15:30:00</span>
          <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </div>
        </div>
      </header>

      {/* ???? KPI STRIP 72px ???? */}
      <div className="h-[72px] w-full flex shrink-0 border-b border-slate-800 bg-[#06090f] divide-x divide-slate-800 sticky top-[40px] z-40">

        <div className="flex-1 flex items-center px-3 gap-2 min-w-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase tracking-widest">Engine Score</span>
            <div className="flex items-end gap-1.5 mt-0.5">
              <span className="text-[30px] font-black text-emerald-400 leading-none font-mono">{engineScore}</span>
              <div className="flex flex-col pb-0.5 gap-0.5">
                <span className={`text-[10px] font-bold px-1 py-0.5 border leading-none ${engAssess.cls}`}>
                  {engAssess.label}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto"><Spark color="#10b981" seed={1} h={16} w={45} /></div>
        </div>

        <div className="flex-1 flex items-center px-3 gap-2 min-w-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase tracking-widest">Strategy Score</span>
            <div className="flex items-end gap-1.5 mt-0.5">
              <span className="text-[30px] font-black text-orange-400 leading-none font-mono">{strategyScore}</span>
              <div className="flex flex-col pb-0.5 gap-0.5">
                <span className={`text-[10px] font-bold px-1 py-0.5 border leading-none ${strAssess.cls}`}>
                  {strAssess.label}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto"><Spark color="#f97316" seed={4} h={16} w={45} /></div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-3 min-w-0">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest">Stage</span>
          <span className="text-[16px] font-black text-cyan-400 leading-none mt-1 truncate">{stageName}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Cycle Position: {cyclePos}%</span>
            <div className="flex-1 h-[3px] bg-slate-800 rounded-full overflow-hidden max-w-[50px]">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${cyclePos}%` }} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-3 min-w-0">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest">Conflict Type</span>
          <span className={`text-[14px] font-black mt-1 leading-none truncate ${hasConflict ? 'text-orange-400' : 'text-slate-400'}`}>{displayConflict(conflictType)}</span>
          <span className="text-[11px] text-slate-400 mt-1 font-mono">{asOf}</span>
        </div>

        <div className="flex-1 flex items-center px-3 gap-2 min-w-0">
          <div className="flex flex-col w-full">
            <span className="text-[11px] text-slate-400 uppercase tracking-widest">Breadth (200)</span>
            <div className="flex items-end gap-2 mt-0.5">
              <span className="text-[26px] font-black text-yellow-400 leading-none font-mono">{breadthPct}%</span>
              <div className="flex flex-col pb-0.5 gap-0.5">
                <span className="text-[11px] font-bold text-slate-400">{breadthLabel}</span>
                <span className="text-[11px] text-emerald-400 font-mono">(+4.7%)</span>
              </div>
            </div>
          </div>
          <div className="ml-auto"><Spark color="#eab308" seed={7} h={16} w={40} /></div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-3 min-w-0">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest">AI Regime</span>
          <span className={`text-[17px] font-black mt-1 leading-none ${marketRegime === 'RISK ON' ? 'text-emerald-400' : marketRegime === 'RISK OFF' ? 'text-red-400' : 'text-yellow-400'}`}>{marketRegime}</span>
          <span className="text-[11px] text-slate-400 mt-1 truncate">{REGIME_DISPLAY[interpData?.ai_regime?.regime_label ?? ''] ?? '—'}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center px-3 min-w-0">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest">Signal Confidence</span>
          <div className="flex items-end gap-1.5 mt-0.5">
            <span className={`text-[26px] font-black leading-none font-mono ${
              confidenceLabel === 'High' ? 'text-emerald-400' : confidenceLabel === 'Medium' ? 'text-yellow-400' : 'text-red-400'
            }`}>{confidenceScore > 0 ? confidenceScore : '—'}</span>
            <span className="text-[11px] text-slate-400 pb-1">{confidenceLabel !== '—' ? `(${confidenceLabel})` : ''}</span>
          </div>
        </div>
      </div>

      {/* ???? MAIN 3-COLUMN ???? */}
      <div className={`flex px-4 md:px-6 xl:px-8 2xl:px-10 gap-2 bg-[#020408] py-2 flex-1 ${mainTab === 'STRATEGY' || mainTab === 'PLAYBACK' ? 'hidden' : ''}`}>

        {/* LEFT 25% */}
        <aside className="w-1/4 shrink-0 flex flex-col gap-2 h-fit">

          {/* ???? Block 1: Cycle Position ?????????????????????????????????????????????????????????? */}
          {(() => {
            const stageCls =
              stageName.includes('CONTRACTION') || stageName.includes('PEAK')  ? 'text-red-400'     :
              stageName.includes('LATE')                                        ? 'text-orange-400'  :
              stageName.includes('MID')  || stageName.includes('EXPANSION')    ? 'text-emerald-400' :
              stageName.includes('RECOVERY') || stageName.includes('TROUGH')   ? 'text-blue-400'    : 'text-slate-300'
            const stageBar =
              stageName.includes('CONTRACTION') || stageName.includes('PEAK')  ? '#ef4444' :
              stageName.includes('LATE')                                        ? '#f97316' :
              stageName.includes('MID')  || stageName.includes('EXPANSION')    ? '#10b981' :
              stageName.includes('RECOVERY') || stageName.includes('TROUGH')   ? '#3b82f6' : '#64748b'
            const contextLine =
              stageName.includes('MID EXPANSION') && breadthPct >= 70
                ? 'Broad participation supporting the current expansion structure.'
              : stageName.includes('MID EXPANSION')
                ? 'Expansion structure with mixed participation across segments.'
              : stageName.includes('LATE EXPANSION') || stageName.includes('PEAK')
                ? 'Late-cycle structure ??breadth and momentum are the key signals to monitor.'
              : stageName.includes('CONTRACTION')
                ? 'Contraction phase ??structural weakness is the primary condition.'
              : stageName.includes('RECOVERY') || stageName.includes('TROUGH')
                ? 'Early recovery structure ??participation is the key leading indicator.'
              : live ? 'Cycle position updated from engine output.' : '—'
            return (
              <Panel title="Cycle Position" icon={Cpu}>
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Current Stage</div>
                    <div className={`text-[15px] font-black leading-tight truncate ${stageCls}`}>{stageName !== '—' ? stageName : 'Loading…'}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] text-slate-400 uppercase tracking-widest">Cycle Progress</div>
                      <span className="text-[11px] font-bold text-slate-300 font-mono">{cyclePos > 0 ? `${Math.round(cyclePos)}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, cyclePos))}%`, backgroundColor: stageBar }} />
                    </div>
                  </div>
                  {live && (
                    <p className="text-[10px] text-slate-400 leading-snug border-t border-slate-800/60 pt-1.5">{contextLine}</p>
                  )}
                </div>
              </Panel>
            )
          })()}

          {/* ???? Block 2: Cycle Timeline ?????????????????????????????????????????????????????????? */}
          <Panel title="Cycle Timeline" icon={History}
            headerExtra={<span className="text-[10px] border border-slate-700 px-1.5 py-0.5 text-slate-300 font-mono">5Y</span>}>
            <div className="space-y-0.5 pt-0.5">
              {CYCLE_TIMELINE.map((item, i) => {
                const phaseColor =
                  item.phase.includes('Contraction') || item.phase === 'Peak' ? '#ef4444' :
                  item.phase.includes('Expansion')                             ? '#10b981' :
                  item.phase.includes('Early')                                 ? '#3b82f6' :
                  item.phase === 'Peak'                                        ? '#f97316' : item.color
                return (
                  <div key={i} className={`flex items-start gap-2 p-1.5 rounded-sm transition-colors ${
                    item.now ? 'bg-blue-500/5 border border-blue-500/20' : 'opacity-85 hover:opacity-100 hover:bg-slate-800/20 cursor-pointer'
                  }`}>
                    <div className="mt-0.5 w-2 h-2 rounded-full shrink-0 border-2"
                      style={{ borderColor: phaseColor, backgroundColor: item.now ? phaseColor : 'transparent' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-mono truncate ${item.now ? 'text-slate-200' : 'text-slate-300'}`}>{item.range}</span>
                        {item.now && <span className="text-[10px] font-bold text-blue-400 shrink-0">Now</span>}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-[11px] font-bold ${item.now ? '' : 'text-slate-300'}`}
                          style={{ color: item.now ? phaseColor : undefined }}>{item.phase}</span>
                        <span className={`text-[10px] font-mono ${item.now ? 'text-slate-300' : 'text-slate-300'}`}>{item.pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* ???? Block 3: Bucket Power Ranking ???????????????????????????????????????????? */}
          {(() => {
            const bucketStatus = (vsStr: string) => {
              const v = parseFloat(vsStr)
              if (v >= 3)    return { label: 'Leading',        cls: 'text-emerald-400', icon: '—' }
              if (v >= 0.5)  return { label: 'Improving',      cls: 'text-cyan-400',   icon: '—' }
              if (v >= -0.5) return { label: 'Neutral',         cls: 'text-slate-400',  icon: '—' }
              if (v >= -3)   return { label: 'Lagging',         cls: 'text-orange-400', icon: '—' }
              return           { label: 'Underperforming', cls: 'text-red-400',    icon: '—' }
            }
            const ranked = [...rsTable].sort((a,b) => parseFloat(b.vs) - parseFloat(a.vs))
            const colorMap = Object.fromEntries(bucketPerf.map(b => [b.name, b.color]))
            return (
              <Panel title="Bucket Power Ranking" icon={TrendingUp}>
                {ranked.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Bucket ranking unavailable.</p>
                ) : (
                  <div className="space-y-0">
                    <div className="grid text-[11px] text-slate-400 uppercase pb-1 mb-0.5 border-b border-slate-800 gap-x-1"
                      style={{ gridTemplateColumns: '8px 1fr 36px 64px 16px' }}>
                      <span /><span>Bucket</span>
                      <span className="text-right">vs SOXX</span>
                      <span className="text-right">Status</span>
                      <span />
                    </div>
                    {ranked.map((r, i) => {
                      const st = bucketStatus(r.vs)
                      const color = colorMap[r.name] ?? '#64748b'
                      return (
                        <div key={i} className="grid items-center py-0.5 border-b border-slate-800/30 gap-x-1"
                          style={{ gridTemplateColumns: '8px 1fr 36px 64px 16px' }}>
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                          <span className="text-[11px] text-slate-300 truncate">{r.name}</span>
                          <span className={`text-right text-[11px] font-bold font-mono tabular-nums ${st.cls}`}>{r.vs}</span>
                          <span className={`text-right text-[10px] ${st.cls}`}>{st.label}</span>
                          <span className={`text-right text-[11px] ${st.cls}`}>{st.icon}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            )
          })()}

          {/* ???? Block 4: Analog / Trend Context ???????????????????????????????????????? */}
          {(() => {
            const bucketStatus = (vsStr: string) => {
              const v = parseFloat(vsStr)
              if (v >= 3)    return 'Leading'
              if (v >= 0.5)  return 'Improving'
              if (v >= -0.5) return 'Neutral'
              if (v >= -3)   return 'Lagging'
              return           'Underperforming'
            }
            const ranked = [...rsTable].sort((a,b) => parseFloat(b.vs) - parseFloat(a.vs))
            const powerBucket   = ranked[0]?.name ?? null
            const analogBucket  = ranked.find(r => r.name.toLowerCase().includes('memory'))?.name
                                 ?? ranked[ranked.length - 1]?.name ?? null
            const weakBuckets   = ranked.filter(r => parseFloat(r.vs) < -0.5).map(r => r.name)
            const trendContext  = !powerBucket ? 'Trend context unavailable.' :
              weakBuckets.length >= 3
                ? `${powerBucket} remains the strongest relative bucket, while most other segments are lagging in the current cycle.`
              : weakBuckets.length >= 1
                ? `${powerBucket} remains the strongest relative bucket, while ${weakBuckets.slice(0,2).join(' and ')} continue to lag.`
              : `${powerBucket} is leading relative structure, with broad participation across semiconductor segments.`
            return (
              <Panel title="Trend Context" icon={Activity}>
                {!powerBucket ? (
                  <p className="text-[11px] text-slate-400">Trend context unavailable.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Power Bucket</div>
                      <div className="text-[12px] font-bold text-emerald-400">{powerBucket}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Analog Bucket</div>
                      <div className="text-[12px] font-medium text-slate-300">{analogBucket ?? 'Not available'}</div>
                    </div>
                    {ranked.length > 0 && (
                      <div>
                        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1">Bucket Status</div>
                        <div className="space-y-0.5">
                          {ranked.slice(0, 4).map(r => (
                            <div key={r.name} className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-300 truncate max-w-[96px]">{r.name}</span>
                              <span className={`font-medium ${
                                bucketStatus(r.vs) === 'Leading' || bucketStatus(r.vs) === 'Improving'
                                  ? 'text-emerald-400'
                                : bucketStatus(r.vs) === 'Neutral'
                                  ? 'text-slate-400'
                                : bucketStatus(r.vs) === 'Lagging'
                                  ? 'text-orange-400'
                                  : 'text-red-400'
                              }`}>{bucketStatus(r.vs)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t border-slate-800/60 pt-1.5">
                      <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Trend Context</div>
                      <p className="text-[10px] text-slate-400 leading-snug">{trendContext}</p>
                    </div>
                  </div>
                )}
              </Panel>
            )
          })()}

        </aside>

        {/* CENTER 50% */}
        <section className="w-1/2 flex flex-col gap-2">

          <Panel title="Analysis Engine Core" className="flex-none">
            {/* Chart tab bar */}
            <div className="flex gap-0 border-b border-slate-800 mb-2 shrink-0 -mx-2 px-2">
              {['CYCLE VIEW', 'PERFORMANCE', 'CORRELATION', 'BREADTH', 'MOMENTUM', 'MAP'].map(t => (
                <button key={t} onClick={() => setCenterTab(t)} title={TAB_TIPS[t]}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-widest border-b-2 transition-all ${
                    centerTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-400'
                  }`}>{t}</button>
              ))}
            </div>

            {/* Zoom + controls ??only relevant for CYCLE VIEW */}
            {centerTab === 'CYCLE VIEW' && (
              <div className="flex items-center justify-between shrink-0 mb-1">
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-slate-400 mr-1">Zoom</span>
                  {['1M','3M','6M','YTD','1Y','3Y','5Y','MAX'].map(z => (
                    <button key={z} onClick={() => setZoom(z)}
                      className={`px-1.5 py-0.5 text-[11px] transition-colors ${
                        zoom === z ? 'text-blue-400 border border-blue-500/40 bg-blue-500/10' : 'text-slate-400 hover:text-slate-300'
                      }`}>{z}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>Scale</span>
                  <span className="px-1.5 py-0.5 border border-slate-700 cursor-pointer">Linear</span>
                  <RotateCcw size={11} className="cursor-pointer hover:text-slate-300" />
                </div>
              </div>
            )}

            {/* ???? CYCLE VIEW ?????????????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'CYCLE VIEW' && (<>

            {/* [1] Relative Spread vs SOXX ??Chart 1: What supports or weakens SOXX */}
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-1 shrink-0 flex-wrap">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Relative Spread vs SOXX</span>
                {[
                  { label: 'AI Compute', color: '#10b981' },
                  { label: 'Memory',     color: '#f97316' },
                  { label: 'Foundry',    color: '#ec4899' },
                  { label: 'Equipment',  color: '#eab308' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mb-1">Shows which groups are stronger or weaker than SOXX.</p>
              <div className="h-[220px] w-full">
                {spreadData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[12px] text-slate-500">Data pending</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spreadData} margin={{ top: 2, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={v => `${(+v) >= 0 ? '+' : ''}${(+v).toFixed(0)}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }}
                        formatter={(v: unknown, name: unknown) => [
                          `${(+String(v)) >= 0 ? '+' : ''}${(+String(v)).toFixed(1)}% vs SOXX`,
                          String(name),
                        ]} />
                      <ReferenceLine y={0} stroke="#3b82f6" strokeDasharray="3 2" strokeOpacity={0.6} label={{ value: 'SOXX', position: 'insideTopRight', fontSize: 9, fill: '#3b82f6' }} />
                      <Line type="monotone" dataKey="ai"      stroke="#10b981" strokeWidth={1.5} dot={false} name="AI Compute" />
                      <Line type="monotone" dataKey="mem"     stroke="#f97316" strokeWidth={1.2} dot={false} name="Memory"    />
                      <Line type="monotone" dataKey="foundry" stroke="#ec4899" strokeWidth={1.2} dot={false} name="Foundry"   />
                      <Line type="monotone" dataKey="equip"   stroke="#eab308" strokeWidth={1.2} dot={false} name="Equipment" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* [2] Rebased Bucket Flow ??Chart 2: Where capital moved first and what followed */}
            <div className="mb-2 border-t border-slate-800/60 pt-2">
              <div className="flex items-center gap-3 mb-1 shrink-0 flex-wrap">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Rebased Bucket Flow</span>
                {[
                  { label: 'SOXX',      color: '#3b82f6' },
                  { label: 'AI Compute',color: '#10b981' },
                  { label: 'Memory',    color: '#f97316' },
                  { label: 'Foundry',   color: '#ec4899' },
                  { label: 'Equipment', color: '#eab308' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mb-1">Compares bucket movement from the same starting point.</p>
              <div className="h-[220px] w-full">
                {rebasedData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[12px] text-slate-500">Loading…</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rebasedData} margin={{ top: 2, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={v => `${(+v) >= 0 ? '+' : ''}${(+v).toFixed(0)}%`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }}
                        formatter={(v: unknown, name: unknown) => [
                          `${(+String(v)) >= 0 ? '+' : ''}${(+String(v)).toFixed(1)}%`,
                          String(name),
                        ]} />
                      <ReferenceLine y={0} stroke="#334155" strokeDasharray="2 4" />
                      <Line type="monotone" dataKey="soxx"    stroke="#3b82f6" strokeWidth={2}   dot={false} name="SOXX"      />
                      <Line type="monotone" dataKey="ai"      stroke="#10b981" strokeWidth={1.5} dot={false} name="AI Compute" />
                      <Line type="monotone" dataKey="mem"     stroke="#f97316" strokeWidth={1.2} dot={false} name="Memory"    />
                      <Line type="monotone" dataKey="foundry" stroke="#ec4899" strokeWidth={1.2} dot={false} name="Foundry"   />
                      <Line type="monotone" dataKey="equip"   stroke="#eab308" strokeWidth={1.2} dot={false} name="Equipment" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* [3] Capital Flow Stage Timeline */}
            {(() => {
              const ar = interpData?.ai_regime
              type FlowStage = 'Confirmed' | 'Partial' | 'Mixed' | 'Lagging' | 'Weak' | 'Narrow' | 'Unavailable'

              const aiSpread    = ar?.ai_infra?.spread   ?? null
              const memSpread   = ar?.memory?.spread     ?? null
              const fndSpread   = ar?.foundry?.spread    ?? null
              const equipSpread = ar?.equipment?.spread  ?? null

              const aiStage: FlowStage    = aiSpread    === null ? 'Unavailable' : aiSpread > 5    ? 'Confirmed' : aiSpread > 2    ? 'Partial' : aiSpread > -2   ? 'Mixed'  : 'Weak'
              const memStage: FlowStage   = memSpread   === null ? 'Unavailable' : memSpread > 3   ? 'Confirmed' : memSpread > 0   ? 'Partial' : memSpread > -3  ? 'Mixed'  : 'Weak'
              const fndStage: FlowStage   = fndSpread   === null ? 'Unavailable' : fndSpread > 3   ? 'Confirmed' : fndSpread > -3  ? 'Mixed'   : 'Weak'
              const equipStage: FlowStage = equipSpread === null ? 'Unavailable' : equipSpread > 2  ? 'Confirmed' : equipSpread > -2 ? 'Mixed'   : 'Lagging'

              const stages = [aiStage, memStage, fndStage, equipStage]
              const confirmedCount = stages.filter(s => s === 'Confirmed' || s === 'Partial').length
              const weakCount      = stages.filter(s => s === 'Weak' || s === 'Lagging').length
              const broadStage: FlowStage =
                confirmedCount >= 3                                         ? 'Confirmed' :
                weakCount >= 3                                              ? 'Weak'      :
                aiStage === 'Confirmed' && confirmedCount === 1             ? 'Narrow'    : 'Mixed'

              const STAGE_CLS: Record<FlowStage, string> = {
                Confirmed:   'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
                Partial:     'text-sky-400     border-sky-500/40     bg-sky-500/10',
                Mixed:       'text-yellow-400  border-yellow-500/40  bg-yellow-500/10',
                Lagging:     'text-orange-400  border-orange-500/40  bg-orange-500/10',
                Weak:        'text-red-400     border-red-500/40     bg-red-500/10',
                Narrow:      'text-orange-400  border-orange-500/40  bg-orange-500/10',
                Unavailable: 'text-slate-500   border-slate-700      bg-slate-800/30',
              }

              const FLOW: { label: string; stage: FlowStage; spread: number | null }[] = [
                { label: 'AI Compute', stage: aiStage,    spread: aiSpread    },
                { label: 'Memory',     stage: memStage,   spread: memSpread   },
                { label: 'Foundry',    stage: fndStage,   spread: fndSpread   },
                { label: 'Equipment',  stage: equipStage, spread: equipSpread },
                { label: 'Broad',      stage: broadStage, spread: null        },
              ]

              return (
                <div className="border-t border-slate-800/60 pt-2">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-0.5">Capital Flow Stage</div>
                  <p className="text-[10px] text-slate-400 mb-2">Shows how far AI-related capital has spread across the semiconductor value chain.</p>
                  <div className="flex items-start gap-1">
                    {FLOW.map((f, i) => (
                      <div key={f.label} className="flex items-center gap-1 min-w-0">
                        <div className="flex flex-col items-center gap-0.5 min-w-0">
                          <div className="text-[11px] text-slate-500 text-center leading-tight truncate w-full text-center">{f.label}</div>
                          <div className={`text-[11px] font-bold uppercase px-1.5 py-0.5 border rounded-sm whitespace-nowrap ${STAGE_CLS[f.stage]}`}>
                            {f.stage}
                          </div>
                          {f.spread !== null && (
                            <div className="text-[11px] font-mono text-slate-500">
                              {f.spread >= 0 ? '+' : ''}{f.spread.toFixed(1)}pp
                            </div>
                          )}
                        </div>
                        {i < FLOW.length - 1 && (
                          <span className="text-[10px] text-slate-500 shrink-0 mt-4">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Cycle Indicator */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">CYCLE INDICATOR (Composite)</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" /> High Zone</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-500" /> Low Zone</span>
                  <span className={`text-[12px] font-bold px-1.5 py-0 border ${
                    currentComp === null ? 'text-slate-400 border-slate-700' :
                    currentComp >= 70    ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                    currentComp >= 40    ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' :
                                           'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  }`}>{currentComp ?? '—'}</span>
                </div>
              </div>
              <div className="h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visibleData} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }} />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4} />
                    <ReferenceLine y={40} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} />
                    <Area type="monotone" dataKey="comp" fill="#1e40af" fillOpacity={0.15} stroke="#3b82f6" strokeWidth={1.5} name="Composite Score" />
                    <Line type="monotone" dataKey="avg"  stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Long Term Avg" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Phase Probability ??source: cycle_phase_probability */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">CYCLE PHASE PROBABILITY</span>
              {phaseProb === null ? (
                <div className="mt-1.5 h-6 flex items-center text-[12px] text-slate-500">Loading…</div>
              ) : (
                <div className="flex mt-1.5 h-6 overflow-hidden rounded-sm text-[11px] font-bold text-white">
                  {phaseProb.early > 0 && (
                    <div className="flex items-center justify-center bg-slate-700/80 border-r border-slate-600 px-1 truncate" style={{ width: `${phaseProb.early}%` }}>
                      Recovery {phaseProb.early}%
                    </div>
                  )}
                  {phaseProb.expansion > 0 && (
                    <div className="flex items-center justify-center bg-blue-600 border-r border-blue-500 truncate" style={{ width: `${phaseProb.expansion}%` }}>
                      Expansion {phaseProb.expansion}%
                    </div>
                  )}
                  {phaseProb.peak > 0 && (
                    <div className="flex items-center justify-center bg-orange-600 border-r border-orange-500 truncate" style={{ width: `${phaseProb.peak}%` }}>
                      Peak Risk {phaseProb.peak}%
                    </div>
                  )}
                  {phaseProb.contraction > 0 && (
                    <div className="flex items-center justify-center bg-red-800 px-1 truncate" style={{ width: `${phaseProb.contraction}%` }}>
                      Contraction {phaseProb.contraction}%
                    </div>
                  )}
                </div>
              )}
            </div>

            </>)}

            {/* ???? PERFORMANCE VIEW ?????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'PERFORMANCE' && (
              <div className="space-y-3 pt-1">

                {/* 1. Bucket Performance Matrix */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bucket Performance Matrix</div>
                  {!periodReturns ? (
                    <div className="text-[12px] text-slate-500 py-3 text-center">Loading…</div>
                  ) : (
                    <table className="w-full text-[11px] font-mono">
                      <thead>
                        <tr className="text-[10px] text-slate-500 border-b border-slate-800">
                          <th className="text-left py-1 font-bold">BUCKET</th>
                          {(['1D','5D','1M','3M','6M'] as const).map(p => (
                            <th key={p} className="text-right py-1 font-bold pl-2">{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {([
                          { name: 'SOXX Index',        key: 'soxx',    color: '#3b82f6' },
                          { name: 'AI Infrastructure', key: 'ai',      color: '#10b981' },
                          { name: 'Memory',            key: 'mem',     color: '#f97316' },
                          { name: 'Foundry',           key: 'foundry', color: '#ec4899' },
                          { name: 'Equipment',         key: 'equip',   color: '#eab308' },
                        ] as const).map(b => {
                          const r = periodReturns[b.key]
                          return (
                            <tr key={b.name} className="hover:bg-white/5">
                              <td className="py-1 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                                <span className="text-slate-300 truncate">{b.name}</span>
                              </td>
                              {(['1D','5D','1M','3M','6M'] as const).map(p => (
                                <td key={p} className={`py-1 text-right pl-2 tabular-nums font-bold ${retColor(r[p])}`}>
                                  {fmtRet(r[p])}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 2. Relative Performance vs SOXX (1M) */}
                <div className="border-t border-slate-800 pt-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Relative Performance vs SOXX 夷?1M</div>
                  {!periodReturns ? (
                    <div className="text-[12px] text-slate-500">Loading…</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="grid text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800/50"
                        style={{ gridTemplateColumns: '1fr 56px 56px 64px' }}>
                        <span>Bucket</span>
                        <span className="text-right">Return</span>
                        <span className="text-right">vs SOXX</span>
                        <span className="text-right">Signal</span>
                      </div>
                      {([
                        { name: 'AI Infrastructure', key: 'ai',      color: '#10b981' },
                        { name: 'Memory',            key: 'mem',     color: '#f97316' },
                        { name: 'Foundry',           key: 'foundry', color: '#ec4899' },
                        { name: 'Equipment',         key: 'equip',   color: '#eab308' },
                      ] as const).map(b => {
                        const ret   = periodReturns[b.key]['1M']
                        const soxxR = periodReturns['soxx']['1M']
                        const rel   = ret !== null && soxxR !== null ? Math.round((ret - soxxR) * 10) / 10 : null
                        const sig   = rel === null ? '—' : rel > 5 ? 'Leading' : rel < -5 ? 'Lagging' : 'In Line'
                        const sigCls = sig === 'Leading' ? 'text-emerald-400' : sig === 'Lagging' ? 'text-red-400' : 'text-slate-400'
                        return (
                          <div key={b.name} className="grid items-center py-1 border-b border-slate-800/30 text-[11px] font-mono"
                            style={{ gridTemplateColumns: '1fr 56px 56px 64px' }}>
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                              <span className="text-slate-300 truncate">{b.name}</span>
                            </span>
                            <span className={`text-right tabular-nums font-bold ${retColor(ret)}`}>{fmtRet(ret)}</span>
                            <span className={`text-right tabular-nums font-bold ${retColor(rel)}`}>{rel !== null ? fmtRet(rel) : '—'}</span>
                            <span className={`text-right font-bold ${sigCls}`}>{sig}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 3. AI Regime Lens Panel */}
                {(() => {
                  const ar = interpData?.ai_regime
                  const REGIME_COLOR: Record<string, string> = {
                    AI_LED_BROAD:   'text-emerald-400',
                    AI_LED_NARROW:  'text-yellow-400',
                    ROTATING:       'text-sky-400',
                    BROAD_RECOVERY: 'text-blue-400',
                    CONTRACTION:    'text-red-400',
                  }
                  const COMP_COLOR = (state: string) =>
                    ['LEADING','CONFIRMED','SUPPORTING','BROAD'].includes(state) ? 'text-emerald-400' :
                    ['IN_LINE','PARTIAL','NEUTRAL'].includes(state)              ? 'text-yellow-400'  :
                    ['LAGGING','LAGGING_AI_DELAY','LAGGING_CYCLE','NOT_CONFIRMED','WEAK','NARROW','NARROWING','ROTATING'].includes(state) ? 'text-orange-400' :
                    'text-slate-500'
                  const COMP_LABEL = (state: string) =>
                    state === 'LAGGING_AI_DELAY' ? 'LAG AI DLY' :
                    state === 'LAGGING_CYCLE'    ? 'LAG CYCLE'  :
                    state === 'NOT_CONFIRMED'    ? 'NOT CONF'   :
                    state.replace(/_/g, ' ')
                  const signalPct = (s: number) => `${Math.max(0, Math.min(100, Math.round((s + 100) / 2)))}%`
                  const ROWS: { key: keyof NonNullable<typeof ar>; label: string }[] = [
                    { key: 'ai_infra',      label: 'AI Infra'  },
                    { key: 'memory',        label: 'Memory'    },
                    { key: 'foundry',       label: 'Foundry'   },
                    { key: 'equipment',     label: 'Equipment' },
                    { key: 'rotation_risk', label: 'Rotation'  },
                  ]
                  return (
                    <div className="border-t border-slate-800 pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">AI Regime Lens</div>
                        {ar && (
                          <span className={`text-[11px] font-bold uppercase tracking-widest border px-1 py-0.5 ${
                            ar.data_mode === 'live'    ? 'text-emerald-400 border-emerald-700/40' :
                            ar.data_mode === 'partial' ? 'text-yellow-400 border-yellow-700/40'  :
                                                         'text-slate-500 border-slate-700/40'
                          }`}>{ar.data_mode}</span>
                        )}
                      </div>
                      {/* Regime label + confidence row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[13px] font-black font-mono leading-none ${ar ? REGIME_COLOR[ar.regime_label] ?? 'text-slate-400' : 'text-slate-400'}`}>
                          {ar ? (REGIME_DISPLAY[ar.regime_label] ?? ar.regime_label.replace(/_/g, ' ')) : 'Awaiting data…'}
                        </span>
                        {ar && (
                          <span className={`text-[11px] uppercase tracking-widest ${
                            ar.regime_confidence === 'high'   ? 'text-emerald-500' :
                            ar.regime_confidence === 'medium' ? 'text-yellow-500'  : 'text-slate-500'
                          }`}>{ar.regime_confidence} conf.</span>
                        )}
                      </div>
                      {/* Component rows */}
                      <div className="space-y-1 mb-2">
                        {ROWS.map(({ key, label }) => {
                          const comp = ar?.[key] as AIRegimeComp | undefined
                          const sig  = comp?.signal ?? 0
                          const pct  = signalPct(sig)
                          const ppStr = comp ? `${comp.spread >= 0 ? '+' : ''}${comp.spread.toFixed(1)}pp` : '—'
                          return (
                            <div key={key} className="flex items-center gap-1.5">
                              <div className="text-[11px] text-slate-500 w-[52px] shrink-0">{label}</div>
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                                <div className={`h-full rounded-sm ${
                                  comp && ['LEADING','CONFIRMED','SUPPORTING','BROAD'].includes(comp.state) ? 'bg-emerald-500' :
                                  comp && ['IN_LINE','PARTIAL','NEUTRAL'].includes(comp.state)              ? 'bg-yellow-500'  :
                                  'bg-orange-500'
                                }`} style={{ width: pct }} />
                              </div>
                              <div className={`text-[11px] font-mono w-[58px] shrink-0 text-right ${comp ? COMP_COLOR(comp.state) : 'text-slate-400'}`}>
                                {comp ? COMP_LABEL(comp.state) : 'N/A'}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 w-[38px] shrink-0 text-right">{ppStr}</div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Regime context */}
                      {ar && interpData?.regime_context && (
                        <div className="text-[10px] text-slate-400 leading-snug border-t border-slate-800/60 pt-1.5 italic">
                          {interpData.regime_context}
                        </div>
                      )}
                    </div>
                  )
                })()}

              </div>
            )}

            {/* ???? BREADTH VIEW ???????????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'BREADTH' && (() => {
              // Derived breadth state from available fields
              const breadthDomain  = (domainSignals['breadth'] as number | undefined) ?? null
              // Score: use domain signal (0??00 scale from engine, already computed)
              // breadth_pct is % stocks above 20MA ??use as primary indicator
              const bScore = breadthDomain !== null ? Math.round(breadthDomain) : (live ? Math.round(breadthPct) : null)
              const bState =
                bScore === null       ? '—' :
                bScore >= 70          ? 'Healthy' :
                bScore >= 50          ? 'Neutral' :
                bScore >= 35          ? 'Narrow'  :
                conflictType === 'BREADTH_DIVERGENCE' ? 'Diverging' : 'Weak'
              const bStateCls =
                bState === 'Healthy'   ? 'text-emerald-400' :
                bState === 'Neutral'   ? 'text-yellow-400'  :
                bState === 'Narrow'    ? 'text-orange-400'  :
                bState === 'Diverging' ? 'text-red-400'     :
                bState === 'Weak'      ? 'text-red-400'     : 'text-slate-500'
              // Confidence impact from breadth domain
              const confImpact =
                bScore === null  ? '—'       :
                bScore >= 60     ? 'Supports' :
                bScore >= 40     ? 'Neutral'  : 'Lowers'
              const confImpactCls =
                confImpact === 'Supports' ? 'text-emerald-400' :
                confImpact === 'Neutral'  ? 'text-yellow-400'  :
                confImpact === 'Lowers'   ? 'text-red-400'     : 'text-slate-500'

              // Adv/Dec ??clamp to [0,100]; if either > 100 treat both as pending
              const advRaw = kpis?.advancing_pct ?? null
              const decRaw = kpis?.declining_pct ?? null
              const advDecValid = advRaw !== null && decRaw !== null && advRaw <= 100 && decRaw <= 100
              const advVal  = advDecValid ? advRaw! : null
              const decVal  = advDecValid ? decRaw! : null
              const netBreadth = advVal !== null && decVal !== null ? Math.round(advVal - decVal) : null

              // Conflict interpretation
              const isBreadthConflict =
                conflictType === 'AI_DISTORTION' ||
                conflictType === 'AI_INFRA_SUSTAINABILITY_RISK' ||
                conflictType === 'BREADTH_DIVERGENCE'
              const breadthInterpretation =
                conflictType === 'AI_DISTORTION'
                  ? 'The rally is being led by AI infrastructure while broader participation is limited.'
                : conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                  ? 'Breadth does not fully confirm the strength of AI infrastructure leadership.'
                : conflictType === 'BREADTH_DIVERGENCE'
                  ? 'Price trend and participation are moving in opposite directions.'
                : (conflictType === 'NO_CONFLICT' || conflictType === '—')
                  ? 'Participation is consistent with the current trend.'
                : primaryRisk || conflictNote || 'No breadth signal conflict detected.'

              return (
                <div className="space-y-3 pt-1">

                  {/* 1. Breadth Score Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Breadth Score</div>
                      <div className={`text-[20px] font-black font-mono leading-none ${bScore !== null ? bStateCls : 'text-slate-500'}`}>
                        {bScore !== null ? bScore : '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Breadth State</div>
                      <div className={`text-[14px] font-black leading-none mt-1 ${bStateCls}`}>
                        {bState}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Confidence Impact</div>
                      <div className={`text-[14px] font-black leading-none mt-1 ${confImpactCls}`}>
                        {confImpact}
                      </div>
                    </div>
                  </div>

                  {/* 2. Advancing / Declining Panel */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Advancing / Declining</div>
                    {!live ? (
                      <div className="text-[12px] text-slate-500 py-2 text-center">Loading…</div>
                    ) : !advDecValid ? (
                      <div className="text-[12px] text-slate-500 py-2 text-center">Data pending</div>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Stacked bar */}
                        <div className="flex h-3 w-full rounded-sm overflow-hidden">
                          <div className="bg-emerald-500/80 transition-all" style={{ width: `${advVal}%` }} />
                          <div className="bg-red-500/70 transition-all" style={{ width: `${decVal}%` }} />
                        </div>
                        <div className="grid grid-cols-3 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500">Adv </span>
                            <span className="text-emerald-400 font-bold">{advVal}%</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-500">Net </span>
                            <span className={`font-bold ${netBreadth !== null && netBreadth > 0 ? 'text-emerald-400' : netBreadth !== null && netBreadth < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              {netBreadth !== null ? `${netBreadth > 0 ? '+' : ''}${netBreadth}` : '—'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Dec </span>
                            <span className="text-red-400 font-bold">{decVal}%</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          % above 20MA: <span className="text-slate-300 font-bold">{breadthPct}%</span>
                          <span className="ml-2 text-slate-400">夷?{breadthLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Participation Health Panel */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Participation Health</div>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                      {([
                        { label: '% Above MA20',  key: 'pct_above_ma20'  as const },
                        { label: '% Above MA50',  key: 'pct_above_ma50'  as const },
                        { label: '% Above MA200', key: 'pct_above_ma200' as const },
                      ]).map(({ label, key }) => {
                        const val = live?.breadth_detail?.[key] ?? null
                        const cls = val === null ? 'text-slate-500' : val >= 65 ? 'text-emerald-400' : val >= 45 ? 'text-yellow-400' : 'text-red-400'
                        return (
                          <div key={label} className="bg-slate-900/40 border border-slate-800 p-1.5 text-center">
                            <div className="text-[11px] text-slate-500 uppercase mb-1">{label}</div>
                            <div className={`text-[13px] font-bold ${cls}`}>{val !== null ? `${val}%` : 'Pending'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3b. AI Concentration Mini Trend */}
                  {(() => {
                    const hist = live?.ai_infra_concentration_history ?? []
                    if (hist.length < 2) return null
                    const valid = hist.filter(r => r.top5_weight !== null)
                    if (valid.length < 2) return null
                    const first = valid[0].top5_weight!
                    const last  = valid[valid.length - 1].top5_weight!
                    const trend = last > first + 1 ? 'INCREASING' : last < first - 1 ? 'DECREASING' : 'STABLE'
                    const trendCls = trend === 'INCREASING' ? 'text-red-400' : trend === 'DECREASING' ? 'text-emerald-400' : 'text-yellow-400'
                    const trendIcon = trend === 'INCREASING' ? '—' : trend === 'DECREASING' ? '—' : '—'
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">AI Concentration Trend</span>
                          <span className={`text-[10px] font-black ${trendCls}`}>{trendIcon} {trend}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-mono">
                          <span className="text-slate-500">{first.toFixed(1)}% <span className="text-slate-400">→</span> <span className={trendCls}>{last.toFixed(1)}%</span></span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500">AI vs SOXX: <span className={`font-bold ${(valid[valid.length-1].ai_vs_soxx_spread ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {valid[valid.length-1].ai_vs_soxx_spread !== null ? `${(valid[valid.length-1].ai_vs_soxx_spread! >= 0 ? '+' : '')}${valid[valid.length-1].ai_vs_soxx_spread!.toFixed(2)}%` : '—'}
                          </span></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 4. Breadth Interpretation */}
                  <div className={`border-t border-slate-800 pt-2`}>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Breadth Interpretation</div>
                    <div className={`p-2 rounded-sm border text-[11px] ${
                      isBreadthConflict
                        ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-bold text-[10px] uppercase px-1 rounded-sm ${
                          isBreadthConflict ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'
                        }`}>{displayConflict(conflictType)}</span>
                      </div>
                      <span className="text-slate-300">{breadthInterpretation}</span>
                    </div>
                  </div>

                  {/* 5. Breadth History Chart */}
                  {(() => {
                    const bhData = live?.breadth_detail?.breadth_history ?? []
                    const chartData = bhData.slice(-60)
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Breadth History</div>
                          {bhData.length > 0 && (
                            <div className="text-[11px] text-slate-500">
                              {live?.breadth_detail?.universe_count ?? 0} tickers 夷?last {bhData.length}d
                            </div>
                          )}
                        </div>
                        {chartData.length > 0 ? (
                          <div className="h-[60px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -28 }}>
                                <defs>
                                  <linearGradient id="breadthGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                                  </linearGradient>
                                </defs>
                                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
                                <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="breadth_score" stroke="#10b981" strokeWidth={1.2} fill="url(#breadthGrad)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-[12px] text-slate-500 py-3 text-center">Data pending</div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )
            })()}

            {/* ???? MOMENTUM VIEW ?????????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'MOMENTUM' && (() => {
              // domain_signals.momentum is a signed score from engineScore
              // positive = bullish, negative = bearish
              const momRaw = (domainSignals['momentum'] as number | undefined) ?? null

              // Direction label from signal
              const momDir =
                momRaw === null      ? '—'            :
                momRaw > 40          ? 'Strengthening' :
                momRaw >= -20        ? 'Stable'        :
                momRaw >= -50        ? 'Weakening'     : 'Reversing'
              const momDirCls =
                momDir === 'Strengthening' ? 'text-emerald-400' :
                momDir === 'Stable'        ? 'text-yellow-400'  :
                momDir === 'Weakening'     ? 'text-orange-400'  :
                momDir === 'Reversing'     ? 'text-red-400'     : 'text-slate-500'

              // Exhaustion heuristic: near Peak Risk + high engine score
              const exhaustionRisk =
                stageName === 'PEAK RISK'           ? 'High'   :
                stageName === 'LATE EXPANSION'      ? 'Medium' :
                engineScore >= 75 && momRaw !== null && momRaw < 20 ? 'Medium' : 'Low'
              const exhCls =
                exhaustionRisk === 'High'   ? 'text-red-400'    :
                exhaustionRisk === 'Medium' ? 'text-orange-400' : 'text-emerald-400'

              // Momentum regime label
              const momRegime =
                marketRegime === 'RISK ON'  && momDir === 'Strengthening' ? 'Accelerating'  :
                marketRegime === 'RISK ON'  && momDir === 'Stable'        ? 'Sustaining'    :
                marketRegime === 'NEUTRAL'  && momDir === 'Weakening'     ? 'Fading'        :
                marketRegime === 'RISK OFF'                               ? 'Deteriorating' :
                momDir === 'Reversing'                                    ? 'Reversing'     : marketRegime

              // Conflict interpretation
              const isMomConflict =
                conflictType === 'MOMENTUM_DIVERGENCE' ||
                conflictType === 'AI_DISTORTION'       ||
                conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
              const momInterpretation =
                conflictType === 'MOMENTUM_DIVERGENCE'
                  ? 'Price trend remains positive, but momentum is weakening.'
                : conflictType === 'AI_DISTORTION'
                  ? 'Momentum is concentrated in AI infrastructure leaders.'
                : conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                  ? 'Momentum strength depends heavily on concentrated AI infrastructure leadership.'
                : (conflictType === 'NO_CONFLICT' || conflictType === '—')
                  ? 'Momentum is consistent with the current trend.'
                : primaryRisk || conflictNote || 'No momentum conflict detected.'

              // Bucket momentum proxy from 1M period returns (relative to SOXX 1M)
              const soxx1M  = periodReturns?.['soxx']?.['1M']    ?? null
              const bucketMom = periodReturns ? ([
                { name: 'AI Infrastructure', key: 'ai',      color: '#10b981' },
                { name: 'Memory',            key: 'mem',     color: '#f97316' },
                { name: 'Foundry',           key: 'foundry', color: '#ec4899' },
                { name: 'Equipment',         key: 'equip',   color: '#eab308' },
              ] as const).map(b => {
                const ret1m = periodReturns[b.key]?.['1M'] ?? null
                const rel   = ret1m !== null && soxx1M !== null ? Math.round((ret1m - soxx1M) * 10) / 10 : null
                const dir   =
                  rel === null  ? '—'            :
                  rel > 5       ? 'Accelerating' :
                  rel > 0       ? 'Sustaining'   :
                  rel > -5      ? 'Fading'       : 'Decelerating'
                const dirCls =
                  dir === 'Accelerating' ? 'text-emerald-400' :
                  dir === 'Sustaining'   ? 'text-yellow-400'  :
                  dir === 'Fading'       ? 'text-orange-400'  :
                  dir === 'Decelerating' ? 'text-red-400'     : 'text-slate-500'
                return { name: b.name, color: b.color, ret1m, rel, dir, dirCls }
              }) : null

              return (
                <div className="space-y-3 pt-1">

                  {/* 1. Momentum Summary Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Momentum Signal</div>
                      <div className={`text-[20px] font-black font-mono leading-none ${momRaw !== null ? momDirCls : 'text-slate-500'}`}>
                        {momRaw !== null ? (momRaw >= 0 ? `+${momRaw.toFixed(0)}` : momRaw.toFixed(0)) : '—'}
                      </div>
                      <div className={`text-[10px] mt-0.5 font-bold ${momDirCls}`}>{momDir}</div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Momentum Regime</div>
                      <div className={`text-[14px] font-black leading-none mt-1 ${momDirCls}`}>
                        {live ? momRegime : '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">RSI 14</div>
                      {(() => {
                        const rsi = live?.momentum_detail?.rsi_14 ?? null
                        const cls = rsi === null ? 'text-slate-500' : rsi >= 70 ? 'text-red-400' : rsi <= 30 ? 'text-emerald-400' : 'text-yellow-400'
                        const lbl = rsi === null ? '' : rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral'
                        return (
                          <>
                            <div className={`text-[20px] font-black font-mono leading-none mt-0.5 ${cls}`}>
                              {rsi !== null ? rsi.toFixed(1) : 'Pending'}
                            </div>
                            {lbl && <div className={`text-[11px] mt-0.5 font-bold ${cls}`}>{lbl}</div>}
                          </>
                        )
                      })()}
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">MACD</div>
                      {(() => {
                        const macd = live?.momentum_detail?.macd ?? null
                        const stateCls =
                          macd?.state === 'above_signal' ? 'text-emerald-400' :
                          macd?.state === 'below_signal' ? 'text-red-400'     :
                          macd?.state === 'neutral'      ? 'text-yellow-400'  : 'text-slate-500'
                        const stateLabel =
                          macd?.state === 'above_signal' ? 'Above Signal' :
                          macd?.state === 'below_signal' ? 'Below Signal' :
                          macd?.state === 'neutral'      ? 'Neutral'      : 'Pending'
                        return (
                          <>
                            <div className={`text-[14px] font-black leading-none mt-1 ${stateCls}`}>{stateLabel}</div>
                            {macd?.histogram != null && (
                              <div className={`text-[11px] mt-0.5 font-mono ${stateCls}`}>
                                hist {macd.histogram >= 0 ? '+' : ''}{macd.histogram.toFixed(2)}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* 1b. ROC Strip */}
                  {(() => {
                    const md = live?.momentum_detail
                    const rocs = [
                      { label: 'ROC 1M', val: md?.roc_1m ?? null },
                      { label: 'ROC 3M', val: md?.roc_3m ?? null },
                      { label: 'ROC 6M', val: md?.roc_6m ?? null },
                    ]
                    return (
                      <div className="grid grid-cols-3 gap-1.5 -mt-1">
                        {rocs.map(({ label, val }) => {
                          const cls = val === null ? 'text-slate-500' : val > 0 ? 'text-emerald-400' : 'text-red-400'
                          return (
                            <div key={label} className="bg-slate-900/40 border border-slate-800 p-1.5 text-center">
                              <div className="text-[11px] text-slate-500 uppercase mb-0.5">{label}</div>
                              <div className={`text-[12px] font-bold font-mono ${cls}`}>
                                {val !== null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : 'Pending'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* 2. Bucket Momentum Ranking */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bucket Momentum Ranking</span>
                      <span className="text-[11px] text-slate-400 bg-slate-800/60 px-1 rounded-sm">1M return proxy</span>
                    </div>
                    {!periodReturns ? (
                      <div className="text-[12px] text-slate-500 py-2 text-center">Data pending</div>
                    ) : (
                      <div>
                        <div className="grid text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800/50"
                          style={{ gridTemplateColumns: '1fr 52px 56px 80px' }}>
                          <span>Bucket</span>
                          <span className="text-right">1M Ret</span>
                          <span className="text-right">vs SOXX</span>
                          <span className="text-right">Direction</span>
                        </div>
                        {/* SOXX baseline row */}
                        <div className="grid items-center py-1 border-b border-slate-800/30 text-[11px] font-mono"
                          style={{ gridTemplateColumns: '1fr 52px 56px 80px' }}>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0 bg-blue-500" />
                            <span className="text-slate-400">SOXX Index</span>
                          </span>
                          <span className={`text-right tabular-nums font-bold ${retColor(soxx1M)}`}>{fmtRet(soxx1M)}</span>
                          <span className="text-right text-slate-500">—</span>
                          <span className={`text-right font-bold ${
                            soxx1M !== null && soxx1M > 0 ? 'text-emerald-400' : soxx1M !== null && soxx1M < 0 ? 'text-red-400' : 'text-slate-500'
                          }`}>{soxx1M !== null ? (soxx1M > 0 ? 'Sustaining' : 'Fading') : '—'}</span>
                        </div>
                        {bucketMom?.map(b => (
                          <div key={b.name} className="grid items-center py-1 border-b border-slate-800/30 text-[11px] font-mono"
                            style={{ gridTemplateColumns: '1fr 52px 56px 80px' }}>
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                              <span className="text-slate-300 truncate">{b.name}</span>
                            </span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.ret1m)}`}>{fmtRet(b.ret1m)}</span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.rel)}`}>{b.rel !== null ? fmtRet(b.rel) : '—'}</span>
                            <span className={`text-right font-bold ${b.dirCls}`}>{b.dir}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Momentum Conflict Detector */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Momentum Conflict Detector</div>
                    <div className={`p-2 rounded-sm border text-[11px] ${
                      isMomConflict ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-bold text-[10px] uppercase px-1 rounded-sm ${
                          isMomConflict ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'
                        }`}>{displayConflict(conflictType)}</span>
                      </div>
                      <span className="text-slate-300">{momInterpretation}</span>
                    </div>
                  </div>

                  {/* 4. Momentum History */}
                  {(() => {
                    const mhData   = live?.momentum_detail?.momentum_history ?? []
                    const chartData = mhData.slice(-60)
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Momentum History</span>
                          {mhData.length > 0 && (
                            <span className="text-[11px] text-slate-500">SOXX 夷?last {mhData.length}d</span>
                          )}
                        </div>
                        {chartData.length > 0 ? (
                          <div className="h-[60px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -28 }}>
                                <defs>
                                  <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                                  </linearGradient>
                                </defs>
                                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
                                <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="momentum_score" stroke="#6366f1" strokeWidth={1.2} fill="url(#momGrad)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-[12px] text-slate-500 py-3 text-center">Data pending</div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )
            })()}

            {/* ???? CORRELATION VIEW ?????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'CORRELATION' && (() => {
              // Dependency signals from engine domain scores
              const aiInfraSig   = (domainSignals['ai_infra']   as number | undefined) ?? null
              const leaderSig    = (domainSignals['leadership'] as number | undefined) ?? null

              // Primary linked bucket: infer from primary_driver text or ai_infra signal
              const driverIsAI   = primaryDriver.toLowerCase().includes('ai') || primaryDriver.toLowerCase().includes('nvda') || primaryDriver.toLowerCase().includes('avgo')
              const primaryBucket = driverIsAI ? 'AI Infrastructure' : (primaryDriver !== '—' ? primaryDriver : live ? 'Analyzing…' : '—')

              // Concentration risk level
              const concRisk =
                conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'            ? 'High'     :
                conflictType === 'AI_DISTORTION'                           ? 'Elevated' :
                (concentration !== null && concentration >= 85)            ? 'Elevated' :
                (concentration !== null && concentration >= 65)            ? 'Moderate' :
                concentration !== null                                     ? 'Low'      : null

              const concRiskCls =
                concRisk === 'High'     ? 'text-red-400'    :
                concRisk === 'Elevated' ? 'text-orange-400' :
                concRisk === 'Moderate' ? 'text-yellow-400' :
                concRisk === 'Low'      ? 'text-emerald-400': 'text-slate-500'

              // EW vs CW interpretation
              const ewInterpretation =
                ewVsCw === null          ? null :
                ewVsCw < -20             ? 'Cap-weight leadership concentrated' :
                ewVsCw < -10             ? 'Some cap-weight tilt'               :
                ewVsCw >= -10            ? 'Broad participation'                : null
              const concTop5Label =
                concentration === null    ? null :
                concentration >= 85       ? 'Top-heavy leadership'             :
                concentration >= 65       ? 'Moderate concentration'           : 'Distributed'

              // Bucket dependency proxy from periodReturns (1M vs SOXX)
              const soxx1M = periodReturns?.['soxx']?.['1M'] ?? null
              const bucketDep = periodReturns ? ([
                { name: 'AI Infrastructure', key: 'ai',      color: '#10b981' },
                { name: 'Memory',            key: 'mem',     color: '#f97316' },
                { name: 'Foundry',           key: 'foundry', color: '#ec4899' },
                { name: 'Equipment',         key: 'equip',   color: '#eab308' },
              ] as const).map(b => {
                const ret1m = periodReturns[b.key]?.['1M'] ?? null
                const rel   = ret1m !== null && soxx1M !== null ? Math.round((ret1m - soxx1M) * 10) / 10 : null
                const dep   =
                  rel === null  ? '—'             :
                  rel > 10      ? 'High'          :
                  rel > 3       ? 'Leading'       :
                  rel > -3      ? 'Neutral'       :
                  rel > -10     ? 'Lagging'       : 'Weak'
                const depCls =
                  dep === 'High'    ? 'text-emerald-400' :
                  dep === 'Leading' ? 'text-emerald-400' :
                  dep === 'Neutral' ? 'text-yellow-400'  :
                  dep === 'Lagging' ? 'text-orange-400'  :
                  dep === 'Weak'    ? 'text-red-400'      : 'text-slate-500'
                const comment =
                  b.key === 'ai'      && dep === 'High'    ? 'High dependency proxy'         :
                  b.key === 'ai'      && dep === 'Leading' ? 'Leading / high dependency proxy':
                  b.key === 'mem'     && (dep === 'Lagging' || dep === 'Weak') ? 'Weak confirmation' :
                  b.key === 'foundry'                      ? 'Neutral / cycle-aligned'       :
                  b.key === 'equip'   && dep === 'Lagging' ? 'Late-cycle confirmation pending':
                  '—'
                return { name: b.name, color: b.color, ret1m, rel, dep, depCls, comment }
              }) : null

              // Conflict interpretation
              const isCorrelConflict =
                conflictType === 'AI_DISTORTION'            ||
                conflictType === 'AI_INFRA_SUSTAINABILITY_RISK' ||
                conflictType === 'SECTOR_ROTATION'          ||
                conflictType === 'BREADTH_DIVERGENCE'
              const correlInterpretation =
                conflictType === 'AI_DISTORTION'
                  ? 'SOXX strength is heavily dependent on AI infrastructure leadership while other buckets lag.'
                : conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                  ? 'SOXX remains positively driven by AI infrastructure, but the dependency is structurally fragile.'
                : conflictType === 'SECTOR_ROTATION'
                  ? 'Leadership is rotating across semiconductor buckets.'
                : conflictType === 'BREADTH_DIVERGENCE'
                  ? 'SOXX price is diverging from broad bucket participation.'
                : (conflictType === 'NO_CONFLICT' || conflictType === '—')
                  ? 'Bucket dependency is consistent with the current semiconductor trend.'
                : primaryRisk || conflictNote || 'No correlation conflict detected.'

              return (
                <div className="space-y-3 pt-1">

                  {/* 1. SOXX Dependency Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Primary Linked Bucket</div>
                      <div className="text-[12px] font-black leading-none mt-1 text-slate-200">
                        {live ? primaryBucket : '—'}
                      </div>
                      {aiInfraSig !== null && (
                        <div className="text-[11px] text-slate-500 mt-0.5">AI Infra signal: {aiInfraSig >= 0 ? '+' : ''}{aiInfraSig.toFixed(0)}</div>
                      )}
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Concentration Risk</div>
                      <div className={`text-[14px] font-black leading-none mt-1 ${concRiskCls}`}>
                        {concRisk ?? 'Data pending'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Leadership Signal</div>
                      <div className={`text-[18px] font-black font-mono leading-none ${leaderSig !== null ? (leaderSig > 20 ? 'text-emerald-400' : leaderSig < -20 ? 'text-red-400' : 'text-yellow-400') : 'text-slate-500'}`}>
                        {leaderSig !== null ? (leaderSig >= 0 ? `+${leaderSig.toFixed(0)}` : leaderSig.toFixed(0)) : '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Confidence</div>
                      <div className={`text-[12px] font-black leading-none mt-1 ${
                        confidenceLabel === 'High' ? 'text-emerald-400' : confidenceLabel === 'Low' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {live ? `${confidenceScore} (${confidenceLabel})` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 2. Bucket Dependency Matrix */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bucket Dependency Matrix</span>
                      <span className="text-[11px] text-slate-400 bg-slate-800/60 px-1 rounded-sm">dependency proxy 夷?not true correlation</span>
                    </div>
                    {!periodReturns ? (
                      <div className="text-[12px] text-slate-500 py-2 text-center">Data pending</div>
                    ) : (
                      <div>
                        <div className="grid text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800/50"
                          style={{ gridTemplateColumns: '1fr 52px 52px 1fr' }}>
                          <span>Bucket</span>
                          <span className="text-right">1M</span>
                          <span className="text-right">vs SOXX</span>
                          <span className="text-right">Dependency</span>
                        </div>
                        {bucketDep?.map(b => (
                          <div key={b.name} className="grid items-center py-1 border-b border-slate-800/30 text-[11px] font-mono"
                            style={{ gridTemplateColumns: '1fr 52px 52px 1fr' }}>
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                              <span className="text-slate-300 truncate">{b.name}</span>
                            </span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.ret1m)}`}>{fmtRet(b.ret1m)}</span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.rel)}`}>{b.rel !== null ? fmtRet(b.rel) : '—'}</span>
                            <span className={`text-right font-bold ${b.depCls}`}>{b.dep}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Cap-weight vs Equal-weight Spread */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cap-Weight vs Equal-Weight</div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-slate-900/40 border border-slate-800 p-2">
                        <div className="text-[10px] text-slate-500 uppercase mb-1">EW vs CW Spread</div>
                        <div className={`text-[18px] font-black font-mono leading-none ${
                          ewVsCw === null ? 'text-slate-500' :
                          ewVsCw < -20   ? 'text-red-400'    :
                          ewVsCw < -10   ? 'text-orange-400' : 'text-slate-300'
                        }`}>
                          {ewVsCw !== null ? `${ewVsCw >= 0 ? '+' : ''}${ewVsCw.toFixed(1)}` : 'Data pending'}
                        </div>
                        {ewInterpretation && <div className="text-[11px] text-slate-500 mt-0.5">{ewInterpretation}</div>}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 p-2">
                        <div className="text-[10px] text-slate-500 uppercase mb-1">Top 5 Concentration</div>
                        <div className={`text-[18px] font-black font-mono leading-none ${
                          concentration === null ? 'text-slate-500' :
                          concentration >= 85    ? 'text-red-400'    :
                          concentration >= 65    ? 'text-orange-400' : 'text-slate-300'
                        }`}>
                          {concentration !== null ? `${Math.round(concentration)}%` : 'Data pending'}
                        </div>
                        {concTop5Label && <div className="text-[11px] text-slate-500 mt-0.5">{concTop5Label}</div>}
                      </div>
                    </div>
                  </div>

                  {/* 4. Correlation Interpretation */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Correlation Interpretation</div>
                    <div className={`p-2 rounded-sm border text-[11px] ${
                      isCorrelConflict ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-bold text-[10px] uppercase px-1 rounded-sm ${
                          isCorrelConflict ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'
                        }`}>{displayConflict(conflictType)}</span>
                      </div>
                      <span className="text-slate-300">{correlInterpretation}</span>
                    </div>
                  </div>

                  {/* 4b. EW vs CW Divergence Context */}
                  {(() => {
                    const hist = live?.ai_infra_concentration_history ?? []
                    const valid = hist.filter(r => r.ew_vs_cw_spread !== null)
                    if (valid.length < 5) return null
                    const recent  = valid.slice(-5).map(r => r.ew_vs_cw_spread!)
                    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
                    const label = avgRecent > 0.5 ? 'Breadth broadening (EW leading CW)' : avgRecent < -0.5 ? 'Concentration narrowing (CW leading EW)' : 'EW / CW aligned'
                    const cls   = avgRecent > 0.5 ? 'text-emerald-400' : avgRecent < -0.5 ? 'text-orange-400' : 'text-slate-400'
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Divergence Context (5d avg)</span>
                          <span className={`text-[10px] font-bold font-mono ${cls}`}>
                            EW {avgRecent >= 0 ? '+' : ''}{avgRecent.toFixed(2)}% vs CW
                          </span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${cls}`}>{label}</div>
                      </div>
                    )
                  })()}

                  {/* 5. Correlation Matrix Heatmap */}
                  {(() => {
                    const cm = live?.correlation_matrix ?? null
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Correlation Matrix</span>
                          {cm && <span className="text-[11px] text-slate-500">Pearson 夷?{cm.window_days}d window</span>}
                        </div>
                        {cm ? (() => {
                          const n = cm.labels.length
                          const cellCls = (v: number, i: number, j: number): string => {
                            if (i === j) return 'bg-slate-700/60 text-slate-400'
                            if (v >= 0.85) return 'bg-emerald-500/30 text-emerald-300'
                            if (v >= 0.70) return 'bg-emerald-500/15 text-emerald-400'
                            if (v >= 0.50) return 'bg-yellow-500/15 text-yellow-400'
                            if (v >= 0.30) return 'bg-orange-500/15 text-orange-400'
                            return 'bg-red-500/15 text-red-400'
                          }
                          // Short label map for columns
                          const short = (l: string) => l === 'AI Infra' ? 'AI' : l === 'Equipment' ? 'Equip' : l === 'Foundry' ? 'Fndry' : l === 'Memory' ? 'Mem' : l
                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px] font-mono border-collapse">
                                <thead>
                                  <tr>
                                    <th className="text-left text-slate-500 pb-1 pr-1 font-normal w-16"></th>
                                    {cm.labels.map(l => (
                                      <th key={l} className="text-center text-slate-500 pb-1 font-normal px-0.5">{short(l)}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {cm.values.map((row, i) => (
                                    <tr key={cm.labels[i]}>
                                      <td className="text-slate-400 pr-1 py-0.5 text-[11px] truncate max-w-[60px]">{short(cm.labels[i])}</td>
                                      {row.map((v, j) => (
                                        <td key={j} className={`text-center py-0.5 px-0.5 rounded-sm ${cellCls(v, i, j)}`}>
                                          {i === j ? '—' : v.toFixed(2)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="flex gap-2 mt-1.5 text-[11px] text-slate-400">
                                <span className="text-emerald-400">■</span><span>≥0.85 High</span>
                                <span className="text-yellow-400">■</span><span>0.50–0.70 Mod</span>
                                <span className="text-red-400">■</span><span>&lt;0.30 Low</span>
                              </div>
                            </div>
                          )
                        })() : (
                          <div className="text-[12px] text-slate-500 py-3 text-center">Data pending</div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )
            })()}

            {/* ???? MAP VIEW ?????????????????????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'MAP' && (() => {
              // Cycle stage positions for the cycle strip
              const CYCLE_STAGES = ['CONTRACTION', 'TROUGH', 'RECOVERY', 'MID EXPANSION', 'LATE EXPANSION', 'PEAK RISK'] as const
              const currentStageIdx = CYCLE_STAGES.findIndex(s => s === stageName)

              // Bucket tile data ??all from periodReturns + buckets API
              const soxx1M = periodReturns?.['soxx']?.['1M'] ?? null
              type BucketKey = 'ai' | 'mem' | 'foundry' | 'equip'
              const BUCKET_DEFS: Array<{ name: string; key: BucketKey; color: string; accentCls: string }> = [
                { name: 'AI Infrastructure', key: 'ai',      color: '#10b981', accentCls: 'border-emerald-500/40' },
                { name: 'Memory',            key: 'mem',     color: '#f97316', accentCls: 'border-orange-500/40' },
                { name: 'Foundry',           key: 'foundry', color: '#ec4899', accentCls: 'border-pink-500/40'   },
                { name: 'Equipment',         key: 'equip',   color: '#eab308', accentCls: 'border-yellow-500/40' },
              ]
              const tiles = BUCKET_DEFS.map(b => {
                const ret1m = periodReturns?.[b.key]?.['1M'] ?? null
                const ret5d  = periodReturns?.[b.key]?.['5D'] ?? null
                const rel   = ret1m !== null && soxx1M !== null ? Math.round((ret1m - soxx1M) * 10) / 10 : null
                const dir   =
                  rel === null  ? '—'       :
                  rel > 5       ? 'Leading'  :
                  rel > -5      ? 'Neutral'  : 'Lagging'
                const dirCls =
                  dir === 'Leading' ? 'text-emerald-400' :
                  dir === 'Neutral' ? 'text-yellow-400'  :
                  dir === 'Lagging' ? 'text-red-400'      : 'text-slate-500'
                // Driver/risk tag: check if this bucket matches primary driver/risk
                const isDriver = primaryDriver.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
                const isRisk   = primaryRisk.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])
                const tag = isDriver ? 'DRIVER' : isRisk ? 'RISK' : null
                const tagCls = isDriver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                return { ...b, ret1m, ret5d, rel, dir, dirCls, tag, tagCls }
              })

              // AI Concentration overlay text
              const aiOverlay =
                conflictType === 'AI_DISTORTION'
                  ? 'AI leadership is strong but narrow.'
                : conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                  ? 'AI leadership is extremely concentrated; sustainability risk is elevated.'
                : (conflictType === 'NO_CONFLICT' || conflictType === '—')
                  ? 'Leadership map is broadly aligned with the current trend.'
                : primaryRisk || conflictNote || 'No concentration conflict.'

              // Map interpretation
              const mapInterpretation = (() => {
                const driver = primaryDriver !== '—' ? `${primaryDriver} is the dominant driver.` : ''
                const risk   = primaryRisk   !== '—' ? ` Risk: ${primaryRisk}.` : ''
                const conf   = confidenceLabel !== '—' ? ` Engine confidence: ${confidenceLabel}.` : ''
                return (driver + risk + conf).trim() || 'Engine output pending.'
              })()

              return (
                <div className="space-y-3 pt-1">

                  {/* 1. Bucket Map tiles */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bucket Map</span>
                      {live?.bucket_weights
                        ? <span className="text-[11px] text-emerald-600 bg-emerald-900/20 px-1 rounded-sm">market-cap weighted</span>
                        : <span className="text-[11px] text-slate-400 bg-slate-800/60 px-1 rounded-sm">equal-size</span>
                      }
                    </div>
                    {/* Weight bar */}
                    {live?.bucket_weights && (() => {
                      const MAP_BUCKETS = ['AI Infrastructure', 'Foundry', 'Equipment', 'Memory']
                      const bwMap = Object.fromEntries((live.bucket_weights ?? []).map(b => [b.bucket, b.weight]))
                      const colors: Record<string, string> = {
                        'AI Infrastructure': '#10b981', Memory: '#f97316',
                        Foundry: '#ec4899', Equipment: '#eab308',
                      }
                      return (
                        <div className="flex h-2 rounded-sm overflow-hidden mb-1.5 gap-px">
                          {MAP_BUCKETS.map(bucket => {
                            const w = bwMap[bucket] ?? 0
                            return w > 0 ? (
                              <div key={bucket} style={{ flexGrow: w, backgroundColor: colors[bucket] ?? '#64748b' }}
                                title={`${bucket}: ${(w * 100).toFixed(1)}%`} />
                            ) : null
                          })}
                        </div>
                      )
                    })()}
                    {!periodReturns ? (
                      <div className="text-[12px] text-slate-500 py-3 text-center">Data pending</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* SOXX reference tile */}
                        <div className="col-span-2 border border-blue-500/30 bg-slate-900/50 rounded-sm p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm shrink-0 bg-blue-500" />
                            <span className="text-[11px] font-bold text-slate-300">SOXX Index</span>
                            <span className="text-[11px] text-slate-400 bg-slate-800/60 px-1 rounded-sm">benchmark</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500">1M</div>
                              <div className={`text-[13px] font-black font-mono tabular-nums ${retColor(soxx1M)}`}>{fmtRet(soxx1M)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500">Score</div>
                              <div className="text-[13px] font-black font-mono text-blue-400">{engineScore}</div>
                            </div>
                          </div>
                        </div>
                        {/* Bucket tiles */}
                        {tiles.map(b => {
                          const bwEntry = live?.bucket_weights?.find(bw => bw.bucket === b.name)
                          const bwPct   = bwEntry?.weight != null ? `${(bwEntry.weight * 100).toFixed(1)}%` : null
                          return (
                          <div key={b.name} className={`border ${b.accentCls} bg-slate-900/50 rounded-sm p-2`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                                <span className="text-[10px] font-bold text-slate-300 truncate">{b.name}</span>
                                {bwPct && <span className="text-[9px] text-slate-500 font-mono">{bwPct}</span>}
                              </div>
                              {b.tag && (
                                <span className={`text-[9px] font-black px-1 rounded-sm ${b.tagCls}`}>{b.tag}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                              <div>
                                <div className="text-[11px] text-slate-500">1M</div>
                                <div className={`font-black tabular-nums ${retColor(b.ret1m)}`}>{fmtRet(b.ret1m)}</div>
                              </div>
                              <div>
                                <div className="text-[11px] text-slate-500">vs SOXX</div>
                                <div className={`font-black tabular-nums ${retColor(b.rel)}`}>{b.rel !== null ? fmtRet(b.rel) : '—'}</div>
                              </div>
                            </div>
                            <div className={`text-[11px] font-bold mt-1 ${b.dirCls}`}>{b.dir}</div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>

                  {/* 2. Cycle Position Strip */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cycle Position</div>
                    <div className="flex gap-1">
                      {CYCLE_STAGES.map((s, i) => {
                        const isCurrent = i === currentStageIdx || (currentStageIdx === -1 && s === 'MID EXPANSION' && stageName.includes('EXPANSION'))
                        return (
                          <div key={s} className={`flex-1 text-center py-1 rounded-sm text-[9px] font-bold border transition-colors ${
                            isCurrent
                              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                              : 'border-slate-800 text-slate-400'
                          }`}>
                            {s.replace(' ', '—')}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>Engine Score: <span className="text-slate-300 font-bold">{live ? engineScore : '—'}</span></span>
                      <span>Confidence: <span className={`font-bold ${confidenceLabel === 'High' ? 'text-emerald-400' : confidenceLabel === 'Low' ? 'text-red-400' : 'text-yellow-400'}`}>{live ? confidenceLabel : '—'}</span></span>
                    </div>
                  </div>

                  {/* 3. AI Concentration Overlay */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">AI Concentration Overlay</span>
                      {(() => {
                        const hist  = live?.ai_infra_concentration_history ?? []
                        const valid = hist.filter(r => r.top5_weight !== null)
                        if (valid.length < 2) return null
                        const first = valid[0].top5_weight!
                        const last  = valid[valid.length - 1].top5_weight!
                        const trend = last > first + 1 ? 'INCREASING' : last < first - 1 ? 'DECREASING' : 'STABLE'
                        const cls   = trend === 'INCREASING' ? 'text-red-400 bg-red-900/20' : trend === 'DECREASING' ? 'text-emerald-400 bg-emerald-900/20' : 'text-yellow-400 bg-yellow-900/20'
                        return <span className={`text-[9px] font-black px-1 rounded-sm ${cls}`}>Dominance {trend}</span>
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-slate-900/40 border border-slate-800 p-1.5 text-center">
                        <div className="text-[11px] text-slate-500 uppercase">Top 5 Concentration</div>
                        <div className={`text-[16px] font-black font-mono ${
                          concentration === null ? 'text-slate-500' :
                          concentration >= 85    ? 'text-red-400'    :
                          concentration >= 65    ? 'text-orange-400' : 'text-slate-300'
                        }`}>{concentration !== null ? `${Math.round(concentration)}%` : 'pending'}</div>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 p-1.5 text-center">
                        <div className="text-[11px] text-slate-500 uppercase">EW vs CW Spread</div>
                        <div className={`text-[16px] font-black font-mono ${
                          ewVsCw === null ? 'text-slate-500' :
                          ewVsCw < -20   ? 'text-red-400'    :
                          ewVsCw < -10   ? 'text-orange-400' : 'text-slate-300'
                        }`}>{ewVsCw !== null ? `${ewVsCw >= 0 ? '+' : ''}${ewVsCw.toFixed(1)}` : 'pending'}</div>
                      </div>
                    </div>
                    <div className={`p-2 rounded-sm border text-[11px] ${
                      conflictType === 'AI_DISTORTION' || conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                        ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <span className="text-slate-300">{aiOverlay}</span>
                    </div>
                  </div>

                  {/* 4. Map Interpretation */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Map Interpretation</div>
                    <div className={`p-2 rounded-sm border text-[11px] ${
                      hasConflict ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-bold text-[10px] uppercase px-1 rounded-sm ${
                          hasConflict ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'
                        }`}>{displayConflict(conflictType)}</span>
                      </div>
                      <span className="text-slate-300">{mapInterpretation}</span>
                    </div>
                  </div>

                </div>
              )
            })()}

          </Panel>

          {/* History Table */}
          <Panel title="History Table" icon={History}>
            <div className="flex border-b border-slate-800 mb-2 -mx-2 px-2 shrink-0">
              {['HISTORY TABLE', 'EVENT LOG'].map(t => (
                <button key={t} onClick={() => setHistTab(t)}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-widest border-b-2 transition-colors ${
                    histTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-400'
                  }`}>{t}</button>
              ))}
            </div>

            {histTab === 'HISTORY TABLE' && (
              historyRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-500">Loading history…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] font-mono">
                    <thead>
                      <tr className="text-[11px] text-slate-400 border-b border-slate-800">
                        <th className="text-left py-1 font-bold pr-3">DATE</th>
                        <th className="text-left py-1 font-bold pr-3">STAGE</th>
                        <th className="text-right py-1 font-bold pr-3">ENGINE</th>
                        <th className="text-right py-1 font-bold pr-3">STRATEGY</th>
                        <th className="text-left py-1 font-bold pr-3">CONFLICT</th>
                        <th className="text-right py-1 font-bold pr-3">BREADTH</th>
                        <th className="text-left py-1 font-bold pr-3">MOMENTUM</th>
                        <th className="text-left py-1 font-bold pr-3">REGIME</th>
                        <th className="text-left py-1 font-bold">NOTE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {historyRows.map((r, i) => (
                        <tr key={i} className={`hover:bg-white/5 ${i === 0 ? 'bg-blue-500/5' : ''}`}>
                          <td className="py-1.5 text-slate-400 pr-3 tabular-nums">{r.date}</td>
                          <td className="py-1.5 text-emerald-400 pr-3">{r.stage}</td>
                          <td className={`py-1.5 text-right font-bold pr-3 tabular-nums ${r.eng >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>{r.eng}</td>
                          <td className={`py-1.5 text-right font-bold pr-3 tabular-nums ${r.str >= 65 ? 'text-emerald-400' : 'text-yellow-400'}`}>{r.str}</td>
                          <td className="py-1.5 pr-3 text-slate-400">{r.conflict}</td>
                          <td className="py-1.5 text-right text-slate-400 pr-3 tabular-nums">{r.breadth}</td>
                          <td className={`py-1.5 pr-3 ${r.mom === 'Strengthening' ? 'text-emerald-400' : r.mom === 'Weakening' ? 'text-red-400' : 'text-slate-400'}`}>{r.mom}</td>
                          <td className={`py-1.5 font-bold pr-3 ${r.regime === 'RISK ON' ? 'text-emerald-400' : 'text-slate-400'}`}>{r.regime}</td>
                          <td className="py-1.5 text-slate-400 whitespace-nowrap">{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {histTab === 'EVENT LOG' && (
              <div className="space-y-1.5">
                {[
                  { date: '2025-05-21', hot: true,  text: 'Momentum Divergence detected: AI Infra vs Memory bucket spread widened to 36.4%' },
                  { date: '2025-05-19', hot: false, text: 'Sector Divergence: Foundry lagging AI Infra by 20.9% over 30D window' },
                  { date: '2025-05-15', hot: false, text: 'Liquidity Watch: Fed liquidity indicators entering contraction zone' },
                ].map((e, i) => (
                  <div key={i} className={`flex gap-2 p-2 border text-[12px] ${e.hot ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800/50'}`}>
                    <span className={`whitespace-nowrap ${e.hot ? 'text-orange-400' : 'text-slate-400'}`}>{e.date}</span>
                    <span className="text-slate-400">{e.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </section>

        {/* RIGHT 25% */}
        <aside className="w-1/4 shrink-0 flex flex-col gap-2 pb-20 h-fit">

          <Panel title="Interpretation" icon={Bell}
            headerExtra={
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </span>
            }>
            {(() => {
              const noConflict = conflictType === 'NO_CONFLICT' || conflictType === '—'
              const hasLive    = !!live

              const structure =
                conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'                              ? 'Fragile'   :
                conflictType === 'AI_DISTORTION'                                             ? 'Narrow'    :
                (noConflict && breadthPct >= 70)                                             ? 'Broad'     :
                breadthPct < 40                                                              ? 'Weak'      :
                conflictType === 'BREADTH_DIVERGENCE'                                        ? 'Diverging' :
                hasLive                                                                      ? 'Moderate'  : '—'

              // ??Delta items
              type DeltaItem = { label: string; from: string; to: string; dir: 'up' | 'down' | 'neutral' }
              const deltaItems: DeltaItem[] = []
              if (prevSnap && hasLive) {
                if (prevSnap.stageName !== stageName)
                  deltaItems.push({ label: 'Stage', from: prevSnap.stageName, to: stageName, dir: 'neutral' })
                if (prevSnap.conflictType !== conflictType) {
                  const wasBad = prevSnap.conflictType !== 'NO_CONFLICT' && prevSnap.conflictType !== '—'
                  const isBad  = !noConflict
                  deltaItems.push({ label: 'Conflict',
                    from: displayConflict(prevSnap.conflictType),
                    to:   displayConflict(conflictType),
                    dir: wasBad && !isBad ? 'up' : !wasBad && isBad ? 'down' : 'neutral' })
                }
                if (Math.abs(prevSnap.breadthPct - breadthPct) >= 5)
                  deltaItems.push({ label: 'Breadth',
                    from: `${prevSnap.breadthPct}%`, to: `${breadthPct}%`,
                    dir: breadthPct > prevSnap.breadthPct ? 'up' : 'down' })
                if (prevSnap.structure !== structure) {
                  const ord = ['Weak','Narrow','Diverging','Moderate','Fragile','Broad']
                  const fi  = ord.indexOf(prevSnap.structure)
                  const ti  = ord.indexOf(structure)
                  deltaItems.push({ label: 'Structure', from: prevSnap.structure, to: structure,
                    dir: ti > fi ? 'up' : ti < fi ? 'down' : 'neutral' })
                }
              }

              // ??Watch signals
              type WatchSig = { sev: 'red' | 'amber' | 'gray'; text: string; sub: string }
              const watches: WatchSig[] = []
              if (hasLive) {
                if (conflictType === 'MACRO_OVERRIDE' || conflictType === 'MULTIPLE_CONFLICTS')
                  watches.push({ sev: 'red', text: 'Structural conflict active',
                    sub: `${displayConflict(conflictType)} ??reduce conviction` })
                if (breadthPct < 70)
                  watches.push({ sev: 'red', text: `Breadth(200) ${breadthPct}% < 70%`,
                    sub: 'Broad participation failing' })
                if (breadthPct >= 70 && breadthPct < 85)
                  watches.push({ sev: 'amber', text: `Breadth(200) ${breadthPct}% < 85%`,
                    sub: 'Monitor for further deterioration' })
                if (cyclePos > 75)
                  watches.push({ sev: 'amber', text: `Cycle position ${cyclePos.toFixed(0)}`,
                    sub: 'Late-cycle territory ??heightened risk' })
                if (conflictType === 'AI_DISTORTION' || conflictType === 'AI_INFRA_SUSTAINABILITY_RISK')
                  watches.push({ sev: 'amber', text: 'AI concentration elevated',
                    sub: 'Breadth confirmation required for durability' })
                const lastSpread = spreadData.length ? spreadData[spreadData.length - 1] : null
                if (lastSpread && lastSpread.mem < -2)
                  watches.push({ sev: 'gray', text: `Memory spread ${lastSpread.mem.toFixed(1)}%`,
                    sub: 'Below ??% vs SOXX ??watch for recovery' })
                watches.push({ sev: 'gray', text: 'Daily data refresh', sub: 'Scheduled backend update' })
              }
              const watchSorted = watches
                .sort((a,b) => ({ red:0,amber:1,gray:2 }[a.sev] - { red:0,amber:1,gray:2 }[b.sev]))
                .slice(0, 4)

              return (
                <div className="flex flex-col gap-2.5">

                  {/* ??Summary */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1">??Summary</div>
                    <p className="text-[12px] text-slate-200 leading-snug font-medium">
                      {interpData?.summary ?? (hasLive ? 'Loading interpretation…' : 'Awaiting data…')}
                    </p>
                  </div>

                  {/* ??What is Leading */}
                  {(() => {
                    type CompKey = 'ai_infra' | 'memory' | 'foundry' | 'equipment'
                    const ar = interpData?.ai_regime
                    const LEAD = ['LEADING','CONFIRMED','SUPPORTING','BROAD','IN_LINE']
                    const COMP_LABEL: Record<CompKey, string> = {
                      ai_infra: 'AI Compute', memory: 'Memory', foundry: 'Foundry', equipment: 'Equipment',
                    }
                    const leadComps = ar
                      ? (['ai_infra','memory','foundry','equipment'] as CompKey[])
                          .filter(k => LEAD.includes(ar[k].state))
                          .map(k => ar[k].note)
                      : []
                    return (
                      <div className="pb-2.5 border-b border-slate-800/60">
                        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1.5">??What is Leading</div>
                        {leadComps.length > 0 ? (
                          <div className="space-y-1">
                            {leadComps.map((note, i) => (
                              <p key={i} className="text-[11px] text-emerald-400/80 leading-snug">夷?{note}</p>
                            ))}
                          </div>
                        ) : (interpData?.support ?? []).length > 0 ? (
                          <div className="space-y-1">
                            {interpData!.support.map((s, i) => (
                              <p key={i} className="text-[11px] text-emerald-400/80 leading-snug">夷?{s}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No segment is outperforming SOXX.</p>
                        )}
                      </div>
                    )
                  })()}

                  {/* ??What is Lagging */}
                  {(() => {
                    type CompKey = 'ai_infra' | 'memory' | 'foundry' | 'equipment'
                    const ar = interpData?.ai_regime
                    const LAG = ['LAGGING','LAGGING_AI_DELAY','LAGGING_CYCLE','NOT_CONFIRMED','WEAK']
                    const lagComps = ar
                      ? (['ai_infra','memory','foundry','equipment'] as CompKey[])
                          .filter(k => LAG.includes(ar[k].state))
                          .map(k => ar[k].note)
                      : []
                    return (
                      <div className="pb-2.5 border-b border-slate-800/60">
                        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1.5">??What is Lagging</div>
                        {lagComps.length > 0 ? (
                          <div className="space-y-1">
                            {lagComps.map((note, i) => (
                              <p key={i} className="text-[11px] text-orange-400/70 leading-snug">夷?{note}</p>
                            ))}
                          </div>
                        ) : (interpData?.weakness ?? []).length > 0 ? (
                          <div className="space-y-1">
                            {interpData!.weakness.map((w, i) => (
                              <p key={i} className="text-[11px] text-orange-400/70 leading-snug">夷?{w}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No structural weakness identified.</p>
                        )}
                      </div>
                    )
                  })()}

                  {/* ??Capital Flow Stage */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1">??Capital Flow Stage</div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {interpData?.regime_context
                        ?? interpData?.ai_regime?.rotation_risk?.note
                        ?? interpData?.interpretation
                        ?? '—'}
                    </p>
                  </div>

                  {/* ??SOXL Sensitivity */}
                  {(() => {
                    const SENS: Record<string, { level: string; reason: string }> = {
                      AI_LED_BROAD:   { level: 'Low?諛쟢dium', reason: 'AI leadership is broadly supported.' },
                      AI_LED_NARROW:  { level: 'High',       reason: 'AI leadership is narrow.' },
                      ROTATING:       { level: 'Medium',     reason: 'Capital rotation is uneven across semiconductor buckets.' },
                      BROAD_RECOVERY: { level: 'Medium',     reason: 'Recovery structure is developing across segments.' },
                      CONTRACTION:    { level: 'High',       reason: 'Broad structural weakness is confirmed across segments.' },
                    }
                    const fallback = { level: 'Medium', reason: 'Data is not sufficient for a precise sensitivity assessment.' }
                    const { level, reason } = SENS[interpData?.ai_regime?.regime_label ?? ''] ?? fallback
                    const lc = level === 'High' ? 'text-red-400' : level === 'Low?諛쟢dium' ? 'text-emerald-400' : 'text-yellow-400'
                    return (
                      <div className="pb-2.5 border-b border-slate-800/60">
                        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">??SOXL Sensitivity</div>
                        <p className="text-[11px] text-slate-500 mb-1.5">Shows how the current SOXX structure may be amplified in SOXL.</p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[12px] font-bold uppercase ${lc}`}>{level}</span>
                          <span className="text-[10px] text-slate-400 leading-snug">{reason}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Watch ??secondary */}
                  {watchSorted.length > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-1.5">Watch</div>
                      <div className="space-y-1">
                        {watchSorted.map((w, i) => (
                          <div key={i} className={`pl-2 border-l-[2px] py-0.5 ${
                            w.sev === 'red'   ? 'border-red-500/50'   :
                            w.sev === 'amber' ? 'border-amber-500/50' : 'border-slate-700/40'
                          }`}>
                            <div className={`text-[10px] leading-tight ${
                              w.sev === 'red'   ? 'text-red-400/70'   :
                              w.sev === 'amber' ? 'text-amber-400/70' : 'text-slate-400'
                            }`}>{w.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )
            })()}
          </Panel>

          <Panel title="Drilldown" icon={TrendingUp}
            headerExtra={
              <div className="flex items-center gap-1">
                <select className="bg-slate-900 border border-slate-700 text-[11px] text-slate-300 px-1 py-0.5 cursor-pointer outline-none">
                  <option>SOXX Index</option>
                  <option>AI Infrastructure</option>
                  <option>Memory</option>
                  <option>Foundry</option>
                </select>
                <X size={11} className="text-slate-400 cursor-pointer hover:text-slate-300" />
              </div>
            }>

            <div className="flex border-b border-slate-800 mb-2 -mx-2 px-2 shrink-0">
              {['SUMMARY','CONSTITUENTS','RISK','FUNDAMENTALS'].map(t => (
                <button key={t} onClick={() => setDrillTab(t)}
                  className={`px-2 py-1.5 text-[11px] font-bold tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                    drillTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-400'
                  }`}>{t}</button>
              ))}
            </div>

            {drillTab === 'SUMMARY' && (
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className="text-[24px] font-black text-white font-mono leading-none tracking-tighter">568.23</span>
                  <span className="text-[12px] text-slate-400">USD</span>
                </div>
                <div className="text-emerald-400 font-bold text-[13px] font-mono mb-2">+12.34 (+2.22%)</div>

                <div className="grid grid-cols-2 gap-x-4 mb-2 text-[11px] font-mono">
                  {[
                    { label: 'High', val: '569.11' }, { label: 'Low',     val: '556.23' },
                    { label: '52W High', val: '588.42' }, { label: '52W Low', val: '407.80' },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between py-0.5 border-b border-slate-800/50">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-300">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-0.5 mb-2">
                  {['1D','5D','1M','3M','6M','1Y','5Y','MAX'].map(z => (
                    <button key={z} className={`flex-1 py-0.5 text-[11px] border rounded-sm ${
                      z === '6M' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'border-slate-800 text-slate-400 hover:text-slate-400'
                    }`}>{z}</button>
                  ))}
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={DRILLDOWN_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={['auto','auto']} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickFormatter={v => String(Math.round(+v))} />
                      <Tooltip contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }}
                        formatter={(v: unknown) => [(+String(v)).toFixed(2), 'Price']} />
                      <defs>
                        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#dg)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <button className="mt-2 w-full py-1.5 border border-blue-500/30 text-blue-400 font-bold text-[11px] hover:bg-blue-500/10 transition-all uppercase tracking-widest">
                  View Details ??                </button>
              </div>
            )}

            {drillTab !== 'SUMMARY' && (
              <div className="h-32 flex items-center justify-center text-[12px] text-slate-400">
                {drillTab} ??coming soon
              </div>
            )}

          </Panel>

        </aside>
      </div>

      {/* ???? TAB 2: SOXX/SOXL Translation ???? */}
      {mainTab === 'STRATEGY' && <SoxxSoxlTranslationTab />}

      {/* ???? TAB 3: Playback ???? */}
      {mainTab === 'PLAYBACK' && <SemiconductorPlaybackTab />}

      {/* ???? FOOTER 28px ???? */}
      <footer className="border-t border-slate-800 bg-[#06090f] px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 sticky bottom-0 z-50 mt-auto">
        <div className="flex gap-5 font-mono overflow-hidden">
          {[
            { label: 'SOXX',               val: '568.23',    chg: '+2.22%', up: true  },
            { label: 'NASDAQ',             val: '16,742.39', chg: '+1.18%', up: true  },
            { label: 'S&P 500',            val: '5,307.01',  chg: '+1.09%', up: true  },
            { label: 'PHLX Semiconductor', val: '5,125.80',  chg: '+2.35%', up: true  },
            { label: 'VIX',                val: '15.21',     chg: '-2.18%', up: false },
          ].map(m => (
            <span key={m.label} className="flex items-center gap-1.5">
              <span className="font-bold text-white">{m.label}</span>
              <span className="text-slate-400">{m.val}</span>
              <span className={m.up ? 'text-emerald-400' : 'text-red-400'}>{m.chg}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 tracking-tighter shrink-0 text-[10px]">
          {interpData ? (() => {
            const dm = interpData.ai_regime?.data_mode ?? 'snapshot'
            return dm === 'live' ? (
              <span className="text-emerald-400 flex items-center gap-1 font-bold uppercase">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> LIVE 夷?semiconductor market data
              </span>
            ) : (
              <span className="text-yellow-500/80 flex items-center gap-1 font-bold uppercase">
                <span className="w-1 h-1 rounded-full bg-yellow-500" /> SNAPSHOT 夷?semiconductor_market_data.json
              </span>
            )
          })() : (
            <span className="text-slate-500 font-bold uppercase">DATA UNAVAILABLE</span>
          )}
          <span className="text-slate-400 font-mono normal-case uppercase font-bold">Last updated <span className="text-white">{asOf !== '—' ? asOf : '—'}</span></span>
        </div>
      </footer>

    </div>
  )
}

