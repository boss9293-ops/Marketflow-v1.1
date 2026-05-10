'use client'
// AI Investment Tower 중급/고급 리포트 UI — 자세히 보기 뷰

import { useState } from 'react'
import type { ProLayerReport, RRGStateLabel, TrendLabel, RiskLabel, BreadthLabel } from '@/lib/ai-investment-tower/reportTypes'

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  orange: '#f97316',
  mint:   '#5DCFB0',
  bg:     '#0F1117',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Color helpers ─────────────────────────────────────────────────────────────

const RRG_COLORS: Record<RRGStateLabel, string> = {
  LEADING:   V.green,
  IMPROVING: V.teal,
  MIXED:     V.mint,
  WEAKENING: V.amber,
  LAGGING:   V.red,
  UNKNOWN:   V.text3,
}

const RRG_LABELS: Record<RRGStateLabel, string> = {
  LEADING:   'Leading',
  IMPROVING: 'Improving',
  MIXED:     'Confirming',
  WEAKENING: 'Weakening',
  LAGGING:   'Lagging',
  UNKNOWN:   '—',
}

const TREND_COLORS: Record<TrendLabel, string> = {
  UPTREND:    V.green,
  RECOVERING: V.teal,
  SIDEWAYS:   V.text3,
  DOWNTREND:  V.red,
  EXTENDED:   V.orange,
  UNKNOWN:    V.text3,
}

const TREND_LABELS: Record<TrendLabel, string> = {
  UPTREND:    'Uptrend',
  RECOVERING: 'Recovering',
  SIDEWAYS:   'Sideways',
  DOWNTREND:  'Downtrend',
  EXTENDED:   'Extended',
  UNKNOWN:    '—',
}

const RISK_COLORS: Record<RiskLabel, string> = {
  LOW:      V.green,
  MODERATE: V.teal,
  ELEVATED: V.amber,
  HIGH:     V.red,
  EXTREME:  '#c026d3',
  UNKNOWN:  V.text3,
}

const RISK_KR: Record<RiskLabel, string> = {
  LOW:      '낮음',
  MODERATE: '주의',
  ELEVATED: '과열 주의',
  HIGH:     '높음',
  EXTREME:  '극단적',
  UNKNOWN:  '—',
}

const BREADTH_KR: Record<BreadthLabel, string> = {
  BROAD:     '넓음',
  IMPROVING: '개선',
  NARROW:    '좁음',
  WEAK:      '약함',
  UNKNOWN:   '—',
}

