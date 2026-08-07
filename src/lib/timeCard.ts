import type { Participant, Shift } from '../types'
import {
  addDaysToDateInput,
  durationHours,
  formatMinutes,
  getWeekDates,
  parseDateInput,
  toDateInput,
  weekStartForDate,
} from './time'

export const DEFAULT_WAGE_RATE = 16.94

function splitCheckAddress(address: string): { address1: string; address2: string } {
  const lines = address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return { address1: '', address2: '' }
  if (lines.length === 1) return { address1: lines[0], address2: '' }
  return { address1: lines[0], address2: lines.slice(1).join(', ') }
}

export interface TimeCardDayEntry {
  date: string
  dayLabel: string
  dateLabel: string
  inTime: string
  outTime: string
  hours: number
  payAmount: number
}

export interface WeeklyTimeCardData {
  weekStart: string
  weekEnding: string
  weekLabel: string
  cardNumber: string
  weekIndex: number
  weekCount: number
  name: string
  days: TimeCardDayEntry[]
  hoursTotal: number
  payTotal: number
}

export interface CheckRequestFormData {
  formDate: string
  amount: number
  name: string
  address1: string
  address2: string
  service: string
  authNumber: string
  wageRate: number
  totalHours: number
  reason: string
  returnCheckTo: string
  voucherNo: string
  chargeAccount: string
  requestedBy: string
  requestedBySignature: string
  mailByDate: string
}

export interface TimeCardBundle {
  checkRequest: CheckRequestFormData
  weeklyCards: WeeklyTimeCardData[]
}

const DAY_ABBR = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.']

