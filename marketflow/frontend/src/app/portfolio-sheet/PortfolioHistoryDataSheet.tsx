'use client'

import { useState } from 'react'

import type { PortfolioDailySnapshotRecord } from '@/lib/portfolio-sheet/types'
import { isPortfolioTradingDay } from '@/lib/portfolio-sheet/marketCalendar'

type PortfolioHistoryDataSheetProps = {
  history: PortfolioDailySnapshotRecord[]
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)
  if (value < 0) return `-$${formatted}`
  return `$${formatted}`
}

function formatSignedMoney(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value === 0) return '$0'
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function signedColor(value: number): string {
  if (value > 0) return '#22c55e'
  if (value < 0) return '#ef4444'
  return '#cbd5e1'
}

export function PortfolioHistoryDataSheet({ history }: PortfolioHistoryDataSheetProps) {
  const [open, setOpen] = useState(false)
  const tradingHistory = history.filter((snapshot) => isPortfolioTradingDay(snapshot.date))
  const hiddenClosedRows = history.length - tradingHistory.length

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      style={{
        marginTop: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        background: 'rgba(2,6,23,0.22)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
          padding: '0.58rem 0.68rem',
          color: '#e5e7eb',
          fontSize: '0.8rem',
          fontWeight: 900,
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <span>History Data Sheet</span>
        <span style={{ color: '#8b93a8', fontSize: '0.68rem', fontWeight: 700 }}>
          {tradingHistory.length} rows | read-only{hiddenClosedRows > 0 ? ` | ${hiddenClosedRows} closed-day hidden` : ''}
        </span>
      </summary>

      {tradingHistory.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '0.76rem', padding: '0.85rem', textAlign: 'center' }}>
          No trading-day snapshot history yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: '0.74rem' }}>
            <thead>
              <tr style={{ background: 'rgba(37,99,235,0.74)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'left', whiteSpace: 'nowrap' }}>날짜</th>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>계좌총액</th>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>투입액</th>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>수익금</th>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>수익률</th>
                <th style={{ color: '#fef08a', padding: '0.42rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {tradingHistory.map((snapshot) => {
                const pnl = Number(snapshot.pnl) || 0
                const delta = Number(snapshot.delta) || 0

                return (
                  <tr key={`${snapshot.account_name}-${snapshot.date}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ color: '#e5e7eb', padding: '0.38rem 0.5rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {snapshot.date}
                    </td>
                    <td style={{ color: '#dbeafe', padding: '0.38rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(Number(snapshot.total_value) || 0)}
                    </td>
                    <td style={{ color: '#fed7aa', padding: '0.38rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(Number(snapshot.total_cost) || 0)}
                    </td>
                    <td style={{ color: signedColor(pnl), padding: '0.38rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatSignedMoney(pnl)}
                    </td>
                    <td style={{ color: signedColor(pnl), padding: '0.38rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatPercent(Number(snapshot.pnl_pct) || 0)}
                    </td>
                    <td style={{ color: signedColor(delta), padding: '0.38rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatSignedMoney(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
