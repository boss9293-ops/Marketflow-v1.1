import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getWatchlistsByUser,
  getWatchlistItems,
  createWatchlist,
  deleteWatchlist,
  ensureSchema,
} from '@/lib/db/userDb'
import { randomUUID } from 'crypto'

type SessionUser = { id?: string; email?: string | null; plan?: string }

async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser | undefined
  return user?.id ? user : null
}

export async function GET(req: NextRequest) {
  await ensureSchema()
  const user = await getSessionUser(req)
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const watchlists = await getWatchlistsByUser(user.id)
  if (!watchlists.length) {
    return NextResponse.json({ watchlistId: null, items: [] })
  }

  const targetId = req.nextUrl.searchParams.get('id') ?? watchlists[0].id
  const wl = watchlists.find((w) => w.id === targetId) ?? watchlists[0]
  const items = await getWatchlistItems(wl.id)

  return NextResponse.json({
    watchlistId: wl.id,
    watchlists: watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      isDefault: w.id === watchlists[0].id,
      createdAtET: w.created_at,
      updatedAtET: w.created_at,
    })),
    items: items.map((item) => ({
      id: item.id,
      watchlistId: item.watchlist_id,
      symbol: item.symbol,
      companyName: item.company_name,
      lastPrice: '--',
      changePercent: '--',
      rangeLabel: '--',
    })),
  })
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const user = await getSessionUser(req)
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { name?: string }
  const name = String(body.name ?? 'NEW GROUP').trim().toUpperCase().slice(0, 40)
  const id = `wl-${randomUUID().slice(0, 8)}`
  await createWatchlist(id, user.id, name)
  return NextResponse.json({ id, name }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  await ensureSchema()
  const user = await getSessionUser(req)
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await deleteWatchlist(id, user.id)
  return NextResponse.json({ deleted: true })
}
