import type { Coach, OtherCoachingActivity, Participant, Shift } from '../types'
import { getAuthorizationById, isCoachingOnlyAuthorization } from './authorizations'
import {
  formatHoursValue,
  getShiftMilestoneLabels,
  shiftUsesCoach,
} from './scheduling'
import {
  durationHours,
  formatDayHeader,
  formatMinutesRange,
  parseDateInput,
} from './time'

const DIVIDER = '----------------------------------------'

export const SCHEDULE_GENERAL_ADVICE =
  'Participants and coaches: Please meet each other at the front of the site before proceeding into your shift. If the site contact is not indicated or present, inform site staff at the location that you are there working on an approved Goodwill trial or working interview. Do not begin working earlier than your schedule times or stay later. Always notify your employment specialist if your arrival or departure from your shift is different than scheduled. For any questions - contact your employment specialist.'

function appendScheduleGeneralAdvice(lines: string[]): void {
  lines.push('')
  lines.push(DIVIDER)
  lines.push('GENERAL ADVICE')
  lines.push(SCHEDULE_GENERAL_ADVICE)
}

function formatWeekHeading(weekStart: string): string {
  const start = parseDateInput(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const startStr = start.toLocaleDateString(undefined, opts)
  const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

function milestoneInstructions(
  labels: string[],
  perspective: 'participant' | 'coach' = 'participant',
): string[] {
  const lines: string[] = []
  for (const label of labels) {
    if (perspective === 'coach') {
      switch (label) {
        case 'First working shift':
          lines.push("This is the participant's first working shift.")
          break
        case 'First coaching shift':
          lines.push("This is the participant's first coached session.")
          break
        case 'Last working shift':
          lines.push("This is the participant's last working hours shift.")
          break
        case 'Last coaching shift':
          lines.push('Discuss report writing with your supervisor.')
          break
        default:
          lines.push(label)
      }
      continue
    }

    switch (label) {
      case 'First working shift':
        lines.push('This is your first working shift.')
        break
      case 'First coaching shift':
        lines.push('This is your first coached session.')
        break
      case 'Last working shift':
        lines.push(
          'Inform your employment specialist that you understand this is your last working shift.',
        )
        break
      case 'Last coaching shift':
        lines.push('Discuss additional coaching if needed.')
        break
      default:
        lines.push(label)
    }
  }
  return lines
}

export function participantIdsWithShiftsInWeek(
  shifts: Shift[],
  weekDates: string[],
  participantIds: Iterable<string>,
): string[] {
  const ids = new Set(participantIds)
  const withShifts = new Set<string>()
  for (const s of shifts) {
    if (weekDates.includes(s.date) && s.participantId && ids.has(s.participantId)) {
      withShifts.add(s.participantId)
    }
  }
  return [...withShifts]
}

export function coachIdsWithCoachedShiftsInWeek(
  shifts: Shift[],
  weekDates: string[],
  coachIds: Iterable<string>,
): string[] {
  const ids = new Set(coachIds)
  const withShifts = new Set<string>()
  for (const s of shifts) {
    if (
      weekDates.includes(s.date) &&
      shiftUsesCoach(s) &&
      s.coachId &&
      ids.has(s.coachId)
    ) {
      withShifts.add(s.coachId)
    }
  }
  return [...withShifts]
}

export function buildParticipantWeekScheduleWriteup(
  participant: Participant,
  weekDates: string[],
  weekStart: string,
  shifts: Shift[],
  coaches: Coach[],
): string {
  const coachMap = new Map(coaches.map((c) => [c.id, c]))
  const weekShifts = shifts
    .filter((s) => s.participantId === participant.id && weekDates.includes(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)

  const lines: string[] = []
  const name = participant.name || 'Unnamed'

  lines.push('YOUR SCHEDULE')
  lines.push('')
  lines.push(`Name: ${name}`)
  if (participant.site) lines.push(`Location: ${participant.site}`)
  if (participant.siteContact?.trim()) {
    lines.push(`Site contact: ${participant.siteContact.trim()}`)
  }
  const activeAuths = participant.authorizations.filter((a) => a.status === 'active')
  if (activeAuths.length === 1) {
    lines.push(`Service: ${activeAuths[0].service}`)
    lines.push(`Authorization: ${activeAuths[0].authNumber}`)
  } else if (participant.authorizations.length > 0) {
    lines.push(
      `Authorizations: ${participant.authorizations.map((a) => `${a.service} (${a.authNumber})`).join(', ')}`,
    )
  }
  lines.push(`Week: ${formatWeekHeading(weekStart)}`)
  lines.push('')

  if (weekShifts.length === 0) {
    lines.push('No shifts are scheduled for you this week.')
    appendScheduleGeneralAdvice(lines)
    return lines.join('\n')
  }

  lines.push(`You have ${weekShifts.length} shift${weekShifts.length === 1 ? '' : 's'} this week:`)
  lines.push('')

  weekShifts.forEach((shift, index) => {
    const day = formatDayHeader(shift.date)
    const time = formatMinutesRange(shift.startMinutes, shift.endMinutes)
    const hours = formatHoursValue(durationHours(shift.startMinutes, shift.endMinutes))
    const coach =
      shift.type === 'coached' && shift.coachId
        ? coachMap.get(shift.coachId)
        : undefined

    const shiftAuth = shift.authorizationId
      ? getAuthorizationById(participant, shift.authorizationId)
      : undefined

    if (index > 0) lines.push('')
    lines.push(DIVIDER)
    lines.push(`SHIFT ${index + 1} — ${day}`)
    lines.push(`When: ${time} (${hours} hour${hours === '1' ? '' : 's'})`)
    if (shiftAuth) {
      lines.push(`Service: ${shiftAuth.service}`)
      lines.push(`Authorization #: ${shiftAuth.authNumber}`)
    }

    if (shift.type === 'coached') {
      lines.push('Type: Coached session')
      lines.push('What to expect: Your coach will be with you for this shift.')
      if (participant.site) lines.push(`Site: ${participant.site}`)
      if (participant.siteContact?.trim()) {
        lines.push(`Site contact: ${participant.siteContact.trim()}`)
      }
      if (coach) {
        lines.push(`Coach: ${coach.name || 'Unnamed'}`)
        if (coach.phone?.trim()) lines.push(`Coach phone: ${coach.phone.trim()}`)
      } else {
        lines.push('Coach: To be assigned')
      }
    } else {
      lines.push('Type: Solo shift')
      lines.push('What to expect: You will work independently. No coach is scheduled.')
      if (participant.site) lines.push(`Site: ${participant.site}`)
      if (participant.siteContact?.trim()) {
        lines.push(`Site contact: ${participant.siteContact.trim()}`)
      }
    }

    const milestones = shiftAuth
      ? milestoneInstructions(getShiftMilestoneLabels(shiftAuth, shift.id, shifts))
      : ['This shift is not linked to an authorization.']
    for (const note of milestones) {
      lines.push(`Important: ${note}`)
    }

    if (shift.notes?.trim()) {
      lines.push(`Notes: ${shift.notes.trim()}`)
    }
  })

  lines.push('')
  lines.push(DIVIDER)
  lines.push('WEEKLY TOTALS')
  let totalWork = 0
  let totalCoached = 0
  for (const shift of weekShifts) {
    const h = durationHours(shift.startMinutes, shift.endMinutes)
    totalWork += h
    if (shift.type === 'coached') totalCoached += h
  }
  const hasNonCoachingOnly = weekShifts.some((s) => {
    const auth = s.authorizationId ? getAuthorizationById(participant, s.authorizationId) : undefined
    return auth && !isCoachingOnlyAuthorization(auth)
  })
  if (hasNonCoachingOnly) {
    lines.push(`Total work hours this week: ${formatHoursValue(totalWork)}`)
  }
  lines.push(`Coached hours this week: ${formatHoursValue(totalCoached)}`)

  appendScheduleGeneralAdvice(lines)

  return lines.join('\n')
}

export function buildCoachWeekScheduleWriteup(
  coach: Coach,
  weekDates: string[],
  weekStart: string,
  shifts: Shift[],
  participants: Participant[],
  otherCoachingActivities: OtherCoachingActivity[] = [],
): string {
  const participantMap = new Map(participants.map((p) => [p.id, p]))
  const activityMap = new Map(otherCoachingActivities.map((a) => [a.id, a]))
  const weekShifts = shifts
    .filter(
      (s) =>
        shiftUsesCoach(s) &&
        s.coachId === coach.id &&
        weekDates.includes(s.date),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)

  const lines: string[] = []
  const name = coach.name || 'Unnamed'

  lines.push('COACH SCHEDULE')
  lines.push('')
  lines.push(`Coach: ${name}`)
  if (coach.startingLocation) lines.push(`Base location: ${coach.startingLocation}`)
  if (coach.phone?.trim()) lines.push(`Phone: ${coach.phone.trim()}`)
  lines.push(`Week: ${formatWeekHeading(weekStart)}`)
  lines.push('')

  if (weekShifts.length === 0) {
    lines.push('No coached sessions or other coaching assignments are scheduled this week.')
    appendScheduleGeneralAdvice(lines)
    return lines.join('\n')
  }

  const coachedCount = weekShifts.filter((s) => s.type === 'coached').length
  const assignmentCount = weekShifts.filter((s) => s.type === 'other-coaching').length
  const summaryParts: string[] = []
  if (coachedCount > 0) {
    summaryParts.push(
      `${coachedCount} coached session${coachedCount === 1 ? '' : 's'}`,
    )
  }
  if (assignmentCount > 0) {
    summaryParts.push(
      `${assignmentCount} other coaching assignment${assignmentCount === 1 ? '' : 's'}`,
    )
  }
  lines.push(`You have ${summaryParts.join(' and ')} this week:`)
  lines.push('')

  let coachedHours = 0
  let otherCoachingHours = 0
  let sessionNum = 0
  let assignmentNum = 0
  weekShifts.forEach((shift, index) => {
    const p = shift.participantId ? participantMap.get(shift.participantId) : undefined
    const day = formatDayHeader(shift.date)
    const time = formatMinutesRange(shift.startMinutes, shift.endMinutes)
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    const hoursLabel = formatHoursValue(hours)

    if (index > 0) lines.push('')
    lines.push(DIVIDER)
    if (shift.type === 'other-coaching') {
      otherCoachingHours += hours
      assignmentNum++
      const activity = shift.otherCoachingActivityId
        ? activityMap.get(shift.otherCoachingActivityId)
        : undefined
      lines.push(`OTHER COACHING ASSIGNMENT ${assignmentNum} — ${day}`)
      lines.push(`When: ${time} (${hoursLabel} hour${hoursLabel === '1' ? '' : 's'})`)
      lines.push(`Assignment: ${activity?.name || 'Other coaching'}`)
      lines.push('Type: Other coaching assignment (not a participant session)')
      if (activity?.notes) lines.push(`Assignment notes: ${activity.notes}`)
      if (shift.notes?.trim()) lines.push(`Shift notes: ${shift.notes.trim()}`)
    } else {
      coachedHours += hours
      sessionNum++
      lines.push(`SESSION ${sessionNum} — ${day}`)
      lines.push(`When: ${time} (${hoursLabel} hour${hoursLabel === '1' ? '' : 's'})`)
      lines.push(`Participant: ${p?.name || 'Unnamed'}`)
      if (p?.site) lines.push(`Site: ${p.site}`)
      if (p?.siteContact?.trim()) lines.push(`Site contact: ${p.siteContact.trim()}`)
      const shiftAuth = shift.authorizationId
        ? p?.authorizations.find((a) => a.id === shift.authorizationId)
        : undefined
      if (shiftAuth) {
        lines.push(`Service: ${shiftAuth.service}`)
        lines.push(`Authorization #: ${shiftAuth.authNumber}`)
      }
      if (p && shiftAuth) {
        const milestones = milestoneInstructions(
          getShiftMilestoneLabels(shiftAuth, shift.id, shifts),
          'coach',
        )
        for (const note of milestones) {
          lines.push(`Important: ${note}`)
        }
      } else if (p) {
        lines.push('Important: Shift is not linked to an authorization.')
      }
      if (shift.notes?.trim()) lines.push(`Notes: ${shift.notes.trim()}`)
    }
  })

  lines.push('')
  lines.push(DIVIDER)
  lines.push('WEEKLY TOTALS')
  if (coachedCount > 0) {
    lines.push(`Participant coaching hours: ${formatHoursValue(coachedHours)}`)
  }
  if (assignmentCount > 0) {
    lines.push(`Other coaching assignment hours: ${formatHoursValue(otherCoachingHours)}`)
  }
  lines.push(
    `Total hours this week: ${formatHoursValue(coachedHours + otherCoachingHours)}`,
  )

  appendScheduleGeneralAdvice(lines)

  return lines.join('\n')
}
