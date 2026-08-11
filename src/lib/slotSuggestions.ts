import type { Authorization, Coach, Participant, Shift } from '../types'
import { getAuthorizationEffectiveEnd, isAuthorizationSchedulable } from './authorizations'
import {
  COACH_MAX_HOURS,
  getCoachHoursForWeek,
  getCoachMaxHoursForWeek,
  shiftUsesCoach,
} from './scheduling'
import {
  dayOfWeekFromDate,
  formatDayHeader,
  formatMinutesRange,
  getSchedulingSearchDates,
  getWeekDates,
  parseDateInput,
  SLOT_MINUTES,
  weekStartForDate,
} from './time'

export interface SuggestedSlot {
  id: string
  date: string
  startMinutes: number
  endMinutes: number
  coachId: string
  score: number
  label: string
  reasons: string[]
}

export type PreferredShiftPeriod = 'morning' | 'afternoon' | 'coach-best'

export interface PreferredShiftOption {
  label: string
  shortLabel: string
  windowStartMinutes?: number
  windowEndMinutes?: number
  useCoachAvailability?: boolean
}

export const PREFERRED_SHIFT_OPTIONS: Record<PreferredShiftPeriod, PreferredShiftOption> = {
  morning: {
    label: 'Morning (9am–1pm)',
    shortLabel: 'Morning',
    windowStartMinutes: 9 * 60,
    windowEndMinutes: 13 * 60,
  },
  afternoon: {
    label: 'Afternoon (2pm–6pm)',
    shortLabel: 'Afternoon',
    windowStartMinutes: 14 * 60,
    windowEndMinutes: 18 * 60,
  },
  'coach-best': {
    label: 'Best for Coach',
    shortLabel: 'Coach availability',
    useCoachAvailability: true,
  },
}

/** @deprecated Use PREFERRED_SHIFT_OPTIONS */
export const PREFERRED_SHIFT_WINDOWS = PREFERRED_SHIFT_OPTIONS

interface Interval {
  start: number
  end: number
}

function intersectIntervals(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start)
  const end = Math.min(a.end, b.end)
  if (start >= end) return null
  return { start, end }
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end)
    } else {
      merged.push(sorted[i])
    }
  }
  return merged
}

function freeWindows(
  avail: Interval,
  booked: Interval[],
  durationMinutes: number,
): Interval[] {
  const windows: Interval[] = []
  for (let start = avail.start; start + durationMinutes <= avail.end; start += SLOT_MINUTES) {
    const end = start + durationMinutes
    const conflict = booked.some((b) => start < b.end && end > b.start)
    if (!conflict) windows.push({ start, end })
  }
  return windows
}

function participantBookedDates(
  participantId: string,
  shifts: Shift[],
  extraDates: string[] = [],
): Set<string> {
  const dates = new Set(
    shifts.filter((s) => s.participantId === participantId).map((s) => s.date),
  )
  for (const d of extraDates) dates.add(d)
  return dates
}

function coachBookedOnDay(coachId: string, date: string, shifts: Shift[]): Interval[] {
  return shifts
    .filter((s) => s.coachId === coachId && s.date === date && shiftUsesCoach(s))
    .map((s) => ({ start: s.startMinutes, end: s.endMinutes }))
}

function resolveSearchWindow(
  coach: Coach,
  dayKey: keyof Coach['availability'],
  preferredPeriod: PreferredShiftPeriod,
): Interval | null {
  const avail = coach.availability[dayKey]
  if (!avail) return null

  const coachInterval = { start: avail.startMinutes, end: avail.endMinutes }
  const option = PREFERRED_SHIFT_OPTIONS[preferredPeriod]
  if (option.useCoachAvailability) return coachInterval
  if (option.windowStartMinutes == null || option.windowEndMinutes == null) return null

  return intersectIntervals(coachInterval, {
    start: option.windowStartMinutes,
    end: option.windowEndMinutes,
  })
}

