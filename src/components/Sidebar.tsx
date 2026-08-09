import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  AUTHORIZATION_STATUS_LABELS,
  isCoachingOnlyAuthorization,
  resolveSelectedAuthorization,
} from '../lib/authorizations'
import {
  formatHoursValue,
  getAuthorizationFullyScheduledMessage,
  getAuthorizationHoursTotal,
  getCoachHoursSummary,
  getCoachSidebarIssueMessages,
  getOtherCoachingHoursForWeek,
  getParticipantHoursForWeek,
  isAuthorizationFullyScheduled,
  authorizationHasAuthIssue,
  participantHasAuthIssue,
  participantHasHoursIssue,
  participantWeekViewVisibilityRules,
} from '../lib/scheduling'
import { formatAuthRange, getWeekDates } from '../lib/time'
import { filterCoachesByRegion, filterOtherCoachingForWeekView, filterParticipantsForWeekView } from '../lib/regions'
import type { Coach, OtherCoachingActivity, Participant } from '../types'
import { CoachModal } from './CoachModal'
import { ChevronIcon } from './ChevronIcon'
import { EyeIcon } from './EyeIcon'
import { OtherCoachingModal } from './OtherCoachingModal'
import { ParticipantModal } from './ParticipantModal'
import { ShiftIcon } from './ShiftIcon'

