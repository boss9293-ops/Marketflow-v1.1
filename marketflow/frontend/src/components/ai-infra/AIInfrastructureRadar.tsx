'use client'
// AI Bottleneck Radar 메인 컴포넌트 — D-6 컨트롤 / 스테이지 그루핑 / UX 개선

import { useEffect, useState } from 'react'
import type { AIInfraBucketMomentum, AIInfraBenchmarkReturns } from '@/lib/semiconductor/aiInfraBucketRS'
import { fmtPct, fmtRS, rsColor } from '@/lib/semiconductor/aiInfraBucketRS'
import { AI_INFRA_STAGE_LABEL, AI_INFRA_STAGE_ORDER } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS } from '@/lib/ai-infra/aiInfraStateLabels'
import { THEME_PURITY_LABEL, REVENUE_VIS_LABEL } from '@/lib/ai-infra/aiInfraThemePurity'
import type { BucketThemePurity } from '@/lib/ai-infra/aiInfraThemePurity'
import { buildBucketCompanyPuritySummary } from '@/lib/ai-infra/aiInfraCompanyPurity'
import type { AIInfraCompanyPurityMetadata } from '@/lib/ai-infra/aiInfraCompanyPurity'
import { BucketRRGPanel } from '@/components/semiconductor/BucketRRGPanel'
import ValueChainLadder from '@/components/ai-infra/ValueChainLadder'
import BottleneckHeatmap from '@/components/ai-infra/BottleneckHeatmap'
import { adaptAllLayers } from '@/lib/ai-investment-tower/reportTypes'
import { adaptTowerLayers, AI_INVESTMENT_TOWER_LAYERS } from '@/lib/ai-investment-tower/aiInvestmentTowerLayers'
import { generateBeginnerReport, generateBeginnerOverall } from '@/lib/ai-investment-tower/beginnerReportGenerator'
import { generateProReport } from '@/lib/ai-investment-tower/proReportGenerator'
import { BeginnerReport } from '@/components/ai-investment-tower/BeginnerReport'
import { ProReport } from '@/components/ai-investment-tower/ProReport'
import { AITowerSummaryCards } from '@/components/ai-investment-tower/AITowerSummaryCards'
import { buildTowerSummary } from '@/lib/ai-investment-tower/towerSummary'
import { SelectedLayerDetailPanel } from '@/components/ai-investment-tower/SelectedLayerDetailPanel'
import type { SelectedLayerDetail } from '@/components/ai-investment-tower/SelectedLayerDetailPanel'
import { SelectedLayerTrendChart } from '@/components/ai-investment-tower/SelectedLayerTrendChart'
import { AIInvestmentLayerRRGBoard } from '@/components/ai-investment-tower/AIInvestmentLayerRRGBoard'
import type { LayerRRGBoardItem } from '@/components/ai-investment-tower/AIInvestmentLayerRRGBoard'
import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import type { InfrastructureCycleContext } from '@/lib/ai-infra/infrastructureCycleContext'
import { normalizeCyclePhase, deriveSOXXJudgment, normalizeSOXLEnvironment, normalizeCycleConfidence, normalizeConflictMode } from '@/lib/ai-infra/infrastructureCycleContext'
import type { InfraToSoxxTranslation } from '@/lib/ai-infra/infraToSoxxTranslation'
import type { InfraHistoricalAnalog } from '@/lib/ai-infra/infraHistoricalAnalogs'
import type { InfraEducationalNarrative } from '@/lib/ai-infra/infraEducationalNarrative'
import { InfraBridgeCompactSummary } from './InfraBridgeCompactSummary'
import { EarningsConfirmationPanel } from './EarningsConfirmationPanel'
import type { AIInfraBucketEarningsConfirmation, AIInfraEarningsEvidence } from '@/lib/ai-infra/aiInfraEarningsConfirmation'

// ── Design tokens ──────────────────────────────────────────────────────────────

