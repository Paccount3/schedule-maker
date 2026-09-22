import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

import {
  MULTI_SHIFT_DAY_MESSAGE,
  formatHoursValue,
  type AuthorizationHoursDisplayLine,
  type ShiftErrorLevel,
} from '../lib/scheduling'

const DRAG_THRESHOLD_PX = 4
const POPUP_OFFSET = 14
const POPUP_WIDTH = 280
const HOVER_DELAY_MS = 700

interface ShiftBlockProps {
  shift: Shift
  layout: ShiftLayout
  hourHeight: number
  top: number
  height: number
  participantName: string
  participantPhone?: string
  site?: string
  accentColor: string
  coachName?: string
  coachPhone?: string
  isCoached: boolean
  isOtherCoaching?: boolean
  isSelected: boolean
  isDragging: boolean
  errorLevel?: ShiftErrorLevel
  multiShiftNotice?: boolean
  milestoneLabels?: string[]
  authorizationService?: string
  authorizationNumber?: string
  authorizationHoursLines?: AuthorizationHoursDisplayLine[]
  fullyScheduledLabel?: string
  errorSummary?: string
  hoursThisWeek?: number
  hoursRemainingAfterShift?: number
  onEdit: () => void
  onDragStart: () => void
  onDragPreview: (preview: ShiftDragPreview) => void
  onDragEnd: (preview: ShiftDragPreview) => void
  onDragCancel: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  readOnly?: boolean
}

type ShiftDetailContentProps = {
  shift: Shift
  participantName: string
  participantPhone?: string
  site?: string
  coachName?: string
  coachPhone?: string
  isCoached: boolean
  isOtherCoaching: boolean
  authorizationService?: string
  authorizationNumber?: string
  authorizationHoursLines: AuthorizationHoursDisplayLine[]
  hoursThisWeek?: number
  hoursRemainingAfterShift?: number
  milestoneLabels: string[]
  fullyScheduledLabel?: string
  errorLevel: ShiftErrorLevel
  errorSummary?: string
  multiShiftNotice: boolean
  compact: boolean
  fontSize?: number
  subFontSize?: number
  siteFontSize?: number
  detailFontSize?: number
  errorFontSize?: number
}

