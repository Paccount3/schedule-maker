import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  formatHoursValue,
  getCoachHoursInRange,
  getParticipantHoursInRange,
  isCoachingOnlyParticipant,
} from '../lib/scheduling'
import { formatAuthRange, getWeekDates } from '../lib/time'
import { DateSelect } from './DateSelect'
import { Modal } from './Modal'

interface ReportModeModalProps {
  defaultStart: string
  defaultEnd: string
  onClose: () => void
}

interface ReportEntry {
  id: string
  name: string
  hoursWorked: number
  hoursCoached: number
  showWorked: boolean
  copyText: string
}

function buildCopyText(
  name: string,
  hoursWorked: number,
  hoursCoached: number,
  showWorked: boolean,
): string {
  const lines = [name]
  if (showWorked) lines.push(`${formatHoursValue(hoursWorked)}h worked`)
  lines.push(`${formatHoursValue(hoursCoached)}h coached`)
  return lines.join('\n')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ReportCard({ entry }: { entry: ReportEntry }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-800/40 px-3 py-3">
      <div className="min-w-0">
        <h5 className="text-base font-semibold text-slate-100">{entry.name}</h5>
        <div className="mt-1.5 space-y-0.5 text-sm tabular-nums text-slate-300">
          {entry.showWorked && (
            <p>{formatHoursValue(entry.hoursWorked)}h worked</p>
          )}
          <p>{formatHoursValue(entry.hoursCoached)}h coached</p>
        </div>
      </div>
      <CopyButton text={entry.copyText} />
    </div>
  )
}

function ReportSection({ title, entries }: { title: string; entries: ReportEntry[] }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-600">None</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <ReportCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  )
}

export function ReportModeModal({ defaultStart, defaultEnd, onClose }: ReportModeModalProps) {
  const { state } = useStore()
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)

  const rangeValid = startDate <= endDate

  const participantEntries = useMemo((): ReportEntry[] => {
    if (!rangeValid) return []

    return state.participants.map((participant) => {
      const hours = getParticipantHoursInRange(
        participant.id,
        state.shifts,
        startDate,
        endDate,
      )
      const name = participant.name || 'Unnamed'
      const showWorked = !isCoachingOnlyParticipant(participant)

      return {
        id: participant.id,
        name,
        hoursWorked: hours.totalWork,
        hoursCoached: hours.totalCoached,
        showWorked,
        copyText: buildCopyText(name, hours.totalWork, hours.totalCoached, showWorked),
      }
    })
  }, [state.participants, state.shifts, startDate, endDate, rangeValid])

  const coachEntries = useMemo((): ReportEntry[] => {
    if (!rangeValid) return []

    return state.coaches.map((coach) => {
      const hours = getCoachHoursInRange(coach.id, state.shifts, startDate, endDate)
      const name = coach.name || 'Unnamed'

      return {
        id: coach.id,
        name,
        hoursWorked: hours.totalWork,
        hoursCoached: hours.totalCoached,
        showWorked: true,
        copyText: buildCopyText(name, hours.totalWork, hours.totalCoached, true),
      }
    })
  }, [state.coaches, state.shifts, startDate, endDate, rangeValid])

  const rangeLabel = rangeValid ? formatAuthRange(startDate, endDate) : 'Invalid date range'

  return (
    <Modal
      wide
      title="Report Mode"
      subtitle={rangeLabel}
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Start date</span>
            <DateSelect className="mt-1" value={startDate} onChange={setStartDate} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">End date</span>
            <DateSelect className="mt-1" value={endDate} onChange={setEndDate} />
          </label>
        </div>

        {!rangeValid && (
          <p className="text-sm text-red-400">End date must be on or after the start date.</p>
        )}

        <ReportSection title="Coaches" entries={coachEntries} />
        <ReportSection title="Participants" entries={participantEntries} />
      </div>
    </Modal>
  )
}

export function defaultReportRange(weekStart: string): { start: string; end: string } {
  const weekDates = getWeekDates(weekStart)
  return { start: weekDates[0], end: weekDates[6] }
}
