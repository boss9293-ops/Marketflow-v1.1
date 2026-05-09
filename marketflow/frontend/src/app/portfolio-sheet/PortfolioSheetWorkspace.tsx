'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Archive, BarChart3, Database, Download, Landmark, RefreshCw, Save, Sparkles, Table2, Upload, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { parsePortfolioCsv } from '@/lib/portfolio-sheet/csvImport'
import type { PortfolioCsvInvalidRow, PortfolioCsvParseResult } from '@/lib/portfolio-sheet/csvImport'
import { clientApiUrl } from '@/lib/backendApi'
import {
  downloadCsvFile,
  portfolioHoldingsToCsv,
  portfolioReportToCsv,
  portfolioSnapshotHistoryToCsv,
  safeCsvFilePart,
} from '@/lib/portfolio-sheet/csvExport'
import {
  buildInvestmentDrafts,
  investmentColumnKey,
  PORTFOLIO_INVESTMENT_COLUMNS,
  PORTFOLIO_INVESTMENT_MONTHS,
  summarizeInvestmentDrafts,
} from '@/lib/portfolio-sheet/investmentLayout'
import { isPortfolioTradingDay, portfolioMarketClosureReason } from '@/lib/portfolio-sheet/marketCalendar'
import { buildPortfolioSheetRows } from '@/lib/portfolio-sheet/rowBuilder'
import type {
  PortfolioAccountRecord,
  PortfolioAccountSummary,
  PortfolioDailySnapshotRecord,
  PortfolioHoldingRecord,
  PortfolioInvestmentContributionInput,
  PortfolioInvestmentContributionRecord,
  PortfolioPriceData,
} from '@/lib/portfolio-sheet/types'

import { PortfolioHistoryChart } from './PortfolioHistoryChart'
import { PortfolioAiAnalysisCard } from './PortfolioAiAnalysisCard'
import { PortfolioHistoryDataSheet } from './PortfolioHistoryDataSheet'
import { PortfolioInvestmentTable } from './PortfolioInvestmentTable'
import { PortfolioPositionCharts } from './PortfolioPositionCharts'
import { PortfolioSheetTable, type PortfolioSheetDraft } from './PortfolioSheetTable'
import { PortfolioSummaryBox } from './PortfolioSummaryBox'

type AccountsPayload = {
  accounts?: PortfolioAccountRecord[]
}

type AccountPayload = {
  account?: PortfolioAccountRecord
}

type HoldingsPayload = {
  holdings?: PortfolioHoldingRecord[]
}

type PricesPayload = {
  prices?: Record<string, PortfolioPriceData>
}

type HistoryPayload = {
  history?: PortfolioDailySnapshotRecord[]
}

type InvestmentsPayload = {
  investments?: PortfolioInvestmentContributionRecord[]
}

type SnapshotPayload = {
  snapshot?: PortfolioDailySnapshotRecord
}

type ImportCsvPayload = {
  result?: {
    parsedRows: number
    inserted: number
    updated: number
    skipped: number
    cashUpdatedAccounts: string[]
    invalidRows: PortfolioCsvInvalidRow[]
    ignoredColumns: string[]
  }
}

type MarketIndicesPayload = {
  currencies?: Record<string, { price?: number | null; change_pct?: number | null }>
}

const panelStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
  borderRadius: 8,
  padding: '0.92rem',
}

const mutedText: CSSProperties = {
  color: '#8b93a8',
  fontSize: '0.78rem',
  lineHeight: 1.5,
}

const disabledButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#9ca3af',
  borderRadius: 7,
  padding: '0.44rem 0.68rem',
  fontSize: '0.74rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  cursor: 'not-allowed',
  opacity: 0.72,
}