function dayHasAvailableSlot(
  coach: Coach,
  authorization: Authorization,
  date: string,
  shifts: Shift[],
  durationMinutes: number,
  preferredPeriod: PreferredShiftPeriod,
): boolean {
  if (!isAuthorizationSchedulable(authorization)) return false
  if (
    date < authorization.authStart ||
    date > getAuthorizationEffectiveEnd(authorization)
  ) {
    return false
  }

  const dayKey = dayOfWeekFromDate(parseDateInput(date))
  const searchWindow = resolveSearchWindow(coach, dayKey, preferredPeriod)
  if (!searchWindow) return false

  const booked = mergeIntervals(coachBookedOnDay(coach.id, date, shifts))
  const windows = freeWindows(searchWindow, booked, durationMinutes)
  if (windows.length === 0) return false

  const slotWeekDates = getWeekDates(weekStartForDate(date))
  const assigned = getCoachHoursForWeek(coach.id, slotWeekDates, shifts)
  return assigned + durationMinutes / 60 <= COACH_MAX_HOURS
}

/** Days in the visible week where this coach has at least one bookable slot */
export function countCoachSlotsForWeek(
  coach: Coach,
  participant: Participant,
  authorization: Authorization,
  weekDates: string[],
  shifts: Shift[],
  shiftDurationHours: number,
  preferredPeriod: PreferredShiftPeriod = 'morning',
): number {
  const durationMinutes = shiftDurationHours * 60
  const participantDates = participantBookedDates(participant.id, shifts)
  let count = 0

  for (const date of weekDates) {
    if (participantDates.has(date)) continue
    if (
      dayHasAvailableSlot(
        coach,
        authorization,
        date,
        shifts,
        durationMinutes,
        preferredPeriod,
      )
    ) {
      count++
    }
  }

  return count
}

export interface CoachFitSummary {
  coach: Coach
  assigned: number
  maxHours: number
  remaining: number
  projected: number
  fitsAll: boolean
  sameSite: boolean
  slotCount: number
}

export function rankCoachesForParticipant(
  coaches: Coach[],
  participant: Participant,
  authorization: Authorization,
  calendarWeekStart: string,
  weekDates: string[],
  shifts: Shift[],
  shiftDurationHours: number,
  shiftCount: number,
  preferredPeriod: PreferredShiftPeriod = 'morning',
): CoachFitSummary[] {
  return coaches
    .map((coach) => {
      const assigned = getCoachHoursForWeek(coach.id, weekDates, shifts)
      const maxHours = getCoachMaxHoursForWeek(coach, weekDates)
      const suggestions = suggestShiftSlots(
        coach,
        participant,
        authorization,
        calendarWeekStart,
        shifts,
        shiftDurationHours,
        shiftCount,
        [],
        preferredPeriod,
      )
      const slotsThisWeek = countCoachSlotsForWeek(
        coach,
        participant,
        authorization,
        weekDates,
        shifts,
        shiftDurationHours,
        preferredPeriod,
      )
      const pickedThisWeek = suggestions.filter((s) => weekDates.includes(s.date)).length
      const projected = assigned + pickedThisWeek * shiftDurationHours
      return {
        coach,
        assigned,
        maxHours,
        remaining: maxHours - assigned,
        projected,
        fitsAll: suggestions.length >= shiftCount && projected <= maxHours,
        sameSite: !!participant.site && coach.startingLocation === participant.site,
        slotCount: slotsThisWeek,
      }
    })
    .sort((a, b) => {
      if (a.fitsAll !== b.fitsAll) return a.fitsAll ? -1 : 1
      if (a.sameSite !== b.sameSite) return a.sameSite ? -1 : 1
      return b.remaining - a.remaining
    })
}

