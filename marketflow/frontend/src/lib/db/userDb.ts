// =============================================================================
// userDb.ts — Turso (libSQL) user + watchlist store
// Tables: users, watchlists, watchlist_items
// =============================================================================
import { randomUUID } from 'crypto'
import { getTursoClient } from '@/lib/tursoClient'

export interface DbUser {
  id: string
  email: string
  password_hash: string
  plan: 'FREE' | 'PREMIUM'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export interface DbWatchlist {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface DbWatchlistItem {
  id: string
  watchlist_id: string
  symbol: string
  company_name: string
  position: number
  created_at: string
}

// ─── Schema bootstrap ────────────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'FREE',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS watchlists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'MY WATCHLIST',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS watchlist_items (
        id TEXT PRIMARY KEY,
        watchlist_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        company_name TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(watchlist_id, symbol)
      )`,
      args: [],
    },
  ])
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = getTursoClient()
  if (!db) return null
  await ensureSchema()
  const res = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })
  if (!res.rows.length) return null
  return rowToUser(res.rows[0])
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const db = getTursoClient()
  if (!db) return null
  await ensureSchema()
  const res = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })
  if (!res.rows.length) return null
  return rowToUser(res.rows[0])
}

export async function createUser(id: string, email: string, passwordHash: string): Promise<DbUser> {
  const db = getTursoClient()
  if (!db) throw new Error('Turso client unavailable')
  await ensureSchema()
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    args: [id, email, passwordHash],
  })
  const user = await getUserById(id)
  if (!user) throw new Error('User creation failed')

  // Auto-create default watchlist
  const wlId = `wl-${id.slice(0, 8)}`
  await createWatchlist(wlId, id, 'MY WATCHLIST')

  // Seed with default tickers
  const defaults = [
    { symbol: 'AAPL', companyName: 'Apple Inc.' },
    { symbol: 'NVDA', companyName: 'NVIDIA Corporation' },
    { symbol: 'TSLA', companyName: 'Tesla, Inc.' },
    { symbol: 'GOOGL', companyName: 'Alphabet Inc.' },
    { symbol: 'MSFT', companyName: 'Microsoft Corporation' },
  ]
  for (let i = 0; i < defaults.length; i++) {
    await addWatchlistItem(wlId, defaults[i].symbol, defaults[i].companyName, i)
  }

  return user
}

export async function updateUserPlan(id: string, plan: 'FREE' | 'PREMIUM'): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({ sql: 'UPDATE users SET plan = ? WHERE id = ?', args: [plan, id] })
}

export async function updateStripeInfo(id: string, customerId: string, subscriptionId?: string | null): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({
    sql: 'UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?',
    args: [customerId, subscriptionId ?? null, id],
  })
}

export async function getUserByStripeCustomerId(customerId: string): Promise<DbUser | null> {
  const db = getTursoClient()
  if (!db) return null
  const res = await db.execute({ sql: 'SELECT * FROM users WHERE stripe_customer_id = ?', args: [customerId] })
  if (!res.rows.length) return null
  return rowToUser(res.rows[0])
}

// ─── Watchlists ───────────────────────────────────────────────────────────────

export async function createWatchlist(id: string, userId: string, name: string): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({
    sql: 'INSERT OR IGNORE INTO watchlists (id, user_id, name) VALUES (?, ?, ?)',
    args: [id, userId, name],
  })
}

export async function getWatchlistsByUser(userId: string): Promise<DbWatchlist[]> {
  const db = getTursoClient()
  if (!db) return []
  const res = await db.execute({
    sql: 'SELECT * FROM watchlists WHERE user_id = ? ORDER BY created_at ASC',
    args: [userId],
  })
  return res.rows.map(rowToWatchlist)
}

export async function deleteWatchlist(id: string, userId: string): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({ sql: 'DELETE FROM watchlists WHERE id = ? AND user_id = ?', args: [id, userId] })
}

// ─── Watchlist Items ──────────────────────────────────────────────────────────

export async function getWatchlistItems(watchlistId: string): Promise<DbWatchlistItem[]> {
  const db = getTursoClient()
  if (!db) return []
  const res = await db.execute({
    sql: 'SELECT * FROM watchlist_items WHERE watchlist_id = ? ORDER BY position ASC, created_at ASC',
    args: [watchlistId],
  })
  return res.rows.map(rowToItem)
}

export async function addWatchlistItem(
  watchlistId: string,
  symbol: string,
  companyName: string,
  position?: number,
): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  const pos = position ?? 999
  const id = `wli-${watchlistId.slice(0, 8)}-${symbol.toLowerCase()}-${randomUUID().slice(0, 6)}`
  await db.execute({
    sql: 'INSERT OR IGNORE INTO watchlist_items (id, watchlist_id, symbol, company_name, position) VALUES (?, ?, ?, ?, ?)',
    args: [id, watchlistId, symbol.toUpperCase(), companyName, pos],
  })
}

export async function removeWatchlistItem(watchlistId: string, symbol: string): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({
    sql: 'DELETE FROM watchlist_items WHERE watchlist_id = ? AND symbol = ?',
    args: [watchlistId, symbol.toUpperCase()],
  })
}

export async function updateWatchlistItemCompany(watchlistId: string, symbol: string, companyName: string): Promise<void> {
  const db = getTursoClient()
  if (!db) return
  await db.execute({
    sql: 'UPDATE watchlist_items SET company_name = ? WHERE watchlist_id = ? AND symbol = ?',
    args: [companyName, watchlistId, symbol.toUpperCase()],
  })
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToUser(row: Record<string, unknown>): DbUser {
  return {
    id: String(row.id ?? ''),
    email: String(row.email ?? ''),
    password_hash: String(row.password_hash ?? ''),
    plan: (String(row.plan ?? 'FREE')) as 'FREE' | 'PREMIUM',
    stripe_customer_id: row.stripe_customer_id != null ? String(row.stripe_customer_id) : null,
    stripe_subscription_id: row.stripe_subscription_id != null ? String(row.stripe_subscription_id) : null,
    created_at: String(row.created_at ?? ''),
  }
}

function rowToWatchlist(row: Record<string, unknown>): DbWatchlist {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    name: String(row.name ?? 'MY WATCHLIST'),
    created_at: String(row.created_at ?? ''),
  }
}

function rowToItem(row: Record<string, unknown>): DbWatchlistItem {
  return {
    id: String(row.id ?? ''),
    watchlist_id: String(row.watchlist_id ?? ''),
    symbol: String(row.symbol ?? ''),
    company_name: String(row.company_name ?? ''),
    position: Number(row.position ?? 0),
    created_at: String(row.created_at ?? ''),
  }
}
