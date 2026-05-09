import fs from 'fs'
import path from 'path'

import Database from 'better-sqlite3'

import type {
  PortfolioAccountRecord,
  PortfolioDailySnapshotRecord,
  PortfolioHoldingRecord,
  PortfolioInvestmentContributionInput,
  PortfolioInvestmentContributionRecord,
  PortfolioInvestmentPeriodType,
} from './types'

type PortfolioDb = any

export type CreatePortfolioAccountInput = {
  name: string
  currency?: string
  cash?: number
}

export type PortfolioHoldingWriteInput = {
  account_name: string
  ticker: string
  shares: number
  avg_price: number
  memo?: string | null
  active?: boolean | number
}

export type PortfolioHoldingUpdateInput = PortfolioHoldingWriteInput & {
  id: number
}

export type SeedPortfolioHoldingInput = PortfolioHoldingWriteInput

export type SeedPortfolioResult = {
  accountsCreated: number
  holdingsInserted: number
  holdingsUpdated: number
  holdingsSkipped: number
}

export type PortfolioDailySnapshotWriteInput = {
  date: string
  account_name: string
  total_value: number
  total_cost: number
  cash: number
  pnl: number
  pnl_pct: number
  today_pnl: number
  holdings_count: number
  snapshot_json?: unknown
}

export type PortfolioInvestmentContributionWriteInput = PortfolioInvestmentContributionInput

const DB_PATH = process.env.PORTFOLIO_SHEET_DB_PATH || path.resolve(process.cwd(), 'data', 'portfolio_sheet.db')

let db: PortfolioDb | null = null
let schemaReady = false

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeAccountName(value: unknown): string {
  return asText(value).slice(0, 80)
}

function normalizeTicker(value: unknown): string {
  return asText(value).toUpperCase().replace(/\s+/g, '').slice(0, 20)
}

