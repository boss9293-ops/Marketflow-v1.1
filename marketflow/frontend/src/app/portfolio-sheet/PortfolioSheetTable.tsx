'use client'

import type { CSSProperties } from 'react'

import { PORTFOLIO_SHEET_COLUMNS } from '@/lib/portfolio-sheet/columns'
import type {
  PortfolioSheetColumn,
  PortfolioSheetColumnKey,
  PortfolioSheetRow,
} from '@/lib/portfolio-sheet/types'

export type PortfolioSheetEditableField = 'ticker' | 'shares' | 'avgPrice'

export type PortfolioSheetDraft = {
  ticker: string
  shares: string
  avgPrice: string
}

type PortfolioSheetTableProps = {
  rows: PortfolioSheetRow[]
  editable?: boolean
  drafts?: Record<string, PortfolioSheetDraft>
  dirtyRowIds?: Record<string, boolean>
  onDraftChange?: (rowId: string, field: PortfolioSheetEditableField, value: string) => void
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

function formatNumber(value: number, precision = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision > 0 ? 0 : 0,
    maximumFractionDigits: precision,
  }).format(value)
}

function formatSignedNumber(value: number, precision = 0): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatNumber(value, precision)}`
}

function formatPercent(value: number, precision = 1): string {
  return `${formatNumber(value, precision)}%`
}

function formatSignedPercent(value: number, precision = 1): string {
  return `${formatSignedNumber(value, precision)}%`
}

function valueTone(column: PortfolioSheetColumn, value: unknown): CSSProperties['color'] {
  if (typeof value !== 'number') return '#d1d5db'
  if (!['signedNumber', 'signedPercent'].includes(column.kind)) return '#d1d5db'
  if (value > 0) return '#22c55e'
  if (value < 0) return '#ef4444'
  return '#cbd5e1'
}

function readCell(row: PortfolioSheetRow, key: PortfolioSheetColumnKey): unknown {
  return row[key]
}

function rowId(row: PortfolioSheetRow): string {
  return String(row.holdingId ?? `${row.account}:${row.ticker}:${row.order}`)
}

function mismatchFor(row: PortfolioSheetRow, key: PortfolioSheetColumnKey) {
  return row.calculationMismatches?.find((mismatch) => mismatch.field === key)
}

function formatMismatchValue(value: number, unit: 'number' | 'ratio'): string {
  if (unit === 'ratio') return `${formatNumber(value * 100, 3)}%`
  return formatNumber(value, 2)
}

function renderValue(row: PortfolioSheetRow, column: PortfolioSheetColumn): string {
  const value = readCell(row, column.key)

  if (value === null || value === undefined || value === '') return '-'

  if (column.kind === 'text') return String(value)
  if (column.kind === 'spark') return typeof value === 'string' && value.trim() ? value : '-'

  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'

  if (column.kind === 'index') return numberFormatter.format(value)
  if (column.kind === 'signedNumber') return formatSignedNumber(value, column.precision ?? 0)
  if (column.kind === 'percent') return formatPercent(value, column.precision ?? 1)
  if (column.kind === 'signedPercent') return formatSignedPercent(value, column.precision ?? 1)
  return formatNumber(value, column.precision ?? 2)
}

function editableFieldFor(column: PortfolioSheetColumn): PortfolioSheetEditableField | null {
  if (column.key === 'ticker') return 'ticker'
  if (column.key === 'shares') return 'shares'
  if (column.key === 'avgPrice') return 'avgPrice'
  return null
}

function cellStyle(row: PortfolioSheetRow, column: PortfolioSheetColumn, value: unknown): CSSProperties {
  const mismatch = mismatchFor(row, column.key)
  const editableShadow = 'inset 0 0 0 1px rgba(103,232,249,0.26), inset 3px 0 0 rgba(103,232,249,0.72)'
  const mismatchShadow = 'inset 0 -1px 0 rgba(251,191,36,0.62)'

  return {
    padding: '0.32rem 0.38rem',
    textAlign: column.align,
    whiteSpace: 'nowrap',
    color: value === '-' ? '#64748b' : valueTone(column, value),
    fontVariantNumeric: 'tabular-nums',
    background: column.editable ? 'rgba(8,47,73,0.32)' : 'rgba(255,255,255,0.012)',
    boxShadow: column.editable ? editableShadow : mismatch ? mismatchShadow : 'none',
    cursor: 'default',
  }
}

function inputStyle(column: PortfolioSheetColumn): CSSProperties {
  return {
    width: column.key === 'ticker' ? 86 : 76,
    minWidth: column.key === 'ticker' ? 86 : 76,
    height: 24,
    border: '1px solid rgba(103,232,249,0.28)',
    background: 'rgba(2,6,23,0.48)',
    color: '#e5f7ff',
    borderRadius: 5,
    padding: '0 0.34rem',
    fontSize: '0.72rem',
    fontWeight: column.key === 'ticker' ? 800 : 700,
    textAlign: column.align === 'right' ? 'right' : 'left',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  }
}

export function PortfolioSheetTable({
  rows,
  editable = false,
  drafts = {},
  dirtyRowIds = {},
  onDraftChange,
}: PortfolioSheetTableProps) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed rgba(148,163,184,0.24)',
          borderRadius: 8,
          color: '#8b93a8',
          fontSize: '0.82rem',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        No holdings were found for the selected account.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1720, fontSize: '0.74rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.78)' }}>
            {PORTFOLIO_SHEET_COLUMNS.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: '0.42rem 0.38rem',
                  color: column.editable ? '#67e8f9' : '#9ca3af',
                  textAlign: column.align,
                  whiteSpace: 'nowrap',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  background: column.editable ? 'rgba(8,47,73,0.24)' : 'transparent',
                  boxShadow: column.editable ? 'inset 0 2px 0 rgba(103,232,249,0.48)' : 'none',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {PORTFOLIO_SHEET_COLUMNS.map((column) => {
                const id = rowId(row)
                const rawValue = readCell(row, column.key)
                const text = renderValue(row, column)
                const toneValue = text === '-' ? '-' : rawValue
                const mismatch = mismatchFor(row, column.key)
                const editField = editable ? editableFieldFor(column) : null
                const draft = drafts[id]
                const dirty = dirtyRowIds[id]
                const title = mismatch
                  ? `${mismatch.label}: sheet ${formatMismatchValue(mismatch.sheetValue, mismatch.unit)} / app ${formatMismatchValue(mismatch.calculatedValue, mismatch.unit)}`
                  : editField
                    ? 'User input'
                    : 'Read-only calculated'

                return (
                  <td key={`${id}-${column.key}`} title={title} style={cellStyle(row, column, toneValue)}>
                    {editField ? (
                      <input
                        aria-label={`${row.ticker} ${column.label}`}
                        type={editField === 'ticker' ? 'text' : 'number'}
                        min={editField === 'ticker' ? undefined : 0}
                        step={editField === 'ticker' ? undefined : 'any'}
                        value={draft?.[editField] ?? text}
                        onChange={(event) => onDraftChange?.(id, editField, event.target.value)}
                        style={{
                          ...inputStyle(column),
                          borderColor: dirty ? 'rgba(251,191,36,0.64)' : 'rgba(103,232,249,0.28)',
                        }}
                      />
                    ) : column.key === 'ticker' ? (
                      <span style={{ color: '#e5f7ff', fontWeight: 800, letterSpacing: 0 }}>{text}</span>
                    ) : (
                      text
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