function ShiftDetailContent({
  shift,
  participantName,
  participantPhone,
  site,
  coachName,
  coachPhone,
  isCoached,
  isOtherCoaching,
  authorizationService,
  authorizationNumber,
  authorizationHoursLines,
  hoursThisWeek,
  hoursRemainingAfterShift,
  milestoneLabels,
  fullyScheduledLabel,
  errorLevel,
  errorSummary,
  multiShiftNotice,
  compact,
  fontSize,
  subFontSize,
  siteFontSize,
  detailFontSize,
  errorFontSize,
}: ShiftDetailContentProps) {
  const coachLabel = isOtherCoaching
    ? coachName || 'NO COACH'
    : isCoached && coachName
      ? coachName
      : 'NO COACH'
  const coachLine =
    coachPhone && (isOtherCoaching || (isCoached && coachName))
      ? `${coachLabel} · ${coachPhone}`
      : coachLabel

  return (
    <div
      className={compact ? 'pointer-events-none relative z-0 px-1.5 py-1' : 'space-y-1 px-1'}
      style={compact && fontSize ? { fontSize: `${fontSize}px` } : undefined}
    >
      <div className={compact ? 'truncate font-semibold' : 'text-sm font-semibold text-slate-100'}>
        {participantName}
      </div>
      <div className={compact ? 'truncate opacity-90' : 'text-sm text-slate-200'}>
        {formatMinutesRange(shift.startMinutes, shift.endMinutes)}
      </div>
      {!isOtherCoaching && authorizationService && (
        <div
          className={compact ? 'truncate opacity-85' : 'text-sm text-slate-300'}
          style={compact ? { fontSize: `${subFontSize}px` } : undefined}
        >
          {authorizationService}
          {authorizationNumber ? ` · Auth ${authorizationNumber}` : ''}
        </div>
      )}
      <div
        className={compact ? 'truncate opacity-80' : 'text-sm text-slate-300'}
        style={compact ? { fontSize: `${subFontSize}px` } : undefined}
      >
        {coachLine}
      </div>
      {site && (
        <div
          className={compact ? 'truncate opacity-70' : 'text-sm text-slate-400'}
          style={compact ? { fontSize: `${siteFontSize}px` } : undefined}
        >
          {site}
        </div>
      )}
      {participantPhone && !isOtherCoaching && (
        <div
          className={compact ? 'truncate opacity-70' : 'text-sm text-slate-400'}
          style={compact ? { fontSize: `${siteFontSize}px` } : undefined}
        >
          {participantPhone}
        </div>
      )}
      {hoursThisWeek !== undefined && (
        <div
          className={
            compact
              ? 'truncate tabular-nums opacity-80'
              : 'text-sm tabular-nums text-slate-200'
          }
          style={compact ? { fontSize: `${detailFontSize}px` } : undefined}
        >
          Hours this week scheduled: {formatHoursValue(hoursThisWeek)}
        </div>
      )}
      {hoursRemainingAfterShift !== undefined && (
        <div
          className={
            compact
              ? `truncate tabular-nums ${
                  hoursRemainingAfterShift <= 4
                    ? 'text-red-300/95'
                    : hoursRemainingAfterShift <= 10
                      ? 'text-amber-300/95'
                      : 'opacity-80'
                }`
              : `text-sm tabular-nums ${
                  hoursRemainingAfterShift <= 4
                    ? 'text-red-300'
                    : hoursRemainingAfterShift <= 10
                      ? 'text-amber-300'
                      : 'text-slate-200'
                }`
          }
          style={compact ? { fontSize: `${detailFontSize}px` } : undefined}
        >
          Hours remaining after this shift: {formatHoursValue(hoursRemainingAfterShift)}
        </div>
      )}
      {authorizationHoursLines.map((line) => (
        <div
          key={line.label}
          className={
            compact
              ? `truncate tabular-nums ${line.overLimit ? 'text-amber-300/95' : 'opacity-75'}`
              : `text-sm tabular-nums ${line.overLimit ? 'text-amber-300' : 'text-slate-300'}`
          }
          style={compact ? { fontSize: `${detailFontSize}px` } : undefined}
        >
          {line.label}
        </div>
      ))}
      {milestoneLabels.map((label) => (
        <div
          key={label}
          className={compact ? 'truncate text-sky-300/90' : 'text-sm text-sky-300'}
          style={compact ? { fontSize: `${detailFontSize}px` } : undefined}
        >
          {label}
        </div>
      ))}
      {fullyScheduledLabel && (
        <div
          className={
            compact
              ? 'mt-0.5 flex items-start gap-1 font-medium text-emerald-400'
              : 'flex items-start gap-1 text-sm font-medium text-emerald-400'
          }
          style={compact ? { fontSize: `${errorFontSize}px` } : undefined}
        >
          <span className="shrink-0 leading-none" aria-hidden>
            ✓
          </span>
          <span className="min-w-0 leading-tight drop-shadow-sm">{fullyScheduledLabel}</span>
        </div>
      )}
      {errorLevel !== 'none' && errorSummary && (
        <div
          className={
            compact
              ? 'mt-0.5 truncate font-medium opacity-90'
              : 'text-sm font-medium text-slate-100'
          }
          style={compact ? { fontSize: `${errorFontSize}px` } : undefined}
        >
          {compact
            ? errorSummary
                .split('\n')
                .filter((line) => line !== MULTI_SHIFT_DAY_MESSAGE)[0]
            : errorSummary
                .split('\n')
                .filter((line) => line !== MULTI_SHIFT_DAY_MESSAGE)
                .join(' · ')}
        </div>
      )}
      {multiShiftNotice && (
        <div
          className={
            compact
              ? 'mt-0.5 flex items-start gap-1 text-slate-400/90'
              : 'flex items-start gap-1 text-sm text-slate-400'
          }
          style={compact ? { fontSize: `${errorFontSize}px` } : undefined}
        >
          <span className="shrink-0 font-bold leading-none text-slate-500">!</span>
          <span className="min-w-0 leading-tight">{MULTI_SHIFT_DAY_MESSAGE}</span>
        </div>
      )}
    </div>
  )
}

