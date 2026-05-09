type DateParts = {
  year: number
  month: number
  day: number
}

const MANUAL_US_MARKET_CLOSURES = new Set<string>()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseDateKey(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function weekday(year: number, month: number, day: number): number {
  return utcDate(year, month, day).getUTCDay()
}

function nthWeekdayOfMonth(year: number, month: number, targetWeekday: number, nth: number): string {
  let count = 0
  for (let day = 1; day <= 31; day += 1) {
    const candidate = utcDate(year, month, day)
    if (candidate.getUTCMonth() !== month - 1) break
    if (candidate.getUTCDay() !== targetWeekday) continue
    count += 1
    if (count === nth) return dateKey(candidate)
  }
  throw new Error('Unable to calculate nth weekday')
}

function lastWeekdayOfMonth(year: number, month: number, targetWeekday: number): string {
  for (let day = 31; day >= 1; day -= 1) {
    const candidate = utcDate(year, month, day)
    if (candidate.getUTCMonth() !== month - 1) continue
    if (candidate.getUTCDay() === targetWeekday) return dateKey(candidate)
  }
  throw new Error('Unable to calculate last weekday')
}

function observedFixedHoliday(year: number, month: number, day: number, options?: { skipSaturday?: boolean }): string | null {
  const holiday = utcDate(year, month, day)
  const dayOfWeek = holiday.getUTCDay()
  if (dayOfWeek === 0) return dateKey(utcDate(year, month, day + 1))
  if (dayOfWeek === 6) {
    if (options?.skipSaturday) return null
    return dateKey(utcDate(year, month, day - 1))
  }
  return dateKey(holiday)
}

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utcDate(year, month, day)
}

function goodFriday(year: number): string {
  const easter = easterSunday(year)
  easter.setUTCDate(easter.getUTCDate() - 2)
  return dateKey(easter)
}

function usMarketHolidayKeysForYear(year: number): Set<string> {
  const holidays = new Set<string>()
  const add = (value: string | null) => {
    if (value) holidays.add(value)
  }

  // NYSE does not close on the prior Friday when New Year's Day falls on Saturday.
  add(observedFixedHoliday(year, 1, 1, { skipSaturday: true }))
  add(nthWeekdayOfMonth(year, 1, 1, 3))
  add(nthWeekdayOfMonth(year, 2, 1, 3))
  add(goodFriday(year))
  add(lastWeekdayOfMonth(year, 5, 1))
  if (year >= 2022) add(observedFixedHoliday(year, 6, 19))
  add(observedFixedHoliday(year, 7, 4))
  add(nthWeekdayOfMonth(year, 9, 1, 1))
  add(nthWeekdayOfMonth(year, 11, 4, 4))
  add(observedFixedHoliday(year, 12, 25))

  for (const closure of MANUAL_US_MARKET_CLOSURES) holidays.add(closure)
  return holidays
}

export function isPortfolioTradingDay(value: string): boolean {
  const parts = parseDateKey(value)
  if (!parts) return false

  const dayOfWeek = weekday(parts.year, parts.month, parts.day)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false

  const holidayKeys = new Set<string>()
  for (const year of [parts.year - 1, parts.year, parts.year + 1]) {
    for (const key of usMarketHolidayKeysForYear(year)) holidayKeys.add(key)
  }

  return !holidayKeys.has(value)
}

export function portfolioMarketClosureReason(value: string): string | null {
  const parts = parseDateKey(value)
  if (!parts) return 'Invalid date'

  const dayOfWeek = weekday(parts.year, parts.month, parts.day)
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'Weekend'

  const holidayKeys = new Set<string>()
  for (const year of [parts.year - 1, parts.year, parts.year + 1]) {
    for (const key of usMarketHolidayKeysForYear(year)) holidayKeys.add(key)
  }

  if (holidayKeys.has(value)) return 'US market holiday'
  return null
}
