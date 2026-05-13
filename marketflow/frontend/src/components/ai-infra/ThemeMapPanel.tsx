'use client'
// AI 인프라 테마 맵 패널 — 13개 버킷 상태·수익·리스크 통합 시각화 (TM-2 MVP)

import { useEffect, useMemo, useState } from 'react'
import type { AIInfraBucketState, AIInfraStateLabel, AIInfraRiskFlag } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import type { AIInfraBucketEarningsConfirmation, EarningsConfirmationLevel } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { AI_INFRA_BUCKETS } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'
import { AI_INFRA_COMPANY_PURITY, COMPANY_PURITY_LABEL } from '@/lib/ai-infra/aiInfraCompanyPurity'
import { getCompanyEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { ThemeFlowLadder } from './ThemeFlowLadder'

// ── Design tokens ─────────────────────────────────────────────────────────────

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  bg:     '#0F1117',
  bg2:    'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Theme-friendly display labels (TM-1 design spec) ─────────────────────────

const THEME_DISPLAY: Record<AIInfraBucketId, string> = {
  AI_CHIP:           'AI Compute',
  HBM_MEMORY:        'HBM / Memory',
  PACKAGING:         'Foundry / Packaging',
  TEST_EQUIPMENT:    'Test / Inspection',
  PCB_SUBSTRATE:     'PCB / Substrate',
  OPTICAL_NETWORK:   'Optical / Network',
  COOLING:           'Cooling / Thermal',
  POWER_INFRA:       'Power Infrastructure',
  DATA_CENTER_INFRA: 'Data Center Infra',
  CLEANROOM_WATER:   'Cleanroom / Water',
  SPECIALTY_GAS:     'Specialty Gas',
  RAW_MATERIAL:      'Raw Materials',
  GLASS_SUBSTRATE:   'Glass Substrate',
}

// ── Earnings display ──────────────────────────────────────────────────────────

const EARN_COLORS: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED:     '#22c55e',
  PARTIAL:       '#3FB6A8',
  WATCH:         '#fbbf24',
  NOT_CONFIRMED: '#ef4444',
  DATA_LIMITED:  '#8b9098',
  UNKNOWN:       '#555a62',
}

const EARN_SHORT: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED:     'Confirmed',
  PARTIAL:       'Partial',
  WATCH:         'Watch',
  NOT_CONFIRMED: 'Not Confirmed',
  DATA_LIMITED:  'Data Limited',
  UNKNOWN:       '—',
}

const EARN_ABBR: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED:     'CNF',
  PARTIAL:       'PRT',
  WATCH:         'WCH',
  NOT_CONFIRMED: 'N/C',
  DATA_LIMITED:  'D/L',
  UNKNOWN:       '—',
}

// ── Filters ───────────────────────────────────────────────────────────────────

type FilterKey =
  | 'all' | 'leading' | 'improving' | 'watch'
  | 'crowded' | 'confirmed' | 'data_limited'
  | 'story_heavy' | 'indirect' | 'evidence_gap'

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'leading',      label: 'Leading' },
  { key: 'improving',    label: 'Improving' },
  { key: 'evidence_gap', label: 'Evidence Gap' },
  { key: 'data_limited', label: 'Data Limited' },
  { key: 'watch',        label: 'Watch' },
  { key: 'crowded',      label: 'Crowded' },
  { key: 'story_heavy',  label: 'Story Heavy' },
  { key: 'indirect',     label: 'Indirect' },
  { key: 'confirmed',    label: 'Confirmed Evidence' },
]

// ── Tile data ─────────────────────────────────────────────────────────────────

