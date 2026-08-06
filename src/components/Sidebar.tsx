import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  formatHoursValue,
  getCoachHoursSummary,
  getParticipantHoursForWeek,
  getParticipantHoursTotal,
  isCoachingOnlyParticipant,
  participantHasAuthIssue,
  participantHasHoursIssue,
} from '../lib/scheduling'
import { formatAuthRange, getWeekDates } from '../lib/time'
import type { Coach, Participant } from '../types'
import { CoachModal } from './CoachModal'
import { ChevronIcon } from './ChevronIcon'
import { EyeIcon } from './EyeIcon'
import { ParticipantModal } from './ParticipantModal'
import { ShiftIcon } from './ShiftIcon'

interface SidebarProps {
  selectedParticipantId: string
  onSelectParticipant: (id: string) => void
  visibleCoachIds: Set<string>
  onToggleCoachVisibility: (coachId: string) => void
  visibleCoachShiftIds: Set<string>
  onToggleCoachShiftVisibility: (coachId: string) => void
  visibleParticipantIds: Set<string>
  onToggleParticipantVisibility: (participantId: string) => void
}

function CoachHoursLabel({ assigned, max }: { assigned: number; max: number }) {
  const display = Math.round(assigned * 10) / 10
  const maxDisplay = Math.round(max * 10) / 10
  const color =
    max > 0 && display > max
      ? 'text-red-400'
      : max > 0 && display >= max
        ? 'text-emerald-400'
        : max > 0 && display >= max * 0.75
          ? 'text-amber-400'
          : 'text-slate-400'

  return (
    <span className={`inline-block min-w-[2.75rem] text-right text-xs font-semibold tabular-nums ${color}`}>
      {display}/{maxDisplay}
    </span>
  )
}

function CoachRow({
  coach,
  weekDates,
  availabilityVisible,
  shiftsVisible,
  onEdit,
  onToggleAvailability,
  onToggleShiftsVisibility,
}: {
  coach: Coach
  weekDates: string[]
  availabilityVisible: boolean
  shiftsVisible: boolean
  onEdit: () => void
  onToggleAvailability: () => void
  onToggleShiftsVisibility: () => void
}) {
  const { state } = useStore()
  const summary = getCoachHoursSummary(coach, weekDates, state.shifts)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-0.5 rounded-md px-1 py-1 hover:bg-slate-800/60">
      <button
        onClick={onEdit}
        className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-1 py-1.5 text-left"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-600"
          style={{ backgroundColor: coach.color }}
        />
        <div className="min-w-0 overflow-hidden">
          <div className="truncate text-sm font-medium text-slate-100">{coach.name || 'Unnamed'}</div>
          <div className="truncate text-xs text-slate-500">
            {coach.startingLocation || 'No location'}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-center">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleShiftsVisibility()
          }}
          title={shiftsVisible ? 'Hide coached shifts on calendar' : 'Show coached shifts on calendar'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
            shiftsVisible ? 'text-blue-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'
          }`}
        >
          <EyeIcon visible={shiftsVisible} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleAvailability()
          }}
          title={availabilityVisible ? 'Hide availability on calendar' : 'Show availability on calendar'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
            availabilityVisible ? 'text-blue-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'
          }`}
        >
          <ShiftIcon visible={availabilityVisible} />
        </button>
        <div className="pl-0.5">
          <CoachHoursLabel assigned={summary.assigned} max={summary.max} />
        </div>
      </div>
    </div>
  )
}

