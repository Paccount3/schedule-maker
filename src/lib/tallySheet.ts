import type { Coach, Participant, ParticipantService, Shift } from '../types'
import { durationHours, parseDateInput, toDateInput } from './time'

export interface TallySheetHourRow {
  date: string
  dateLabel: string
  hours: number
}

export interface TallySheetStaffRow {
  date: string
  dateLabel: string
  hours: number | null
}

export interface TallySheetUnitRow {
  date: string
  dateLabel: string
  units: number
}

export interface TallySheetData {
  authNumber: string
  serviceLabel: string
  consumerName: string
  staffName: string
  dorsCounselor: string
  periodFrom: string
  periodTo: string
  periodFromLabel: string
  periodToLabel: string
  consumerWages: TallySheetHourRow[]
  consumerWagesTotal: number
  staffEvaluator: TallySheetStaffRow[]
  staffEvaluatorTotal: number
  comprehensiveReport: TallySheetUnitRow[]
  comprehensiveReportTotal: number
}

const SERVICE_TALLY_LABELS: Record<ParticipantService, string> = {
  TWE: 'Trial Work Experience',
  WA: 'Work Adjustment',
  CPO: 'Community Placement Opportunity',
  JC: 'Job Coaching',
  'LVL UP': 'Level Up',
  Module: 'Module',
  Orientation: 'Orientation',
  Other: 'Other',
}

function formatShortDate(dateStr: string): string {
  const d = parseDateInput(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

export function formatTallyDate(dateStr: string): string {
  return formatShortDate(dateStr)
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}

function hoursByDate(
  shifts: Shift[],
  participantId: string,
  startDate: string,
  endDate: string,
  filter?: (shift: Shift) => boolean,
): Map<string, number> {
  const map = new Map<string, number>()

  for (const shift of shifts) {
    if (shift.participantId !== participantId) continue
    if (shift.date < startDate || shift.date > endDate) continue
    if (filter && !filter(shift)) continue
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    map.set(shift.date, (map.get(shift.date) ?? 0) + hours)
  }

  return map
}

function primaryCoachName(
  shifts: Shift[],
  coaches: Coach[],
  participantId: string,
  startDate: string,
  endDate: string,
): string {
  const hoursByCoach = new Map<string, number>()

  for (const shift of shifts) {
    if (shift.participantId !== participantId || shift.type !== 'coached' || !shift.coachId) {
      continue
    }
    if (shift.date < startDate || shift.date > endDate) continue
    const hours = durationHours(shift.startMinutes, shift.endMinutes)
    hoursByCoach.set(shift.coachId, (hoursByCoach.get(shift.coachId) ?? 0) + hours)
  }

  let bestCoachId = ''
  let bestHours = 0
  for (const [coachId, hours] of hoursByCoach) {
    if (hours > bestHours) {
      bestHours = hours
      bestCoachId = coachId
    }
  }

  return coaches.find((coach) => coach.id === bestCoachId)?.name ?? ''
}

export function serviceTallyLabel(service: ParticipantService): string {
  return SERVICE_TALLY_LABELS[service] ?? service
}

export function recalculateTallySheet(data: TallySheetData): TallySheetData {
  const consumerWagesTotal = roundHours(
    data.consumerWages.reduce((sum, row) => sum + row.hours, 0),
  )
  const staffEvaluatorTotal = roundHours(
    data.staffEvaluator.reduce((sum, row) => sum + (row.hours ?? 0), 0),
  )
  const comprehensiveReportTotal = roundHours(
    data.comprehensiveReport.reduce((sum, row) => sum + row.units, 0),
  )

  return {
    ...data,
    consumerWagesTotal,
    staffEvaluatorTotal,
    comprehensiveReportTotal,
  }
}

export function buildTallySheet(
  participant: Participant,
  shifts: Shift[],
  coaches: Coach[],
  startDate: string,
  endDate: string,
): TallySheetData {
  const consumerByDate = hoursByDate(shifts, participant.id, startDate, endDate)
  const staffByDate = hoursByDate(
    shifts,
    participant.id,
    startDate,
    endDate,
    (shift) => shift.type === 'coached' && !!shift.coachId,
  )

  const sortedDates = [...consumerByDate.keys()].sort()

  const consumerWages: TallySheetHourRow[] = sortedDates.map((date) => ({
    date,
    dateLabel: formatShortDate(date),
    hours: roundHours(consumerByDate.get(date) ?? 0),
  }))

  const staffEvaluator: TallySheetStaffRow[] = sortedDates.map((date) => {
    const hours = staffByDate.get(date)
    return {
      date,
      dateLabel: formatShortDate(date),
      hours: hours && hours > 0 ? roundHours(hours) : null,
    }
  })

  const comprehensiveReport: TallySheetUnitRow[] =
    sortedDates.length > 0
      ? [{ date: endDate, dateLabel: formatShortDate(endDate), units: 1 }]
      : []

  return recalculateTallySheet({
    authNumber: participant.authNumber,
    serviceLabel: serviceTallyLabel(participant.service),
    consumerName: participant.name || 'Unnamed',
    staffName: primaryCoachName(shifts, coaches, participant.id, startDate, endDate),
    dorsCounselor: '',
    periodFrom: startDate,
    periodTo: endDate,
    periodFromLabel: formatShortDate(startDate),
    periodToLabel: formatShortDate(endDate),
    consumerWages,
    consumerWagesTotal: 0,
    staffEvaluator,
    staffEvaluatorTotal: 0,
    comprehensiveReport,
    comprehensiveReportTotal: 0,
  })
}

export function createEmptyHourRow(date = toDateInput(new Date())): TallySheetHourRow {
  return { date, dateLabel: formatShortDate(date), hours: 0 }
}

export function createEmptyStaffRow(date = toDateInput(new Date())): TallySheetStaffRow {
  return { date, dateLabel: formatShortDate(date), hours: null }
}

export function createEmptyUnitRow(date = toDateInput(new Date())): TallySheetUnitRow {
  return { date, dateLabel: formatShortDate(date), units: 0 }
}

export function updateRowDate<T extends { date: string; dateLabel: string }>(
  row: T,
  date: string,
): T {
  return { ...row, date, dateLabel: formatShortDate(date) }
}
