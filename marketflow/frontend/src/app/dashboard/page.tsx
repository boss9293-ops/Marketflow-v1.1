import fs from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import HotPanel from '@/components/HotPanel'
import BilLabel from '@/components/BilLabel'
import StructurePanel from '@/components/StructurePanel'
import RiskPanel from '@/components/RiskPanel'
import MarketHistoryStrip from '@/components/MarketHistoryStrip'
import RecentAlertsCard from '@/components/RecentAlertsCard'
import AdvancedMetricsDrawer from '@/components/AdvancedMetricsDrawer'
import LanguageModeToggle from '@/components/LanguageModeToggle'
import AIMarketBrief from '@/components/dashboard/AIMarketBrief'
import ActionGuidanceCard from '@/components/dashboard/ActionGuidanceCard'
import TodaySnapshotBar from '@/components/dashboard/TodaySnapshotBar'
import CrossAssetStripCompact from '@/components/dashboard/CrossAssetStripCompact'
import RiskEngineSummaryBar from '@/components/dashboard/RiskEngineSummaryBar'
import type { SmartMoneyCache } from '@/components/SmartMoneyView'
import type { OverviewHomeData } from '@/components/HotPanel'
import type { AlertEvidenceContext } from '@/components/AlertDetailDrawer'
import { readCacheJson } from '@/lib/readCacheJson'
import { accentColorFromLevel, getRiskSecondaryAccents, riskLevelToToken } from '@/lib/riskPalette'

// ?Ä?Ä Cache types ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä

type SnapshotItem = {
  date: string
  gate_score?: number | null
  market_phase?: string | null
  risk_level?: string | null
  gate_score_10d_avg?: number | null
  gate_delta_5d?: number | null
  risk_trend?: string | null
  phase_shift_flag?: number
}

type SnapshotsCache = { snapshots?: SnapshotItem[] }

type AlertItem = {
  date?: string
  signal_type?: string
  score?: number
  strength?: number
  streak?: number
  status?: string
  severity_label?: 'HIGH' | 'MED' | 'LOW' | string
  regime_label?: 'STRUCTURAL' | 'EVENT' | 'NOISE' | string
  payload_json?: {
    rule?: string | null
    trend?: {
      gate_score?: number | null
      market_phase?: string | null
      risk_level?: string | null
      risk_trend?: string | null
      phase_shift_flag?: number | null
      gate_delta_5d?: number | null
    } | null
  } | null
}

type AlertsCache = { alerts?: AlertItem[] }

type DailyBriefing = {
  data_date?: string | null
  headline?: string | null
  bullets?: { label?: string | null; text?: string | null }[]
  stance?: { action?: string | null; exposure_band?: string | null }
}

type HealthcheckCache = {
  ok?: boolean
  data_date?: string | null
  missing_files?: string[]
  schema_errors?: string[]
  warnings?: string[]
}

type HealthSnapshotCache = {
  data_date?: string | null
  trend?: { dist_pct?: number | null } | null
  risk?: {
    var95_1d?: number | null
    cvar95_1d?: number | null
    vol_ratio?: number | null
  } | null
}

type ActionSnapshotCache = {
  data_date?: string | null
  exposure_guidance?: {
    action_label?: string | null
    exposure_band?: string | null
  } | null
}

type TapeItem = {
  symbol?: string | null
  last?: number | null
  chg_pct?: number | null
  spark_1d?: number[] | null
}
type MarketTapeCache = { items?: TapeItem[] | null }

type SectorPerfItem = {
  symbol?: string | null
  name?: string | null
  change_1d?: number | null
  change_1w?: number | null
}
type SectorRotationCache = { sector_perf?: SectorPerfItem[] | null }

type MacroStateChip = {
  label: string
  value: string
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
}

// ?Ä?Ä Palette ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä

const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  shock:      '#D32F2F',
  neutral:    '#D8E6F5',
} as const

// ?Ä?Ä Helpers ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä

function phaseColor(phase?: string | null) {
  if (phase === 'BULL')    return C.bull
  if (phase === 'BEAR')    return C.defensive
  if (phase === 'NEUTRAL') return C.transition
  return C.neutral
}

function riskColor(level?: string | null) {
  if (level === 'LOW')    return C.bull
  if (level === 'MEDIUM') return C.transition
  if (level === 'HIGH')   return C.defensive
  return C.neutral
}

function gateColor(score?: number | null): string {
  if (score == null) return C.neutral
  if (score > 60)    return C.bull
  if (score > 40)    return C.transition
  return C.defensive
}

function severityStyle(s?: string) {
  if (s === 'HIGH') return { color: '#fecaca', bg: `${C.defensive}28`,  border: `${C.defensive}50`  }
  if (s === 'MED')  return { color: '#fde68a', bg: `${C.transition}22`, border: `${C.transition}45` }
  return                   { color: '#bbf7d0', bg: `${C.bull}22`,       border: `${C.bull}45`        }
}

function regimeStyle(r?: string) {
  if (r === 'STRUCTURAL') return { color: '#ddd6fe', bg: 'rgba(139,92,246,0.16)', border: 'rgba(139,92,246,0.32)' }
  if (r === 'EVENT')      return { color: '#fed7aa', bg: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.32)' }
  return                         { color: '#d1d5db', bg: 'rgba(107,114,128,0.16)',border: 'rgba(107,114,128,0.32)'}
}

function card(extra?: object) {
  return {
    background: '#11161C',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '1.1rem',
    ...extra,
  } as const
}

function fmtPct(v?: number | null, digits = 2) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

function fmtCompact(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '??
  const abs = Math.abs(v)
  if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (abs >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

function miniSparkPath(pts?: number[] | null) {
  if (!Array.isArray(pts) || pts.length < 2) return null
  const w = 42
  const h = 14
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

async function readOutputJson<T>(filename: string, fallback: T): Promise<T> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ]
  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf-8')) as T
    } catch {
      // try next
    }
  }
  return fallback
}

function pickText(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (typeof obj.ko === 'string') return obj.ko
    if (typeof obj.en === 'string') return obj.en
  }
  return null
}

function pickBullets(v: unknown): Array<{ label?: string | null; text?: string | null }> {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (Array.isArray(obj.ko)) return obj.ko
    if (Array.isArray(obj.en)) return obj.en
  }
  return []
}

const EMPTY_HOME: OverviewHomeData = {
  hot_top5: [], volume_spike_top5: [], ai_picks_top5: [], streak_hot_top10: [],
}
const SMART_FLOW_FALLBACK: SmartMoneyCache = {
  date: null,
  top: [],
  watch: [],
  sectors: { top: [], bottom: [], all: [] },
  coverage: {},
  count: 0,
  data_version: 'smart_money_v1',
  generated_at: null,
  rerun_hint: 'python backend/scripts/build_smart_money.py',
}

// ?Ä?Ä Page ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä

