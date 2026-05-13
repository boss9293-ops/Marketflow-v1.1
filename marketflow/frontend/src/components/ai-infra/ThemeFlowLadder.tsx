'use client'
// AI 인프라 테마 흐름 레더 — 6그룹 밸류체인 흐름 시각화 (TM-4 MVP)

import { useMemo, type ReactNode } from 'react'
import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import type { EarningsConfirmationLevel } from '@/lib/ai-infra/aiInfraEarningsConfirmation'

// ── Design tokens ─────────────────────────────────────────────────────────────

const V = {
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  amber:  '#fbbf24',
  bg2:    'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Minimal tile interface (structurally compatible with TileData) ─────────────

export interface FlowTileMinimal {
  bucket_id:      AIInfraBucketId
  display_name:   string
  state_label:    AIInfraStateLabel
  state_score:    number | null
  earnings_level: EarningsConfirmationLevel | null
  story_heavy:    boolean
  indirect_exp:   boolean
  comm_risk:      boolean
}

// ── Flow group definitions (6 groups, 13 buckets, each exactly once) ──────────

interface FlowGroupDef {
  id:      string
  label:   string
  buckets: AIInfraBucketId[]
}

const FLOW_GROUPS: FlowGroupDef[] = [
  { id: 'core',        label: 'AI Core',           buckets: ['AI_CHIP'] },
  { id: 'memory',      label: 'Memory / Supply',   buckets: ['HBM_MEMORY'] },
  { id: 'mfg',         label: 'Manufacturing / Pkg', buckets: ['PACKAGING', 'TEST_EQUIPMENT', 'PCB_SUBSTRATE'] },
  { id: 'net_thermal', label: 'Network / Thermal',  buckets: ['OPTICAL_NETWORK', 'COOLING'] },
  { id: 'power_dc',    label: 'Power / Data Ctr',   buckets: ['POWER_INFRA', 'DATA_CENTER_INFRA'] },
  { id: 'facility',    label: 'Facility / Materials', buckets: ['CLEANROOM_WATER', 'SPECIALTY_GAS', 'RAW_MATERIAL', 'GLASS_SUBSTRATE'] },
]

// Dev-time bucket count guard
if (process.env.NODE_ENV !== 'production') {
  const all    = FLOW_GROUPS.flatMap(g => g.buckets)
  const unique = new Set(all)
  if (all.length !== 13 || unique.size !== 13) {
    console.warn(`[ThemeFlowLadder] bucket count mismatch: ${all.length} total, ${unique.size} unique (expected 13)`)
  }
}

// ── Group status ──────────────────────────────────────────────────────────────

type GroupStatus = 'leading' | 'improving' | 'watch' | 'data_limited' | 'caution'

const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  leading:      'Leading',
  improving:    'Improving',
  watch:        'Watch',
  data_limited: 'Data Limited',
  caution:      'Caution',
}

const GROUP_STATUS_COLOR: Record<GroupStatus, string> = {
  leading:      '#22c55e',
  improving:    '#3FB6A8',
  watch:        '#fbbf24',
  data_limited: '#8b9098',
  caution:      '#fbbf24',
}

function calcGroupStatus(groupTiles: FlowTileMinimal[]): GroupStatus {
  if (groupTiles.length === 0) return 'data_limited'

  const hasLeading   = groupTiles.some(t => t.state_label === 'LEADING')
  const hasImprove   = groupTiles.some(t => t.state_label === 'EMERGING' || t.state_label === 'CONFIRMING')
  const hasConfirmed = groupTiles.some(t => t.earnings_level === 'CONFIRMED' || t.earnings_level === 'PARTIAL')
  const dlCount      = groupTiles.filter(t => t.earnings_level === 'DATA_LIMITED' || t.earnings_level == null).length
  const mostlyDL     = dlCount > groupTiles.length / 2
  const hasRisk      = groupTiles.some(t => t.story_heavy || t.indirect_exp || t.comm_risk)
  const hasWatch     = groupTiles.some(t => t.earnings_level === 'WATCH' || t.earnings_level === 'NOT_CONFIRMED')

  if (hasLeading && hasConfirmed)               return 'leading'
  if (hasLeading || (hasImprove && hasConfirmed)) return 'improving'
  if (hasImprove)                               return 'improving'
  if (mostlyDL && hasRisk)                      return 'caution'
  if (mostlyDL)                                 return 'data_limited'
  if (hasWatch)                                 return 'watch'
  return 'watch'
}