function ShiftHoverPopup({
  x,
  y,
  accentColor,
  isCoached,
  errorLevel,
  children,
}: {
  x: number
  y: number
  accentColor: string
  isCoached: boolean
  errorLevel: ShiftErrorLevel
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + POPUP_OFFSET, top: y + POPUP_OFFSET })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x + POPUP_OFFSET
    let top = y + POPUP_OFFSET
    if (left + rect.width > window.innerWidth - 8) {
      left = Math.max(8, x - rect.width - POPUP_OFFSET)
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = Math.max(8, y - rect.height - POPUP_OFFSET)
    }
    setPos({ left, top })
  }, [x, y])

  const errorClass =
    errorLevel === 'critical'
      ? 'border-2 border-red-500 bg-red-950 text-red-50'
      : errorLevel === 'warning'
        ? 'border-2 border-amber-500 bg-amber-950 text-amber-50'
        : ''

  return createPortal(
    <div
      ref={ref}
      className={`pointer-events-none fixed z-[220] rounded-lg border p-3 shadow-2xl shadow-black/60 ${
        errorClass || 'border-slate-600 bg-slate-900 text-slate-100'
      }`}
      style={{
        left: pos.left,
        top: pos.top,
        width: POPUP_WIDTH,
        ...(errorLevel === 'none'
          ? {
              backgroundColor: '#0f172a',
              borderColor: isCoached ? accentColor : '#64748b',
              borderLeftWidth: 4,
            }
          : undefined),
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function ShiftBlock({
  shift,
  layout,
  hourHeight,
  top,
  height,
  participantName,
  participantPhone,
  site,
  accentColor,
  coachName,
  coachPhone,
  isCoached,
  isOtherCoaching = false,
  isSelected,
  isDragging,
  errorLevel = 'none',
  multiShiftNotice = false,
  milestoneLabels = [],
  authorizationService,
  authorizationNumber,
  authorizationHoursLines = [],
  fullyScheduledLabel,
  errorSummary,
  hoursThisWeek,
  hoursRemainingAfterShift,
  onEdit,
  onDragStart,
  onDragPreview,
  onDragEnd,
  onDragCancel,
  onContextMenu,
  readOnly = false,
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
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverReady, setHoverReady] = useState(false)
  const hoverTimerRef = useRef<number | null>(null)

  const clearHoverPopup = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoverReady(false)
    setHoverPos(null)
  }

  const scheduleHoverPopup = (x: number, y: number) => {
    setHoverPos({ x, y })
    if (hoverReady || hoverTimerRef.current !== null) return
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      setHoverReady(true)
    }, HOVER_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const pos = layoutStyle(layout)
  const blockHeight = Math.max(height, 22)
  const fontSize = shiftLabelFontSize(blockHeight)
  const subFontSize = Math.max(9, fontSize - 1)
  const errorFontSize = Math.max(9, fontSize - 2)
  const siteFontSize = Math.max(8, subFontSize - 2)
  const detailFontSize = Math.max(8, errorFontSize - 1)

  const errorClass =
    errorLevel === 'critical'
      ? 'z-20 border-2 border-red-500 bg-red-950/85 text-red-50'
      : errorLevel === 'warning'
        ? 'border-2 border-amber-500 bg-amber-950/75 text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]'
        : ''

  const useAccentStyle = errorLevel === 'none'
  const showHoverPopup = hoverReady && !!hoverPos && !isDragging

  const detailProps: ShiftDetailContentProps = {
    shift,
    participantName,
    participantPhone,
    site,
    coachName,
    coachPhone,
    isCoached,
    isOtherCoaching,
    authorizationService,
    authorizationNumber,
    authorizationHoursLines,
    hoursThisWeek,
    hoursRemainingAfterShift,
    milestoneLabels,
    fullyScheduledLabel,
    errorLevel,
    errorSummary,
    multiShiftNotice,
    compact: true,
    fontSize,
    subFontSize,
    siteFontSize,
    detailFontSize,
    errorFontSize,
  }

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
    if (readOnly || e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    clearHoverPopup()

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
      clearHoverPopup()
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
    <>
      <div
        onClick={
          readOnly
            ? (e) => {
                e.stopPropagation()
                onEdit()
              }
            : undefined
        }
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (readOnly) return
          onContextMenu?.(e)
        }}
        onPointerDown={readOnly ? undefined : handlePointerDown}
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : (e) => finishPointer(e, true)}
        onPointerCancel={readOnly ? undefined : (e) => finishPointer(e, false)}
        onMouseEnter={(e) => {
          if (isDragging || pointerRef.current?.dragging) return
          if (window.matchMedia('(hover: hover)').matches) {
            scheduleHoverPopup(e.clientX, e.clientY)
          }
        }}
        onMouseMove={(e) => {
          if (isDragging || pointerRef.current?.dragging) {
            clearHoverPopup()
            return
          }
          if (window.matchMedia('(hover: hover)').matches) {
            if (hoverReady) {
              setHoverPos({ x: e.clientX, y: e.clientY })
            } else {
              scheduleHoverPopup(e.clientX, e.clientY)
            }
          }
        }}
        onMouseLeave={() => clearHoverPopup()}
        className={`absolute select-none overflow-hidden rounded border text-left leading-snug shadow-sm ${
          readOnly ? 'cursor-pointer' : 'touch-none'
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
        {!readOnly && (
          <>
            <div className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize" aria-hidden />
            <div
              className="absolute inset-x-0 top-2 bottom-2 z-10 cursor-grab active:cursor-grabbing"
              aria-hidden
            />
          </>
        )}
        <ShiftDetailContent {...detailProps} compact />
      </div>

      {showHoverPopup && hoverPos && (
        <ShiftHoverPopup
          x={hoverPos.x}
          y={hoverPos.y}
          accentColor={accentColor}
          isCoached={isCoached}
          errorLevel={errorLevel}
        >
          <ShiftDetailContent {...detailProps} compact={false} />
        </ShiftHoverPopup>
      )}
    </>
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
