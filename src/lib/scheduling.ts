import type { Coach, Participant, Shift, TimeRange } from '../types'
import type { DayOfWeek } from '../types'
import { addDays, dayOfWeekFromDate, durationHours, formatMinutesRange, getWeekDates, parseDateInput, SLOT_MINUTES, toDateInput } from './time'

export interface ShiftConflict {
  type:
    | 'coach_double_booked'
    | 'outside_auth'
    | 'coach_unavailable'
    | 'outside_coach_hours'
    | 'coach_over_hours'
    | 'participant_daily_limit'
    | 'over_working_hours'
    | 'over_coaching_hours'
  message: string
}

export type ShiftErrorLevel = 'none' | 'info' | 'warning' | 'critical'

const CRITICAL_CONFLICT_TYPES: ShiftConflict['type'][] = ['outside_auth']
const WARNING_CONFLICT_TYPES: ShiftConflict['type'][] = [
  'coach_unavailable',
  'outside_coach_hours',
  'coach_double_booked',
  'coach_over_hours',
  'over_working_hours',
  'over_coaching_hours',
]
const INFO_CONFLICT_TYPES: ShiftConflict['type'][] = ['participant_daily_limit']

export const MULTI_SHIFT_DAY_MESSAGE = 'Participant has more than 1 shift scheduled this day'

export function hasMultiShiftDayNotice(conflicts: ShiftConflict[]): boolean {
  return conflicts.some((c) => c.type === 'participant_daily_limit')
}

/** Error level for shift block colors — ignores low-severity multi-shift notices */
export function getShiftDisplayErrorLevel(conflicts: ShiftConflict[]): ShiftErrorLevel {
  const forDisplay = conflicts.filter((c) => c.type !== 'participant_daily_limit')
  return getShiftErrorLevel(forDisplay)
}

export function getShiftErrorLevel(conflicts: ShiftConflict[]): ShiftErrorLevel {
  if (conflicts.some((c) => CRITICAL_CONFLICT_TYPES.includes(c.type))) return 'critical'
  if (conflicts.some((c) => WARNING_CONFLICT_TYPES.includes(c.type))) return 'warning'
  if (conflicts.some((c) => INFO_CONFLICT_TYPES.includes(c.type))) return 'info'
  return 'none'
}

export function formatShiftConflictSummary(conflicts: ShiftConflict[]): string | undefined {
  if (conflicts.length === 0) return undefined
  return conflicts.map((c) => c.message).join('\n')
}

export function participantHasShiftOnDate(
  participantId: string,
  date: string,
  shifts: Shift[],
  excludeShiftId?: string,
): boolean {
  return shifts.some(
    (s) => s.participantId === participantId && s.date === date && s.id !== excludeShiftId,
  )
}

export function getShiftConflicts(
  shift: Shift,
  participant: Participant | undefined,
  coach: Coach | undefined,
  allShifts: Shift[],
  dayOfWeek: DayOfWeek,
  weekDates: string[],
): ShiftConflict[] {
  const conflicts: ShiftConflict[] = []

  if (participant) {
    if (shift.date < participant.authStart || shift.date > participant.authEnd) {
      conflicts.push({
        type: 'outside_auth',
        message: 'Shift is outside authorization date range',
      })
    }

    if (participantHasShiftOnDate(participant.id, shift.date, allShifts, shift.id)) {
      conflicts.push({
        type: 'participant_daily_limit',
        message: MULTI_SHIFT_DAY_MESSAGE,
      })
    }

    const totalHours = getParticipantHoursTotal(participant.id, allShifts)
    if (
      !isCoachingOnlyParticipant(participant) &&
      totalHours.totalWork > participant.workingHoursPerWeek
    ) {
      conflicts.push({
        type: 'over_working_hours',
        message: 'Out of Working Hours',
      })
    }
    if (shift.type === 'coached' && totalHours.totalCoached > participant.coachingHoursPerWeek) {
      conflicts.push({
        type: 'over_coaching_hours',
        message: 'Out of Coaching Hours',
      })
    }
  }

  if (shift.type === 'coached' && shift.coachId && coach) {
    const avail = coach.availability[dayOfWeek]
    if (!avail) {
      conflicts.push({
        type: 'coach_unavailable',
        message: `${coach.name} is not available on this day`,
      })
    } else if (shift.startMinutes < avail.startMinutes || shift.endMinutes > avail.endMinutes) {
      conflicts.push({
        type: 'outside_coach_hours',
        message: `${coach.name} is only available ${formatMinutesRange(avail.startMinutes, avail.endMinutes)} on this day`,
      })
    }

    const overlapping = allShifts.filter(
      (s) =>
        s.id !== shift.id &&
        s.coachId === shift.coachId &&
        s.date === shift.date &&
        s.startMinutes < shift.endMinutes &&
        s.endMinutes > shift.startMinutes,
    )
    if (overlapping.length > 0) {
      conflicts.push({
        type: 'coach_double_booked',
        message: `${coach.name} is already booked during this time`,
      })
    }

    const shiftHours = durationHours(shift.startMinutes, shift.endMinutes)
    const weekHours = getCoachHoursForWeek(coach.id, weekDates, allShifts, shift.id)
    if (weekHours + shiftHours > COACH_MAX_HOURS) {
      conflicts.push({
        type: 'coach_over_hours',
        message: 'Coaches cannot exceed 40 hours',
      })
    }
  }

  return conflicts
}

