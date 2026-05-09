'use client'
// AI Bottleneck Radar 메인 컴포넌트 — D-6 컨트롤 / 스테이지 그루핑 / UX 개선

import { useEffect, useState } from 'react'
import type { AIInfraBucketMomentum, AIInfraBenchmarkReturns } from '@/lib/semiconductor/aiInfraBucketRS'
import { fmtPct, fmtRS, rsColor } from '@/lib/semiconductor/aiInfraBucketRS'
import { AI_INFRA_STAGE_LABEL, AI_INFRA_STAGE_ORDER } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS } from '@/lib/ai-infra/aiInfraStateLabels'
import { BucketRRGPanel } from '@/components/semiconductor/BucketRRGPanel'

// ── Design tokens ──────────────────────────────────────────────────────────────

const V = {
  teal: '#3FB6A8', red: '#E55A5A', amber: '#F2A93B', gold: '#D4B36A', mint: '#5DCFB0',
  blue: '#4A9EE0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#6B7B95',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab  = 'state' | 'rs' | 'rrg'
type Benchmark  = 'SOXX' | 'QQQ' | 'SPY'

interface RadarApiResponse {
  buckets?:       AIInfraBucketMomentum[]
  bucket_states?: AIInfraBucketState[]
  benchmarks?:    AIInfraBenchmarkReturns
  asOf?:          string | null
  generated_at?:  string
  data_notes?:    string[]
  status?:        string
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
      fontSize: 10, fontFamily: V.ui, fontWeight: 700, letterSpacing: '0.07em',
      color: '#0f1117', backgroundColor: STATE_COLORS[label],
    }}>
      {STATE_DISPLAY_LABELS[label]}
    </span>
  )
}

