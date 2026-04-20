import { NextRequest, NextResponse } from 'next/server'
import { getTursoClient } from '@/lib/tursoClient'

const TAB_LABELS: Record<string, string> = {
  all: '전체', index: '지수', leverage: '레버리지', sector: '섹터',
  reverse: '인버스', dividend: '배당', fixed_income: '채권',
  crypto: '코인', ark: 'ARK', commodity: '원자재', theme: '테마',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = (searchParams.get('category') || 'all').trim().toLowerCase()
  const q = (searchParams.get('q') || '').trim().toUpperCase()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '300'), 1), 1000)

  try {
    const client = getTursoClient()
    if (!client) return NextResponse.json({ error: 'Turso not configured' }, { status: 503 })

    const countRes = await client.execute(
      `SELECT category, COUNT(*) AS cnt FROM etf_catalog WHERE is_active = 1 GROUP BY category ORDER BY category`
    )
    const totalAll = countRes.rows.reduce((s, r) => s + Number(r[1] ?? r.cnt), 0)
    const tabs = [{ key: 'all', label: '전체', count: totalAll }]
    for (const r of countRes.rows) {
      const key = String(r[0] ?? r.category)
      tabs.push({ key, label: TAB_LABELS[key] ?? key, count: Number(r[1] ?? r.cnt) })
    }

    const parts: string[] = ['e.is_active = 1']
    const args: (string | number)[] = []
    if (category && category !== 'all') { parts.push('e.category = ?'); args.push(category) }
    if (q) {
      parts.push('(UPPER(e.symbol) LIKE ? OR UPPER(e.display_name) LIKE ?)')
      args.push(`%${q}%`, `%${q}%`)
    }
    const where = parts.join(' AND ')

    const res = await client.execute({
      sql: `SELECT e.symbol, e.display_name AS name, e.category, e.subcategory,
                   e.strategy_tier, e.direction, e.leverage_factor, e.priority, e.notes
            FROM etf_catalog e
            WHERE ${where}
            ORDER BY e.priority ASC, e.symbol ASC LIMIT ?`,
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
      has_data: 0,
    }))

    return NextResponse.json({ tabs, symbols, total: symbols.length, category })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