export interface ParticipantHours {
  soloScheduled: number
  coachedScheduled: number
  totalWorkScheduled: number
  totalWorkRemaining: number
  coachedRemaining: number
}

export function getParticipantHoursForWeek(
  participant: Participant,
  weekDates: string[],
  shifts: Shift[],
): ParticipantHours {
  const participantShifts = shifts.filter(
    (s) => s.participantId === participant.id && weekDates.includes(s.date),
  )

  let soloScheduled = 0
  let coachedScheduled = 0

  for (const shift of participantShifts) {
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    if (shift.type === 'coached') {
      coachedScheduled += hours
    } else {
      soloScheduled += hours
    }
  }

  const totalWorkScheduled = soloScheduled + coachedScheduled

  return {
    soloScheduled,
    coachedScheduled,
    totalWorkScheduled,
    totalWorkRemaining: participant.workingHoursPerWeek - totalWorkScheduled,
    coachedRemaining: participant.coachingHoursPerWeek - coachedScheduled,
  }
}

export interface ParticipantHoursTotal {
  totalWork: number
  totalCoached: number
}

export function getParticipantHoursTotal(
  participantId: string,
  shifts: Shift[],
): ParticipantHoursTotal {
  let totalWork = 0
  let totalCoached = 0

  for (const shift of shifts.filter((s) => s.participantId === participantId)) {
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    totalWork += hours
    if (shift.type === 'coached') totalCoached += hours
  }

  return { totalWork, totalCoached }
}

export function getParticipantHoursInRange(
  participantId: string,
  shifts: Shift[],
  startDate: string,
  endDate: string,
): ParticipantHoursTotal {
  let totalWork = 0
  let totalCoached = 0

  for (const shift of shifts) {
    if (shift.participantId !== participantId) continue
    if (shift.date < startDate || shift.date > endDate) continue
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    totalWork += hours
    if (shift.type === 'coached') totalCoached += hours
  }

  return { totalWork, totalCoached }
}

export function getCoachHoursInRange(
  coachId: string,
  shifts: Shift[],
  startDate: string,
  endDate: string,
): ParticipantHoursTotal {
  let totalCoached = 0

  for (const shift of shifts) {
    if (shift.coachId !== coachId || shift.type !== 'coached') continue
    if (shift.date < startDate || shift.date > endDate) continue
    totalCoached += durationHours(shift.startMinutes, shift.endMinutes)
  }

  return { totalWork: totalCoached, totalCoached }
}

export function isCoachingOnlyParticipant(participant: Participant): boolean {
  return participant.service === 'JC'
}

/** Weeks ahead of the viewed week to show participants whose authorization has not started yet */
export const PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS = 2

