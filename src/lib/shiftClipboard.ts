import type { Shift } from '../types'
import { CALENDAR_VIEW_END, CALENDAR_VIEW_START } from './time'

export type ShiftClipboardData = Omit<Shift, 'id' | 'date'>

export function shiftToClipboard(shift: Shift): ShiftClipboardData {
  return {
    participantId: shift.participantId,
    otherCoachingActivityId: shift.otherCoachingActivityId,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    type: shift.type,
    coachId: shift.coachId,
    notes: shift.notes,
  }
}

export function clipboardShiftAt(
  data: ShiftClipboardData,
  date: string,
  startMinutes: number,
): Omit<Shift, 'id'> {
  const duration = data.endMinutes - data.startMinutes
  let start = startMinutes
  let end = start + duration

  if (end > CALENDAR_VIEW_END) {
    end = CALENDAR_VIEW_END
    start = Math.max(CALENDAR_VIEW_START, end - duration)
  }
  start = Math.max(CALENDAR_VIEW_START, start)
  end = Math.min(CALENDAR_VIEW_END, end)

  return {
    ...data,
    date,
    startMinutes: start,
    endMinutes: end,
  }
}
