import { useState } from 'react'
import type { Coach, DayOfWeek, TimeRange } from '../types'
import { COACH_NOTES_MAX, DAYS, DAY_LABELS } from '../types'
import { useStore } from '../store/useStore'
import { COACH_COLOR_PALETTE } from '../lib/colors'
import { CALENDAR_VIEW_END, CALENDAR_VIEW_START, SLOT_MINUTES } from '../lib/time'
import { TimeSelect } from './TimeSelect'
import { Modal } from './Modal'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function AvailabilityEditor({
  availability,
  onChange,
}: {
  availability: Partial<Record<DayOfWeek, TimeRange | null>>
  onChange: (availability: Partial<Record<DayOfWeek, TimeRange | null>>) => void
}) {
  const toggleDay = (day: DayOfWeek) => {
    const current = availability[day]
    if (current) {
      onChange({ ...availability, [day]: null })
    } else {
      onChange({
        ...availability,
        [day]: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
      })
    }
  }

  const updateRange = (day: DayOfWeek, field: 'start' | 'end', minutes: number) => {
    const range = availability[day]
    if (!range) return
    onChange({
      ...availability,
      [day]:
        field === 'start'
          ? { ...range, startMinutes: minutes }
          : { ...range, endMinutes: minutes },
    })
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-slate-400">Daily Availability</span>
      {DAYS.map((day) => {
        const range = availability[day]
        const enabled = !!range
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <label className="flex w-12 items-center gap-1.5">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleDay(day)}
                className="rounded border-slate-600 bg-slate-800"
              />
              <span className="text-xs text-slate-400">{DAY_LABELS[day]}</span>
            </label>
            {enabled && range ? (
              <>
                <TimeSelect
                  compact
                  valueMinutes={range.startMinutes}
                  minMinutes={CALENDAR_VIEW_START - SLOT_MINUTES}
                  maxMinutes={Math.min(
                    CALENDAR_VIEW_END - SLOT_MINUTES,
                    range.endMinutes - SLOT_MINUTES,
                  )}
                  onChange={(m) => updateRange(day, 'start', m)}
                />
                <span className="text-slate-600">–</span>
                <TimeSelect
                  compact
                  valueMinutes={range.endMinutes}
                  minMinutes={range.startMinutes}
                  maxMinutes={CALENDAR_VIEW_END}
                  onChange={(m) => updateRange(day, 'end', m)}
                />
              </>
            ) : (
              <span className="text-xs text-slate-600">Off</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface CoachModalProps {
  coach: Coach
  onClose: () => void
}

export function CoachModal({ coach: initialCoach, onClose }: CoachModalProps) {
  const { state, updateCoach, removeCoach } = useStore()
  const [coach, setCoach] = useState(initialCoach)

  const save = () => {
    updateCoach(coach)
    onClose()
  }

  const handleDelete = () => {
    if (confirm(`Remove ${coach.name || 'this coach'}? Assigned shifts will become solo.`)) {
      removeCoach(coach.id)
      onClose()
    }
  }

  return (
    <Modal
      title={coach.name ? `Edit ${coach.name}` : 'New Coach'}
      subtitle="Max 40 assigned hours per week"
      footer={
        <div className="flex justify-between">
          <button
            onClick={handleDelete}
            className="rounded-md px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50"
          >
            Remove
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
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
          <span className="text-xs font-medium text-slate-400">Region</span>
          <select
            className={`${inputClass} mt-1`}
            value={coach.regionId}
            onChange={(e) => setCoach({ ...coach, regionId: e.target.value })}
          >
            {state.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Name</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Coach name"
            value={coach.name}
            onChange={(e) => setCoach({ ...coach, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Starting Location</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Home base / site"
            value={coach.startingLocation}
            onChange={(e) => setCoach({ ...coach, startingLocation: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Phone</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Phone number"
            type="tel"
            value={coach.phone}
            onChange={(e) => setCoach({ ...coach, phone: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Notes</span>
          <textarea
            className={`${inputClass} mt-1 resize-none`}
            placeholder="Short notes"
            rows={2}
            maxLength={COACH_NOTES_MAX}
            value={coach.notes}
            onChange={(e) =>
              setCoach({ ...coach, notes: e.target.value.slice(0, COACH_NOTES_MAX) })
            }
          />
          <span className="mt-1 block text-right text-[10px] text-slate-600">
            {coach.notes.length}/{COACH_NOTES_MAX}
          </span>
        </label>

        <div>
          <span className="text-xs font-medium text-slate-400">Color</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {COACH_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setCoach({ ...coach, color })}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 transition-transform hover:scale-110 ${
                  coach.color === color ? 'ring-white' : 'ring-transparent'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-800">
              <input
                type="color"
                value={coach.color}
                onChange={(e) => setCoach({ ...coach, color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="text-[10px] text-slate-400">+</span>
            </label>
            <span
              className="ml-1 h-8 min-w-8 rounded-md px-2 text-xs leading-8 tabular-nums text-slate-400"
              style={{ backgroundColor: coach.color + '33', color: coach.color }}
            >
              {coach.color}
            </span>
          </div>
        </div>

        <AvailabilityEditor
          availability={coach.availability}
          onChange={(availability) => setCoach({ ...coach, availability })}
        />
      </div>
    </Modal>
  )
}
