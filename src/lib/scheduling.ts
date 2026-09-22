import type { Authorization, Coach, OtherCoachingActivity, Participant, Shift, TimeRange } from '../types'
import type { DayOfWeek } from '../types'
import {
  authorizationOverlapsRange,
  getAuthorizationEffectiveEnd,
  isAuthorizationSchedulable,
  isCoachingOnlyAuthorization,
} from './authorizations'
import { addDays, dayOfWeekFromDate, durationHours, formatMinutesRange, getWeekDates, parseDateInput, SLOT_MINUTES, toDateInput, todayDateInput } from './time'

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
    | 'missing_authorization'
  message: string
}

export type ShiftErrorLevel = 'none' | 'info' | 'warning' | 'critical'

const CRITICAL_CONFLICT_TYPES: ShiftConflict['type'][] = [
  'outside_auth',
  'missing_authorization',
]
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

export function shiftUsesCoach(shift: Shift): boolean {
  return (
    (shift.type === 'coached' || shift.type === 'other-coaching') && !!shift.coachId
  )
}

export function getOtherCoachingHoursForWeek(
  activityId: string,
  weekDates: string[],
  shifts: Shift[],
  excludeShiftId?: string,
): number {
  return shifts
    .filter(
      (s) =>
        s.id !== excludeShiftId &&
        s.type === 'other-coaching' &&
        s.otherCoachingActivityId === activityId &&
        weekDates.includes(s.date),
    )
    .reduce((sum, s) => sum + durationHours(s.startMinutes, s.endMinutes), 0)
}

/** Whether an assignment should appear in the sidebar for the viewed calendar week */
export function isOtherCoachingRelevantForWeek(
  activityId: string,
  shifts: Shift[],
  weekDates: string[],
): boolean {
  return shifts.some(
    (s) =>
      s.type === 'other-coaching' &&
      s.otherCoachingActivityId === activityId &&
      weekDates.includes(s.date),
  )
}

export function participantHasShiftOnDate(
  participantId: string,
  date: string,
  shifts: Shift[],
  excludeShiftId?: string,
  authorizationId?: string,
): boolean {
  return shifts.some(
    (s) =>
      s.participantId === participantId &&
      s.date === date &&
      s.id !== excludeShiftId &&
      (authorizationId === undefined || s.authorizationId === authorizationId),
  )
}