interface SidebarProps {
  selectedParticipantId: string
  onSelectParticipant: (id: string) => void
  selectedOtherCoachingId: string
  onSelectOtherCoaching: (id: string) => void
  visibleCoachIds: Set<string>
  onToggleCoachVisibility: (coachId: string) => void
  visibleCoachShiftIds: Set<string>
  onToggleCoachShiftVisibility: (coachId: string) => void
  visibleOtherCoachingIds: Set<string>
  onToggleOtherCoachingVisibility: (id: string) => void
  visibleParticipantIds: Set<string>
  onToggleParticipantVisibility: (participantId: string) => void
  selectedAuthorizationByParticipant: Record<string, string>
  onSelectAuthorization: (participantId: string, authorizationId: string) => void
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
  onEdit: (e: React.MouseEvent) => void
  onToggleAvailability: () => void
  onToggleShiftsVisibility: () => void
}) {
  const { state } = useStore()
  const [expanded, setExpanded] = useState(false)
  const summary = getCoachHoursSummary(coach, weekDates, state.shifts)
  const issueMessages = getCoachSidebarIssueMessages(
    coach,
    weekDates,
    state.shifts,
    state.participants,
  )
  const hasIssue = issueMessages.length > 0

  const rowClass = hasIssue
    ? 'border-red-500/50 bg-red-950/30 hover:bg-red-950/40'
    : 'border-transparent hover:bg-slate-800/60'

  return (
    <div className={`group rounded-md border px-2 py-2 ${rowClass}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-0.5">
        <div className="min-w-0 text-left">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-600"
              style={{ backgroundColor: coach.color }}
            />
            <div className="min-w-0 overflow-hidden">
              <div className="truncate text-sm font-medium text-slate-100">
                {coach.name || 'Unnamed'}
              </div>
              <div className="truncate text-[10px] leading-snug text-slate-500">
                {coach.startingLocation || 'No location'}
              </div>
            </div>
          </div>
        </div>
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
          <button
            onClick={onEdit}
            title="Edit coach"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 opacity-0 transition-colors hover:bg-slate-700 hover:text-slate-300 group-hover:opacity-100"
          >
            ✎
          </button>
          <div className="flex h-7 items-center pl-0.5">
            <CoachHoursLabel assigned={summary.assigned} max={summary.max} />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-slate-800/80 pt-2 text-xs leading-normal">
          <p className="text-slate-400">
            <span className="text-slate-500">Phone: </span>
            <span className="break-words text-slate-300">{coach.phone || '—'}</span>
          </p>
          <p className="text-slate-400">
            <span className="text-slate-500">Notes: </span>
            <span className="break-words text-slate-300">{coach.notes || '—'}</span>
          </p>
          {issueMessages.length > 0 && (
            <div className="space-y-1 pt-1">
              {issueMessages.map((msg) => (
                <p key={msg} className="font-medium leading-snug text-red-400/90">
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ParticipantRow({
  participant,
  weekDates,
  selected,
  visible,
  selectedAuthorizationId,
  onSelect,
  onSelectAuthorization,
  onEdit,
  onToggleVisibility,
}: {
  participant: Participant
  weekDates: string[]
  selected: boolean
  visible: boolean
  selectedAuthorizationId?: string
  onSelect: () => void
  onSelectAuthorization: (authorizationId: string) => void
  onEdit: (e: React.MouseEvent) => void
  onToggleVisibility: () => void
}) {
  const { state } = useStore()
  const [expanded, setExpanded] = useState(false)
  const authorization = resolveSelectedAuthorization(participant, selectedAuthorizationId)
  const weekHours = authorization
    ? getParticipantHoursForWeek(authorization.id, weekDates, state.shifts, authorization)
    : null
  const totalHours = authorization
    ? getAuthorizationHoursTotal(authorization.id, state.shifts)
    : { totalWork: 0, totalCoached: 0 }
  const hasAuthIssue =
    participantHasAuthIssue(participant, state.shifts) ||
    (authorization
      ? authorizationHasAuthIssue(authorization, participant.id, state.shifts)
      : false)
  const hasHoursIssue = participantHasHoursIssue(
    participant,
    state.shifts,
    authorization?.id,
  )
  const fullyScheduled =
    !!authorization &&
    isAuthorizationFullyScheduled(authorization, participant.id, state.shifts)
  const fullyScheduledMessage = authorization
    ? getAuthorizationFullyScheduledMessage(authorization)
    : ''
  const coachingOnly = authorization ? isCoachingOnlyAuthorization(authorization) : false

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
      : fullyScheduled
        ? selected
          ? 'border-emerald-500/70 bg-emerald-950/45 ring-1 ring-emerald-500/25'
          : 'border-emerald-500/50 bg-emerald-950/35 hover:bg-emerald-950/45'
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
          <div className="mt-2 space-y-2">
            {selected && participant.authorizations.length > 0 && (
              <label className="block" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Scheduling authorization
                </span>
                <select
                  value={authorization?.id ?? ''}
                  onChange={(e) => onSelectAuthorization(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {participant.authorizations.map((auth) => (
                    <option key={auth.id} value={auth.id}>
                      {auth.service} · {AUTHORIZATION_STATUS_LABELS[auth.status]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {authorization && weekHours && (
              <div className="space-y-0.5 text-[11px] leading-relaxed">
                {participant.site && (
                  <div className="truncate text-slate-400">
                    <span className="text-slate-500">Site: </span>
                    <span className="text-slate-300">{participant.site}</span>
                  </div>
                )}
                <div className="text-slate-400">
                  <span className="text-slate-500">Service: </span>
                  <span className="text-slate-300">{authorization.service}</span>
                </div>
                <div className="font-mono text-slate-400">
                  <span className="text-slate-500">Auth #: </span>
                  <span className="text-slate-300">{authorization.authNumber}</span>
                </div>
                <div className={`${hasAuthIssue ? 'text-red-400' : 'text-slate-400'}`}>
                  <span className={hasAuthIssue ? 'text-red-400/80' : 'text-slate-500'}>
                    Dates:{' '}
                  </span>
                  <span className={hasAuthIssue ? 'font-medium text-red-300' : 'text-slate-300'}>
                    {formatAuthRange(authorization.authStart, authorization.authEnd)}
                  </span>
                  {authorization.status !== 'active' && (
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      Status: {AUTHORIZATION_STATUS_LABELS[authorization.status]}
                    </span>
                  )}
                  {hasAuthIssue && (
                    <span className="mt-0.5 block text-[10px] text-red-400/90">
                      Shifts missing authorization or outside date range
                    </span>
                  )}
                </div>

                {!coachingOnly && statLine('Worked This Week', weekHours.totalWorkScheduled, 'worked')}
                {!coachingOnly &&
                  fractionLine(
                    'Authorization Work Hours',
                    totalHours.totalWork,
                    authorization.workingHours,
                    'worked',
                  )}
                {statLine('Coached Hours This Week', weekHours.coachedScheduled, 'coached')}
                {fractionLine(
                  'Authorization Coached Hours',
                  totalHours.totalCoached,
                  authorization.coachingHours,
                  'coached',
                )}

                {fullyScheduled && (
                  <div className="pt-1 font-medium text-emerald-400">{fullyScheduledMessage}</div>
                )}

                {participant.notes && (
                  <div className="pt-0.5 text-slate-500">
                    <span className="text-slate-500">Notes: </span>
                    <span className="text-slate-400">{participant.notes}</span>
                  </div>
                )}
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

function OtherCoachingRow({
  activity,
  coachName,
  weekDates,
  selected,
  visible,
  onSelect,
  onToggleVisibility,
  onEdit,
}: {
  activity: OtherCoachingActivity
  coachName: string
  weekDates: string[]
  selected: boolean
  visible: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onEdit: (e: React.MouseEvent) => void
}) {
  const { state } = useStore()
  const weekHours = getOtherCoachingHoursForWeek(activity.id, weekDates, state.shifts)
  const weekShifts = state.shifts.filter(
    (s) =>
      s.type === 'other-coaching' &&
      s.otherCoachingActivityId === activity.id &&
      weekDates.includes(s.date),
  ).length

  const rowClass = selected
    ? 'border-teal-500/50 bg-teal-950/40'
    : 'border-transparent hover:bg-slate-800/60'

  return (
    <div
      className={`group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-0.5 rounded-md border px-2 py-2 ${rowClass}`}
    >
      <button onClick={onSelect} className="min-w-0 overflow-hidden text-left">
        <div className="truncate text-sm font-medium text-slate-100">{activity.name}</div>
        <div className="truncate text-[10px] leading-snug text-slate-500">
          {coachName || 'No coach assigned'}
        </div>
        <div className="mt-0.5 text-[10px] tabular-nums text-slate-400">
          {formatHoursValue(activity.hoursPerWeek)}h starting
          {weekShifts > 0
            ? ` · ${formatHoursValue(weekHours)}h on calendar this week`
            : ' · not scheduled this week'}
        </div>
        {activity.notes && (
          <div className="mt-0.5 truncate text-[10px] text-slate-500">{activity.notes}</div>
        )}
      </button>
      <div className="flex shrink-0 items-start">
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
          title="Edit other coaching assignment"
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
  selectedOtherCoachingId,
  onSelectOtherCoaching,
  visibleCoachIds,
  onToggleCoachVisibility,
  visibleCoachShiftIds,
  onToggleCoachShiftVisibility,
  visibleOtherCoachingIds,
  onToggleOtherCoachingVisibility,
  visibleParticipantIds,
  onToggleParticipantVisibility,
  selectedAuthorizationByParticipant,
  onSelectAuthorization,
}: SidebarProps) {
  const { state, addCoach, addParticipant, addOtherCoachingActivity, setSelectedRegionId, addRegion } =
    useStore()
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [editingOtherCoaching, setEditingOtherCoaching] = useState<OtherCoachingActivity | null>(
    null,
  )
  const [isNewParticipant, setIsNewParticipant] = useState(false)
  const [isNewOtherCoaching, setIsNewOtherCoaching] = useState(false)
  const [addingRegion, setAddingRegion] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
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
  const coachNameById = useMemo(
    () => new Map(regionCoaches.map((c) => [c.id, c.name || 'Unnamed'])),
    [regionCoaches],
  )

  const submitNewRegion = () => {
    const id = addRegion(newRegionName)
    if (id) {
      setSelectedRegionId(id)
      setNewRegionName('')
      setAddingRegion(false)
    }
  }

  return (
    <>
      <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="shrink-0 border-b border-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Region
            </h2>
            <button
              type="button"
              onClick={() => setAddingRegion((v) => !v)}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:bg-slate-800"
            >
              + Add
            </button>
          </div>
          <select
            value={state.selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {state.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          {addingRegion && (
            <div className="mt-2 flex gap-1">
              <input
                type="text"
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
                placeholder="Region name"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewRegion()
                }}
              />
              <button
                type="button"
                onClick={submitNewRegion}
                className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 border-b border-slate-800 p-3">
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
            {regionCoaches.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-600">No coaches in this region</p>
            ) : (
              regionCoaches.map((coach) => (
                <CoachRow
                  key={coach.id}
                  coach={coach}
                  weekDates={weekDates}
                  availabilityVisible={visibleCoachIds.has(coach.id)}
                  shiftsVisible={visibleCoachShiftIds.has(coach.id)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    setEditingCoach(coach)
                  }}
                  onToggleAvailability={() => onToggleCoachVisibility(coach.id)}
                  onToggleShiftsVisibility={() => onToggleCoachShiftVisibility(coach.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Other Coaching Assignments
            </h2>
            <button
              onClick={() => {
                const activity = addOtherCoachingActivity()
                setIsNewOtherCoaching(true)
                setEditingOtherCoaching(activity)
                onSelectOtherCoaching(activity.id)
                onSelectParticipant('')
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:bg-slate-800"
            >
              + Add
            </button>
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {regionOtherCoaching.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-600">
                Add office time, training, vacation, and other coach assignments.
              </p>
            ) : (
              regionOtherCoaching.map((activity) => (
                <OtherCoachingRow
                  key={activity.id}
                  activity={activity}
                  coachName={coachNameById.get(activity.coachId) ?? ''}
                  weekDates={weekDates}
                  selected={activity.id === selectedOtherCoachingId}
                  visible={visibleOtherCoachingIds.has(activity.id)}
                  onSelect={() => {
                    onSelectOtherCoaching(activity.id)
                    onSelectParticipant('')
                  }}
                  onToggleVisibility={() => onToggleOtherCoachingVisibility(activity.id)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    setIsNewOtherCoaching(false)
                    setEditingOtherCoaching(activity)
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Participants
            </h2>
            <button
              onClick={() => {
                const p = addParticipant()
                setIsNewParticipant(true)
                setEditingParticipant(p)
                onSelectParticipant(p.id)
                onSelectOtherCoaching('')
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:bg-slate-800"
            >
              + Add
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-0.5">
              {regionParticipants.length === 0 ? (
                <div className="space-y-2 px-2 py-3 text-xs leading-relaxed text-slate-300">
                  <p>No active participants for this week.</p>
                  <p>
                    Participants in this region appear here when any of these rules are met:
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {participantWeekViewVisibilityRules().map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                regionParticipants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    weekDates={weekDates}
                    selected={p.id === selectedParticipantId}
                    visible={visibleParticipantIds.has(p.id)}
                    selectedAuthorizationId={selectedAuthorizationByParticipant[p.id]}
                    onSelect={() => {
                      onSelectParticipant(p.id)
                      onSelectOtherCoaching('')
                    }}
                    onSelectAuthorization={(authorizationId) =>
                      onSelectAuthorization(p.id, authorizationId)
                    }
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
      {editingOtherCoaching && (
        <OtherCoachingModal
          activity={editingOtherCoaching}
          isNew={isNewOtherCoaching}
          onClose={() => {
            setEditingOtherCoaching(null)
            setIsNewOtherCoaching(false)
          }}
        />
      )}
    </>
  )
}
