'use client'
// AI Investment Tower 초급 리포트 UI — 쉽게 보기 뷰

import type { BeginnerLayerReport } from '@/lib/ai-investment-tower/reportTypes'
import type { RiskLabel } from '@/lib/ai-investment-tower/reportTypes'

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

// ── Status badge colors ───────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  '요즘 잘나감':   V.green,
  '새로 뜨는 중': V.teal,
  '계속 강함':    V.mint,
  '힘 빠지는 중': V.amber,
  '강하지만 과열': V.orange,
  '확인 필요':    V.text3,
  '아직 관망':    V.text3,
  '위험 회피':    V.red,
}

const RISK_COLOR: Record<RiskLabel, string> = {
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
  EXTREME:  '극단적 위험',
  UNKNOWN:  '미분류',
}

const SECTION_DEFS = [
  { group: 'working',  title: '요즘 잘나가는 섹터',  icon: '▲', color: V.green },
  { group: 'emerging', title: '새로 뜨는 섹터',       icon: '↗', color: V.teal },
  { group: 'caution',  title: '조심할 섹터',          icon: '!', color: V.orange },
  { group: 'losing',   title: '힘 빠지는 섹터',       icon: '▼', color: V.amber },
  { group: 'neutral',  title: '확인이 더 필요한 섹터', icon: '—', color: V.text3 },
] as const

// ── LayerCard ─────────────────────────────────────────────────────────────────

function LayerCard({ report, accentColor }: { report: BeginnerLayerReport; accentColor: string }) {
  const statusColor = STATUS_COLOR[report.statusLabel] ?? V.text3

  return (
    <div style={{
      background:   V.bg2,
      border:       `1px solid ${V.border}`,
      borderLeft:   `3px solid ${accentColor}`,
      borderRadius: 8,
      padding:      '14px 16px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{
          fontFamily:  V.mono,
          fontSize:    11,
          fontWeight:  700,
          color:       statusColor,
          background:  `${statusColor}18`,
          border:      `1px solid ${statusColor}40`,
          borderRadius: 4,
          padding:     '2px 8px',
          letterSpacing: '0.06em',
          whiteSpace:  'nowrap',
        }}>
          {report.statusLabel}
        </span>
        <span style={{
          fontFamily:  V.ui,
          fontSize:    13,
          fontWeight:  600,
          color:       V.text,
        }}>
          {report.headline}
        </span>
        <span style={{
          marginLeft:  'auto',
          fontFamily:  V.mono,
          fontSize:    10,
          color:       RISK_COLOR[report.riskLabel],
          letterSpacing: '0.08em',
        }}>
          리스크: {RISK_KR[report.riskLabel]}
        </span>
      </div>
      <p style={{
        fontFamily:  V.ui,
        fontSize:    12,
        color:       V.text2,
        lineHeight:  1.7,
        margin:      0,
      }}>
        {report.explanation}
      </p>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, icon, color, reports,
}: {
  title: string; icon: string; color: string; reports: BeginnerLayerReport[]
}) {
  if (reports.length === 0) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily:    V.mono,
          fontSize:      11,
          fontWeight:    700,
          color,
          letterSpacing: '0.10em',
        }}>{icon}</span>
        <span style={{
          fontFamily:    V.ui,
          fontSize:      12,
          fontWeight:    700,
          color,
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
        }}>{title}</span>
        <span style={{
          fontFamily: V.mono,
          fontSize:   11,
          color:      V.text3,
          marginLeft: 4,
        }}>({reports.length})</span>
      </div>
      {reports.map(r => (
        <LayerCard key={r.layerId} report={r} accentColor={color} />
      ))}
    </div>
  )
}

// ── Overall summary block ─────────────────────────────────────────────────────

function OverallSummary({ text }: { text: string }) {
  if (!text) return null
  return (
    <div style={{
      background:   V.bg3,
      border:       `1px solid ${V.border}`,
      borderLeft:   `3px solid ${V.teal}`,
      borderRadius: 8,
      padding:      '14px 16px',
      marginBottom: 24,
    }}>
      <div style={{
        fontFamily:    V.mono,
        fontSize:      10,
        color:         V.teal,
        letterSpacing: '0.10em',
        marginBottom:  8,
      }}>전체 판단</div>
      <p style={{
        fontFamily: V.ui,
        fontSize:   13,
        color:      V.text,
        lineHeight: 1.8,
        margin:     0,
      }}>{text}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BeginnerReport({
  reports,
  overallNarrative,
}: {
  reports:          BeginnerLayerReport[]
  overallNarrative: string
}) {
  const byGroup = (g: string) => reports.filter(r => r.group === g)

  return (
    <div style={{ padding: '16px 0' }}>
      <OverallSummary text={overallNarrative} />
      {SECTION_DEFS.map(({ group, title, icon, color }) => (
        <Section
          key={group}
          title={title}
          icon={icon}
          color={color}
          reports={byGroup(group)}
        />
      ))}
    </div>
  )
}