// ── Group representative bucket selection ─────────────────────────────────────
// Priority 1: LEADING state bucket
// Priority 2: highest state_score bucket
// Priority 3: first in group definition order

function selectRepresentative(groupTiles: FlowTileMinimal[]): AIInfraBucketId | null {
  if (groupTiles.length === 0) return null
  const leading = groupTiles.find(t => t.state_label === 'LEADING')
  if (leading) return leading.bucket_id
  const byScore = [...groupTiles].sort((a, b) => (b.state_score ?? -1) - (a.state_score ?? -1))
  if (byScore[0].state_score != null) return byScore[0].bucket_id
  return groupTiles[0].bucket_id
}

// ── Current Flow Summary ──────────────────────────────────────────────────────

interface GroupData {
  def:    FlowGroupDef
  tiles:  FlowTileMinimal[]
  status: GroupStatus
  rep:    AIInfraBucketId | null
}

function buildFlowSummary(groups: GroupData[]): string {
  if (groups.every(g => g.status === 'data_limited')) {
    return 'Broad infrastructure data coverage is limited.'
  }

  const leading   = groups.filter(g => g.status === 'leading')
  const improving = groups.filter(g => g.status === 'improving')
  const dl        = groups.filter(g => g.status === 'data_limited')
  const parts: string[] = []

  if (leading.length > 0) {
    const lLabels = leading.map(g => g.def.label).join(' and ')
    if (improving.length > 0) {
      parts.push(`${lLabels} leadership extending into ${improving.map(g => g.def.label).join(', ')}`)
    } else {
      parts.push(`${lLabels} leadership concentrated`)
    }
  } else if (improving.length > 0) {
    parts.push(`${improving.map(g => g.def.label).join(', ')} showing participation`)
  }

  if (dl.length > 0) {
    parts.push(`${dl.map(g => g.def.label).join(', ')} remain data-limited`)
  }

  if (parts.length === 0) return 'Flow structure updating.'
  return `Current Flow: ${parts.slice(0, 2).join('; ')}.`
}

// ── Earnings helpers ──────────────────────────────────────────────────────────

const EARN_ABBR: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED: 'CNF', PARTIAL: 'PRT', WATCH: 'WCH',
  NOT_CONFIRMED: 'N/C', DATA_LIMITED: 'D/L', UNKNOWN: '—',
}

const EARN_COLORS: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED: '#22c55e', PARTIAL: '#3FB6A8', WATCH: '#fbbf24',
  NOT_CONFIRMED: '#ef4444', DATA_LIMITED: '#8b9098', UNKNOWN: '#555a62',
}

