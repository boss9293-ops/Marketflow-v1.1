import { NextRequest, NextResponse } from 'next/server'
import { getTursoClient } from '@/lib/tursoClient'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = (searchParams.get('q') || '').trim().toUpperCase()
  const category = (searchParams.get('category') || '').trim().toLowerCase()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200'), 1), 1000)

  try {
    const client = getTursoClient()
    if (!client) return NextResponse.json({ error: 'Turso not configured' }, { status: 503 })

    const parts: string[] = ['is_active = 1']
    const args: string[] = []

    if (category && category !== 'all') {
      parts.push('category = ?')
      args.push(category)
    }
    if (q) {
      parts.push('(UPPER(symbol) LIKE ? OR UPPER(display_name) LIKE ?)')
      args.push(`%${q}%`, `%${q}%`)
    }

    const where = parts.join(' AND ')
    const res = await client.execute({
      sql: `SELECT symbol, display_name AS name, category, subcategory, strategy_tier,
                   direction, leverage_factor, priority, notes
            FROM etf_catalog WHERE ${where}
            ORDER BY priority ASC, symbol ASC LIMIT ?`,
      args: [...args, limit],
    })

    const symbols = res.rows.map(r => ({
      symbol: r[0] ?? r.symbol,
      name: r[1] ?? r.name,
      category: r[2] ?? r.category,
      subcategory: r[3] ?? r.subcategory,
      strategy_tier: r[4] ?? r.strategy_tier,
      direction: r[5] ?? r.direction,
      leverage_factor: r[6] ?? r.leverage_factor,
      priority: r[7] ?? r.priority,
      notes: r[8] ?? r.notes,
    }))

    return NextResponse.json({ symbols, total: symbols.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
