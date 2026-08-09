import { useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Coach, Shift } from '../types'
import { useStore } from '../store/useStore'
import { hexToRgba } from '../lib/colors'
import { resolveSelectedAuthorization, isAuthorizationSchedulable, isCoachingOnlyAuthorization } from '../lib/authorizations'
import {
  formatShiftConflictSummary,
  formatHoursValue,
  getParticipantHoursForWeek,
  getShiftConflicts,
  getAuthorizationHoursDisplayLines,
  getShiftDisplayErrorLevel,
  getShiftFullyScheduledLabel,
  getShiftMilestoneLabels,
  hasMultiShiftDayNotice,
  isAuthorizationFullyScheduled,
  splitShiftForPartialCoverage,
} from '../lib/scheduling'
import { filterCoachesByRegion, filterOtherCoachingForWeekView, filterParticipantsByRegion, filterParticipantsForWeekView, filterShiftsByRegion } from '../lib/regions'
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
  endMinutesFromStartingHours,
  parseDateInput,
  SLOT_MINUTES,
  snapMinutesFromGridY,
  todayDateInput,
} from '../lib/time'
import { clipboardShiftAt, shiftToClipboard } from '../lib/shiftClipboard'
import { playSound } from '../lib/sounds'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { ShiftEditor } from './ShiftEditor'
import { ShiftBlock } from './ShiftBlock'
import { ReportModeModal, defaultReportRange } from './ReportModeModal'
import { ParticipantScheduleModal } from './ParticipantScheduleModal'
import { CoachScheduleModal } from './CoachScheduleModal'

const MIN_HOUR_HEIGHT = 40
const GRID_HEADER_HEIGHT = 40
const HOUR_COUNT = (CALENDAR_VIEW_END - CALENDAR_VIEW_START) / 60

