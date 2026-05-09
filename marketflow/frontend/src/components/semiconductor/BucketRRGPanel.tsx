'use client'
// AI 인프라 병목 버킷 RRG 패널 — Phase D-3 (Candidate-D 공식, 투자 추천 아님)

import { useEffect, useMemo, useState } from 'react'
import type { RrgPathPayload, RrgSeries, RrgQuadrant } from '@/lib/semiconductor/rrgPathData'
import { PENDING_RRG_PAYLOAD } from '@/lib/semiconductor/rrgPathData'
import { AI_INFRA_STAGE_LABEL } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage } from '@/lib/semiconductor/aiInfraBucketMap'

// ── Design tokens ─────────────────────────────────────────────────────────────
const V = {
  teal: '#3FB6A8', red: '#E55A5A', amber: '#F2A93B', blue: '#4A9EE0',
  gold: '#D4B36A', mint: '#5DCFB0',
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#6B7B95',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── Quadrant colors (matching SemiconductorRRGCard) ───────────────────────────
const Q_COLOR: Record<RrgQuadrant, string> = {
  Leading:   V.teal,
  Weakening: V.amber,
  Lagging:   V.red,
  Improving: V.blue,
  Pending:   V.text3,
}
const Q_BG: Record<RrgQuadrant, string> = {
  Leading:   'rgba(63,182,168,0.12)',
  Weakening: 'rgba(242,169,59,0.12)',
  Lagging:   'rgba(229,90,90,0.12)',
  Improving: 'rgba(74,158,224,0.12)',
  Pending:   'rgba(107,123,149,0.08)',
}

// Stage → short label for display
const STAGE_SHORT: Record<AIInfraStage, string> = {
  STAGE_1_AI_CHIP:                    'S1',
  STAGE_2_MEMORY_PACKAGING:           'S2',
  STAGE_3_SERVER_INTERNAL_BOTTLENECK: 'S3',
  STAGE_4_EXTERNAL_INFRA:             'S4',
  STAGE_5_PHYSICAL_RESOURCE:          'S5',
}

// Per-bucket color palette (13 buckets)
const BUCKET_COLORS: Record<string, string> = {
  AI_CHIP:           '#3FB6A8',
  HBM_MEMORY:        '#F2A93B',
  PACKAGING:         '#E55A5A',
  COOLING:           '#4A9EE0',
  PCB_SUBSTRATE:     '#D4B36A',
  TEST_EQUIPMENT:    '#5DCFB0',
  GLASS_SUBSTRATE:   '#9B7FD4',
  OPTICAL_NETWORK:   '#E87D4E',
  POWER_INFRA:       '#6BB5D4',
  CLEANROOM_WATER:   '#A8D86A',
  SPECIALTY_GAS:     '#D4A0C8',
  DATA_CENTER_INFRA: '#7AB8E8',
  RAW_MATERIAL:      '#C8A878',
}

// Stage information to label buckets (inferred from ID prefix)
const BUCKET_STAGE: Record<string, AIInfraStage> = {
  AI_CHIP:           'STAGE_1_AI_CHIP',
  HBM_MEMORY:        'STAGE_2_MEMORY_PACKAGING',
  PACKAGING:         'STAGE_2_MEMORY_PACKAGING',
  COOLING:           'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  PCB_SUBSTRATE:     'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  TEST_EQUIPMENT:    'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  GLASS_SUBSTRATE:   'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  OPTICAL_NETWORK:   'STAGE_3_SERVER_INTERNAL_BOTTLENECK',
  POWER_INFRA:       'STAGE_4_EXTERNAL_INFRA',
  CLEANROOM_WATER:   'STAGE_4_EXTERNAL_INFRA',
  SPECIALTY_GAS:     'STAGE_4_EXTERNAL_INFRA',
  DATA_CENTER_INFRA: 'STAGE_5_PHYSICAL_RESOURCE',
  RAW_MATERIAL:      'STAGE_5_PHYSICAL_RESOURCE',
}

// ── Compact inline RRG scatter ────────────────────────────────────────────────
function MiniRRGChart({ series, lookbackWeeks }: { series: RrgSeries[]; lookbackWeeks: number }) {
  const W = 494, H = 364, L = 42, R = 16, T = 20, B = 32
  const CW = W - L - R, CH = H - T - B

  // Compute domain from all valid points
  const allPts = series.flatMap(s =>
    s.points.filter(p => p.rsRatio !== null && p.rsMomentum !== null)
      .map(p => ({ x: p.rsRatio as number, y: p.rsMomentum as number }))
  )

  const xs = allPts.map(p => p.x)
  const ys = allPts.map(p => p.y)
  const pad = 2
  const xMin = Math.min(97, ...(xs.length ? [Math.min(...xs) - pad] : []))
  const xMax = Math.max(103, ...(xs.length ? [Math.max(...xs) + pad] : []))
  const yMin = Math.min(97, ...(ys.length ? [Math.min(...ys) - pad] : []))
  const yMax = Math.max(103, ...(ys.length ? [Math.max(...ys) + pad] : []))

  const toSvg = (rx: number, ry: number) => ({
    x: L + ((rx - xMin) / (xMax - xMin)) * CW,
    y: T + (1 - (ry - yMin) / (yMax - yMin)) * CH,
  })
  const { x: cx, y: cy } = toSvg(100, 100)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W * 2, display: 'block' }}>
      {/* Quadrant backgrounds */}
      <rect x={L} y={T} width={cx - L} height={cy - T} fill="rgba(74,158,224,0.06)" />
      <rect x={cx} y={T} width={W - R - cx} height={cy - T} fill="rgba(63,182,168,0.06)" />
      <rect x={L} y={cy} width={cx - L} height={H - B - cy} fill="rgba(229,90,90,0.06)" />
      <rect x={cx} y={cy} width={W - R - cx} height={H - B - cy} fill="rgba(242,169,59,0.06)" />
      {/* Axes */}
      <line x1={cx} y1={T} x2={cx} y2={H - B} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
      <line x1={L} y1={cy} x2={W - R} y2={cy} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
      {/* Quadrant labels */}
      {([['Improving', L + 4, T + 12], ['Leading', cx + 4, T + 12],
         ['Lagging', L + 4, H - B - 4], ['Weakening', cx + 4, H - B - 4]] as [string, number, number][])
        .map(([label, tx, ty]) => (
          <text key={label} x={tx} y={ty} fontSize={7} fill={Q_COLOR[label as RrgQuadrant]}
            fontFamily="'IBM Plex Sans', sans-serif" letterSpacing="0.08em">
            {label.toUpperCase()}
          </text>
        ))
      }
      {/* Tails + dots per series */}
      {series.filter(s => s.points.length > 0).map(s => {
        const pts = s.points
          .filter(p => p.rsRatio !== null && p.rsMomentum !== null)
          .slice(-lookbackWeeks)
        if (pts.length === 0) return null
        const color = BUCKET_COLORS[s.id] ?? V.text3
        const tail = pts.map(p => toSvg(p.rsRatio as number, p.rsMomentum as number))
        const last = tail[tail.length - 1]
        const pathD = tail.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
        return (
          <g key={s.id}>
            <path d={pathD} fill="none" stroke={color} strokeWidth={1.2}
              strokeOpacity={0.45} strokeLinejoin="round" />
            <circle cx={last.x} cy={last.y} r={4} fill={color} fillOpacity={0.9} />
            <text x={last.x + 5} y={last.y - 3} fontSize={6} fill={color}
              fontFamily="'IBM Plex Mono', monospace">
              {s.id.replace(/_/g, ' ').split(' ').slice(0, 2).join(' ')}
            </text>
          </g>
        )
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2.5} fill="rgba(255,255,255,0.3)" />
      {/* Axis labels */}
      <text x={W - R} y={cy + 10} fontSize={7} fill="#8b9098" textAnchor="end"
        fontFamily="'IBM Plex Mono', monospace">RS Ratio →</text>
      <text x={cx - 2} y={T + 8} fontSize={7} fill="#8b9098" textAnchor="end"
        fontFamily="'IBM Plex Mono', monospace">Mom ↑</text>
    </svg>
  )
}

