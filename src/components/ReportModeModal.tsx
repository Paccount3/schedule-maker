import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Participant } from '../types'
import { useStore } from '../store/useStore'
import {
  formatHoursValue,
  getCoachHoursInRange,
  getParticipantHoursInRange,
  isCoachingOnlyParticipant,
} from '../lib/scheduling'
import {
  filterCoachesByRegion,
  filterParticipantsByRegion,
  filterShiftsByRegion,
  regionName,
} from '../lib/regions'
import { formatAuthRange, getWeekDates } from '../lib/time'
import { DateSelect } from './DateSelect'
import { ChevronIcon } from './ChevronIcon'
import { Modal } from './Modal'
import { TimeCardModal } from './TimeCardModal'
import { TallySheetModal } from './TallySheetModal'

interface ReportModeModalProps {
  defaultStart: string
  defaultEnd: string
  onClose: () => void
}

interface CoachReportEntry {
  id: string
  name: string
  hoursWorked: number
  hoursCoached: number
  showWorked: boolean
  copyText: string
}

interface ParticipantReportEntry {
  id: string
  participant: Participant
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

function CoachReportCard({ entry }: { entry: CoachReportEntry }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-800/40 px-3 py-3">
      <div className="min-w-0">
        <h5 className="text-base font-semibold text-slate-100">{entry.name}</h5>
        <div className="mt-1.5 space-y-0.5 text-sm tabular-nums text-slate-300">
          {entry.showWorked && <p>{formatHoursValue(entry.hoursWorked)}h worked</p>}
          <p>{formatHoursValue(entry.hoursCoached)}h coached</p>
        </div>
      </div>
      <CopyButton text={entry.copyText} />
    </div>
  )
}

function ParticipantReportCard({
  entry,
  expanded,
  onToggle,
  onGenerateTimeCard,
  onGenerateTallySheet,
}: {
  entry: ParticipantReportEntry
  expanded: boolean
  onToggle: () => void
  onGenerateTimeCard: () => void
  onGenerateTallySheet: () => void
}) {
  const hoursSummary = entry.showWorked
    ? `${formatHoursValue(entry.hoursWorked)}h worked · ${formatHoursValue(entry.hoursCoached)}h coached`
    : `${formatHoursValue(entry.hoursCoached)}h coached`

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-800/40">
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-2 text-left transition-colors hover:text-slate-100"
        >
          <span className="mt-0.5 shrink-0 text-slate-500">
            <ChevronIcon expanded={expanded} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-slate-100">{entry.name}</span>
            {!expanded && (
              <span className="mt-0.5 block text-xs tabular-nums text-slate-400">{hoursSummary}</span>
            )}
          </span>
        </button>
        <CopyButton text={entry.copyText} />
      </div>
      {expanded && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2">
          <p className="font-mono text-[10px] tracking-wide text-slate-500">
            Auth # {entry.participant.authNumber}
          </p>
          <div className="mt-1.5 space-y-0.5 text-sm tabular-nums text-slate-300">
            {entry.showWorked && <p>{formatHoursValue(entry.hoursWorked)}h worked</p>}
            <p>{formatHoursValue(entry.hoursCoached)}h coached</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateTimeCard}
              className="rounded-md border border-blue-600/50 bg-blue-950/40 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-950/70"
            >
              Generate Time Card
            </button>
            <button
              type="button"
              onClick={onGenerateTallySheet}
              className="rounded-md border border-emerald-600/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/70"
            >
              Generate Tally Sheet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CollapsibleReportSection({
  title,
  count,
  expanded,
  onToggle,
  nested,
  children,
}: {
  title: string
  count?: number
  expanded: boolean
  onToggle: () => void
  nested?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={
        nested
          ? 'overflow-hidden rounded-md border border-slate-800 bg-slate-900/40'
          : 'overflow-hidden rounded-lg border border-slate-800 bg-slate-900/30'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronIcon expanded={expanded} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[10px] tabular-nums text-slate-600">({count})</span>
          )}
        </span>
      </button>
      {expanded && (
        <div
          className={`space-y-2 border-t border-slate-800 px-3 pb-3 pt-2 ${nested ? '' : 'space-y-3'}`}
        >
          {children}
        </div>
      )}
    </section>
  )
}

