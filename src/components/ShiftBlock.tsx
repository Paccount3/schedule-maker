import { useRef } from 'react'
import type { Shift } from '../types'
import { coachShiftStyle, shiftLabelFontSize, soloShiftStyle } from '../lib/colors'
import { formatMinutesRange } from '../lib/time'
import type { ShiftLayout } from '../lib/shiftLayout'
import { layoutStyle } from '../lib/shiftLayout'
import {
  clampMoveShift,
  clampResizeEnd,
  clampResizeStart,
  deltaYToMinutes,
  getDragMode,
  type ShiftDragMode,
  type ShiftDragPreview,
} from '../lib/shiftDrag'

import type { ShiftErrorLevel } from '../lib/scheduling'

const DRAG_THRESHOLD_PX = 4

interface ShiftBlockProps {
  shift: Shift
  layout: ShiftLayout
  hourHeight: number
  top: number
  height: number
  participantName: string
  accentColor: string
  coachName?: string
  isCoached: boolean
  isSelected: boolean
  isDragging: boolean
  errorLevel?: ShiftErrorLevel
  errorSummary?: string
  onEdit: () => void
  onDragStart: () => void
  onDragPreview: (preview: ShiftDragPreview) => void
  onDragEnd: (preview: ShiftDragPreview) => void
  onDragCancel: () => void
}

export function ShiftBlock({
  shift,
  layout,
  hourHeight,
  top,
  height,
  participantName,
  accentColor,
  coachName,
  isCoached,
  isSelected,
  isDragging,
  errorLevel = 'none',
  errorSummary,
  onEdit,
  onDragStart,
  onDragPreview,
  onDragEnd,
  onDragCancel,
}: ShiftBlockProps) {
  const pointerRef = useRef<{
    mode: ShiftDragMode
    startX: number
    startY: number
    originDate: string
    originStart: number
    originEnd: number
    dragging: boolean
  } | null>(null)

  const pos = layoutStyle(layout)
  const blockHeight = Math.max(height, 22)
  const fontSize = shiftLabelFontSize(blockHeight)
  const subFontSize = Math.max(9, fontSize - 1)
  const errorFontSize = Math.max(9, fontSize - 2)

  const errorClass =
    errorLevel === 'critical'
      ? 'z-20 border-2 border-red-500 bg-red-950/85 text-red-50'
      : errorLevel === 'warning'
        ? 'border-2 border-amber-500 bg-amber-950/75 text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]'
        : ''

  const useAccentStyle = errorLevel === 'none'

  const buildPreview = (
    ptr: NonNullable<typeof pointerRef.current>,
    clientX: number,
    clientY: number,
  ): ShiftDragPreview => {
    const deltaMinutes = deltaYToMinutes(clientY - ptr.startY, hourHeight)

    if (ptr.mode === 'move') {
      const { startMinutes, endMinutes } = clampMoveShift(
        ptr.originStart,
        ptr.originEnd,
        deltaMinutes,
      )
      const date = resolveDateFromPointer(clientX, clientY, ptr.originDate)
      return { shiftId: shift.id, date, startMinutes, endMinutes }
    }

    if (ptr.mode === 'resize-start') {
      return {
        shiftId: shift.id,
        date: ptr.originDate,
        startMinutes: clampResizeStart(ptr.originStart, ptr.originEnd, deltaMinutes),
        endMinutes: ptr.originEnd,
      }
    }

    return {
      shiftId: shift.id,
      date: ptr.originDate,
      startMinutes: ptr.originStart,
      endMinutes: clampResizeEnd(ptr.originStart, ptr.originEnd, deltaMinutes),
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    const rect = e.currentTarget.getBoundingClientRect()
    const mode = getDragMode(e.clientY, rect.top, rect.height)

    pointerRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originDate: shift.date,
      originStart: shift.startMinutes,
      originEnd: shift.endMinutes,
      dragging: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = pointerRef.current
    if (!ptr) return

    const dx = e.clientX - ptr.startX
    const dy = e.clientY - ptr.startY

    if (!ptr.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
      ptr.dragging = true
      onDragStart()
    }

    e.preventDefault()
    e.stopPropagation()
    onDragPreview(buildPreview(ptr, e.clientX, e.clientY))
  }

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const ptr = pointerRef.current
    if (!ptr) return

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (!ptr.dragging) {
      onEdit()
    } else if (commit) {
      onDragEnd(buildPreview(ptr, e.clientX, e.clientY))
    } else {
      onDragCancel()
    }

    pointerRef.current = null
  }

  return (
    <div
      title={errorSummary}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishPointer(e, true)}
      onPointerCancel={(e) => finishPointer(e, false)}
      className={`absolute touch-none select-none overflow-hidden rounded border text-left leading-snug shadow-sm ${
        errorLevel === 'none' ? '' : ''
      } ${errorClass} ${isSelected ? 'ring-1 ring-blue-400 ring-offset-1 ring-offset-slate-900' : ''} ${
        isDragging ? 'z-30 opacity-90 shadow-lg' : errorLevel === 'critical' ? '' : 'z-10 hover:z-20'
      }`}
      style={{
        top: `${top}px`,
        height: `${blockHeight}px`,
        left: pos.left,
        width: pos.width,
        fontSize: `${fontSize}px`,
        ...(useAccentStyle
          ? isCoached
            ? coachShiftStyle(accentColor)
            : soloShiftStyle()
          : undefined),
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize" aria-hidden />
      <div className="absolute inset-x-0 top-2 bottom-2 z-10 cursor-grab active:cursor-grabbing" aria-hidden />
      <div className="pointer-events-none relative z-0 px-1.5 py-1">
        <div className="truncate font-semibold">{participantName}</div>
        <div className="truncate opacity-90">
          {formatMinutesRange(shift.startMinutes, shift.endMinutes)}
        </div>
        <div className="truncate opacity-80" style={{ fontSize: `${subFontSize}px` }}>
          {isCoached && coachName ? coachName : 'NO COACH'}
        </div>
        {errorLevel !== 'none' && errorSummary && (
          <div
            className="mt-0.5 truncate font-medium opacity-90"
            style={{ fontSize: `${errorFontSize}px` }}
          >
            {errorSummary.split('\n')[0]}
          </div>
        )}
      </div>
    </div>
  )
}

function resolveDateFromPointer(
  clientX: number,
  clientY: number,
  fallback: string,
): string {
  const el = document.elementFromPoint(clientX, clientY)?.closest('[data-day-column]')
  return (el as HTMLElement | undefined)?.dataset.dayColumn ?? fallback
}
