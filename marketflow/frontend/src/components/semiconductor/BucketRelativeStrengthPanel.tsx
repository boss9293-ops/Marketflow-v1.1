'use client'
// AI 인프라 버킷별 상대강도 패널 — Phase D-2 (가격 기반, 투자 추천 아님)

import { useEffect, useState } from 'react'
import type { AIInfraBucketMomentum, AIInfraBenchmarkReturns } from '@/lib/semiconductor/aiInfraBucketRS'
import { getBasicRSLabel, fmtRS, fmtPct, rsColor } from '@/lib/semiconductor/aiInfraBucketRS'
import { AI_INFRA_STAGE_LABEL } from '@/lib/semiconductor/aiInfraBucketMap'

// ── Design tokens (consistent with AnalysisEngineCoreTab) ────────────────────
const V = {
  teal: '#3FB6A8', red: '#E55A5A', gold: '#D4B36A', mint: '#5DCFB0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#6B7B95',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── API response shape (partial — only fields we need) ────────────────────────
interface BucketRSResponse {
  buckets:      AIInfraBucketMomentum[]
  benchmarks:   AIInfraBenchmarkReturns
  asOf:         string | null
  generated_at: string
  data_notes:   string[]
}

// ── Coverage badge ────────────────────────────────────────────────────────────
function CovBadge({ ratio, quality }: { ratio: number; quality: string }) {
  const pct = Math.round(ratio * 100)
  const color = quality === 'DATA_INSUFFICIENT' ? V.red
    : quality === 'PARTIAL' ? V.gold
    : V.teal
  return (
    <span style={{ fontSize: 10, color, fontFamily: V.mono }}>
      {quality === 'DATA_INSUFFICIENT' ? 'N/A' : `${pct}%`}
    </span>
  )
}

// ── Benchmark reference row ───────────────────────────────────────────────────
function BmRow({ label, r }: { label: string; r: { one_month: number | null; three_month: number | null; six_month: number | null } }) {
  return (
    <tr style={{ borderTop: `1px solid ${V.border}` }}>
      <td colSpan={2} style={{ padding: '4px 8px', fontSize: 10, color: V.text3, fontFamily: V.ui, letterSpacing: '0.10em' }}>
        {label}
      </td>
      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: V.text2, fontFamily: V.mono }}>{fmtPct(r.one_month)}</td>
      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: V.text2, fontFamily: V.mono }}>{fmtPct(r.three_month)}</td>
      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: V.text2, fontFamily: V.mono }}>{fmtPct(r.six_month)}</td>
      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: V.text2, fontFamily: V.mono }}>—</td>
      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: V.text2, fontFamily: V.mono }}>—</td>
      <td colSpan={2} />
    </tr>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function BucketRelativeStrengthPanel() {
  const [data,    setData]    = useState<BucketRSResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ai-infra/theme-momentum', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as Partial<BucketRSResponse>
        if (!cancelled && Array.isArray(json.buckets)) {
          setData({
            buckets:      json.buckets,
            benchmarks:   json.benchmarks ?? { SOXX: { one_month: null, three_month: null, six_month: null }, QQQ: { one_month: null, three_month: null, six_month: null }, SPY: { one_month: null, three_month: null, six_month: null } },
            asOf:         json.asOf ?? null,
            generated_at: json.generated_at ?? '',
            data_notes:   json.data_notes ?? [],
          })
        } else if (!cancelled) {
          setError('Bucket RS data not available — API may not be connected yet.')
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div style={{ padding: 16, color: V.text3, fontSize: 12, fontFamily: V.ui }}>
      Loading bucket data…
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 16, color: V.gold, fontSize: 12, fontFamily: V.ui }}>
      {error ?? 'No data'}
    </div>
  )

  // Sort by composite rank ascending (null → last)
  const sorted = [...data.buckets].sort((a, b) => {
    const ra = a.rank.composite ?? 999
    const rb = b.rank.composite ?? 999
    return ra - rb
  })

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: V.teal, fontFamily: V.ui }}>
          BUCKET RELATIVE STRENGTH
        </div>
        <div style={{ fontSize: 10, color: V.text3, fontFamily: V.mono }}>
          {data.asOf ? `as of ${data.asOf}` : ''}
        </div>
        <div style={{ fontSize: 10, color: V.text3, fontFamily: V.ui, marginLeft: 'auto' }}>
          vs SOXX · price-based only · not investment advice
        </div>
      </div>

      {/* Data notes */}
      {data.data_notes.length > 0 && (
        <div style={{ padding: '5px 16px', marginBottom: 6, fontSize: 10, color: V.gold, fontFamily: V.ui, lineHeight: 1.5 }}>
          {data.data_notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${V.border}` }}>
              {(['Bucket', 'Stage', '1M', '3M', '6M', 'RS SOXX 3M', 'RS QQQ 3M', 'Cov', 'Signal'] as const).map(h => (
                <th key={h} style={{
                  padding: '4px 6px', textAlign: h === 'Bucket' || h === 'Stage' ? 'left' : 'right',
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                  color: V.text3, fontFamily: V.ui, whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((b, idx) => {
              const rs3M    = b.relative_strength.vs_soxx.three_month
              const rsQQQ3M = b.relative_strength.vs_qqq.three_month
              const sig     = getBasicRSLabel(rs3M)
              const insufficient = b.coverage.data_quality === 'DATA_INSUFFICIENT'
              return (
                <tr key={b.bucket_id} style={{
                  background: idx % 2 === 0 ? 'transparent' : V.bg2,
                  borderBottom: `1px solid ${V.border}`,
                }}>
                  <td style={{ padding: '5px 8px', fontFamily: V.ui, color: V.text2, whiteSpace: 'nowrap' }}>
                    {b.display_name}
                  </td>
                  <td style={{ padding: '5px 6px', fontSize: 10, color: V.text3, fontFamily: V.ui, whiteSpace: 'nowrap' }}>
                    {AI_INFRA_STAGE_LABEL[b.stage].replace(/Stage \d — /, '')}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, color: insufficient ? V.text3 : rsColor(b.returns.one_month) }}>
                    {insufficient ? '—' : fmtPct(b.returns.one_month)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, color: insufficient ? V.text3 : rsColor(b.returns.three_month) }}>
                    {insufficient ? '—' : fmtPct(b.returns.three_month)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, color: insufficient ? V.text3 : rsColor(b.returns.six_month) }}>
                    {insufficient ? '—' : fmtPct(b.returns.six_month)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, fontWeight: 600, color: insufficient ? V.text3 : rsColor(rs3M) }}>
                    {insufficient ? '—' : fmtRS(rs3M)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, color: insufficient ? V.text3 : rsColor(rsQQQ3M) }}>
                    {insufficient ? '—' : fmtRS(rsQQQ3M)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                    <CovBadge ratio={b.coverage.coverage_ratio} quality={b.coverage.data_quality} />
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: sig.color, fontFamily: V.ui,
                      letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>
                      {sig.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {/* Benchmark reference rows */}
            <BmRow label="SOXX (benchmark)" r={data.benchmarks.SOXX} />
            <BmRow label="QQQ (benchmark)"  r={data.benchmarks.QQQ}  />
            <BmRow label="SPY (benchmark)"  r={data.benchmarks.SPY}  />
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '8px 16px', marginTop: 6, fontSize: 10, color: V.text3, fontFamily: V.ui, lineHeight: 1.5 }}>
        Signal labels (Leading / Improving / Mixed / Lagging) are temporary D-2 display only — not final state engine output.
        Equal-weight basket returns. Coverage % = priced symbols / total symbols.
        This panel is an analysis tool. Not investment advice.
      </div>
    </div>
  )
}
