import { z } from 'zod'

export const STORE_HOURS_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type StoreHoursDay = (typeof STORE_HOURS_DAYS)[number]
export type StoreHoursPeriod = { open: string; close: string }
export type WeeklyStoreHours = Record<StoreHoursDay, StoreHoursPeriod[]>
export type SpecialStoreHour = {
  date: string
  openTime?: string
  closeTime?: string
  isClosed?: boolean
  reason?: string
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timeSchema = z.string().regex(timePattern, 'must use HH:MM 24-hour format')
const periodSchema = z.object({ open: timeSchema, close: timeSchema }).strict()
const daySchema = z.array(periodSchema).max(24)
const weeklySchema = z.object(
  Object.fromEntries(STORE_HOURS_DAYS.map((day) => [day, daySchema.optional()])) as Record<StoreHoursDay, z.ZodOptional<typeof daySchema>>,
).strict()

const specialHourSchema = z.object({
  date: z.string().regex(datePattern, 'must use YYYY-MM-DD format').refine(isCalendarDate, 'must be a valid calendar date'),
  openTime: timeSchema.optional(),
  closeTime: timeSchema.optional(),
  isClosed: z.boolean().optional(),
  reason: z.string().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.isClosed) {
    if (value.openTime !== undefined || value.closeTime !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'closed exceptions cannot include openTime or closeTime' })
    }
    return
  }
  if (!value.openTime || !value.closeTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'openTime and closeTime are required unless isClosed is true' })
  }
})
const specialHoursSchema = z.array(specialHourSchema).max(366)

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function emptyWeeklyHours(): WeeklyStoreHours {
  return Object.fromEntries(STORE_HOURS_DAYS.map((day) => [day, []])) as unknown as WeeklyStoreHours
}

function normalizePeriod(value: unknown): StoreHoursPeriod | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const period = value as Record<string, unknown>
  if (typeof period.open !== 'string' || typeof period.close !== 'string') return null
  return { open: period.open, close: period.close }
}

export function normalizeWeeklyHours(value: unknown): WeeklyStoreHours | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const result = emptyWeeklyHours()
  for (const day of STORE_HOURS_DAYS) {
    const raw = source[day] ?? source[day[0].toUpperCase() + day.slice(1)]
    if (Array.isArray(raw)) {
      result[day] = raw.map((period) => normalizePeriod(period) || period) as StoreHoursPeriod[]
    } else if (raw && typeof raw === 'object') {
      const legacy = raw as Record<string, unknown>
      if (!legacy.closed) {
        const period = normalizePeriod(raw)
        if (period) result[day] = [period]
      }
    }
  }
  return result
}

export function validateWeeklyHours(value: unknown): WeeklyStoreHours {
  const normalized = normalizeWeeklyHours(value)
  if (!normalized) throw new Error('operating hours must be an object keyed by weekday')
  const parsed = weeklySchema.safeParse(normalized)
  if (!parsed.success) throw new Error(`invalid operating hours: ${parsed.error.issues[0]?.message || 'invalid schedule'}`)
  return parsed.data as WeeklyStoreHours
}

export function validateSpecialHours(value: unknown): SpecialStoreHour[] | null {
  if (value === null || value === undefined) return null
  const parsed = specialHoursSchema.safeParse(value)
  if (!parsed.success) throw new Error(`invalid special hours: ${parsed.error.issues[0]?.message || 'invalid exception'}`)
  return parsed.data
}

export function validateTimezone(value: unknown): string {
  const timezone = typeof value === 'string' && value.trim() ? value.trim() : 'Asia/Manila'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
  } catch {
    throw new Error('timezone must be a valid IANA identifier (e.g. Asia/Manila)')
  }
  return timezone
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function localParts(now: Date, timezone: string): { date: string; day: StoreHoursDay; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    day: values.weekday.toLowerCase() as StoreHoursDay,
    time: `${values.hour}:${values.minute}`,
  }
}

function previousDay(day: StoreHoursDay): StoreHoursDay {
  const index = STORE_HOURS_DAYS.indexOf(day)
  return STORE_HOURS_DAYS[(index + 6) % 7]
}

function periodContains(period: StoreHoursPeriod, current: number): boolean {
  const open = minutes(period.open)
  const close = minutes(period.close)
  if (open === close) return true
  return close < open ? current >= open || current <= close : current >= open && current <= close
}