function ParticipantRow({
  participant,
  weekDates,
  selected,
  visible,
  onSelect,
  onEdit,
  onToggleVisibility,
}: {
  participant: Participant
  weekDates: string[]
  selected: boolean
  visible: boolean
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onToggleVisibility: () => void
}) {
  const { state } = useStore()
  const [expanded, setExpanded] = useState(false)
  const weekHours = getParticipantHoursForWeek(participant, weekDates, state.shifts)
  const totalHours = getParticipantHoursTotal(participant.id, state.shifts)
  const hasAuthIssue = participantHasAuthIssue(participant, state.shifts)
  const hasHoursIssue = participantHasHoursIssue(participant, state.shifts)
  const coachingOnly = isCoachingOnlyParticipant(participant)

  const statLine = (label: string, value: number, suffix: 'worked' | 'coached') => (
    <div className="text-slate-400">
      <span className="text-slate-500">{label}: </span>
      <span className="tabular-nums text-slate-300">
        {formatHoursValue(value)} {suffix}
      </span>
    </div>
  )

  const fractionLine = (
    label: string,
    numerator: number,
    denominator: number,
    suffix: 'worked' | 'coached',
  ) => {
    const over = numerator > denominator
    return (
      <div className={over ? 'text-amber-400/90' : 'text-slate-400'}>
        <span className={over ? 'text-amber-500/80' : 'text-slate-500'}>{label}: </span>
        <span className={`tabular-nums ${over ? 'font-medium text-amber-300' : 'text-slate-300'}`}>
          {formatHoursValue(numerator)}/{formatHoursValue(denominator)} {suffix}
        </span>
      </div>
    )
  }

  const rowClass = hasAuthIssue
    ? selected
      ? 'border-red-500/70 bg-red-950/45 ring-1 ring-red-500/25'
      : 'border-red-500/50 bg-red-950/30 hover:bg-red-950/40'
    : hasHoursIssue
      ? selected
        ? 'border-amber-500/70 bg-amber-950/45 ring-1 ring-amber-500/25'
        : 'border-amber-500/50 bg-amber-950/30 hover:bg-amber-950/40'
      : selected
        ? 'border-blue-500/50 bg-blue-950/40'
        : 'border-transparent hover:bg-slate-800/60'

  return (
    <div
      className={`group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-0.5 rounded-md border px-2 py-2 ${rowClass}`}
    >
      <button onClick={onSelect} className="min-w-0 overflow-hidden text-left">
        <div className="truncate text-sm font-medium text-slate-100">
          {participant.name || 'Unnamed'}
        </div>
        {expanded && (
          <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed">
            <div className="text-slate-400">
              <span className="text-slate-500">Service: </span>
              <span className="text-slate-300">{participant.service}</span>
            </div>
            {!coachingOnly && statLine('Worked This Week', weekHours.totalWorkScheduled, 'worked')}
            {!coachingOnly &&
              fractionLine(
                'Total Hours Worked',
                totalHours.totalWork,
                participant.workingHoursPerWeek,
                'worked',
              )}
            {statLine('Coached Hours This Week', weekHours.coachedScheduled, 'coached')}
            {fractionLine(
              'Total Coached Hours',
              totalHours.totalCoached,
              participant.coachingHoursPerWeek,
              'coached',
            )}
            <div className={`pt-0.5 ${hasAuthIssue ? 'text-red-400' : 'text-slate-500'}`}>
              <span className={hasAuthIssue ? 'text-red-400/80' : 'text-slate-500'}>
                Authorization:{' '}
              </span>
              <span className={hasAuthIssue ? 'font-medium text-red-300' : 'text-slate-400'}>
                {formatAuthRange(participant.authStart, participant.authEnd)}
              </span>
              {hasAuthIssue && (
                <span className="mt-0.5 block text-[10px] text-red-400/90">
                  Shifts scheduled outside authorization range
                </span>
              )}
            </div>
            {participant.notes && (
              <div className="pt-0.5 text-slate-500">
                <span className="text-slate-500">Notes: </span>
                <span className="text-slate-400">{participant.notes}</span>
              </div>
            )}
          </div>
        )}
      </button>
      <div className="flex shrink-0 items-start">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          title={expanded ? 'Hide details' : 'Show details'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
        >
          <ChevronIcon expanded={expanded} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisibility()
          }}
          title={visible ? 'Hide shifts on calendar' : 'Show shifts on calendar'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
            visible ? 'text-blue-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'
          }`}
        >
          <EyeIcon visible={visible} />
        </button>
        <button
          onClick={onEdit}
          title="Edit participant"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-slate-300 ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          ✎
        </button>
      </div>
    </div>
  )
}

export function Sidebar({
  selectedParticipantId,
  onSelectParticipant,
  visibleCoachIds,
  onToggleCoachVisibility,
  visibleCoachShiftIds,
  onToggleCoachShiftVisibility,
  visibleParticipantIds,
  onToggleParticipantVisibility,
}: SidebarProps) {
  const { state, addCoach, addParticipant } = useStore()
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [isNewParticipant, setIsNewParticipant] = useState(false)

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])

  return (
    <>
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coaches
              </h2>
              <button
                onClick={() => setEditingCoach(addCoach())}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:bg-slate-800"
              >
                + Add
              </button>
            </div>
            <div className="space-y-0.5">
              {state.coaches.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-600">No coaches yet</p>
              ) : (
                state.coaches.map((coach) => (
                  <CoachRow
                    key={coach.id}
                    coach={coach}
                    weekDates={weekDates}
                    availabilityVisible={visibleCoachIds.has(coach.id)}
                    shiftsVisible={visibleCoachShiftIds.has(coach.id)}
                    onEdit={() => setEditingCoach(coach)}
                    onToggleAvailability={() => onToggleCoachVisibility(coach.id)}
                    onToggleShiftsVisibility={() => onToggleCoachShiftVisibility(coach.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Participants
              </h2>
              <button
                onClick={() => {
                  const p = addParticipant()
                  setIsNewParticipant(true)
                  setEditingParticipant(p)
                  onSelectParticipant(p.id)
                }}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:bg-slate-800"
              >
                + Add
              </button>
            </div>
            <div className="space-y-0.5">
              {state.participants.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-600">No participants yet</p>
              ) : (
                state.participants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    weekDates={weekDates}
                    selected={p.id === selectedParticipantId}
                    visible={visibleParticipantIds.has(p.id)}
                    onSelect={() => onSelectParticipant(p.id)}
                    onToggleVisibility={() => onToggleParticipantVisibility(p.id)}
                    onEdit={(e) => {
                      e.stopPropagation()
                      setIsNewParticipant(false)
                      setEditingParticipant(p)
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {editingCoach && (
        <CoachModal coach={editingCoach} onClose={() => setEditingCoach(null)} />
      )}
      {editingParticipant && (
        <ParticipantModal
          participant={editingParticipant}
          isNew={isNewParticipant}
          onClose={() => {
            setEditingParticipant(null)
            setIsNewParticipant(false)
          }}
        />
      )}
    </>
  )
}
