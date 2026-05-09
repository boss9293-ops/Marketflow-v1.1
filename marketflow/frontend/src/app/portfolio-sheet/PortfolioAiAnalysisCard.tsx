'use client'

import type { CSSProperties } from 'react'

import type { PortfolioAccountSummary, PortfolioSheetRow } from '@/lib/portfolio-sheet/types'

type PortfolioAiAnalysisCardProps = {
  rows: PortfolioSheetRow[]
  summary: PortfolioAccountSummary
}

type Tone = 'high' | 'mid' | 'low'

function finite(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatMoney(value: number): string {
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)
  if (value < 0) return `-$${formatted}`
  return `$${formatted}`
}

function formatSignedMoney(value: number): string {
  if (value === 0) return '$0'
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${value.toFixed(1)}%`
}

function toneLabel(tone: Tone): string {
  if (tone === 'high') return '집중 높음'
  if (tone === 'mid') return '집중 중간'
  return '분산 양호'
}

function toneColor(tone: Tone): CSSProperties['color'] {
  if (tone === 'high') return '#f59e0b'
  if (tone === 'mid') return '#93c5fd'
  return '#34d399'
}

export function PortfolioAiAnalysisCard({ rows, summary }: PortfolioAiAnalysisCardProps) {
  const activeRows = rows.filter((row) => row.active !== false && finite(row.marketValue) > 0)
  const sortedRows = [...activeRows].sort((a, b) => finite(b.marketValue) - finite(a.marketValue))
  const topHolding = sortedRows[0] ?? null
  const topHoldingPct = topHolding && summary.marketValue > 0 ? (finite(topHolding.marketValue) / summary.marketValue) * 100 : 0
  const top3WeightPct =
    summary.marketValue > 0
      ? sortedRows.slice(0, 3).reduce((sum, row) => sum + finite(row.marketValue), 0) / summary.marketValue * 100
      : 0
  const cashRatioPct = summary.accountTotal > 0 ? (summary.cashBalance / summary.accountTotal) * 100 : 0
  const returnPct = summary.returnPct * 100
  const concentrationTone: Tone = top3WeightPct >= 80 ? 'high' : top3WeightPct >= 60 ? 'mid' : 'low'
  const pnlTone = summary.dollarTotalPnl > 0 ? '#22c55e' : summary.dollarTotalPnl < 0 ? '#ef4444' : '#cbd5e1'
  const mainTheme = topHolding
    ? `${topHolding.ticker} 중심의 ${toneLabel(concentrationTone)} 포트폴리오`
    : '분석 가능한 보유 종목이 없습니다'

  return (
    <div
      style={{
        border: '1px solid rgba(56,189,248,0.18)',
        borderRadius: 8,
        background: 'linear-gradient(145deg, rgba(8,13,23,0.62), rgba(15,23,42,0.38))',
        padding: '0.82rem 0.9rem',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#67e8f9', fontSize: '0.68rem', fontWeight: 950, letterSpacing: '0.14em' }}>
            PORTFOLIO AI ANALYSIS
          </div>
          <div style={{ color: '#f3f4f6', fontSize: '1rem', fontWeight: 900, marginTop: 6 }}>
            {mainTheme}
          </div>
        </div>
        <div
          style={{
            border: '1px solid rgba(34,197,94,0.24)',
            background: 'rgba(34,197,94,0.10)',
            color: '#86efac',
            borderRadius: 999,
            padding: '0.22rem 0.5rem',
            fontSize: '0.66rem',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          APP NATIVE
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, marginTop: 12 }}>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, background: 'rgba(255,255,255,0.025)', padding: '0.55rem 0.62rem' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 800 }}>Top Holding</div>
          <div style={{ color: '#f3f4f6', fontSize: '1rem', fontWeight: 950, marginTop: 4 }}>{topHolding?.ticker ?? '-'}</div>
          <div style={{ color: '#67e8f9', fontSize: '0.72rem', fontWeight: 800, marginTop: 2 }}>{topHolding ? formatPct(topHoldingPct) : '-'}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, background: 'rgba(255,255,255,0.025)', padding: '0.55rem 0.62rem' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 800 }}>Top 3 Weight</div>
          <div style={{ color: '#f3f4f6', fontSize: '1rem', fontWeight: 950, marginTop: 4 }}>{activeRows.length ? formatPct(top3WeightPct) : '-'}</div>
          <div style={{ color: toneColor(concentrationTone), fontSize: '0.72rem', fontWeight: 800, marginTop: 2 }}>
            {toneLabel(concentrationTone)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ color: '#dbeafe', fontSize: '0.78rem', lineHeight: 1.45 }}>
          상위 3종목 비중은 {activeRows.length ? formatPct(top3WeightPct) : '-'}로, 개별 종목 변동이 계좌 성과에 크게 반영될 수 있습니다.
        </div>
        <div style={{ color: '#dbeafe', fontSize: '0.78rem', lineHeight: 1.45 }}>
          현금 비중은 {formatPct(cashRatioPct)}이며, 추가 매수 여력은 A1 투자금 테이블과 현금잔고를 함께 봐야 합니다.
        </div>
        <div style={{ color: pnlTone, fontSize: '0.78rem', lineHeight: 1.45, fontWeight: 800 }}>
          누적 성과는 {formatSignedMoney(summary.dollarTotalPnl)} / {formatPct(returnPct)} 수준입니다.
        </div>
      </div>
    </div>
  )
}