const V = {
  teal: '#3FB6A8', red: '#E55A5A', amber: '#F2A93B', gold: '#D4B36A', mint: '#5DCFB0',
  blue: '#4A9EE0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab  = 'ladder' | 'heatmap' | 'earnings' | 'state' | 'rs' | 'rrg'
type Benchmark  = 'SOXX' | 'QQQ' | 'SPY'

interface RadarApiResponse {
  buckets?:                     AIInfraBucketMomentum[]
  bucket_states?:               AIInfraBucketState[]
  benchmarks?:                  AIInfraBenchmarkReturns
  asOf?:                        string | null
  generated_at?:                string
  data_notes?:                  string[]
  status?:                      string
  selected_benchmark?:          string
  company_purity?:              AIInfraCompanyPurityMetadata[]
  infra_to_soxx_translation?:   InfraToSoxxTranslation
  infra_historical_analog?:     InfraHistoricalAnalog
  infra_educational_narrative?: InfraEducationalNarrative
  earnings_confirmation?: {
    buckets:   AIInfraBucketEarningsConfirmation[]
    companies: AIInfraEarningsEvidence[]
    summary: {
      confirmed_buckets:     number
      partial_buckets:       number
      watch_buckets:         number
      not_confirmed_buckets: number
      data_limited_buckets:  number
      coverage_ratio:        number
      as_of?:                string
    }
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LABEL_PRIORITY: AIInfraStateLabel[] = [
  'LEADING', 'EMERGING', 'CONFIRMING', 'CROWDED',
  'DISTRIBUTION', 'LAGGING', 'STORY_ONLY', 'DATA_INSUFFICIENT',
]

const BM_LABELS: Record<Benchmark, string> = { SOXX: 'SOXX', QQQ: 'QQQ', SPY: 'SPY' }

// ── Helpers ────────────────────────────────────────────────────────────────────

function firstByLabel(states: AIInfraBucketState[], label: AIInfraStateLabel) {
  return states.find(s => s.state_label === label)
}

function fmtBm(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function groupByStage<T extends { stage: AIInfraStage }>(items: T[]): [AIInfraStage, T[]][] {
  const map = new Map<AIInfraStage, T[]>()
  for (const item of items) {
    const arr = map.get(item.stage) ?? []
    arr.push(item)
    map.set(item.stage, arr)
  }
  return AI_INFRA_STAGE_ORDER
    .filter(s => map.has(s))
    .map(s => [s, map.get(s)!])
}

// ── Atomic UI ─────────────────────────────────────────────────────────────────

function StateBadge({ label }: { label: AIInfraStateLabel }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 3,
      fontSize: 11, fontFamily: V.ui, fontWeight: 700, letterSpacing: '0.07em',
      color: '#0f1117', backgroundColor: STATE_COLORS[label],
    }}>
      {STATE_DISPLAY_LABELS[label]}
    </span>
  )
}

function ConfidenceDot({ c }: { c: string }) {
  const col = c === 'HIGH' ? V.teal : c === 'MEDIUM' ? V.gold : V.text3
  return <span style={{ fontFamily: V.mono, fontSize: 12, color: col }}>{c}</span>
}

function PurityBadges({ purity }: { purity: BucketThemePurity }) {
  const purityColor = purity.theme_purity === 'PURE_PLAY' || purity.theme_purity === 'HIGH_EXPOSURE'
    ? V.teal
    : purity.theme_purity === 'STORY_HEAVY'
      ? V.amber
      : purity.theme_purity === 'INDIRECT_EXPOSURE'
        ? V.text3
        : purity.theme_purity === 'MIXED_EXPOSURE'
          ? V.gold
          : V.text2
  const badgeStyle = (col: string): React.CSSProperties => ({
    fontFamily: V.mono, fontSize: 10, color: col,
    background: `${col}18`, border: `1px solid ${col}40`,
    borderRadius: 3, padding: '0 5px', letterSpacing: '0.05em',
    display: 'inline-block',
  })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      <span style={badgeStyle(purityColor)}>{THEME_PURITY_LABEL[purity.theme_purity]}</span>
      {(purity.revenue_visibility === 'NOT_YET_VISIBLE' || purity.revenue_visibility === 'UNCLEAR') && (
        <span style={badgeStyle(V.amber)}>{REVENUE_VIS_LABEL[purity.revenue_visibility]}</span>
      )}
      {purity.commercialization_risk && (
        <span style={badgeStyle(V.red)}>상용화 불확실</span>
      )}
    </div>
  )
}

