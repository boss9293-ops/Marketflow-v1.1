// cycle_score_history DB에서 시계열 읽기 — 카드 1 (Cycle Score 추이) 데이터 빌더
import path from 'path'

export interface CycleScoreTimeSeriesPoint {
  date: string
  score: number
  phase: string
}

export interface PhaseTransition {
  date: string
  from_phase: string
  to_phase: string
}

export interface CycleScoreTimeSeries {
  series: CycleScoreTimeSeriesPoint[]
  phase_transitions: PhaseTransition[]
  base_date: string
  current_phase_start: string
  current_phase_duration_days: number
}

type DbRow = { date: string; score: number; phase: string }

type DbStatement = {
  all: (...args: unknown[]) => unknown[]
  run: (...args: unknown[]) => unknown
}

type Db = {
  prepare: (sql: string) => DbStatement
  close: () => void
}

const DB_CANDIDATES = [
  path.resolve(process.cwd(), '..', 'data', 'marketflow.db'),
  path.resolve(process.cwd(), 'data', 'marketflow.db'),
  path.resolve(process.cwd(), '..', 'backend', 'data', 'marketflow.db'),
]

function extractTransitions(series: CycleScoreTimeSeriesPoint[]): PhaseTransition[] {
  const transitions: PhaseTransition[] = []
  for (let i = 1; i < series.length; i++) {
    if (series[i].phase !== series[i - 1].phase) {
      transitions.push({
        date: series[i].date,
        from_phase: series[i - 1].phase,
        to_phase: series[i].phase,
      })
    }
  }
  return transitions
}

function findCurrentPhaseStart(series: CycleScoreTimeSeriesPoint[]): string {
  if (series.length === 0) return ''
  const currentPhase = series[series.length - 1].phase
  for (let i = series.length - 2; i >= 0; i--) {
    if (series[i].phase !== currentPhase) {
      return series[i + 1].date
    }
  }
  return series[0].date
}

export async function buildCycleScoreTimeSeries(days = 90): Promise<CycleScoreTimeSeries | null> {
  let db: Db | null = null
  try {
    const { default: Database } = await import('better-sqlite3')
    for (const candidate of DB_CANDIDATES) {
      try {
        db = new Database(candidate, { readonly: true, fileMustExist: true }) as Db
        break
      } catch { /* try next */ }
    }
    if (!db) return null

    const rows = db.prepare(
      `SELECT date, score, phase FROM cycle_score_history
       ORDER BY date ASC LIMIT ?`
    ).all(days) as DbRow[]

    db.close()
    db = null

    if (rows.length < 3) return null

    const series: CycleScoreTimeSeriesPoint[] = rows.map(r => ({
      date: r.date,
      score: r.score,
      phase: r.phase,
    }))

    const phase_transitions = extractTransitions(series)
    const current_phase_start = findCurrentPhaseStart(series)

    const lastDate = new Date(series[series.length - 1].date)
    const startDate = new Date(current_phase_start)
    const current_phase_duration_days = Math.round(
      (lastDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      series,
      phase_transitions,
      base_date: series[0].date,
      current_phase_start,
      current_phase_duration_days,
    }
  } catch {
    return null
  } finally {
    try { db?.close() } catch { /* ignore */ }
  }
}

export async function saveTodayCycleScore(score: number, phase: string): Promise<void> {
  let db: Db | null = null
  try {
    const { default: Database } = await import('better-sqlite3')
    for (const candidate of DB_CANDIDATES) {
      try {
        db = new Database(candidate, { readonly: false, fileMustExist: true }) as Db
        break
      } catch { /* try next */ }
    }
    if (!db) return

    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT OR REPLACE INTO cycle_score_history (date, score, phase, source)
       VALUES (?, ?, ?, 'live')`
    ).run(today, score, phase)
  } catch { /* non-blocking, ignore errors */ } finally {
    try { db?.close() } catch { /* ignore */ }
  }
}
