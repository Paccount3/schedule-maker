import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  filterCoachesByRegion,
  filterParticipantsByRegion,
  filterShiftsByRegion,
  regionName,
} from '../lib/regions'
import {
  buildParticipantWeekScheduleWriteup,
  participantIdsWithShiftsInWeek,
} from '../lib/scheduleWriteup'
import { formatWeekLabel } from '../lib/time'
import { exportScheduleWriteupPdf } from '../lib/scheduleWriteupExport'
import { CopyTextButton } from './CopyTextButton'
import { Modal } from './Modal'

interface ParticipantScheduleModalProps {
  weekStart: string
  weekDates: string[]
  onClose: () => void
}

export function ParticipantScheduleModal({
  weekStart,
  weekDates,
  onClose,
}: ParticipantScheduleModalProps) {
  const { state } = useStore()

  const regionParticipants = useMemo(
    () => filterParticipantsByRegion(state.participants, state.selectedRegionId),
    [state.participants, state.selectedRegionId],
  )
  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
  )
  const regionShifts = useMemo(
    () => filterShiftsByRegion(state.shifts, state.participants, state.selectedRegionId),
    [state.shifts, state.participants, state.selectedRegionId],
  )

  const eligibleParticipants = useMemo(() => {
    const ids = new Set(
      participantIdsWithShiftsInWeek(
        regionShifts,
        weekDates,
        regionParticipants.map((p) => p.id),
      ),
    )
    return regionParticipants
      .filter((p) => ids.has(p.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [regionParticipants, regionShifts, weekDates])

  const [selectedId, setSelectedId] = useState(() => eligibleParticipants[0]?.id ?? '')

  useEffect(() => {
    if (!eligibleParticipants.some((p) => p.id === selectedId)) {
      setSelectedId(eligibleParticipants[0]?.id ?? '')
    }
  }, [eligibleParticipants, selectedId])

  const selected = eligibleParticipants.find((p) => p.id === selectedId)

  const writeup = useMemo(() => {
    if (!selected) return ''
    return buildParticipantWeekScheduleWriteup(
      selected,
      weekDates,
      weekStart,
      regionShifts,
      regionCoaches,
    )
  }, [selected, weekDates, weekStart, regionShifts, regionCoaches])

  const regionLabel = regionName(state.regions, state.selectedRegionId)

  return (
    <Modal
      wide
      title="Create Participant Schedule"
      subtitle={`${regionLabel} · ${formatWeekLabel(weekStart)}`}
      footer={
        <div className="flex justify-end gap-2">
          <CopyTextButton text={writeup} disabled={!writeup} />
          <button
            type="button"
            onClick={() => {
              if (!selected || !writeup) return
              exportScheduleWriteupPdf({
                writeup,
                scheduleKind: 'participant',
                personName: selected.name || 'Unnamed',
                regionLabel,
                weekLabel: formatWeekLabel(weekStart),
              })
            }}
            disabled={!writeup}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
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
        {eligibleParticipants.length === 0 ? (
          <p className="text-sm text-slate-500">No participants have shifts scheduled this week.</p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Participant</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {eligibleParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Unnamed'}
                    {p.site ? ` · ${p.site}` : ''}
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
