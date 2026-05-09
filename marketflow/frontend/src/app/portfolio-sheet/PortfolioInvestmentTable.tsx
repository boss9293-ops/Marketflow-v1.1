'use client'

import type { CSSProperties } from 'react'

import {
  investmentColumnKey,
  PORTFOLIO_INVESTMENT_COLUMNS,
  PORTFOLIO_INVESTMENT_MONTHS,
  PORTFOLIO_INVESTMENT_SHEET_LAYOUT,
} from '@/lib/portfolio-sheet/investmentLayout'
import type { PortfolioInvestmentSummary } from '@/lib/portfolio-sheet/types'

type PortfolioInvestmentTableProps = {
  accountName: string | null
  drafts: Record<string, string>
  dirtyCellIds: Record<string, boolean>
  summary: PortfolioInvestmentSummary
  saving?: boolean
  onDraftChange: (cellId: string, value: string) => void
  onSave: () => void
}

const moneyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0'
  return `$${moneyFormatter.format(value)}`
}

function inputStyle(dirty: boolean): CSSProperties {
  return {
    width: 86,
    minWidth: 86,
    height: 25,
    border: dirty ? '1px solid rgba(251,191,36,0.72)' : '1px solid rgba(103,232,249,0.22)',
    background: 'rgba(2,6,23,0.46)',
    color: '#fef08a',
    borderRadius: 4,
    padding: '0 0.34rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    textAlign: 'right',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  }
}

export function PortfolioInvestmentTable({
  accountName,
  drafts,
  dirtyCellIds,
  summary,
  saving = false,
  onDraftChange,
  onSave,
}: PortfolioInvestmentTableProps) {
  const dirtyCount = Object.values(dirtyCellIds).filter(Boolean).length
  const saveDisabled = !accountName || dirtyCount === 0 || saving

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fef08a', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.08em' }}>
            A1 INVESTMENT TABLE
          </div>
          <div style={{ color: '#8b93a8', fontSize: '0.7rem', marginTop: 3 }}>
            {PORTFOLIO_INVESTMENT_SHEET_LAYOUT.inputRange} inputs | totals are calculated
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          style={{
            border: saveDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(250,204,21,0.36)',
            background: saveDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(250,204,21,0.10)',
            color: saveDisabled ? '#9ca3af' : '#fef08a',
            borderRadius: 7,
            padding: '0.38rem 0.62rem',
            fontSize: '0.72rem',
            fontWeight: 900,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saveDisabled ? 0.62 : 1,
          }}
        >
          {saving ? 'Saving...' : `Save Investment${dirtyCount ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ background: 'rgba(37,99,235,0.70)', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
              <th
                style={{
                  color: '#fef08a',
                  padding: '0.4rem 0.36rem',
                  textAlign: 'center',
                  fontWeight: 950,
                  whiteSpace: 'nowrap',
                }}
              >
                연 월
              </th>
              {PORTFOLIO_INVESTMENT_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  style={{
                    color: '#fef08a',
                    padding: '0.4rem 0.36rem',
                    textAlign: 'right',
                    fontWeight: 950,
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PORTFOLIO_INVESTMENT_MONTHS.map((month) => (
              <tr key={month} style={{ borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                <td
                  style={{
                    background: 'rgba(255,255,255,0.035)',
                    color: '#fef08a',
                    textAlign: 'center',
                    fontWeight: 900,
                    padding: '0.29rem 0.36rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {month}
                </td>
                {PORTFOLIO_INVESTMENT_COLUMNS.map((column) => {
                  const cellId = investmentColumnKey(column, month)
                  const dirty = Boolean(dirtyCellIds[cellId])

                  return (
                    <td
                      key={cellId}
                      style={{
                        background: column.periodType === 'before_year' ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.018)',
                        padding: '0.24rem 0.34rem',
                        textAlign: 'right',
                      }}
                    >
                      <input
                        aria-label={`${accountName || 'account'} ${column.label} ${month}`}
                        type="number"
                        min={0}
                        step="any"
                        value={drafts[cellId] ?? ''}
                        onChange={(event) => onDraftChange(cellId, event.target.value)}
                        style={inputStyle(dirty)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid rgba(59,130,246,0.55)', background: 'rgba(59,130,246,0.62)' }}>
              <td style={{ color: '#fef08a', fontWeight: 950, textAlign: 'center', padding: '0.38rem 0.36rem' }}>
                합계
              </td>
              {PORTFOLIO_INVESTMENT_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  style={{
                    color: '#f8fafc',
                    fontWeight: 900,
                    textAlign: 'right',
                    padding: '0.38rem 0.48rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatMoney(summary.annualTotals[column.key] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          border: '1px solid rgba(250,204,21,0.18)',
          background: 'rgba(250,204,21,0.07)',
          borderRadius: 7,
          padding: '0.54rem 0.65rem',
        }}
      >
        <div style={{ color: '#fef08a', fontWeight: 950, fontSize: '0.82rem' }}>투자총액</div>
        <div style={{ color: '#fef08a', fontWeight: 950, fontSize: '1.18rem', fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(summary.totalInvested)}
        </div>
      </div>
    </div>
  )
}
