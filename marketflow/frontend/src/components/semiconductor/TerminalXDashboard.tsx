'use client'
import React, { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Cpu, TrendingUp, Activity, Bell, History, Maximize2, X, RotateCcw } from 'lucide-react'
import SoxxSoxlTranslationTab    from './SoxxSoxlTranslationTab'
import SemiconductorPlaybackTab  from './SemiconductorPlaybackTab'
import AnalysisEngineCoreTab     from './AnalysisEngineCoreTab'
import { SoxxContributionTrendMiniChart } from './SoxxContributionTrendMiniChart'
import {
  formatBucketClassificationHint,
  formatBucketTickerHint,
  getSemiconductorBucketMapping,
} from '@/lib/semiconductor/bucketMapping'
import {
  SELECTED_SOXX_BUCKET_IDS,
  SOXX_HOLDINGS_SNAPSHOT,
  SOXX_HOLDINGS_SNAPSHOT_AS_OF,
  SOXX_HOLDINGS_SNAPSHOT_SOURCE,
} from '@/lib/semiconductor/soxxHoldingsSnapshot'
import {
  computeSoxxCoverageSummary,
  validateSoxxHoldingsSnapshot,
} from '@/lib/semiconductor/soxxCoverage'
import {
  buildSoxxHoldingReturnsForPeriod,
  getAvailableSoxxContributionPeriods,
  SOXX_CONTRIBUTION_PERIODS,
  type RawSoxxMultiPeriodReturnInput,
  type SoxxContributionPeriod,
} from '@/lib/semiconductor/soxxContributionAdapter'
import {
  buildSoxxParticipationInterpretation,
  computeSoxxContributionSummary,
  formatReturnPct,
  formatPctPoint,
  type SoxxParticipationState,
  SOXX_BUCKET_DISPLAY_ORDER,
} from '@/lib/semiconductor/soxxContribution'
import {
  buildContributionTrendSeries,
} from '@/lib/semiconductor/soxxContributionHistory'
import {
  isUsableSoxxContributionHistory,
  loadSoxxContributionHistory,
  type SoxxContributionHistoryApiResponse,
} from '@/lib/semiconductor/soxxContributionHistoryApi'
import {
  getSoxxContributionHelpItem,
} from '@/lib/semiconductor/soxxContributionHelp'
import {
  buildSoxxDataDebugSummary,
  type SoxxDataDebugSummary,
} from '@/lib/semiconductor/soxxDataDebug'
import {
  getSoxxDataFreshness,
  type SoxxDataFreshnessResult,
  type SoxxDataSourceMeta,
} from '@/lib/semiconductor/soxxDataFreshness'
import { SoxxDataDebugPanel } from './SoxxDataDebugPanel'


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


const CHART_HELPER_COPY = {
  relativeSpread: 'Relative strength vs SOXX, not full SOXX attribution.',
  rebasedFlow: 'Same-start comparison of selected buckets, not full SOXX decomposition.',
} as const

const SOXL_COPY = {
  title: 'SOXL Daily Sensitivity',
  anchorLabel: 'Daily 3x exposure layer',
  helper: 'SOXL seeks daily 3x exposure. Treat it as a daily amplification layer, not a simple multi-day 3x contribution model.',
  note: 'Multi-day SOXL outcomes are path-dependent.',
} as const

const RIGHT_PANEL_COPY = {
  heading: 'Selected Internal Driver View',
  summary: 'Quantifies selected internal SOXX drivers using holdings, contribution, and residual participation.',
  externalNote: 'Relative strength compares performance vs SOXX. Contribution estimates historical %p impact using holdings weight.',
  selectedDriverGuardrail: 'Current buckets represent selected internal SOXX drivers, not the full SOXX index.',
  soxlNote: 'SOXL seeks daily 3x exposure. This lens provides daily sensitivity context based on SOXX internal structure, not a multi-day forecast.',
  guardrail: 'Historical context only. Not a forecast or trading signal.',
} as const

const CONTRIBUTION_HELP = {
  coverage: getSoxxContributionHelpItem('coverage'),
  contribution: getSoxxContributionHelpItem('contribution'),
  residual: getSoxxContributionHelpItem('residual'),
  relativeStrength: getSoxxContributionHelpItem('relative_strength'),
  trend: getSoxxContributionHelpItem('trend'),
  soxl: getSoxxContributionHelpItem('soxl'),
} as const

const HOW_TO_READ_COPY = [
  {
    text: 'Coverage = mapped SOXX weight.',
    title: CONTRIBUTION_HELP.coverage?.detail,
  },
  {
    text: 'Contribution = %p impact.',
    title: CONTRIBUTION_HELP.contribution?.detail,
  },
  {
    text: 'Residual = rest of SOXX.',
    title: CONTRIBUTION_HELP.residual?.detail,
  },
  {
    text: 'Relative strength = performance vs SOXX.',
    title: CONTRIBUTION_HELP.relativeStrength?.detail,
  },
  {
    text: 'Historical context only.',
    title: CONTRIBUTION_HELP.trend?.detail,
  },
  {
    text: 'Selected buckets are not full SOXX.',
    title: RIGHT_PANEL_COPY.selectedDriverGuardrail,
  },
] as const


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
      <div className="flex items-center gap-[6px].5">
        {Icon && <Icon size={11} className="text-slate-400 tracking-[0.02em]" />}
        <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>{title}</span>
      </div>
      <div className="flex items-center gap-[10px]">
        {headerExtra}
        <Maximize2 size={10} className="text-slate-400 tracking-[0.02em] cursor-pointer hover:text-slate-400 tracking-[0.02em]" />
      </div>
    </div>
    <div className="p-3 flex-1 flex flex-col">{children}</div>
  </div>
)

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
  _meta?: {
    source?: string
    warnings?: string[]
  }
}