function StageHeader({ stage }: { stage: AIInfraStage }) {
  return (
    <tr>
      <td colSpan={10} style={{
        padding: '8px 8px 4px',
        fontFamily: V.mono, fontSize: 10, fontWeight: 700,
        color: V.teal, letterSpacing: '0.10em',
        background: 'rgba(63,182,168,0.04)',
        borderTop: `1px solid ${V.teal}22`,
      }}>
        {AI_INFRA_STAGE_LABEL[stage]?.toUpperCase()}
      </td>
    </tr>
  )
}

// ── Controls Bar ──────────────────────────────────────────────────────────────

function ControlBar({
  benchmark, setBenchmark,
  grouped, setGrouped,
  serverBenchmark,
}: {
  benchmark: Benchmark
  setBenchmark: (b: Benchmark) => void
  grouped: boolean
  setGrouped: (g: boolean) => void
  serverBenchmark?: string
}) {
  const btnBase: React.CSSProperties = {
    padding: '4px 12px', borderRadius: 3, border: '1px solid',
    background: 'transparent', cursor: 'pointer',
    fontFamily: V.mono, fontSize: 12, letterSpacing: '0.08em',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      padding: '8px 12px', marginBottom: 12,
      background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
    }}>
      {/* Benchmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.08em' }}>
          BENCHMARK
        </span>
        {(['SOXX', 'QQQ', 'SPY'] as Benchmark[]).map(b => (
          <button
            key={b}
            onClick={() => setBenchmark(b)}
            style={{
              ...btnBase,
              borderColor: benchmark === b ? V.teal : V.border,
              color: benchmark === b ? V.teal : V.text2,
            }}
          >
            {BM_LABELS[b]}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: V.border }} />

      {/* Stage grouping */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.08em' }}>
          GROUP BY STAGE
        </span>
        <button
          onClick={() => setGrouped(!grouped)}
          style={{
            ...btnBase,
            borderColor: grouped ? V.teal : V.border,
            color: grouped ? V.teal : V.text2,
          }}
        >
          {grouped ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Show warning only if server-reported benchmark doesn't match requested */}
      {serverBenchmark != null && serverBenchmark !== benchmark && (
        <span style={{
          marginLeft: 'auto',
          fontFamily: V.ui, fontSize: 10, color: V.gold,
          padding: '2px 7px', border: `1px solid ${V.gold}44`,
          borderRadius: 3, letterSpacing: '0.04em',
        }}>
          State labels using {serverBenchmark} (fallback)
        </span>
      )}
    </div>
  )
}

// ── Data Quality Badges ───────────────────────────────────────────────────────

function DataQualityBadges({
  states, buckets, benchmark,
}: {
  states: AIInfraBucketState[]
  buckets: AIInfraBucketMomentum[]
  benchmark: Benchmark
}) {
  const total   = states.length || buckets.length
  const partial = states.filter(s =>
    s.source.data_quality === 'PARTIAL' || s.state_label === 'DATA_INSUFFICIENT'
  ).length || buckets.filter(b => b.coverage.data_quality !== 'REAL').length

  const badges = [
    { label: 'COVERAGE',     value: `${total} buckets / ${partial} partial` },
    { label: 'STATE METHOD', value: 'rule-based' },
    { label: 'EARNINGS',     value: 'not included' },
    { label: 'BENCHMARK',    value: benchmark },
  ]

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12,
    }}>
      {badges.map(({ label, value }) => (
        <span key={label} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 3,
          border: `1px solid ${V.border}`, background: V.bg2,
        }}>
          <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.08em' }}>
            {label}
          </span>
          <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text }}>
            {value}
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Summary Strip ─────────────────────────────────────────────────────────────

