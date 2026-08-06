import { useEffect, useState } from 'react'
import type { Shift, ShiftType } from '../types'
import { useStore } from '../store/useStore'
import { hexToRgba } from '../lib/colors'
import {
  getAvailableCoaches,
  getCoachHoursSummary,
  getShiftConflicts,
} from '../lib/scheduling'
import {
  CALENDAR_VIEW_END,
  CALENDAR_VIEW_START,
  dayOfWeekFromDate,
  durationHours,
  formatMinutesRange,
  parseDateInput,
  SLOT_MINUTES,
} from '../lib/time'

interface ShiftEditorProps {
  shift: Shift
  isNew?: boolean
  weekDates: string[]
  onClose: () => void
  onDelete?: () => void
}

import { TimeSelect } from './TimeSelect'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export function ShiftEditor({ shift: initialShift, isNew, weekDates, onClose, onDelete }: ShiftEditorProps) {
  const { state, updateShift, removeShift } = useStore()
  const [shift, setShift] = useState(initialShift)

  useEffect(() => {
    setShift(initialShift)
  }, [initialShift])

  const participant = state.participants.find((p) => p.id === shift.participantId)
  const coach = shift.coachId ? state.coaches.find((c) => c.id === shift.coachId) : undefined
  const dayOfWeek = dayOfWeekFromDate(parseDateInput(shift.date))

  const conflicts = getShiftConflicts(
    shift,
    participant,
    coach,
    state.shifts,
    dayOfWeek,
    weekDates,
  )

  const availableCoaches =
    shift.type === 'coached'
      ? getAvailableCoaches(
          state.coaches,
          dayOfWeek,
          shift.startMinutes,
          shift.endMinutes,
          shift.date,
          state.shifts,
          weekDates,
          shift.id,
        )
      : []

  const hours = durationHours(shift.startMinutes, shift.endMinutes)

  const save = () => {
    updateShift(shift)
    onClose()
  }

  const handleCancel = () => {
    if (isNew) removeShift(shift.id)
    onClose()
  }

  const handleDelete = () => {
    removeShift(shift.id)
    onDelete?.()
    onClose()
  }

  const setType = (type: ShiftType) => {
    setShift({
      ...shift,
      type,
      coachId: type === 'solo' ? undefined : shift.coachId,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-100">Edit Shift</h3>
          <p className="text-sm text-slate-400">
            {participant?.name || 'Participant'} · {hours}h ·{' '}
            {formatMinutesRange(shift.startMinutes, shift.endMinutes)}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Start</span>
              <div className="mt-1">
                <TimeSelect
                  className={`${inputClass} w-full`}
                  valueMinutes={shift.startMinutes}
                  minMinutes={CALENDAR_VIEW_START - SLOT_MINUTES}
                  maxMinutes={Math.min(
                    CALENDAR_VIEW_END - SLOT_MINUTES,
                    shift.endMinutes - SLOT_MINUTES,
                  )}
                  onChange={(start) =>
                    setShift({
                      ...shift,
                      startMinutes: start,
                      endMinutes: Math.max(start + SLOT_MINUTES, shift.endMinutes),
                    })
                  }
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">End</span>
              <div className="mt-1">
                <TimeSelect
                  className={`${inputClass} w-full`}
                  valueMinutes={shift.endMinutes}
                  minMinutes={shift.startMinutes}
                  maxMinutes={CALENDAR_VIEW_END}
                  onChange={(end) => setShift({ ...shift, endMinutes: end })}
                />
              </div>
            </label>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400">Shift Type</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setType('solo')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  shift.type === 'solo'
                    ? 'border-slate-400 bg-slate-600 text-white'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                Solo (no coach)
              </button>
              <button
                onClick={() => setType('coached')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  shift.type === 'coached'
                    ? 'border-violet-500 bg-violet-700 text-white'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                With Coach
              </button>
            </div>
          </div>

          {shift.type === 'coached' && (
            <div>
              <span className="text-xs font-medium text-slate-400">Coach</span>
              <div className="mt-1 space-y-1">
                {state.coaches.length === 0 ? (
                  <p className="text-sm text-amber-400">Add coaches in the sidebar first.</p>
                ) : (
                  state.coaches.map((c) => {
                    const slot = availableCoaches.find((s) => s.coach.id === c.id)
                    const isSelected = shift.coachId === c.id
                    const available = slot?.available || isSelected
                    const coachHours = getCoachHoursSummary(c, weekDates, state.shifts, shift.id)
                    const projectedAssigned =
                      coachHours.assigned + (shift.type === 'coached' ? hours : 0)
                    const display =
                      Math.round(projectedAssigned * 10) / 10
                    const maxDisplay = Math.round(coachHours.max * 10) / 10

                    return (
                      <button
                        key={c.id}
                        onClick={() => setShift({ ...shift, coachId: c.id })}
                        disabled={!available && !isSelected}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-violet-500 bg-violet-950/50 text-slate-100'
                            : available
                              ? 'border-slate-700 text-slate-300 hover:border-violet-600 hover:bg-violet-950/30'
                              : 'cursor-not-allowed border-slate-800 bg-slate-800/50 text-slate-600'
                        }`}
                        style={
                          isSelected
                            ? { borderColor: c.color, backgroundColor: hexToRgba(c.color, 0.15) }
                            : undefined
                        }
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name || 'Unnamed'}
                          <span className="text-xs text-slate-500">{c.startingLocation}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          {!available && !isSelected && <span>{slot?.reason}</span>}
                          {available && !isSelected && (
                            <span className="text-emerald-400">Available</span>
                          )}
                          <span className="font-semibold tabular-nums text-slate-400">
                            {display}/{maxDisplay}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-slate-400">Notes</span>
            <textarea
              className={`${inputClass} mt-1 resize-none`}
              rows={2}
              placeholder="Late arrival, early departure, reassignment notes..."
              value={shift.notes || ''}
              onChange={(e) => setShift({ ...shift, notes: e.target.value })}
            />
          </label>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-700/50 bg-amber-950/40 p-3">
              {conflicts.map((c, i) => (
                <p key={i} className="text-sm text-amber-300">
                  ⚠ {c.message}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-slate-800 px-5 py-4">
          <button
            onClick={handleDelete}
            className="rounded-md px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50"
          >
            Delete Shift
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
