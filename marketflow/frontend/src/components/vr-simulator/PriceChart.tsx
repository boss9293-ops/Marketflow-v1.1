'use client'

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartShell from '@/components/vr-simulator/ChartShell'
import { formatCurrency, formatShortDate } from '@/components/vr-simulator/formatters'
import { BacktestRow } from '@/lib/backtest/types'

function renderPriceDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload) return <g />
  if (payload.buySignal)  return <circle cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#14532d" strokeWidth={1.5} />
  if (payload.sellSignal) return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.5} />
  return <g />
}

// ── Custom trade tooltip ──────────────────────────────────────────────────────
function TradeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row: BacktestRow = payload[0]?.payload
  if (!row) return null

  const close  = row.close
  const vmin   = row.lowerBand
  const vmax   = row.upperBand
  const vref   = row.targetValue
  const pool   = row.cash
  const shares = row.shares
  const ma200  = row.ma200

  const isBuy  = row.buySignal
  const isSell = row.sellSignal

  const preN = isBuy  ? shares - 1 :
               isSell ? shares + 1 :
               shares

  const triggerPrice = isBuy  ? (preN > 1 ? vmin / (preN - 1) : 0) :
                       isSell ? vmax / (preN + 1) : 0

  function ladderLevels(baseFn: (n: number) => number, currentN: number, isBuyMode: boolean) {
    const levels: Array<{ shares: number; price: number; current: boolean }> = []
    const range = isBuyMode
      ? [currentN - 1, currentN, currentN + 1, currentN + 2]
      : [currentN - 2, currentN - 1, currentN, currentN + 1]
    for (const n of range) {
      if (n > 0) levels.push({ shares: n, price: baseFn(n), current: n === currentN })
    }
    return isBuyMode ? levels.reverse() : levels
  }

  const buyLadder  = isBuy  ? ladderLevels(n => vmin / (n - 1), preN, true)  : []
  const sellLadder = isSell ? ladderLevels(n => vmax / (n + 1), preN, false) : []

  const accent = isBuy ? '#22c55e' : isSell ? '#ef4444' : '#94a3b8'
  const label2 = isBuy ? 'BUY' : isSell ? 'SELL' : ''
  const ma200Color = ma200 ? (close > ma200 ? '#22c55e' : '#ef4444') : '#4b6280'

  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${accent}44`,
      background: 'rgba(7,10,18,0.97)',
      padding: '0.75rem 0.9rem', minWidth: 240, maxWidth: 300,
      fontSize: '0.77rem',
    }}>
      {/* Date + action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}</span>
        {label2 && (
          <span style={{ color: accent, fontWeight: 800, fontSize: '0.8rem',
            border: `1px solid ${accent}55`, borderRadius: 6, padding: '0 0.4rem' }}>
            {label2}
          </span>
        )}
      </div>

      {/* 공통 정보 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ color: '#6b7280' }}>종가</span>
        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{formatCurrency(close)}</span>

        <span style={{ color: '#6b7280' }}>MA200</span>
        <span style={{ color: ma200Color, fontWeight: 700 }}>
          {ma200 ? formatCurrency(ma200) : '—'}
          {ma200 && <span style={{ color: '#4b6280', fontSize: '0.67rem', marginLeft: 4 }}>
            {close > ma200 ? '▲위' : '▼아래'}
          </span>}
        </span>

        <span style={{ color: '#6b7280' }}>주식수</span>
        <span style={{ color: '#22d3ee', fontWeight: 700 }}>{shares.toFixed(4)}주</span>

        <span style={{ color: '#6b7280' }}>Pool</span>
        <span style={{ color: '#f87171' }}>{formatCurrency(pool)}</span>

        <span style={{ color: '#6b7280' }}>Vref</span>
        <span style={{ color: '#a3e635' }}>{formatCurrency(vref)}</span>

        {(isBuy || isSell) && triggerPrice > 0 && <>
          <span style={{ color: '#6b7280' }}>트리거</span>
          <span style={{ color: accent, fontWeight: 700 }}>
            {formatCurrency(triggerPrice)}
            <span style={{ color: '#4b6280', fontSize: '0.68rem', marginLeft: 4 }}>
              {isBuy ? '≥ close ✓' : '≤ close ✓'}
            </span>
          </span>
        </>}
      </div>

      {/* Ladder — buy */}
      {isBuy && buyLadder.length > 0 && (
        <div>
          <div style={{ color: '#4b6280', fontSize: '0.67rem', marginBottom: '0.28rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            매수 Ladder  (Vmin {formatCurrency(vmin)} ÷ shares)
          </div>
          {buyLadder.map(lv => (
            <div key={lv.shares} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0.1rem 0.3rem', borderRadius: 4,
              background: lv.current ? 'rgba(34,197,94,0.15)' : 'transparent',
            }}>
              <span style={{ color: lv.current ? '#22c55e' : '#4b6280' }}>
                {lv.shares}주 {lv.current ? '← 실행됨' : ''}
              </span>
              <span style={{ color: lv.current ? '#22c55e' : '#64748b', fontWeight: lv.current ? 700 : 400 }}>
                {formatCurrency(lv.price)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ladder — sell */}
      {isSell && sellLadder.length > 0 && (
        <div>
          <div style={{ color: '#4b6280', fontSize: '0.67rem', marginBottom: '0.28rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            매도 Ladder  (Vmax {formatCurrency(vmax)} ÷ shares)
          </div>
          {sellLadder.map(lv => (
            <div key={lv.shares} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0.1rem 0.3rem', borderRadius: 4,
              background: lv.current ? 'rgba(239,68,68,0.15)' : 'transparent',
            }}>
              <span style={{ color: lv.current ? '#ef4444' : '#4b6280' }}>
                {lv.shares}주 {lv.current ? '← 실행됨' : ''}
              </span>
              <span style={{ color: lv.current ? '#ef4444' : '#64748b', fontWeight: lv.current ? 700 : 400 }}>
                {formatCurrency(lv.price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ChartASubtitle = (
  <span>
    <span style={{ color: '#e2e8f0' }}>Close</span>
    {' · '}
    <span style={{ color: '#f59e0b' }}>MA200 (amber dashed)</span>
    {' · '}
    <span style={{ color: '#22c55e' }}>BUY (green ●)</span>
    {' '}
    <span style={{ color: '#ef4444' }}>SELL (red ●)</span>
    {' · '}
    <span style={{ color: '#f87171' }}>Pool (red dashed, right axis)</span>
  </span>
)

// ── Component ─────────────────────────────────────────────────────────────────
// ma200은 engine.ts에서 전체 bars 기반으로 계산되어 row.ma200에 주입됨
export default function PriceChart({ rows }: { rows: BacktestRow[] }) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>

      {/* Chart A: Price + Pool */}
      <ChartShell
        title="Chart A · Price and Pool"
        subtitle={ChartASubtitle}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 52, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatShortDate} minTickGap={40} />
            <YAxis yAxisId="price" tick={{ fill: '#8ea1b9', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
            <YAxis
              yAxisId="pool"
              orientation="right"
              tick={{ fill: '#f87171', fontSize: 10 }}
              tickFormatter={(v) => formatCurrency(v, 0)}
              width={54}
            />
            <Tooltip content={<TradeTooltip />} />
            {/* 200일 이동평균선 (engine에서 전체 DB 기반 계산) */}
            <Line yAxisId="price" type="monotone" dataKey="ma200" stroke="#f59e0b" dot={false} activeDot={false} strokeWidth={1.5} strokeDasharray="6 3" name="MA200" connectNulls={false} />
            {/* 종가 */}
            <Line yAxisId="price" type="monotone" dataKey="close" stroke="#e2e8f0" dot={renderPriceDot} activeDot={false} strokeWidth={2} name="Close" />
            {/* Pool */}
            <Line yAxisId="pool"  type="monotone" dataKey="cash"  stroke="#f87171" dot={false} activeDot={false} strokeWidth={1.5} strokeDasharray="4 3" name="Pool" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartShell>

      {/* Shares panel */}
      <ChartShell
        title="Chart A2 · Shares Held"
        subtitle={<span style={{ color: '#22d3ee' }}>보유 주식수 추이</span>}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatShortDate} minTickGap={40} />
            <YAxis tick={{ fill: '#22d3ee', fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(1)} width={44} />
            <Tooltip content={<TradeTooltip />} />
            <Line type="monotone" dataKey="shares" stroke="#22d3ee" dot={false} strokeWidth={1.8} name="Shares" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartShell>

    </div>
  )
}