function SectionTitle({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            border: '1px solid rgba(56,189,248,0.25)',
            background: 'rgba(56,189,248,0.10)',
            color: '#67e8f9',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </span>
        <div style={{ color: '#e5e7eb', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{title}</div>
      </div>
      {note ? <div style={{ ...mutedText, fontSize: '0.72rem' }}>{note}</div> : null}
    </div>
  )
}

function emptySummary(account: string | null): PortfolioAccountSummary {
  return {
    account,
    totalPortfolioValue: 0,
    marketValue: 0,
    costBasis: 0,
    cashBalance: 0,
    accountTotal: 0,
    totalInvested: 0,
    dollarTotalPnl: 0,
    returnPct: 0,
    todayPnl: 0,
    pnl: 0,
    pnlPct: 0,
    positionCount: 0,
    activePositionCount: 0,
  }
}

function draftFromHolding(holding: PortfolioHoldingRecord): PortfolioSheetDraft {
  return {
    ticker: holding.ticker,
    shares: String(holding.shares),
    avgPrice: String(holding.avg_price),
  }
}

function buildDrafts(holdings: PortfolioHoldingRecord[]): Record<string, PortfolioSheetDraft> {
  return holdings.reduce((acc, holding) => {
    acc[String(holding.id)] = draftFromHolding(holding)
    return acc
  }, {} as Record<string, PortfolioSheetDraft>)
}

function buildInvestmentRowsFromDrafts(
  accountName: string,
  drafts: Record<string, string>,
  cellIds?: string[],
): PortfolioInvestmentContributionInput[] {
  const wanted = cellIds ? new Set(cellIds) : null
  const rows: PortfolioInvestmentContributionInput[] = []

  for (const column of PORTFOLIO_INVESTMENT_COLUMNS) {
    for (const month of PORTFOLIO_INVESTMENT_MONTHS) {
      const cellId = investmentColumnKey(column, month)
      if (wanted && !wanted.has(cellId)) continue

      const rawValue = drafts[cellId] ?? ''
      const amount = rawValue.trim() === '' ? 0 : Number(rawValue)
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${column.label} ${month}: investment amount must be number >= 0`)
      }

      rows.push({
        account_name: accountName,
        period_type: column.periodType,
        year: column.year,
        month,
        amount,
        memo: null,
      })
    }
  }

  return rows
}

function withInvestmentSummary(
  summary: PortfolioAccountSummary,
  totalInvestedFromTable: number,
): PortfolioAccountSummary {
  if (totalInvestedFromTable <= 0) return summary

  const dollarTotalPnl = summary.accountTotal - totalInvestedFromTable
  const returnPct = totalInvestedFromTable > 0 ? dollarTotalPnl / totalInvestedFromTable : 0

  return {
    ...summary,
    totalInvested: totalInvestedFromTable,
    dollarTotalPnl,
    returnPct,
    pnl: dollarTotalPnl,
    pnlPct: returnPct,
  }
}

function withCashBalance(summary: PortfolioAccountSummary, cashBalance: number): PortfolioAccountSummary {
  const safeCash = Number.isFinite(cashBalance) && cashBalance >= 0 ? cashBalance : summary.cashBalance
  const accountTotal = summary.marketValue + safeCash
  const invested = summary.totalInvested
  const dollarTotalPnl = invested > 0 ? accountTotal - invested : summary.marketValue - summary.costBasis
  const returnPct = invested > 0 ? dollarTotalPnl / invested : summary.returnPct

  return {
    ...summary,
    cashBalance: safeCash,
    accountTotal,
    totalPortfolioValue: accountTotal,
    dollarTotalPnl,
    returnPct,
    pnl: dollarTotalPnl,
    pnlPct: returnPct,
  }
}

function parseNumberInput(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateDraft(accountName: string | null, draft: PortfolioSheetDraft): string | null {
  const ticker = draft.ticker.trim().toUpperCase()
  const shares = parseNumberInput(draft.shares)
  const avgPrice = parseNumberInput(draft.avgPrice)

  if (!accountName?.trim()) return 'account_name required'
  if (!ticker) return 'ticker required'
  if (!/^[A-Z0-9.\-]{1,20}$/.test(ticker)) return `${ticker}: ticker invalid`
  if (shares === null || shares < 0) return `${ticker}: shares must be number >= 0`
  if (avgPrice === null || avgPrice < 0) return `${ticker}: avg_price must be number >= 0`
  return null
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof json?.error === 'string' ? json.error : `Request failed: ${res.status}`
    throw new Error(message)
  }
  return json as T
}

export function PortfolioSheetWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [accounts, setAccounts] = useState<PortfolioAccountRecord[]>([])
  const [activeAccountName, setActiveAccountName] = useState<string | null>(null)
  const [holdings, setHoldings] = useState<PortfolioHoldingRecord[]>([])
  const [investments, setInvestments] = useState<PortfolioInvestmentContributionRecord[]>([])
  const [prices, setPrices] = useState<Record<string, PortfolioPriceData>>({})
  const [drafts, setDrafts] = useState<Record<string, PortfolioSheetDraft>>({})
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({})
  const [investmentDrafts, setInvestmentDrafts] = useState<Record<string, string>>({})
  const [dirtyInvestmentCells, setDirtyInvestmentCells] = useState<Record<string, boolean>>({})
  const [cashDraft, setCashDraft] = useState('0')
  const [cashDirty, setCashDirty] = useState(false)
  const [cashSaving, setCashSaving] = useState(false)
  const [usdKrwRate, setUsdKrwRate] = useState('')
  const [usdKrwRateSource, setUsdKrwRateSource] = useState('')
  const [history, setHistory] = useState<PortfolioDailySnapshotRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [investmentSaving, setInvestmentSaving] = useState(false)
  const [snapshotSaving, setSnapshotSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvPreview, setCsvPreview] = useState<PortfolioCsvParseResult | null>(null)
  const [csvImportResult, setCsvImportResult] = useState<ImportCsvPayload['result'] | null>(null)
  const [status, setStatus] = useState<string>('Loading internal portfolio storage...')
  const [error, setError] = useState<string | null>(null)

  const activeAccount = useMemo(
    () => accounts.find((account) => account.name === activeAccountName) ?? null,
    [accounts, activeAccountName],
  )

  const rowResult = useMemo(() => {
    if (!activeAccountName) {
      return { rows: [], summary: emptySummary(null) }
    }
    const result = buildPortfolioSheetRows(holdings, prices, activeAccount)
    return { rows: result.rows, summary: result.summary }
  }, [activeAccount, activeAccountName, holdings, prices])

  const investmentSummary = useMemo(
    () => summarizeInvestmentDrafts(activeAccountName ?? '', investmentDrafts),
    [activeAccountName, investmentDrafts],
  )

  const effectiveCashBalance = useMemo(() => {
    const parsed = Number(cashDraft)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : activeAccount?.cash ?? 0
  }, [activeAccount?.cash, cashDraft])

  const displaySummary = useMemo(
    () => withInvestmentSummary(withCashBalance(rowResult.summary, effectiveCashBalance), investmentSummary.totalInvested),
    [effectiveCashBalance, investmentSummary.totalInvested, rowResult.summary],
  )

  const tradingHistory = useMemo(
    () => history.filter((snapshot) => isPortfolioTradingDay(snapshot.date)),
    [history],
  )

  const todayClosureReason = useMemo(() => portfolioMarketClosureReason(localDateKey()), [])

  const refreshAccounts = useCallback(async (preferredAccount?: string | null) => {
    const payload = await fetchJson<AccountsPayload>('/api/portfolio-sheet/accounts')
    const nextAccounts = payload.accounts ?? []
    setAccounts(nextAccounts)
    setActiveAccountName((current) => {
      if (preferredAccount && nextAccounts.some((account) => account.name === preferredAccount)) return preferredAccount
      if (current && nextAccounts.some((account) => account.name === current)) return current
      return nextAccounts[0]?.name ?? null
    })
    if (nextAccounts.length === 0) {
      setStatus('No internal accounts yet. Seed from the linked sample or create an account through the API.')
    }
  }, [])

  const refreshHoldings = useCallback(async (accountName: string) => {
    setLoading(true)
    setError(null)
    try {
      const holdingsPayload = await fetchJson<HoldingsPayload>(
        `/api/portfolio-sheet/holdings?account=${encodeURIComponent(accountName)}`,
      )
      const nextHoldings = holdingsPayload.holdings ?? []
      const tickers = Array.from(new Set(nextHoldings.map((holding) => holding.ticker))).join(',')
      const pricePayload = tickers
        ? await fetchJson<PricesPayload>(`/api/portfolio-sheet/prices?tickers=${encodeURIComponent(tickers)}`)
        : { prices: {} }

      setHoldings(nextHoldings)
      setPrices(pricePayload.prices ?? {})
      setDrafts(buildDrafts(nextHoldings))
      setDirtyRows({})
      setStatus(`${nextHoldings.length} holdings loaded from internal SQLite storage.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshHistory = useCallback(async (accountName: string) => {
    const payload = await fetchJson<HistoryPayload>(
      `/api/portfolio-sheet/history?account=${encodeURIComponent(accountName)}`,
    )
    setHistory(payload.history ?? [])
  }, [])

  const refreshInvestments = useCallback(async (accountName: string) => {
    const payload = await fetchJson<InvestmentsPayload>(
      `/api/portfolio-sheet/investments?account=${encodeURIComponent(accountName)}`,
    )
    const nextInvestments = payload.investments ?? []
    setInvestments(nextInvestments)
    setInvestmentDrafts(buildInvestmentDrafts(nextInvestments))
    setDirtyInvestmentCells({})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refreshAccounts()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load accounts')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshAccounts])

  useEffect(() => {
    const cash = activeAccount?.cash
    setCashDraft(typeof cash === 'number' && Number.isFinite(cash) ? String(cash) : '0')
    setCashDirty(false)
  }, [activeAccount?.id, activeAccount?.cash])

  useEffect(() => {
    let cancelled = false

    const storedRate = (() => {
      try {
        return window.localStorage.getItem('portfolio_sheet_usdkrw_rate') || ''
      } catch {
        return ''
      }
    })()

    if (storedRate) {
      setUsdKrwRate(storedRate)
      setUsdKrwRateSource('manual')
      return () => {
        cancelled = true
      }
    }

    fetch(clientApiUrl('/api/market/indices'), { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: MarketIndicesPayload) => {
        if (cancelled) return
        const currencies = json?.currencies ?? {}
        const rate = currencies['KRW=X']?.price ?? currencies['USDKRW=X']?.price
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
          setUsdKrwRate(String(rate))
          setUsdKrwRateSource('market')
        }
      })
      .catch(() => {
        if (!cancelled) setUsdKrwRateSource('')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeAccountName) {
      setHoldings([])
      setInvestments([])
      setPrices({})
      setDrafts({})
      setDirtyRows({})
      setInvestmentDrafts({})
      setDirtyInvestmentCells({})
      setHistory([])
      return
    }
    void refreshHoldings(activeAccountName)
    void refreshInvestments(activeAccountName).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load investment table')
    })
    void refreshHistory(activeAccountName).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot history')
    })
  }, [activeAccountName, refreshHistory, refreshHoldings, refreshInvestments])

  function handleDraftChange(rowId: string, field: keyof PortfolioSheetDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] ?? { ticker: '', shares: '0', avgPrice: '0' }),
        [field]: value,
      },
    }))
    setDirtyRows((current) => ({ ...current, [rowId]: true }))
  }

  function handleInvestmentDraftChange(cellId: string, value: string) {
    setInvestmentDrafts((current) => ({
      ...current,
      [cellId]: value,
    }))
    setDirtyInvestmentCells((current) => ({ ...current, [cellId]: true }))
  }

  function handleCashDraftChange(value: string) {
    setCashDraft(value)
    setCashDirty(true)
  }

  function handleUsdKrwRateChange(value: string) {
    setUsdKrwRate(value)
    setUsdKrwRateSource('manual')
    try {
      window.localStorage.setItem('portfolio_sheet_usdkrw_rate', value)
    } catch {}
  }

  async function saveCashBalance() {
    if (!activeAccountName) return
    const cash = Number(cashDraft)
    if (!Number.isFinite(cash) || cash < 0) {
      setError('cash must be number >= 0')
      return
    }

    setCashSaving(true)
    setError(null)
    try {
      await fetchJson<AccountPayload>('/api/portfolio-sheet/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAccountName,
          currency: activeAccount?.currency ?? 'USD',
          cash,
        }),
      })
      await refreshAccounts(activeAccountName)
      setCashDirty(false)
      setStatus(`Cash balance saved for ${activeAccountName}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cash balance')
    } finally {
      setCashSaving(false)
    }
  }

  async function saveInvestments() {
    if (!activeAccountName) return
    const dirtyIds = Object.keys(dirtyInvestmentCells).filter((id) => dirtyInvestmentCells[id])
    if (dirtyIds.length === 0) {
      setStatus('No investment table changes to save.')
      return
    }

    setInvestmentSaving(true)
    setError(null)
    try {
      const rows = buildInvestmentRowsFromDrafts(activeAccountName, investmentDrafts, dirtyIds)
      await fetchJson('/api/portfolio-sheet/investments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: activeAccountName,
          rows,
        }),
      })
      await refreshInvestments(activeAccountName)
      setStatus(`${rows.length} investment cell(s) saved. Summary and snapshots now use the A1 total.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save investment table')
    } finally {
      setInvestmentSaving(false)
    }
  }

  async function saveChanges() {
    if (!activeAccountName) return
    const dirtyIds = Object.keys(dirtyRows).filter((id) => dirtyRows[id])
    if (dirtyIds.length === 0) {
      setStatus('No changes to save.')
      return
    }

    const nextError = dirtyIds
      .map((id) => drafts[id])
      .map((draft) => validateDraft(activeAccountName, draft))
      .find(Boolean)

    if (nextError) {
      setError(nextError)
      return
    }

    setSaving(true)
    setError(null)
    try {
      for (const id of dirtyIds) {
        const holding = holdings.find((item) => String(item.id) === id)
        const draft = drafts[id]
        if (!holding || !draft) continue

        await fetchJson('/api/portfolio-sheet/holdings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: holding.id,
            account_name: activeAccountName,
            ticker: draft.ticker.trim().toUpperCase(),
            shares: Number(draft.shares),
            avg_price: Number(draft.avgPrice),
            memo: holding.memo,
            active: holding.active !== 0,
          }),
        })
      }

      await refreshHoldings(activeAccountName)
      setStatus(`${dirtyIds.length} row(s) saved and recalculated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function seedFromSample() {
    setSeeding(true)
    setError(null)
    try {
      const payload = await fetchJson<{ result?: { accounts?: string[]; holdingsInserted?: number; holdingsSkipped?: number } }>(
        '/api/portfolio-sheet/seed-from-sample',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overwrite: false }),
        },
      )
      const preferred = payload.result?.accounts?.[0] ?? null
      await refreshAccounts(preferred)
      setStatus(
        `Seed complete: ${payload.result?.holdingsInserted ?? 0} inserted, ${payload.result?.holdingsSkipped ?? 0} skipped.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed from linked sample')
    } finally {
      setSeeding(false)
    }
  }

  async function saveSnapshot() {
    if (!activeAccountName) return
    if (dirtyCount > 0) {
      setError('Save holdings changes before creating a daily snapshot.')
      return
    }
    if (dirtyInvestmentCount > 0) {
      setError('Save investment table changes before creating a daily snapshot.')
      return
    }
    if (cashDirty) {
      setError('Save cash balance before creating a daily snapshot.')
      return
    }
    if (todayClosureReason) {
      setError(`Snapshot is skipped on non-trading days: ${localDateKey()} (${todayClosureReason}).`)
      return
    }
    if (rowResult.rows.length === 0) {
      setError('No holdings are available to snapshot.')
      return
    }

    setSnapshotSaving(true)
    setError(null)
    try {
      const snapshotDate = localDateKey()
      const payload = await fetchJson<SnapshotPayload>('/api/portfolio-sheet/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: snapshotDate,
            account_name: activeAccountName,
          total_value: displaySummary.accountTotal,
          total_cost: displaySummary.totalInvested,
          cash: displaySummary.cashBalance,
          pnl: displaySummary.dollarTotalPnl,
          pnl_pct: displaySummary.returnPct,
          today_pnl: displaySummary.todayPnl,
          holdings_count: displaySummary.activePositionCount,
          snapshot_json: {
            savedAt: new Date().toISOString(),
            source: 'portfolio-sheet-ui',
            account: activeAccountName,
            summary: displaySummary,
            investmentSummary,
            fx: {
              usdKrwRate: Number(usdKrwRate) || null,
              krwTotalPnl: (Number(usdKrwRate) || 0) > 0 ? displaySummary.dollarTotalPnl * Number(usdKrwRate) : null,
            },
            rows: rowResult.rows,
          },
        }),
      })

      await refreshHistory(activeAccountName)
      setStatus(`Snapshot saved for ${payload.snapshot?.date ?? snapshotDate}. Existing same-day rows are updated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save daily snapshot')
    } finally {
      setSnapshotSaving(false)
    }
  }

  async function handleCsvFile(file: File | null) {
    if (!file) return
    setError(null)
    setCsvImportResult(null)

    try {
      const text = await file.text()
      const parsed = parsePortfolioCsv(text, activeAccountName)
      setCsvText(text)
      setCsvFileName(file.name)
      setCsvPreview(parsed)
      setStatus(`CSV preview ready: ${parsed.validRows.length} valid, ${parsed.invalidRows.length} skipped.`)
    } catch (err) {
      setCsvText('')
      setCsvFileName('')
      setCsvPreview(null)
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }

  function clearCsvPreview() {
    setCsvText('')
    setCsvFileName('')
    setCsvPreview(null)
    setCsvImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function confirmCsvImport() {
    if (!csvPreview || !csvText) return
    if (csvPreview.validRows.length === 0) {
      setError('No valid CSV rows to import.')
      return
    }

    setImportingCsv(true)
    setError(null)
    try {
      const payload = await fetchJson<ImportCsvPayload>('/api/portfolio-sheet/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          activeAccount: activeAccountName,
        }),
      })
      const result = payload.result ?? null
      setCsvImportResult(result)
      await refreshAccounts(activeAccountName)
      if (activeAccountName) await refreshHoldings(activeAccountName)
      setStatus(
        `CSV import complete: ${result?.inserted ?? 0} inserted, ${result?.updated ?? 0} updated, ${result?.skipped ?? 0} skipped.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV')
    } finally {
      setImportingCsv(false)
    }
  }

  function exportHoldingsCsv() {
    if (!activeAccountName) return
    const filename = `portfolio-sheet-${safeCsvFilePart(activeAccountName)}-holdings-${localDateKey()}.csv`
    downloadCsvFile(filename, portfolioHoldingsToCsv(holdings, activeAccount))
    setStatus(`Exported holdings CSV: ${filename}`)
  }

  function exportReportCsv() {
    if (!activeAccountName) return
    const filename = `portfolio-sheet-${safeCsvFilePart(activeAccountName)}-report-${localDateKey()}.csv`
    downloadCsvFile(filename, portfolioReportToCsv(rowResult.rows))
    setStatus(`Exported report CSV: ${filename}`)
  }

  function exportHistoryCsv() {
    if (!activeAccountName) return
    const filename = `portfolio-sheet-${safeCsvFilePart(activeAccountName)}-snapshot-history-${localDateKey()}.csv`
    downloadCsvFile(filename, portfolioSnapshotHistoryToCsv(tradingHistory))
    setStatus(`Exported snapshot history CSV: ${filename}`)
  }

  const dirtyCount = Object.values(dirtyRows).filter(Boolean).length
  const dirtyInvestmentCount = Object.values(dirtyInvestmentCells).filter(Boolean).length
  const saveDisabled = saving || dirtyCount === 0 || !activeAccountName
  const snapshotDisabled =
    snapshotSaving ||
    loading ||
    !activeAccountName ||
    rowResult.rows.length === 0 ||
    dirtyCount > 0 ||
    dirtyInvestmentCount > 0 ||
    cashDirty ||
    Boolean(todayClosureReason)
  const exportHoldingsDisabled = !activeAccountName || holdings.length === 0
  const exportReportDisabled = !activeAccountName || rowResult.rows.length === 0
  const exportHistoryDisabled = !activeAccountName || tradingHistory.length === 0
  const csvPreviewRows = csvPreview?.validRows.slice(0, 5) ?? []
  const csvInvalidPreviewRows = csvPreview?.invalidRows.slice(0, 4) ?? []

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(event) => {
          void handleCsvFile(event.currentTarget.files?.[0] ?? null)
          event.currentTarget.value = ''
        }}
      />

      <section style={panelStyle}>
        <SectionTitle icon={WalletCards} title="Account Tabs" note={activeAccountName ? `Active account: ${activeAccountName}` : 'No internal account selected'} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {accounts.length > 0 ? (
            accounts.map((account) => {
              const active = account.name === activeAccountName
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setActiveAccountName(account.name)}
                  style={{
                    border: active ? '1px solid rgba(0,217,255,0.45)' : '1px solid rgba(255,255,255,0.14)',
                    background: active ? 'rgba(0,217,255,0.14)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#67e8f9' : '#9ca3af',
                    borderRadius: 7,
                    padding: '0.34rem 0.65rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    opacity: active ? 0.95 : 0.72,
                  }}
                >
                  {account.name}
                </button>
              )
            })
          ) : (
            <div style={{ ...mutedText }}>No app-native account exists yet.</div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <SectionTitle icon={RefreshCw} title="Actions" note={status} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => activeAccountName && refreshHoldings(activeAccountName)}
            disabled={!activeAccountName || loading}
            style={{
              ...disabledButtonStyle,
              cursor: !activeAccountName || loading ? 'not-allowed' : 'pointer',
              color: '#67e8f9',
              border: '1px solid rgba(103,232,249,0.24)',
              opacity: !activeAccountName || loading ? 0.55 : 0.95,
            }}
          >
            <RefreshCw size={14} />
            <span>Reload Prices</span>
          </button>
          <button
            type="button"
            onClick={saveChanges}
            disabled={saveDisabled}
            style={{
              ...disabledButtonStyle,
              cursor: saveDisabled ? 'not-allowed' : 'pointer',
              color: saveDisabled ? '#9ca3af' : '#86efac',
              border: saveDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(34,197,94,0.36)',
              background: saveDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.12)',
              opacity: saveDisabled ? 0.6 : 0.98,
            }}
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ''}`}</span>
          </button>
          <button
            type="button"
            onClick={saveSnapshot}
            disabled={snapshotDisabled}
            title={todayClosureReason ? `Snapshot disabled: ${localDateKey()} is not a trading day (${todayClosureReason})` : undefined}
            style={{
              ...disabledButtonStyle,
              cursor: snapshotDisabled ? 'not-allowed' : 'pointer',
              color: snapshotDisabled ? '#9ca3af' : '#c4b5fd',
              border: snapshotDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(196,181,253,0.34)',
              background: snapshotDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.12)',
              opacity: snapshotDisabled ? 0.6 : 0.98,
            }}
          >
            <Archive size={14} />
            <span>{snapshotSaving ? 'Saving Snapshot...' : 'Save Snapshot'}</span>
          </button>
          <button
            type="button"
            onClick={seedFromSample}
            disabled={seeding}
            style={{
              ...disabledButtonStyle,
              cursor: seeding ? 'not-allowed' : 'pointer',
              color: '#facc15',
              border: '1px solid rgba(250,204,21,0.28)',
              background: 'rgba(250,204,21,0.08)',
              opacity: seeding ? 0.6 : 0.95,
            }}
          >
            <Database size={14} />
            <span>{seeding ? 'Seeding...' : 'Seed from linked sample'}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeAccountName || importingCsv}
            style={{
              ...disabledButtonStyle,
              cursor: !activeAccountName || importingCsv ? 'not-allowed' : 'pointer',
              color: !activeAccountName || importingCsv ? '#9ca3af' : '#bfdbfe',
              border: !activeAccountName || importingCsv ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(96,165,250,0.34)',
              background: !activeAccountName || importingCsv ? 'rgba(255,255,255,0.04)' : 'rgba(37,99,235,0.10)',
              opacity: !activeAccountName || importingCsv ? 0.6 : 0.95,
            }}
          >
            <Upload size={14} />
            <span>{importingCsv ? 'Importing CSV...' : 'Import CSV'}</span>
          </button>
          <button
            type="button"
            onClick={exportHoldingsCsv}
            disabled={exportHoldingsDisabled}
            style={{
              ...disabledButtonStyle,
              cursor: exportHoldingsDisabled ? 'not-allowed' : 'pointer',
              color: exportHoldingsDisabled ? '#9ca3af' : '#bae6fd',
              border: exportHoldingsDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(14,165,233,0.34)',
              background: exportHoldingsDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.10)',
              opacity: exportHoldingsDisabled ? 0.6 : 0.95,
            }}
          >
            <Download size={14} />
            <span>Export Holdings CSV</span>
          </button>
          <button
            type="button"
            onClick={exportReportCsv}
            disabled={exportReportDisabled}
            style={{
              ...disabledButtonStyle,
              cursor: exportReportDisabled ? 'not-allowed' : 'pointer',
              color: exportReportDisabled ? '#9ca3af' : '#fef3c7',
              border: exportReportDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(245,158,11,0.34)',
              background: exportReportDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.10)',
              opacity: exportReportDisabled ? 0.6 : 0.95,
            }}
          >
            <Download size={14} />
            <span>Export Report CSV</span>
          </button>
          <button
            type="button"
            onClick={exportHistoryCsv}
            disabled={exportHistoryDisabled}
            style={{
              ...disabledButtonStyle,
              cursor: exportHistoryDisabled ? 'not-allowed' : 'pointer',
              color: exportHistoryDisabled ? '#9ca3af' : '#ddd6fe',
              border: exportHistoryDisabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(167,139,250,0.34)',
              background: exportHistoryDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.10)',
              opacity: exportHistoryDisabled ? 0.6 : 0.95,
            }}
          >
            <Download size={14} />
            <span>Export Snapshot History CSV</span>
          </button>
        </div>
        {error ? <div style={{ color: '#fca5a5', fontSize: '0.76rem', marginTop: 10 }}>{error}</div> : null}
        {csvPreview ? (
          <div
            style={{
              marginTop: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              background: 'rgba(2,6,23,0.30)',
              padding: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#e5e7eb', fontWeight: 800, fontSize: '0.82rem' }}>
                  CSV Preview {csvFileName ? `- ${csvFileName}` : ''}
                </div>
                <div style={{ ...mutedText, fontSize: '0.72rem', marginTop: 3 }}>
                  {csvPreview.validRows.length} valid rows, {csvPreview.invalidRows.length} invalid rows
                  {csvPreview.ignoredColumns.length ? ` | ignored: ${csvPreview.ignoredColumns.join(', ')}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={confirmCsvImport}
                  disabled={importingCsv || csvPreview.validRows.length === 0}
                  style={{
                    border: '1px solid rgba(34,197,94,0.36)',
                    background: 'rgba(34,197,94,0.12)',
                    color: '#86efac',
                    borderRadius: 7,
                    padding: '0.34rem 0.58rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: importingCsv || csvPreview.validRows.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: importingCsv || csvPreview.validRows.length === 0 ? 0.55 : 1,
                  }}
                >
                  Import {csvPreview.validRows.length} Rows
                </button>
                <button
                  type="button"
                  onClick={clearCsvPreview}
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#9ca3af',
                    borderRadius: 7,
                    padding: '0.34rem 0.58rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            {csvPreviewRows.length > 0 ? (
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '0.34rem' }}>row</th>
                      <th style={{ textAlign: 'left', padding: '0.34rem' }}>account</th>
                      <th style={{ textAlign: 'left', padding: '0.34rem' }}>ticker</th>
                      <th style={{ textAlign: 'right', padding: '0.34rem' }}>shares</th>
                      <th style={{ textAlign: 'right', padding: '0.34rem' }}>avg_price</th>
                      <th style={{ textAlign: 'right', padding: '0.34rem' }}>cash</th>
                      <th style={{ textAlign: 'left', padding: '0.34rem' }}>memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row) => (
                      <tr key={`${row.sourceRow}-${row.account_name}-${row.ticker}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ color: '#64748b', padding: '0.34rem' }}>{row.sourceRow}</td>
                        <td style={{ color: '#d1d5db', padding: '0.34rem' }}>{row.account_name}</td>
                        <td style={{ color: '#e5f7ff', fontWeight: 800, padding: '0.34rem' }}>{row.ticker}</td>
                        <td style={{ color: '#d1d5db', textAlign: 'right', padding: '0.34rem', fontVariantNumeric: 'tabular-nums' }}>{row.shares}</td>
                        <td style={{ color: '#d1d5db', textAlign: 'right', padding: '0.34rem', fontVariantNumeric: 'tabular-nums' }}>{row.avg_price}</td>
                        <td style={{ color: '#d1d5db', textAlign: 'right', padding: '0.34rem', fontVariantNumeric: 'tabular-nums' }}>{row.cash ?? '-'}</td>
                        <td style={{ color: '#94a3b8', padding: '0.34rem' }}>{row.memo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {csvInvalidPreviewRows.length > 0 ? (
              <div style={{ color: '#fca5a5', fontSize: '0.72rem', marginTop: 8 }}>
                Skipped preview: {csvInvalidPreviewRows.map((row) => `row ${row.sourceRow}: ${row.reason}`).join(' | ')}
              </div>
            ) : null}
            {csvImportResult ? (
              <div style={{ color: '#86efac', fontSize: '0.72rem', marginTop: 8 }}>
                Imported: {csvImportResult.inserted} inserted, {csvImportResult.updated} updated, {csvImportResult.skipped} skipped
                {csvImportResult.cashUpdatedAccounts.length ? ` | cash updated: ${csvImportResult.cashUpdatedAccounts.join(', ')}` : ''}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <section style={{ ...panelStyle, minWidth: 0 }}>
            <SectionTitle
              icon={WalletCards}
              title="Summary"
            note={`${activeAccountName || 'No account'} | 총투자금: A1 table${investmentSummary.totalInvested > 0 ? '' : ' fallback'}`}
            />
            <div style={{ marginTop: 12 }}>
              <PortfolioSummaryBox
                summary={displaySummary}
                cashDraft={cashDraft}
                cashDirty={cashDirty}
                cashSaving={cashSaving}
                usdKrwRate={usdKrwRate}
                usdKrwRateSource={usdKrwRateSource}
                onCashDraftChange={handleCashDraftChange}
                onSaveCash={saveCashBalance}
                onUsdKrwRateChange={handleUsdKrwRateChange}
              />
            </div>
          </section>

          <section style={{ ...panelStyle, minWidth: 0 }}>
            <SectionTitle
              icon={Sparkles}
              title="Portfolio AI Analysis"
              note={`${displaySummary.activePositionCount} active positions | rule-based MVP`}
            />
            <div style={{ marginTop: 12 }}>
              <PortfolioAiAnalysisCard rows={rowResult.rows} summary={displaySummary} />
            </div>
          </section>

          <section style={{ ...panelStyle, minWidth: 0 }}>
            <SectionTitle
              icon={BarChart3}
              title="Position Charts"
              note={`Selected account: ${activeAccountName || '-'}`}
            />
            <div style={{ marginTop: 12 }}>
              <PortfolioPositionCharts rows={rowResult.rows} summary={displaySummary} />
            </div>
          </section>
        </div>

        <section style={{ ...panelStyle, minWidth: 0 }}>
          <SectionTitle
            icon={Landmark}
            title="Investment Table"
            note={`${investments.length} saved cells | linked to summary and snapshots`}
          />
          <div style={{ marginTop: 12 }}>
            <PortfolioInvestmentTable
              accountName={activeAccountName}
              drafts={investmentDrafts}
              dirtyCellIds={dirtyInvestmentCells}
              summary={investmentSummary}
              saving={investmentSaving}
              onDraftChange={handleInvestmentDraftChange}
              onSave={saveInvestments}
            />
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, minWidth: 0 }}>
        <SectionTitle
          icon={Table2}
          title="Portfolio Table"
          note={`${rowResult.rows.length} displayed rows | source: internal SQLite + price adapter`}
        />
        <div style={{ marginTop: 12, opacity: loading ? 0.62 : 1 }}>
          <PortfolioSheetTable
            rows={rowResult.rows}
            editable
            drafts={drafts}
            dirtyRowIds={dirtyRows}
            onDraftChange={handleDraftChange}
          />
        </div>
      </section>

      <section style={{ ...panelStyle, minWidth: 0 }}>
        <SectionTitle
          icon={BarChart3}
          title="History Chart"
          note={`${tradingHistory.length}/${history.length} trading-day snapshots | total_cost stores A1 invested amount`}
        />
        <div style={{ marginTop: 12 }}>
          <PortfolioHistoryChart history={history} />
        </div>
        <PortfolioHistoryDataSheet history={history} />
      </section>
    </>
  )
}
