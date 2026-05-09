// Step 3: Cycle Engine — composite score + phase probability
// Enriches existing /api/semiconductor/history with derived cycle signals.
export const dynamic = 'force-dynamic'

interface RawRow {
  date: string
  soxx_rebased: number
  rel_compute:   number
  rel_memory:    number
  rel_foundry:   number
  rel_equipment: number
  stage?: string
}

export interface LensHistoryRow {
  date:      string
  soxx:      number   // % return from baseline
  ai:        number   // AI Infra absolute %
  mem:       number   // Memory absolute %
  foundry:   number   // Foundry absolute %
  equip:     number   // Equipment absolute %
  comp:      number   // Composite score 0–100
  avg:       number   // Rolling long-term avg
  phase:     string   // EARLY_CYCLE | EXPANSION | PEAK | CONTRACTION
}

function toPhase(comp: number): string {
  if (comp >= 72) return 'PEAK'
  if (comp >= 48) return 'EXPANSION'
  if (comp >= 28) return 'EARLY_CYCLE'
  return 'CONTRACTION'
}

function composite(row: RawRow): number {
  const soxxPct  = row.soxx_rebased - 100                        // e.g. +18
  const aiLead   = (row.rel_compute   - 1) * 40                  // AI Infra leadership bonus
  const memPenalty   = (row.rel_memory    - 1) * -15             // Memory relative penalty
  const equipPenalty = (row.rel_equipment - 1) * -10             // Equipment relative penalty
  const raw = 50 + soxxPct * 0.5 + aiLead + memPenalty + equipPenalty
  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10))
}

function rollingAvg(comps: number[], i: number, window = 30): number {
  const slice = comps.slice(Math.max(0, i - window), i + 1)
  return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10
}

export async function GET(req: Request) {
  const url  = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '180'), 730)

  try {
    // Reuse existing history endpoint
    const histRes = await fetch(`${url.origin}/api/semiconductor/history?days=${days}`, {
      cache: 'no-store',
    })
    if (!histRes.ok) throw new Error('upstream history failed')
    const { history: raw, meta } = (await histRes.json()) as { history: RawRow[]; meta: unknown }

    // Derive composite scores
    const comps = raw.map(composite)

    // Build enriched rows
    const rows: LensHistoryRow[] = raw.map((r, i) => {
      const soxxPct = r.soxx_rebased - 100
      const comp    = comps[i]
      return {
        date:    r.date,
        soxx:    Math.round(soxxPct * 10) / 10,
        ai:      Math.round((soxxPct + (r.rel_compute   - 1) * 100) * 10) / 10,
        mem:     Math.round((soxxPct + (r.rel_memory    - 1) * 100) * 10) / 10,
        foundry: Math.round((soxxPct + (r.rel_foundry   - 1) * 100) * 10) / 10,
        equip:   Math.round((soxxPct + (r.rel_equipment - 1) * 100) * 10) / 10,
        comp,
        avg:     rollingAvg(comps, i, 30),
        phase:   toPhase(comp),
      }
    })

    // Phase probability: last 60 days
    const window60 = rows.slice(-60)
    const total    = window60.length || 1
    const count    = { EARLY_CYCLE: 0, EXPANSION: 0, PEAK: 0, CONTRACTION: 0 }
    for (const r of window60) count[r.phase as keyof typeof count]++

    const phase_probability = {
      early:       Math.round((count.EARLY_CYCLE  / total) * 100),
      expansion:   Math.round((count.EXPANSION    / total) * 100),
      peak:        Math.round((count.PEAK         / total) * 100),
      contraction: Math.round((count.CONTRACTION  / total) * 100),
    }

    // Current composite (latest)
    const latest = rows[rows.length - 1]

    return Response.json({
      rows,
      phase_probability,
      current_composite: latest?.comp ?? 50,
      current_phase:     latest?.phase ?? 'EXPANSION',
      meta,
    })
  } catch (e) {
    console.error('[semiconductor-lens/history]', e)
    return Response.json({ error: 'history failed' }, { status: 500 })
  }
}