export function isParticipantHoursComplete(
  participant: Participant,
  totals: ParticipantHoursTotal,
): boolean {
  const coachingDone =
    participant.coachingHoursPerWeek <= 0 ||
    totals.totalCoached >= participant.coachingHoursPerWeek
  if (isCoachingOnlyParticipant(participant)) return coachingDone
  const workDone =
    participant.workingHoursPerWeek <= 0 ||
    totals.totalWork >= participant.workingHoursPerWeek
  return workDone && coachingDone
}

export const PARTICIPANT_FULLY_SCHEDULED_MESSAGE =
  'All working and coaching hours are scheduled.'

export const PARTICIPANT_FULLY_SCHEDULED_COACHING_ONLY_MESSAGE =
  'All coaching hours are scheduled.'

export function getParticipantFullyScheduledMessage(participant: Participant): string {
  return isCoachingOnlyParticipant(participant)
    ? PARTICIPANT_FULLY_SCHEDULED_COACHING_ONLY_MESSAGE
    : PARTICIPANT_FULLY_SCHEDULED_MESSAGE
}

/** All required hours are scheduled — not over cap and no auth issues */
export function isParticipantFullyScheduled(participant: Participant, shifts: Shift[]): boolean {
  if (participantHasAuthIssue(participant, shifts)) return false
  if (participantHasHoursIssue(participant, shifts)) return false
  return isParticipantHoursComplete(participant, getParticipantHoursTotal(participant.id, shifts))
}

export function isParticipantUpcomingForWeek(
  participant: Participant,
  weekEnd: string,
  lookaheadWeeks = PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS,
): boolean {
  if (participant.authStart <= weekEnd) return false
  const lookaheadEnd = toDateInput(addDays(parseDateInput(weekEnd), lookaheadWeeks * 7))
  return participant.authStart <= lookaheadEnd
}

/** Whether a participant should appear in the sidebar for the viewed calendar week */
export function isParticipantRelevantForWeek(
  participant: Participant,
  shifts: Shift[],
  weekDates: string[],
  options?: { lookaheadWeeks?: number; totals?: ParticipantHoursTotal },
): boolean {
  const weekStart = weekDates[0]
  const weekEnd = weekDates[weekDates.length - 1]

  const authOverlaps =
    participant.authStart <= weekEnd && participant.authEnd >= weekStart

  const hasShiftsThisWeek = shifts.some(
    (s) => s.participantId === participant.id && weekDates.includes(s.date),
  )

  const totals = options?.totals ?? getParticipantHoursTotal(participant.id, shifts)
  const complete = isParticipantHoursComplete(participant, totals)
  const upcoming = isParticipantUpcomingForWeek(
    participant,
    weekEnd,
    options?.lookaheadWeeks,
  )

  return authOverlaps || hasShiftsThisWeek || !complete || upcoming
}

export function participantHasAuthIssue(participant: Participant, shifts: Shift[]): boolean {
  return shifts.some(
    (s) =>
      s.participantId === participant.id &&
      (s.date < participant.authStart || s.date > participant.authEnd),
  )
}

export function participantHasHoursIssue(participant: Participant, shifts: Shift[]): boolean {
  const totalHours = getParticipantHoursTotal(participant.id, shifts)
  const workOver =
    !isCoachingOnlyParticipant(participant) &&
    totalHours.totalWork > participant.workingHoursPerWeek

  return workOver || totalHours.totalCoached > participant.coachingHoursPerWeek
}

export function formatHoursValue(hours: number): string {
  return String(Math.round(hours * 10) / 10)
}

export function getShiftMilestoneLabels(
  participant: Participant,
  shiftId: string,
  shifts: Shift[],
): string[] {
  const coachingOnly = isCoachingOnlyParticipant(participant)
  const ordered = shifts
    .filter((s) => s.participantId === participant.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)

  let cumWork = 0
  let cumCoached = 0
  let seenCoachingShift = false

  for (const s of ordered) {
    const hours = durationHours(s.startMinutes, s.endMinutes)
    const workBefore = cumWork
    const coachedBefore = cumCoached
    const isFirstWorkShift = !coachingOnly && cumWork === 0

    cumWork += hours

    let isFirstCoachingShift = false
    if (s.type === 'coached') {
      isFirstCoachingShift = !seenCoachingShift
      seenCoachingShift = true
      cumCoached += hours
    }

    if (s.id !== shiftId) continue

    const labels: string[] = []
    if (isFirstWorkShift) labels.push('First working shift')
    if (isFirstCoachingShift) labels.push('First coaching shift')

    if (
      !coachingOnly &&
      participant.workingHoursPerWeek > 0 &&
      workBefore < participant.workingHoursPerWeek &&
      cumWork >= participant.workingHoursPerWeek
    ) {
      labels.push('Last working shift')
    }

    if (
      s.type === 'coached' &&
      participant.coachingHoursPerWeek > 0 &&
      coachedBefore < participant.coachingHoursPerWeek &&
      cumCoached >= participant.coachingHoursPerWeek
    ) {
      labels.push('Last coaching shift')
    }

    return labels
  }

  return []
}