// ── Bucket list row ───────────────────────────────────────────────────────────
function BucketRow({ s }: { s: RrgSeries }) {
  const q     = s.quadrant as RrgQuadrant
  const color = BUCKET_COLORS[s.id] ?? V.text3
  const last  = s.points.at(-1)
  const stage = BUCKET_STAGE[s.id]

  return (
    <tr style={{ borderBottom: `1px solid ${V.border}` }}>
      <td style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: V.text, fontFamily: V.ui }}>{s.label}</span>
      </td>
      <td style={{ padding: '5px 6px', fontSize: 11, color: '#8b9098', fontFamily: V.ui }}>
        {stage ? STAGE_SHORT[stage] : '—'}
      </td>
      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: Q_COLOR[q],
          background: Q_BG[q], borderRadius: 3, padding: '2px 8px',
          fontFamily: V.ui, letterSpacing: '0.06em',
        }}>
          {q}
        </span>
      </td>
      <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, fontSize: 13, color: V.text }}>
        {last?.rsRatio?.toFixed(2) ?? '—'}
      </td>
      <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: V.mono, fontSize: 13, color: V.text }}>
        {last?.rsMomentum?.toFixed(2) ?? '—'}
      </td>
      <td style={{ padding: '5px 6px', textAlign: 'right', fontSize: 11, color: '#8b9098', fontFamily: V.mono }}>
        {s.points.length > 0 ? `${s.points.length}W` : '—'}
      </td>
      <td style={{ padding: '5px 8px' }}>
        {s.source === 'PENDING' && (
          <span style={{ fontSize: 10, color: '#8b9098', fontFamily: V.ui }}>{s.note ?? 'Pending'}</span>
        )}
      </td>
    </tr>
  )
}

