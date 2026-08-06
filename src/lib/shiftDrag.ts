import { SLOT_MINUTES, CALENDAR_VIEW_END, CALENDAR_VIEW_START } from './time'

export type ShiftDragMode = 'move' | 'resize-start' | 'resize-end'

export interface ShiftDragPreview {
  shiftId: string
  date: string
  startMinutes: number
  endMinutes: number
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

export function deltaYToMinutes(deltaY: number, hourHeight: number): number {
  return snapMinutes((deltaY / hourHeight) * 60)
}

export function getDragMode(clientY: number, blockTop: number, blockHeight: number): ShiftDragMode {
  const y = clientY - blockTop
  const handle = Math.min(6, Math.floor(blockHeight / 3))
  if (y <= handle) return 'resize-start'
  if (y >= blockHeight - handle) return 'resize-end'
  return 'move'
}

export function clampMoveShift(
  startMinutes: number,
  endMinutes: number,
  deltaMinutes: number,
): { startMinutes: number; endMinutes: number } {
  let start = startMinutes + deltaMinutes
  let end = endMinutes + deltaMinutes
  if (start < CALENDAR_VIEW_START) {
    end += CALENDAR_VIEW_START - start
    start = CALENDAR_VIEW_START
  }
  if (end > CALENDAR_VIEW_END) {
    start -= end - CALENDAR_VIEW_END
    end = CALENDAR_VIEW_END
  }
  start = snapMinutes(start)
  end = snapMinutes(end)
  if (end - start < SLOT_MINUTES) {
    end = start + SLOT_MINUTES
  }
  return { startMinutes: start, endMinutes: end }
}

export function clampResizeStart(
  startMinutes: number,
  endMinutes: number,
  deltaMinutes: number,
): number {
  let start = snapMinutes(startMinutes + deltaMinutes)
  start = Math.max(CALENDAR_VIEW_START, start)
  start = Math.min(start, endMinutes - SLOT_MINUTES)
  return start
}

export function clampResizeEnd(
  startMinutes: number,
  endMinutes: number,
  deltaMinutes: number,
): number {
  let end = snapMinutes(endMinutes + deltaMinutes)
  end = Math.min(CALENDAR_VIEW_END, end)
  end = Math.max(end, startMinutes + SLOT_MINUTES)
  return end
}

export function resolveDateFromPointer(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)?.closest('[data-day-column]')
  return (el as HTMLElement | undefined)?.dataset.dayColumn ?? null
}