interface WeekSchedulerProps {
  selectedParticipantId: string
  selectedAuthorizationId: string
  selectedOtherCoachingId: string
  visibleCoachIds: Set<string>
  visibleCoachShiftIds: Set<string>
  visibleOtherCoachingIds: Set<string>
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
  selectedAuthorizationId,
  selectedOtherCoachingId,
  visibleCoachIds,
  visibleCoachShiftIds,
  visibleOtherCoachingIds,
  visibleParticipantIds,
}: WeekSchedulerProps) {
  const {
    state,
    prevWeek,
    nextWeek,
    goToToday,
    createQuickShift,
    createQuickOtherCoachingShift,
    updateShift,
    addShift,
    addShifts,
    removeShift,
    copyShiftsFromPreviousWeek,
  } = useStore()
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [isNewShift, setIsNewShift] = useState(false)
  const [dragPreview, setDragPreview] = useState<ShiftDragPreview | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [participantScheduleOpen, setParticipantScheduleOpen] = useState(false)
  const [coachScheduleOpen, setCoachScheduleOpen] = useState(false)
  const copiedShiftRef = useRef<ReturnType<typeof shiftToClipboard> | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [hourHeight, setHourHeight] = useState(52)

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const reportRange = useMemo(() => defaultReportRange(state.weekStart), [state.weekStart])
  const hours = useMemo(
    () => hoursBetween(CALENDAR_VIEW_START, CALENDAR_VIEW_END),
    [],
  )

  const regionParticipants = useMemo(
    () =>
      filterParticipantsForWeekView(
        state.participants,
        state.selectedRegionId,
        state.shifts,
        state.weekStart,
      ),
    [state.participants, state.selectedRegionId, state.shifts, state.weekStart],
  )
  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
  )
  const regionOtherCoaching = useMemo(
    () =>
      filterOtherCoachingForWeekView(
        state.otherCoachingActivities,
        state.selectedRegionId,
        state.shifts,
        state.weekStart,
      ),
    [state.otherCoachingActivities, state.selectedRegionId, state.shifts, state.weekStart],
  )
  const regionShifts = useMemo(
    () =>
      filterShiftsByRegion(
        state.shifts,
        state.participants,
        state.selectedRegionId,
        state.otherCoachingActivities,
      ),
    [state.shifts, state.participants, state.selectedRegionId, state.otherCoachingActivities],
  )

  const participant = regionParticipants.find((p) => p.id === selectedParticipantId)
  const selectedAuthorization = participant
    ? resolveSelectedAuthorization(participant, selectedAuthorizationId)
    : undefined
  const otherCoachingActivity = regionOtherCoaching.find((a) => a.id === selectedOtherCoachingId)
  const participantMap = useMemo(
    () =>
      new Map(
        filterParticipantsByRegion(state.participants, state.selectedRegionId).map((p) => [
          p.id,
          p,
        ]),
      ),
    [state.participants, state.selectedRegionId],
  )
  const otherCoachingMap = useMemo(
    () => new Map(regionOtherCoaching.map((a) => [a.id, a])),
    [regionOtherCoaching],
  )

  const visibleCoaches = useMemo(
    () => regionCoaches.filter((c) => visibleCoachIds.has(c.id)),
    [regionCoaches, visibleCoachIds],
  )

  const visibleShifts = useMemo(
    () =>
      regionShifts.filter((s) => {
        if (!weekDates.includes(s.date)) return false
        if (s.type === 'other-coaching') {
          return (
            !!s.otherCoachingActivityId &&
            visibleOtherCoachingIds.has(s.otherCoachingActivityId) &&
            (!s.coachId || visibleCoachShiftIds.has(s.coachId))
          )
        }
        return (
          !!s.participantId &&
          visibleParticipantIds.has(s.participantId) &&
          (s.type !== 'coached' || !s.coachId || visibleCoachShiftIds.has(s.coachId))
        )
      }),
    [regionShifts, weekDates, visibleParticipantIds, visibleCoachShiftIds, visibleOtherCoachingIds],
  )

  const hoursSummary =
    selectedAuthorization
      ? getParticipantHoursForWeek(
          selectedAuthorization.id,
          weekDates,
          regionShifts,
          selectedAuthorization,
        )
      : null

  const coachMap = useMemo(
    () => new Map(regionCoaches.map((c) => [c.id, c])),
    [regionCoaches],
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
  }, [state.participants.length, participant?.id, state.selectedRegionId])

  const openContextMenu = useCallback(
    (e: React.MouseEvent, items: ContextMenuItem[]) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ x: e.clientX, y: e.clientY, items })
    },
    [],
  )

  const handleDayColumnContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, date: string) => {
      const data = copiedShiftRef.current
      if (!data) return

      const column = e.currentTarget
      const y = e.clientY - column.getBoundingClientRect().top
      const startMinutes = snapMinutesFromGridY(y, hourHeight)

      openContextMenu(e, [
        {
          label: 'Paste',
          onClick: () => {
            const clip = copiedShiftRef.current
            if (!clip) return
            addShift(clipboardShiftAt(clip, date, startMinutes), 'paste')
          },
        },
      ])
    },
    [addShift, hourHeight, openContextMenu],
  )

  const handleCellClick = (date: string, hourMinutes: number) => {
    if (isDragging) return

    const startMinutes = hourMinutes
    const endMinutes = otherCoachingActivity
      ? endMinutesFromStartingHours(startMinutes, otherCoachingActivity.hoursPerWeek)
      : Math.min(hourMinutes + 2 * 60, CALENDAR_VIEW_END)
    if (endMinutes <= startMinutes) return

    if (otherCoachingActivity?.coachId) {
      createQuickOtherCoachingShift(
        otherCoachingActivity.id,
        otherCoachingActivity.coachId,
        date,
        startMinutes,
        endMinutes,
      )
      return
    }

    if (!participant || !selectedAuthorization) return
    if (!isAuthorizationSchedulable(selectedAuthorization)) return

    const shift = createQuickShift(
      participant.id,
      selectedAuthorization.id,
      date,
      startMinutes,
      endMinutes,
      'solo',
    )
    setIsNewShift(true)
    setEditingShift(shift)
  }

  const applyShiftPreview = useCallback(
    (original: Shift, preview: ShiftDragPreview): Shift => {
      let date = preview.date
      if (original.type !== 'other-coaching' && original.participantId) {
        const p = participantMap.get(original.participantId)
        const auth = p?.authorizations.find((a) => a.id === original.authorizationId)
        if (auth && (date < auth.authStart || date > auth.authEnd)) {
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
    [participantMap],
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

  const gridBodyHeight = hours.length * hourHeight
  const canAddShifts =
    (!!participant && !!selectedAuthorization && isAuthorizationSchedulable(selectedAuthorization)) ||
    !!otherCoachingActivity?.coachId

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 grid shrink-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-100">Week schedule</h2>
          <p className="text-xs text-slate-500">
            {otherCoachingActivity ? (
              <>
                Adding shifts for{' '}
                <span className="font-medium text-teal-400">{otherCoachingActivity.name}</span>
                {otherCoachingActivity.coachId
                  ? ` · ${coachMap.get(otherCoachingActivity.coachId)?.name || 'Coach'}`
                  : ''}
              </>
            ) : participant && selectedAuthorization ? (
              <>
                Adding shifts for{' '}
                <span className="font-medium text-blue-400">{participant.name || 'Unnamed'}</span>
                {' · '}
                <span className="font-medium text-blue-300">{selectedAuthorization.service}</span>
                {participant.site ? ` · ${participant.site}` : ''}
                {selectedAuthorization.status !== 'active' && (
                  <span className="text-amber-400"> · Authorization not active</span>
                )}
              </>
            ) : otherCoachingActivity ? (
              'Assign a coach to this assignment before adding calendar blocks.'
            ) : state.participants.length === 0 && regionOtherCoaching.length === 0 ? (
              <>
                Add a participant or other coaching assignment using{' '}
                <strong className="text-slate-300">+ Add</strong> in the sidebar to start
                scheduling.
              </>
            ) : (
              'Select a participant or other coaching assignment from the sidebar to add shifts.'
            )}
          </p>
          {hoursSummary && participant && selectedAuthorization && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {!isCoachingOnlyAuthorization(selectedAuthorization) && (
                <span className="rounded-full bg-slate-800 px-3 py-1 tabular-nums text-slate-300">
                  {participant.name} ({selectedAuthorization.service}):{' '}
                  {formatHoursValue(hoursSummary.totalWorkScheduled)}h work
                </span>
              )}
              <span className="rounded-full bg-violet-950/60 px-3 py-1 tabular-nums text-violet-300">
                {formatHoursValue(hoursSummary.coachedScheduled)}h coached
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-self-center">
          <button
            type="button"
            onClick={() => setParticipantScheduleOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Create Participant Schedule
          </button>
          <button
            type="button"
            onClick={() => setCoachScheduleOpen(true)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Create Coach Schedule
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-self-end">
          <button
            onClick={() => {
              const copied = copyShiftsFromPreviousWeek()
              if (copied === 0) playSound('open')
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            title="Copy all shifts from the previous week onto the same days this week"
          >
            Copy Shifts from Last Week
          </button>
          <button
            onClick={() => {
              playSound('weekNav')
              prevWeek()
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Prev
          </button>
          <button
            onClick={() => {
              playSound('weekNav')
              goToToday()
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            {formatWeekLabel(state.weekStart)}
          </button>
          <button
            onClick={() => {
              playSound('weekNav')
              nextWeek()
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Next →
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-violet-500 bg-violet-900/50" />
          Other coaching assignment (coach color)
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
        <span>
          {canAddShifts
            ? 'Click an empty slot to add a shift · drag top/bottom to resize · drag center to move · right-click to copy/paste'
            : 'Select a participant or other coaching assignment to add shifts · drag to move/resize · right-click shifts to copy and paste on calendar'}
        </span>
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

                <div
                  className="relative"
                  style={{ height: gridBodyHeight }}
                  onContextMenu={(e) => handleDayColumnContextMenu(e, date)}
                >
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
                      className={`absolute w-full border-b border-slate-800/30 ${
                        canAddShifts
                          ? 'cursor-pointer hover:bg-blue-950/30'
                          : 'cursor-default'
                      }`}
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
                        className={`absolute w-full border-b border-dashed border-slate-800/20 ${
                          canAddShifts
                            ? 'cursor-pointer hover:bg-blue-950/20'
                            : 'cursor-default'
                        }`}
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

                    const original = regionShifts.find((s) => s.id === shift.id)!
                    const { top, height } = blockLayout
                    const coach = shift.coachId ? coachMap.get(shift.coachId) : undefined
                    const isOtherCoaching = shift.type === 'other-coaching'
                    const isCoached = shift.type === 'coached' && !!coach
                    const activity = shift.otherCoachingActivityId
                      ? otherCoachingMap.get(shift.otherCoachingActivityId)
                      : undefined
                    const p = shift.participantId ? participantMap.get(shift.participantId) : undefined
                    const isSelected =
                      shift.participantId === selectedParticipantId ||
                      shift.otherCoachingActivityId === selectedOtherCoachingId
                    const blockDragging = dragPreview?.shiftId === shift.id
                    const dayKey = dayOfWeekFromDate(parseDateInput(shift.date))
                    const shiftsForEval = regionShifts.map((s) =>
                      dragPreview?.shiftId === s.id ? { ...s, ...dragPreview } : s,
                    )
                    const shiftAuth =
                      p && shift.authorizationId
                        ? p.authorizations.find((a) => a.id === shift.authorizationId)
                        : undefined
                    const conflicts = getShiftConflicts(
                      shift,
                      p,
                      shiftAuth,
                      coach,
                      shiftsForEval,
                      dayKey,
                      weekDates,
                    )
                    const errorLevel = getShiftDisplayErrorLevel(conflicts)
                    const multiShiftNotice = hasMultiShiftDayNotice(conflicts)
                    const errorSummary = formatShiftConflictSummary(conflicts)
                    const milestoneLabels =
                      shiftAuth && !isOtherCoaching
                        ? getShiftMilestoneLabels(shiftAuth, shift.id, shiftsForEval)
                        : []
                    const fullyScheduledLabel =
                      p &&
                      shiftAuth &&
                      !isOtherCoaching &&
                      isAuthorizationFullyScheduled(shiftAuth, p.id, shiftsForEval)
                        ? getShiftFullyScheduledLabel(shiftAuth)
                        : undefined
                    const authorizationHoursLines =
                      shiftAuth && !isOtherCoaching
                        ? getAuthorizationHoursDisplayLines(shiftAuth, shiftsForEval)
                        : undefined

                    return (
                      <ShiftBlock
                        key={shift.id}
                        shift={shift}
                        layout={layout}
                        hourHeight={hourHeight}
                        top={top}
                        height={height}
                        participantName={
                          isOtherCoaching ? activity?.name || 'Other coaching' : p?.name || 'Participant'
                        }
                        site={isOtherCoaching ? activity?.notes : p?.site}
                        accentColor={
                          coach?.color ?? (isCoached || isOtherCoaching ? '#64748b' : '#64748b')
                        }
                        coachName={coach?.name}
                        isCoached={isCoached || isOtherCoaching}
                        isOtherCoaching={isOtherCoaching}
                        isSelected={isSelected}
                        isDragging={blockDragging}
                        errorLevel={errorLevel}
                        multiShiftNotice={multiShiftNotice}
                        milestoneLabels={milestoneLabels}
                        authorizationService={
                          !isOtherCoaching ? shiftAuth?.service : undefined
                        }
                        authorizationNumber={
                          !isOtherCoaching ? shiftAuth?.authNumber : undefined
                        }
                        authorizationHoursLines={authorizationHoursLines}
                        fullyScheduledLabel={fullyScheduledLabel}
                        errorSummary={errorSummary}
                        onEdit={() => {
                          playSound('open')
                          setIsNewShift(false)
                          setEditingShift(original)
                        }}
                        onDragStart={() => {
                          playSound('pickup')
                          setIsDragging(true)
                        }}
                        onDragPreview={setDragPreview}
                        onDragEnd={(preview) => handleDragEnd(original, preview)}
                        onDragCancel={() => {
                          setDragPreview(null)
                          setIsDragging(false)
                        }}
                        onContextMenu={(e) => {
                          if (isOtherCoaching) {
                            openContextMenu(e, [
                              {
                                label: 'Copy',
                                onClick: () => {
                                  copiedShiftRef.current = shiftToClipboard(original)
                                  playSound('copy')
                                },
                              },
                              {
                                label: 'Delete Shift',
                                onClick: () => {
                                  removeShift(original.id)
                                },
                              },
                            ])
                            return
                          }
                          const canSplit = splitShiftForPartialCoverage(original) !== null
                          openContextMenu(e, [
                            {
                              label: 'Change to Coached Shift',
                              disabled: original.type === 'coached',
                              onClick: () => {
                                setIsNewShift(false)
                                playSound('open')
                                setEditingShift({ ...original, type: 'coached' })
                              },
                            },
                            {
                              label: 'Change to Solo Shift',
                              disabled: original.type === 'solo',
                              onClick: () => {
                                updateShift({ ...original, type: 'solo', coachId: undefined })
                              },
                            },
                            {
                              label: 'Split Shift for Partial Coverage',
                              disabled: !canSplit,
                              onClick: () => {
                                const split = splitShiftForPartialCoverage(original)
                                if (!split) return
                                removeShift(original.id, false)
                                addShifts(split, false)
                                playSound('split')
                              },
                            },
                            {
                              label: 'Copy',
                              onClick: () => {
                                copiedShiftRef.current = shiftToClipboard(original)
                                playSound('copy')
                              },
                            },
                            {
                              label: 'Delete Shift',
                              onClick: () => {
                                removeShift(original.id)
                              },
                            },
                          ])
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

      {participantScheduleOpen && (
        <ParticipantScheduleModal
          weekStart={state.weekStart}
          weekDates={weekDates}
          onClose={() => setParticipantScheduleOpen(false)}
        />
      )}

      {coachScheduleOpen && (
        <CoachScheduleModal
          weekStart={state.weekStart}
          weekDates={weekDates}
          onClose={() => setCoachScheduleOpen(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