export function ReportModeModal({ defaultStart, defaultEnd, onClose }: ReportModeModalProps) {
  const { state } = useStore()
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [timeCardParticipant, setTimeCardParticipant] = useState<Participant | null>(null)
  const [tallySheetParticipant, setTallySheetParticipant] = useState<Participant | null>(null)
  const [coachingMenuExpanded, setCoachingMenuExpanded] = useState(true)
  const [coachesExpanded, setCoachesExpanded] = useState(true)
  const [participantsExpanded, setParticipantsExpanded] = useState(true)
  const [collapsedParticipantIds, setCollapsedParticipantIds] = useState<Set<string>>(
    () => new Set(),
  )

  const rangeValid = startDate <= endDate

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

  const participantEntries = useMemo((): ParticipantReportEntry[] => {
    if (!rangeValid) return []

    return regionParticipants.map((participant) => {
      const hours = getParticipantHoursInRange(
        participant.id,
        regionShifts,
        startDate,
        endDate,
      )
      const name = participant.name || 'Unnamed'
      const showWorked = !isCoachingOnlyParticipant(participant)

      return {
        id: participant.id,
        participant,
        name,
        hoursWorked: hours.totalWork,
        hoursCoached: hours.totalCoached,
        showWorked,
        copyText: buildCopyText(name, hours.totalWork, hours.totalCoached, showWorked),
      }
    })
  }, [regionParticipants, regionShifts, startDate, endDate, rangeValid])

  const coachEntries = useMemo((): CoachReportEntry[] => {
    if (!rangeValid) return []

    return regionCoaches.map((coach) => {
      const hours = getCoachHoursInRange(coach.id, regionShifts, startDate, endDate)
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
  }, [regionCoaches, regionShifts, startDate, endDate, rangeValid])

  useEffect(() => {
    const validIds = new Set(participantEntries.map((entry) => entry.id))
    setCollapsedParticipantIds((prev) => {
      const next = new Set<string>()
      for (const id of prev) {
        if (validIds.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [participantEntries])

  const toggleParticipantCard = (participantId: string) => {
    setCollapsedParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  const rangeLabel = rangeValid ? formatAuthRange(startDate, endDate) : 'Invalid date range'
  const regionLabel = regionName(state.regions, state.selectedRegionId)

  return (
    <>
      <Modal
        wide
        title="Report Mode"
        subtitle={regionLabel}
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

          {rangeValid && (
            <div className="rounded-lg border border-blue-600/40 bg-blue-950/30 px-4 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300/80">
                Selected date range
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-blue-100">{rangeLabel}</p>
              <p className="mt-2 text-sm text-slate-400">
                Time Sheets and Tally Sheets will be generated between these date ranges.
              </p>
            </div>
          )}

          {rangeValid && (
            <CollapsibleReportSection
              title="Coaching & participants"
              count={coachEntries.length + participantEntries.length}
              expanded={coachingMenuExpanded}
              onToggle={() => setCoachingMenuExpanded((open) => !open)}
            >
              <CollapsibleReportSection
                title="Coaches"
                count={coachEntries.length}
                expanded={coachesExpanded}
                onToggle={() => setCoachesExpanded((open) => !open)}
                nested
              >
                {coachEntries.length === 0 ? (
                  <p className="text-sm text-slate-600">None</p>
                ) : (
                  coachEntries.map((entry) => <CoachReportCard key={entry.id} entry={entry} />)
                )}
              </CollapsibleReportSection>

              <CollapsibleReportSection
                title="Participants"
                count={participantEntries.length}
                expanded={participantsExpanded}
                onToggle={() => setParticipantsExpanded((open) => !open)}
                nested
              >
                {participantEntries.length === 0 ? (
                  <p className="text-sm text-slate-600">None</p>
                ) : (
                  participantEntries.map((entry) => (
                    <ParticipantReportCard
                      key={entry.id}
                      entry={entry}
                      expanded={!collapsedParticipantIds.has(entry.id)}
                      onToggle={() => toggleParticipantCard(entry.id)}
                      onGenerateTimeCard={() => setTimeCardParticipant(entry.participant)}
                      onGenerateTallySheet={() => setTallySheetParticipant(entry.participant)}
                    />
                  ))
                )}
              </CollapsibleReportSection>
            </CollapsibleReportSection>
          )}
        </div>
      </Modal>

      {timeCardParticipant && rangeValid && (
        <TimeCardModal
          participant={timeCardParticipant}
          shifts={regionShifts}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setTimeCardParticipant(null)}
        />
      )}

      {tallySheetParticipant && rangeValid && (
        <TallySheetModal
          participant={tallySheetParticipant}
          shifts={regionShifts}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setTallySheetParticipant(null)}
        />
      )}
    </>
  )
}

export function defaultReportRange(weekStart: string): { start: string; end: string } {
  const weekDates = getWeekDates(weekStart)
  return { start: weekDates[0], end: weekDates[6] }
}