function ConfidenceDot({ c }: { c: string }) {
  const col = c === 'HIGH' ? V.teal : c === 'MEDIUM' ? V.gold : V.text3
  return <span style={{ fontFamily: V.mono, fontSize: 10, color: col }}>{c}</span>
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
}: {
  benchmark: Benchmark
  setBenchmark: (b: Benchmark) => void
  grouped: boolean
  setGrouped: (g: boolean) => void
}) {
  const btnBase: React.CSSProperties = {
    padding: '3px 10px', borderRadius: 3, border: '1px solid',
    background: 'transparent', cursor: 'pointer',
    fontFamily: V.mono, fontSize: 10, letterSpacing: '0.08em',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      padding: '8px 12px', marginBottom: 12,
      background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
    }}>
      {/* Benchmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
          BENCHMARK
        </span>
        {(['SOXX', 'QQQ', 'SPY'] as Benchmark[]).map(b => (
          <button
            key={b}
            onClick={() => setBenchmark(b)}
            style={{
              ...btnBase,
              borderColor: benchmark === b ? V.teal : V.border,
              color: benchmark === b ? V.teal : V.text3,
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
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
          GROUP BY STAGE
        </span>
        <button
          onClick={() => setGrouped(!grouped)}
          style={{
            ...btnBase,
            borderColor: grouped ? V.teal : V.border,
            color: grouped ? V.teal : V.text3,
          }}
        >
          {grouped ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* State benchmark note */}
      {benchmark !== 'SOXX' && (
        <span style={{
          marginLeft: 'auto',
          fontFamily: V.ui, fontSize: 10, color: V.gold,
          padding: '2px 7px', border: `1px solid ${V.gold}44`,
          borderRadius: 3, letterSpacing: '0.04em',
        }}>
          State labels use SOXX benchmark only
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
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
            {label}
          </span>
          <span style={{ fontFamily: V.ui, fontSize: 11, color: V.text2 }}>
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
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
            {label.toUpperCase()}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: V.ui, fontSize: 13, fontWeight: 700, color: name ? color : V.text3 }}>
              {name ?? 'None'}
            </span>
            {score != null && (
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3 }}>· {score}</span>
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
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>COVERAGE</span>
        <span style={{ fontFamily: V.ui, fontSize: 12, fontWeight: 600, color: V.text2 }}>
          {usable} / {total} buckets
        </span>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal }}>{benchmark}</span>
        {asOf && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>{asOf}</span>}
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
    padding: '5px 8px', fontFamily: V.mono, fontSize: 10, fontWeight: 700,
    color: V.text3, letterSpacing: '0.10em', textAlign: 'left',
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
        <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 11, color: V.text3, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.state_reason}
        </td>
      </tr>
    ))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${V.border}` }}>
            {['Bucket', 'State', 'Score', 'Confidence', 'Reason'].map(h => (
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
  const sortedFlat = [...buckets].sort((a, b) => (a.rank.composite ?? 99) - (b.rank.composite ?? 99))

  const bmKey = benchmark.toLowerCase() as 'soxx' | 'qqq' | 'spy'
  const rsOf  = (b: AIInfraBucketMomentum) => b.relative_strength[`vs_${bmKey}`].three_month

  const hlCol: React.CSSProperties = { color: V.teal }

  const renderRow = (b: AIInfraBucketMomentum) => {
    const rs3  = b.relative_strength.vs_soxx.three_month
    const rsq3 = b.relative_strength.vs_qqq.three_month
    const rss3 = b.relative_strength.vs_spy.three_month
    const rsSel = rsOf(b)
    return (
      <tr key={b.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
        <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, whiteSpace: 'nowrap' }}>
          {b.display_name}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(b.returns.one_month), textAlign: 'right' }}>
          {fmtPct(b.returns.one_month)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(b.returns.three_month), textAlign: 'right' }}>
          {fmtPct(b.returns.three_month)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(b.returns.six_month), textAlign: 'right' }}>
          {fmtPct(b.returns.six_month)}
        </td>
        {/* SOXX */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs3), textAlign: 'right', ...(benchmark === 'SOXX' ? hlCol : {}) }}>
          {fmtRS(rs3)}
        </td>
        {/* QQQ */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rsq3), textAlign: 'right', ...(benchmark === 'QQQ' ? hlCol : {}) }}>
          {fmtRS(rsq3)}
        </td>
        {/* SPY */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rss3), textAlign: 'right', ...(benchmark === 'SPY' ? hlCol : {}) }}>
          {fmtRS(rss3)}
        </td>
        {/* Selected RS (main sort key) */}
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rsSel), textAlign: 'right', fontWeight: 700 }}>
          {fmtRS(rsSel)}
        </td>
        <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 10, color: b.coverage.data_quality === 'REAL' ? V.teal : V.gold, textAlign: 'right' }}>
          {b.coverage.priced_symbol_count}/{b.coverage.symbol_count}
        </td>
      </tr>
    )
  }

  const thStyle = (h: string, isSel: boolean): React.CSSProperties => ({
    padding: '5px 8px',
    fontFamily: V.mono, fontSize: 10, fontWeight: 700,
    color: isSel ? V.teal : V.text3, letterSpacing: '0.10em',
    textAlign: h === 'Bucket' ? 'left' : 'right', whiteSpace: 'nowrap',
    borderBottom: isSel ? `2px solid ${V.teal}` : `1px solid ${V.border}`,
  })

  const colHeaders = [
    { h: 'Bucket', sel: false },
    { h: '1M',     sel: false },
    { h: '3M',     sel: false },
    { h: '6M',     sel: false },
    { h: 'RS SOXX', sel: benchmark === 'SOXX' },
    { h: 'RS QQQ',  sel: benchmark === 'QQQ' },
    { h: 'RS SPY',  sel: benchmark === 'SPY' },
    { h: `RS ${benchmark} (sel)`, sel: true },
    { h: 'Cov',    sel: false },
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
                    .sort((a, b) => (a.rank.composite ?? 99) - (b.rank.composite ?? 99))
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
            <td colSpan={5} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: ActiveTab; onChange: (t: ActiveTab) => void }) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'state', label: 'STATE LABELS' },
    { id: 'rs',    label: 'RELATIVE STRENGTH' },
    { id: 'rrg',   label: 'RRG' },
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
            color: active === t.id ? V.teal : V.text3,
            fontFamily: V.mono, fontSize: 10, fontWeight: 700,
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
  const [tab, setTab]           = useState<ActiveTab>('state')
  const [benchmark, setBenchmark] = useState<Benchmark>('SOXX')
  const [grouped, setGrouped]   = useState(false)

  useEffect(() => {
    fetch('/api/ai-infra/theme-momentum')
      .then(r => r.json())
      .then((d: RadarApiResponse) => setData(d))
      .catch(() => setError('Failed to load radar data'))
      .finally(() => setLoading(false))
  }, [])

  const states  = data?.bucket_states ?? []
  const buckets = data?.buckets ?? []
  const bms     = data?.benchmarks

  // Compact data notes (filter long disclaimers)
  const dataNotes = (data?.data_notes ?? [])
    .filter(n => !n.startsWith('State labels are rule-based'))
    .slice(0, 2)

  return (
    <section style={{ minHeight: '100vh', background: V.bg, padding: '16px 20px', color: V.text }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4 }}>
              AI BOTTLENECK RADAR
            </div>
            <div style={{ fontFamily: V.ui, fontSize: 20, fontWeight: 900, color: V.text, marginBottom: 4 }}>
              AI Infrastructure Rotation
            </div>
            <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
              Price-based rotation signals across 13 AI infrastructure buckets. Rule-based. Not investment advice.
            </div>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: 3,
            border: `1px solid ${V.teal}44`, background: `${V.teal}0D`,
            fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.08em',
            flexShrink: 0,
          }}>
            D-6
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
            {/* Controls */}
            <ControlBar
              benchmark={benchmark} setBenchmark={setBenchmark}
              grouped={grouped} setGrouped={setGrouped}
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
                fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.5,
              }}>
                {dataNotes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}

            {/* Tabs */}
            <TabBar active={tab} onChange={setTab} />

            {/* STATE LABELS */}
            {tab === 'state' && (
              states.length > 0
                ? <StateLabelsTable states={states} grouped={grouped} />
                : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                    State label data not available.
                  </div>
            )}

            {/* RELATIVE STRENGTH */}
            {tab === 'rs' && (
              buckets.length > 0 && bms
                ? <RSTable buckets={buckets} benchmarks={bms} benchmark={benchmark} grouped={grouped} />
                : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                    Relative strength data not available.
                  </div>
            )}

            {/* RRG — has built-in lookback selector */}
            {tab === 'rrg' && <BucketRRGPanel />}
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 16, fontFamily: V.ui, fontSize: 10,
          color: '#555a62', letterSpacing: '0.06em', lineHeight: 1.6,
        }}>
          State labels are rule-based and price/RRG-driven. They do not include earnings confirmation or investment recommendations.
          This panel is a rotation observation tool, not a trading signal system.
        </div>

      </div>
    </section>
  )
}