function SummaryStrip({
  states, asOf, benchmark,
}: {
  states: AIInfraBucketState[]
  asOf?: string | null
  benchmark: Benchmark
}) {
  const leading      = firstByLabel(states, 'LEADING')
  const emerging     = firstByLabel(states, 'EMERGING')
  const crowded      = firstByLabel(states, 'CROWDED')
  const distributing = firstByLabel(states, 'DISTRIBUTION')
  const usable       = states.filter(s => s.state_label !== 'DATA_INSUFFICIENT').length
  const total        = states.length

  type Strip = { label: string; name: string | null; score: number | null; color: string }
  const items: Strip[] = [
    { label: 'Leading',      name: leading?.display_name      ?? null, score: leading?.state_score      ?? null, color: STATE_COLORS['LEADING'] },
    { label: 'Emerging',     name: emerging?.display_name     ?? null, score: emerging?.state_score     ?? null, color: STATE_COLORS['EMERGING'] },
    { label: 'Crowded',      name: crowded?.display_name      ?? null, score: crowded?.state_score      ?? null, color: STATE_COLORS['CROWDED'] },
    { label: 'Distribution', name: distributing?.display_name ?? null, score: distributing?.state_score ?? null, color: STATE_COLORS['DISTRIBUTION'] },
  ]

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 0,
      background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
    }}>
      {items.map(({ label, name, score, color }, i) => (
        <div
          key={label}
          style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            padding: '10px 16px', minWidth: 150, flex: '1 1 150px',
            borderRight: i < items.length - 1 ? `1px solid ${V.border}` : undefined,
          }}
        >
          <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.08em' }}>
            {label.toUpperCase()}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: V.ui, fontSize: 13, fontWeight: 700, color: name ? color : V.text2 }}>
              {name ?? 'None'}
            </span>
            {score != null && (
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2 }}>· {score}</span>
            )}
          </div>
        </div>
      ))}
      {/* Coverage + Benchmark + date */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        padding: '10px 16px', minWidth: 160, flex: '1 1 160px',
        borderLeft: `1px solid ${V.border}`,
      }}>
        <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2, letterSpacing: '0.08em' }}>COVERAGE</span>
        <span style={{ fontFamily: V.ui, fontSize: 13, fontWeight: 700, color: V.text }}>
          {usable} / {total} buckets
        </span>
        <span style={{ fontFamily: V.mono, fontSize: 11, color: V.teal }}>{benchmark}</span>
        {asOf && <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3 }}>{asOf}</span>}
      </div>
    </div>
  )
}

// ── Company Purity Summary Grid ───────────────────────────────────────────────