function bestEarnings(tiles: FlowTileMinimal[]): EarningsConfirmationLevel | null {
  const order: EarningsConfirmationLevel[] = [
    'CONFIRMED', 'PARTIAL', 'WATCH', 'NOT_CONFIRMED', 'DATA_LIMITED', 'UNKNOWN',
  ]
  for (const lvl of order) {
    if (tiles.some(t => t.earnings_level === lvl)) return lvl
  }
  return null
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ThemeFlowLadderProps {
  tiles:       FlowTileMinimal[]
  filteredIds: Set<AIInfraBucketId>
  isFiltered:  boolean
  selectedId:  AIInfraBucketId | null
  windowWidth: number
  onSelect:    (id: AIInfraBucketId) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThemeFlowLadder({
  tiles, filteredIds, isFiltered, selectedId, windowWidth, onSelect,
}: ThemeFlowLadderProps) {
  const tileMap = useMemo(() => new Map(tiles.map(t => [t.bucket_id, t])), [tiles])

  const groups: GroupData[] = useMemo(() =>
    FLOW_GROUPS.map(def => {
      const gTiles = def.buckets.map(bid => tileMap.get(bid)).filter(Boolean) as FlowTileMinimal[]
      return { def, tiles: gTiles, status: calcGroupStatus(gTiles), rep: selectRepresentative(gTiles) }
    }),
  [tileMap])

  const flowSummary = useMemo(() => buildFlowSummary(groups), [groups])

  const isHorizontal = windowWidth >= 768

  const nodes: ReactNode[] = []

  groups.forEach((group, idx) => {
    const highlighted   = !isFiltered || group.def.buckets.some(bid => filteredIds.has(bid))
    const groupSelected = selectedId != null && group.def.buckets.includes(selectedId as AIInfraBucketId)
    const statusColor   = GROUP_STATUS_COLOR[group.status]
    const earnings      = bestEarnings(group.tiles)
    const hasRisk       = group.tiles.some(t => t.story_heavy || t.indirect_exp || t.comm_risk)

    nodes.push(
      <div
        key={group.def.id}
        role="button"
        tabIndex={0}
        onClick={() => { if (group.rep) onSelect(group.rep) }}
        onKeyDown={e => { if (e.key === 'Enter' && group.rep) onSelect(group.rep) }}
        style={{
          flex: isHorizontal ? '1 1 0' : 'none',
          minWidth: isHorizontal ? 100 : 'auto',
          padding: '9px 10px',
          background: groupSelected ? `${statusColor}14` : V.bg2,
          border: `1px solid ${groupSelected ? statusColor : highlighted ? statusColor + '44' : V.border}`,
          borderRadius: 5,
          cursor: 'pointer',
          opacity: isFiltered && !highlighted ? 0.4 : 1,
          display: 'flex', flexDirection: 'column' as const, gap: 5,
          transition: 'opacity 0.15s',
        }}
      >
        {/* Group label */}
        <div style={{
          fontFamily: V.mono, fontSize: 10, fontWeight: 700,
          color: V.text2, letterSpacing: '0.10em', lineHeight: 1.2,
        }}>
          {group.def.label.toUpperCase()}
        </div>

        {/* Status badge */}
        <span style={{
          fontFamily: V.ui, fontSize: 11, fontWeight: 700, color: statusColor,
          background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
          borderRadius: 3, padding: '1px 6px', alignSelf: 'flex-start' as const,
          whiteSpace: 'nowrap' as const,
        }}>
          {GROUP_STATUS_LABEL[group.status]}
        </span>

        {/* Bucket names */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
          {group.tiles.map(t => (
            <span
              key={t.bucket_id}
              onClick={e => { e.stopPropagation(); onSelect(t.bucket_id) }}
              style={{
                fontFamily: V.ui, fontSize: 11, lineHeight: 1.3,
                color: selectedId === t.bucket_id ? statusColor : V.text2,
                opacity: isFiltered && !filteredIds.has(t.bucket_id) ? 0.45 : 1,
                cursor: 'pointer',
                textDecoration: selectedId === t.bucket_id ? 'underline' : 'none',
                textDecorationColor: statusColor,
              }}
            >
              {t.display_name}
            </span>
          ))}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {earnings && (
            <span style={{
              fontFamily: V.mono, fontSize: 10,
              color: EARN_COLORS[earnings],
              background: `${EARN_COLORS[earnings]}18`,
              border: `1px solid ${EARN_COLORS[earnings]}40`,
              borderRadius: 3, padding: '0 4px',
            }}>
              {EARN_ABBR[earnings]}
            </span>
          )}
          {hasRisk && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.amber,
              background: `${V.amber}14`, border: `1px solid ${V.amber}30`,
              borderRadius: 3, padding: '0 4px',
            }}>
              RISK
            </span>
          )}
        </div>
      </div>,
    )

    if (idx < groups.length - 1) {
      nodes.push(
        <div key={`sep-${idx}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          padding: isHorizontal ? '0 3px' : '3px 0',
          color: V.text3, fontSize: isHorizontal ? 16 : 14, lineHeight: 1,
        }}>
          {isHorizontal ? '›' : '↓'}
        </div>,
      )
    }
  })

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Current Flow Summary */}
      <div style={{
        fontFamily: V.ui, fontSize: 13, color: V.text2,
        background: `${V.teal}0A`, border: `1px solid ${V.teal}28`,
        borderRadius: 4, padding: '7px 12px',
        marginBottom: 10, lineHeight: 1.45,
      }}>
        <span style={{
          fontFamily: V.mono, fontSize: 10, color: V.teal,
          letterSpacing: '0.08em', marginRight: 8,
        }}>
          FLOW
        </span>
        {flowSummary}
      </div>

      {/* Ladder */}
      <div style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: 'stretch',
        overflowX: isHorizontal ? 'auto' : 'visible',
      }}>
        {nodes}
      </div>

      {/* Legend */}
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, marginTop: 6, letterSpacing: '0.06em' }}>
        Click group or theme name to view detail. Muted = outside current filter.
      </div>
    </div>
  )
}
