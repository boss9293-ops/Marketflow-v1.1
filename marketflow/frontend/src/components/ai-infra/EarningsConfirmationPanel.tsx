'use client'
// AI 인프라 수익 확인 패널 — 버킷/종목 수준 매출 증거 요약 (E-6)

import type { AIInfraBucketEarningsConfirmation, AIInfraEarningsEvidence, EarningsConfirmationLevel, EarningsEvidenceFreshness } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { computeCompanyEarningsScore, getEarningsConfirmationLevel, getDatasetFreshness } from '@/lib/ai-infra/aiInfraEarningsConfirmation'
import { AI_INFRA_EARNINGS_EVIDENCE_META } from '@/lib/ai-infra/aiInfraEarningsEvidenceSeed'

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  orange: '#f97316',
  bg:     '#0F1117',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

const LEVEL_COLORS: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED:     V.green,
  PARTIAL:       V.teal,
  WATCH:         V.amber,
  NOT_CONFIRMED: V.red,
  DATA_LIMITED:  V.text3,
  UNKNOWN:       V.text3,
}

const LEVEL_LABELS: Record<EarningsConfirmationLevel, string> = {
  CONFIRMED:     'Confirmed',
  PARTIAL:       'Partial',
  WATCH:         'Watch',
  NOT_CONFIRMED: 'Not Confirmed',
  DATA_LIMITED:  'Data Limited',
  UNKNOWN:       '—',
}

// ── Section A — Summary Strip ─────────────────────────────────────────────────

const FRESHNESS_COLOR: Record<EarningsEvidenceFreshness, string> = {
  CURRENT: V.green,
  RECENT:  V.amber,
  STALE:   V.red,
  UNKNOWN: V.text3,
}

function SummaryStrip({
  summary,
  companiesCount,
}: {
  summary: {
    confirmed_buckets:     number
    partial_buckets:       number
    watch_buckets:         number
    not_confirmed_buckets: number
    data_limited_buckets:  number
    coverage_ratio:        number
    as_of?:                string
  }
  companiesCount: number
}) {
  const items = [
    { label: 'CONFIRMED',  value: String(summary.confirmed_buckets),  color: V.green  },
    { label: 'PARTIAL',    value: String(summary.partial_buckets),    color: V.teal   },
    { label: 'WATCH',      value: String(summary.watch_buckets),      color: V.amber  },
    { label: 'DATA LTD',   value: String(summary.data_limited_buckets), color: V.text3 },
    { label: 'COVERAGE',   value: `${Math.round(summary.coverage_ratio * 100)}%`, color: V.text2 },
    { label: 'AS OF',      value: summary.as_of ?? 'Unknown',         color: V.text3 },
  ]
  const freshness = getDatasetFreshness(
    summary.as_of ?? '',
    AI_INFRA_EARNINGS_EVIDENCE_META.as_of,
  )
  const freshnessColor = FRESHNESS_COLOR[freshness]
  return (
    <div style={{
      padding: '10px 14px',
      background: V.bg2,
      border: `1px solid ${V.border}`,
      borderRadius: 6,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12 }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
            <span style={{
              fontFamily: V.mono, fontSize: 10, color: V.text3,
              letterSpacing: '0.10em', textTransform: 'uppercase' as const,
            }}>
              {label}
            </span>
            <span style={{ fontFamily: V.mono, fontSize: 14, color, fontWeight: 600 }}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: `1px solid ${V.border}`,
        fontFamily: V.mono, fontSize: 10, color: V.text3,
        letterSpacing: '0.06em',
        display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center',
      }}>
        <span>Manual Dataset · {AI_INFRA_EARNINGS_EVIDENCE_META.dataset_version} · {companiesCount} symbols</span>
        <span style={{ color: V.border }}>|</span>
        <span>Freshness: <span style={{ color: freshnessColor }}>{freshness}</span></span>
        <span style={{ color: V.border }}>|</span>
        <span>Business evidence only — not investment advice</span>
      </div>
    </div>
  )
}

// ── Section B — Bucket Table ──────────────────────────────────────────────────

