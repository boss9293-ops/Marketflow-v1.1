'use client'
// AI Investment Tower 상단 5개 요약 카드 — 현재 AI 사이클 상태 한눈에 보기

import type { TowerSummary } from '@/lib/ai-investment-tower/towerSummary'

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

function SummaryCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      flex:          '1 1 0',
      minWidth:      130,
      padding:       '10px 14px 12px',
      background:    V.bg2,
      border:        `1px solid ${V.border}`,
      borderRadius:  6,
    }}>
      <div style={{
        fontFamily:    V.mono,
        fontSize:      10,
        color:         V.text3,
        letterSpacing: '0.10em',
        marginBottom:  6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function TagList({ items, color, emptyText }: { items: string[]; color: string; emptyText: string }) {
  if (items.length === 0) {
    return (
      <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>{emptyText}</span>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map(name => (
        <span key={name} style={{
          fontFamily:   V.ui,
          fontSize:     11,
          color,
          background:   `${color}15`,
          border:       `1px solid ${color}35`,
          borderRadius: 4,
          padding:      '1px 7px',
          whiteSpace:   'nowrap',
        }}>
          {name}
        </span>
      ))}
    </div>
  )
}

export function AITowerSummaryCards({ summary }: { summary: TowerSummary }) {
  return (
    <div style={{
      display:      'flex',
      gap:          8,
      flexWrap:     'wrap',
      marginBottom: 16,
    }}>
      {/* 1. AI Tower 상태 — 2× width: holds stateLabel + stateComment */}
      <div style={{
        flex:         '2 1 0',
        minWidth:     200,
        padding:      '10px 14px 12px',
        background:   V.bg2,
        border:       `1px solid ${V.border}`,
        borderRadius: 6,
      }}>
        <div style={{
          fontFamily:    V.mono,
          fontSize:      10,
          color:         V.text3,
          letterSpacing: '0.10em',
          marginBottom:  6,
        }}>
          AI TOWER STATE
        </div>
        <div style={{ fontFamily: V.ui, fontSize: 13, color: V.text, fontWeight: 600, marginBottom: 2 }}>
          {summary.stateLabel}
        </div>
        {summary.stateComment && (
          <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.5 }}>
            {summary.stateComment}
          </div>
        )}
      </div>

      {/* 2. 주도 계층 */}
      <SummaryCard label="PRIMARY LEADERSHIP">
        <TagList items={summary.leadership} color={V.green} emptyText="뚜렷한 주도 섹터 없음" />
      </SummaryCard>

      {/* 3. 부각 계층 */}
      <SummaryCard label="EMERGING LAYERS">
        <TagList items={summary.emerging} color={V.teal} emptyText="뚜렷한 신규 부각 없음" />
      </SummaryCard>

      {/* 4. 약화 계층 */}
      <SummaryCard label="WEAKENING LAYERS">
        <TagList items={summary.weakening} color={V.amber} emptyText="뚜렷한 약화 없음" />
      </SummaryCard>

      {/* 5. 리스크 레벨 */}
      <SummaryCard label="RISK LEVEL">
        <span style={{
          fontFamily:    V.mono,
          fontSize:      13,
          color:         summary.riskColor,
          fontWeight:    700,
          letterSpacing: '0.04em',
        }}>
          {summary.riskLabel}
        </span>
      </SummaryCard>
    </div>
  )
}