function CompanyPuritySummaryGrid({ states }: { states: AIInfraBucketState[] }) {
  if (states.length === 0) return null
  const summaries = states.map(s => buildBucketCompanyPuritySummary(s.bucket_id as Parameters<typeof buildBucketCompanyPuritySummary>[0]))
  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 6 }}>
        COMPANY PURITY SUMMARY
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {summaries.map(sum => {
          const state = states.find(s => s.bucket_id === sum.bucket_id)
          return (
            <div key={sum.bucket_id} style={{
              padding: '5px 8px', borderRadius: 4,
              background: V.bg2, border: `1px solid ${V.border}`,
              minWidth: 140,
            }}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.08em', marginBottom: 3 }}>
                {state?.display_name ?? sum.bucket_id}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sum.average_ai_relevance_score != null && (
                  <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text2 }}>
                    AI {sum.average_ai_relevance_score}
                  </span>
                )}
                {sum.average_pure_play_score != null && (
                  <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
                    Purity {sum.average_pure_play_score}
                  </span>
                )}
                {sum.high_exposure_count > 0 && (
                  <span style={{ fontFamily: V.mono, fontSize: 10, color: V.mint }}>
                    Hi×{sum.high_exposure_count}
                  </span>
                )}
                {sum.story_risk_count > 0 && (
                  <span style={{ fontFamily: V.mono, fontSize: 10, color: V.amber }}>
                    Story×{sum.story_risk_count}
                  </span>
                )}
                {sum.indirect_exposure_count > 0 && (
                  <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
                    Ind×{sum.indirect_exposure_count}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── State Labels Table ────────────────────────────────────────────────────────

function StateLabelsTable({
  states, grouped,
}: {
  states: AIInfraBucketState[]
  grouped: boolean
}) {
  const sortFlat = (arr: AIInfraBucketState[]) =>
    [...arr].sort((a, b) => {
      const pa = LABEL_PRIORITY.indexOf(a.state_label)
      const pb = LABEL_PRIORITY.indexOf(b.state_label)
      if (pa !== pb) return pa - pb
      return (b.state_score ?? -1) - (a.state_score ?? -1)
    })

  const colStyle: React.CSSProperties = {
    padding: '5px 8px', fontFamily: V.mono, fontSize: 12, fontWeight: 700,
    color: V.text2, letterSpacing: '0.10em', textAlign: 'left',
  }

  const renderRows = (rows: AIInfraBucketState[]) =>
    rows.map(s => (
      <tr key={s.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
        <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.display_name}
        </td>
        <td style={{ padding: '7px 8px' }}>
          <StateBadge label={s.state_label} />
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: V.text, textAlign: 'right' }}>
          {s.state_score ?? '—'}
        </td>
        <td style={{ padding: '7px 8px', textAlign: 'center' }}>
          <ConfidenceDot c={s.confidence} />
        </td>
        {/* Purity badges */}
        <td style={{ padding: '7px 8px' }}>
          {s.theme_purity && <PurityBadges purity={s.theme_purity} />}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.state_reason}
        </td>
      </tr>
    ))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${V.border}` }}>
            {['Bucket', 'State', 'Score', 'Confidence', 'Purity', 'Reason'].map(h => (
              <th key={h} style={colStyle}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped
            ? groupByStage(states).map(([stage, rows]) => (
                <>
                  <StageHeader key={`hd-${stage}`} stage={stage} />
                  {renderRows(sortFlat(rows))}
                </>
              ))
            : renderRows(sortFlat(states))
          }
        </tbody>
      </table>
    </div>
  )
}

// ── Relative Strength Table ───────────────────────────────────────────────────

function RSTable({
  buckets, benchmarks, benchmark, grouped,
}: {
  buckets: AIInfraBucketMomentum[]
  benchmarks: AIInfraBenchmarkReturns
  benchmark: Benchmark
  grouped: boolean
}) {
  const bmKey = benchmark.toLowerCase() as 'soxx' | 'qqq' | 'spy'
  const rsOf  = (b: AIInfraBucketMomentum) => b.relative_strength[`vs_${bmKey}`].three_month

  const sortedFlat = [...buckets].sort((a, b) => (rsOf(b) ?? -Infinity) - (rsOf(a) ?? -Infinity))

  const hlCol: React.CSSProperties = { color: V.teal }

  const renderRow = (b: AIInfraBucketMomentum) => {
    const rs    = b.relative_strength[`vs_${bmKey}`]
    const rs3   = b.relative_strength.vs_soxx.three_month
    const rsq3  = b.relative_strength.vs_qqq.three_month
    const rss3  = b.relative_strength.vs_spy.three_month
    return (
      <tr key={b.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
        <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, whiteSpace: 'nowrap' }}>
          {b.display_name}
        </td>
        {/* Relative returns vs selected benchmark — change when benchmark switches */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs.one_month), textAlign: 'right' }}>
          {fmtRS(rs.one_month)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs.three_month), textAlign: 'right' }}>
          {fmtRS(rs.three_month)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs.six_month), textAlign: 'right' }}>
          {fmtRS(rs.six_month)}
        </td>
        {/* 3M RS vs each benchmark — reference columns */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs3), textAlign: 'right', ...(benchmark === 'SOXX' ? hlCol : {}) }}>
          {fmtRS(rs3)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rsq3), textAlign: 'right', ...(benchmark === 'QQQ' ? hlCol : {}) }}>
          {fmtRS(rsq3)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rss3), textAlign: 'right', ...(benchmark === 'SPY' ? hlCol : {}) }}>
          {fmtRS(rss3)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 10, color: b.coverage.data_quality === 'REAL' ? V.teal : V.gold, textAlign: 'right' }}>
          {b.coverage.priced_symbol_count}/{b.coverage.symbol_count}
        </td>
      </tr>
    )
  }

  const thStyle = (h: string, isSel: boolean): React.CSSProperties => ({
    padding: '5px 8px',
    fontFamily: V.mono, fontSize: 12, fontWeight: 700,
    color: isSel ? V.teal : V.text2, letterSpacing: '0.10em',
    textAlign: h === 'Bucket' ? 'left' : 'right', whiteSpace: 'nowrap',
    borderBottom: isSel ? `2px solid ${V.teal}` : `1px solid ${V.border}`,
  })

  const colHeaders = [
    { h: 'Bucket',              sel: false },
    { h: `1M vs ${benchmark}`,  sel: true },
    { h: `3M vs ${benchmark}`,  sel: true },
    { h: `6M vs ${benchmark}`,  sel: true },
    { h: 'RS SOXX',             sel: benchmark === 'SOXX' },
    { h: 'RS QQQ',              sel: benchmark === 'QQQ' },
    { h: 'RS SPY',              sel: benchmark === 'SPY' },
    { h: 'Cov',                 sel: false },
  ]

  const bmReturns = benchmarks[benchmark]

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {colHeaders.map(({ h, sel }) => (
              <th key={h} style={thStyle(h, sel)}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped
            ? groupByStage(buckets).map(([stage, rows]) => (
                <>
                  <StageHeader key={`hd-${stage}`} stage={stage} />
                  {[...rows]
                    .sort((a, b) => (rsOf(b) ?? -Infinity) - (rsOf(a) ?? -Infinity))
                    .map(renderRow)
                  }
                </>
              ))
            : sortedFlat.map(renderRow)
          }
          {/* Benchmark reference row */}
          <tr style={{ borderTop: `1px solid ${V.border}`, background: V.bg2 }}>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
              {benchmark} BM
            </td>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(bmReturns.one_month)}</td>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(bmReturns.three_month)}</td>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(bmReturns.six_month)}</td>
            <td colSpan={4} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: ActiveTab; onChange: (t: ActiveTab) => void }) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'ladder',   label: 'VALUE CHAIN' },
    { id: 'heatmap',  label: 'HEATMAP' },
    { id: 'earnings', label: 'EARNINGS' },
    { id: 'state',    label: 'STATE LABELS' },
    { id: 'rs',       label: 'RELATIVE STRENGTH' },
    { id: 'rrg',      label: 'RRG' },
  ]
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${V.border}`, marginBottom: 12 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 14px', border: 'none',
            borderBottom: active === t.id ? `2px solid ${V.teal}` : '2px solid transparent',
            background: 'transparent',
            color: active === t.id ? V.teal : V.text2,
            fontFamily: V.mono, fontSize: 12, fontWeight: 700,
            letterSpacing: '0.10em', cursor: 'pointer', marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AIInfrastructureRadar() {
  const [data, setData]         = useState<RadarApiResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<ActiveTab>('ladder')
  const [benchmark, setBenchmark] = useState<Benchmark>('SOXX')
  const [grouped, setGrouped]   = useState(false)
  const [reportMode, setReportMode] = useState<'beginner' | 'pro'>('beginner')
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [cycleCtx, setCycleCtx] = useState<InfrastructureCycleContext | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      // Step 1: Fetch semiconductor cycle context for cross-layer conflict detection (silent fail)
      let cyclePhase: string | null = null
      let cycleSoxx:  string | null = null
      let cycleSoxl:  string | null = null
      try {
        const r = await fetch('/api/semiconductor')
        if (r.ok) {
          const semData = await r.json() as SemiconductorOutput
          const phase = normalizeCyclePhase(semData.stage?.stage)
          const soxx  = deriveSOXXJudgment(phase, semData.stage?.conflict_mode ?? false)
          const soxl  = normalizeSOXLEnvironment(semData.translation?.soxl?.window)
          if (phase !== 'UNKNOWN') cyclePhase = phase
          if (soxx  !== 'UNKNOWN') cycleSoxx  = soxx
          if (soxl  !== 'UNKNOWN') cycleSoxl  = soxl
          const ctx: InfrastructureCycleContext = {
            cycle_score:      semData.stage?.stage_score ?? null,
            cycle_phase:      phase,
            cycle_confidence: normalizeCycleConfidence(semData.stage?.confidence),
            soxx_judgment:    soxx,
            soxl_environment: soxl,
            conflict_mode:    normalizeConflictMode(semData.stage?.conflict_mode ?? false),
            source:           { from: 'SEMICONDUCTOR_LENS' },
          }
          if (!cancelled) setCycleCtx(ctx)
        }
      } catch { /* silent — cycle params remain null, conflict detection gracefully disabled */ }

      if (cancelled) return

      // Step 2: Fetch theme-momentum with cycle params for BR-2/BR-3/BR-4
      try {
        const qp = new URLSearchParams({ benchmark })
        if (cyclePhase) qp.set('cycle_phase', cyclePhase)
        if (cycleSoxx)  qp.set('cycle_soxx_judgment', cycleSoxx)
        if (cycleSoxl)  qp.set('cycle_soxl_environment', cycleSoxl)
        const r = await fetch(`/api/ai-infra/theme-momentum?${qp}`)
        const d = await r.json() as RadarApiResponse
        if (!cancelled) setData(d)
      } catch {
        if (!cancelled) setError('Failed to load radar data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [benchmark])

  const states        = data?.bucket_states ?? []
  const buckets       = data?.buckets ?? []
  const towerBuckets  = (data as Record<string, unknown>)?.tower_buckets as typeof buckets ?? []
  const towerStates   = (data as Record<string, unknown>)?.tower_states as typeof states ?? []
  const bms           = data?.benchmarks

  // Compact data notes (filter long disclaimers)
  const dataNotes = (data?.data_notes ?? [])
    .filter(n => !n.startsWith('State labels are recalculated'))
    .slice(0, 2)

  return (
    <section style={{ minHeight: '100vh', background: V.bg, padding: '16px 20px', color: V.text }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>

        <InfraBridgeCompactSummary
          cycleCtx={cycleCtx}
          translation={data?.infra_to_soxx_translation ?? null}
          analog={data?.infra_historical_analog ?? null}
          narrative={data?.infra_educational_narrative ?? null}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4 }}>
              AI BOTTLENECK RADAR
            </div>
            <div style={{ fontFamily: V.ui, fontSize: 20, fontWeight: 900, color: V.text, marginBottom: 4 }}>
              AI Infrastructure Rotation
            </div>
            <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text2 }}>
              Price-based rotation signals across 13 AI infrastructure buckets. Rule-based. Not investment advice.
            </div>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: 3,
            border: `1px solid ${V.teal}44`, background: `${V.teal}0D`,
            fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.08em',
            flexShrink: 0,
          }}>
          E-2B
          </span>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '24px 0' }}>
            Loading radar data…
          </div>
        )}
        {error && (
          <div style={{ fontFamily: V.mono, fontSize: 12, color: V.red, padding: '24px 0' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Report mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
              {(['beginner', 'pro'] as const).map((mode) => {
                const label = mode === 'beginner' ? '쉽게 보기' : '자세히 보기'
                const active = reportMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setReportMode(mode)}
                    style={{
                      padding:       '5px 16px',
                      border:        `1px solid ${active ? V.teal : V.border}`,
                      borderRadius:  20,
                      background:    active ? `${V.teal}18` : 'transparent',
                      color:         active ? V.teal : V.text3,
                      fontFamily:    V.ui,
                      fontSize:      13,
                      fontWeight:    active ? 700 : 400,
                      cursor:        'pointer',
                      transition:    'all 0.1s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Controls */}
            <ControlBar
              benchmark={benchmark} setBenchmark={setBenchmark}
              grouped={grouped} setGrouped={setGrouped}
              serverBenchmark={data?.selected_benchmark}
            />

            {/* Summary Strip */}
            {states.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <SummaryStrip states={states} asOf={data?.asOf ?? null} benchmark={benchmark} />
              </div>
            )}

            {/* Data Quality Badges */}
            <DataQualityBadges states={states} buckets={buckets} benchmark={benchmark} />

            {/* Inline data notes */}
            {dataNotes.length > 0 && (
              <div style={{
                marginBottom: 12, padding: '6px 12px',
                background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
                fontFamily: V.ui, fontSize: 12, color: V.text2, lineHeight: 1.5,
              }}>
                {dataNotes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}

            {/* ── 리포트 섹션 (10-레이어 기준, 모드에 따라 다른 뷰) ── */}
            {(() => {
              const towerInputs    = (states.length > 0 && buckets.length > 0)
                ? adaptTowerLayers(buckets, states, towerBuckets, towerStates) : []
              const beginnerReports = generateBeginnerReport(towerInputs)
              const proReports      = generateProReport(towerInputs)
              const towerSummary    = buildTowerSummary(beginnerReports)

              // Auto-select: first leadership → first available
              const activeLayerId = selectedLayerId
                ?? beginnerReports.find(r => r.group === 'working')?.layerId
                ?? beginnerReports[0]?.layerId
                ?? null

              // Build selected layer detail
              const selInput    = towerInputs.find(l => l.id === activeLayerId)
              const selBeginner = beginnerReports.find(r => r.layerId === activeLayerId)
              const selPro      = proReports.find(r => r.layerId === activeLayerId)
              const selLayerDef = AI_INVESTMENT_TOWER_LAYERS.find(l => l.id === activeLayerId)

              const detail: SelectedLayerDetail | null =
                (selInput && selBeginner && selLayerDef) ? {
                  layerId:        activeLayerId!,
                  label:          selInput.label,
                  koreanLabel:    selInput.koreanLabel,
                  primaryEtf:     selInput.primaryEtf,
                  basketSymbols:  selLayerDef.basketSymbols,
                  statusLabel:    selBeginner.statusLabel,
                  momentum1w:     selInput.momentum1w,
                  momentum1m:     selInput.momentum1m,
                  momentum3m:     selInput.momentum3m,
                  trendLabel:     selInput.trendLabel,
                  breadthLabel:   selInput.breadthLabel,
                  riskLabel:      selInput.riskLabel,
                  coveragePct:    selInput.coveragePct ?? null,
                  nextCheckpoint: selPro?.nextCheckpoint,
                  narrative:      selBeginner.explanation,
                } : null

              // Build RRG board items from pro + beginner reports
              const boardItems: LayerRRGBoardItem[] = proReports.map(pr => {
                const br = beginnerReports.find(b => b.layerId === pr.layerId)
                return {
                  layerId:     pr.layerId,
                  koreanLabel: pr.koreanLabel,
                  statusLabel: br?.statusLabel ?? '확인 필요',
                  rrgState:    pr.rrgState,
                  riskLabel:   pr.riskLabel,
                  signal:      pr.towerSignal,
                }
              })

              return (
                <>
                  <AITowerSummaryCards summary={towerSummary} />
                  {reportMode === 'beginner' ? (
                    <BeginnerReport
                      reports={beginnerReports}
                      overallNarrative={generateBeginnerOverall(beginnerReports)}
                    />
                  ) : (
                    proReports.length > 0
                      ? <ProReport
                          reports={proReports}
                          onSelectLayer={setSelectedLayerId}
                        />
                      : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>No layer data available.</div>
                  )}
                  <SelectedLayerDetailPanel detail={detail} />
                  {activeLayerId && (
                    <SelectedLayerTrendChart
                      layerId={activeLayerId}
                      koreanLabel={selInput?.koreanLabel ?? ''}
                    />
                  )}
                  {boardItems.length > 0 && (
                    <AIInvestmentLayerRRGBoard
                      items={boardItems}
                      selectedLayerId={activeLayerId}
                      onSelectLayer={setSelectedLayerId}
                    />
                  )}
                </>
              )
            })()}

            {/* ── 기존 탭 (항상 표시) ── */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${V.border}` }}>
              <TabBar active={tab} onChange={setTab} />
              {tab === 'ladder' && (
                states.length > 0
                  ? <ValueChainLadder
                      bucketStates={states}
                      buckets={buckets}
                      compact={false}
                      selectedBenchmark={benchmark}
                    />
                  : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                      State label data not available. Value chain will render once API responds.
                    </div>
              )}
              {tab === 'heatmap' && (
                states.length > 0
                  ? <BottleneckHeatmap
                      bucketStates={states}
                      buckets={buckets}
                      selectedBenchmark={benchmark}
                    />
                  : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                      State label data not available.
                    </div>
              )}
              {tab === 'earnings' && (
                <EarningsConfirmationPanel earningsConfirmation={data?.earnings_confirmation} />
              )}
              {tab === 'state' && (
                states.length > 0
                  ? <>
                      <StateLabelsTable states={states} grouped={grouped} />
                      <CompanyPuritySummaryGrid states={states} />
                    </>
                  : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                      State label data not available.
                    </div>
              )}
              {tab === 'rs' && (
                buckets.length > 0 && bms
                  ? <RSTable buckets={buckets} benchmarks={bms} benchmark={benchmark} grouped={grouped} />
                  : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                      Relative strength data not available.
                    </div>
              )}
              {tab === 'rrg' && <BucketRRGPanel benchmark={benchmark} />}
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 16, fontFamily: V.ui, fontSize: 10,
          color: V.text3, letterSpacing: '0.06em', lineHeight: 1.6,
        }}>
          State labels are rule-based and price/RRG-driven. They do not include earnings confirmation or investment recommendations.
          This panel is a rotation observation tool, not a trading signal system.
        </div>

      </div>
    </section>
  )
}
