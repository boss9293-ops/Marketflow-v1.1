export type SoxxDataFreshnessStatus =
  | 'fresh'
  | 'delayed'
  | 'stale'
  | 'unknown'

export type SoxxDataFreshnessInput = {
  asOf?: string
  now?: Date
  expectedUpdateHourLocal?: number
  maxFreshDays?: number
  maxDelayedDays?: number
}

export type SoxxDataFreshnessResult = {
  status: SoxxDataFreshnessStatus
  label: string
  detail: string
  ageDays: number | null
}

export type SoxxDataSourceMeta = {
  source: string
  asOf?: string
  status: 'available' | 'partial' | 'unavailable'
  freshness?: SoxxDataFreshnessResult
  warnings: string[]
}

export const SOXX_MAX_FRESH_DAYS = 1
export const SOXX_MAX_DELAYED_DAYS = 3

function parseDateOnly(value: string): Date | null {
  const normalized = value.trim()
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
  if (!isDateOnly) return null

  const date = new Date(`${normalized}T00:00:00`)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function diffCalendarDays(later: Date, earlier: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((later.getTime() - earlier.getTime()) / msPerDay)
}

function normalizeWeekendFreshnessAge(now: Date, asOf: Date, ageDays: number): number {
  const day = now.getDay()
  const isWeekend = day === 0 || day === 6
  const isAsOfFriday = asOf.getDay() === 5

  if (isWeekend && isAsOfFriday && ageDays <= 2) {
    return Math.min(ageDays, SOXX_MAX_FRESH_DAYS)
  }

  return ageDays
}

export function getSoxxDataFreshness(
  input: SoxxDataFreshnessInput,
): SoxxDataFreshnessResult {
  const asOf = input.asOf?.trim()
  if (!asOf) {
    return {
      status: 'unknown',
      label: 'Unknown',
      detail: 'As-of date is unavailable.',
      ageDays: null,
    }
  }

  const asOfDate = parseDateOnly(asOf)
  if (!asOfDate) {
    return {
      status: 'unknown',
      label: 'Unknown',
      detail: `As-of date "${asOf}" is not in YYYY-MM-DD format.`,
      ageDays: null,
    }
  }

  const now = input.now ?? new Date()
  const nowDay = startOfDay(now)
  const asOfDay = startOfDay(asOfDate)
  const rawAgeDays = Math.max(0, diffCalendarDays(nowDay, asOfDay))
  const adjustedAgeDays = normalizeWeekendFreshnessAge(nowDay, asOfDay, rawAgeDays)
  const maxFreshDays = input.maxFreshDays ?? SOXX_MAX_FRESH_DAYS
  const maxDelayedDays = input.maxDelayedDays ?? SOXX_MAX_DELAYED_DAYS
  const expectedUpdateHourLocal = input.expectedUpdateHourLocal ?? 18

  if (adjustedAgeDays <= maxFreshDays) {
    return {
      status: 'fresh',
      label: 'Fresh',
      detail:
        adjustedAgeDays === 0
          ? `As of ${asOf}. Age 0 day.`
          : `As of ${asOf}. Age ${adjustedAgeDays} day(s).`,
      ageDays: adjustedAgeDays,
    }
  }

  if (adjustedAgeDays <= maxDelayedDays) {
    return {
      status: 'delayed',
      label: 'Delayed',
      detail: `As of ${asOf}. Age ${adjustedAgeDays} day(s), beyond the expected local refresh hour (${expectedUpdateHourLocal}:00).`,
      ageDays: adjustedAgeDays,
    }
  }

  return {
    status: 'stale',
    label: 'Stale',
    detail: `As of ${asOf}. Age ${adjustedAgeDays} day(s), which exceeds the delayed threshold.`,
    ageDays: adjustedAgeDays,
  }
}