function formatShortDate(dateStr: string): string {
  const d = parseDateInput(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function formatWeekEnding(weekStart: string): string {
  return formatShortDate(addDaysToDateInput(weekStart, 6))
}

export function buildWeekLabel(weekStart: string): string {
  const dates = getWeekDates(weekStart)
  return `Week of ${formatShortDate(dates[0])} – ${formatShortDate(dates[6])}`
}

function shiftsForDate(shifts: Shift[], participantId: string, date: string): Shift[] {
  return shifts
    .filter((s) => s.participantId === participantId && s.date === date)
    .sort((a, b) => a.startMinutes - b.startMinutes)
}

function dayEntryFromShifts(
  date: string,
  dayIndex: number,
  participantShifts: Shift[],
  wageRate: number,
): TimeCardDayEntry {
  if (participantShifts.length === 0) {
    return {
      date,
      dayLabel: DAY_ABBR[dayIndex],
      dateLabel: formatShortDate(date),
      inTime: '',
      outTime: '',
      hours: 0,
      payAmount: 0,
    }
  }

  const hours = participantShifts.reduce(
    (sum, s) => sum + durationHours(s.startMinutes, s.endMinutes),
    0,
  )
  const roundedHours = Math.round(hours * 100) / 100
  const payAmount = Math.round(roundedHours * wageRate * 100) / 100

  return {
    date,
    dayLabel: DAY_ABBR[dayIndex],
    dateLabel: formatShortDate(date),
    inTime: formatMinutes(participantShifts[0].startMinutes),
    outTime: formatMinutes(participantShifts[participantShifts.length - 1].endMinutes),
    hours: roundedHours,
    payAmount,
  }
}

function weeksOverlappingRange(startDate: string, endDate: string): string[] {
  const weeks: string[] = []
  let weekStart = weekStartForDate(startDate)
  const rangeEnd = parseDateInput(endDate).getTime()

  while (parseDateInput(weekStart).getTime() <= rangeEnd) {
    weeks.push(weekStart)
    weekStart = addDaysToDateInput(weekStart, 7)
  }

  return weeks
}

export function buildWeeklyTimeCard(
  participant: Participant,
  weekStart: string,
  shifts: Shift[],
  wageRate: number,
  cardNumber: string,
  weekIndex: number,
  weekCount: number,
): WeeklyTimeCardData {
  const weekDates = getWeekDates(weekStart)
  const days = weekDates.map((date, i) =>
    dayEntryFromShifts(date, i, shiftsForDate(shifts, participant.id, date), wageRate),
  )
  const hoursTotal = Math.round(days.reduce((sum, d) => sum + d.hours, 0) * 100) / 100
  const payTotal = Math.round(days.reduce((sum, d) => sum + d.payAmount, 0) * 100) / 100

  return {
    weekStart,
    weekEnding: formatWeekEnding(weekStart),
    weekLabel: buildWeekLabel(weekStart),
    cardNumber,
    weekIndex,
    weekCount,
    name: participant.name || 'Unnamed',
    days,
    hoursTotal,
    payTotal,
  }
}

export function buildCheckRequestReason(
  service: string,
  wageRate: number,
  totalHours: number,
  amount: number,
): string {
  return `${service} Wages ${wageRate.toFixed(2)} x ${totalHours.toFixed(2)} hours = $${amount.toFixed(2)}`
}

export function buildTimeCardBundle(
  participant: Participant,
  shifts: Shift[],
  startDate: string,
  endDate: string,
  wageRate = DEFAULT_WAGE_RATE,
): TimeCardBundle {
  const participantShifts = shifts.filter(
    (s) =>
      s.participantId === participant.id &&
      s.date >= startDate &&
      s.date <= endDate,
  )

  const weekStarts = weeksOverlappingRange(startDate, endDate)
  const weekCount = Math.max(weekStarts.length, 1)
  const weeklyCards = (
    weekStarts.length > 0 ? weekStarts : [weekStartForDate(startDate)]
  ).map((ws, i) =>
    buildWeeklyTimeCard(
      participant,
      ws,
      participantShifts,
      wageRate,
      String(i + 1),
      i + 1,
      weekCount,
    ),
  )

  const totalHours = Math.round(
    weeklyCards.reduce((sum, c) => sum + c.hoursTotal, 0) * 100,
  ) / 100
  const amount = Math.round(weeklyCards.reduce((sum, c) => sum + c.payTotal, 0) * 100) / 100
  const participantName = participant.name || 'Unnamed'
  const { address1, address2 } = splitCheckAddress(participant.bestAddressForChecks ?? '')

  const checkRequest: CheckRequestFormData = {
    formDate: formatShortDate(endDate),
    amount,
    name: participantName,
    address1,
    address2,
    service: participant.service,
    authNumber: participant.authNumber,
    wageRate,
    totalHours,
    reason: buildCheckRequestReason(participant.service, wageRate, totalHours, amount),
    returnCheckTo: '',
    voucherNo: '',
    chargeAccount: '',
    requestedBy: '',
    requestedBySignature: '',
    mailByDate: 'ASAP',
  }

  return { checkRequest, weeklyCards }
}

export function recalculateWeeklyCard(
  card: WeeklyTimeCardData,
  wageRate: number,
): WeeklyTimeCardData {
  const days = card.days.map((day) => {
    const payAmount = Math.round(day.hours * wageRate * 100) / 100
    return { ...day, payAmount }
  })
  return {
    ...card,
    days,
    hoursTotal: Math.round(days.reduce((sum, d) => sum + d.hours, 0) * 100) / 100,
    payTotal: Math.round(days.reduce((sum, d) => sum + d.payAmount, 0) * 100) / 100,
  }
}

export function recalculateTimeCardBundle(bundle: TimeCardBundle): TimeCardBundle {
  const wageRate = bundle.checkRequest.wageRate
  const weeklyCards = bundle.weeklyCards.map((c) => recalculateWeeklyCard(c, wageRate))
  const totalHours = Math.round(
    weeklyCards.reduce((sum, c) => sum + c.hoursTotal, 0) * 100,
  ) / 100
  const amount = Math.round(weeklyCards.reduce((sum, c) => sum + c.payTotal, 0) * 100) / 100

  return {
    weeklyCards,
    checkRequest: {
      ...bundle.checkRequest,
      totalHours,
      amount,
      reason: buildCheckRequestReason(
        bundle.checkRequest.service,
        wageRate,
        totalHours,
        amount,
      ),
    },
  }
}

export function applyCheckRequestHoursEdit(
  bundle: TimeCardBundle,
  totalHours: number,
): TimeCardBundle {
  const wageRate = bundle.checkRequest.wageRate
  const amount = Math.round(totalHours * wageRate * 100) / 100
  return {
    ...bundle,
    checkRequest: {
      ...bundle.checkRequest,
      totalHours,
      amount,
      reason: buildCheckRequestReason(
        bundle.checkRequest.service,
        wageRate,
        totalHours,
        amount,
      ),
    },
  }
}

export function combinedTimeCardTotals(cards: WeeklyTimeCardData[]): {
  totalHours: number
  totalPay: number
} {
  const totalHours = Math.round(cards.reduce((sum, c) => sum + c.hoursTotal, 0) * 100) / 100
  const totalPay = Math.round(cards.reduce((sum, c) => sum + c.payTotal, 0) * 100) / 100
  return { totalHours, totalPay }
}

export function todayFormatted(): string {
  return formatShortDate(toDateInput(new Date()))
}
