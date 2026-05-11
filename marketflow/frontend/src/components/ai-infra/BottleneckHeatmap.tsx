'use client'
// AI Bottleneck Radar — Bottleneck Heatmap — Phase F-2
// 13개 AI 인프라 버킷의 State / RS / Return / Purity / Risk / Coverage 비교 테이블

import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import { fmtRS, rsColor } from '@/lib/semiconductor/aiInfraBucketRS'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS, getRSForBenchmark } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraBenchmarkKey } from '@/lib/ai-infra/aiInfraStateLabels'
import { AI_INFRA_BUCKETS, AI_INFRA_STAGE_LABEL, AI_INFRA_STAGE_ORDER } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage } from '@/lib/semiconductor/aiInfraBucketMap'
import { THEME_PURITY_LABEL } from '@/lib/ai-infra/aiInfraThemePurity'
import type { ThemePurity } from '@/lib/ai-infra/aiInfraThemePurity'

// ── Design tokens ──────────────────────────────────────────────────────────────

const V = {
  teal: '#3FB6A8', red: '#E55A5A', amber: '#F2A93B', gold: '#D4B36A', mint: '#5DCFB0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── Props ──────────────────────────────────────────────────────────────────────

export type BottleneckHeatmapProps = {
  bucketStates:       AIInfraBucketState[]
  buckets?:           AIInfraBucketMomentum[]
  selectedBenchmark?: 'SOXX' | 'QQQ' | 'SPY'
  compact?:           boolean
}

// ── Row ordering: follow AI_INFRA_BUCKETS stage order ─────────────────────────

const ORDERED_BUCKET_IDS = AI_INFRA_BUCKETS.map(b => b.bucket_id)

// ── Color helpers ──────────────────────────────────────────────────────────────

function purityColor(p: ThemePurity | undefined): string {
  if (!p) return V.text3
  if (p === 'PURE_PLAY')   return V.teal
  if (p === 'STORY_HEAVY') return V.amber
  return V.text2
}

function covColor(ratio: number): string {
  if (ratio >= 0.8) return V.teal
  if (ratio >= 0.5) return V.gold
  return V.red
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%'
}

function fmtCov(ratio: number): string {
  return Math.round(ratio * 100) + '%'
}

// ── Risk flags → condensed display ────────────────────────────────────────────

type RiskChip = { label: string; color: string }

function deriveRiskChips(riskFlags: string[]): RiskChip[] {
  const chips: RiskChip[] = []
  if (riskFlags.includes('COMMERCIALIZATION_UNCERTAINTY'))
    chips.push({ label: 'Comm.Risk', color: V.red })
  if (riskFlags.includes('OVERHEAT_RISK'))
    chips.push({ label: 'Overheat', color: V.amber })
  if (riskFlags.includes('LOW_COVERAGE'))
    chips.push({ label: 'LowCov', color: V.text3 })
  if (riskFlags.includes('BENCHMARK_MISSING'))
    chips.push({ label: 'NoBM', color: V.text3 })
  return chips
}

// ── Stage accent ───────────────────────────────────────────────────────────────

const STAGE_ACCENT: Record<AIInfraStage, string> = {
  STAGE_1_AI_CHIP:                    '#3FB6A8',
  STAGE_2_MEMORY_PACKAGING:           '#5DCFB0',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: '#4A9EE0',
  STAGE_4_EXTERNAL_INFRA:             '#9B87D4',
  STAGE_5_PHYSICAL_RESOURCE:          '#B8C8DC',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StateBadge({ label }: { label: string }) {
  const stateLabel = label as keyof typeof STATE_COLORS
  return (
    <span style={{
      display: 'inline-block', padding: '1px 5px', borderRadius: 3,
      fontSize: 10, fontFamily: V.ui, fontWeight: 700, letterSpacing: '0.05em',
      color: '#0f1117', backgroundColor: STATE_COLORS[stateLabel] ?? V.text3,
    }}>
      {STATE_DISPLAY_LABELS[stateLabel] ?? label}
    </span>
  )
}

function StageHeaderRow({ stage, colCount }: { stage: AIInfraStage; colCount: number }) {
  const accent = STAGE_ACCENT[stage]
  return (
    <tr>
      <td colSpan={colCount} style={{
        padding: '6px 8px 3px',
        fontFamily: V.mono, fontSize: 10, fontWeight: 700,
        color: accent, letterSpacing: '0.10em',
        background: `${accent}08`,
        borderTop: `1px solid ${accent}22`,
      }}>
        {AI_INFRA_STAGE_LABEL[stage]?.toUpperCase()}
      </td>
    </tr>
  )
}

// ── Table header style ─────────────────────────────────────────────────────────

function thStyle(align: 'left' | 'right' | 'center' = 'right', highlighted = false): React.CSSProperties {
  return {
    padding: '5px 7px', fontFamily: V.mono, fontSize: 10, fontWeight: 700,
    color: highlighted ? V.teal : V.text2, letterSpacing: '0.10em',
    textAlign: align, whiteSpace: 'nowrap',
    borderBottom: highlighted ? `2px solid ${V.teal}` : `1px solid ${V.border}`,
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BottleneckHeatmap({
  bucketStates,
  buckets = [],
  selectedBenchmark = 'SOXX',
  compact = false,
}: BottleneckHeatmapProps) {

  if (bucketStates.length === 0) {
    return (
      <div style={{
        padding: 16, background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
        fontFamily: V.mono, fontSize: 12, color: V.text3,
      }}>
        State label data not available. Heatmap will render once the API responds.
      </div>
    )
  }

  // Build lookup maps
  const stateMap = new Map(bucketStates.map(s => [s.bucket_id, s]))
  const momentumMap = new Map(buckets.map(b => [b.bucket_id, b]))

  // Order rows by stage / bucket definition order
  const orderedRows = ORDERED_BUCKET_IDS
    .map(id => stateMap.get(id))
    .filter((s): s is AIInfraBucketState => s != null)

  // Group by stage for stage header insertion
  type GroupedRow = { type: 'header'; stage: AIInfraStage } | { type: 'row'; state: AIInfraBucketState }
  const rows: GroupedRow[] = []
  let lastStage: AIInfraStage | null = null
  for (const state of orderedRows) {
    const stage = state.stage as AIInfraStage
    if (stage !== lastStage) {
      rows.push({ type: 'header', stage })
      lastStage = stage
    }
    rows.push({ type: 'row', state })
  }

  const bm = selectedBenchmark as AIInfraBenchmarkKey
  const COL_COUNT = 10

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Legend */}
      {!compact && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8,
          padding: '5px 10px',
          background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em',
          alignItems: 'center',
        }}>
          <span>BOTTLENECK HEATMAP</span>
          <span>{orderedRows.length} buckets</span>
          <span style={{ color: V.teal }}>BM: {selectedBenchmark}</span>
          <span style={{ marginLeft: 'auto' }}>Rule-based · Not investment advice</span>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${V.border}` }}>
            <th style={thStyle('left')}>BUCKET</th>
            <th style={thStyle('left')}>STATE</th>
            <th style={thStyle('right')}>SCORE</th>
            <th style={thStyle('right', true)}>1M RS</th>
            <th style={thStyle('right', true)}>3M RS</th>
            <th style={thStyle('right', true)}>6M RS</th>
            <th style={thStyle('right')}>RET 3M</th>
            <th style={thStyle('left')}>PURITY</th>
            <th style={thStyle('left')}>RISK</th>
            <th style={thStyle('right')}>COV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.type === 'header') {
              return <StageHeaderRow key={`hd-${row.stage}`} stage={row.stage} colCount={COL_COUNT} />
            }

            const s   = row.state
            const mom = momentumMap.get(s.bucket_id)
            const rs  = mom ? getRSForBenchmark(mom, bm) : null
            const ret3m = mom?.returns.three_month ?? null
            const cov   = s.source.coverage_ratio
            const purity = s.theme_purity?.theme_purity
            const riskChips = deriveRiskChips(s.risk_flags)
            const stageAccent = STAGE_ACCENT[s.stage as AIInfraStage] ?? V.text3

            const tdBase: React.CSSProperties = {
              borderBottom: `1px solid ${V.border}`,
              padding: compact ? '5px 7px' : '6px 8px',
            }

            return (
              <tr key={s.bucket_id}>
                {/* Bucket name */}
                <td style={{ ...tdBase, maxWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      width: 3, height: 14, borderRadius: 2, flexShrink: 0,
                      backgroundColor: stageAccent,
                    }} />
                    <span style={{
                      fontFamily: V.ui, fontSize: 12, color: V.text2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.display_name}
                    </span>
                  </div>
                </td>

                {/* State badge */}
                <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                  <StateBadge label={s.state_label} />
                </td>

                {/* Score */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: V.text, textAlign: 'right' }}>
                  {s.state_score ?? '—'}
                </td>

                {/* RS 1M vs benchmark */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: rsColor(rs?.one_month ?? null), textAlign: 'right' }}>
                  {fmtRS(rs?.one_month ?? null)}
                </td>

                {/* RS 3M vs benchmark */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: rsColor(rs?.three_month ?? null), textAlign: 'right' }}>
                  {fmtRS(rs?.three_month ?? null)}
                </td>

                {/* RS 6M vs benchmark */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: rsColor(rs?.six_month ?? null), textAlign: 'right' }}>
                  {fmtRS(rs?.six_month ?? null)}
                </td>

                {/* Basket return 3M */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: rsColor(ret3m), textAlign: 'right' }}>
                  {fmtPct(ret3m)}
                </td>

                {/* Theme purity */}
                <td style={{ ...tdBase }}>
                  {purity ? (
                    <span style={{
                      fontFamily: V.mono, fontSize: 10, letterSpacing: '0.05em',
                      color: purityColor(purity),
                    }}>
                      {THEME_PURITY_LABEL[purity]}
                    </span>
                  ) : (
                    <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>—</span>
                  )}
                </td>

                {/* Risk flags */}
                <td style={{ ...tdBase }}>
                  {riskChips.length === 0 ? (
                    <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>—</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {riskChips.map(chip => (
                        <span key={chip.label} style={{
                          fontFamily: V.mono, fontSize: 10, letterSpacing: '0.04em',
                          color: chip.color,
                          background: `${chip.color}15`,
                          border: `1px solid ${chip.color}35`,
                          borderRadius: 2, padding: '0 4px',
                        }}>
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Coverage */}
                <td style={{ ...tdBase, fontFamily: V.mono, fontSize: 12, color: covColor(cov), textAlign: 'right' }}>
                  {fmtCov(cov)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Color legend */}
      {!compact && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8,
          fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em',
        }}>
          <span>RS Color:</span>
          {[
            { label: 'Strong +', color: '#22c55e' },
            { label: '+',        color: V.teal },
            { label: 'Neutral',  color: V.text2 },
            { label: '-',        color: V.amber },
            { label: 'Weak -',   color: V.red },
          ].map(({ label, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: color, flexShrink: 0 }} />
              <span style={{ color }}>{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Named re-export
export { BottleneckHeatmap }