export type StoreOpenResult = {
  isOpen: boolean
  reason: 'special-closed' | 'scheduled' | 'no-hours' | 'outside-hours'
  period?: StoreHoursPeriod
  exception?: SpecialStoreHour
  nextOpeningAt?: string | null
}

export function isStoreOpen(
  merchant: { operatingHours?: unknown; specialHours?: unknown; delivery_hours?: unknown; delivery_zones?: unknown; timezone?: unknown },
  now: Date = new Date(),
  zoneId?: string,
): StoreOpenResult {
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid Date')
  const timezone = validateTimezone(merchant.timezone)
  const current = localParts(now, timezone)
  const specialHours = validateSpecialHours(merchant.specialHours)
  const exception = specialHours?.find((item) => item.date === current.date)
  if (exception) {
    if (exception.isClosed) return { isOpen: false, reason: 'special-closed', exception }
    const period = { open: exception.openTime!, close: exception.closeTime! }
    return periodContains(period, minutes(current.time))
      ? { isOpen: true, reason: 'scheduled', period, exception }
      : { isOpen: false, reason: 'outside-hours', exception }
  }

  const zoneHours = zoneId ? getZoneHours(merchant.delivery_zones, zoneId) : null
  const delivery = zoneHours || normalizeWeeklyHours(merchant.delivery_hours)
  const regular = normalizeWeeklyHours(merchant.operatingHours)
  const hours = delivery && Object.values(delivery).some((periods) => periods.length) ? delivery : regular
  if (!hours) return { isOpen: false, reason: 'no-hours' }

  const currentMinutes = minutes(current.time)
  const candidates = [
    ...(hours[current.day] || []),
    ...(hours[previousDay(current.day)] || []).filter((period) => minutes(period.close) < minutes(period.open)),
  ]
  const period = candidates.find((candidate) => periodContains(candidate, currentMinutes))
  return period ? { isOpen: true, reason: 'scheduled', period } : { isOpen: false, reason: 'outside-hours' }
}

function getZoneHours(value: unknown, zoneId: string): WeeklyStoreHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const zone = (value as Record<string, unknown>)[zoneId]
  if (!zone || typeof zone !== 'object' || Array.isArray(zone)) return null
  const config = zone as Record<string, unknown>
  return normalizeWeeklyHours(config.hours ?? config.operatingHours ?? config.delivery_hours)
}

export function isStoreOpenForZone(
  merchant: Parameters<typeof isStoreOpen>[0],
  zoneId: string,
  now: Date = new Date(),
): StoreOpenResult {
  return isStoreOpen(merchant, now, zoneId)
}

export function getStoreHoursStatus(merchant: Parameters<typeof isStoreOpen>[0]): StoreOpenResult {
  try {
    const now = new Date()
    const result = isStoreOpen(merchant, now)
    if (result.isOpen || result.reason === 'no-hours' || result.reason === 'special-closed') return result
    const nextOpeningAt = findNextOpening(merchant, now)
    return { ...result, nextOpeningAt }
  } catch {
    return { isOpen: false, reason: 'no-hours' }
  }
}

export function findNextOpening(
  merchant: Parameters<typeof isStoreOpen>[0],
  from: Date = new Date(),
): string | null {
  const start = new Date(from.getTime())
  start.setSeconds(0, 0)
  for (let minute = 1; minute <= 8 * 24 * 60; minute += 1) {
    const candidate = new Date(start.getTime() + minute * 60_000)
    if (isStoreOpen(merchant, candidate).isOpen) {
      return candidate.toISOString()
    }
  }
  return null
}

export function validateStoreHoursFields(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data }
  if (next.operatingHours !== undefined && next.operatingHours !== null) next.operatingHours = validateWeeklyHours(next.operatingHours)
  if (next.specialHours !== undefined) next.specialHours = validateSpecialHours(next.specialHours)
  if (next.delivery_hours === undefined && next.deliveryHours !== undefined) next.delivery_hours = next.deliveryHours
  if (next.delivery_hours !== undefined && next.delivery_hours !== null) next.delivery_hours = validateWeeklyHours(next.delivery_hours)
  if (next.timezone !== undefined) next.timezone = validateTimezone(next.timezone)
  return next
}