export default async function Dashboard() {
  const [snapshotsData, alertsData, overviewHome, dailyBriefing, healthcheck, healthSnapshot, actionSnapshot, marketTape, smartMoney, sectorRotation] = await Promise.all([
    readCacheJson<SnapshotsCache>('snapshots_120d.json', { snapshots: [] }),
    readCacheJson<AlertsCache>('alerts_recent.json', { alerts: [] }),
    readCacheJson<OverviewHomeData>('overview_home.json', EMPTY_HOME),
    readCacheJson<DailyBriefing>('daily_briefing.json', { bullets: [] }),
    readCacheJson<HealthcheckCache>('healthcheck.json', {}),
    readCacheJson<HealthSnapshotCache>('health_snapshot.json', {}),
    readCacheJson<ActionSnapshotCache>('action_snapshot.json', {}),
    readCacheJson<MarketTapeCache>('market_tape.json', { items: [] }),
    readCacheJson<SmartMoneyCache>('smart_money.json', SMART_FLOW_FALLBACK),
    readOutputJson<SectorRotationCache>('sector_rotation.json', { sector_perf: [] }),
  ])

  const snapshots     = Array.isArray(snapshotsData.snapshots) ? snapshotsData.snapshots : []
  const recent5Market = snapshots.slice(-5).reverse()
  const alerts        = Array.isArray(alertsData.alerts) ? alertsData.alerts : []

  const severityCount = {
    HIGH: alerts.filter((a) => (a.severity_label || '').toUpperCase() === 'HIGH').length,
    MED:  alerts.filter((a) => (a.severity_label || '').toUpperCase() === 'MED').length,
    LOW:  alerts.filter((a) => (a.severity_label || '').toUpperCase() === 'LOW').length,
  }
  const maxStreak = alerts.reduce((m, x) => Math.max(m, Number(x.streak || 0)), 0)
  const latestSnapshot = recent5Market[0] || snapshots[snapshots.length - 1] || null
  const vixLast = Array.isArray(marketTape.items)
    ? (marketTape.items.find((i) => i?.symbol === 'VIX')?.last ?? null)
    : null
  const alertsEvidence: AlertEvidenceContext = {
    gateScore: latestSnapshot?.gate_score ?? null,
    phase: latestSnapshot?.market_phase ?? null,
    riskLabel: latestSnapshot?.risk_level ?? null,
    riskScore: typeof healthSnapshot.risk?.var95_1d === 'number' ? Math.abs(healthSnapshot.risk.var95_1d) * 10 : null,
    vix: typeof vixLast === 'number' ? vixLast : null,
    qqqDistPct: healthSnapshot.trend?.dist_pct ?? null,
    exposureBand: actionSnapshot.exposure_guidance?.exposure_band ?? null,
    asOfDate: actionSnapshot.data_date || healthSnapshot.data_date || latestSnapshot?.date || null,
  }

  // Briefing preview
  const briefingAction   = pickText(dailyBriefing.stance?.action) || null
  const briefingBand     = pickText(dailyBriefing.stance?.exposure_band) || null
  const hcWarnings = healthcheck.warnings || []
  const primaryActionBand = actionSnapshot.exposure_guidance?.exposure_band || briefingBand || null
  const actionBand = primaryActionBand || '60-90%'
  const primaryActionLabel = actionSnapshot.exposure_guidance?.action_label || briefingAction || null
  const distPct = typeof healthSnapshot.trend?.dist_pct === 'number' ? healthSnapshot.trend.dist_pct : null
  const riskProxy = typeof healthSnapshot.risk?.var95_1d === 'number' ? Math.abs(healthSnapshot.risk.var95_1d) * 10 : null
  const var95_1d = typeof healthSnapshot.risk?.var95_1d === 'number' ? healthSnapshot.risk.var95_1d : null
  const cvar95_1d = typeof healthSnapshot.risk?.cvar95_1d === 'number' ? healthSnapshot.risk.cvar95_1d : null
  const volRatio = typeof healthSnapshot.risk?.vol_ratio === 'number' ? healthSnapshot.risk.vol_ratio : null
  const regimeNow = latestSnapshot?.market_phase || (distPct != null ? (distPct > 3 ? 'BULL' : distPct < -3 ? 'DEFENSIVE' : 'TRANSITION') : 'NEUTRAL')
  const vixChg = Array.isArray(marketTape.items)
    ? (marketTape.items.find((i) => i?.symbol === 'VIX')?.chg_pct ?? null)
    : null
  const strategyHeadline = primaryActionLabel === 'Increase'
    ? 'Accumulate'
    : primaryActionLabel === 'Decrease'
    ? 'Defend'
    : 'Rebalance'
  const strategySub = primaryActionLabel === 'Increase'
    ? { ko: 'Î≥Ä?ôÏÑ± ?ïÏ∂ï Íµ¨Í∞Ñ Î∂ÑÌï† ?ïÎ?', en: 'Scale into volatility compression' }
    : primaryActionLabel === 'Decrease'
    ? { ko: 'Î¶¨Ïä§??Î∞©Ïñ¥ ?∞ÏÑ†', en: 'Prioritize capital defense' }
    : { ko: 'Î¶¨Î∞∏?∞Ïã± Ï§ëÏã¨ ?Ä??, en: 'Rebalance and wait for confirmation' }
  const actionProgress = primaryActionBand?.match(/(\d+)\D+(\d+)/)
    ? Math.min(100, Math.max(8, Math.round((Number(primaryActionBand.match(/(\d+)\D+(\d+)/)?.[2] || 0)))))
    : 55
  const pulseSymbols = ['SPY', 'QQQ', 'IWM', 'DIA', 'VIX']
  const pulseTiles = pulseSymbols
    .map((sym) => Array.isArray(marketTape.items) ? marketTape.items.find((i) => i?.symbol === sym) : null)
    .filter((x): x is TapeItem => !!x)
  const actionLineKo = primaryActionLabel === 'Increase'
    ? `?∏Ï∂ú??${actionBand} Íµ¨Í∞Ñ?ºÎ°ú ?®Í≥Ñ?ÅÏúºÎ°??ïÎ?`
    : primaryActionLabel === 'Decrease'
    ? '?ÑÍ∏à ?ïÎ≥¥ ?∞ÏÑ†, ?†Í∑ú ?àÎ≤ÑÎ¶¨Ï? ÏßÑÏûÖ?Ä Î≥¥Î•ò'
    : 'Í¥ÄÎß?Î¶¨Î∞∏?∞Ïã± Ï§ëÏã¨?ºÎ°ú ?Ä?? Í∏âÎì± Ï∂îÍ≤©?Ä Î≥¥Î•ò'
  const actionLineEn = primaryActionLabel === 'Increase'
    ? `Scale exposure gradually toward ${actionBand}`
    : primaryActionLabel === 'Decrease'
    ? 'Prioritize cash buffer and pause new leveraged entries'
    : 'Stay patient and rebalance; avoid chasing sharp moves'
  const sectorLabelMap: Record<string, string> = {
    XLK: 'Tech',
    XLY: 'Cons Disc',
    XLC: 'Comm Svcs',
    XLF: 'Fin',
    XLI: 'Ind',
    XLE: 'Energy',
    XLV: 'Hlth Care',
    XLU: 'Utils',
    XLP: 'Cons Def',
    XLB: 'Materials',
    XLRE: 'RE',
  }
  const sectorPerfRows = Array.isArray(sectorRotation.sector_perf) ? sectorRotation.sector_perf : []
  const sectorBars = sectorPerfRows
    .map((s) => ({
      key: sectorLabelMap[String(s.symbol || '')] || String(s.symbol || s.name || 'Sector'),
      v: typeof s.change_1w === 'number' ? s.change_1w : (typeof s.change_1d === 'number' ? s.change_1d : null),
    }))
    .filter((x): x is { key: string; v: number } => typeof x.v === 'number' && Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v)
    .slice(0, 11)
  const liquidityState = gateColor(latestSnapshot?.gate_score ?? null) === C.bull ? 'High' : gateColor(latestSnapshot?.gate_score ?? null) === C.transition ? 'Mid' : 'Tight'
  const breadthState = (latestSnapshot?.gate_score ?? 0) >= 60 ? 'Strong' : (latestSnapshot?.gate_score ?? 0) >= 40 ? 'Neutral' : 'Weak'
  const momentumState = distPct == null ? 'Flat' : distPct >= 0 ? 'Pos' : 'Neg'
  const shockProb30d = typeof riskProxy === 'number' ? Math.max(4, Math.min(95, Math.round(riskProxy * 0.55))) : null
  const defensiveTriggerOn = (latestSnapshot?.risk_level || '').toUpperCase() === 'HIGH' || (riskProxy ?? 0) >= 75
  const phaseTransitionText =
    regimeNow === 'BULL' ? 'Accumulation'
    : regimeNow === 'BEAR' || regimeNow === 'DEFENSIVE' ? 'Defense'
    : regimeNow === 'TRANSITION' ? 'Transition'
    : 'Neutral'
  const tailSigma = typeof riskProxy === 'number' ? Math.max(0.6, Math.min(6.2, riskProxy / 9.2)) : null
  const tailSkewLabel = (riskProxy ?? 0) >= 75 ? 'Elevated Skew' : (riskProxy ?? 0) >= 45 ? 'Moderate Skew' : 'Benign Skew'
  const tqqqScore = Math.max(10, Math.min(95, Math.round((distPct ?? 1.8) * 9 + 55 - (riskProxy ?? 25) * 0.35)))
  const soxlScore = Math.max(10, Math.min(95, Math.round((distPct ?? 0.8) * 7 + 52 - (riskProxy ?? 25) * 0.25)))
  const tqqqMode = tqqqScore >= 65 ? { badge: 'CLEAR', color: '#22C55E', line: 'Bullish Trend', lineKo: '?ÅÏäπ Ï∂îÏÑ∏ ?∞ÏúÑ' } : tqqqScore >= 45 ? { badge: 'WATCH', color: '#FACC15', line: 'Mixed Trend', lineKo: '?ºÏ°∞ Ï∂îÏÑ∏' } : { badge: 'RISK', color: '#F97316', line: 'Gap Risk', lineKo: 'Í∞?Î¶¨Ïä§??Ï£ºÏùò' }
  const soxlMode = soxlScore >= 62 ? { badge: 'CLEAR', color: '#22C55E', line: 'Strong Beta', lineKo: 'Í≥†Î≤†?Ä ?∞Ìò∏' } : soxlScore >= 42 ? { badge: 'CHOPPY', color: '#FACC15', line: 'High Beta', lineKo: 'Î≥Ä?ôÏÑ± ?ïÎ?' } : { badge: 'RISK', color: '#F97316', line: 'Wide Swings', lineKo: 'Í∏âÎì±??Ï£ºÏùò' }
  const weeklyLeverageForecast = [
    { day: 'Monday', level: (riskProxy ?? 0) > 70 ? 'Medium Risk' : 'Low Risk' },
    { day: 'Tuesday', level: (riskProxy ?? 0) > 65 ? 'Medium Risk' : 'Low Risk' },
    { day: 'Wednesday', level: 'Medium (Fed Minutes)' },
    { day: 'Thursday', level: (riskProxy ?? 0) > 75 ? 'High Risk' : 'Low to Medium' },
    { day: 'Friday', level: (riskProxy ?? 0) > 60 ? 'Medium Risk' : 'Low Risk' },
  ]
  const retirementAllocation = (riskProxy ?? 0) >= 70 ? { eq: 65, safe: 35 } : (riskProxy ?? 0) >= 45 ? { eq: 75, safe: 25 } : { eq: 80, safe: 20 }
  const withdrawalSafe = (riskProxy ?? 0) < 70 && String(regimeNow || '').toUpperCase() !== 'BEAR'
  const riskToken = riskLevelToToken({ riskScore: riskProxy, riskLevel: latestSnapshot?.risk_level ?? null })
  const riskAccents = getRiskSecondaryAccents({
    vixChange1d: vixChg,
    volRatio,
    cvar95: cvar95_1d,
    tailSigma,
    shockProb30d,
  })
  const riskSummaryPills = [
    { label: 'Shock% / ?ºÌÅ¨', value: shockProb30d != null ? `${shockProb30d}%` : '--', tone: accentColorFromLevel(riskAccents.shockStress) },
    { label: 'Defensive / Î∞©Ïñ¥', value: defensiveTriggerOn ? 'ON' : 'OFF', tone: defensiveTriggerOn ? riskToken.colorVar : 'var(--risk-accent-cooling)' },
    { label: 'Phase / Íµ?©¥', value: phaseTransitionText, tone: riskToken.colorVar },
    { label: 'Tail Sigma / ?åÏùº', value: tailSigma != null ? tailSigma.toFixed(1) : '--', tone: accentColorFromLevel(riskAccents.tailStress) },
  ]

  const volState = volRatio == null && vixChg == null
    ? { ko: '?ïÏù∏ ?ÑÏöî', en: 'Needs verification', tone: 'neutral' as const }
    : (volRatio != null && volRatio < 0.95) || (typeof vixChg === 'number' && vixChg < 2)
    ? { ko: '?àÏ†ï/?ïÏ∂ï', en: 'compressing', tone: 'green' as const }
    : (volRatio != null && volRatio > 1.1) || (typeof vixChg === 'number' && vixChg > 5)
    ? { ko: '?ïÎ?/Í≤ΩÍ≥Ñ', en: 'expanding', tone: 'amber' as const }
    : { ko: '?ºÌï©', en: 'mixed', tone: 'blue' as const }
  const liqStateMap = liquidityState === 'High'
    ? { ko: '?ëÌò∏', en: 'healthy', tone: 'green' as const }
    : liquidityState === 'Mid'
    ? { ko: 'Î≥¥ÌÜµ', en: 'mixed', tone: 'amber' as const }
    : { ko: '?Ä?¥Ìä∏', en: 'tight', tone: 'red' as const }
  const breadthStateMap = breadthState === 'Strong'
    ? { ko: 'Í∞ïÌï®', en: 'strong', tone: 'green' as const }
    : breadthState === 'Neutral'
    ? { ko: '?ºÌï©', en: 'mixed', tone: 'amber' as const }
    : { ko: '?ΩÌï®', en: 'weak', tone: 'red' as const }
  const ratesState =
    typeof latestSnapshot?.gate_delta_5d === 'number'
      ? latestSnapshot.gate_delta_5d > 3
        ? { en: 'easing', tone: 'green' as const }
        : latestSnapshot.gate_delta_5d < -3
        ? { en: 'tight', tone: 'red' as const }
        : { en: 'steady', tone: 'blue' as const }
      : { en: 'steady', tone: 'neutral' as const }
  const macroState: MacroStateChip[] = [
    { label: 'Liquidity', value: liqStateMap.en, tone: liqStateMap.tone },
    { label: 'Rates', value: ratesState.en, tone: ratesState.tone },
    { label: 'Volatility', value: volState.en, tone: volState.tone },
    { label: 'Breadth', value: breadthStateMap.en, tone: breadthStateMap.tone },
    {
      label: 'Trend',
      value: momentumState === 'Pos' ? 'up' : momentumState === 'Neg' ? 'down' : 'flat',
      tone: momentumState === 'Pos' ? 'green' : momentumState === 'Neg' ? 'red' : 'blue',
    },
  ]
  const phaseCycle =
    regimeNow === 'BULL'
      ? 'EXPAN'
      : regimeNow === 'BEAR' || regimeNow === 'DEFENSIVE'
      ? 'CONTR'
      : regimeNow === 'TRANSITION'
      ? 'SLOW'
      : 'RECOV'
  const actionGuidance = {
    label: strategyHeadline,
    band: actionBand,
    subKo: strategySub.ko,
    subEn: strategySub.en,
    progress: actionProgress,
  }
  const ssot = {
    globalRiskToken: riskToken,
    marketRegime: String(regimeNow || 'TRANSITION'),
    phase: phaseCycle,
    macroState,
    actionGuidance,
  }

  const riskHighNarrative = (riskProxy ?? 0) >= 70 || String(regimeNow).toUpperCase() === 'BEAR' || String(regimeNow).toUpperCase() === 'DEFENSIVE'
  const mixedNarrative = !riskHighNarrative && ((riskProxy ?? 0) >= 45 || latestSnapshot?.phase_shift_flag === 1)
  const narrativeKo = riskHighNarrative
    ? [
        'Î¶¨Ïä§???†Ìò∏Í∞Ä ?∞ÏÑ†?òÎäî Íµ¨Í∞Ñ?¥Î©∞, ?®Í∏∞ Î≥Ä???ïÎ? Í∞Ä?•ÏÑ±???ºÎëê?????ÑÏöîÍ∞Ä ?àÏäµ?àÎã§.',
        'Î≥Ä?ôÏÑ± ?ÅÏäπÍ≥??ΩÌïú ?¥Î? Ï≤¥Î†•???®Íªò ?òÌ??òÎ©¥ ?òÏùµ Ï∂îÍµ¨Î≥¥Îã§ ?êÏã§ Í¥ÄÎ¶¨Í? ??Ï§ëÏöî?¥Ïßë?àÎã§.',
        '?ïÏù∏ ?†Ìò∏Í∞Ä ?ìÏù¥Í∏??ÑÍπåÏßÄ???†Í∑ú ?àÎ≤ÑÎ¶¨Ï? ÏßÑÏûÖ??Î≥¥Ïàò?ÅÏúºÎ°?Î≥¥Îäî ?∏Ïù¥ ?©Î¶¨?ÅÏûÖ?àÎã§.',
      ]
    : mixedNarrative
    ? [
        '?ÑÏû¨ Íµ?©¥?Ä Î∞©Ìñ•?±Ïù¥ ?ÑÏ†Ñ???ïÎ¶¨?òÏ? ?äÏ? ?ºÌï© ?†Ìò∏ Íµ¨Í∞Ñ?ÖÎãà??',
        'Î≥Ä?ôÏÑ±Í≥?Î¶¨Ïä§??ÏßÄ?úÎäî Í¥ÄÎ¶?Í∞Ä?•ÌïòÏßÄÎß? ?¨Ï????çÎèÑ Ï°∞Ï†à???ÑÏöî???òÏ??ÖÎãà??',
        'Î∏åÎ†à?úÏä§?Ä Í≤åÏù¥??Ï°∞Í±¥??Í∞úÏÑ†?òÍ∏∞ ?ÑÍπåÏßÄ??Î∂ÑÌï† ?ëÍ∑º?????†Î¶¨?©Îãà??',
      ]
    : [
        'Ï∂îÏÑ∏???ÑÏßÅ ?∞Ìò∏?ÅÏù¥ÏßÄÎß? ?¥Î? ?ïÏÇ∞??Breadth)???ΩÌïú ?∏Ïùº ???àÏäµ?àÎã§.',
        'Î≥Ä?ôÏÑ±?Ä ?ïÏû•Î≥¥Îã§???àÏ†ï Ï™ΩÏóê Í∞ÄÍπåÏõå ?êÏßÑ??Î¶¨Ïä§???®Ïù¥ Í∞Ä?•Ìïú Íµ¨Í∞Ñ?ÖÎãà??',
        '?§Îßå ?†Îèô?±Ïù¥ ?Ä?¥Ìä∏?òÎ©¥ Ï∂îÍ≤© Îß§ÏàòÎ≥¥Îã§ Î∂ÑÌï† ?ïÎ?Í∞Ä ???©Î¶¨?ÅÏûÖ?àÎã§.',
      ]
  const narrativeEn = riskHighNarrative
    ? [
        'Risk signals are currently dominant, with a higher chance of short-term volatility expansion.',
        'When volatility rises alongside weak internal breadth, drawdown control matters more than return pursuit.',
        'Until confirmation improves, new leveraged entries should be evaluated conservatively.',
      ]
    : mixedNarrative
    ? [
        'The current regime is a mixed-signal zone without full directional confirmation.',
        'Volatility and risk metrics remain manageable, but position speed should stay measured.',
        'A gradual approach is preferred until breadth and gate conditions improve.',
      ]
    : [
        'Markets are holding a constructive uptrend, but internal breadth remains soft.',
        'Volatility is stabilizing rather than expanding, which supports gradual risk-on.',
        'Liquidity is still tight, so we prefer scaling in rather than chasing.',
      ]
  const regimeKoMap: Record<string, string> = {
    BULL: '?ÅÏäπ',
    BEAR: '?òÎùΩ',
    DEFENSIVE: 'Î∞©Ïñ¥',
    TRANSITION: '?ÑÌôò',
    NEUTRAL: 'Ï§ëÎ¶Ω',
  }
  const phaseKoMap: Record<string, string> = {
    RECOV: '?åÎ≥µ',
    EXPAN: '?ïÏû•',
    SLOW: '?îÌôî',
    CONTR: '?òÏ∂ï',
  }
  const actionKoMap: Record<string, string> = {
    Accumulate: 'Ï∂ïÏ†Å',
    Defend: 'Î∞©Ïñ¥',
    Rebalance: 'Î¶¨Î∞∏?∞Ïä§',
  }
  const regimeKo = regimeKoMap[String(regimeNow || 'TRANSITION')] || String(regimeNow || 'TRANSITION')
  const phaseKo = phaseKoMap[phaseCycle] || phaseCycle
  const actionLabelKo = actionKoMap[strategyHeadline] || strategyHeadline
  const narrativeActionKo = `?§Îäò???°ÏÖò: ${actionLineKo}`
  const narrativeActionEn = `Action: ${actionLineEn}`
  const briefLinesKo = [narrativeKo[0], narrativeKo[1], narrativeActionKo]
  const briefLinesEn = [narrativeEn[0], narrativeEn[1], narrativeActionEn]
  const snapshotSummaryKo = `${regimeKo} / ${phaseKo} ¬∑ ${actionLabelKo} ¬∑ Î¶¨Ïä§??${ssot.globalRiskToken.key}`.slice(0, 90)
  const snapshotSummaryEn = `${ssot.marketRegime} / ${ssot.phase} ¬∑ ${ssot.actionGuidance.label} bias ¬∑ Risk ${ssot.globalRiskToken.key}`.slice(0, 90)

  const flowSummary = (smartMoney as any)?.smart_flow || {}
  const flowRegime: string = flowSummary.regime || 'Neutral'
  const flowRegimeFit =
    flowRegime === 'Expansion' ? 'High' :
    flowRegime === 'Neutral' ? 'Medium' :
    flowRegime === 'Contraction' ? 'Low' :
    'Very Low'
  const flowShockProb = typeof flowSummary.shock_prob_30d === 'number' ? flowSummary.shock_prob_30d : null
  const flowTailSigma = typeof flowSummary.tail_sigma === 'number' ? flowSummary.tail_sigma : null
  const flowVolRisk =
    (flowShockProb != null && flowShockProb > 0.20) || (flowTailSigma != null && flowTailSigma >= 2.5)
      ? 'High'
      : (flowTailSigma != null && flowTailSigma >= 2.0)
      ? 'Medium'
      : 'Low'
  const environmentFit =
    flowRegimeFit === 'Low' || flowRegimeFit === 'Very Low' || flowVolRisk === 'High'
      ? 'Low'
      : flowRegimeFit === 'High' && flowVolRisk !== 'High'
      ? 'High'
      : 'Medium'

  const structureConfidence =
    environmentFit === 'High' && breadthState === 'Strong' && (flowSummary.acceleration_state === 'Expanding' || flowSummary.acceleration_state == null)
      ? 'High'
      : environmentFit === 'Low' || breadthState === 'Weak'
      ? 'Low'
      : 'Medium'
  const confidenceSubline =
    structureConfidence === 'High'
      ? 'Leaders Confirmed ¬∑ Breadth Stable ¬∑ Vol Controlled'
      : structureConfidence === 'Low'
      ? 'Leaders Thin ¬∑ Breadth Weak ¬∑ Vol Sensitive'
      : 'Leaders Mixed ¬∑ Breadth Mixed ¬∑ Vol Balanced'
  const narrativeChips = [
    { ko: `Î≥Ä?ôÏÑ±: ${volState.ko}`, en: `Vol: ${volState.en}`, tone: volState.tone },
    { ko: `?†Îèô?? ${liqStateMap.ko}`, en: `Liquidity: ${liqStateMap.en}`, tone: liqStateMap.tone },
    { ko: `?úÏû• ?ïÏÇ∞: ${breadthStateMap.ko}`, en: `Breadth: ${breadthStateMap.en}`, tone: breadthStateMap.tone },
  ]
  const narrativeExplainRows = [
    { keyLabel: 'risk_trend / ?????', value: latestSnapshot?.risk_trend || '?? },
    { keyLabel: 'gate_score / ???', value: latestSnapshot?.gate_score != null ? latestSnapshot.gate_score.toFixed(1) : '?? },
    { keyLabel: 'phase_shift_flag / ?????', value: latestSnapshot?.phase_shift_flag != null ? String(latestSnapshot.phase_shift_flag) : '?? },
    { keyLabel: 'VaR95 (1d) / VaR95', value: var95_1d != null ? `${var95_1d.toFixed(2)}%` : '?? },
    { keyLabel: 'CVaR95 (1d) / CVaR95', value: cvar95_1d != null ? `${cvar95_1d.toFixed(2)}%` : '?? },
    { keyLabel: 'VolRatio / ???', value: volRatio != null ? volRatio.toFixed(2) : '?? },
    { keyLabel: 'VIX tone / VIX ?', value: riskAccents.vixPulse || 'neutral' },
  ]

  // Healthcheck indicator
  const hcHasData  = typeof healthcheck.ok === 'boolean'
  const hcOk       = healthcheck.ok === true
  const hcColor    = !hcHasData ? C.neutral : hcOk ? (hcWarnings.length ? C.transition : C.bull) : C.defensive
  const hcTitle    = !hcHasData
    ? 'healthcheck.json missing'
    : hcOk && !hcWarnings.length
    ? 'Cache OK'
    : `${hcOk ? 'Cache OK (warnings)' : 'Cache FAILED'} ??${[...healthcheck.missing_files || [], ...healthcheck.schema_errors || []].join(', ') || hcWarnings.join(', ')}`

  return (
    // Dashboard narrative: Market State ??Action ??Evidence ??Risk Engine ??Hot ??History
    <div
      className="mf-dashboard-root px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:pb-12"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', overflowX: 'hidden' }}
    >
      <section
        style={{
          background: '#06090D',
          border: '1px solid rgba(148,163,184,0.10)',
          borderRadius: 16,
          padding: '0.7rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontFamily: 'var(--font-ui-sans)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#D7FF37', color: '#0b0f14', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.78rem', boxShadow: '0 0 0 1px rgba(215,255,55,0.25)' }}>C</div>
            <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1 }}>Capital OS</div>
            <div style={{ color: '#D8E6F5', fontSize: '0.74rem', letterSpacing: '0.08em', fontWeight: 700 }}>INSTITUTIONAL GRADE</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <LanguageModeToggle />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {[
              { ko: '?úÏû• ?ÅÌÉú', en: 'Market State', active: true },
              { ko: 'Î¶¨Ïä§???îÏßÑ', en: 'Risk Engine' },
              { ko: '?Ä??, en: 'Retirement' },
              { ko: '?àÎ≤ÑÎ¶¨Ï?', en: 'Leverage' },
            ].map((tab) => (
              <span
                key={tab.en}
                style={{
                  borderRadius: 999,
                  border: tab.active ? '1px solid rgba(215,255,55,0.65)' : '1px solid rgba(255,255,255,0.07)',
                  background: tab.active ? '#D7FF37' : 'rgba(255,255,255,0.02)',
                  padding: '4px 11px',
                  color: tab.active ? '#0B0F14' : '#D8E6F5',
                  ['--text-secondary' as any]: tab.active ? '#0B0F14' : '#D8E6F5',
                }}
              >
                <BilLabel ko={tab.ko} en={tab.en} variant="micro" />
              </span>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
              <div style={{ width: 280, maxWidth: '40vw', height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '0 12px', display: 'flex', alignItems: 'center', color: '#D8E6F5', fontSize: '0.9rem' }}>
                <span style={{ marginRight: 8 }}>??/span>
                <span>Search ticker, risk factor...</span>
              </div>
              {['??, '??].map((ico, idx) => (
                <span key={idx} style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', display: 'grid', placeItems: 'center', color: '#D8E6F5', fontSize: '0.9rem' }}>{ico}</span>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                  <span style={{ color: '#F8FAFC', fontWeight: 800, fontSize: '0.95rem' }}>Alexander V.</span>
                  <span style={{ color: '#D7FF37', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.06em' }}>PRO ACCOUNT</span>
                </div>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: 'linear-gradient(135deg,#38bdf8,#f472b6)', display: 'inline-block' }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#F8FAFC', fontSize: 'clamp(1.9rem, 3vw, 2.35rem)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em' }}>Market State</div>
            <div style={{ color: '#D8E6F5', fontSize: '0.82rem', marginTop: 5 }}>
              <BilLabel ko="?ÑÏû¨ Íµ?©¥ Î∂ÑÏÑùÍ≥??ÑÎûµ ?¨Ï??îÎãù" en="Current Regime Analysis & Strategic Posture" variant="micro" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <AdvancedMetricsDrawer warnings={hcWarnings}>
              <RecentAlertsCard
                alerts={Array.isArray(alerts) ? alerts : []}
                severityCount={severityCount}
                maxStreak={maxStreak}
                evidence={alertsEvidence}
              />
              <MarketHistoryStrip rows={recent5Market} emptyText="No snapshot data ??run pipeline" />
              <RiskPanel />
              <StructurePanel />
            </AdvancedMetricsDrawer>
            <span style={{ borderRadius: 999, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.24)', padding: '2px 8px', color: '#22C55E' }}>
              <BilLabel ko="?§ÏãúÍ∞??∞Ïù¥?? en="LIVE DATA" variant="micro" />
            </span>
            <span style={{ color: '#D8E6F5', fontSize: '0.76rem' }}>
              {actionSnapshot.data_date || healthSnapshot.data_date || latestSnapshot?.date || '??}
            </span>
            <span title={hcTitle} style={{ width: 8, height: 8, borderRadius: 999, background: hcColor, border: '1px solid rgba(255,255,255,0.15)' }} />
          </div>
        </div>

        <TodaySnapshotBar summaryKo={snapshotSummaryKo} summaryEn={snapshotSummaryEn} riskToken={ssot.globalRiskToken} explainRows={narrativeExplainRows} />
        <CrossAssetStripCompact items={Array.isArray(marketTape.items) ? marketTape.items : []} />
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ minWidth: 0, alignItems: 'stretch' }}>
          <AIMarketBrief linesKo={briefLinesKo} linesEn={briefLinesEn} environmentFit={environmentFit} explainRows={narrativeExplainRows} />
          <ActionGuidanceCard
            headline={`${actionLabelKo} / ${ssot.actionGuidance.label}`}
            band={ssot.actionGuidance.band}
            subKo={ssot.actionGuidance.subKo}
            subEn={ssot.actionGuidance.subEn}
            progress={ssot.actionGuidance.progress}
            speedLine={actionLineEn}
          />
        </section>
      </section>

      {false && pulseTiles.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
              <span style={{ width: 4, height: 26, borderRadius: 4, background: '#2563EB' }} />
              <div style={{ color: '#F8FAFC', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>
                Market Pulse
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {['Indices', 'Sectors', 'Commodities'].map((tab, i) => (
                <span
                  key={tab}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    background: i === 0 ? 'rgba(37,99,235,0.10)' : 'rgba(255,255,255,0.02)',
                    color: i === 0 ? '#F8FAFC' : '#D8E6F5',
                    padding: '0.45rem 0.8rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" style={{ minWidth: 0 }}>
            {pulseTiles.map((item) => {
              const chg = typeof item.chg_pct === 'number' ? item.chg_pct : null
              const up = (chg ?? 0) >= 0
              const col = chg == null ? 'var(--text-secondary)' : up ? 'var(--state-bull)' : 'var(--state-defensive)'
              const spark = miniSparkPath(item.spark_1d)
              return (
                <div
                  key={String(item.symbol)}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: '0.55rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#F8FAFC', fontSize: '0.96rem', fontWeight: 800, lineHeight: 1.1 }}>{item.symbol || '??}</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.98rem', fontWeight: 800, lineHeight: 1.05, marginTop: 6 }}>{typeof item.last === 'number' ? item.last.toFixed(2) : '??}</div>
                    {chg != null && (
                      <div style={{ marginTop: 3 }}>
                        <span style={{ color: col, background: `${col}14`, border: `1px solid ${col}22`, borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, padding: '1px 5px', display: 'inline-flex' }}>
                          {fmtPct(chg, 1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ width: 50, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {spark ? (
                      <svg width="50" height="22" viewBox="0 0 42 14" style={{ overflow: 'visible' }}>
                        <polyline points={spark} fill="none" stroke={col as string} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {false && (
      <section className="grid grid-cols-1 xl:grid-cols-[1.02fr_0.98fr] gap-4" style={{ minWidth: 0 }}>
        <section
          style={{
            background: '#070B10',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: '0.95rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 24, borderRadius: 4, background: '#A855F7' }} />
              <div style={{ color: '#F8FAFC', fontSize: '1.65rem', fontWeight: 800, lineHeight: 1 }}>
                Leverage Weather
              </div>
            </div>
            <span style={{ borderRadius: 8, background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.25)', color: '#C084FC', padding: '0.25rem 0.55rem' }}>
              <BilLabel ko="ETF Î≥Ä?ôÏÑ±" en="ETF VOLATILITY" variant="micro" />
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { sym: 'TQQQ', score: tqqqScore, mode: tqqqMode, labelKo: '?ÑÎßù', labelEn: 'Outlook' },
              { sym: 'SOXL', score: soxlScore, mode: soxlMode, labelKo: 'Î≥Ä?ôÏÑ± Î™®Îìú', labelEn: 'Volatility Mode' },
            ].map((m) => (
              <div key={m.sym} style={{ background: '#0E131A', border: '1px solid rgba(59,130,246,0.14)', borderRadius: 12, padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ color: '#F8FAFC', fontSize: '1.05rem', fontWeight: 900 }}>{m.sym}</div>
                  <span style={{ borderRadius: 6, background: `${m.mode.color}18`, border: `1px solid ${m.mode.color}30`, color: m.mode.color, padding: '0.2rem 0.5rem', fontWeight: 800, fontSize: '0.78rem' }}>{m.mode.badge}</span>
                </div>
                <div style={{ color: '#D8E6F5' }}>
                  <BilLabel ko={m.labelKo} en={m.labelEn} variant="micro" />
                </div>
                <div style={{ color: m.mode.color, fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.15 }}>
                  <BilLabel ko={m.mode.lineKo} en={m.mode.line} variant="label" />
                </div>
                <div style={{ marginTop: 'auto', height: 6, borderRadius: 999, background: 'rgba(59,130,246,0.12)', overflow: 'hidden' }}>
                  <div style={{ width: `${m.score}%`, height: '100%', background: m.mode.color }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: '#D8E6F5', marginTop: 4 }}>
            <BilLabel ko="5???àÎ≤ÑÎ¶¨Ï? Î¶¨Ïä§???¨Ï∫ê?§Ìä∏" en="5-Day Risk Forecast" variant="micro" />
          </div>
          <div style={{ background: '#070B10', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.8rem 0.9rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weeklyLeverageForecast.map((row) => {
                const isHigh = /High/.test(row.level)
                const isMed = /Medium/.test(row.level)
                const col = isHigh ? '#F97316' : isMed ? '#FACC15' : '#22C55E'
                return (
                  <div key={row.day} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                    <div style={{ color: '#D8E6F5', fontSize: '1.02rem', lineHeight: 1.2 }}>{row.day}</div>
                    <div style={{ color: col, fontWeight: 800, fontSize: '0.95rem' }}>{row.level}</div>
                  </div>
                )
              })}
            </div>
          </div>

        </section>
        <section
          style={{
            background: '#070B10',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: '0.95rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 24, borderRadius: 4, background: '#D7FF37' }} />
              <div style={{ color: '#F8FAFC', fontSize: '1.65rem', fontWeight: 800, lineHeight: 1 }}>
                Retirement Lens
              </div>
            </div>
            <span style={{ borderRadius: 8, background: 'rgba(215,255,55,0.10)', border: '1px solid rgba(215,255,55,0.25)', color: '#D7FF37', padding: '0.25rem 0.55rem' }}>
              <BilLabel ko="?êÎ≥∏ ?ùÏ°¥" en="CAPITAL SURVIVAL" variant="micro" />
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 6 }}>
            {[
              { ko: '40?Ä Î™®Îìú', en: '40s Mode', active: true },
              { ko: '50?Ä Î™®Îìú', en: '50s Mode' },
              { ko: '60+ Î≥¥Ìò∏', en: '60+ Protection' },
            ].map((tab) => (
              <span key={tab.en} style={{ borderRadius: 10, padding: '0.45rem 0.8rem', background: tab.active ? '#D7FF37' : 'transparent', color: tab.active ? '#0B0F14' : '#E2E8F0', border: tab.active ? '1px solid rgba(215,255,55,0.5)' : '1px solid transparent' }}>
                <BilLabel ko={tab.ko} en={tab.en} variant="micro" />
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-4" style={{ minWidth: 0 }}>
            <div style={{ background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: '#D8E6F5' }}>
                <BilLabel ko="Î™©Ìëú ?êÏÇ∞ Î∞∞Î∂Ñ" en="TARGET ALLOCATION" variant="micro" />
              </div>
              <div style={{ color: '#F8FAFC', fontSize: 'clamp(2.4rem,4vw,3.2rem)', fontWeight: 900, lineHeight: 1 }}>
                {retirementAllocation.eq}/{retirementAllocation.safe}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#D8E6F5', fontSize: '0.92rem' }}>
                    <span>Growth (Equities)</span><span style={{ color: '#F8FAFC', fontWeight: 700 }}>{retirementAllocation.eq}%</span>
                  </div>
                  <div style={{ marginTop: 5, height: 5, borderRadius: 999, background: 'rgba(59,130,246,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${retirementAllocation.eq}%`, height: '100%', background: '#3B82F6' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#D8E6F5', fontSize: '0.92rem' }}>
                    <span>Preservation (Bonds/Cash)</span><span style={{ color: '#F8FAFC', fontWeight: 700 }}>{retirementAllocation.safe}%</span>
                  </div>
                  <div style={{ marginTop: 5, height: 5, borderRadius: 999, background: 'rgba(215,255,55,0.09)', overflow: 'hidden' }}>
                    <div style={{ width: `${retirementAllocation.safe}%`, height: '100%', background: '#D7FF37' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#07110A', border: `1px solid ${withdrawalSafe ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.30)'}`, borderRadius: 12, padding: '0.95rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
              <div style={{ width: 62, height: 62, borderRadius: 999, background: withdrawalSafe ? '#22C55E' : '#F59E0B', color: '#0B0F14', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '1.8rem' }}>
                {withdrawalSafe ? '?? : '!'}
              </div>
              <div style={{ color: '#F8FAFC', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.15 }}>
                <BilLabel ko={withdrawalSafe ? '?∏Ï∂ú ?àÏ†ï Íµ¨Í∞Ñ' : 'Î∞©Ïñ¥ ?êÍ? Íµ¨Í∞Ñ'} en={withdrawalSafe ? 'Withdrawal Safe' : 'Review Withdrawal Risk'} variant="label" />
              </div>
              <div style={{ color: '#D8E6F5', lineHeight: 1.45 }}>
                <BilLabel
                  ko={withdrawalSafe ? '?ÑÏû¨ ?úÏû• Ï°∞Í±¥?êÏÑú??4% Î£??∏Ï∂ú ?†Ï? Í∞Ä?•ÏÑ±???íÏäµ?àÎã§.' : '?ÑÍ∏à ÎπÑÏ§ëÍ≥??∏Ï∂ú ?çÎèÑÎ•??¨Ï†êÍ≤Ä???êÎ≥∏ ?ºÏÜê ?ÑÌóò??Ï§ÑÏù¥?∏Ïöî.'}
                  en={withdrawalSafe ? 'Current market conditions support 4% rule withdrawals with lower capital erosion risk.' : 'Recheck cash weight and withdrawal pace to reduce capital erosion risk.'}
                  variant="micro"
                />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginTop: 2 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#F8FAFC', fontSize: '1.05rem', fontWeight: 800 }}>
              Action Plan for 40s
            </div>
            {[
              'Maximize equity exposure during current expansion phase.',
              'Rotate from defensive sectors to cyclical growth.',
            ].map((line) => (
              <div key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 14, height: 14, marginTop: 3, borderRadius: 999, background: '#D7FF37', color: '#0B0F14', display: 'grid', placeItems: 'center', fontSize: '0.6rem', fontWeight: 900 }}>??/span>
                <div style={{ color: '#E5EEF8', fontSize: '0.98rem', lineHeight: 1.35 }}>{line}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
      )}

      <details
        style={{
          background: '#070B10',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <summary
          style={{
            listStyle: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ width: 4, height: 24, borderRadius: 4, background: '#2563EB' }} />
          <div style={{ color: '#F8FAFC' }}>
            <BilLabel ko="ÎßàÏºì ?§Ìä∏??≤ò" en="Market Structure" variant="label" />
          </div>
          <span style={{ color: '#D8E6F5', fontSize: '0.72rem' }}>Í∑ºÍ±∞ ?ÑÏö© / Evidence only</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Liquidity', value: liquidityState },
              { label: 'Breadth', value: breadthState },
              { label: 'Momentum', value: momentumState },
              { label: 'Gate', value: latestSnapshot?.gate_score != null ? latestSnapshot.gate_score.toFixed(0) : '--' },
            ].map((chip) => (
              <span key={chip.label} style={{ borderRadius: 999, border: '1px solid rgba(148,163,184,0.24)', background: 'rgba(255,255,255,0.02)', color: '#D8E6F5', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                {chip.label}: {chip.value}
              </span>
            ))}
          </span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-4" style={{ minWidth: 0 }}>
            <div style={{ background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
              {[
                { key: 'LIQUIDITY', val: liquidityState, tone: '#60A5FA' },
                { key: 'BREADTH', val: breadthState, tone: '#C084FC' },
                { key: 'MOMENTUM', val: momentumState, tone: '#FB923C' },
                { key: 'GATE', val: latestSnapshot?.gate_score != null ? latestSnapshot.gate_score.toFixed(0) : '--', tone: gateColor(latestSnapshot?.gate_score ?? null) },
              ].map((m) => (
                <div key={m.key} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem' }}>
                  <div style={{ color: '#D8E6F5', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{m.key}</div>
                  <div style={{ marginTop: 6, color: '#F8FAFC', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.15 }}>{m.val}</div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${m.key === 'GATE' ? Math.max(8, Math.min(100, Math.round(latestSnapshot?.gate_score ?? 35))) : m.key === 'MOMENTUM' ? Math.max(10, Math.min(100, Math.round(((distPct ?? 0) + 10) * 5))) : 70}%`, height: '100%', background: m.tone as string }} />
                  </div>
                </div>
              ))}
              <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: '#D8E6F5', fontSize: '0.88rem', letterSpacing: '0.04em' }}>STRUCTURE CONFIDENCE</div>
                  <span
                    title="Structure Confidence???úÏû• ?àÏßê, Î≥Ä?ôÏÑ±, ?ïÏÇ∞ ?ÅÌÉú, Í∑∏Î¶¨Í≥?Î¶¨Îçî ÏßëÎã®???êÎ¶Ñ??Ï¢ÖÌï©?òÏó¨ ?ÑÏû¨ Íµ¨Ï°∞ ?†Î¢∞?ÑÎ? ?òÌ??¥Îäî Ï∞∏Í≥† ÏßÄ?úÏûÖ?àÎã§. Ï¢ÖÎ™© Ï∂îÏ≤ú???ÑÎãå ?òÍ≤Ω ?ÅÌï©?ÑÎ? ?òÎ??©Îãà??"
                    style={{ color: '#94A3B8', fontSize: '0.8rem', cursor: 'help' }}
                  >
                    ?πÔ∏è
                  </span>
                  <div style={{ marginLeft: 'auto', color: '#F8FAFC', fontSize: '0.95rem', fontWeight: 800 }}>{structureConfidence}</div>
                </div>
                <div style={{ marginTop: 6, color: '#94A3B8', fontSize: '0.78rem' }}>
                  {confidenceSubline}
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ listStyle: 'none', cursor: 'pointer', color: '#93C5FD', fontSize: '0.76rem', fontWeight: 700 }}>
                    View Components
                  </summary>
                  <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>
                    <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>Regime</div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.72rem', textAlign: 'right' }}>{flowRegime}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>Vol Risk</div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.72rem', textAlign: 'right' }}>{flowVolRisk}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>Breadth</div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.72rem', textAlign: 'right' }}>{breadthState}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>Leader Expansion</div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.72rem', textAlign: 'right' }}>{flowSummary.acceleration_state || 'Flat'}</div>
                  </div>
                </details>
              </div>
            </div>
            <div
              style={{
                background: '#0E131A',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ color: '#D8E6F5' }}>
                <BilLabel ko="?? ???? (1W)" en="SECTOR ROTATION (1W)" variant="micro" />
              </div>
              <div style={{ position: 'relative', height: 210, borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 10px 18px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ position: 'absolute', left: 10, right: 10, top: 20 + i * 44, borderTop: '1px solid rgba(148,163,184,0.14)' }} />
                ))}
                {(() => {
                  const maxAbs = Math.max(1, ...sectorBars.map((b) => Math.abs(b.v)))
                  const zeroY = 104
                  const usable = 72
                  return (
                    <>
                      <div style={{ position: 'absolute', left: 10, right: 10, top: zeroY, borderTop: '1px solid rgba(148,163,184,0.28)' }} />
                      <div style={{ position: 'absolute', inset: '12px 12px 26px 12px', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, sectorBars.length)},1fr)`, gap: 10 }}>
                        {sectorBars.map((b) => {
                          const pos = b.v >= 0
                          const h = Math.max(10, Math.round((Math.abs(b.v) / maxAbs) * usable))
                          return (
                            <div key={b.key} style={{ position: 'relative', minHeight: 0 }}>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  top: pos ? zeroY - h - 28 : zeroY + h - 2,
                                  color: pos ? '#86EFAC' : '#FCA5A5',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1,
                                }}
                              >
                                {fmtPct(b.v, 2)}
                              </div>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '22%',
                                  width: '56%',
                                  top: pos ? zeroY - h - 12 : zeroY - 12,
                                  height: h,
                                  background: pos ? '#4ADE80' : '#F87171',
                                  borderRadius: 2,
                                  opacity: 0.95,
                                }}
                              />
                              <div style={{ position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%) rotate(24deg)', transformOrigin: 'left center', color: '#D8E6F5', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                {b.key}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </details>

      <RiskEngineSummaryBar pills={riskSummaryPills} riskToken={ssot.globalRiskToken} />
      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ color: '#E2E8F0' }}>
          <BilLabel ko="??Ïª®ÌÖç?§Ìä∏" en="My Context" variant="micro" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minWidth: 0 }}>
          <section style={{ ...card({ padding: '0.78rem 0.88rem', background: '#070B10', borderRadius: 12 }), minWidth: 0 }}>
            <div style={{ color: '#D8E6F5' }}>
              <BilLabel ko="?àÎ≤ÑÎ¶¨Ï? ?îÏïΩ" en="Leverage Summary" variant="micro" />
            </div>
            <div style={{ marginTop: 6, color: '#F8FAFC', fontSize: '1rem', fontWeight: 800 }}>
              ?àÎ≤ÑÎ¶¨Ï? / Leverage: {tqqqMode.badge}
            </div>
            <div style={{ marginTop: 4, color: '#D8E6F5', fontSize: '0.78rem' }}>
              Î™®Îìú / Mode: {tqqqMode.line}
            </div>
            <div style={{ marginTop: 8 }}>
              <Link href="/etf" style={{ color: '#7DD3FC', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                ?àÎ≤ÑÎ¶¨Ï? ???¥Í∏∞ / Open ->
              </Link>
            </div>
          </section>
          <section style={{ ...card({ padding: '0.78rem 0.88rem', background: '#070B10', borderRadius: 12 }), minWidth: 0 }}>
            <div style={{ color: '#D8E6F5' }}>
              <BilLabel ko="?Ä???îÏïΩ" en="Retirement Summary" variant="micro" />
            </div>
            <div style={{ marginTop: 6, color: '#F8FAFC', fontSize: '1rem', fontWeight: 800 }}>
              Î∞∞Î∂Ñ / Allocation: {retirementAllocation.eq}/{retirementAllocation.safe}
            </div>
            <div style={{ marginTop: 4, color: '#D8E6F5', fontSize: '0.78rem' }}>
              Ï∂úÍ∏à / Withdrawal: {withdrawalSafe ? 'SAFE' : 'REVIEW'}
            </div>
            <div style={{ marginTop: 8 }}>
              <Link href="/retirement" style={{ color: '#A7F3D0', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                ?Ä???òÏù¥ÏßÄ / Open ->
              </Link>
            </div>
          </section>
        </div>
      </section>
      <section style={{ minWidth: 0 }}>
        <div style={{ color: '#D8E6F5', marginBottom: 8 }}>
          <BilLabel ko="?îÏä§Ïª§Î≤ÑÎ¶? en="Discovery" variant="micro" />
        </div>
        <HotPanel data={overviewHome} />
      </section>

      {/* Disclaimer */}
      <div
        style={{
          borderRadius: 8,
          padding: '0.6rem 1rem',
          fontSize: '0.68rem',
          color: '#D8E6F5',
          borderLeft: '2px solid rgba(217,119,6,0.28)',
          lineHeight: 1.45,
        }}
      >
        <div>?¨Ïûê Ï°∞Ïñ∏???ÑÎãàÎ©?ÍµêÏú° Î™©Ï†Å?ÖÎãà?? Í≥ºÍ±∞ ?±Í≥º??ÎØ∏ÎûòÎ•?Î≥¥Ïû•?òÏ? ?äÏäµ?àÎã§.</div>
        <div>Not financial advice. Educational purposes only. Past performance does not guarantee future results.</div>
        <div>?∏Ï∂ú Í∞Ä?¥Îçò?§Îäî ?ïÎ•†?ÅÏù¥Î©?Í∞úÏù∏??Î¶¨Ïä§???àÏö©?ÑÏ? ?®Íªò ?êÎã®?¥Ïïº ?©Îãà??</div>
        <div>Exposure guidance is probabilistic and must be evaluated against your personal risk tolerance.</div>
      </div>
    </div>
  )
}