/** Maximum coached hours a coach may be assigned in a calendar week */
export const COACH_MAX_HOURS = 40

export function getCoachAvailabilityHoursForWeek(coach: Coach, weekDates: string[]): number {
  let total = 0
  for (const date of weekDates) {
    const dayKey = dayOfWeekFromDate(parseDateInput(date))
    const avail = coach.availability[dayKey]
    if (avail) {
      total += durationHours(avail.startMinutes, avail.endMinutes)
    }
  }
  return Math.round(total * 10) / 10
}

/** Weekly availability capacity (sum of daily windows) — used for sidebar display */
export function getCoachMaxHoursForWeek(coach: Coach, weekDates: string[]): number {
  return getCoachAvailabilityHoursForWeek(coach, weekDates)
}

export function coachHasWeeklyHoursIssue(
  coach: Coach,
  weekDates: string[],
  shifts: Shift[],
): boolean {
  return getCoachHoursForWeek(coach.id, weekDates, shifts) > COACH_MAX_HOURS
}

export function getCoachSidebarIssueMessages(
  coach: Coach,
  weekDates: string[],
  shifts: Shift[],
  participants: Participant[],
): string[] {
  const messages: string[] = []
  const seen = new Set<string>()

  const add = (msg: string) => {
    if (!seen.has(msg)) {
      seen.add(msg)
      messages.push(msg)
    }
  }

  const summary = getCoachHoursSummary(coach, weekDates, shifts)
  if (coachHasWeeklyHoursIssue(coach, weekDates, shifts)) {
    add('Coaches cannot exceed 40 hours')
  }
  if (summary.max > 0 && summary.assigned > summary.max) {
    add('Over weekly availability')
  }

  const participantMap = new Map(participants.map((p) => [p.id, p]))
  const coachShifts = shifts.filter(
    (s) =>
      s.coachId === coach.id && s.type === 'coached' && weekDates.includes(s.date),
  )

  for (const shift of coachShifts) {
    const dayKey = dayOfWeekFromDate(parseDateInput(shift.date))
    const participant = participantMap.get(shift.participantId)
    const conflicts = getShiftConflicts(
      shift,
      participant,
      coach,
      shifts,
      dayKey,
      weekDates,
    )
    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'coach_over_hours':
          add('Coaches cannot exceed 40 hours')
          break
        case 'coach_double_booked':
          add('Double booked')
          break
        case 'coach_unavailable':
          add('Not available this day')
          break
        case 'outside_coach_hours':
          add('Outside daily availability')
          break
      }
    }
  }

  return messages
}

export function getCoachHoursForWeek(
  coachId: string,
  weekDates: string[],
  shifts: Shift[],
  excludeShiftId?: string,
): number {
  return shifts
    .filter(
      (s) =>
        s.id !== excludeShiftId &&
        s.coachId === coachId &&
        s.type === 'coached' &&
        weekDates.includes(s.date),
    )
    .reduce((sum, s) => sum + durationHours(s.startMinutes, s.endMinutes), 0)
}

export interface CoachHoursSummary {
  assigned: number
  max: number
  percentage: number
  remaining: number
}

export function getCoachHoursSummary(
  coach: Coach,
  weekDates: string[],
  shifts: Shift[],
  excludeShiftId?: string,
): CoachHoursSummary {
  const assigned = getCoachHoursForWeek(coach.id, weekDates, shifts, excludeShiftId)
  const max = getCoachMaxHoursForWeek(coach, weekDates)
  const percentage = max > 0 ? Math.round((assigned / max) * 100) : 0
  return {
    assigned,
    max,
    percentage,
    remaining: max - assigned,
  }
}