function BucketTable({ buckets }: { buckets: AIInfraBucketEarningsConfirmation[] }) {
  const th = (label: string, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    padding: '6px 10px',
    fontFamily: V.mono, fontSize: 11, fontWeight: 700,
    color: V.text2, letterSpacing: '0.10em',
    textAlign: align,
    borderBottom: `1px solid ${V.border}`,
    whiteSpace: 'nowrap' as const,
  })
  return (
    <div style={{ overflowX: 'auto', marginBottom: 20 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th('left')}>BUCKET</th>
            <th style={th('left')}>LEVEL</th>
            <th style={th('right')}>SCORE</th>
            <th style={th('right')}>COV</th>
            <th style={th('left')}>EVIDENCE</th>
            <th style={th('left')}>CAUTION</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map(b => {
            const col = LEVEL_COLORS[b.confirmation_level]
            return (
              <tr key={b.bucket_id} style={{ borderBottom: `1px solid ${V.border}` }}>
                <td style={{ padding: '7px 10px', fontFamily: V.ui, fontSize: 12, color: V.text, whiteSpace: 'nowrap' as const }}>
                  {b.bucket_label}
                </td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' as const }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 11,
                    color: col, background: `${col}18`,
                    border: `1px solid ${col}40`,
                    borderRadius: 3, padding: '1px 6px',
                  }}>
                    {LEVEL_LABELS[b.confirmation_level]}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', fontFamily: V.mono, fontSize: 12, color: V.text2, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                  {b.confirmation_level === 'DATA_LIMITED' ? '—' : b.confirmation_score}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: V.mono, fontSize: 12, color: V.text3, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                  {b.source.coverage_ratio > 0
                    ? `${Math.round(b.source.coverage_ratio * 100)}%`
                    : '—'}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: V.ui, fontSize: 12, color: V.text2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {b.evidence_summary || '—'}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: V.ui, fontSize: 12, color: V.text3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {b.caution_summary || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Section C — Company Evidence Table ───────────────────────────────────────

function CompanyTable({ companies }: { companies: AIInfraEarningsEvidence[] }) {
  const scored = companies.map(e => {
    const score = computeCompanyEarningsScore(e)
    const level = getEarningsConfirmationLevel(score, e)
    return { e, score, level }
  }).sort((a, b) => b.score - a.score).slice(0, 14)

  const th = (label: string, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    padding: '6px 8px',
    fontFamily: V.mono, fontSize: 11, fontWeight: 700,
    color: V.text2, letterSpacing: '0.10em',
    textAlign: align,
    borderBottom: `1px solid ${V.border}`,
    whiteSpace: 'nowrap' as const,
  })

  const td = (content: React.ReactNode, opts?: { color?: string; align?: 'right' | 'left'; mono?: boolean }): React.ReactNode => (
    <td style={{
      padding: '6px 8px',
      fontFamily: opts?.mono !== false ? V.mono : V.ui,
      fontSize: 12,
      color: opts?.color ?? V.text2,
      textAlign: opts?.align ?? 'left',
      whiteSpace: 'nowrap' as const,
    }}>
      {content}
    </td>
  )

  const visColor = (v: string) =>
    v === 'VISIBLE' ? V.green : v === 'PARTIAL' ? V.teal : v === 'INDIRECT' ? V.amber : V.text3
  const toneColor = (t: string) =>
    t === 'RAISED' ? V.green : t === 'POSITIVE' ? V.teal : t === 'CAUTIOUS' || t === 'LOWERED' ? V.red : V.text3
  const mktColor = (m: string) =>
    m === 'EXPANDING' ? V.green : m === 'PRESSURED' ? V.red : V.text3

  return (
    <div style={{ overflowX: 'auto', marginBottom: 20 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th('left')}>SYMBOL</th>
            <th style={th('left')}>BUCKET</th>
            <th style={th('left')}>LEVEL</th>
            <th style={th('right')}>SCORE</th>
            <th style={th('left')}>AI REV</th>
            <th style={th('left')}>GUIDANCE</th>
            <th style={th('left')}>BACKLOG</th>
            <th style={th('left')}>MARGIN</th>
            <th style={th('left')}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {scored.map(({ e, score, level }) => {
            const col = LEVEL_COLORS[level]
            return (
              <tr key={e.symbol} style={{ borderBottom: `1px solid ${V.border}` }}>
                {td(e.symbol, { color: V.text })}
                {td(e.primary_bucket.replace(/_/g, ' '), { color: V.text3, mono: false })}
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' as const }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 11,
                    color: col, background: `${col}18`,
                    border: `1px solid ${col}40`,
                    borderRadius: 3, padding: '0px 5px',
                  }}>
                    {LEVEL_LABELS[level]}
                  </span>
                </td>
                {td(score, { align: 'right' })}
                {td(e.ai_revenue_visibility, { color: visColor(e.ai_revenue_visibility) })}
                {td(e.guidance_tone, { color: toneColor(e.guidance_tone) })}
                {td(e.backlog_or_orders === 'NOT_DISCLOSED' ? '—' : e.backlog_or_orders, { color: V.text3 })}
                {td(e.margin_quality, { color: mktColor(e.margin_quality) })}
                {td(e.commercialization_status.replace(/_/g, ' '), { color: V.text3, mono: false })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Section D — Evidence Gaps ─────────────────────────────────────────────────

function EvidenceGaps({ buckets }: { buckets: AIInfraBucketEarningsConfirmation[] }) {
  const gaps = buckets.filter(b =>
    b.confirmation_level === 'DATA_LIMITED' ||
    b.confirmation_level === 'WATCH' ||
    b.caution_summary.length > 0
  )
  if (gaps.length === 0) return null
  return (
    <div>
      <div style={{
        fontFamily: V.mono, fontSize: 11, color: V.text2,
        letterSpacing: '0.10em', marginBottom: 8,
      }}>
        EVIDENCE GAPS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        {gaps.map(b => (
          <div key={b.bucket_id} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '7px 10px',
            background: V.bg2, border: `1px solid ${V.border}`, borderRadius: 4,
          }}>
            <span style={{ fontFamily: V.mono, fontSize: 11, color: LEVEL_COLORS[b.confirmation_level], minWidth: 90 }}>
              {b.bucket_label}
            </span>
            <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text3, lineHeight: 1.5 }}>
              {b.caution_summary || 'No seed coverage — evidence gap in current dataset.'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: V.mono, fontSize: 11, fontWeight: 700,
      color: V.text2, letterSpacing: '0.10em',
      marginBottom: 8, paddingBottom: 4,
      borderBottom: `1px solid ${V.border}`,
    }}>
      {label}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface EarningsConfirmationPanelProps {
  earningsConfirmation: {
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
  } | null | undefined
}

export function EarningsConfirmationPanel({ earningsConfirmation }: EarningsConfirmationPanelProps) {
  if (!earningsConfirmation) {
    return (
      <div style={{ fontFamily: V.mono, fontSize: 12, color: V.text3, padding: '16px 0' }}>
        Earnings confirmation data unavailable.
      </div>
    )
  }

  const { buckets, companies, summary } = earningsConfirmation

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Section A */}
      <SectionHeader label="SUMMARY" />
      <SummaryStrip summary={summary} companiesCount={companies.length} />

      {/* Section B */}
      <SectionHeader label="BUCKET CONFIRMATION" />
      <BucketTable buckets={buckets} />

      {/* Section C */}
      <SectionHeader label="COMPANY EVIDENCE" />
      <CompanyTable companies={companies} />

      {/* Section D */}
      <SectionHeader label="EVIDENCE GAPS" />
      <EvidenceGaps buckets={buckets} />

      {/* Disclaimer */}
      <div style={{
        marginTop: 16, paddingTop: 10,
        borderTop: `1px solid ${V.border}`,
        fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.6,
      }}>
        Earnings Confirmation is a business evidence layer only. Confirmation Quality reflects
        observable revenue and order signals — not a stock rating or trading signal.
        Manual seed data as of {summary.as_of ?? 'unknown'}. Coverage ratio {Math.round(summary.coverage_ratio * 100)}%.
      </div>
    </div>
  )
}
