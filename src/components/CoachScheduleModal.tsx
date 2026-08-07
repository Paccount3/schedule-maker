import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  filterCoachesByRegion,
  filterParticipantsByRegion,
  filterShiftsByRegion,
  regionName,
} from '../lib/regions'
import {
  buildCoachWeekScheduleWriteup,
  coachIdsWithCoachedShiftsInWeek,
} from '../lib/scheduleWriteup'
import { formatWeekLabel } from '../lib/time'
import { CopyTextButton } from './CopyTextButton'
import { Modal } from './Modal'

interface CoachScheduleModalProps {
  weekStart: string
  weekDates: string[]
  onClose: () => void
}

export function CoachScheduleModal({ weekStart, weekDates, onClose }: CoachScheduleModalProps) {
  const { state } = useStore()

  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
  )
  const regionParticipants = useMemo(
    () => filterParticipantsByRegion(state.participants, state.selectedRegionId),
    [state.participants, state.selectedRegionId],
  )
  const regionShifts = useMemo(
    () => filterShiftsByRegion(state.shifts, state.participants, state.selectedRegionId),
    [state.shifts, state.participants, state.selectedRegionId],
  )

  const eligibleCoaches = useMemo(() => {
    const ids = new Set(
      coachIdsWithCoachedShiftsInWeek(
        regionShifts,
        weekDates,
        regionCoaches.map((c) => c.id),
      ),
    )
    return regionCoaches
      .filter((c) => ids.has(c.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [regionCoaches, regionShifts, weekDates])

  const [selectedId, setSelectedId] = useState(() => eligibleCoaches[0]?.id ?? '')

  useEffect(() => {
    if (!eligibleCoaches.some((c) => c.id === selectedId)) {
      setSelectedId(eligibleCoaches[0]?.id ?? '')
    }
  }, [eligibleCoaches, selectedId])

  const selected = eligibleCoaches.find((c) => c.id === selectedId)

  const writeup = useMemo(() => {
    if (!selected) return ''
    return buildCoachWeekScheduleWriteup(
      selected,
      weekDates,
      weekStart,
      regionShifts,
      regionParticipants,
    )
  }, [selected, weekDates, weekStart, regionShifts, regionParticipants])

  const regionLabel = regionName(state.regions, state.selectedRegionId)

  return (
    <Modal
      wide
      title="Create Coach Schedule"
      subtitle={`${regionLabel} · ${formatWeekLabel(weekStart)}`}
      footer={
        <div className="flex justify-end gap-2">
          <CopyTextButton text={writeup} disabled={!writeup} />
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {eligibleCoaches.length === 0 ? (
          <p className="text-sm text-slate-500">No coaches have coached shifts scheduled this week.</p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Coach</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {eligibleCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Unnamed'}
                    {c.startingLocation ? ` · ${c.startingLocation}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs font-medium text-slate-400">Schedule write-up</span>
              <textarea
                readOnly
                value={writeup}
                rows={16}
                className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-3 text-sm leading-relaxed text-slate-200 focus:outline-none"
                onFocus={(e) => e.target.select()}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