const BREADTH_COLORS: Record<BreadthLabel, string> = {
  BROAD:     V.green,
  IMPROVING: V.teal,
  NARROW:    V.amber,
  WEAK:      V.red,
  UNKNOWN:   V.text3,
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function pctColor(v: number | null): string {
  if (v === null) return V.text3
  return v >= 0 ? V.green : V.red
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ report }: { report: ProLayerReport }) {
  return (
    <tr>
      <td colSpan={10} style={{
        padding:    '12px 16px 16px 16px',
        background: V.bg3,
        borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {[
            { label: 'RRG 포지션',  text: report.rrgComment },
            { label: '모멘텀',      text: report.momentumComment },
            { label: '추세',        text: report.trendComment },
            { label: '리스크',      text: report.riskComment },
          ].map(({ label, text }) => (
            <div key={label}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 4 }}>
                {label.toUpperCase()}
              </div>
              <p style={{ fontFamily: V.ui, fontSize: 12, color: V.text2, lineHeight: 1.7, margin: 0 }}>{text}</p>
            </div>
          ))}
        </div>
        <div style={{
          marginTop:    12,
          paddingTop:   10,
          borderTop:    `1px solid ${V.border}`,
          display:      'flex',
          alignItems:   'flex-start',
          gap:          8,
        }}>
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.10em', whiteSpace: 'nowrap' }}>
            NEXT CHECKPOINT
          </span>
          <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text, lineHeight: 1.6 }}>
            {report.nextCheckpoint}
          </span>
        </div>
        {report.coveragePct !== undefined && report.coveragePct < 1 && (
          <div style={{ marginTop: 8, fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.06em' }}>
            COVERAGE {Math.round(report.coveragePct * 100)}%
            {report.coveragePct < 0.80 ? ' — 일부 종목 기준' : ''}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────────

function ProTableRow({
  report,
  expanded,
  onToggle,
  onSelect,
}: {
  report:   ProLayerReport
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
}) {
  const rrgColor   = RRG_COLORS[report.rrgState]
  const trendColor = TREND_COLORS[report.trendLabel]
  const riskColor  = RISK_COLORS[report.riskLabel]

  const td = (children: React.ReactNode, opts?: { align?: 'right' | 'left'; color?: string; mono?: boolean }): React.ReactNode => (
    <td style={{
      padding:     '8px 10px',
      fontFamily:  opts?.mono !== false ? V.mono : V.ui,
      fontSize:    12,
      color:       opts?.color ?? V.text2,
      textAlign:   opts?.align ?? 'right',
      whiteSpace:  'nowrap',
    }}>
      {children}
    </td>
  )

  return (
    <>
      <tr
        onClick={() => { onToggle(); onSelect() }}
        style={{
          borderBottom: expanded ? 'none' : `1px solid ${V.border}`,
          cursor:       'pointer',
          background:   expanded ? V.bg3 : 'transparent',
          transition:   'background 0.1s',
        }}
      >
        {/* Layer */}
        <td style={{ padding: '8px 10px', fontFamily: V.ui, fontSize: 12, color: V.text, whiteSpace: 'nowrap' }}>
          <span style={{ marginRight: 6, fontSize: 10, color: V.text3 }}>{expanded ? '▾' : '▸'}</span>
          {report.koreanLabel}
        </td>
        {/* ETF */}
        {td(report.primaryEtf ?? '—', { color: V.text3, mono: true })}
        {/* RRG */}
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
          <span style={{
            fontFamily:    V.mono,
            fontSize:      11,
            color:         rrgColor,
            background:    `${rrgColor}18`,
            border:        `1px solid ${rrgColor}40`,
            borderRadius:  4,
            padding:       '1px 7px',
          }}>
            {RRG_LABELS[report.rrgState]}
          </span>
        </td>
        {/* 1W */}
        {td(fmtPct(report.momentum1w), { color: pctColor(report.momentum1w) })}
        {/* 1M */}
        {td(fmtPct(report.momentum1m), { color: pctColor(report.momentum1m) })}
        {/* 3M */}
        {td(fmtPct(report.momentum3m), { color: pctColor(report.momentum3m) })}
        {/* Trend */}
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: trendColor }}>
            {TREND_LABELS[report.trendLabel]}
          </span>
        </td>
        {/* Risk */}
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: riskColor }}>
            {RISK_KR[report.riskLabel]}
          </span>
        </td>
        {/* Breadth */}
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: V.mono, fontSize: 11, color: BREADTH_COLORS[report.breadthLabel] }}>
            {BREADTH_KR[report.breadthLabel]}
          </span>
        </td>
        {/* Signal */}
        <td style={{ padding: '8px 10px', fontFamily: V.ui, fontSize: 12, color: V.teal, whiteSpace: 'nowrap' }}>
          {report.towerSignal}
        </td>
      </tr>
      {expanded && <DetailDrawer report={report} />}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProReport({
  reports,
  onSelectLayer,
}: {
  reports: ProLayerReport[]
  onSelectLayer?: (layerId: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  const thStyle = (label: string): React.CSSProperties => ({
    padding:       '6px 10px',
    fontFamily:    V.mono,
    fontSize:      10,
    fontWeight:    700,
    color:         V.text3,
    letterSpacing: '0.10em',
    textAlign:     label === 'Layer' ? 'left' : 'right',
    whiteSpace:    'nowrap',
    borderBottom:  `1px solid ${V.border}`,
  })

  return (
    <div style={{ padding: '16px 0', overflowX: 'auto' }}>
      <p style={{ fontFamily: V.ui, fontSize: 12, color: V.text3, marginBottom: 12 }}>
        각 레이어를 클릭하면 상세 분석을 확인할 수 있습니다.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Layer', 'ETF', 'RRG', '1W', '1M', '3M', 'Trend', 'Risk', 'Breadth', 'Signal'].map(h => (
              <th key={h} style={thStyle(h)}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <ProTableRow
              key={r.layerId}
              report={r}
              expanded={expanded === r.layerId}
              onToggle={() => toggle(r.layerId)}
              onSelect={() => onSelectLayer?.(r.layerId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