export function getShiftConflicts(
  shift: Shift,
  participant: Participant | undefined,
  authorization: Authorization | undefined,
  coach: Coach | undefined,
  allShifts: Shift[],
  dayOfWeek: DayOfWeek,
  weekDates: string[],
): ShiftConflict[] {
  const conflicts: ShiftConflict[] = []

  if (participant && shift.participantId) {
    if (!shift.authorizationId) {
      conflicts.push({
        type: 'missing_authorization',
        message: 'Shift is not linked to an authorization',
      })
    } else if (!authorization) {
      conflicts.push({
        type: 'missing_authorization',
        message: 'Linked authorization was not found',
      })
    } else if (
      shift.date < authorization.authStart ||
      shift.date > getAuthorizationEffectiveEnd(authorization)
    ) {
      conflicts.push({
        type: 'outside_auth',
        message: 'Shift is outside authorization date range',
      })
    }

    if (
      participantHasShiftOnDate(
        participant.id,
        shift.date,
        allShifts,
        shift.id,
        shift.authorizationId,
      )
    ) {
      conflicts.push({
        type: 'participant_daily_limit',
        message: MULTI_SHIFT_DAY_MESSAGE,
      })
    }

    if (authorization && shift.authorizationId) {
      const totalHours = getAuthorizationHoursTotal(shift.authorizationId, allShifts)
      if (
        !isCoachingOnlyAuthorization(authorization) &&
        totalHours.totalWork > authorization.workingHours
      ) {
        conflicts.push({
          type: 'over_working_hours',
          message: 'Out of Working Hours',
        })
      }
      if (
        shift.type === 'coached' &&
        totalHours.totalCoached > authorization.coachingHours
      ) {
        conflicts.push({
          type: 'over_coaching_hours',
          message: 'Out of Coaching Hours',
        })
      }
    }
  }

  if (shiftUsesCoach(shift) && shift.coachId && coach) {
    // Availability is a live weekly pattern — only validate it for today/future
    // so changing weekends later does not flag historical shifts.
    if (shift.date >= todayDateInput()) {
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
  authorizationId: string,
  weekDates: string[],
  shifts: Shift[],
  authorization: Authorization,
): ParticipantHours {
  const authShifts = shifts.filter(
    (s) => s.authorizationId === authorizationId && weekDates.includes(s.date),
  )

  let soloScheduled = 0
  let coachedScheduled = 0

  for (const shift of authShifts) {
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
    totalWorkRemaining: authorization.workingHours - totalWorkScheduled,
    coachedRemaining: authorization.coachingHours - coachedScheduled,
  }
}

export interface ParticipantHoursTotal {
  totalWork: number
  totalCoached: number
}

export function getAuthorizationHoursTotal(
  authorizationId: string,
  shifts: Shift[],
): ParticipantHoursTotal {
  let totalWork = 0
  let totalCoached = 0

  for (const shift of shifts.filter((s) => s.authorizationId === authorizationId)) {
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    totalWork += hours
    if (shift.type === 'coached') totalCoached += hours
  }

  return { totalWork, totalCoached }
}

/** @deprecated Use getAuthorizationHoursTotal for per-auth totals */
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

/** Hours for a single authorization within a date range */
export function getAuthorizationHoursInRange(
  authorizationId: string,
  shifts: Shift[],
  startDate: string,
  endDate: string,
): ParticipantHoursTotal {
  let totalWork = 0
  let totalCoached = 0

  for (const shift of shifts) {
    if (shift.authorizationId !== authorizationId) continue
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
  return participant.authorizations.some((a) => a.service === 'JC')
}

/** Weeks ahead of the viewed week to show authorizations that have not started yet */
export const PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS = 2

/** User-facing rules for when a participant appears in the sidebar week view */
export function participantWeekViewVisibilityRules(): string[] {
  return [
    'An active authorization overlaps the week you are viewing',
    'They have at least one shift scheduled this week',
    'An active authorization still has hours to schedule',
    `An active authorization starts within the next ${PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS} weeks`,
  ]
}

export function isAuthorizationHoursComplete(
  authorization: Authorization,
  totals: ParticipantHoursTotal,
): boolean {
  const coachingDone =
    authorization.coachingHours <= 0 || totals.totalCoached >= authorization.coachingHours
  if (isCoachingOnlyAuthorization(authorization)) return coachingDone
  const workDone =
    authorization.workingHours <= 0 || totals.totalWork >= authorization.workingHours
  return workDone && coachingDone
}

export const PARTICIPANT_FULLY_SCHEDULED_MESSAGE =
  'All working and coaching hours are scheduled for this authorization.'

export const PARTICIPANT_FULLY_SCHEDULED_COACHING_ONLY_MESSAGE =
  'All coaching hours are scheduled for this authorization.'

export function getAuthorizationFullyScheduledMessage(
  authorization: Authorization,
): string {
  return isCoachingOnlyAuthorization(authorization)
    ? PARTICIPANT_FULLY_SCHEDULED_COACHING_ONLY_MESSAGE
    : PARTICIPANT_FULLY_SCHEDULED_MESSAGE
}

export const SHIFT_FULLY_SCHEDULED_LABEL = 'All hours scheduled'
export const SHIFT_FULLY_SCHEDULED_COACHING_LABEL = 'All coaching hours scheduled'

export function getShiftFullyScheduledLabel(authorization: Authorization): string {
  return isCoachingOnlyAuthorization(authorization)
    ? SHIFT_FULLY_SCHEDULED_COACHING_LABEL
    : SHIFT_FULLY_SCHEDULED_LABEL
}

export interface AuthorizationHoursDisplayLine {
  label: string
  overLimit: boolean
}

export function getAuthorizationHoursDisplayLines(
  authorization: Authorization,
  shifts: Shift[],
): AuthorizationHoursDisplayLine[] {
  const totals = getAuthorizationHoursTotal(authorization.id, shifts)
  const lines: AuthorizationHoursDisplayLine[] = []

  if (!isCoachingOnlyAuthorization(authorization)) {
    lines.push({
      label: `${formatHoursValue(totals.totalWork)}/${formatHoursValue(authorization.workingHours)} working hours scheduled`,
      overLimit: totals.totalWork > authorization.workingHours,
    })
  }

  lines.push({
    label: `${formatHoursValue(totals.totalCoached)}/${formatHoursValue(authorization.coachingHours)} coaching hours scheduled`,
    overLimit: totals.totalCoached > authorization.coachingHours,
  })

  return lines
}

/** @deprecated Use getAuthorizationFullyScheduledMessage */
export function getParticipantFullyScheduledMessage(participant: Participant): string {
  const auth = participant.authorizations[0]
  return auth
    ? getAuthorizationFullyScheduledMessage(auth)
    : PARTICIPANT_FULLY_SCHEDULED_MESSAGE
}

export function authorizationHasAuthIssue(
  authorization: Authorization,
  participantId: string,
  shifts: Shift[],
): boolean {
  return shifts.some(
    (s) =>
      s.participantId === participantId &&
      s.authorizationId === authorization.id &&
      (s.date < authorization.authStart ||
        s.date > getAuthorizationEffectiveEnd(authorization)),
  )
}

export function authorizationHasHoursIssue(
  authorization: Authorization,
  shifts: Shift[],
): boolean {
  const totalHours = getAuthorizationHoursTotal(authorization.id, shifts)
  const workOver =
    !isCoachingOnlyAuthorization(authorization) &&
    totalHours.totalWork > authorization.workingHours

  return workOver || totalHours.totalCoached > authorization.coachingHours
}

export function isAuthorizationFullyScheduled(
  authorization: Authorization,
  participantId: string,
  shifts: Shift[],
): boolean {
  if (!isAuthorizationSchedulable(authorization)) return false
  if (authorizationHasAuthIssue(authorization, participantId, shifts)) return false
  if (authorizationHasHoursIssue(authorization, shifts)) return false
  return isAuthorizationHoursComplete(
    authorization,
    getAuthorizationHoursTotal(authorization.id, shifts),
  )
}

/** @deprecated Use isAuthorizationFullyScheduled for the selected authorization */
export function isParticipantFullyScheduled(participant: Participant, shifts: Shift[]): boolean {
  return participant.authorizations.some((auth) =>
    isAuthorizationFullyScheduled(auth, participant.id, shifts),
  )
}

export function isAuthorizationUpcomingForWeek(
  authorization: Authorization,
  weekEnd: string,
  lookaheadWeeks = PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS,
): boolean {
  if (authorization.authStart <= weekEnd) return false
  const lookaheadEnd = toDateInput(addDays(parseDateInput(weekEnd), lookaheadWeeks * 7))
  return authorization.authStart <= lookaheadEnd
}

export function isAuthorizationRelevantForWeek(
  authorization: Authorization,
  participantId: string,
  shifts: Shift[],
  weekDates: string[],
  lookaheadWeeks = PARTICIPANT_UPCOMING_LOOKAHEAD_WEEKS,
): boolean {
  const weekStart = weekDates[0]
  const weekEnd = weekDates[weekDates.length - 1]

  const hasShiftsThisWeek = shifts.some(
    (s) =>
      s.participantId === participantId &&
      s.authorizationId === authorization.id &&
      weekDates.includes(s.date),
  )
  if (hasShiftsThisWeek) return true

  if (authorization.status !== 'active') return false

  const overlaps = authorizationOverlapsRange(authorization, weekStart, weekEnd)
  if (overlaps) {
    const totals = getAuthorizationHoursTotal(authorization.id, shifts)
    if (!isAuthorizationHoursComplete(authorization, totals)) return true
  }

  return isAuthorizationUpcomingForWeek(authorization, weekEnd, lookaheadWeeks)
}

/** Whether a participant should appear in the sidebar for the viewed calendar week */
export function isParticipantRelevantForWeek(
  participant: Participant,
  shifts: Shift[],
  weekDates: string[],
): boolean {
  const hasShiftsThisWeek = shifts.some(
    (s) => s.participantId === participant.id && weekDates.includes(s.date),
  )
  if (hasShiftsThisWeek) return true

  return participant.authorizations.some((auth) =>
    isAuthorizationRelevantForWeek(auth, participant.id, shifts, weekDates),
  )
}

export function participantHasAuthIssue(participant: Participant, shifts: Shift[]): boolean {
  return shifts.some((s) => {
    if (s.participantId !== participant.id) return false
    if (!s.authorizationId) return true
    const auth = participant.authorizations.find((a) => a.id === s.authorizationId)
    if (!auth) return true
    return (
      s.date < auth.authStart || s.date > getAuthorizationEffectiveEnd(auth)
    )
  })
}

export function participantHasHoursIssue(
  participant: Participant,
  shifts: Shift[],
  authorizationId?: string,
): boolean {
  const auths = authorizationId
    ? participant.authorizations.filter((a) => a.id === authorizationId)
    : participant.authorizations
  return auths.some((auth) => authorizationHasHoursIssue(auth, shifts))
}

function resolveShiftCoach(
  shift: Shift,
  coaches: Coach[],
  otherCoachingActivities: OtherCoachingActivity[],
): Coach | undefined {
  if (shift.coachId) {
    return coaches.find((c) => c.id === shift.coachId)
  }
  if (shift.type === 'other-coaching' && shift.otherCoachingActivityId) {
    const activity = otherCoachingActivities.find((a) => a.id === shift.otherCoachingActivityId)
    if (activity?.coachId) {
      return coaches.find((c) => c.id === activity.coachId)
    }
  }
  return undefined
}

/** Stable keys for active shift and authorization issues (used for warning sounds). */
export function collectSchedulingIssueKeys(
  shifts: Shift[],
  participants: Participant[],
  coaches: Coach[],
  weekDates: string[],
  otherCoachingActivities: OtherCoachingActivity[] = [],
): Set<string> {
  const keys = new Set<string>()
  const participantMap = new Map(participants.map((p) => [p.id, p]))

  for (const shift of shifts) {
    const participant = shift.participantId
      ? participantMap.get(shift.participantId)
      : undefined
    const authorization = shift.authorizationId
      ? participant?.authorizations.find((a) => a.id === shift.authorizationId)
      : undefined
    const coach = resolveShiftCoach(shift, coaches, otherCoachingActivities)
    const dayKey = dayOfWeekFromDate(parseDateInput(shift.date))
    const conflicts = getShiftConflicts(
      shift,
      participant,
      authorization,
      coach,
      shifts,
      dayKey,
      weekDates,
    )
    const level = getShiftDisplayErrorLevel(conflicts)
    if (level === 'warning' || level === 'critical') {
      keys.add(
        shift.type === 'other-coaching'
          ? `other-coaching:${shift.id}`
          : `shift:${shift.id}`,
      )
    }
  }

  for (const participant of participants) {
    for (const auth of participant.authorizations) {
      if (authorizationHasAuthIssue(auth, participant.id, shifts)) {
        keys.add(`auth:${participant.id}:${auth.id}`)
      }
      if (authorizationHasHoursIssue(auth, shifts)) {
        keys.add(`hours:${participant.id}:${auth.id}`)
      }
    }
  }

  for (const coach of coaches) {
    for (const message of getCoachSidebarIssueMessages(coach, weekDates, shifts, participants)) {
      keys.add(`coach:${coach.id}:${message}`)
    }
  }

  return keys
}

export function formatHoursValue(hours: number): string {
  return String(Math.round(hours * 10) / 10)
}

export function getShiftMilestoneLabels(
  authorization: Authorization,
  shiftId: string,
  shifts: Shift[],
): string[] {
  const coachingOnly = isCoachingOnlyAuthorization(authorization)
  const ordered = shifts
    .filter((s) => s.authorizationId === authorization.id)
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
      authorization.workingHours > 0 &&
      workBefore < authorization.workingHours &&
      cumWork >= authorization.workingHours
    ) {
      labels.push('Last working shift')
    }

    if (
      s.type === 'coached' &&
      authorization.coachingHours > 0 &&
      coachedBefore < authorization.coachingHours &&
      cumCoached >= authorization.coachingHours
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
    (s) => s.coachId === coach.id && shiftUsesCoach(s) && weekDates.includes(s.date),
  )

  for (const shift of coachShifts) {
    const dayKey = dayOfWeekFromDate(parseDateInput(shift.date))
    const participant = shift.participantId
      ? participantMap.get(shift.participantId)
      : undefined
    const conflicts = getShiftConflicts(
      shift,
      participant,
      participant && shift.authorizationId
        ? participant.authorizations.find((a) => a.id === shift.authorizationId)
        : undefined,
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
        shiftUsesCoach(s) &&
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
    if (shift.type === 'other-coaching' && shift.otherCoachingActivityId) {
      copied.push({
        otherCoachingActivityId: shift.otherCoachingActivityId,
        date: newDate,
        startMinutes: shift.startMinutes,
        endMinutes: shift.endMinutes,
        type: shift.type,
        coachId: shift.coachId,
        notes: shift.notes,
      })
      continue
    }

    if (!shift.participantId) continue
    const participant = participants.find((p) => p.id === shift.participantId)
    if (!participant) continue

    const copy: Omit<Shift, 'id'> = {
      participantId: shift.participantId,
      authorizationId: shift.authorizationId,
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
    authorizationId: shift.authorizationId,
    date: shift.date,
    startMinutes: shift.startMinutes,
    endMinutes: midMinutes,
    type: 'coached',
    coachId: shift.type === 'coached' ? shift.coachId : undefined,
    notes: shift.notes,
  }

  const soloHalf: Omit<Shift, 'id'> = {
    participantId: shift.participantId,
    authorizationId: shift.authorizationId,
    date: shift.date,
    startMinutes: midMinutes,
    endMinutes: shift.endMinutes,
    type: 'solo',
  }

  return [coachedHalf, soloHalf]
}
