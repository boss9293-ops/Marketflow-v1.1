'use client'

import { formatCurrency, formatNumber, formatRatio } from '@/components/vr-simulator/formatters'
import { BacktestRow } from '@/lib/backtest/types'

const cellStyle: React.CSSProperties = {
  padding: '0.55rem 0.65rem',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: '0.77rem',
  color: '#dbe4f0',
  whiteSpace: 'nowrap',
}

const headers: Array<{ label: string; color?: string }> = [
  { label: 'Cycle',    color: '#a78bfa' },
  { label: 'Date' },
  { label: 'Close' },
  { label: 'BuyPrice', color: '#22c55e' },  // Vmin / shares (dynamic trigger)
  { label: 'Eval',     color: '#f8fafc' },
  { label: 'Vmin',     color: '#38bdf8' },
  { label: 'Vref',     color: '#c4ff0d' },
  { label: 'Vmax',     color: '#f59e0b' },
  { label: 'Shares',   color: '#22d3ee' },
  { label: 'Pool',     color: '#f87171' },
  { label: 'Buy $',    color: '#22c55e' },
  { label: 'Sell $',   color: '#f59e0b' },
  { label: 'Action' },
  { label: 'P/V' },
  { label: 'Reason' },
]

export default function DebugStateTable({ rows }: { rows: BacktestRow[] }) {
  return (
    <section style={{
      borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,20,30,0.92)', overflow: 'hidden',
    }}>
      <div style={{ padding: '1rem 1rem 0.8rem' }}>
        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f3f4f6' }}>Debug State</div>
        <div style={{ color: '#8ea1b9', fontSize: '0.78rem', marginTop: 4 }}>
          BuyPrice = Vmin ÷ shares (dynamic trigger — drops as shares grow)
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {headers.map(({ label, color }) => (
                <th key={label} style={{
                  ...cellStyle,
                  color: color ?? '#8ea1b9',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'left',
                  position: 'sticky',
                  top: 0,
                  background: 'rgba(17,22,32,0.98)',
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Dynamic buy trigger price for this bar's shares
              const buyPrice = row.shares > 0 ? row.lowerBand / row.shares : 0
              const evalVal = row.marketValue
              const atBuyZone = evalVal <= row.lowerBand
              const atSellZone = evalVal >= row.upperBand

              return (
                <tr key={`${row.date}-${row.totalDays}`} style={{
                  background: row.buySignal
                    ? 'rgba(34,197,94,0.07)'
                    : row.sellSignal
                    ? 'rgba(245,158,11,0.07)'
                    : undefined,
                }}>
                  <td style={{ ...cellStyle, color: '#a78bfa', fontWeight: 700 }}>{row.currentPeriod}</td>
                  <td style={cellStyle}>{row.date}</td>
                  <td style={{ ...cellStyle, color: atBuyZone ? '#22c55e' : atSellZone ? '#f59e0b' : '#f8fafc', fontWeight: (atBuyZone || atSellZone) ? 700 : 400 }}>
                    {formatCurrency(row.close)}
                  </td>
                  <td style={{ ...cellStyle, color: '#22c55e' }}>
                    {buyPrice > 0 ? formatCurrency(buyPrice) : '—'}
                  </td>
                  <td style={{ ...cellStyle, color: atBuyZone ? '#22c55e' : atSellZone ? '#f59e0b' : '#f8fafc' }}>
                    {formatCurrency(evalVal)}
                  </td>
                  <td style={{ ...cellStyle, color: '#38bdf8' }}>{formatCurrency(row.lowerBand)}</td>
                  <td style={{ ...cellStyle, color: '#c4ff0d' }}>{formatCurrency(row.targetValue)}</td>
                  <td style={{ ...cellStyle, color: '#f59e0b' }}>{formatCurrency(row.upperBand)}</td>
                  <td style={{ ...cellStyle, color: '#22d3ee', fontWeight: row.buySignal ? 700 : 400 }}>{formatNumber(row.shares, 4)}</td>
                  <td style={{ ...cellStyle, color: '#f87171' }}>{formatCurrency(row.cash)}</td>
                  <td style={{ ...cellStyle, color: row.buyAmount > 0 ? '#22c55e' : '#374151', fontWeight: row.buyAmount > 0 ? 700 : 400 }}>
                    {row.buyAmount > 0 ? formatCurrency(row.buyAmount) : '—'}
                  </td>
                  <td style={{ ...cellStyle, color: row.sellAmount > 0 ? '#f59e0b' : '#374151', fontWeight: row.sellAmount > 0 ? 700 : 400 }}>
                    {row.sellAmount > 0 ? formatCurrency(row.sellAmount) : '—'}
                  </td>
                  <td style={{ ...cellStyle, color: row.action === 'BUY' || row.action === 'INIT_BUY' ? '#22c55e' : row.action === 'SELL' ? '#f59e0b' : '#4b6280' }}>
                    {row.action ?? '—'}
                  </td>
                  <td style={cellStyle}>{formatRatio(row.pvRatio)}</td>
                  <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 200, color: '#8ea1b9', fontSize: '0.72rem' }}>
                    {row.reason ?? '—'}
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
