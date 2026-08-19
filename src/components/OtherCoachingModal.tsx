import { useState } from 'react'
import type { OtherCoachingActivity, OtherCoachingCategory } from '../types'
import {
  OTHER_COACHING_CATEGORIES,
  OTHER_COACHING_NOTES_MAX,
  defaultStartingHoursForCategory,
} from '../types'
import { useStore } from '../store/useStore'
import { useConfirm } from '../store/useConfirm'
import { otherCoachingDeleteConfirm } from '../lib/confirmMessages'
import { filterCoachesByRegion } from '../lib/regions'
import { parseDateInput, startOfWeek, toDateInput } from '../lib/time'
import { Modal } from './Modal'
import { CalendarScheduleHint } from './CalendarScheduleHint'
import { DateSelect } from './DateSelect'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function snapToWeekStart(date: string): string {
  return toDateInput(startOfWeek(parseDateInput(date)))
}

function formatWeekLabel(weekStart: string): string {
  const d = parseDateInput(weekStart)
  return `Week of ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

interface OtherCoachingModalProps {
  activity: OtherCoachingActivity
  isNew?: boolean
  onClose: () => void
}

export function OtherCoachingModal({ activity: initial, isNew, onClose }: OtherCoachingModalProps) {
  const { state, updateOtherCoachingActivity, removeOtherCoachingActivity } = useStore()
  const { confirm } = useConfirm()
  const [activity, setActivity] = useState(initial)
  const [coachError, setCoachError] = useState<string | undefined>()

  const regionCoaches = filterCoachesByRegion(state.coaches, state.selectedRegionId)

  const [weekError, setWeekError] = useState<string | undefined>()

  const save = () => {
    if (!activity.weekOf) {
      setWeekError('Select a week')
      return
    }
    if (!activity.coachId) {
      setCoachError('Assign a coach')
      return
    }
    updateOtherCoachingActivity(activity)
    onClose()
  }

  const handleCancel = () => {
    if (isNew) removeOtherCoachingActivity(activity.id)
    onClose()
  }

  const handleDelete = async () => {
    const ok = await confirm(otherCoachingDeleteConfirm(activity.name))
    if (!ok) return
    removeOtherCoachingActivity(activity.id)
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'New Other Coaching Assignment' : `Edit ${activity.name}`}
      footer={
        <div className="flex justify-between">
          {!isNew ? (
            <button
              onClick={handleDelete}
              className="rounded-md px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50"
            >
              Remove
            </button>
          ) : (
            <span />
          )}
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
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Name</span>
          <select
            className={`${inputClass} mt-1`}
            value={activity.name}
            onChange={(e) => {
              const name = e.target.value as OtherCoachingCategory
              setActivity({
                ...activity,
                name,
                hoursPerWeek: defaultStartingHoursForCategory(name),
              })
            }}
          >
            {OTHER_COACHING_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-400">Week</span>
          <div className="mt-1">
            <DateSelect
              value={activity.weekOf}
              onChange={(v) => { setWeekError(undefined); setActivity({ ...activity, weekOf: snapToWeekStart(v) }) }}
            />
            {activity.weekOf ? (
              <span className="mt-1 block text-[11px] text-slate-500">
                {formatWeekLabel(activity.weekOf)} — only visible this week
              </span>
            ) : weekError ? (
              <span className="mt-1 block text-xs text-red-400">{weekError}</span>
            ) : null}
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-400">
            Coach <span className="text-red-400">*</span>
          </span>
          <select
            className={`${inputClass} mt-1 ${coachError ? 'border-red-500' : ''}`}
            value={activity.coachId}
            onChange={(e) => {
              setCoachError(undefined)
              setActivity({ ...activity, coachId: e.target.value })
            }}
          >
            <option value="">Select coach…</option>
            {regionCoaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name || 'Unnamed'}
              </option>
            ))}
          </select>
          {coachError && <span className="mt-1 block text-xs text-red-400">{coachError}</span>}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-400">Starting Hours</span>
          <input
            type="number"
            min={0.25}
            step={0.25}
            className={`${inputClass} mt-1`}
            value={activity.hoursPerWeek}
            onChange={(e) =>
              setActivity({ ...activity, hoursPerWeek: Number(e.target.value) || 0 })
            }
          />
          <span className="mt-1 block text-[10px] text-slate-500">
            Default block length when you click the calendar. Resizing on the calendar updates this
            value.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-400">Notes</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Optional note"
            maxLength={OTHER_COACHING_NOTES_MAX}
            value={activity.notes}
            onChange={(e) =>
              setActivity({
                ...activity,
                notes: e.target.value.slice(0, OTHER_COACHING_NOTES_MAX),
              })
            }
          />
          <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
            {activity.notes.length}/{OTHER_COACHING_NOTES_MAX}
          </span>
        </label>

        <CalendarScheduleHint />
      </div>
    </Modal>
  )
}