// ── Quadrant grouping ─────────────────────────────────────────────────────────
const Q_ORDER: RrgQuadrant[] = ['Leading', 'Improving', 'Weakening', 'Lagging', 'Pending']

function groupByQuadrant(series: RrgSeries[]): Map<RrgQuadrant, RrgSeries[]> {
  const map = new Map<RrgQuadrant, RrgSeries[]>()
  for (const q of Q_ORDER) map.set(q, [])
  for (const s of series) {
    const q = (s.quadrant as RrgQuadrant) ?? 'Pending'
    const key: RrgQuadrant = Q_ORDER.includes(q) ? q : 'Pending'
    map.get(key)!.push(s)
  }
  return map
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function BucketRRGPanel({ benchmark = 'SOXX' }: { benchmark?: 'SOXX' | 'QQQ' | 'SPY' }) {
  const [payload,  setPayload]  = useState<RrgPathPayload>(PENDING_RRG_PAYLOAD)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [lookback, setLookback] = useState(8)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/ai-infra/bucket-rrg?benchmark=${benchmark}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: RrgPathPayload) => { if (!cancelled) { setPayload(d); setLoading(false) } })
      .catch((e: unknown) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [benchmark])

  const grouped   = useMemo(() => groupByQuadrant(payload.series), [payload.series])
  const liveSeries = payload.series.filter(s => s.source !== 'PENDING' && s.points.length > 0)
  const hasLive   = liveSeries.length > 0

  if (loading) return (
    <div style={{ padding: 16, color: V.text3, fontSize: 12, fontFamily: V.ui }}>Loading Bottleneck RRG…</div>
  )

  if (error) return (
    <div style={{ padding: 16, color: V.gold, fontSize: 12, fontFamily: V.ui }}>{error}</div>
  )

  if (!hasLive) return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: V.teal, fontFamily: V.ui, marginBottom: 8 }}>
        BOTTLENECK RRG
      </div>
      <div style={{ fontSize: 11, color: V.text3, fontFamily: V.ui, lineHeight: 1.6 }}>
        RRG cache not yet generated.
        Run <code style={{ fontFamily: V.mono, color: V.text2 }}>marketflow/scripts/build_bottleneck_rrg.py</code> to produce data.
      </div>
      {payload.note && (
        <div style={{ marginTop: 8, fontSize: 10, color: V.text3, fontFamily: V.ui }}>{payload.note}</div>
      )}
    </div>
  )

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: V.teal, fontFamily: V.ui }}>
          BOTTLENECK RRG
        </div>
        <div style={{ fontSize: 10, color: V.teal, fontFamily: V.mono, opacity: 0.75 }}>
          vs {benchmark}
        </div>
        <div style={{ fontSize: 10, color: V.text3, fontFamily: V.mono }}>
          {payload.generatedAt ? `as of ${payload.generatedAt.slice(0, 10)}` : ''}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: V.text3, fontFamily: V.ui, marginRight: 4 }}>Tail:</span>
          {([{ n: 1, label: 'No tail' }, { n: 4, label: '4W' }, { n: 8, label: '8W' }, { n: 12, label: '12W' }]).map(({ n, label }) => (
            <button key={n} onClick={() => setLookback(n)} style={{
              padding: '2px 6px', fontSize: 10, fontFamily: V.mono, cursor: 'pointer', borderRadius: 3,
              background: lookback === n ? 'rgba(63,182,168,0.15)' : 'transparent',
              border: `1px solid ${lookback === n ? V.teal : V.border}`,
              color: lookback === n ? V.teal : V.text3,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '0 8px', marginBottom: 12 }}>
        <MiniRRGChart series={liveSeries} lookbackWeeks={lookback} />
      </div>

      {/* Quadrant groups — single table for aligned columns across all groups */}
      <div style={{ padding: '0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '8%' }} />
            <col />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: `1px solid ${V.border}` }}>
              {(['Bucket', 'Stg', 'Quadrant', 'RS Ratio', 'RS Mom', 'Pts', ''] as const).map(h => (
                <th key={h} style={{
                  padding: '3px 6px',
                  textAlign: h === 'Bucket' ? 'left' : h === 'Quadrant' ? 'center' : 'right',
                  fontSize: 10, color: '#8b9098', fontWeight: 600, fontFamily: V.ui,
                  letterSpacing: '0.08em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Q_ORDER.filter(q => grouped.get(q)!.length > 0).flatMap(q => [
              <tr key={`hd-${q}`} style={{ borderTop: `1px solid ${V.border}22` }}>
                <td colSpan={7} style={{
                  padding: '10px 8px 4px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                  color: Q_COLOR[q], fontFamily: V.ui,
                }}>
                  {q.toUpperCase()} ({grouped.get(q)!.length})
                </td>
              </tr>,
              ...grouped.get(q)!.map(s => <BucketRow key={s.id} s={s} />),
            ])}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {payload.dataStatus?.pendingReason && (
        <div style={{ padding: '6px 16px', fontSize: 10, color: V.gold, fontFamily: V.ui }}>
          {payload.dataStatus.pendingReason}
        </div>
      )}
      <div style={{ padding: '6px 16px', fontSize: 11, color: '#8b9098', fontFamily: V.ui, lineHeight: 1.5 }}>
        Candidate-D formula. Equal-weight basket index. {liveSeries.length}/13 buckets live.
        Quadrant labels (Leading / Weakening / Lagging / Improving) are rotational position only — not investment signals.
        Not investment advice.
      </div>
    </div>
  )
}