export interface CoachSlot {
  coach: Coach
  available: boolean
  reason?: string
}

export function getAvailableCoaches(
  coaches: Coach[],
  dayOfWeek: DayOfWeek,
  startMinutes: number,
  endMinutes: number,
  date: string,
  shifts: Shift[],
  weekDates: string[],
  excludeShiftId?: string,
): CoachSlot[] {
  const shiftHours = durationHours(startMinutes, endMinutes)

  return coaches.map((coach) => {
    const avail = coach.availability[dayOfWeek]
    if (!avail) {
      return { coach, available: false, reason: 'Not available this day' }
    }
    if (startMinutes < avail.startMinutes || endMinutes > avail.endMinutes) {
      return { coach, available: false, reason: 'Outside daily availability' }
    }
    const conflict = shifts.some(
      (s) =>
        s.id !== excludeShiftId &&
        s.coachId === coach.id &&
        s.date === date &&
        s.startMinutes < endMinutes &&
        s.endMinutes > startMinutes,
    )
    if (conflict) {
      return { coach, available: false, reason: 'Already booked' }
    }
    const weekHours = getCoachHoursForWeek(coach.id, weekDates, shifts, excludeShiftId)
    if (weekHours + shiftHours > COACH_MAX_HOURS) {
      return { coach, available: false, reason: `Would exceed ${COACH_MAX_HOURS}h/week` }
    }
    return { coach, available: true }
  })
}

export function defaultAvailability(): Partial<Record<DayOfWeek, TimeRange | null>> {
  return {
    monday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
    tuesday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
    wednesday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
    thursday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
    friday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
  }
}

export function buildCopiedShiftsFromPreviousWeek(
  weekStart: string,
  shifts: Shift[],
  participants: Participant[],
): Omit<Shift, 'id'>[] {
  const currentWeek = getWeekDates(weekStart)
  const prevWeekStart = toDateInput(addDays(parseDateInput(weekStart), -7))
  const prevWeek = getWeekDates(prevWeekStart)
  const dateMap = new Map(prevWeek.map((d, i) => [d, currentWeek[i]]))

  const copied: Omit<Shift, 'id'>[] = []

  for (const shift of shifts) {
    if (!prevWeek.includes(shift.date)) continue

    const newDate = dateMap.get(shift.date)!
    const participant = participants.find((p) => p.id === shift.participantId)
    if (!participant) continue

    const copy: Omit<Shift, 'id'> = {
      participantId: shift.participantId,
      date: newDate,
      startMinutes: shift.startMinutes,
      endMinutes: shift.endMinutes,
      type: shift.type,
      coachId: shift.coachId,
      notes: shift.notes,
    }
    copied.push(copy)
  }

  return copied
}

/** Split a shift in half — first half coached (keeps coach if any), second half solo */
export function splitShiftForPartialCoverage(
  shift: Shift,
): [Omit<Shift, 'id'>, Omit<Shift, 'id'>] | null {
  const duration = shift.endMinutes - shift.startMinutes
  const minHalf = SLOT_MINUTES
  if (duration < minHalf * 2) return null

  const midMinutes =
    shift.startMinutes + Math.round(duration / 2 / SLOT_MINUTES) * SLOT_MINUTES
  if (midMinutes - shift.startMinutes < minHalf) return null
  if (shift.endMinutes - midMinutes < minHalf) return null

  const coachedHalf: Omit<Shift, 'id'> = {
    participantId: shift.participantId,
    date: shift.date,
    startMinutes: shift.startMinutes,
    endMinutes: midMinutes,
    type: 'coached',
    coachId: shift.type === 'coached' ? shift.coachId : undefined,
    notes: shift.notes,
  }

  const soloHalf: Omit<Shift, 'id'> = {
    participantId: shift.participantId,
    date: shift.date,
    startMinutes: midMinutes,
    endMinutes: shift.endMinutes,
    type: 'solo',
  }

  return [coachedHalf, soloHalf]
}