interface TileData {
  bucket_id:        AIInfraBucketId
  display_name:     string
  state_label:      AIInfraStateLabel
  state_score:      number | null
  confidence:       string
  state_reason:     string
  state_drivers:    string[]
  risk_flags:       AIInfraRiskFlag[]
  coverage_ratio:   number
  data_quality:     string
  story_heavy:      boolean
  indirect_exp:     boolean
  comm_risk:        boolean
  rs_1m:            number | null
  rs_3m:            number | null
  rs_6m:            number | null
  earnings_level:    EarningsConfirmationLevel | null
  earnings_score:    number | null
  earnings_coverage: number
  evidence_summary:  string
  caution_summary:   string
  top_symbols:       string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBenchmarkRS(
  m: AIInfraBucketMomentum | null,
  benchmark: string,
): { rs_1m: number | null; rs_3m: number | null; rs_6m: number | null } {
  if (m == null) return { rs_1m: null, rs_3m: null, rs_6m: null }
  const bKey = benchmark === 'QQQ' ? 'vs_qqq' : benchmark === 'SPY' ? 'vs_spy' : 'vs_soxx'
  const rs = m.relative_strength[bKey as keyof typeof m.relative_strength]
  return {
    rs_1m: rs?.one_month    ?? null,
    rs_3m: rs?.three_month  ?? null,
    rs_6m: rs?.six_month    ?? null,
  }
}

function fmt(v: number | null): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function rsColFn(v: number | null): string {
  if (v == null) return V.text3
  if (v > 5)  return V.green
  if (v > 0)  return V.teal
  if (v > -5) return V.amber
  return V.red
}

function covLabel(r: number): string {
  if (r >= 0.75) return 'High'
  if (r >= 0.50) return 'Partial'
  if (r > 0)     return 'Low'
  return '—'
}

function buildTileData(
  states:          AIInfraBucketState[],
  earningsBuckets: AIInfraBucketEarningsConfirmation[],
  momentumBuckets: AIInfraBucketMomentum[],
  benchmark:       string,
): { tiles: TileData[]; duplicateCount: number } {
  // Deduplication: keep first occurrence, log count (amendment)
  const seen = new Set<string>()
  let duplicateCount = 0
  const dedupedStates: AIInfraBucketState[] = []
  for (const s of states) {
    if (seen.has(s.bucket_id)) {
      duplicateCount++
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ThemeMap] Duplicate bucket_id in bucket_states: ${s.bucket_id}`)
      }
    } else {
      seen.add(s.bucket_id)
      dedupedStates.push(s)
    }
  }

  const stateMap    = new Map(dedupedStates.map(s => [s.bucket_id, s]))
  const earningsMap = new Map(earningsBuckets.map(e => [e.bucket_id, e]))
  const momentumMap = new Map(momentumBuckets.map(b => [b.bucket_id, b]))

  const tiles: TileData[] = AI_INFRA_BUCKETS.map(def => {
    const s      = stateMap.get(def.bucket_id)
    const e      = earningsMap.get(def.bucket_id) ?? null
    const m      = momentumMap.get(def.bucket_id) ?? null
    const purity = s?.theme_purity

    return {
      bucket_id:        def.bucket_id,
      display_name:     THEME_DISPLAY[def.bucket_id] ?? s?.display_name ?? def.display_name,
      state_label:      s?.state_label      ?? 'DATA_INSUFFICIENT',
      state_score:      s?.state_score      ?? null,
      confidence:       s?.confidence       ?? 'LOW',
      state_reason:     s?.state_reason     ?? '',
      state_drivers:    s?.state_drivers    ?? [],
      risk_flags:       s?.risk_flags       ?? [],
      coverage_ratio:   s?.source.coverage_ratio ?? 0,
      data_quality:     s?.source.data_quality   ?? 'PLACEHOLDER',
      story_heavy:      purity?.theme_purity === 'STORY_HEAVY' || s?.state_label === 'STORY_ONLY',
      indirect_exp:     purity?.theme_purity === 'INDIRECT_EXPOSURE',
      comm_risk:        purity?.commercialization_risk ?? false,
      ...getBenchmarkRS(m, benchmark),
      earnings_level:    e?.confirmation_level    ?? null,
      earnings_score:    e?.confirmation_score    ?? null,
      earnings_coverage: e?.source.coverage_ratio ?? 0,
      evidence_summary:  e?.evidence_summary      ?? '',
      caution_summary:   e?.caution_summary       ?? '',
      top_symbols:      def.symbols.slice(0, 5),
    }
  })

  return { tiles, duplicateCount }
}

function applyFilter(tile: TileData, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':          return true
    case 'leading':      return tile.state_label === 'LEADING'
    case 'improving':    return tile.state_label === 'EMERGING' || tile.state_label === 'CONFIRMING'
    case 'watch':        return (
                           tile.state_label === 'LAGGING' ||
                           tile.state_label === 'DISTRIBUTION' ||
                           tile.state_label === 'DATA_INSUFFICIENT'
                         )
    case 'crowded':      return tile.state_label === 'CROWDED'
    case 'confirmed':    return tile.earnings_level === 'CONFIRMED' || tile.earnings_level === 'PARTIAL'
    case 'data_limited': return tile.earnings_level === 'DATA_LIMITED' || tile.earnings_level == null
    case 'story_heavy':  return tile.story_heavy
    case 'indirect':     return tile.indirect_exp
    case 'evidence_gap': return (
                           (tile.rs_3m != null && tile.rs_3m > 5) ||
                           (tile.rs_6m != null && tile.rs_6m > 5)
                         ) && tile.earnings_level !== 'CONFIRMED' && tile.earnings_level !== 'PARTIAL'
    default:             return true
  }
}

// ── Filter Chips ──────────────────────────────────────────────────────────────

function FilterChips({ active, onChange }: { active: FilterKey; onChange: (k: FilterKey) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 14 }}>
      {FILTER_OPTIONS.map(({ key, label }) => {
        const on = active === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '4px 10px',
              border: `1px solid ${on ? V.teal : V.border}`,
              borderRadius: 20,
              background: on ? `${V.teal}18` : 'transparent',
              color: on ? V.teal : V.text2,
              fontFamily: V.mono, fontSize: 11, fontWeight: on ? 700 : 400,
              letterSpacing: '0.06em', cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── State Badge ───────────────────────────────────────────────────────────────

function StateBadge({ label }: { label: AIInfraStateLabel }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 11, fontFamily: V.ui, fontWeight: 700, letterSpacing: '0.06em',
      color: '#0f1117', backgroundColor: STATE_COLORS[label],
      whiteSpace: 'nowrap' as const,
    }}>
      {STATE_DISPLAY_LABELS[label]}
    </span>
  )
}

// ── Earnings Badge ────────────────────────────────────────────────────────────

function EarningsBadge({ level }: { level: EarningsConfirmationLevel | null }) {
  if (level == null) {
    return <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3 }}>—</span>
  }
  const col = EARN_COLORS[level]
  return (
    <span style={{
      fontFamily: V.mono, fontSize: 11,
      color: col, background: `${col}18`,
      border: `1px solid ${col}40`,
      borderRadius: 3, padding: '1px 5px',
      whiteSpace: 'nowrap' as const,
    }}>
      {EARN_SHORT[level]}
    </span>
  )
}

// ── Theme Tile ────────────────────────────────────────────────────────────────

function ThemeTile({ tile, selected, onClick }: { tile: TileData; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const stateCol = STATE_COLORS[tile.state_label]
  const risks: string[] = []
  if (tile.comm_risk)    risks.push('Comm. Risk')
  if (tile.indirect_exp) risks.push('Indirect')
  if (tile.story_heavy)  risks.push('Story Heavy')
  if (tile.risk_flags.includes('OVERHEAT_RISK'))    risks.push('Overheat')
  if (tile.risk_flags.includes('MOMENTUM_STRETCH')) risks.push('Stretch')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); onClick() }}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        background: selected ? `${V.teal}12` : V.bg2,
        border: `1px solid ${selected ? V.teal : V.border}`,
        borderRadius: 6, cursor: 'pointer',
        display: 'flex', flexDirection: 'column' as const, gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontFamily: V.ui, fontSize: 13, fontWeight: 700, color: V.text, lineHeight: 1.3 }}>
          {tile.display_name}
        </span>
        <StateBadge label={tile.state_label} />
      </div>

      {hovered && (tile.state_score != null || tile.rs_3m != null) && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tile.state_score != null && (
            <span style={{ fontFamily: V.mono, fontSize: 12, color: stateCol, fontWeight: 600 }}>
              {tile.state_score}
            </span>
          )}
          {tile.rs_3m != null && (
            <span style={{ fontFamily: V.mono, fontSize: 12, color: rsColFn(tile.rs_3m) }}>
              RS 3M: {fmt(tile.rs_3m)}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 6 }}>
        <EarningsBadge level={tile.earnings_level} />
        {risks.slice(0, 2).map(r => (
          <span key={r} style={{
            fontFamily: V.mono, fontSize: 10,
            color: V.amber, background: `${V.amber}14`,
            border: `1px solid ${V.amber}30`,
            borderRadius: 3, padding: '0 5px', letterSpacing: '0.04em',
          }}>
            {r}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

function RiskBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: V.mono, fontSize: 11,
      color: V.amber, background: `${V.amber}14`,
      border: `1px solid ${V.amber}30`,
      borderRadius: 3, padding: '2px 6px', letterSpacing: '0.04em',
      whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  )
}

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: V.mono, fontSize: 11, fontWeight: 700,
      color: V.text2, letterSpacing: '0.10em',
      marginBottom: 6, paddingBottom: 4,
      borderBottom: `1px solid ${V.border}`,
    }}>
      {text}
    </div>
  )
}

// ── Evidence level rank for related symbol sorting ────────────────────────────

const EARN_RANK: Record<EarningsConfirmationLevel, number> = {
  CONFIRMED: 0, PARTIAL: 1, WATCH: 2, NOT_CONFIRMED: 3, DATA_LIMITED: 4, UNKNOWN: 5,
}

// ── Watch Next rules (priority-ordered, max 3, no trading language) ───────────

function buildWatchNextItems(tile: TileData): string[] {
  const items: string[] = []
  const rsStrong = (tile.rs_3m != null && tile.rs_3m > 5) || (tile.rs_6m != null && tile.rs_6m > 5)
  const earningsWeak = tile.earnings_level !== 'CONFIRMED' && tile.earnings_level !== 'PARTIAL'

  if (rsStrong && earningsWeak) {
    items.push('Evidence gap: RS outpacing earnings confirmation. Watch for revenue visibility improvement.')
  }
  if ((tile.story_heavy || tile.comm_risk) && items.length < 3) {
    items.push('Commercialization risk: Monitor whether design activity converts to confirmed revenue.')
  }
  if ((tile.earnings_level === 'DATA_LIMITED' || tile.earnings_level == null || tile.earnings_coverage < 0.5) && items.length < 3) {
    items.push('Data limited: More company-level evidence needed before confirmation level improves.')
  }
  if (tile.indirect_exp && items.length < 3) {
    items.push('Indirect exposure: Sector benefit depends on downstream AI infrastructure adoption.')
  }
  if (items.length === 0) {
    items.push('Confirmation quality: Watch for broadening evidence across covered companies next quarter.')
  }

  return items.slice(0, 3)
}

// ── Theme Detail Drawer ───────────────────────────────────────────────────────

function ThemeDetailDrawer({
  tile,
  benchmark,
  onClose,
}: {
  tile: TileData
  benchmark: string
  onClose: () => void
}) {
  const stateCol = STATE_COLORS[tile.state_label]

  const relatedSymbols = useMemo(() => {
    return AI_INFRA_COMPANY_PURITY
      .filter(p => p.primary_bucket === tile.bucket_id)
      .map(p => {
        const ev = getCompanyEarningsEvidence(p.symbol)
        const ev_level = ev?.confirmation_level ?? null
        const ev_rank  = ev_level != null ? EARN_RANK[ev_level] : 6
        return { ...p, ev_level, ev_rank }
      })
      .sort((a, b) =>
        a.ev_rank !== b.ev_rank
          ? a.ev_rank - b.ev_rank
          : b.ai_infra_relevance_score - a.ai_infra_relevance_score,
      )
      .slice(0, 6)
  }, [tile.bucket_id])

  const watchItems = buildWatchNextItems(tile)

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: 12, marginBottom: 4,
        background: V.bg2,
        border: `1px solid ${V.teal}44`,
        borderRadius: 6, padding: '14px 16px', width: '100%',
        display: 'flex', flexDirection: 'column' as const, gap: 16,
      }}
    >
      {/* ── 1. Theme Header ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: V.ui, fontSize: 16, fontWeight: 800, color: V.text, marginBottom: 6, lineHeight: 1.2 }}>
              {tile.display_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
              <StateBadge label={tile.state_label} />
              {tile.state_score != null && (
                <span style={{ fontFamily: V.mono, fontSize: 13, color: stateCol, fontWeight: 700 }}>
                  {tile.state_score}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close detail"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: V.text3, fontFamily: V.mono, fontSize: 14, padding: '2px 6px', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12, marginBottom: 8 }}>
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em' }}>
            {tile.bucket_id}
          </span>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3 }}>Benchmark: {benchmark}</span>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: tile.confidence === 'HIGH' ? V.teal : tile.confidence === 'MEDIUM' ? V.amber : V.text3 }}>
            Conf: {tile.confidence}
          </span>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: tile.coverage_ratio >= 0.75 ? V.teal : tile.coverage_ratio >= 0.5 ? V.text2 : V.amber }}>
            Cov: {covLabel(tile.coverage_ratio)}
          </span>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: tile.data_quality === 'REAL' ? V.green : tile.data_quality === 'MANUAL' ? V.teal : V.amber }}>
            Data: {tile.data_quality}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
          {([ ['RS 1M', tile.rs_1m], ['RS 3M', tile.rs_3m], ['RS 6M', tile.rs_6m] ] as [string, number | null][]).map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em', marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontFamily: V.mono, fontSize: 13, color: rsColFn(val), fontWeight: 600 }}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. State Explanation ── */}
      <div>
        <SectionLabel text="WHY THIS STATE" />
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
          {tile.state_reason || tile.state_drivers.length > 0 ? (
            <>
              {tile.state_reason && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: V.teal, flexShrink: 0, fontFamily: V.mono, fontSize: 12 }}>•</span>
                  <span style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, lineHeight: 1.45 }}>
                    {tile.state_reason.length > 140 ? tile.state_reason.slice(0, 140) + '…' : tile.state_reason}
                  </span>
                </div>
              )}
              {tile.state_drivers.slice(0, tile.state_reason ? 2 : 3).map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: V.teal, flexShrink: 0, fontFamily: V.mono, fontSize: 12 }}>•</span>
                  <span style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, lineHeight: 1.45 }}>
                    {d.length > 140 ? d.slice(0, 140) + '…' : d}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: V.text3, flexShrink: 0, fontFamily: V.mono, fontSize: 12 }}>•</span>
              <span style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, lineHeight: 1.45 }}>
                State classification based on RS and RRG signals.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Earnings Confirmation ── */}
      <div>
        <SectionLabel text="EARNINGS CONFIRMATION" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' as const }}>
          <EarningsBadge level={tile.earnings_level} />
          {tile.earnings_score != null && (
            <span style={{ fontFamily: V.mono, fontSize: 13, fontWeight: 600, color: tile.earnings_level ? EARN_COLORS[tile.earnings_level] : V.text3 }}>
              Score: {tile.earnings_score}
            </span>
          )}
          {tile.earnings_coverage > 0 && (
            <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text3 }}>
              Coverage: {Math.round(tile.earnings_coverage * 100)}%
            </span>
          )}
        </div>
        {tile.evidence_summary && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em', minWidth: 74, flexShrink: 0 }}>EVIDENCE</span>
            <span style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, lineHeight: 1.4 }}>{tile.evidence_summary}</span>
          </div>
        )}
        {tile.caution_summary && tile.earnings_level != null && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em', minWidth: 74, flexShrink: 0 }}>CAUTION</span>
            <span style={{ fontFamily: V.ui, fontSize: 13, color: V.amber, lineHeight: 1.4 }}>{tile.caution_summary}</span>
          </div>
        )}
        {(tile.earnings_level === 'CONFIRMED' || tile.earnings_level === 'PARTIAL') && (
          <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text3, marginTop: 4 }}>
            Business evidence only. Not a trading signal.
          </div>
        )}
        {(tile.earnings_level === 'DATA_LIMITED' || tile.earnings_level == null) && (
          <div style={{
            fontFamily: V.mono, fontSize: 11, color: V.text3, letterSpacing: '0.04em',
            background: 'rgba(139,144,152,0.08)', border: '1px solid rgba(139,144,152,0.20)',
            borderRadius: 3, padding: '4px 8px', marginTop: 4,
          }}>
            Insufficient company-level evidence to confirm earnings theme
          </div>
        )}
      </div>

      {/* ── 4. Risk & Data Quality ── */}
      <div>
        <SectionLabel text="RISK & DATA QUALITY" />
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
          {tile.story_heavy   && <RiskBadge label="Story Heavy" />}
          {tile.comm_risk     && <RiskBadge label="Comm. Risk" />}
          {tile.indirect_exp  && <RiskBadge label="Indirect" />}
          {tile.coverage_ratio < 0.5 && tile.coverage_ratio > 0 && <RiskBadge label="Low Coverage" />}
          {tile.state_label === 'DATA_INSUFFICIENT' && <RiskBadge label="Data Insufficient" />}
          {tile.risk_flags.includes('OVERHEAT_RISK')    && <RiskBadge label="Overheat" />}
          {tile.risk_flags.includes('MOMENTUM_STRETCH') && <RiskBadge label="Momentum Stretch" />}
          {!tile.story_heavy && !tile.comm_risk && !tile.indirect_exp
            && tile.coverage_ratio >= 0.5
            && tile.state_label !== 'DATA_INSUFFICIENT'
            && tile.risk_flags.length === 0 && (
            <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text3 }}>No active risk flags</span>
          )}
        </div>
      </div>

      {/* ── 5. Related Symbols ── */}
      <div>
        <SectionLabel text={`RELATED SYMBOLS (${relatedSymbols.length})`} />
        {relatedSymbols.length === 0 ? (
          <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text3 }}>No mapped symbols available</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
            {relatedSymbols.map(sym => (
              <div key={sym.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                <span style={{ fontFamily: V.mono, fontSize: 13, color: V.teal, fontWeight: 700, minWidth: 48 }}>
                  {sym.symbol}
                </span>
                {sym.company_name && (
                  <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text2, flex: '1 1 80px' }}>
                    {sym.company_name}
                  </span>
                )}
                <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
                  {COMPANY_PURITY_LABEL[sym.company_theme_purity]}
                </span>
                {sym.ev_level != null && (
                  <span style={{
                    fontFamily: V.mono, fontSize: 10,
                    color: EARN_COLORS[sym.ev_level],
                    background: `${EARN_COLORS[sym.ev_level]}18`,
                    border: `1px solid ${EARN_COLORS[sym.ev_level]}40`,
                    borderRadius: 3, padding: '0 4px',
                  }}>
                    {EARN_ABBR[sym.ev_level]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Watch Next ── */}
      <div>
        <SectionLabel text="WATCH NEXT" />
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {watchItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: V.teal, flexShrink: 0, fontFamily: V.mono, fontSize: 12 }}>—</span>
              <span style={{ fontFamily: V.ui, fontSize: 13, color: V.text2, lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        paddingTop: 8, borderTop: `1px solid ${V.border}`,
        fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.5,
      }}>
        Business evidence layer only. State labels are rule-based. Not investment advice.
      </div>
    </div>
  )
}

// ── Theme Heatmap ─────────────────────────────────────────────────────────────

function ThemeHeatmap({ tiles, selectedId, onSelect }: {
  tiles: TileData[]
  selectedId: AIInfraBucketId | null
  onSelect: (id: AIInfraBucketId) => void
}) {
  const sorted = [...tiles].sort((a, b) => (b.state_score ?? -1) - (a.state_score ?? -1))

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontFamily: V.mono, fontSize: 11, fontWeight: 700,
    color: V.text2, letterSpacing: '0.10em',
    borderBottom: `1px solid ${V.border}`,
    whiteSpace: 'nowrap' as const,
    background: V.bg,
    position: 'sticky' as const, top: 0,
    textAlign: 'left',
  }
  const thR: React.CSSProperties = { ...thStyle, textAlign: 'right' }

  function riskAbbr(tile: TileData): string {
    const parts: string[] = []
    if (tile.comm_risk)    parts.push('CR')
    if (tile.indirect_exp) parts.push('IN')
    if (tile.story_heavy)  parts.push('SH')
    if (tile.risk_flags.includes('OVERHEAT_RISK'))    parts.push('OH')
    if (tile.risk_flags.includes('MOMENTUM_STRETCH')) parts.push('MS')
    return parts.join(' ') || '—'
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        fontFamily: V.mono, fontSize: 11, fontWeight: 700,
        color: V.text2, letterSpacing: '0.10em',
        marginBottom: 8, paddingBottom: 4,
        borderBottom: `1px solid ${V.border}`,
      }}>
        THEME HEATMAP
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={thStyle}>THEME</th>
              <th style={thStyle}>STATE</th>
              <th style={thR}>SCORE</th>
              <th style={thR}>RS 1M</th>
              <th style={thR}>RS 3M</th>
              <th style={thR}>RS 6M</th>
              <th style={thStyle}>EARNINGS</th>
              <th style={thStyle}>RISK</th>
              <th style={thR}>COV</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(tile => {
              const sel = tile.bucket_id === selectedId
              const earnCol = tile.earnings_level ? EARN_COLORS[tile.earnings_level] : null
              return (
                <tr
                  key={tile.bucket_id}
                  onClick={() => onSelect(tile.bucket_id)}
                  style={{
                    borderBottom: `1px solid ${V.border}`,
                    background: sel ? `${V.teal}0A` : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '6px 8px', fontFamily: V.ui, fontSize: 12, color: sel ? V.teal : V.text, whiteSpace: 'nowrap' as const }}>
                    {tile.display_name}
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' as const }}>
                    <StateBadge label={tile.state_label} />
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 12, color: tile.state_score != null ? STATE_COLORS[tile.state_label] : V.text3, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {tile.state_score ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 12, color: rsColFn(tile.rs_1m), textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {fmt(tile.rs_1m)}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 12, color: rsColFn(tile.rs_3m), textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {fmt(tile.rs_3m)}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 12, color: rsColFn(tile.rs_6m), textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {fmt(tile.rs_6m)}
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' as const }}>
                    {earnCol ? (
                      <span style={{
                        fontFamily: V.mono, fontSize: 11,
                        color: earnCol, background: `${earnCol}18`,
                        border: `1px solid ${earnCol}40`,
                        borderRadius: 3, padding: '1px 5px',
                      }}>
                        {tile.earnings_level ? EARN_ABBR[tile.earnings_level] : '—'}
                      </span>
                    ) : (
                      <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text3 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.amber, whiteSpace: 'nowrap' as const }}>
                    {riskAbbr(tile)}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 12, color: V.text3, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {tile.coverage_ratio > 0 ? `${Math.round(tile.coverage_ratio * 100)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, marginTop: 6, letterSpacing: '0.06em' }}>
        RISK: CR=Comm.Risk IN=Indirect SH=Story Heavy OH=Overheat MS=Momentum Stretch
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface ThemeMapPanelProps {
  states:          AIInfraBucketState[]
  earningsBuckets: AIInfraBucketEarningsConfirmation[]
  momentumBuckets: AIInfraBucketMomentum[]
  benchmark:       string
}

export function ThemeMapPanel({ states, earningsBuckets, momentumBuckets, benchmark }: ThemeMapPanelProps) {
  const [filter,             setFilter]             = useState<FilterKey>('all')
  const [selectedId,         setSelectedId]         = useState<AIInfraBucketId | null>(null)
  const [windowWidth,        setWindowWidth]        = useState(1200)
  const [isHeatmapExpanded,  setIsHeatmapExpanded]  = useState(false)

  // Reset filter on benchmark change; selectedId preserved — drawer auto-updates via tiles useMemo
  useEffect(() => {
    setFilter('all')
  }, [benchmark])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setWindowWidth(window.innerWidth)
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { tiles, duplicateCount } = useMemo(
    () => buildTileData(states, earningsBuckets, momentumBuckets, benchmark),
    [states, earningsBuckets, momentumBuckets, benchmark],
  )

  const filteredTiles = useMemo(() => tiles.filter(t => applyFilter(t, filter)), [tiles, filter])

  const filteredIds = useMemo(
    () => new Set(filteredTiles.map(t => t.bucket_id)),
    [filteredTiles],
  )

  const selectedTile = useMemo(
    () => tiles.find(t => t.bucket_id === selectedId) ?? null,
    [tiles, selectedId],
  )

  const handleSelect = (id: AIInfraBucketId) => setSelectedId(prev => prev === id ? null : id)
  const handleDismiss = () => setSelectedId(null)

  const gridCols = windowWidth >= 1024
    ? 'repeat(3, 1fr)'
    : windowWidth >= 768
      ? 'repeat(2, 1fr)'
      : '1fr'

  return (
    <div onClick={handleDismiss}>
      {/* Dedup warning (dev only) */}
      {duplicateCount > 0 && process.env.NODE_ENV !== 'production' && (
        <div style={{
          marginBottom: 8, padding: '5px 10px',
          background: `${V.amber}14`, border: `1px solid ${V.amber}40`,
          borderRadius: 4, fontFamily: V.mono, fontSize: 11, color: V.amber,
        }}>
          {duplicateCount} duplicate bucket_id(s) in bucket_states — rendering first occurrence only.
        </div>
      )}

      {/* Theme Flow Ladder — always visible; filter mutes non-matching groups */}
      <div onClick={e => e.stopPropagation()}>
        <ThemeFlowLadder
          tiles={tiles}
          filteredIds={filteredIds}
          isFiltered={filter !== 'all'}
          selectedId={selectedId}
          windowWidth={windowWidth}
          onSelect={handleSelect}
        />
      </div>

      {/* Filter chips — default All, reset on benchmark change */}
      <div onClick={e => e.stopPropagation()}>
        <FilterChips active={filter} onChange={(k) => { setFilter(k); setSelectedId(null) }} />
      </div>

      {/* Tile grid */}
      <div
        style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, marginBottom: 4 }}
        onClick={e => e.stopPropagation()}
      >
        {filteredTiles.map(tile => (
          <ThemeTile
            key={tile.bucket_id}
            tile={tile}
            selected={selectedId === tile.bucket_id}
            onClick={() => handleSelect(tile.bucket_id)}
          />
        ))}
        {filteredTiles.length === 0 && (
          <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0', gridColumn: '1/-1' }}>
            No themes match the selected filter.
          </div>
        )}
      </div>

      {/* Detail card — full-width below tile grid (mobile: bottom sheet style) */}
      {selectedTile && (
        <ThemeDetailDrawer tile={selectedTile} benchmark={benchmark} onClose={handleDismiss} />
      )}

      {/* Heatmap — collapsed by default; toggle persists across benchmark switch */}
      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setIsHeatmapExpanded(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '8px 0', marginTop: 20,
            fontFamily: V.mono, fontSize: 11, fontWeight: 700,
            color: V.text2, letterSpacing: '0.10em',
          }}
        >
          <span style={{ color: V.text3, fontSize: 12, lineHeight: 1 }}>
            {isHeatmapExpanded ? '▾' : '▸'}
          </span>
          ADVANCED MATRIX
        </button>
        {isHeatmapExpanded && (
          <ThemeHeatmap tiles={filteredTiles} selectedId={selectedId} onSelect={handleSelect} />
        )}
      </div>

      <div style={{
        marginTop: 12, paddingTop: 8,
        borderTop: `1px solid ${V.border}`,
        fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.5,
      }}>
        Theme Map is a visual rotation observation tool. State labels are rule-based and price-driven.
        Earnings confirmation is business evidence only. Not investment advice.
      </div>
    </div>
  )
}