function finiteOrZero(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDateKey(value: unknown): string {
  const text = asText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  throw new Error('date must be YYYY-MM-DD')
}

function normalizeActive(value: boolean | number | undefined): number {
  if (value === undefined) return 1
  if (typeof value === 'boolean') return value ? 1 : 0
  return value ? 1 : 0
}

function normalizePeriodType(value: unknown): PortfolioInvestmentPeriodType {
  const text = asText(value)
  if (text === 'before_year') return 'before_year'
  if (text === 'year') return 'year'
  throw new Error('period_type must be before_year or year')
}

function normalizeMonth(value: unknown): number {
  const month = Math.trunc(finiteOrZero(value))
  if (month < 1 || month > 12) throw new Error('month must be 1..12')
  return month
}

function normalizeInvestmentInput(input: PortfolioInvestmentContributionWriteInput): PortfolioInvestmentContributionWriteInput {
  const accountName = normalizeAccountName(input.account_name)
  const periodType = normalizePeriodType(input.period_type)
  const year = Math.trunc(finiteOrZero(input.year))
  const month = normalizeMonth(input.month)
  const amount = finiteOrZero(input.amount)

  if (!accountName) throw new Error('account_name is required')
  if (year < 1900 || year > 2200) throw new Error('year is invalid')
  if (amount < 0) throw new Error('amount must be >= 0')

  return {
    account_name: accountName,
    period_type: periodType,
    year,
    month,
    amount,
    memo: input.memo === undefined ? null : asText(input.memo) || null,
  }
}

function normalizeHoldingInput(input: PortfolioHoldingWriteInput): PortfolioHoldingWriteInput {
  const accountName = normalizeAccountName(input.account_name)
  const ticker = normalizeTicker(input.ticker)
  const shares = finiteOrZero(input.shares)
  const avgPrice = finiteOrZero(input.avg_price)
  if (!accountName) throw new Error('account_name is required')
  if (!ticker) throw new Error('ticker is required')
  if (!/^[A-Z0-9.\-]{1,20}$/.test(ticker)) throw new Error('ticker is invalid')
  if (shares < 0) throw new Error('shares must be >= 0')
  if (avgPrice < 0) throw new Error('avg_price must be >= 0')

  return {
    account_name: accountName,
    ticker,
    shares,
    avg_price: avgPrice,
    memo: input.memo === undefined ? null : asText(input.memo) || null,
    active: normalizeActive(input.active),
  }
}

function normalizeSnapshotJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function normalizeDailySnapshotInput(input: PortfolioDailySnapshotWriteInput) {
  const date = normalizeDateKey(input.date)
  const accountName = normalizeAccountName(input.account_name)
  if (!accountName) throw new Error('account_name is required')

  return {
    date,
    account_name: accountName,
    total_value: finiteOrZero(input.total_value),
    total_cost: finiteOrZero(input.total_cost),
    cash: finiteOrZero(input.cash),
    pnl: finiteOrZero(input.pnl),
    pnl_pct: finiteOrZero(input.pnl_pct),
    today_pnl: finiteOrZero(input.today_pnl),
    holdings_count: Math.max(0, Math.trunc(finiteOrZero(input.holdings_count))),
    snapshot_json: normalizeSnapshotJson(input.snapshot_json),
  }
}

export function portfolioSheetDbPath(): string {
  return DB_PATH
}

export function getPortfolioDb(): PortfolioDb {
  if (db) return db

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  ensurePortfolioSchema()
  return db
}

export function ensurePortfolioSchema(): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const database = db ?? new Database(DB_PATH)
  if (!db) {
    db = database
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  if (schemaReady) return

  database.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      currency TEXT DEFAULT 'USD',
      cash REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      ticker TEXT NOT NULL,
      shares REAL NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL DEFAULT 0,
      memo TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_name, ticker)
    );

    CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      account_name TEXT NOT NULL,
      total_value REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      cash REAL NOT NULL DEFAULT 0,
      pnl REAL NOT NULL DEFAULT 0,
      pnl_pct REAL NOT NULL DEFAULT 0,
      today_pnl REAL NOT NULL DEFAULT 0,
      delta REAL NOT NULL DEFAULT 0,
      holdings_count INTEGER DEFAULT 0,
      snapshot_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, account_name)
    );

    CREATE TABLE IF NOT EXISTS portfolio_investment_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'year',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      memo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_name, period_type, year, month)
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_account
      ON portfolio_holdings(account_name, active, ticker);

    CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_account_date
      ON portfolio_daily_snapshots(account_name, date DESC);

    CREATE INDEX IF NOT EXISTS idx_portfolio_investment_contributions_account
      ON portfolio_investment_contributions(account_name, period_type, year, month);
  `)

  schemaReady = true
}

export function listPortfolioAccounts(): PortfolioAccountRecord[] {
  const database = getPortfolioDb()
  return database
    .prepare(
      `SELECT id, name, currency, cash, created_at, updated_at
       FROM portfolio_accounts
       ORDER BY name ASC`,
    )
    .all()
}

export function createPortfolioAccount(input: CreatePortfolioAccountInput): PortfolioAccountRecord {
  const database = getPortfolioDb()
  const name = normalizeAccountName(input.name)
  if (!name) throw new Error('name is required')

  const currency = asText(input.currency || 'USD').toUpperCase().slice(0, 8) || 'USD'
  const cash = finiteOrZero(input.cash)

  database
    .prepare(
      `INSERT INTO portfolio_accounts (name, currency, cash)
       VALUES (@name, @currency, @cash)`,
    )
    .run({ name, currency, cash })

  return getPortfolioAccount(name) as PortfolioAccountRecord
}

export function ensurePortfolioAccount(input: CreatePortfolioAccountInput): PortfolioAccountRecord {
  const database = getPortfolioDb()
  const name = normalizeAccountName(input.name)
  if (!name) throw new Error('name is required')

  const currency = asText(input.currency || 'USD').toUpperCase().slice(0, 8) || 'USD'
  const cash = finiteOrZero(input.cash)

  database
    .prepare(
      `INSERT OR IGNORE INTO portfolio_accounts (name, currency, cash)
       VALUES (@name, @currency, @cash)`,
    )
    .run({ name, currency, cash })

  return getPortfolioAccount(name) as PortfolioAccountRecord
}

export function setPortfolioAccountCash(nameValue: string, cashValue: number, currencyValue = 'USD'): PortfolioAccountRecord {
  const database = getPortfolioDb()
  const name = normalizeAccountName(nameValue)
  if (!name) throw new Error('name is required')

  const currency = asText(currencyValue || 'USD').toUpperCase().slice(0, 8) || 'USD'
  const cash = finiteOrZero(cashValue)
  ensurePortfolioAccount({ name, currency, cash })

  database
    .prepare(
      `UPDATE portfolio_accounts
       SET cash = @cash,
           currency = @currency,
           updated_at = CURRENT_TIMESTAMP
       WHERE name = @name`,
    )
    .run({ name, cash, currency })

  return getPortfolioAccount(name) as PortfolioAccountRecord
}

export function getPortfolioAccount(name: string): PortfolioAccountRecord | null {
  const database = getPortfolioDb()
  return (
    database
      .prepare(
        `SELECT id, name, currency, cash, created_at, updated_at
         FROM portfolio_accounts
         WHERE name = ?`,
      )
      .get(normalizeAccountName(name)) ?? null
  )
}

export function listPortfolioHoldings(accountName?: string | null): PortfolioHoldingRecord[] {
  const database = getPortfolioDb()
  const account = normalizeAccountName(accountName)

  if (account) {
    return database
      .prepare(
        `SELECT id, account_name, ticker, shares, avg_price, memo, active, created_at, updated_at
         FROM portfolio_holdings
         WHERE account_name = ?
         ORDER BY active DESC, ticker ASC`,
      )
      .all(account)
  }

  return database
    .prepare(
      `SELECT id, account_name, ticker, shares, avg_price, memo, active, created_at, updated_at
       FROM portfolio_holdings
       ORDER BY account_name ASC, active DESC, ticker ASC`,
    )
    .all()
}

export function createPortfolioHolding(input: PortfolioHoldingWriteInput): PortfolioHoldingRecord {
  const database = getPortfolioDb()
  const normalized = normalizeHoldingInput(input)
  ensurePortfolioAccount({ name: normalized.account_name })

  database
    .prepare(
      `INSERT INTO portfolio_holdings (
         account_name, ticker, shares, avg_price, memo, active
       ) VALUES (
         @account_name, @ticker, @shares, @avg_price, @memo, @active
       )`,
    )
    .run(normalized)

  return getPortfolioHolding(normalized.account_name, normalized.ticker) as PortfolioHoldingRecord
}

export function upsertPortfolioHolding(input: PortfolioHoldingWriteInput): PortfolioHoldingRecord {
  const database = getPortfolioDb()
  const normalized = normalizeHoldingInput(input)
  ensurePortfolioAccount({ name: normalized.account_name })

  database
    .prepare(
      `INSERT INTO portfolio_holdings (
         account_name, ticker, shares, avg_price, memo, active
       ) VALUES (
         @account_name, @ticker, @shares, @avg_price, @memo, @active
       )
       ON CONFLICT(account_name, ticker) DO UPDATE SET
         shares = excluded.shares,
         avg_price = excluded.avg_price,
         memo = excluded.memo,
         active = excluded.active,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(normalized)

  return getPortfolioHolding(normalized.account_name, normalized.ticker) as PortfolioHoldingRecord
}

