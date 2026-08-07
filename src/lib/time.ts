import type { DayOfWeek } from '../types'
import { DAYS } from '../types'

export function generateId(): string {
  return crypto.randomUUID()
}

/** Internal 24h "HH:MM" for selects and parsing — not shown to users directly */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTimeValue(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** @deprecated use minutesToTimeValue */
export const minutesToTimeInput = minutesToTimeValue

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 || h === 12 ? 12 : h > 12 ? h - 12 : h
  return `${display}:${m.toString().padStart(2, '0')} ${period}`
}

export function formatMinutesRange(start: number, end: number): string {
  return `${formatMinutes(start)} – ${formatMinutes(end)}`
}

export function durationHours(start: number, end: number): number {
  return (end - start) / 60
}

export interface TimeOption {
  value: string
  label: string
  minutes: number
}

export function timeOptionItems(
  start = CALENDAR_VIEW_START,
  end = CALENDAR_VIEW_END,
  step = SLOT_MINUTES,
): TimeOption[] {
  const options: TimeOption[] = []
  for (let m = start; m <= end; m += step) {
    const value = minutesToTimeValue(m)
    options.push({ value, label: formatMinutes(m), minutes: m })
  }
  return options
}

/** @deprecated use timeOptionItems — returns 24h values only */
export function timeOptions(
  start = CALENDAR_VIEW_START,
  end = CALENDAR_VIEW_END,
  step = SLOT_MINUTES,
): string[] {
  return timeOptionItems(start, end, step).map((o) => o.value)
}

export function toDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayDateInput(): string {
  return toDateInput(new Date())
}

export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function dayOfWeekFromDate(date: Date): DayOfWeek {
  return DAYS[date.getDay()]
}

/** Typical participant authorization length in days */
export const DEFAULT_PARTICIPANT_AUTH_DAYS = 90

export function addDaysToDateInput(dateStr: string, days: number): string {
  return toDateInput(addDays(parseDateInput(dateStr), days))
}

export function defaultParticipantAuthRange(fromDate = new Date()): {
  authStart: string
  authEnd: string
} {
  const authStart = toDateInput(startOfWeek(fromDate))
  const authEnd = addDaysToDateInput(authStart, DEFAULT_PARTICIPANT_AUTH_DAYS)
  return { authStart, authEnd }
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseDateInput(weekStart)
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}

export function formatDayHeader(dateStr: string): string {
  const d = parseDateInput(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
}

export function formatAuthRange(authStart: string, authEnd: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const start = parseDateInput(authStart).toLocaleDateString(undefined, opts)
  const end = parseDateInput(authEnd).toLocaleDateString(undefined, opts)
  return `${start} – ${end}`
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseDateInput(weekStart)
  return Array.from({ length: 7 }, (_, i) => toDateInput(addDays(start, i)))
}

/** Dates to search when suggesting shifts — from calendar week forward through auth end */
export function getSchedulingSearchDates(
  calendarWeekStart: string,
  authStart: string,
  authEnd: string,
  maxWeeks = 12,
): string[] {
  let weekStart = calendarWeekStart
  const authWeekStart = toDateInput(startOfWeek(parseDateInput(authStart)))
  if (authWeekStart > weekStart) weekStart = authWeekStart

  const dates: string[] = []
  for (let w = 0; w < maxWeeks; w++) {
    for (const date of getWeekDates(weekStart)) {
      if (date >= authStart && date <= authEnd) dates.push(date)
    }
    const nextWeekStart = toDateInput(addDays(parseDateInput(weekStart), 7))
    if (nextWeekStart > authEnd) break
    weekStart = nextWeekStart
  }
  return dates
}

export function weekStartForDate(dateStr: string): string {
  return toDateInput(startOfWeek(parseDateInput(dateStr)))
}

/** Whole-week difference between a date and the calendar's visible week */
export function weekOffsetFromCalendar(calendarWeekStart: string, dateStr: string): number {
  const cal = startOfWeek(parseDateInput(calendarWeekStart)).getTime()
  const slot = startOfWeek(parseDateInput(dateStr)).getTime()
  return Math.round((slot - cal) / (7 * 24 * 60 * 60 * 1000))
}

export function formatWeekOffsetLabel(offset: number): string {
  if (offset === 0) return 'This week'
  if (offset === 1) return 'Next week'
  if (offset === -1) return 'Previous week'
  if (offset > 1) return `${offset} weeks from now`
  return `${Math.abs(offset)} weeks ago`
}

export const GRID_START = 0
export const GRID_END = 24 * 60
export const CALENDAR_VIEW_START = 8 * 60
export const CALENDAR_VIEW_END = 21 * 60
export const SLOT_MINUTES = 30

export function snapMinutesFromGridY(
  yPx: number,
  hourHeight: number,
  step = SLOT_MINUTES,
): number {
  const rawMinutes = CALENDAR_VIEW_START + (yPx / hourHeight) * 60
  const snapped = Math.round(rawMinutes / step) * step
  const maxStart = CALENDAR_VIEW_END - step
  return Math.max(CALENDAR_VIEW_START, Math.min(maxStart, snapped))
}

export function formatGridHour(minutes: number): string {
  return formatMinutes(minutes)
}
