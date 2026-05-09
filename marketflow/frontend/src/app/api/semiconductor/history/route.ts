// GET /api/semiconductor/history?days=365
// 1. DB 조회 시도 (semiconductor_history 테이블)
// 2. 실데이터 없으면 현재 API 기반 시뮬레이션 반환
import { getTursoClient } from '@/lib/tursoClient'

export const dynamic = 'force-dynamic'

interface HistoryRow {
  date: string
  soxx_rebased: number
  rel_compute: number
  rel_memory: number
  rel_foundry: number
  rel_equipment: number
  contrib_compute: number
  contrib_memory: number
  contrib_foundry: number
  contrib_equipment: number
  stage: string
  [ticker: string]: number | string
}

// ── Simulation generator ───────────────────────────────────────────────────
function generateSimulation(current: Record<string, unknown>, days: number): HistoryRow[] {
  const tickers = (current.market_data as Record<string, unknown>)?.tickers as Record<
    string,
    { return_30d: number; return_60d: number }
  >
  if (!tickers) return []

  const now = new Date()
  const history: HistoryRow[] = []

  const soxx60d: number = tickers['SOXX']?.return_60d ?? 0.25

  const tickerReturns: Record<string, number> = {}
  for (const [k, v] of Object.entries(tickers)) {
    tickerReturns[k] = (v as { return_60d: number }).return_60d ?? 0
  }

  const computeRet =
    ['NVDA', 'AMD', 'AVGO'].reduce((s, k) => s + (tickerReturns[k] ?? 0), 0) / 3
  const memoryRet  = tickerReturns['MU'] ?? 0
  const foundryRet = tickerReturns['TSM'] ?? 0
  const equipRet   =
    ['ASML', 'AMAT', 'LRCX', 'KLAC'].reduce((s, k) => s + (tickerReturns[k] ?? 0), 0) / 4

  // Seeded deterministic noise (no Math.random — avoids hydration issues if used in SSR)
  function noise(seed: number): number {
    const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123
    return (s - Math.floor(s)) - 0.5
  }

  for (let i = 0; i <= days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - i))
    const t = i / days

    const soxx = Math.round(
      (100 * (1 + soxx60d * Math.pow(t, 0.8)) + noise(i * 3.1) * 1.5) * 10
    ) / 10

    const prevSoxx = i === 0 ? soxx : (history[i - 1]?.soxx_rebased ?? soxx)
    const soxxDailyRet = prevSoxx !== 0 ? ((soxx - prevSoxx) / prevSoxx) * 100 : 0

    const bktRel = (bucketRet: number, seed: number) => {
      const base = 1 + (bucketRet - soxx60d) * t
      return Math.round((base + noise(seed) * 0.02) * 100) / 100
    }

    const contrib = (rel: number) =>
      Math.round(((rel - 1.0) * Math.abs(soxxDailyRet) + soxxDailyRet * 0.25) * 10) / 10

    const rel_c = bktRel(computeRet, i * 1.1)
    const rel_m = bktRel(memoryRet,  i * 1.3)
    const rel_f = bktRel(foundryRet, i * 1.7)
    const rel_e = bktRel(equipRet,   i * 2.1)

    const tickerRebased: Record<string, number> = {}
    let ti = 0
    for (const [k, v] of Object.entries(tickerReturns)) {
      const base = 100 * (1 + v * Math.pow(t, 0.8))
      tickerRebased[k] = Math.round((base + noise(i * 0.9 + ti)) * 10) / 10
      ti++
    }

    const stage = soxx >= 110 ? 'EXPAND' : soxx >= 100 ? 'BUILD' : 'RESET'

    history.push({
      date: d.toISOString().slice(0, 10),
      soxx_rebased: soxx,
      rel_compute: rel_c, rel_memory: rel_m,
      rel_foundry: rel_f, rel_equipment: rel_e,
      contrib_compute: contrib(rel_c), contrib_memory: contrib(rel_m),
      contrib_foundry: contrib(rel_f), contrib_equipment: contrib(rel_e),
      stage,
      ...tickerRebased,
    })
  }

  return history
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url  = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '365'), 730)

  // 1. DB 조회
  try {
    const db = getTursoClient()
    if (db) {
      const rows = await db.execute({
        sql: `SELECT payload FROM semiconductor_history
              WHERE date >= date('now', '-' || ? || ' days')
              ORDER BY date ASC`,
        args: [days],
      })
      if (rows.rows.length >= 30) {
        const history = rows.rows.map(r => JSON.parse(r.payload as string)) as HistoryRow[]
        return Response.json({ history, meta: { source: 'db', total_days: history.length } })
      }
    }
  } catch (e) {
    console.warn('[semiconductor/history] DB read failed, using simulation')
  }

  // 2. 현재 API 기반 시뮬레이션
  try {
    const base   = url.origin
    const semRes = await fetch(`${base}/api/semiconductor`, { cache: 'no-store' })
    if (!semRes.ok) throw new Error('semiconductor API failed')
    const current = await semRes.json()
    const history = generateSimulation(current, days)
    return Response.json({ history, meta: { source: 'simulated', total_days: history.length } })
  } catch (e) {
    return Response.json({ error: 'Failed to generate history' }, { status: 500 })
  }
}
