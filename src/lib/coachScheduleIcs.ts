import type { Coach, OtherCoachingActivity, Participant, Shift } from '../types'
import { shiftUsesCoach } from './scheduling'

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_') || 'coach'
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`)
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

/** Local wall-clock datetime for Outlook (no Z / floating). */
function toIcsLocalDateTime(date: string, minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const [y, m, d] = date.split('-')
  return `${y}${m}${d}T${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}00`
}

function toIcsUtcStamp(date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}

function eventForShift(
  shift: Shift,
  coach: Coach,
  participants: Participant[],
  activities: OtherCoachingActivity[],
  onCallPhone?: string,
): string[] | null {
  if (shift.didNotOccur) return null

  const description: string[] = []
  let summary = ''
  let location = ''

  if (shift.type === 'other-coaching') {
    const activity = shift.otherCoachingActivityId
      ? activities.find((a) => a.id === shift.otherCoachingActivityId)
      : undefined
    summary = activity?.name || 'Other coaching'
    description.push(`Assignment: ${summary}`)
    description.push('Type: Other coaching assignment')
    if (activity?.notes?.trim()) description.push(`Assignment notes: ${activity.notes.trim()}`)
    if (shift.notes?.trim()) description.push(`Shift notes: ${shift.notes.trim()}`)
  } else {
    const participant = shift.participantId
      ? participants.find((p) => p.id === shift.participantId)
      : undefined
    const name = participant?.name || 'Unnamed'
    const auth = shift.authorizationId
      ? participant?.authorizations.find((a) => a.id === shift.authorizationId)
      : undefined
    summary = [name, participant?.site, auth?.service].filter(Boolean).join(' · ')
    location = participant?.site || ''
    description.push(`Participant: ${name}`)
    if (participant?.site) description.push(`Site: ${participant.site}`)
    if (participant?.siteContact?.trim()) {
      description.push(`Site contact: ${participant.siteContact.trim()}`)
    }
    if (auth) description.push(`Service: ${auth.service}`)
    if (participant?.notes?.trim()) description.push(`Notes / risks: ${participant.notes.trim()}`)
    if (shift.notes?.trim()) description.push(`Notes: ${shift.notes.trim()}`)
  }

  if (onCallPhone?.trim()) description.push(`On call phone: ${onCallPhone.trim()}`)
  description.push(`Coach: ${coach.name || 'Unnamed'}`)

  const stamp = toIcsUtcStamp()
  return [
    'BEGIN:VEVENT',
    `UID:shift-${shift.id}@schedule-maker`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsLocalDateTime(shift.date, shift.startMinutes)}`,
    `DTEND:${toIcsLocalDateTime(shift.date, shift.endMinutes)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    `DESCRIPTION:${escapeIcsText(description.join('\n'))}`,
    'END:VEVENT',
  ]
}

export function buildCoachWeekScheduleIcs(
  coach: Coach,
  weekDates: string[],
  shifts: Shift[],
  participants: Participant[],
  otherCoachingActivities: OtherCoachingActivity[] = [],
  onCallPhone?: string,
): string {
  const weekShifts = shifts
    .filter(
      (s) =>
        shiftUsesCoach(s) &&
        s.coachId === coach.id &&
        weekDates.includes(s.date) &&
        !s.didNotOccur,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Maker//Coach Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${coach.name || 'Coach'} schedule`)}`,
  ]

  for (const shift of weekShifts) {
    const event = eventForShift(
      shift,
      coach,
      participants,
      otherCoachingActivities,
      onCallPhone,
    )
    if (event) lines.push(...event)
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

export function downloadCoachWeekScheduleIcs(
  coach: Coach,
  weekDates: string[],
  weekStart: string,
  shifts: Shift[],
  participants: Participant[],
  otherCoachingActivities: OtherCoachingActivity[] = [],
  onCallPhone?: string,
): boolean {
  const ics = buildCoachWeekScheduleIcs(
    coach,
    weekDates,
    shifts,
    participants,
    otherCoachingActivities,
    onCallPhone,
  )
  if (!ics.includes('BEGIN:VEVENT')) return false

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFilename(coach.name || 'coach')}_${weekStart}_schedule.ics`
  link.click()
  URL.revokeObjectURL(url)
  return true
}
