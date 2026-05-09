'use client'
// AI Bottleneck Radar 메인 컴포넌트 — D-1~D-4 레이어 통합 (투자 추천 아님)

import { useEffect, useState } from 'react'
import type { AIInfraBucketMomentum, AIInfraBenchmarkReturns } from '@/lib/semiconductor/aiInfraBucketRS'
import { fmtPct, fmtRS, rsColor } from '@/lib/semiconductor/aiInfraBucketRS'
import { AI_INFRA_STAGE_LABEL } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import { STATE_DISPLAY_LABELS, STATE_COLORS } from '@/lib/ai-infra/aiInfraStateLabels'
import { BucketRRGPanel } from '@/components/semiconductor/BucketRRGPanel'

// ── Design tokens ──────────────────────────────────────────────────────────────

const V = {
  teal: '#3FB6A8', red: '#E55A5A', amber: '#F2A93B', gold: '#D4B36A', mint: '#5DCFB0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#6B7B95',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── API response ───────────────────────────────────────────────────────────────

interface RadarApiResponse {
  buckets?:       AIInfraBucketMomentum[]
  bucket_states?: AIInfraBucketState[]
  benchmarks?:    AIInfraBenchmarkReturns
  asOf?:          string | null
  generated_at?:  string
  data_notes?:    string[]
  status?:        string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type ActiveTab = 'state' | 'rs' | 'rrg'

const LABEL_PRIORITY: AIInfraStateLabel[] = [
  'LEADING', 'EMERGING', 'CONFIRMING', 'CROWDED',
  'DISTRIBUTION', 'LAGGING', 'STORY_ONLY', 'DATA_INSUFFICIENT',
]

function firstByLabel(states: AIInfraBucketState[], label: AIInfraStateLabel) {
  return states.find(s => s.state_label === label)
}

function fmtBm(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StateBadge({ label }: { label: AIInfraStateLabel }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 3,
      fontSize: 10,
      fontFamily: V.ui,
      fontWeight: 700,
      letterSpacing: '0.07em',
      color: '#0f1117',
      backgroundColor: STATE_COLORS[label],
    }}>
      {STATE_DISPLAY_LABELS[label]}
    </span>
  )
}

function ConfidenceDot({ c }: { c: string }) {
  const col = c === 'HIGH' ? V.teal : c === 'MEDIUM' ? V.gold : V.text3
  return <span style={{ fontFamily: V.mono, fontSize: 10, color: col }}>{c}</span>
}

// ── Summary Strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ states, asOf }: { states: AIInfraBucketState[]; asOf?: string | null }) {
  const leading   = firstByLabel(states, 'LEADING')
  const emerging  = firstByLabel(states, 'EMERGING')
  const crowded   = firstByLabel(states, 'CROWDED')
  const distributing = firstByLabel(states, 'DISTRIBUTION')
  const usable    = states.filter(s => s.state_label !== 'DATA_INSUFFICIENT').length
  const total     = states.length

  const items = [
    { label: 'Leading',      value: leading?.display_name    ?? '—', color: STATE_COLORS['LEADING'] },
    { label: 'Emerging',     value: emerging?.display_name   ?? '—', color: STATE_COLORS['EMERGING'] },
    { label: 'Crowded',      value: crowded?.display_name    ?? '—', color: STATE_COLORS['CROWDED'] },
    { label: 'Distribution', value: distributing?.display_name ?? '—', color: STATE_COLORS['DISTRIBUTION'] },
    { label: 'Coverage',     value: `${usable} / ${total}`,          color: V.text2 },
    { label: 'Benchmark',    value: 'SOXX',                          color: V.teal },
  ]

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      background: V.bg2,
      border: `1px solid ${V.border}`,
      borderRadius: 4,
      padding: '10px 14px',
    }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>
            {label.toUpperCase()}
          </span>
          <span style={{ fontFamily: V.ui, fontSize: 12, fontWeight: 600, color }}>
            {value}
          </span>
        </div>
      ))}
      {asOf && (
        <div style={{ marginLeft: 'auto', fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
          {asOf}
        </div>
      )}
    </div>
  )
}

// ── State Labels Table ────────────────────────────────────────────────────────

