import type { Coach, Participant, Shift } from '../types'
import {
  formatHoursValue,
  getParticipantHoursForWeek,
  getShiftMilestoneLabels,
  isCoachingOnlyParticipant,
} from './scheduling'
import {
  durationHours,
  formatDayHeader,
  formatMinutesRange,
  parseDateInput,
} from './time'

const DIVIDER = '----------------------------------------'

function formatWeekHeading(weekStart: string): string {
  const start = parseDateInput(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const startStr = start.toLocaleDateString(undefined, opts)
  const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

function milestoneInstructions(labels: string[]): string[] {
  const lines: string[] = []
  for (const label of labels) {
    switch (label) {
      case 'First working shift':
        lines.push('This is your first working shift.')
        break
      case 'First coaching shift':
        lines.push('This is your first coached session.')
        break
      case 'Last working shift':
        lines.push('This is your last working shift.')
        break
      case 'Last coaching shift':
        lines.push('This is your last coached session.')
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
    if (weekDates.includes(s.date) && ids.has(s.participantId)) {
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
      s.type === 'coached' &&
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
  lines.push(`Service: ${participant.service}`)
  lines.push(`Week: ${formatWeekHeading(weekStart)}`)
  lines.push('')

  if (weekShifts.length === 0) {
    lines.push('No shifts are scheduled for you this week.')
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

    if (index > 0) lines.push('')
    lines.push(DIVIDER)
    lines.push(`SHIFT ${index + 1} — ${day}`)
    lines.push(`When: ${time} (${hours} hour${hours === '1' ? '' : 's'})`)

    if (shift.type === 'coached') {
      lines.push('Type: Coached session')
      lines.push('What to expect: Your coach will be with you for this shift.')
      if (coach) {
        lines.push(`Coach: ${coach.name || 'Unnamed'}`)
        if (coach.phone?.trim()) lines.push(`Coach phone: ${coach.phone.trim()}`)
      } else {
        lines.push('Coach: To be assigned')
      }
    } else {
      lines.push('Type: Solo shift')
      lines.push('What to expect: You will work independently. No coach is scheduled.')
    }

    const milestones = milestoneInstructions(
      getShiftMilestoneLabels(participant, shift.id, shifts),
    )
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
  const weekHours = getParticipantHoursForWeek(participant, weekDates, shifts)
  if (isCoachingOnlyParticipant(participant)) {
    lines.push(`Coached hours this week: ${formatHoursValue(weekHours.coachedScheduled)}`)
  } else {
    lines.push(`Total work hours this week: ${formatHoursValue(weekHours.totalWorkScheduled)}`)
    lines.push(`Coached hours this week: ${formatHoursValue(weekHours.coachedScheduled)}`)
  }

  lines.push('')
  lines.push('Please arrive on time for each shift. Contact your coordinator if you need to make changes.')

  return lines.join('\n')
}

export function buildCoachWeekScheduleWriteup(
  coach: Coach,
  weekDates: string[],
  weekStart: string,
  shifts: Shift[],
  participants: Participant[],
): string {
  const participantMap = new Map(participants.map((p) => [p.id, p]))
  const weekShifts = shifts
    .filter(
      (s) =>
        s.type === 'coached' &&
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
    lines.push('No coached shifts are scheduled this week.')
    return lines.join('\n')
  }

  lines.push(
    `You have ${weekShifts.length} coached session${weekShifts.length === 1 ? '' : 's'} this week:`,
  )
  lines.push('')

  let totalHours = 0
  weekShifts.forEach((shift, index) => {
    const p = participantMap.get(shift.participantId)
    const day = formatDayHeader(shift.date)
    const time = formatMinutesRange(shift.startMinutes, shift.endMinutes)
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    totalHours += hours
    const hoursLabel = formatHoursValue(hours)

    if (index > 0) lines.push('')
    lines.push(DIVIDER)
    lines.push(`SESSION ${index + 1} — ${day}`)
    lines.push(`When: ${time} (${hoursLabel} hour${hoursLabel === '1' ? '' : 's'})`)
    lines.push(`Participant: ${p?.name || 'Unnamed'}`)
    if (p?.site) lines.push(`Site: ${p.site}`)
    if (p?.service) lines.push(`Service: ${p.service}`)
    if (shift.notes?.trim()) lines.push(`Notes: ${shift.notes.trim()}`)
  })

  lines.push('')
  lines.push(DIVIDER)
  lines.push('WEEKLY TOTALS')
  lines.push(`Total coached hours this week: ${formatHoursValue(totalHours)}`)

  return lines.join('\n')
}
