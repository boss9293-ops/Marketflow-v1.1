'use client'

import {
  formatCurrency,
  formatPercent,
  formatRatio,
  formatNumber,
  valueColor,
} from '@/components/vr-simulator/formatters'
import { PerformanceMetrics } from '@/lib/backtest/types'

interface CardProps {
  label: string
  value: string
  detail: React.ReactNode
  accent: string
}

function Card({ label, value, detail, accent }: CardProps) {
  return (
    <div style={{
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,20,30,0.92)',
      padding: '0.55rem 0.7rem',
    }}>
      <div style={{ color: '#8ea1b9', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ color: accent, fontSize: '1.05rem', fontWeight: 800, marginTop: '0.2rem', lineHeight: 1.2 }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.18rem', lineHeight: 1.5 }}>{detail}</div>
    </div>
  )
}

function PriceRow({ label, price, count, accent }: { label: string; price: string; count: number; accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.2rem' }}>
      <span style={{ color: '#6b7280', fontSize: '0.66rem' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span style={{ color: accent, fontWeight: 700, fontSize: '0.72rem' }}>{price}</span>
        <span style={{ color: '#4b6280', fontSize: '0.65rem', marginLeft: '0.25rem' }}>×{count}</span>
      </span>
    </div>
  )
}

export default function SummaryCards({ metrics }: { metrics: PerformanceMetrics | null }) {
  if (!metrics) return null

  const N         = metrics.currentShares
  const vmin      = metrics.currentLowerBand
  const vmax      = metrics.currentUpperBand

  // Dynamic trigger prices (end-of-day close basis)
  const curBuyPrice  = N > 1 ? vmin / (N - 1) : 0    // Vmin / (N-1)
  const curSellPrice = N >= 1 ? vmax / (N + 1) : 0   // Vmax / (N+1)

  const ma200     = metrics.currentMa200
  const lastClose = metrics.finalPortfolioValue > 0
    ? metrics.currentTargetValue   // proxy — we don't store last close in metrics directly
    : null
  // MA200 vs Vref(종가 proxy): 실제론 SummaryCards에 close가 없어 Vref로 근사
  // 정확한 값은 차트 tooltip에서 확인 가능
  const ma200Gap = ma200 ? ((metrics.currentTargetValue / ma200 - 1) * 100) : null
  const ma200Color = ma200Gap != null ? (ma200Gap >= 0 ? '#22c55e' : '#ef4444') : '#6b7280'

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.45rem' }}>

      {/* 1. Final Portfolio */}
      <Card
        label="Final Portfolio"
        value={formatCurrency(metrics.finalPortfolioValue)}
        detail={`Elapsed ${metrics.elapsedDays} bars`}
        accent="#f8fafc"
      />

      {/* 2. Total Return */}
      <Card
        label="Total Return"
        value={formatPercent(metrics.totalReturnPct)}
        detail={`Max DD ${formatPercent(metrics.maxDrawdownPct)} · Realized ${formatCurrency(metrics.realizedPnl)}`}
        accent={valueColor(metrics.totalReturnPct)}
      />

      {/* 3. Pool (Cash) */}
      <Card
        label="Pool (Cash)"
        value={formatCurrency(metrics.cashBalance)}
        detail={`Unrealized PnL ${formatCurrency(metrics.unrealizedPnl)}`}
        accent="#f87171"
      />

      {/* 4. Shares */}
      <Card
        label="Current Shares"
        value={formatNumber(N, 4)}
        detail={`Avg cost ${formatCurrency(metrics.currentAvgCost)} · G ${formatNumber(metrics.currentGValue, 2)}`}
        accent="#22d3ee"
      />

      {/* 5. VR Bands */}
      <Card
        label="VR Bands"
        value={`${formatCurrency(vmin)} – ${formatCurrency(vmax)}`}
        detail={`Vref ${formatCurrency(metrics.currentTargetValue)} · P/V ${formatRatio(metrics.currentPvRatio)}`}
        accent="#f59e0b"
      />

      {/* 6. MA200 */}
      <Card
        label="MA200"
        value={ma200 ? formatCurrency(ma200) : '계산 중…'}
        detail={
          ma200Gap != null
            ? <span style={{ color: ma200Color }}>
                Vref 기준 {ma200Gap >= 0 ? '+' : ''}{ma200Gap.toFixed(2)}% {ma200Gap >= 0 ? '▲ MA200 위' : '▼ MA200 아래'}
              </span>
            : '데이터 부족 (200일 미만)'
        }
        accent={ma200Color}
      />

      {/* 7. Buy trigger */}
      <Card
        label="Next Buy Price"
        value={curBuyPrice > 0 ? formatCurrency(curBuyPrice) : '—'}
        accent="#22c55e"
        detail={
          <PriceRow
            label={`Vmin(${formatCurrency(vmin)}) ÷ (N-1=${Math.floor(N-1)})`}
            price={`×${metrics.buyTrades} trades`}
            count={metrics.buyTrades}
            accent="#22c55e"
          />
        }
      />

      {/* 8. Sell trigger */}
      <Card
        label="Next Sell Price"
        value={curSellPrice > 0 ? formatCurrency(curSellPrice) : '—'}
        accent="#ef4444"
        detail={
          <PriceRow
            label={`Vmax(${formatCurrency(vmax)}) ÷ (N+1=${Math.floor(N+1)})`}
            price={`×${metrics.sellTrades} trades`}
            count={metrics.sellTrades}
            accent="#ef4444"
          />
        }
      />

    </section>
  )
}