function StateLabelsTable({ states }: { states: AIInfraBucketState[] }) {
  const sorted = [...states].sort((a, b) => {
    const pa = LABEL_PRIORITY.indexOf(a.state_label)
    const pb = LABEL_PRIORITY.indexOf(b.state_label)
    if (pa !== pb) return pa - pb
    return (b.state_score ?? -1) - (a.state_score ?? -1)
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '50%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: `1px solid ${V.border}` }}>
            {['Bucket', 'State', 'Score', 'Confidence', 'Reason'].map(h => (
              <th key={h} style={{
                padding: '5px 8px',
                fontFamily: V.mono, fontSize: 10, fontWeight: 700,
                color: V.text3, letterSpacing: '0.10em', textAlign: 'left',
              }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr key={s.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
              <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 11, color: V.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.state_reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Relative Strength Table ───────────────────────────────────────────────────

function RSTable({
  buckets, benchmarks,
}: {
  buckets: AIInfraBucketMomentum[]
  benchmarks: AIInfraBenchmarkReturns
}) {
  const sorted = [...buckets].sort((a, b) => (a.rank.composite ?? 99) - (b.rank.composite ?? 99))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${V.border}` }}>
            {['Bucket', 'Stage', '1M', '3M', '6M', 'RS SOXX 3M', 'RS QQQ 3M', 'RS SPY 3M', 'Coverage'].map(h => (
              <th key={h} style={{
                padding: '5px 8px',
                fontFamily: V.mono, fontSize: 10, fontWeight: 700,
                color: V.text3, letterSpacing: '0.10em',
                textAlign: h === 'Bucket' || h === 'Stage' ? 'left' : 'right',
                whiteSpace: 'nowrap',
              }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(b => {
            const rs3  = b.relative_strength.vs_soxx.three_month
            const rsq3 = b.relative_strength.vs_qqq.three_month
            const rss3 = b.relative_strength.vs_spy.three_month
            const stageLabel = AI_INFRA_STAGE_LABEL[b.stage] ?? b.stage
            return (
              <tr key={b.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
                <td style={{ padding: '7px 8px', fontFamily: V.ui, fontSize: 12, color: V.text2, whiteSpace: 'nowrap' }}>
                  {b.display_name}
                </td>
                <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 10, color: V.text3, whiteSpace: 'nowrap' }}>
                  {stageLabel}
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
                <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rs3), textAlign: 'right' }}>
                  {fmtRS(rs3)}
                </td>
                <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rsq3), textAlign: 'right' }}>
                  {fmtRS(rsq3)}
                </td>
                <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 12, color: rsColor(rss3), textAlign: 'right' }}>
                  {fmtRS(rss3)}
                </td>
                <td style={{ padding: '7px 8px', fontFamily: V.mono, fontSize: 10, color: b.coverage.data_quality === 'REAL' ? V.teal : V.gold, textAlign: 'right' }}>
                  {b.coverage.priced_symbol_count}/{b.coverage.symbol_count}
                </td>
              </tr>
            )
          })}
          {/* Benchmark reference row */}
          <tr style={{ borderTop: `1px solid ${V.border}`, background: V.bg2 }}>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em' }}>SOXX BM</td>
            <td />
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(benchmarks.SOXX.one_month)}</td>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(benchmarks.SOXX.three_month)}</td>
            <td style={{ padding: '6px 8px', fontFamily: V.mono, fontSize: 11, color: V.text3, textAlign: 'right' }}>{fmtBm(benchmarks.SOXX.six_month)}</td>
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
            padding: '6px 14px',
            border: 'none',
            borderBottom: active === t.id ? `2px solid ${V.teal}` : '2px solid transparent',
            background: 'transparent',
            color: active === t.id ? V.teal : V.text3,
            fontFamily: V.mono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.10em',
            cursor: 'pointer',
            marginBottom: -1,
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
  const [data, setData]       = useState<RadarApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<ActiveTab>('state')

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

  // Compact data notes (exclude long state label disclaimer)
  const dataNotes = (data?.data_notes ?? [])
    .filter(n => !n.startsWith('State labels are rule-based'))
    .slice(0, 3)

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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{
              padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${V.teal}44`, background: `${V.teal}0D`,
              fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.08em',
            }}>
              D-4
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${V.border}`, background: V.bg2,
              fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.08em',
            }}>
              SOXX BENCHMARK
            </span>
          </div>
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
            {/* Summary Strip */}
            {states.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SummaryStrip states={states} asOf={data?.asOf ?? null} />
              </div>
            )}

            {/* Inline data notes */}
            {dataNotes.length > 0 && (
              <div style={{
                marginBottom: 12,
                padding: '7px 12px',
                background: V.bg2,
                border: `1px solid ${V.border}`,
                borderRadius: 4,
                fontFamily: V.ui,
                fontSize: 11,
                color: V.text3,
                lineHeight: 1.5,
              }}>
                {dataNotes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}

            {/* Tabs */}
            <TabBar active={tab} onChange={setTab} />

            {/* STATE LABELS */}
            {tab === 'state' && (
              states.length > 0
                ? <StateLabelsTable states={states} />
                : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                    State label data not available. Ensure D-4 state engine is wired.
                  </div>
            )}

            {/* RELATIVE STRENGTH */}
            {tab === 'rs' && (
              buckets.length > 0 && bms
                ? <RSTable buckets={buckets} benchmarks={bms} />
                : <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
                    Relative strength data not available.
                  </div>
            )}

            {/* RRG */}
            {tab === 'rrg' && (
              <BucketRRGPanel />
            )}
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 16,
          fontFamily: V.ui,
          fontSize: 10,
          color: '#555a62',
          letterSpacing: '0.06em',
          lineHeight: 1.6,
        }}>
          State labels are rule-based and price/RRG-driven. They do not include earnings confirmation or investment recommendations.
          This panel is a rotation observation tool, not a trading signal system.
        </div>

      </div>
    </section>
  )
}