export function suggestShiftSlots(
  coach: Coach,
  participant: Participant,
  authorization: Authorization,
  calendarWeekStart: string,
  shifts: Shift[],
  shiftDurationHours: number,
  maxSlots: number,
  excludeSlots: SuggestedSlot[] = [],
  preferredPeriod: PreferredShiftPeriod = 'morning',
): SuggestedSlot[] {
  if (!isAuthorizationSchedulable(authorization)) return []

  const durationMinutes = shiftDurationHours * 60
  const candidates: SuggestedSlot[] = []
  const participantDates = participantBookedDates(participant.id, shifts)
  const option = PREFERRED_SHIFT_OPTIONS[preferredPeriod]
  const searchDates = getSchedulingSearchDates(
    calendarWeekStart,
    authorization.authStart,
    getAuthorizationEffectiveEnd(authorization),
  )

  for (const date of searchDates) {
    if (participantDates.has(date)) continue

    const dayKey = dayOfWeekFromDate(parseDateInput(date))
    const avail = coach.availability[dayKey]
    const searchWindow = resolveSearchWindow(coach, dayKey, preferredPeriod)
    if (!searchWindow) continue

    const booked = mergeIntervals([
      ...coachBookedOnDay(coach.id, date, shifts),
      ...excludeSlots
        .filter((s) => s.coachId === coach.id && s.date === date)
        .map((s) => ({ start: s.startMinutes, end: s.endMinutes })),
    ])

    const windows = freeWindows(searchWindow, booked, durationMinutes)

    for (const window of windows) {
      const reasons: string[] = option.useCoachAvailability && avail
        ? [formatMinutesRange(avail.startMinutes, avail.endMinutes)]
        : [option.shortLabel]
      let score = 0

      if (participant.site && coach.startingLocation === participant.site) {
        score += 30
        reasons.push('Same site')
      }

      const slotWeekStart = weekStartForDate(date)
      const slotWeekDates = getWeekDates(slotWeekStart)
      const assigned = getCoachHoursForWeek(coach.id, slotWeekDates, shifts)
      const maxHours = getCoachMaxHoursForWeek(coach, slotWeekDates)
      const remaining = maxHours - assigned
      score += remaining * 0.5

      if (assigned + shiftDurationHours <= maxHours) {
        score += 10
        reasons.push(`${remaining}h coach capacity`)
      } else {
        score -= 50
      }

      const dayIndex = searchDates.indexOf(date)
      score -= dayIndex * 100

      candidates.push({
        id: `${preferredPeriod}-${date}-${window.start}-${coach.id}`,
        date,
        startMinutes: window.start,
        endMinutes: window.end,
        coachId: coach.id,
        score,
        label: `${formatDayHeader(date)} · ${formatMinutesRange(window.start, window.end)}`,
        reasons,
      })
    }
  }

  candidates.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startMinutes - b.startMinutes ||
      b.score - a.score,
  )

  const picked: SuggestedSlot[] = []
  const projectedByWeek = new Map<string, number>()
  const usedDates = new Set<string>()

  for (const slot of candidates) {
    if (picked.length >= maxSlots) break
    if (usedDates.has(slot.date)) continue

    const slotWeekStart = weekStartForDate(slot.date)
    const slotWeekDates = getWeekDates(slotWeekStart)
    const weekHours =
      projectedByWeek.get(slotWeekStart) ??
      getCoachHoursForWeek(coach.id, slotWeekDates, shifts)
    if (weekHours + shiftDurationHours > COACH_MAX_HOURS) continue

    picked.push(slot)
    usedDates.add(slot.date)
    projectedByWeek.set(slotWeekStart, weekHours + shiftDurationHours)
  }

  picked.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
  return picked
}

export function pickBestSlots(
  coach: Coach,
  participant: Participant,
  authorization: Authorization,
  calendarWeekStart: string,
  shifts: Shift[],
  shiftDurationHours: number,
  shiftCount: number,
  preferredPeriod: PreferredShiftPeriod = 'morning',
): SuggestedSlot[] {
  return suggestShiftSlots(
    coach,
    participant,
    authorization,
    calendarWeekStart,
    shifts,
    shiftDurationHours,
    shiftCount,
    [],
    preferredPeriod,
  )
}

export function getSlotShortageHint(
  authorization: Authorization,
  calendarWeekStart: string,
  shiftCount: number,
  foundCount: number,
): string | null {
  if (foundCount >= shiftCount) return null

  const weekDates = getWeekDates(calendarWeekStart)
  const monday = weekDates[0]
  if (authorization.authStart > monday && authorization.authStart <= weekDates[6]) {
    const excluded = weekDates.filter(
      (d) => d >= calendarWeekStart && d < authorization.authStart,
    ).length
    if (excluded > 0) {
      return `Authorization starts ${formatDayHeader(authorization.authStart)} — ${excluded} day${excluded !== 1 ? 's' : ''} earlier this week aren't eligible. Set an earlier authorization start for Mon–Thu this week.`
    }
  }

  return null
}
