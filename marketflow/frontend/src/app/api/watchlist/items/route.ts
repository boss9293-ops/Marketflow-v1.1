import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getWatchlistsByUser,
  addWatchlistItem,
  removeWatchlistItem,
  ensureSchema,
} from '@/lib/db/userDb'

type SessionUser = { id?: string; email?: string | null; plan?: string }

async function resolveDefaultWatchlist(userId: string): Promise<string | null> {
  const wls = await getWatchlistsByUser(userId)
  return wls[0]?.id ?? null
}

export async function POST(req: NextRequest) {
  await ensureSchema()
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser | undefined
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { symbol?: string; companyName?: string; watchlistId?: string }
  const symbol = String(body.symbol ?? '').trim().toUpperCase()
  if (!symbol || !/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  const companyName = String(body.companyName ?? '').trim()
  const watchlistId = body.watchlistId ?? await resolveDefaultWatchlist(user.id)
  if (!watchlistId) return NextResponse.json({ error: 'No watchlist found' }, { status: 404 })

  await addWatchlistItem(watchlistId, symbol, companyName)
  return NextResponse.json({ added: true, symbol, watchlistId }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  await ensureSchema()
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser | undefined
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const watchlistId = req.nextUrl.searchParams.get('watchlistId') ?? await resolveDefaultWatchlist(user.id)
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  if (!watchlistId) return NextResponse.json({ error: 'No watchlist found' }, { status: 404 })

  await removeWatchlistItem(watchlistId, symbol)
  return NextResponse.json({ deleted: true, symbol })
}