// ???? Helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function fmtRet(v: number | null): string {
  if (v === null) return '?'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(2)}%`
}

function retColor(v: number | null): string {
  if (v === null) return 'text-slate-500'
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400 tracking-[0.02em]'
}

function pctPointColor(value: number): string {
  if (!Number.isFinite(value)) return 'text-slate-500'
  return value > 0 ? 'text-emerald-300' : value < 0 ? 'text-red-300' : 'text-slate-300 tracking-[0.02em]'
}

function formatPctPointOrUnavailable(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  return formatPctPoint(value)
}

function participationStateClass(state: SoxxParticipationState): string {
  if (state === 'broad_participation') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
  if (state === 'selected_led') return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
  if (state === 'residual_led') return 'text-slate-300 border-slate-600 bg-slate-800/70'
  if (state === 'mixed_diverging') return 'text-orange-300 border-orange-500/30 bg-orange-500/10'
  return 'text-slate-500 border-slate-700 bg-slate-900/70'
}

function contributionState(value: number | null | undefined): { label: string; cls: string } {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { label: 'Unavailable', cls: 'text-slate-500 border-slate-700 bg-slate-900/70' }
  }
  if (value > 0.25) return { label: 'Leading', cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' }
  if (value >= 0.05) return { label: 'Supporting', cls: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' }
  if (value < -0.05) return { label: 'Lagging', cls: 'text-orange-300 border-orange-500/30 bg-orange-500/10' }
  return { label: 'Mixed', cls: 'text-slate-300 border-slate-700 bg-slate-900/70' }
}

function isLensDebugMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debug') === '1'
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
  supporting:     'Outperforming',
  weakening:      'Underperforming',
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

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function TerminalXDashboard() {
  const [mainTab,  setMainTab]  = useState<'MASTER' | 'ENGINE' | 'STRATEGY' | 'PLAYBACK'>('ENGINE')
  const [centerTab,setCenterTab]= useState('PERFORMANCE')
  const [zoom,     setZoom]     = useState('6M')
  const [histTab,  setHistTab]  = useState('HISTORY TABLE')
  const [drillTab, setDrillTab] = useState('SUMMARY')
  const [contributionPeriod, setContributionPeriod] = useState<SoxxContributionPeriod>('1D')
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
  const [contributionHistoryPayload, setContributionHistoryPayload] =
    useState<SoxxContributionHistoryApiResponse | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [generationLog, setGenerationLog] = useState<Record<string, unknown> | null>(null)

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
    let cancelled = false

    loadSoxxContributionHistory({ days: 60 }).then((payload) => {
      if (!cancelled) setContributionHistoryPayload(payload)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const syncDebugMode = () => setDebugMode(isLensDebugMode())
    syncDebugMode()
    window.addEventListener('popstate', syncDebugMode)
    return () => window.removeEventListener('popstate', syncDebugMode)
  }, [])

  useEffect(() => {
    if (!debugMode) return
    fetch('/api/semiconductor-lens/generation-log', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setGenerationLog(d))
      .catch(() => {})
  }, [debugMode])

  useEffect(() => {
    if (!live) return
    const nc = live.kpis.conflict_type === 'NO_CONFLICT' || live.kpis.conflict_type === '?'
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
  const stageName      = kpis?.stage           ?? '?'
  const cyclePos       = kpis?.cycle_position  ?? 0
  const conflictType   = kpis?.conflict_type   ?? '?'
  const hasConflict    = kpis?.has_conflict    ?? false
  const breadthPct     = kpis?.breadth_pct     ?? 0
  const breadthLabel   = kpis?.breadth_label   ?? '?'
  const advPct         = kpis?.advancing_pct   ?? 0
  const decPct         = kpis?.declining_pct   ?? 0
  const marketRegime   = kpis?.market_regime   ?? '?'
  const asOf           = live?.as_of           ?? '?'
  const domainSignals   = kpis?.domain_signals   ?? {}
  const primaryDriver   = kpis?.primary_driver   ?? '?'
  const primaryRisk     = kpis?.primary_risk     ?? '?'
  const conflictNote    = kpis?.conflict_note    ?? ''
  const confidenceScore = kpis?.confidence_score           ?? 0
  const confidenceLabel = kpis?.confidence_label           ?? '?'
  const concentration   = kpis?.leader_concentration_top5  ?? null
  const ewVsCw          = kpis?.equal_weight_vs_cap_spread ?? null

  const selectedSoxxBucketIds = useMemo(() => Array.from(SELECTED_SOXX_BUCKET_IDS), [])
  const soxxCoverageSummary = useMemo(
    () => computeSoxxCoverageSummary(SOXX_HOLDINGS_SNAPSHOT, selectedSoxxBucketIds),
    [selectedSoxxBucketIds],
  )
  const soxxHoldingsValidation = useMemo(
    () => validateSoxxHoldingsSnapshot(SOXX_HOLDINGS_SNAPSHOT, selectedSoxxBucketIds),
    [selectedSoxxBucketIds],
  )
  const selectedBucketMappings = useMemo(
    () => selectedSoxxBucketIds
      .map((bucketId) => getSemiconductorBucketMapping(bucketId))
      .filter((mapping): mapping is NonNullable<ReturnType<typeof getSemiconductorBucketMapping>> => Boolean(mapping)),
    [selectedSoxxBucketIds],
  )
  const missingSelectedBucketMappings = useMemo(
    () => selectedSoxxBucketIds.filter((bucketId) => !getSemiconductorBucketMapping(bucketId)),
    [selectedSoxxBucketIds],
  )
  const availableMultiPeriodReturnRows = useMemo<RawSoxxMultiPeriodReturnInput[]>(() => {
    const toPercentReturn = (value: number | null): number | null =>
      // Existing Semiconductor Lens return fields use decimal returns; C1 contribution helper expects percent returns.
      Number.isFinite(value) ? (value ?? 0) * 100 : null

    return (live?.market_cap_weights ?? []).map((row) => ({
      ticker: row.ticker,
      return1D: toPercentReturn(row.return_1d),
      return5D: toPercentReturn(row.return_5d),
      return1M: toPercentReturn(row.return_1m),
    }))
  }, [live?.market_cap_weights])
  const availableContributionPeriods = useMemo(
    () => getAvailableSoxxContributionPeriods(availableMultiPeriodReturnRows),
    [availableMultiPeriodReturnRows],
  )
  const realSoxxHoldingReturns = useMemo(
    () => buildSoxxHoldingReturnsForPeriod(availableMultiPeriodReturnRows, contributionPeriod),
    [availableMultiPeriodReturnRows, contributionPeriod],
  )
  const holdingsTickerSet = useMemo(
    () => new Set(SOXX_HOLDINGS_SNAPSHOT.map((holding) => holding.ticker.trim().toUpperCase())),
    [],
  )
  const availableReturnTickerSet = useMemo(
    () => new Set(realSoxxHoldingReturns.map((row) => row.ticker.trim().toUpperCase())),
    [realSoxxHoldingReturns],
  )
  const missingReturnTickersForLens = useMemo(
    () => Array.from(holdingsTickerSet).filter((ticker) => !availableReturnTickerSet.has(ticker)),
    [holdingsTickerSet, availableReturnTickerSet],
  )
  const soxxContributionSummary = useMemo(
    () => realSoxxHoldingReturns.length > 0
      ? computeSoxxContributionSummary(SOXX_HOLDINGS_SNAPSHOT, realSoxxHoldingReturns, selectedSoxxBucketIds)
      : null,
    [realSoxxHoldingReturns, selectedSoxxBucketIds],
  )
  const duplicateSelectedBucketTickers = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const mapping of selectedBucketMappings) {
      for (const ticker of mapping.representativeTickers) {
        const normalized = ticker.trim().toUpperCase()
        if (seen.has(normalized)) duplicates.add(normalized)
        seen.add(normalized)
      }
    }
    return Array.from(duplicates).sort()
  }, [selectedBucketMappings])
  const missingSelectedTickersInHoldings = useMemo(() => {
    return selectedBucketMappings
      .flatMap((mapping) => mapping.representativeTickers)
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker, index, rows) => rows.indexOf(ticker) === index)
      .filter((ticker) => !holdingsTickerSet.has(ticker))
  }, [selectedBucketMappings, holdingsTickerSet])
  const contributionHistoryStatus = useMemo<'available' | 'partial' | 'unavailable'>(() => {
    const status = contributionHistoryPayload?.status
    if (!status) return 'unavailable'
    if (status === 'available' || status === 'ok') return 'available'
    if (status === 'partial') return 'partial'
    return 'unavailable'
  }, [contributionHistoryPayload?.status])
  const returnsAvailableCount = availableReturnTickerSet.size
  const returnsTotalCount = SOXX_HOLDINGS_SNAPSHOT.length
  const returnStatus = useMemo<'available' | 'partial' | 'unavailable'>(() => {
    if (returnsAvailableCount <= 0) return 'unavailable'
    if (missingReturnTickersForLens.length > 0) return 'partial'
    return 'available'
  }, [missingReturnTickersForLens.length, returnsAvailableCount])
  const contributionStatus = useMemo<'available' | 'partial' | 'unavailable'>(() => {
    if (!soxxContributionSummary) return 'unavailable'
    if (
      soxxContributionSummary.missingReturnTickers.length > 0 ||
      soxxContributionSummary.warnings.length > 0
    ) {
      return 'partial'
    }
    return 'available'
  }, [soxxContributionSummary])
  const returnsFreshness = useMemo<SoxxDataFreshnessResult>(() => {
    return getSoxxDataFreshness({
      asOf: live?.as_of ?? undefined,
    })
  }, [live?.as_of])
  const contributionHistoryFreshness = useMemo<SoxxDataFreshnessResult>(() => {
    return getSoxxDataFreshness({
      asOf: contributionHistoryPayload?.asOf ?? undefined,
    })
  }, [contributionHistoryPayload?.asOf])
  const returnsSourceMeta = useMemo<SoxxDataSourceMeta>(() => {
    return {
      source: live?._meta?.source ?? (live ? 'cache' : 'not_connected'),
      asOf: live?.as_of ?? undefined,
      status: returnStatus,
      freshness: returnsFreshness,
      warnings: live?._meta?.warnings ?? [],
    }
  }, [live, returnStatus, returnsFreshness])
  const historySourceMeta = useMemo<SoxxDataSourceMeta>(() => {
    if (contributionHistoryPayload?.meta) {
      return contributionHistoryPayload.meta
    }
    return {
      source: contributionHistoryPayload?.source?.prices ?? 'not_connected',
      asOf: contributionHistoryPayload?.asOf ?? undefined,
      status: contributionHistoryStatus,
      freshness: contributionHistoryFreshness,
      warnings: contributionHistoryPayload?.warnings ?? [],
    }
  }, [contributionHistoryFreshness, contributionHistoryPayload, contributionHistoryStatus])
  const soxxDataDebugSummary = useMemo<SoxxDataDebugSummary>(() => {
    return buildSoxxDataDebugSummary({
      generationLog: generationLog
        ? {
            lastRunAt: (generationLog.lastRunAt as string | null) ?? null,
            status: (generationLog.status as string | null) ?? null,
            outputs: generationLog.outputs as Array<{ file: string; status: string; records?: number; warnings?: string[] }> | undefined,
            missingTickers: generationLog.missingTickers as string[] | undefined,
            warnings: generationLog.warnings as string[] | undefined,
            error: (generationLog.error as string | null) ?? null,
          }
        : undefined,
      holdings: {
        asOf: soxxHoldingsValidation.asOfDate ?? undefined,
        totalWeightPct: soxxHoldingsValidation.totalWeightPct,
        holdingCount: SOXX_HOLDINGS_SNAPSHOT.length,
        selectedCoveragePct: soxxCoverageSummary.selectedCoveragePct,
        residualPct: soxxCoverageSummary.residualPct,
        duplicateTickers: soxxHoldingsValidation.duplicateTickers,
        missingWeightTickers: SOXX_HOLDINGS_SNAPSHOT
          .filter((holding) => !Number.isFinite(holding.weightPct) || holding.weightPct <= 0)
          .map((holding) => holding.ticker),
      },
      bucketMapping: {
        selectedBuckets: selectedBucketMappings.map((mapping) => ({
          label: mapping.label,
          tickers: mapping.representativeTickers,
        })),
        missingSelectedTickers: [
          ...missingSelectedTickersInHoldings,
          ...missingSelectedBucketMappings,
        ],
        duplicateBucketTickers: duplicateSelectedBucketTickers,
        residualRuleOk: true,
      },
      returns: {
        source: returnsSourceMeta.source,
        asOf: returnsSourceMeta.asOf,
        status: returnsSourceMeta.status,
        freshness: returnsSourceMeta.freshness,
        availableTickerCount: returnsAvailableCount,
        totalTickerCount: returnsTotalCount,
        missingTickers: missingReturnTickersForLens,
        warnings: returnsSourceMeta.warnings,
      },
      contribution: {
        status: contributionStatus,
        source: returnsSourceMeta.source,
        asOf: returnsSourceMeta.asOf,
        freshness: returnsSourceMeta.freshness,
        selectedContributionPctPoint: soxxContributionSummary?.selectedContributionPctPoint ?? null,
        residualContributionPctPoint: soxxContributionSummary?.residualContributionPctPoint ?? null,
        missingTickers: soxxContributionSummary?.missingReturnTickers ?? [],
        warnings: soxxContributionSummary?.warnings ?? [],
      },
      history: {
        source: historySourceMeta.source,
        asOf: historySourceMeta.asOf,
        status: historySourceMeta.status,
        freshness: historySourceMeta.freshness,
        pointCount: contributionHistoryPayload?.history?.length ?? contributionHistoryPayload?.snapshots?.length ?? 0,
        daysRequested: contributionHistoryPayload?.daysRequested ?? contributionHistoryPayload?.window_trading_days ?? 60,
        warnings: historySourceMeta.warnings,
      },
    })
  }, [
    availableReturnTickerSet.size,
    contributionHistoryPayload,
    contributionHistoryFreshness,
    contributionHistoryStatus,
    contributionStatus,
    duplicateSelectedBucketTickers,
    historySourceMeta.asOf,
    historySourceMeta.freshness,
    historySourceMeta.source,
    historySourceMeta.status,
    historySourceMeta.warnings,
    live,
    missingReturnTickersForLens,
    missingSelectedBucketMappings,
    missingSelectedTickersInHoldings,
    returnStatus,
    returnsAvailableCount,
    returnsFreshness,
    returnsSourceMeta.asOf,
    returnsSourceMeta.freshness,
    returnsSourceMeta.source,
    returnsSourceMeta.status,
    returnsSourceMeta.warnings,
    returnsTotalCount,
    selectedBucketMappings,
    generationLog,
    soxxContributionSummary,
    soxxCoverageSummary.residualPct,
    soxxCoverageSummary.selectedCoveragePct,
    soxxHoldingsValidation,
  ])
  const orderedSoxxBucketContributions = useMemo(() => {
    if (!soxxContributionSummary) return []

    const orderRank = new Map(
      SOXX_BUCKET_DISPLAY_ORDER.map((bucketId, index) => [bucketId, index]),
    )

    return [...soxxContributionSummary.bucketContributions].sort((a, b) => {
      if (a.bucketId === 'residual' && b.bucketId !== 'residual') return 1
      if (b.bucketId === 'residual' && a.bucketId !== 'residual') return -1

      const contributionDiff =
        Math.abs(b.contributionPctPoint) - Math.abs(a.contributionPctPoint)
      if (Math.abs(contributionDiff) > 0.0001) return contributionDiff

      return (orderRank.get(a.bucketId as typeof SOXX_BUCKET_DISPLAY_ORDER[number]) ?? 99) -
        (orderRank.get(b.bucketId as typeof SOXX_BUCKET_DISPLAY_ORDER[number]) ?? 99)
    })
  }, [soxxContributionSummary])
  const contributionTrendData = useMemo(
    () => isUsableSoxxContributionHistory(contributionHistoryPayload)
      ? buildContributionTrendSeries(contributionHistoryPayload?.snapshots ?? [])
      : [],
    [contributionHistoryPayload],
  )
  const lensNoConflict = conflictType === 'NO_CONFLICT' || conflictType === '?'
  const soxxStructure =
    !live                                             ? 'Unavailable' :
    conflictType === 'AI_INFRA_SUSTAINABILITY_RISK' ? 'Fragile' :
    conflictType === 'AI_DISTORTION'                ? 'Narrow' :
    lensNoConflict && breadthPct >= 70              ? 'Broad' :
    breadthPct < 40                                 ? 'Weak' :
    conflictType === 'BREADTH_DIVERGENCE'           ? 'Diverging' :
                                                       'Moderate'
  const soxxStructureClass =
    soxxStructure === 'Broad'      ? 'text-emerald-400' :
    soxxStructure === 'Moderate'   ? 'text-cyan-400' :
    soxxStructure === 'Narrow'     ? 'text-yellow-400' :
    soxxStructure === 'Diverging'  ? 'text-orange-400' :
    soxxStructure === 'Fragile' ||
    soxxStructure === 'Weak'       ? 'text-red-400' :
                                     'text-slate-500'
  const residualContribution = soxxContributionSummary?.residualContributionPctPoint ?? null
  const selectedContribution = soxxContributionSummary?.selectedContributionPctPoint ?? null
  const residualParticipationLabel =
    residualContribution === null ? 'Unavailable' :
    residualContribution > 0.02   ? 'Participating' :
    residualContribution < -0.02  ? 'Lagging' :
                                    'Flat'
  const residualParticipationClass =
    residualParticipationLabel === 'Participating' ? 'text-emerald-400' :
    residualParticipationLabel === 'Lagging'       ? 'text-orange-400' :
    residualParticipationLabel === 'Flat'          ? 'text-slate-300' :
                                                     'text-slate-500'
  const contributionBiasLabel =
    selectedContribution === null || residualContribution === null ? 'Unavailable' :
    selectedContribution > residualContribution + 0.05             ? 'Selected-led' :
    residualContribution > selectedContribution + 0.05             ? 'Residual-led' :
                                                                     'Balanced'
  const contributionBiasClass =
    contributionBiasLabel === 'Selected-led' ? 'text-cyan-400' :
    contributionBiasLabel === 'Residual-led' ? 'text-slate-300' :
    contributionBiasLabel === 'Balanced'     ? 'text-emerald-400' :
                                               'text-slate-500'
  const contributionBiasDetail =
    selectedContribution === null || residualContribution === null
      ? 'Contribution unavailable'
      : `Sel ${formatPctPoint(selectedContribution)} / Res ${formatPctPoint(residualContribution)}`
  const contributionBiasHelper =
    contributionBiasLabel === 'Selected-led' ? 'Selected > residual' :
    contributionBiasLabel === 'Residual-led' ? 'Residual > selected' :
    contributionBiasLabel === 'Balanced'     ? 'Selected and residual mixed' :
                                               'Data not connected yet'
  const participationInterpretation = buildSoxxParticipationInterpretation({
    selectedContributionPctPoint: selectedContribution,
    residualContributionPctPoint: residualContribution,
  })
  const hasPartialContributionData =
    (soxxContributionSummary?.missingReturnTickers.length ?? 0) > 0
  const residualSnapshotNote =
    residualContribution === null ? 'Residual contribution unavailable.' :
    residualContribution > 0.25   ? 'Residual participation is meaningful.' :
    residualContribution > 0.05   ? 'Residual is participating.' :
    residualContribution < -0.05  ? 'Residual is detracting over the selected period.' :
                                    'Move remains concentrated in selected buckets.'
  const residualParticipationHelper =
    residualParticipationLabel === 'Participating' ? 'Residual contribution positive' :
    residualParticipationLabel === 'Lagging'       ? 'Residual contribution negative' :
    residualParticipationLabel === 'Flat'          ? 'Residual contribution flat' :
                                                     'Data not connected yet'
  const lensInterpretation =
    contributionBiasLabel === 'Selected-led'
      ? 'Selected buckets are contributing more than residual holdings, suggesting leadership remains concentrated in mapped SOXX drivers.'
    : contributionBiasLabel === 'Residual-led'
      ? 'Residual holdings are contributing more than selected buckets, suggesting broader participation outside the mapped driver set.'
    : contributionBiasLabel === 'Balanced'
      ? 'Selected buckets and residual holdings are contributing at a similar pace, suggesting mixed SOXX participation.'
    : 'Contribution context is prepared, but real holding-level history is not available yet.'
  const SOXL_SENSITIVITY: Record<string, { level: string; reason: string }> = {
    AI_LED_BROAD:   { level: 'Low-Medium', reason: 'SOXX-relative strength is broad across selected internal drivers.' },
    AI_LED_NARROW:  { level: 'High',       reason: 'SOXX-relative strength is narrow and concentrated.' },
    ROTATING:       { level: 'Medium',     reason: 'Relative leadership is uneven across selected buckets.' },
    BROAD_RECOVERY: { level: 'Medium',     reason: 'Selected buckets are improving versus SOXX.' },
    CONTRACTION:    { level: 'High',       reason: 'Selected buckets are broadly weaker than SOXX.' },
  }
  const soxlSensitivity =
    !live
      ? { level: 'Unavailable', reason: 'Data not connected yet.' }
      : (SOXL_SENSITIVITY[interpData?.ai_regime?.regime_label ?? ''] ??
        { level: 'Medium', reason: 'SOXX structure is mixed or still loading.' })
  const soxlSensitivityClass =
    soxlSensitivity.level === 'High'       ? 'text-red-400' :
    soxlSensitivity.level === 'Low-Medium' ? 'text-emerald-400' :
    soxlSensitivity.level === 'Unavailable' ? 'text-slate-500' :
                                             'text-yellow-400'

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
      conflict: '?',
      breadth:  '?',
      mom:      r.comp > r.avg ? 'Strengthening' : 'Fading',
      regime:   r.comp >= 55 ? 'RISK ON' : r.comp >= 35 ? 'NEUTRAL' : 'RISK OFF',
      note:     '?',
    }))
  }, [history])
  const lensDataConnected = !!live
  const lensDataStatusLabel = lensDataConnected ? 'DATA CONNECTED' : 'DATA PENDING'
  const lensDataStatusClass = lensDataConnected ? 'text-emerald-400' : 'text-slate-500'
  const lensDataDotClass = lensDataConnected ? 'bg-emerald-400' : 'bg-slate-600'
  const lensSourceStatusLabel =
    returnStatus === 'available'
      ? 'Available'
      : returnStatus === 'partial'
        ? 'Partial'
        : 'Unavailable'
  const lensFreshnessLabel = returnsFreshness.label
  const lensTrustNote = useMemo(() => {
    if (returnsSourceMeta.status === 'unavailable' || returnsSourceMeta.source === 'not_connected') {
      return 'Data source not connected.'
    }

    const asOfText = returnsSourceMeta.asOf ?? 'Unavailable'

    if (lensFreshnessLabel === 'Stale') {
      return `Data source: ${returnsSourceMeta.source} · As of: ${asOfText} · Stale`
    }

    return `Data source: ${returnsSourceMeta.source} · As of: ${asOfText} · Status: ${lensSourceStatusLabel} · ${lensFreshnessLabel}`
  }, [
    lensFreshnessLabel,
    lensSourceStatusLabel,
    returnsSourceMeta.asOf,
    returnsSourceMeta.source,
    returnsSourceMeta.status,
  ])

  return (
    <div
      className="flex flex-col bg-[#020408] text-slate-300 tracking-[0.02em] min-h-screen selection:bg-blue-500/30"
      style={{ fontSize: 14, fontFamily: UI_FONT, letterSpacing: '0.02em' }}
    >

      {/* ???? HEADER 40px ???? */}
      <header className="h-[40px] flex items-center justify-between bg-[#06090f] border-b border-slate-800 px-4 md:px-6 xl:px-10 2xl:px-14 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-[10px]">
            <Cpu size={14} className="text-blue-500" />
            <span className="text-[16px] font-black text-white tracking-tighter">TERMINAL X</span>
            <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] hidden lg:block ml-1" style={{ fontFamily: UI_FONT }}>SEMICONDUCTOR ANALYSIS ENGINE</span>
          </div>
          <nav className="flex gap-[6px]">
            {(['MASTER', 'ENGINE', 'STRATEGY', 'PLAYBACK'] as const).map(t => (
              <button key={t} onClick={() => setMainTab(t)}
                className={`px-4 h-[40px] text-[14px] font-medium leading-[1.6] font-bold tracking-widest border-b-2 transition-all ${
                  mainTab === t ? 'border-blue-500 text-white bg-blue-500/5' : 'border-transparent text-slate-400 tracking-[0.02em] hover:text-slate-300 tracking-[0.02em]'
                }`}>{t}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-[18px]">
          <span className="font-mono text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em]" style={{ fontFamily: DATA_FONT }}>
            {lensDataConnected ? `${asOf}  15:30:00` : 'Data pending'}
          </span>
          <div className={`flex items-center gap-[6px] text-[11px] font-bold ${lensDataStatusClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lensDataDotClass}`} /> {lensDataStatusLabel}
          </div>
        </div>
      </header>

      {/* KPI STRIP: SOXX/SOXL structure indicators only — hidden on ENGINE tab */}
      <div className={`h-[80px] w-full shrink-0 border-b border-slate-800 bg-[#06090f] sticky top-[40px] z-40 ${mainTab === 'ENGINE' ? 'hidden' : ''}`}>
        <div className="h-full px-4 md:px-6 xl:px-10 2xl:px-14 grid grid-cols-5 divide-x divide-slate-800">

        <div className="min-w-0 flex flex-col justify-center px-4">
          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>SOXX Structure</span>
          <span className={`text-[22px] font-black leading-none mt-1 truncate ${soxxStructureClass}`}>{soxxStructure}</span>
          <span className="text-[11px] text-slate-500 mt-1 truncate">{displayConflict(conflictType)}</span>
        </div>

        <div className="min-w-0 flex flex-col justify-center px-4">
          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>Selected Coverage</span>
          <span className="text-[28px] font-bold font-mono text-cyan-400 leading-none mt-0.5" style={{ fontFamily: DATA_FONT }}>
            {formatPct(soxxCoverageSummary.selectedCoveragePct)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 truncate">Mapped SOXX holdings weight</span>
        </div>

        <div className="min-w-0 flex flex-col justify-center px-4">
          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>Residual Participation</span>
          <div className="flex items-end gap-[8px] mt-0.5">
            <span className="text-[28px] font-bold font-mono text-slate-300 leading-none" style={{ fontFamily: DATA_FONT }}>
              {formatPct(soxxCoverageSummary.residualPct)}
            </span>
            <span className={`text-[11px] font-bold pb-0.5 ${residualParticipationClass}`}>{residualParticipationLabel}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 truncate">{residualParticipationHelper}</span>
        </div>

        <div className="min-w-0 flex flex-col justify-center px-4">
          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>Contribution Bias</span>
          <span className={`text-[22px] font-black leading-none mt-1 truncate ${contributionBiasClass}`}>{contributionBiasLabel}</span>
          <span className="text-[11px] text-slate-500 mt-1 truncate" title={contributionBiasDetail}>{contributionBiasHelper}</span>
        </div>

        <div className="min-w-0 flex flex-col justify-center px-4">
          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>SOXL Daily Sensitivity</span>
          <span className={`text-[22px] font-black leading-none mt-1 truncate ${soxlSensitivityClass}`}>{soxlSensitivity.level}</span>
          <span className="text-[11px] text-slate-500 mt-1 truncate">Not multi-day forecast</span>
        </div>

        </div>
      </div>

      {/* ???? TAB: ENGINE ???? */}
      {mainTab === 'ENGINE' && (
        <AnalysisEngineCoreTab live={live} interpData={interpData} history={history} />
      )}

      {/* ???? MAIN 3-COLUMN (MASTER tab only) ???? */}
      <div className={`flex px-4 md:px-6 xl:px-10 2xl:px-14 gap-[10px] bg-[#020408] py-3 flex-1 ${mainTab === 'MASTER' ? '' : 'hidden'}`}>

        {/* LEFT 25% */}
        <aside className="w-1/4 shrink-0 flex flex-col gap-[10px] h-fit">

          {/* ???? Block 1: Cycle Position ?????????????????????????????????????????????????????????? */}

          {/* ???? Block 2: Cycle Timeline ?????????????????????????????????????????????????????????? */}

          {/* ???? Block 3: Bucket Power Ranking ???????????????????????????????????????????? */}
          {(() => {
            const bucketStatus = (vsStr: string) => {
              const v = parseFloat(vsStr)
              if (!Number.isFinite(v)) return { label: 'Unavailable', cls: 'text-slate-500', icon: '?' }
              if (v >= 3)    return { label: 'Leading',        cls: 'text-emerald-400', icon: '?' }
              if (v >= 0.5)  return { label: 'Improving',      cls: 'text-cyan-400',   icon: '?' }
              if (v >= -0.5) return { label: 'Neutral',         cls: 'text-slate-400 tracking-[0.02em]',  icon: '?' }
              if (v >= -3)   return { label: 'Lagging',         cls: 'text-orange-400', icon: '?' }
              return           { label: 'Underperforming', cls: 'text-red-400',    icon: '?' }
            }
            const ranked = [...rsTable].sort((a,b) => {
              const av = parseFloat(a.vs)
              const bv = parseFloat(b.vs)
              if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0
              if (!Number.isFinite(av)) return 1
              if (!Number.isFinite(bv)) return -1
              return bv - av
            })
            const colorMap = Object.fromEntries(bucketPerf.map(b => [b.name, b.color]))
            return (
              <Panel title="Bucket Power Ranking" icon={TrendingUp}>
                {ranked.length === 0 ? (
                  <p className="text-[11px] text-slate-400 tracking-[0.02em]">Bucket ranking unavailable.</p>
                ) : (
                  <div className="space-y-0">
                    <div className="grid text-[11px] text-slate-400 tracking-[0.02em] uppercase pb-1 mb-0.5 border-b border-slate-800 gap-x-1"
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
                          <span className="text-[14px] font-medium leading-[1.6] text-slate-300 tracking-[0.02em] truncate">{r.name}</span>
                          <span className={`text-right text-[14px] font-bold font-mono tabular-nums ${st.cls}`}>{r.vs}</span>
                          <span className={`text-right text-[11px] ${st.cls}`}>{st.label}</span>
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
              if (!Number.isFinite(v)) return 'Unavailable'
              if (v >= 3)    return 'Leading'
              if (v >= 0.5)  return 'Improving'
              if (v >= -0.5) return 'Neutral'
              if (v >= -3)   return 'Lagging'
              return           'Underperforming'
            }
            const ranked = [...rsTable].sort((a,b) => {
              const av = parseFloat(a.vs)
              const bv = parseFloat(b.vs)
              if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0
              if (!Number.isFinite(av)) return 1
              if (!Number.isFinite(bv)) return -1
              return bv - av
            })
            const availableRanked = ranked.filter(r => Number.isFinite(parseFloat(r.vs)))
            const powerBucket   = availableRanked[0]?.name ?? null
            const analogBucket  = availableRanked.find(r => r.name.toLowerCase().includes('memory'))?.name
                                 ?? availableRanked[availableRanked.length - 1]?.name ?? null
            const weakBuckets   = availableRanked.filter(r => parseFloat(r.vs) < -0.5).map(r => r.name)
            const trendContext  = !powerBucket ? 'Trend context unavailable.' :
              weakBuckets.length >= 3
                ? `${powerBucket} remains the strongest relative bucket, while most other segments are lagging in the current cycle.`
              : weakBuckets.length >= 1
                ? `${powerBucket} remains the strongest relative bucket, while ${weakBuckets.slice(0,2).join(' and ')} continue to lag.`
              : `${powerBucket} is leading relative structure, with broad participation across semiconductor segments.`
            return (
              <Panel title="Trend Context" icon={Activity}>
                {!powerBucket ? (
                  <p className="text-[11px] text-slate-400 tracking-[0.02em]">Trend context unavailable.</p>
                ) : (
                  <div className="flex flex-col gap-[10px].5">
                    <div>
                      <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-0.5" style={{ fontFamily: UI_FONT }}>Power Bucket</div>
                      <div className="text-[13px] font-bold text-emerald-400">{powerBucket}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-0.5" style={{ fontFamily: UI_FONT }}>Analog Bucket</div>
                      <div className="text-[13px] font-medium text-slate-300 tracking-[0.02em]">{analogBucket ?? 'Not available'}</div>
                    </div>
                    {ranked.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>Bucket Status</div>
                        <div className="space-y-0.5">
                          {ranked.slice(0, 4).map(r => (
                            <div key={r.name} className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-300 tracking-[0.02em] truncate max-w-[96px]">{r.name}</span>
                              <span className={`font-medium ${
                                bucketStatus(r.vs) === 'Leading' || bucketStatus(r.vs) === 'Improving'
                                  ? 'text-emerald-400'
                                : bucketStatus(r.vs) === 'Neutral'
                                  ? 'text-slate-400 tracking-[0.02em]'
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
                      <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-0.5" style={{ fontFamily: UI_FONT }}>Trend Context</div>
                      <p className="text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em] leading-[1.6]">{trendContext}</p>
                    </div>
                  </div>
                )}
              </Panel>
            )
          })()}

        </aside>

        {/* CENTER 50% */}
        <section className="w-1/2 flex flex-col gap-[10px]">

          <Panel title="Analysis Engine Core" className="flex-none">
            {/* Chart tab bar */}
            <div className="flex gap-0 border-b border-slate-800 mb-2 shrink-0 -mx-2 px-2">
              {['PERFORMANCE', 'CORRELATION'].map(t => (
                <button key={t} onClick={() => setCenterTab(t)} title={TAB_TIPS[t]}
                  className={`px-4 py-1.5 text-[11px] font-bold tracking-widest border-b-2 transition-all ${
                    centerTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 tracking-[0.02em] hover:text-slate-400 tracking-[0.02em]'
                  }`}>{t}</button>
              ))}
            </div>

            {/* ???? PERFORMANCE VIEW ?????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'PERFORMANCE' && (
              <div className="space-y-3 pt-1">

                {/* 1. Bucket Performance Matrix */}
                <div>
                  <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-2" style={{ fontFamily: UI_FONT }}>Bucket Performance Matrix</div>
                  {!periodReturns ? (
                    <div className="text-[14px] font-medium leading-[1.6] text-slate-500 py-3 text-center">Loading…</div>
                  ) : (
                    <table className="w-full text-[14px] font-medium leading-[1.6] font-mono" style={{ fontFamily: DATA_FONT }}>
                      <thead>
                        <tr className="text-[11px] text-slate-500 border-b border-slate-800">
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
                              <td className="py-1 flex items-center gap-[6px].5">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                                <span className="text-slate-300 tracking-[0.02em] truncate">{b.name}</span>
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
                  <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: UI_FONT }}>Relative Performance vs SOXX 夷?1M</div>
                  {!periodReturns ? (
                    <div className="text-[14px] font-medium leading-[1.6] text-slate-500">Loading…</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="grid text-[11px] text-slate-500 uppercase pb-1 border-b border-slate-800/50"
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
                        const sig   = rel === null ? '?' : rel > 5 ? 'Leading' : rel < -5 ? 'Lagging' : 'In Line'
                        const sigCls = sig === 'Leading' ? 'text-emerald-400' : sig === 'Lagging' ? 'text-red-400' : 'text-slate-400 tracking-[0.02em]'
                        return (
                          <div key={b.name} className="grid items-center py-1 border-b border-slate-800/30 text-[14px] font-medium leading-[1.6] font-mono"
                            style={{ gridTemplateColumns: '1fr 56px 56px 64px' }}>
                            <span className="flex items-center gap-[6px].5 truncate">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                              <span className="text-slate-300 tracking-[0.02em] truncate">{b.name}</span>
                            </span>
                            <span className={`text-right tabular-nums font-bold ${retColor(ret)}`}>{fmtRet(ret)}</span>
                            <span className={`text-right tabular-nums font-bold ${retColor(rel)}`}>{rel !== null ? fmtRet(rel) : '?'}</span>
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
                    ['LEADING','CONFIRMED','CONFIRMING','BROAD'].includes(state) ? 'text-emerald-400' :
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
                        <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>AI Regime Lens</div>
                        {ar && (
                          <span className={`text-[11px] font-bold uppercase tracking-widest border px-1 py-0.5 ${
                            ar.data_mode === 'live'    ? 'text-emerald-400 border-emerald-700/40' :
                            ar.data_mode === 'partial' ? 'text-yellow-400 border-yellow-700/40'  :
                                                         'text-slate-500 border-slate-700/40'
                          }`}>{ar.data_mode}</span>
                        )}
                      </div>
                      {/* Regime label + confidence row */}
                      <div className="flex items-center gap-[10px] mb-2">
                        <span className={`text-[13px] font-black font-mono leading-none ${ar ? REGIME_COLOR[ar.regime_label] ?? 'text-slate-400 tracking-[0.02em]' : 'text-slate-400 tracking-[0.02em]'}`}>
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
                          const ppStr = comp ? `${comp.spread >= 0 ? '+' : ''}${comp.spread.toFixed(1)}pp` : '?'
                          return (
                            <div key={key} className="flex items-center gap-[6px].5">
                              <div className="text-[11px] text-slate-500 w-[52px] shrink-0">{label}</div>
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                                <div className={`h-full rounded-sm ${
                                  comp && ['LEADING','CONFIRMED','CONFIRMING','BROAD'].includes(comp.state) ? 'bg-emerald-500' :
                                  comp && ['IN_LINE','PARTIAL','NEUTRAL'].includes(comp.state)              ? 'bg-yellow-500'  :
                                  'bg-orange-500'
                                }`} style={{ width: pct }} />
                              </div>
                              <div className={`text-[11px] font-mono w-[58px] shrink-0 text-right ${comp ? COMP_COLOR(comp.state) : 'text-slate-400 tracking-[0.02em]'}`}>
                                {comp ? COMP_LABEL(comp.state) : 'N/A'}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 tracking-[0.02em] w-[38px] shrink-0 text-right" style={{ fontFamily: DATA_FONT }}>{ppStr}</div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Regime context */}
                      {ar && interpData?.regime_context && (
                        <div className="text-[11px] text-slate-300 tracking-[0.02em] leading-[1.6] border-t border-slate-800/60 pt-1.5 italic">
                          {interpData.regime_context}
                        </div>
                      )}
                    </div>
                  )
                })()}

              </div>
            )}



            {/* ???? CORRELATION VIEW ?????????????????????????????????????????????????????????????????????????????? */}
            {centerTab === 'CORRELATION' && (() => {
              // Relative signals from engine domain scores
              const aiInfraSig   = (domainSignals['ai_infra']   as number | undefined) ?? null
              const leaderSig    = (domainSignals['leadership'] as number | undefined) ?? null

              // Primary linked bucket: infer from primary_driver text or ai_infra signal
              const driverIsAI   = primaryDriver.toLowerCase().includes('ai') || primaryDriver.toLowerCase().includes('nvda') || primaryDriver.toLowerCase().includes('avgo')
              const primaryBucket = driverIsAI ? 'AI Infrastructure' : (primaryDriver !== '?' ? primaryDriver : live ? 'Analyzing…' : '?')

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

              // Relative-strength proxy from periodReturns (1M vs SOXX)
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
                  rel === null  ? '?'             :
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
                  b.key === 'ai'      && dep === 'High'    ? 'Strongest vs SOXX proxy'       :
                  b.key === 'ai'      && dep === 'Leading' ? 'Outperforming SOXX proxy'      :
                  b.key === 'mem'     && (dep === 'Lagging' || dep === 'Weak') ? 'Weaker than SOXX proxy' :
                  b.key === 'foundry'                      ? 'Neutral / cycle-aligned'       :
                  b.key === 'equip'   && dep === 'Lagging' ? 'Lagging vs SOXX proxy'         :
                  '?'
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
                  ? 'AI infrastructure is stronger than SOXX while other selected buckets lag.'
                : conflictType === 'AI_INFRA_SUSTAINABILITY_RISK'
                  ? 'AI infrastructure is outperforming SOXX, but selected-bucket breadth is structurally fragile.'
                : conflictType === 'SECTOR_ROTATION'
                  ? 'Leadership is rotating across semiconductor buckets.'
                : conflictType === 'BREADTH_DIVERGENCE'
                  ? 'SOXX price is diverging from selected-bucket participation.'
                : (conflictType === 'NO_CONFLICT' || conflictType === '?')
                  ? 'Selected-bucket relative strength is consistent with the current semiconductor trend.'
                : primaryRisk || conflictNote || 'No correlation conflict detected.'

              return (
                <div className="space-y-3 pt-1">

                  {/* 1. SOXX Relative Summary */}
                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="bg-slate-900/40 border border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>Primary Linked Bucket</div>
                      <div className="text-[14px] font-medium leading-[1.6] font-black leading-none mt-1 text-slate-200">
                        {live ? primaryBucket : '?'}
                      </div>
                      {aiInfraSig !== null && (
                        <div className="text-[11px] text-slate-400 tracking-[0.02em] mt-0.5">AI Infra signal: {aiInfraSig >= 0 ? '+' : ''}{aiInfraSig.toFixed(0)}</div>
                      )}
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>Concentration Risk</div>
                      <div className={`text-[14px] font-black leading-none mt-1 ${concRiskCls}`}>
                        {concRisk ?? 'Data pending'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>Leadership Signal</div>
                      <div className={`text-[18px] font-black font-mono leading-none ${leaderSig !== null ? (leaderSig > 20 ? 'text-emerald-400' : leaderSig < -20 ? 'text-red-400' : 'text-yellow-400') : 'text-slate-500'}`}>
                        {leaderSig !== null ? (leaderSig >= 0 ? `+${leaderSig.toFixed(0)}` : leaderSig.toFixed(0)) : '?'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>Confidence</div>
                      <div className={`text-[14px] font-medium leading-[1.6] font-black leading-none mt-1 ${
                        confidenceLabel === 'High' ? 'text-emerald-400' : confidenceLabel === 'Low' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {live ? `${confidenceScore} (${confidenceLabel})` : '?'}
                      </div>
                    </div>
                  </div>

                  {/* 2. Bucket Relative-Strength Matrix */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-[10px] mb-1.5">
                      <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>Bucket Relative-Strength Matrix</span>
                      <span className="text-[11px] text-slate-400 tracking-[0.02em] bg-slate-800/60 px-1 rounded-sm">relative proxy - not attribution</span>
                    </div>
                    {!periodReturns ? (
                      <div className="text-[14px] font-medium leading-[1.6] text-slate-500 py-3 text-center">Data pending</div>
                    ) : (
                      <div>
                        <div className="grid text-[11px] text-slate-500 uppercase pb-1 border-b border-slate-800/50"
                          style={{ gridTemplateColumns: '1fr 52px 52px 1fr' }}>
                          <span>Bucket</span>
                          <span className="text-right">1M</span>
                          <span className="text-right">vs SOXX</span>
                          <span className="text-right">Relative</span>
                        </div>
                        {bucketDep?.map(b => (
                          <div key={b.name} className="grid items-center py-1 border-b border-slate-800/30 text-[14px] font-medium leading-[1.6] font-mono"
                            style={{ gridTemplateColumns: '1fr 52px 52px 1fr' }}>
                            <span className="flex items-center gap-[6px].5 truncate">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                              <span className="text-slate-300 tracking-[0.02em] truncate">{b.name}</span>
                            </span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.ret1m)}`}>{fmtRet(b.ret1m)}</span>
                            <span className={`text-right tabular-nums font-bold ${retColor(b.rel)}`}>{b.rel !== null ? fmtRet(b.rel) : '?'}</span>
                            <span className={`text-right font-bold ${b.depCls}`}>{b.dep}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Cap-weight vs Equal-weight Spread */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-2" style={{ fontFamily: UI_FONT }}>Cap-Weight vs Equal-Weight</div>
                    <div className="grid grid-cols-2 gap-[10px] mb-2">
                      <div className="bg-slate-900/40 border border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>EW vs CW Spread</div>
                        <div className={`text-[18px] font-black font-mono leading-none ${
                          ewVsCw === null ? 'text-slate-500' :
                          ewVsCw < -20   ? 'text-red-400'    :
                          ewVsCw < -10   ? 'text-orange-400' : 'text-slate-300 tracking-[0.02em]'
                        }`}>
                          {ewVsCw !== null ? `${ewVsCw >= 0 ? '+' : ''}${ewVsCw.toFixed(1)}` : 'Data pending'}
                        </div>
                        {ewInterpretation && <div className="text-[11px] text-slate-400 tracking-[0.02em] mt-0.5">{ewInterpretation}</div>}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 p-3">
                        <div className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1" style={{ fontFamily: UI_FONT }}>Top 5 Concentration</div>
                        <div className={`text-[18px] font-black font-mono leading-none ${
                          concentration === null ? 'text-slate-500' :
                          concentration >= 85    ? 'text-red-400'    :
                          concentration >= 65    ? 'text-orange-400' : 'text-slate-300 tracking-[0.02em]'
                        }`}>
                          {concentration !== null ? `${Math.round(concentration)}%` : 'Data pending'}
                        </div>
                        {concTop5Label && <div className="text-[11px] text-slate-400 tracking-[0.02em] mt-0.5">{concTop5Label}</div>}
                      </div>
                    </div>
                  </div>

                  {/* 4. Correlation Interpretation */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[20px] font-semibold font-sans text-slate-400 tracking-[0.02em] mb-1.5">Correlation Interpretation</div>
                    <div className={`p-3 rounded-sm border text-[11px] ${
                      isCorrelConflict ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center gap-[6px].5 mb-0.5">
                        <span className={`font-bold text-[11px] uppercase px-1 rounded-sm ${
                          isCorrelConflict ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400 tracking-[0.02em]'
                        }`}>{displayConflict(conflictType)}</span>
                      </div>
                      <span className="text-slate-300 tracking-[0.02em] leading-[1.8]">{correlInterpretation}</span>
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
                    const cls   = avgRecent > 0.5 ? 'text-emerald-400' : avgRecent < -0.5 ? 'text-orange-400' : 'text-slate-400 tracking-[0.02em]'
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 uppercase tracking-widest" style={{ fontFamily: UI_FONT }}>Divergence Context (5d avg)</span>
                          <span className={`text-[11px] font-bold font-mono ${cls}`}>
                            EW {avgRecent >= 0 ? '+' : ''}{avgRecent.toFixed(2)}% vs CW
                          </span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${cls}`}>{label}</div>
                      </div>
                    )
                  })()}

                  {/* 5. Correlation Matrix Heatmap */}
                  {(() => {
                    const cm = live?.correlation_matrix ?? null
                    return (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>Correlation Matrix</span>
                          {cm && <span className="text-[11px] text-slate-500">Pearson 夷?{cm.window_days}d window</span>}
                        </div>
                        {cm ? (() => {
                          const n = cm.labels.length
                          const cellCls = (v: number, i: number, j: number): string => {
                            if (i === j) return 'bg-slate-700/60 text-slate-400 tracking-[0.02em]'
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
                              <table className="w-full text-[11px] font-mono border-collapse" style={{ fontFamily: DATA_FONT }}>
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
                                      <td className="text-slate-400 tracking-[0.02em] pr-1 py-0.5 text-[11px] truncate max-w-[60px]">{short(cm.labels[i])}</td>
                                      {row.map((v, j) => (
                                        <td key={j} className={`text-center py-0.5 px-0.5 rounded-sm ${cellCls(v, i, j)}`}>
                                          {i === j ? '?' : v.toFixed(2)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="flex gap-[10px] mt-1.5 text-[11px] text-slate-400 tracking-[0.02em]">
                                <span className="text-emerald-400">■</span><span>≥0.85 High</span>
                                <span className="text-yellow-400">■</span><span>0.50?0.70 Mod</span>
                                <span className="text-red-400">■</span><span>&lt;0.30 Low</span>
                              </div>
                            </div>
                          )
                        })() : (
                          <div className="text-[14px] font-medium leading-[1.6] text-slate-500 py-3 text-center">Data pending</div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )
            })()}


          </Panel>

          {/* History Table */}
          <Panel title="History Table" icon={History}>
            <div className="flex border-b border-slate-800 mb-2 -mx-2 px-2 shrink-0">
              {['HISTORY TABLE', 'EVENT LOG'].map(t => (
                <button key={t} onClick={() => setHistTab(t)}
                  className={`px-4 py-1.5 text-[11px] font-bold tracking-widest border-b-2 transition-colors ${
                    histTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 tracking-[0.02em] hover:text-slate-400 tracking-[0.02em]'
                  }`}>{t}</button>
              ))}
            </div>

            {histTab === 'HISTORY TABLE' && (
              historyRows.length === 0 ? (
                <div className="py-6 text-center text-[14px] font-medium leading-[1.6] text-slate-500">Loading history…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px] font-medium leading-[1.6] font-mono" style={{ fontFamily: DATA_FONT }}>
                    <thead>
                      <tr className="text-[11px] text-slate-400 tracking-[0.02em] border-b border-slate-800">
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
                          <td className="py-1.5 text-slate-400 tracking-[0.02em] pr-3 tabular-nums" style={{ fontFamily: DATA_FONT }}>{r.date}</td>
                          <td className="py-1.5 text-emerald-400 pr-3">{r.stage}</td>
                          <td className={`py-1.5 text-right font-bold pr-3 tabular-nums ${r.eng >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>{r.eng}</td>
                          <td className={`py-1.5 text-right font-bold pr-3 tabular-nums ${r.str >= 65 ? 'text-emerald-400' : 'text-yellow-400'}`}>{r.str}</td>
                          <td className="py-1.5 pr-3 text-slate-400 tracking-[0.02em]">{r.conflict}</td>
                          <td className="py-1.5 text-right text-slate-400 tracking-[0.02em] pr-3 tabular-nums" style={{ fontFamily: DATA_FONT }}>{r.breadth}</td>
                          <td className={`py-1.5 pr-3 ${r.mom === 'Strengthening' ? 'text-emerald-400' : r.mom === 'Fading' ? 'text-red-400' : 'text-slate-400 tracking-[0.02em]'}`}>{r.mom}</td>
                          <td className={`py-1.5 font-bold pr-3 ${r.regime === 'RISK ON' ? 'text-emerald-400' : 'text-slate-400 tracking-[0.02em]'}`}>{r.regime}</td>
                          <td className="py-1.5 text-slate-400 tracking-[0.02em] whitespace-nowrap">{r.note}</td>
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
                  <div key={i} className={`flex gap-[10px] p-3 border text-[14px] font-medium leading-[1.6] ${e.hot ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-800/50'}`}>
                    <span className={`whitespace-nowrap ${e.hot ? 'text-orange-400' : 'text-slate-400 tracking-[0.02em]'}`}>{e.date}</span>
                    <span className="text-slate-400 tracking-[0.02em]">{e.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </section>

        {/* RIGHT 25% */}
        <aside className="w-1/4 shrink-0 flex flex-col gap-[10px] pb-20 h-fit">

          <Panel title={RIGHT_PANEL_COPY.heading} icon={Bell}
            headerExtra={
              <span className={`flex items-center gap-[6px] text-[11px] ${lensDataStatusClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${lensDataDotClass}`} /> {lensDataStatusLabel}
              </span>
            }>
            {(() => {
              const noConflict = lensNoConflict
              const hasLive    = !!live
              const structure  = soxxStructure

              // ??Delta items
              type DeltaItem = { label: string; from: string; to: string; dir: 'up' | 'down' | 'neutral' }
              const deltaItems: DeltaItem[] = []
              if (prevSnap && hasLive) {
                if (prevSnap.stageName !== stageName)
                  deltaItems.push({ label: 'Stage', from: prevSnap.stageName, to: stageName, dir: 'neutral' })
                if (prevSnap.conflictType !== conflictType) {
                  const wasBad = prevSnap.conflictType !== 'NO_CONFLICT' && prevSnap.conflictType !== '?'
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
                    sub: `${displayConflict(conflictType)} - interpretation caution` })
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
                    sub: 'Weaker than SOXX - monitor for recovery' })
                watches.push({ sev: 'gray', text: 'Daily data refresh', sub: 'Scheduled backend update' })
              }
              const watchSorted = watches
                .sort((a,b) => ({ red:0,amber:1,gray:2 }[a.sev] - { red:0,amber:1,gray:2 }[b.sev]))
                .slice(0, 2)

              return (
                <div className="flex flex-col gap-[10px].5">
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] font-semibold font-sans text-slate-400 uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>
                      Data Trust Note
                    </div>
                    <p className="text-[11px] leading-[1.6] text-slate-400">
                      {lensTrustNote}
                    </p>
                    {returnsFreshness.status === 'delayed' && (
                      <p className="mt-1 text-[11px] leading-[1.6] text-amber-300">
                        {returnsFreshness.detail}
                      </p>
                    )}
                    {returnsFreshness.status === 'stale' && (
                      <p className="mt-1 text-[11px] leading-[1.6] text-amber-300">
                        {returnsFreshness.detail}
                      </p>
                    )}
                  </div>

                  {/* What it means */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1" style={{ fontFamily: UI_FONT }}>What It Means</div>
                    <p className="text-[14px] font-medium leading-[1.6] text-slate-200 leading-[1.6] font-medium">
                      {lensInterpretation}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-[1.6] mt-1">{RIGHT_PANEL_COPY.externalNote}</p>
                  </div>

                  {/* Selected vs Residual */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="flex items-center justify-between gap-[12px] mb-1.5">
                      <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }}>
                        Selected vs Residual
                      </div>
                      <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${participationStateClass(participationInterpretation.state)}`}>
                        {participationInterpretation.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] leading-4">
                      <div className="rounded-sm border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                        <div className="uppercase tracking-[0.12em] text-slate-500">Selected contribution</div>
                        <div className={`mt-0.5 font-semibold ${selectedContribution === null ? 'text-slate-500' : pctPointColor(selectedContribution)}`}>
                          {formatPctPointOrUnavailable(selectedContribution)}
                        </div>
                      </div>
                      <div className="rounded-sm border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                        <div className="uppercase tracking-[0.12em] text-slate-500">Residual contribution</div>
                        <div className={`mt-0.5 font-semibold ${residualContribution === null ? 'text-slate-500' : pctPointColor(residualContribution)}`}>
                          {formatPctPointOrUnavailable(residualContribution)}
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-[12px] leading-[1.55] text-slate-300">
                      {participationInterpretation.interpretation}
                    </p>
                    <p className="mt-1 text-[11px] leading-[1.55] text-slate-500">
                      {participationInterpretation.soxlContext}
                    </p>
                    {participationInterpretation.state === 'unavailable' ? (
                      <p className="mt-1 text-[11px] leading-[1.55] text-amber-300">
                        Selected vs Residual interpretation unavailable. Required contribution data is not connected yet.
                      </p>
                    ) : hasPartialContributionData ? (
                      <p className="mt-1 text-[11px] leading-[1.55] text-amber-300">
                        Partial contribution data. Interpretation may change as missing holdings or returns are connected.
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] leading-[1.55] text-slate-500">
                      Historical participation context only. Not a forecast or trading signal.
                    </p>
                  </div>

                  {/* Structure Snapshot */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: UI_FONT }}>Structure Snapshot</div>
                    <div className="space-y-1">
                      {[
                        { label: 'Structure', value: soxxStructure, cls: soxxStructureClass, title: undefined },
                        {
                          label: 'Coverage',
                          value: `Selected ${formatPct(soxxCoverageSummary.selectedCoveragePct)} / Residual ${formatPct(soxxCoverageSummary.residualPct)}`,
                          cls: 'text-slate-300',
                          title: CONTRIBUTION_HELP.coverage?.detail,
                        },
                        {
                          label: 'Holdings',
                          value: `SOXX as of ${SOXX_HOLDINGS_SNAPSHOT_AS_OF}`,
                          cls: 'text-slate-300',
                          title: SOXX_HOLDINGS_SNAPSHOT_SOURCE,
                        },
                        { label: 'Bias', value: contributionBiasLabel, cls: contributionBiasClass, title: CONTRIBUTION_HELP.contribution?.detail },
                        { label: 'SOXL', value: soxlSensitivity.level, cls: soxlSensitivityClass, title: CONTRIBUTION_HELP.soxl?.detail },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between gap-[14px] leading-[1.6]">
                          <span className="text-[11px] text-slate-500 uppercase shrink-0" title={row.title}>{row.label}</span>
                          <span className={`text-[11px] font-medium tracking-[0.02em] text-right ${row.cls}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 leading-[1.6]">
                      {RIGHT_PANEL_COPY.selectedDriverGuardrail} {RIGHT_PANEL_COPY.guardrail}
                    </p>
                  </div>

                  {/* SOXX Contribution Snapshot */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="flex items-center justify-between gap-[14px]">
                      <div>
                        <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em]" style={{ fontFamily: UI_FONT }} title={CONTRIBUTION_HELP.contribution?.detail}>SOXX Contribution Snapshot</div>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-[1.4]">
                          Holding-weighted contribution by selected SOXX driver buckets.
                        </p>
                      </div>
                      <div className="flex items-center gap-[6px]">
                        {SOXX_CONTRIBUTION_PERIODS.map((period) => {
                          const isActive = contributionPeriod === period
                          const isAvailable = availableContributionPeriods.includes(period)

                          return (
                            <button
                              key={period}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => setContributionPeriod(period)}
                              className={[
                                'rounded px-1.5 py-0.5 text-[11px] transition',
                                isActive
                                  ? 'bg-slate-200 text-slate-950'
                                  : 'bg-slate-800/80 text-slate-400 tracking-[0.02em] hover:bg-slate-700',
                                !isAvailable ? 'cursor-not-allowed opacity-40 hover:bg-slate-800/80' : '',
                              ].join(' ')}
                            >
                              {period}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {soxxContributionSummary ? (
                      <>
                        <div className="mt-2 rounded-sm border border-slate-800 bg-slate-950/30 p-2">
                          <div className="grid grid-cols-3 gap-2 text-[10px] leading-4">
                            <div>
                              <div className="uppercase tracking-[0.12em] text-slate-500">Selected</div>
                              <div className={`mt-0.5 font-semibold ${pctPointColor(soxxContributionSummary.selectedContributionPctPoint)}`}>
                                {formatPctPoint(soxxContributionSummary.selectedContributionPctPoint)}
                              </div>
                            </div>
                            <div>
                              <div className="uppercase tracking-[0.12em] text-slate-500">Residual</div>
                              <div className={`mt-0.5 font-semibold ${pctPointColor(soxxContributionSummary.residualContributionPctPoint)}`}>
                                {formatPctPoint(soxxContributionSummary.residualContributionPctPoint)}
                              </div>
                            </div>
                            <div>
                              <div className="uppercase tracking-[0.12em] text-slate-500">Bias</div>
                              <div className="mt-0.5 font-semibold text-slate-300">{participationInterpretation.label}</div>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                            {residualSnapshotNote}
                          </p>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {orderedSoxxBucketContributions.map((bucket) => {
                            const state = contributionState(bucket.contributionPctPoint)

                            return (
                              <div
                                key={bucket.bucketId}
                                className="rounded-sm border border-slate-800 bg-slate-950/30 px-2 py-1.5"
                                title={bucket.bucketId === 'residual' ? CONTRIBUTION_HELP.residual?.detail : CONTRIBUTION_HELP.contribution?.detail}
                              >
                                <div className="flex items-start justify-between gap-[12px]">
                                  <div className="min-w-0">
                                    <div className="truncate text-[11px] font-semibold text-slate-300">
                                      {bucket.label}
                                    </div>
                                    <span className={`mt-1 inline-flex rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${state.cls}`}>
                                      {state.label}
                                    </span>
                                  </div>
                                  <div className={`text-[12px] font-bold ${pctPointColor(bucket.contributionPctPoint)}`}>
                                    {formatPctPoint(bucket.contributionPctPoint)}
                                  </div>
                                </div>
                                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px] leading-4 text-slate-500">
                                  <div>
                                    Return <span className="font-semibold text-slate-300">{formatReturnPct(bucket.weightedReturnPct)}</span>
                                  </div>
                                  <div>
                                    Weight <span className="font-semibold text-slate-300">{formatPct(bucket.totalWeightPct)}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500 leading-[1.6]">
                          Contribution = holding weight x return, shown as %p. Historical context only.
                        </p>
                        {soxxContributionSummary.missingReturnTickers.length > 0 && (
                          <p className="mt-1 text-[11px] text-amber-300 leading-[1.6]">
                            Partial contribution data: some holdings or returns are missing.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500 leading-[1.6]">
                        Contribution unavailable. Price history or return data is not connected yet.
                      </p>
                    )}
                  </div>

                  <SoxxContributionTrendMiniChart
                    data={contributionTrendData}
                    periodLabel={contributionHistoryPayload?.period ?? contributionPeriod}
                    helpTitle={CONTRIBUTION_HELP.trend?.detail}
                  />
                  {contributionHistoryPayload?.status === 'partial' && (
                    <p className="-mt-1 pb-2.5 text-[11px] text-amber-300 leading-[1.6]">
                      Partial data: some holdings may be missing return data.
                    </p>
                  )}

                  {/* SOXL daily sensitivity */}
                  {(() => {
                    const { level, reason } = soxlSensitivity
                    return (
                      <div className="pb-2.5 border-b border-slate-800/60">
                        <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-0.5" style={{ fontFamily: UI_FONT }} title={CONTRIBUTION_HELP.soxl?.detail}>{SOXL_COPY.title}</div>
                        <p className="text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em] mb-1.5">{RIGHT_PANEL_COPY.soxlNote}</p>
                        <div className="flex items-baseline gap-[10px]">
                          <span className={`text-[14px] font-medium leading-[1.6] font-bold uppercase ${soxlSensitivityClass}`}>{level}</span>
                          <span className="text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em] leading-[1.6]">{reason}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* How to Read This */}
                  <div className="pb-2.5 border-b border-slate-800/60">
                    <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: UI_FONT }}>How to Read This</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {HOW_TO_READ_COPY.map((item) => (
                        <p key={item.text} className="text-[11px] text-slate-500 leading-[1.6]" title={item.title}>
                          {item.text}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Watch ??secondary */}
                  {watchSorted.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold font-sans text-slate-400 tracking-[0.02em] uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: UI_FONT }}>Watch</div>
                      <div className="space-y-1">
                        {watchSorted.map((w, i) => (
                          <div key={i} className={`pl-2 border-l-[2px] py-0.5 ${
                            w.sev === 'red'   ? 'border-red-500/50'   :
                            w.sev === 'amber' ? 'border-amber-500/50' : 'border-slate-700/40'
                          }`}>
                            <div className={`text-[14px] font-medium leading-[1.6] leading-[1.6] ${
                              w.sev === 'red'   ? 'text-red-400'   :
                              w.sev === 'amber' ? 'text-amber-400' : 'text-slate-400 tracking-[0.02em]'
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
              <div className="flex items-center gap-[6px]">
                <select className="bg-slate-900 border border-slate-700 text-[11px] text-slate-300 tracking-[0.02em] px-1 py-0.5 cursor-pointer outline-none">
                  <option>SOXX Index</option>
                  <option>AI Compute</option>
                  <option>Memory</option>
                  <option>Foundry</option>
                </select>
                <X size={11} className="text-slate-400 tracking-[0.02em] cursor-pointer hover:text-slate-300 tracking-[0.02em]" />
              </div>
            }>

            <div className="flex border-b border-slate-800 mb-2 -mx-2 px-2 shrink-0">
              {['SUMMARY','CONSTITUENTS','RISK','FUNDAMENTALS'].map(t => (
                <button key={t} onClick={() => setDrillTab(t)}
                  className={`px-2 py-1.5 text-[14px] font-medium leading-[1.6] font-bold tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                    drillTab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 tracking-[0.02em] hover:text-slate-400 tracking-[0.02em]'
                  }`}>{t}</button>
              ))}
            </div>

            {drillTab === 'SUMMARY' && (() => {
              const soxxPrice  = kpis?.soxx_price ?? null
              const ret1d      = periodReturns?.soxx?.['1D'] ?? null
              const ret1dPct   = ret1d !== null && visibleData.length > 1
                ? ret1d  // already a rebased % point delta
                : null
              const priceStr   = soxxPrice != null ? soxxPrice.toFixed(2) : '—'
              const chgSign    = ret1dPct != null ? (ret1dPct >= 0 ? '+' : '') : ''
              const chgStr     = ret1dPct != null ? `${chgSign}${ret1dPct.toFixed(2)}%` : '—'
              const chgColor   = ret1dPct == null ? 'text-slate-400 tracking-[0.02em]' : ret1dPct >= 0 ? 'text-emerald-400' : 'text-red-400'
              const chartData  = rebasedData.map(r => ({ d: r.date, v: r.soxx }))
              return (
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-[6px].5 mb-0.5">
                    <span className="text-[24px] font-black text-white font-mono leading-none tracking-tighter" style={{ fontFamily: DATA_FONT }}>{priceStr}</span>
                    <span className="text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em]">USD</span>
                  </div>
                  <div className={`font-bold text-[14px] font-mono mb-2 ${chgColor}`}>
                    1D Change: {chgStr}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 mb-2 text-[14px] font-medium leading-[1.6] font-mono" style={{ fontFamily: DATA_FONT }}>
                    {([
                      { label: '5D',  val: periodReturns?.soxx?.['5D']  },
                      { label: '1M',  val: periodReturns?.soxx?.['1M']  },
                      { label: '3M',  val: periodReturns?.soxx?.['3M']  },
                      { label: '6M',  val: periodReturns?.soxx?.['6M']  },
                    ] as { label: string; val: number | null | undefined }[]).map(({ label, val }) => (
                      <div key={label} className="flex justify-between py-0.5 border-b border-slate-800/50">
                        <span className="text-slate-400 tracking-[0.02em]">{label}</span>
                        <span className={val == null ? 'text-slate-500' : val >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {val == null ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-0.5 mb-2">
                    {(['1M','3M','6M','1Y','3Y','5Y','MAX'] as const).map(z => (
                      <button key={z} onClick={() => setZoom(z)}
                        className={`flex-1 py-0.5 text-[11px] border rounded-sm ${
                          zoom === z ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'border-slate-800 text-slate-400 tracking-[0.02em] hover:text-slate-400 tracking-[0.02em]'
                        }`}>{z}</button>
                    ))}
                  </div>

                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis domain={['auto','auto']} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickFormatter={v => `${(+v) >= 0 ? '+' : ''}${(+v).toFixed(0)}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0c1220', border: '1px solid #1e293b', fontSize: 11 }}
                          formatter={(v: unknown) => [`${(+String(v)) >= 0 ? '+' : ''}${(+String(v)).toFixed(1)}%`, 'SOXX (rebased)']} />
                        <defs>
                          <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 4" />
                        <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#dg)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {!live && (
                    <p className="mt-1 text-[11px] text-yellow-500 text-center">API data unavailable — check /api/semiconductor-lens</p>
                  )}
                </div>
              )
            })()}

            {drillTab !== 'SUMMARY' && (
              <div className="h-32 flex items-center justify-center text-[14px] font-medium leading-[1.6] text-slate-400 tracking-[0.02em]">
                {drillTab} — coming soon
              </div>
            )}

          </Panel>

          {debugMode && (
            <SoxxDataDebugPanel summary={soxxDataDebugSummary} />
          )}

        </aside>
      </div>

      {/* ???? TAB 2: SOXX/SOXL Translation ???? */}
      {mainTab === 'STRATEGY' && (
        <div className="px-4 md:px-6 xl:px-10 2xl:px-14 flex-1">
          <SoxxSoxlTranslationTab />
        </div>
      )}

      {/* ???? TAB 3: Playback ???? */}
      {mainTab === 'PLAYBACK' && (
        <div className="px-4 md:px-6 xl:px-10 2xl:px-14 flex-1">
          <SemiconductorPlaybackTab />
        </div>
      )}

      {/* ???? FOOTER 28px ???? */}
      <footer className="border-t border-slate-800 bg-[#06090f] px-4 md:px-6 xl:px-10 2xl:px-14 py-1.5 flex items-center justify-between text-[11px] text-slate-400 tracking-[0.02em] sticky bottom-0 z-50 mt-auto">
        <div className="flex gap-5 font-mono overflow-hidden" style={{ fontFamily: DATA_FONT }}>
          {[
            { label: 'SOXX',               val: '568.23',    chg: '+2.22%', up: true  },
            { label: 'NASDAQ',             val: '16,742.39', chg: '+1.18%', up: true  },
            { label: 'S&P 500',            val: '5,307.01',  chg: '+1.09%', up: true  },
            { label: 'PHLX Semiconductor', val: '5,125.80',  chg: '+2.35%', up: true  },
            { label: 'VIX',                val: '15.21',     chg: '-2.18%', up: false },
          ].map(m => (
            <span key={m.label} className="flex items-center gap-[6px].5">
              <span className="font-bold text-white">{m.label}</span>
              <span className="text-slate-400 tracking-[0.02em]">{m.val}</span>
              <span className={m.up ? 'text-emerald-400' : 'text-red-400'}>{m.chg}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-[18px] tracking-tighter shrink-0 text-[11px]">
          {interpData ? (() => {
            const dm = interpData.ai_regime?.data_mode ?? 'snapshot'
            return dm === 'live' ? (
              <span className="text-emerald-400 flex items-center gap-[6px] font-bold uppercase">
                <span className="w-1 h-1 rounded-full bg-emerald-400" /> CONNECTED - semiconductor market data cache
              </span>
            ) : (
              <span className="text-yellow-500 flex items-center gap-[6px] font-bold uppercase">
                <span className="w-1 h-1 rounded-full bg-yellow-500" /> SNAPSHOT - semiconductor_market_data.json
              </span>
            )
          })() : (
            <span className="text-slate-500 font-bold uppercase">DATA UNAVAILABLE</span>
          )}
          <span className="text-slate-400 tracking-[0.02em] font-mono normal-case uppercase font-bold" style={{ fontFamily: DATA_FONT }}>Last updated <span className="text-white">{asOf !== '?' ? asOf : '?'}</span></span>
        </div>
      </footer>

    </div>
  )
}
