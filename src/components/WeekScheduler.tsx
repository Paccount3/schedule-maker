import { useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Coach, Shift } from '../types'
import { useStore } from '../store/useStore'
import { hexToRgba } from '../lib/colors'
import {
  formatShiftConflictSummary,
  formatHoursValue,
  getParticipantHoursForWeek,
  getShiftConflicts,
  getShiftErrorLevel,
  isCoachingOnlyParticipant,
  participantHasShiftOnDate,
} from '../lib/scheduling'
import { layoutDayShifts } from '../lib/shiftLayout'
import type { ShiftDragPreview } from '../lib/shiftDrag'
import {
  dayOfWeekFromDate,
  formatDayHeader,
  formatGridHour,
  formatWeekLabel,
  getWeekDates,
  CALENDAR_VIEW_END,
  CALENDAR_VIEW_START,
  parseDateInput,
  SLOT_MINUTES,
  todayDateInput,
} from '../lib/time'
import { ShiftEditor } from './ShiftEditor'
import { ShiftBlock } from './ShiftBlock'
import { ReportModeModal, defaultReportRange } from './ReportModeModal'

const MIN_HOUR_HEIGHT = 40
const GRID_HEADER_HEIGHT = 40
const HOUR_COUNT = (CALENDAR_VIEW_END - CALENDAR_VIEW_START) / 60

interface WeekSchedulerProps {
  selectedParticipantId: string
  visibleCoachIds: Set<string>
  visibleCoachShiftIds: Set<string>
  visibleParticipantIds: Set<string>
}

function hoursBetween(start: number, end: number): number[] {
  const hours: number[] = []
  for (let m = start; m < end; m += 60) {
    hours.push(m)
  }
  return hours
}

function visibleBlockLayout(
  startMinutes: number,
  endMinutes: number,
  hourHeight: number,
): { top: number; height: number } | null {
  const visibleStart = Math.max(startMinutes, CALENDAR_VIEW_START)
  const visibleEnd = Math.min(endMinutes, CALENDAR_VIEW_END)
  if (visibleEnd <= visibleStart) return null
  return {
    top: ((visibleStart - CALENDAR_VIEW_START) / 60) * hourHeight,
    height: ((visibleEnd - visibleStart) / 60) * hourHeight,
  }
}

function CoachAvailabilityOverlay({
  coach,
  date,
  hourHeight,
}: {
  coach: Coach
  date: string
  hourHeight: number
}) {
  const dayKey = dayOfWeekFromDate(parseDateInput(date))
  const avail = coach.availability[dayKey]
  if (!avail) return null

  const layout = visibleBlockLayout(avail.startMinutes, avail.endMinutes, hourHeight)
  if (!layout) return null

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 rounded-sm border border-dashed"
      style={{
        top: `${layout.top}px`,
        height: `${Math.max(layout.height, 4)}px`,
        backgroundColor: hexToRgba(coach.color, 0.08),
        borderColor: hexToRgba(coach.color, 0.35),
      }}
      title={`${coach.name} available`}
    />
  )
}

