'use client'
// AI Bottleneck Radar — Value Chain Ladder UI — Phase F-1
// Shows the 5-stage AI infrastructure value chain with bucket states and purity.
// Visualization layer only. No earnings confirmation. No investment recommendations.

import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS } from '@/lib/ai-infra/aiInfraStateLabels'
import { THEME_PURITY_LABEL, REVENUE_VIS_LABEL } from '@/lib/ai-infra/aiInfraThemePurity'
import { AI_INFRA_STAGE_ORDER } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage, AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'

// ── Design tokens (shared with radar) ────────────────────────────────────────

const V = {
  teal:   '#3FB6A8', red:    '#E55A5A', amber: '#F2A93B',
  gold:   '#D4B36A', mint:   '#5DCFB0', blue:  '#4A9EE0',
  purple: '#9B87D4',
  text:   '#E8F0F8', text2:  '#B8C8DC', text3: '#8b9098',
  bg:     '#0F1117', bg2:    'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValueChainLadderProps = {
  bucketStates:       AIInfraBucketState[]
  buckets?:           AIInfraBucketMomentum[]
  compact?:           boolean
  selectedBenchmark?: 'SOXX' | 'QQQ' | 'SPY'
}

type AIInfraStageSummary = {
  stage:               AIInfraStage
  display_name:        string
  korean_label:        string
  bucket_count:        number
  leading_count:       number
  emerging_count:      number
  crowded_count:       number
  story_only_count:    number
  indirect_count:      number
  average_state_score: number | null
  dominant_state:      AIInfraStateLabel | 'MIXED' | 'DATA_INSUFFICIENT'
}

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGE_META: Record<AIInfraStage, { display: string; korean: string; meaning: string }> = {
  STAGE_1_AI_CHIP: {
    display: 'Stage 1 — AI Chip',
    korean:  '1차 · AI Chip',
    meaning: 'AI accelerator & custom silicon leadership',
  },
  STAGE_2_MEMORY_PACKAGING: {
    display: 'Stage 2 — Memory / Packaging',
    korean:  '2차 · Memory / Packaging',
    meaning: 'HBM, advanced packaging, CoWoS capacity',
  },
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: {
    display: 'Stage 3 — Server Internal Bottlenecks',
    korean:  '3차 · Server Internal',
    meaning: 'Cooling, substrate, test, optical connectivity',
  },
  STAGE_4_EXTERNAL_INFRA: {
    display: 'Stage 4 — External Infrastructure',
    korean:  '4차 · External Infra',
    meaning: 'Power equipment, cleanroom, specialty gas',
  },
  STAGE_5_PHYSICAL_RESOURCE: {
    display: 'Stage 5 — Physical Resources',
    korean:  '5차 · Physical Resources',
    meaning: 'Data centers, copper & raw materials',
  },
}

// ── Stage color accent ─────────────────────────────────────────────────────────

const STAGE_ACCENT: Record<AIInfraStage, string> = {
  STAGE_1_AI_CHIP:                     '#3FB6A8',
  STAGE_2_MEMORY_PACKAGING:            '#5DCFB0',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK:  '#4A9EE0',
  STAGE_4_EXTERNAL_INFRA:              '#9B87D4',
  STAGE_5_PHYSICAL_RESOURCE:           '#B8C8DC',
}

// ── Dominant state logic ───────────────────────────────────────────────────────

const STATE_PRIORITY: AIInfraStateLabel[] = [
  'LEADING', 'EMERGING', 'CONFIRMING', 'CROWDED',
  'DISTRIBUTION', 'LAGGING', 'STORY_ONLY', 'DATA_INSUFFICIENT',
]

function deriveStageSummary(
  stage:     AIInfraStage,
  stateRows: AIInfraBucketState[],
): AIInfraStageSummary {
  const meta = STAGE_META[stage]

  const leading_count    = stateRows.filter(s => s.state_label === 'LEADING').length
  const emerging_count   = stateRows.filter(s => s.state_label === 'EMERGING').length
  const crowded_count    = stateRows.filter(s => s.state_label === 'CROWDED').length
  const story_only_count = stateRows.filter(s => s.state_label === 'STORY_ONLY').length
  const indirect_count   = stateRows.filter(
    s => s.theme_purity?.theme_purity === 'INDIRECT_EXPOSURE',
  ).length

  const scored  = stateRows.filter(s => s.state_score != null)
  const average_state_score = scored.length > 0
    ? Math.round(scored.reduce((a, s) => a + (s.state_score ?? 0), 0) / scored.length)
    : null

  // Dominant: most common positive state, else MIXED, else DATA_INSUFFICIENT
  let dominant_state: AIInfraStateLabel | 'MIXED' | 'DATA_INSUFFICIENT' = 'DATA_INSUFFICIENT'
  const usable = stateRows.filter(s => s.state_label !== 'DATA_INSUFFICIENT')
  if (usable.length > 0) {
    const counts = new Map<AIInfraStateLabel, number>()
    for (const s of usable) counts.set(s.state_label, (counts.get(s.state_label) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])
    if (top[0][1] / usable.length >= 0.5) {
      dominant_state = top[0][0]
    } else {
      dominant_state = 'MIXED'
    }
  }

  return {
    stage,
    display_name:        meta.display,
    korean_label:        meta.korean,
    bucket_count:        stateRows.length,
    leading_count,
    emerging_count,
    crowded_count,
    story_only_count,
    indirect_count,
    average_state_score,
    dominant_state,
  }
}

