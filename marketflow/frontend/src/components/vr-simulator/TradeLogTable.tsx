'use client'

import { formatCurrency, formatNumber, formatRatio, valueColor } from '@/components/vr-simulator/formatters'
import { TradeEvent } from '@/lib/backtest/types'

const cellStyle: React.CSSProperties = {
  padding: '0.22rem 0.6rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: '0.76rem',
  color: '#dbe4f0',
  whiteSpace: 'nowrap',
}

export default function TradeLogTable({ trades }: { trades: TradeEvent[] }) {
  // 같은 날짜 그룹 인덱스 계산 — 날짜가 바뀌는 첫 번째 행에만 날짜 표시
  const dateGroups = trades.map((t, i) => ({
    showDate:   i === 0 || t.date !== trades[i - 1].date,
    groupStart: i === 0 || t.date !== trades[i - 1].date,
    // 같은 날짜 그룹 내 trade 수
    sameDay:    trades.filter(x => x.date === t.date).length,
  }))

  return (
    <section style={{
      borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,20,30,0.92)', overflow: 'hidden',
    }}>
      <div style={{ padding: '0.75rem 1rem 0.55rem' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f3f4f6' }}>Trade Log</div>
        <div style={{ color: '#8ea1b9', fontSize: '0.76rem', marginTop: 2 }}>
          Executed orders · 같은 날 복수 체결은 묶어서 표시
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['Date', 'Action', 'Price', 'Order $', 'Qty', 'Cash After', 'Shares After',
                'Avg Cost', 'Portfolio', 'Vref', 'Vmax', 'Vmin', 'P/V', 'Realized PnL', 'Reason'].map(h => (
                <th key={h} style={{
                  ...cellStyle,
                  color: '#8ea1b9', fontSize: '0.71rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  textAlign: 'left', position: 'sticky', top: 0,
                  background: 'rgba(17,22,32,0.98)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, i) => {
              const { showDate, sameDay } = dateGroups[i]
              // 같은 날 복수 거래면 첫 행은 날짜 표시 + 연한 구분선, 이후 행은 날짜 숨김
              const isMultiDay  = sameDay > 1
              const rowBg       = showDate && isMultiDay
                ? 'rgba(56,189,248,0.04)'   // 같은날 그룹 첫 행
                : isMultiDay && !showDate
                ? 'rgba(56,189,248,0.02)'   // 같은날 그룹 이후 행
                : 'transparent'

              return (
                <tr key={trade.id} style={{ background: rowBg }}>
                  {/* Date — 같은 날이면 첫 행에만, 이후는 빈 셀에 수직선 표시 */}
                  <td style={{
                    ...cellStyle,
                    borderLeft: isMultiDay ? '2px solid rgba(56,189,248,0.30)' : 'none',
                    color: showDate ? '#94a3b8' : 'transparent',
                    userSelect: showDate ? 'auto' : 'none',
                  }}>
                    {showDate ? trade.date : '└'}
                    {showDate && isMultiDay && (
                      <span style={{ color: '#38bdf8', fontSize: '0.63rem', marginLeft: 4 }}>
                        ×{sameDay}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, color: trade.action === 'SELL' ? '#fca5a5' : trade.action === 'INIT_BUY' ? '#7dd3fc' : '#86efac', fontWeight: 700 }}>
                    {trade.action}
                  </td>
                  <td style={cellStyle}>{formatCurrency(trade.price)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.orderAmount)}</td>
                  <td style={cellStyle}>{formatNumber(trade.quantity, 4)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.cashAfterTrade)}</td>
                  <td style={cellStyle}>{formatNumber(trade.sharesAfterTrade, 4)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.avgCostAfterTrade)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.portfolioValueAfterTrade)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.targetValue)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.upperBand)}</td>
                  <td style={cellStyle}>{formatCurrency(trade.lowerBand)}</td>
                  <td style={cellStyle}>{formatRatio(trade.pvRatio)}</td>
                  <td style={{ ...cellStyle, color: valueColor(trade.realizedPnl) }}>{formatCurrency(trade.realizedPnl)}</td>
                  <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 160, fontSize: '0.72rem', color: '#6b7280' }}>
                    {trade.reason}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