export function WeekScheduler({
  selectedParticipantId,
  visibleCoachIds,
  visibleCoachShiftIds,
  visibleParticipantIds,
}: WeekSchedulerProps) {
  const { state, prevWeek, nextWeek, goToToday, createQuickShift, updateShift, copyShiftsFromPreviousWeek } =
    useStore()
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [isNewShift, setIsNewShift] = useState(false)
  const [dragPreview, setDragPreview] = useState<ShiftDragPreview | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [hourHeight, setHourHeight] = useState(52)

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const reportRange = useMemo(() => defaultReportRange(state.weekStart), [state.weekStart])
  const hours = useMemo(
    () => hoursBetween(CALENDAR_VIEW_START, CALENDAR_VIEW_END),
    [],
  )

  const participant = state.participants.find((p) => p.id === selectedParticipantId)
  const participantMap = useMemo(
    () => new Map(state.participants.map((p) => [p.id, p])),
    [state.participants],
  )

  const visibleCoaches = useMemo(
    () => state.coaches.filter((c) => visibleCoachIds.has(c.id)),
    [state.coaches, visibleCoachIds],
  )

  const visibleShifts = useMemo(
    () =>
      state.shifts.filter(
        (s) =>
          weekDates.includes(s.date) &&
          visibleParticipantIds.has(s.participantId) &&
          (s.type !== 'coached' || !s.coachId || visibleCoachShiftIds.has(s.coachId)),
      ),
    [state.shifts, weekDates, visibleParticipantIds, visibleCoachShiftIds],
  )

  const hoursSummary = participant
    ? getParticipantHoursForWeek(participant, weekDates, state.shifts)
    : null

  const coachMap = useMemo(
    () => new Map(state.coaches.map((c) => [c.id, c])),
    [state.coaches],
  )

  useLayoutEffect(() => {
    const el = gridContainerRef.current
    if (!el) return

    const updateHeight = () => {
      const available = el.clientHeight - GRID_HEADER_HEIGHT
      setHourHeight(Math.max(MIN_HOUR_HEIGHT, Math.floor(available / HOUR_COUNT)))
    }

    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleCellClick = (date: string, hourMinutes: number) => {
    if (!participant || isDragging) return
    if (participantHasShiftOnDate(participant.id, date, state.shifts)) return

    const startMinutes = hourMinutes
    const endMinutes = Math.min(hourMinutes + 2 * 60, CALENDAR_VIEW_END)
    if (endMinutes <= startMinutes) return

    const shift = createQuickShift(participant.id, date, startMinutes, endMinutes, 'solo')
    setIsNewShift(true)
    setEditingShift(shift)
  }

  const applyShiftPreview = useCallback(
    (original: Shift, preview: ShiftDragPreview): Shift => {
      let date = preview.date
      const p = participantMap.get(original.participantId)

      if (date !== original.date) {
        if (
          participantHasShiftOnDate(original.participantId, date, state.shifts, original.id)
        ) {
          date = original.date
        } else if (p && (date < p.authStart || date > p.authEnd)) {
          date = original.date
        }
      }

      return {
        ...original,
        date,
        startMinutes: preview.startMinutes,
        endMinutes: preview.endMinutes,
      }
    },
    [participantMap, state.shifts],
  )

  const handleDragEnd = useCallback(
    (original: Shift, preview: ShiftDragPreview) => {
      updateShift(applyShiftPreview(original, preview))
      setDragPreview(null)
      setIsDragging(false)
    },
    [updateShift, applyShiftPreview],
  )

  const getDisplayShift = useCallback(
    (shift: Shift): Shift => {
      if (dragPreview?.shiftId !== shift.id) return shift
      return applyShiftPreview(shift, dragPreview)
    },
    [dragPreview, applyShiftPreview],
  )

  if (state.participants.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">
          Add a participant using <strong className="text-slate-200">+ Add</strong> in the sidebar
          to start scheduling.
        </p>
      </div>
    )
  }

  if (!participant) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">Select a participant from the sidebar.</p>
      </div>
    )
  }

  const gridBodyHeight = hours.length * hourHeight

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Week schedule</h2>
          <p className="text-xs text-slate-500">
            Adding shifts for{' '}
            <span className="font-medium text-blue-400">{participant.name || 'Unnamed'}</span>
            {participant.site ? ` · ${participant.site}` : ''}
          </p>
          {hoursSummary && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {!isCoachingOnlyParticipant(participant) && (
                <span className="rounded-full bg-slate-800 px-3 py-1 tabular-nums text-slate-300">
                  {participant.name}: {formatHoursValue(hoursSummary.totalWorkScheduled)}h work
                </span>
              )}
              <span className="rounded-full bg-violet-950/60 px-3 py-1 tabular-nums text-violet-300">
                {formatHoursValue(hoursSummary.coachedScheduled)}h coached
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => copyShiftsFromPreviousWeek()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            title="Copy all shifts from the previous week onto the same days this week"
          >
            Copy Shifts from Last Week
          </button>
          <button
            onClick={prevWeek}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Prev
          </button>
          <button
            onClick={goToToday}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            {formatWeekLabel(state.weekStart)}
          </button>
          <button
            onClick={nextWeek}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Next →
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Report Mode
          </button>
        </div>
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-slate-500 bg-slate-500/35" />
          Solo shift (no coach)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-violet-500 bg-violet-900/50" />
          Coached shift
        </span>
        {visibleCoaches.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded border border-dashed"
              style={{ backgroundColor: hexToRgba(c.color, 0.3), borderColor: c.color }}
            />
            {c.name} availability
          </span>
        ))}
        <span>Click an empty slot to add a shift · drag top/bottom to resize · drag center to move</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-amber-500 bg-amber-950/75" />
          Coach / scheduling issue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-red-500 bg-red-950/85" />
          Outside authorization
        </span>
      </div>

      <div
        ref={gridContainerRef}
        className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900 shadow-sm"
      >
        <div className="inline-flex min-w-full">
          <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800" style={{ height: GRID_HEADER_HEIGHT }} />
            {hours.map((m) => (
              <div
                key={m}
                className="border-b border-slate-800/50 pr-2 text-right text-xs text-slate-500"
                style={{ height: hourHeight }}
              >
                <span className="-mt-2 inline-block">{formatGridHour(m)}</span>
              </div>
            ))}
          </div>

          {weekDates.map((date) => {
            const dayShifts = visibleShifts
              .map(getDisplayShift)
              .filter((s) => s.date === date)
            const dayLayouts = layoutDayShifts(dayShifts)
            const isToday = date === todayDateInput()

            return (
              <div
                key={date}
                data-day-column={date}
                className="min-w-[140px] flex-1 border-r border-slate-800 last:border-r-0"
              >
                <div
                  className={`flex items-center justify-center border-b border-slate-800 text-xs font-medium ${
                    isToday ? 'bg-blue-950/50 text-blue-400' : 'bg-slate-900 text-slate-400'
                  }`}
                  style={{ height: GRID_HEADER_HEIGHT }}
                >
                  {formatDayHeader(date)}
                </div>

                <div className="relative" style={{ height: gridBodyHeight }}>
                  {visibleCoaches.map((coach) => (
                    <CoachAvailabilityOverlay
                      key={coach.id}
                      coach={coach}
                      date={date}
                      hourHeight={hourHeight}
                    />
                  ))}

                  {hours.map((m) => (
                    <div
                      key={m}
                      className="absolute w-full cursor-pointer border-b border-slate-800/30 hover:bg-blue-950/30"
                      style={{
                        top: ((m - CALENDAR_VIEW_START) / 60) * hourHeight,
                        height: hourHeight,
                      }}
                      onClick={() => handleCellClick(date, m)}
                    />
                  ))}

                  {hours.map((m) =>
                    m + SLOT_MINUTES < CALENDAR_VIEW_END ? (
                      <div
                        key={`half-${m}`}
                        className="absolute w-full cursor-pointer border-b border-dashed border-slate-800/20 hover:bg-blue-950/20"
                        style={{
                          top: ((m + SLOT_MINUTES - CALENDAR_VIEW_START) / 60) * hourHeight,
                          height: hourHeight / 2,
                        }}
                        onClick={() => handleCellClick(date, m + SLOT_MINUTES)}
                      />
                    ) : null,
                  )}

                  {dayShifts.map((shift) => {
                    const layout = dayLayouts.get(shift.id)
                    if (!layout) return null

                    const blockLayout = visibleBlockLayout(
                      shift.startMinutes,
                      shift.endMinutes,
                      hourHeight,
                    )
                    if (!blockLayout) return null

                    const original = state.shifts.find((s) => s.id === shift.id)!
                    const { top, height } = blockLayout
                    const coach = shift.coachId ? coachMap.get(shift.coachId) : undefined
                    const isCoached = shift.type === 'coached' && !!coach
                    const p = participantMap.get(shift.participantId)
                    const isSelected = shift.participantId === selectedParticipantId
                    const blockDragging = dragPreview?.shiftId === shift.id
                    const dayKey = dayOfWeekFromDate(parseDateInput(shift.date))
                    const conflicts = getShiftConflicts(
                      shift,
                      p,
                      coach,
                      state.shifts.map((s) =>
                        dragPreview?.shiftId === s.id ? { ...s, ...dragPreview } : s,
                      ),
                      dayKey,
                      weekDates,
                    )
                    const errorLevel = getShiftErrorLevel(conflicts)
                    const errorSummary = formatShiftConflictSummary(conflicts)

                    return (
                      <ShiftBlock
                        key={shift.id}
                        shift={shift}
                        layout={layout}
                        hourHeight={hourHeight}
                        top={top}
                        height={height}
                        participantName={p?.name || 'Participant'}
                        site={p?.site}
                        accentColor={isCoached ? coach!.color : '#64748b'}
                        coachName={coach?.name}
                        isCoached={isCoached}
                        isSelected={isSelected}
                        isDragging={blockDragging}
                        errorLevel={errorLevel}
                        errorSummary={errorSummary}
                        onEdit={() => {
                          setIsNewShift(false)
                          setEditingShift(original)
                        }}
                        onDragStart={() => setIsDragging(true)}
                        onDragPreview={setDragPreview}
                        onDragEnd={(preview) => handleDragEnd(original, preview)}
                        onDragCancel={() => {
                          setDragPreview(null)
                          setIsDragging(false)
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editingShift && (
        <ShiftEditor
          shift={editingShift}
          isNew={isNewShift}
          weekDates={weekDates}
          onClose={() => {
            setEditingShift(null)
            setIsNewShift(false)
          }}
        />
      )}

      {reportOpen && (
        <ReportModeModal
          defaultStart={reportRange.start}
          defaultEnd={reportRange.end}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