// ── Purity color helper ───────────────────────────────────────────────────────

function purityColor(purity: string | undefined): string {
  if (!purity) return V.text3
  if (purity === 'PURE_PLAY' || purity === 'HIGH_EXPOSURE') return V.teal
  if (purity === 'STORY_HEAVY')      return V.amber
  if (purity === 'INDIRECT_EXPOSURE') return V.text3
  if (purity === 'MIXED_EXPOSURE')    return V.gold
  return V.text2
}

// ── Stage state color ─────────────────────────────────────────────────────────

function dominantColor(d: AIInfraStageSummary['dominant_state']): string {
  if (d === 'MIXED')            return V.gold
  if (d === 'DATA_INSUFFICIENT') return V.text3
  return STATE_COLORS[d as AIInfraStateLabel] ?? V.text2
}

// ── Bucket Chip ───────────────────────────────────────────────────────────────

function BucketChip({ state, compact }: { state: AIInfraBucketState; compact: boolean }) {
  const stateColor = STATE_COLORS[state.state_label]
  const pColor = purityColor(state.theme_purity?.theme_purity)
  const hasCommRisk = state.theme_purity?.commercialization_risk
  const hasIndirect = state.theme_purity?.theme_purity === 'INDIRECT_EXPOSURE'
  const revVis = state.theme_purity?.revenue_visibility
  const showRevBadge = revVis === 'NOT_YET_VISIBLE' || revVis === 'UNCLEAR'

  return (
    <div style={{
      padding: compact ? '5px 7px' : '7px 9px',
      borderRadius: 4,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderLeft: `3px solid ${stateColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: compact ? 130 : 160,
      flex: '0 0 auto',
    }}>
      {/* Bucket name + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontFamily: V.ui, fontSize: compact ? 11 : 12,
          fontWeight: 600, color: V.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {state.display_name}
        </span>
        {state.state_score != null && (
          <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text2, flexShrink: 0 }}>
            {state.state_score}
          </span>
        )}
      </div>

      {/* State label */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 5px',
          borderRadius: 3,
          fontSize: 10,
          fontFamily: V.ui,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: '#0f1117',
          backgroundColor: stateColor,
        }}>
          {STATE_DISPLAY_LABELS[state.state_label]}
        </span>

        {/* Purity badge */}
        {state.theme_purity && (
          <span style={{
            fontFamily: V.mono, fontSize: 10,
            color: pColor,
            background: `${pColor}15`,
            border: `1px solid ${pColor}35`,
            borderRadius: 2,
            padding: '0 4px',
            letterSpacing: '0.05em',
          }}>
            {THEME_PURITY_LABEL[state.theme_purity.theme_purity]}
          </span>
        )}
      </div>

      {/* Risk / Revenue badges */}
      {(!compact || hasCommRisk || hasIndirect || showRevBadge) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {hasCommRisk && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.red,
              background: `${V.red}15`, border: `1px solid ${V.red}35`,
              borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
            }}>
              Comm. Risk
            </span>
          )}
          {hasIndirect && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.text3,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
            }}>
              Indirect
            </span>
          )}
          {showRevBadge && state.theme_purity && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.amber,
              background: `${V.amber}15`, border: `1px solid ${V.amber}35`,
              borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
            }}>
              {REVENUE_VIS_LABEL[state.theme_purity.revenue_visibility]}
            </span>
          )}
          {state.risk_flags.includes('OVERHEAT_RISK') && (
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.amber,
              background: `${V.amber}15`, border: `1px solid ${V.amber}35`,
              borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
            }}>
              Overheat
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stage Summary Chip ────────────────────────────────────────────────────────

function StageSummaryChip({ summary }: { summary: AIInfraStageSummary }) {
  const domColor = dominantColor(summary.dominant_state)
  const domLabel = summary.dominant_state === 'MIXED' ? 'Mixed'
    : summary.dominant_state === 'DATA_INSUFFICIENT' ? 'Data Insuff.'
    : STATE_DISPLAY_LABELS[summary.dominant_state as AIInfraStateLabel]

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Dominant state badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 3,
        background: `${domColor}18`, border: `1px solid ${domColor}40`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: domColor, flexShrink: 0 }} />
        <span style={{ fontFamily: V.mono, fontSize: 10, color: domColor, letterSpacing: '0.05em' }}>
          {domLabel}
        </span>
      </span>

      {/* Score */}
      {summary.average_state_score != null && (
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
          avg {summary.average_state_score}
        </span>
      )}

      {/* Alert markers */}
      {summary.crowded_count > 0 && (
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: '0.05em' }}>
          Crowded×{summary.crowded_count}
        </span>
      )}
      {summary.story_only_count > 0 && (
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.05em' }}>
          Story×{summary.story_only_count}
        </span>
      )}
      {summary.indirect_count > 0 && (
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.05em' }}>
          Ind×{summary.indirect_count}
        </span>
      )}
    </div>
  )
}

// ── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({
  stage,
  stateRows,
  compact,
  isLast,
}: {
  stage:     AIInfraStage
  stateRows: AIInfraBucketState[]
  compact:   boolean
  isLast:    boolean
}) {
  const meta    = STAGE_META[stage]
  const accent  = STAGE_ACCENT[stage]
  const summary = deriveStageSummary(stage, stateRows)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 0,
      flex: '1 1 0',
      minWidth: 0,
    }}>
      {/* Stage panel */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 5 : 8,
        padding: compact ? '8px 10px' : '10px 12px',
        background: `${accent}08`,
        border: `1px solid ${accent}20`,
        borderRadius: 4,
      }}>
        {/* Stage header */}
        <div>
          <div style={{
            fontFamily: V.mono, fontSize: 10, color: accent,
            letterSpacing: '0.12em', fontWeight: 700, marginBottom: 2,
          }}>
            {meta.korean.toUpperCase()}
          </div>
          {!compact && (
            <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.4 }}>
              {meta.meaning}
            </div>
          )}
        </div>

        {/* Summary chips */}
        <StageSummaryChip summary={summary} />

        {/* Bucket chips */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 4 : 6,
        }}>
          {stateRows.length === 0 ? (
            <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
              No data
            </span>
          ) : (
            stateRows.map(s => (
              <BucketChip key={s.bucket_id} state={s} compact={compact} />
            ))
          )}
        </div>
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          flexShrink: 0,
          color: V.border,
        }}>
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
            <path d="M0 8h9M9 8l-4-4M9 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ValueChainLadder({
  bucketStates,
  compact = false,
  selectedBenchmark,
}: ValueChainLadderProps) {

  // Group states by stage (preserving official stage order)
  const stateByStage = new Map<AIInfraStage, AIInfraBucketState[]>()
  for (const stage of AI_INFRA_STAGE_ORDER) stateByStage.set(stage, [])
  for (const state of bucketStates) {
    const arr = stateByStage.get(state.stage as AIInfraStage)
    if (arr) arr.push(state)
  }

  // Safety: any states with unmapped stage → append to nearest stage
  const unmapped = bucketStates.filter(
    s => !AI_INFRA_STAGE_ORDER.includes(s.stage as AIInfraStage)
  )
  if (unmapped.length > 0 && stateByStage.has('STAGE_5_PHYSICAL_RESOURCE')) {
    stateByStage.get('STAGE_5_PHYSICAL_RESOURCE')!.push(...unmapped)
  }

  // Fallback
  if (bucketStates.length === 0) {
    return (
      <div style={{
        padding: '16px',
        background: V.bg2,
        border: `1px solid ${V.border}`,
        borderRadius: 4,
        fontFamily: V.mono, fontSize: 12, color: V.text3,
      }}>
        State label data not available. Value Chain Ladder will render once the API responds.
      </div>
    )
  }

  // Total bucket count validation (debug note if not 13)
  const totalBuckets = bucketStates.length
  const covered = AI_INFRA_STAGE_ORDER.every(s => stateByStage.has(s))

  return (
    <div style={{ width: '100%' }}>
      {/* Legend strip */}
      {!compact && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10,
          padding: '6px 10px',
          background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em',
          alignItems: 'center',
        }}>
          <span>VALUE CHAIN FLOW →</span>
          <span style={{ color: V.text3 }}>
            {totalBuckets} buckets · {AI_INFRA_STAGE_ORDER.length} stages
          </span>
          {selectedBenchmark && (
            <span style={{ marginLeft: 'auto', color: V.teal }}>
              {selectedBenchmark}
            </span>
          )}
          <span style={{ color: V.text3 }}>
            Rule-based · Not investment advice
          </span>
        </div>
      )}

      {/* Stage columns — horizontal scroll on small screens */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        overflowX: 'auto',
        paddingBottom: 4,
        alignItems: 'stretch',
      }}>
        {AI_INFRA_STAGE_ORDER.map((stage, idx) => {
          const rows = stateByStage.get(stage) ?? []
          return (
            <StageColumn
              key={stage}
              stage={stage}
              stateRows={rows}
              compact={compact}
              isLast={idx === AI_INFRA_STAGE_ORDER.length - 1}
            />
          )
        })}
      </div>

      {/* Coverage footnote */}
      {!compact && !covered && (
        <div style={{
          marginTop: 6, fontFamily: V.mono, fontSize: 10, color: V.text3,
          letterSpacing: '0.06em',
        }}>
          Some stages have no data — check API response.
        </div>
      )}
    </div>
  )
}

// ── Named re-export for optional destructured import ─────────────────────────
export { ValueChainLadder }