export function updatePortfolioHolding(input: PortfolioHoldingUpdateInput): PortfolioHoldingRecord {
  const database = getPortfolioDb()
  const id = Number(input.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('id is required')

  const normalized = normalizeHoldingInput(input)
  ensurePortfolioAccount({ name: normalized.account_name })

  const result = database
    .prepare(
      `UPDATE portfolio_holdings
       SET
         account_name = @account_name,
         ticker = @ticker,
         shares = @shares,
         avg_price = @avg_price,
         memo = @memo,
         active = @active,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`,
    )
    .run({ ...normalized, id })

  if (!result.changes) throw new Error('Holding not found')
  return getPortfolioHolding(normalized.account_name, normalized.ticker) as PortfolioHoldingRecord
}

export function getPortfolioHolding(accountName: string, ticker: string): PortfolioHoldingRecord | null {
  const database = getPortfolioDb()
  return (
    database
      .prepare(
        `SELECT id, account_name, ticker, shares, avg_price, memo, active, created_at, updated_at
         FROM portfolio_holdings
         WHERE account_name = ? AND ticker = ?`,
      )
      .get(normalizeAccountName(accountName), normalizeTicker(ticker)) ?? null
  )
}

export function listPortfolioInvestmentContributions(accountName: string): PortfolioInvestmentContributionRecord[] {
  const database = getPortfolioDb()
  const account = normalizeAccountName(accountName)
  if (!account) throw new Error('account_name is required')

  return database
    .prepare(
      `SELECT id, account_name, period_type, year, month, amount, memo, created_at, updated_at
       FROM portfolio_investment_contributions
       WHERE account_name = ?
       ORDER BY
         CASE period_type WHEN 'before_year' THEN 0 ELSE 1 END,
         year ASC,
         month ASC`,
    )
    .all(account)
}

export function upsertPortfolioInvestmentContribution(
  input: PortfolioInvestmentContributionWriteInput,
): PortfolioInvestmentContributionRecord {
  const database = getPortfolioDb()
  const normalized = normalizeInvestmentInput(input)
  ensurePortfolioAccount({ name: normalized.account_name })

  database
    .prepare(
      `INSERT INTO portfolio_investment_contributions (
         account_name, period_type, year, month, amount, memo
       ) VALUES (
         @account_name, @period_type, @year, @month, @amount, @memo
       )
       ON CONFLICT(account_name, period_type, year, month) DO UPDATE SET
         amount = excluded.amount,
         memo = excluded.memo,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(normalized)

  return getPortfolioInvestmentContribution(
    normalized.account_name,
    normalized.period_type,
    normalized.year,
    normalized.month,
  ) as PortfolioInvestmentContributionRecord
}

export function upsertPortfolioInvestmentContributions(
  rows: PortfolioInvestmentContributionWriteInput[],
): { upserted: number } {
  const database = getPortfolioDb()
  let upserted = 0

  const tx = database.transaction((payload: PortfolioInvestmentContributionWriteInput[]) => {
    for (const row of payload) {
      upsertPortfolioInvestmentContribution(row)
      upserted += 1
    }
  })

  tx(rows)
  return { upserted }
}

export function getPortfolioInvestmentContribution(
  accountName: string,
  periodType: PortfolioInvestmentPeriodType,
  year: number,
  month: number,
): PortfolioInvestmentContributionRecord | null {
  const database = getPortfolioDb()
  return (
    database
      .prepare(
        `SELECT id, account_name, period_type, year, month, amount, memo, created_at, updated_at
         FROM portfolio_investment_contributions
         WHERE account_name = ?
           AND period_type = ?
           AND year = ?
           AND month = ?`,
      )
      .get(normalizeAccountName(accountName), normalizePeriodType(periodType), Math.trunc(year), normalizeMonth(month)) ??
    null
  )
}

export function seedPortfolioHoldings(rows: SeedPortfolioHoldingInput[], overwrite = false): SeedPortfolioResult {
  const database = getPortfolioDb()
  const result: SeedPortfolioResult = {
    accountsCreated: 0,
    holdingsInserted: 0,
    holdingsUpdated: 0,
    holdingsSkipped: 0,
  }

  const tx = database.transaction((payload: SeedPortfolioHoldingInput[]) => {
    for (const raw of payload) {
      const row = normalizeHoldingInput(raw)
      const accountBefore = getPortfolioAccount(row.account_name)
      ensurePortfolioAccount({ name: row.account_name })
      if (!accountBefore) result.accountsCreated += 1

      const existing = getPortfolioHolding(row.account_name, row.ticker)
      if (existing && !overwrite) {
        result.holdingsSkipped += 1
        continue
      }

      if (existing && overwrite) {
        upsertPortfolioHolding(row)
        result.holdingsUpdated += 1
        continue
      }

      createPortfolioHolding(row)
      result.holdingsInserted += 1
    }
  })

  tx(rows)
  return result
}

export function getPortfolioDailySnapshot(date: string, accountName: string): PortfolioDailySnapshotRecord | null {
  const database = getPortfolioDb()
  return (
    database
      .prepare(
        `SELECT id, date, account_name, total_value, total_cost, cash, pnl, pnl_pct, today_pnl, delta,
                holdings_count, snapshot_json, created_at
         FROM portfolio_daily_snapshots
         WHERE date = ? AND account_name = ?`,
      )
      .get(normalizeDateKey(date), normalizeAccountName(accountName)) ?? null
  )
}

export function listPortfolioDailySnapshots(accountName: string): PortfolioDailySnapshotRecord[] {
  const database = getPortfolioDb()
  const account = normalizeAccountName(accountName)
  if (!account) throw new Error('account_name is required')

  return database
    .prepare(
      `SELECT id, date, account_name, total_value, total_cost, cash, pnl, pnl_pct, today_pnl, delta,
              holdings_count, snapshot_json, created_at
       FROM portfolio_daily_snapshots
       WHERE account_name = ?
       ORDER BY date ASC`,
    )
    .all(account)
}

export function savePortfolioDailySnapshot(input: PortfolioDailySnapshotWriteInput): PortfolioDailySnapshotRecord {
  const database = getPortfolioDb()
  const normalized = normalizeDailySnapshotInput(input)
  ensurePortfolioAccount({ name: normalized.account_name })

  const tx = database.transaction(() => {
    const previous = database
      .prepare(
        `SELECT total_value
         FROM portfolio_daily_snapshots
         WHERE account_name = ?
           AND date < ?
         ORDER BY date DESC
         LIMIT 1`,
      )
      .get(normalized.account_name, normalized.date) as { total_value?: number } | undefined

    const previousTotal = finiteOrZero(previous?.total_value)
    const delta = previous ? normalized.total_value - previousTotal : 0

    database
      .prepare(
        `INSERT INTO portfolio_daily_snapshots (
           date, account_name, total_value, total_cost, cash, pnl, pnl_pct,
           today_pnl, delta, holdings_count, snapshot_json
         ) VALUES (
           @date, @account_name, @total_value, @total_cost, @cash, @pnl, @pnl_pct,
           @today_pnl, @delta, @holdings_count, @snapshot_json
         )
         ON CONFLICT(date, account_name) DO UPDATE SET
           total_value = excluded.total_value,
           total_cost = excluded.total_cost,
           cash = excluded.cash,
           pnl = excluded.pnl,
           pnl_pct = excluded.pnl_pct,
           today_pnl = excluded.today_pnl,
           delta = excluded.delta,
           holdings_count = excluded.holdings_count,
           snapshot_json = excluded.snapshot_json`,
      )
      .run({ ...normalized, delta })

    return getPortfolioDailySnapshot(normalized.date, normalized.account_name) as PortfolioDailySnapshotRecord
  })

  return tx()
}
