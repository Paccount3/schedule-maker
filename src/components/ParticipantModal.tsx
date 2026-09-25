import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { Participant } from '../types'
import {
  PARTICIPANT_CHECK_ADDRESS_MAX,
  PARTICIPANT_NOTES_MAX,
} from '../types'
import { useStore } from '../store/useStore'
import { useConfirm } from '../store/useConfirm'
import { participantDeleteConfirm } from '../lib/confirmMessages'
import { resolveSelectedAuthorization } from '../lib/authorizations'
import { hexToRgba } from '../lib/colors'
import { filterCoachesForWeekView } from '../lib/regions'
import {
  PARTICIPANT_NOTES_LABEL,
  validateParticipant,
  validationSummaryMessages,
} from '../lib/participantValidation'
import { getCoachHoursSummary } from '../lib/scheduling'
import {
  getSlotShortageHint,
  pickBestSlots,
  PREFERRED_SHIFT_OPTIONS,
  rankCoachesForParticipant,
  type PreferredShiftPeriod,
  type SuggestedSlot,
} from '../lib/slotSuggestions'
import {
  formatWeekLabel,
  formatWeekOffsetLabel,
  getWeekDates,
  weekOffsetFromCalendar,
  weekStartForDate,
} from '../lib/time'
import { Modal } from './Modal'
import { AuthorizationsEditor } from './AuthorizationsEditor'
import { CalendarScheduleHint } from './CalendarScheduleHint'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const NO_COACH_ID = ''

interface SiteFieldProps {
  initialValue: string
  draftRef: MutableRefObject<string>
  invalid?: boolean
  error?: string
  onCommit: (site: string) => void
  onClearError: () => void
}

/** Local draft state so typing the site does not re-render the modal or trigger slot math. */
function SiteField({
  initialValue,
  draftRef,
  invalid,
  error,
  onCommit,
  onClearError,
}: SiteFieldProps) {
  const [draft, setDraft] = useState(initialValue)

  useEffect(() => {
    setDraft(initialValue)
    draftRef.current = initialValue
  }, [initialValue, draftRef])

  return (
    <>
      <input
        className={`${inputClass} mt-1 ${invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        placeholder="Work site address"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          draftRef.current = next
          onClearError()
        }}
        onBlur={() => onCommit(draftRef.current)}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </>
  )
}

interface ParticipantModalProps {
  participant: Participant
  isNew?: boolean
  onClose: () => void
}

export function ParticipantModal({ participant: initial, isNew, onClose }: ParticipantModalProps) {
  const { state, updateParticipant, removeParticipant, addShifts } = useStore()
  const { confirm } = useConfirm()
  const [participant, setParticipant] = useState(initial)

  const [shiftDurationHours, setShiftDurationHours] = useState(isNew ? 4 : 3)
  const [shiftCount, setShiftCount] = useState(() => {
    const auth = initial.authorizations[0]
    return isNew ? 4 : Math.max(1, Math.ceil((auth?.coachingHours ?? 20) / 3))
  })
  const [planningAuthorizationId, setPlanningAuthorizationId] = useState(
    () =>
      initial.authorizations.find((a) => a.status === 'active')?.id ??
      initial.authorizations[0]?.id ??
      '',
  )
  const [selectedCoachId, setSelectedCoachId] = useState<string>(() => {
    if (isNew) return NO_COACH_ID
    const coaches = filterCoachesForWeekView(state.coaches, initial.regionId, state.weekStart)
    return coaches[0]?.id ?? NO_COACH_ID
  })
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [planShifts, setPlanShifts] = useState(isNew ?? false)
  const [preferredPeriod, setPreferredPeriod] = useState<PreferredShiftPeriod>('morning')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showValidationSummary, setShowValidationSummary] = useState(false)
  const siteDraftRef = useRef(initial.site)

  const commitSite = (site: string) => {
    siteDraftRef.current = site
    setParticipant((current) => (current.site === site ? current : { ...current, site }))
  }

  const participantForSave = (): Participant => {
    const site = siteDraftRef.current
    return participant.site === site ? participant : { ...participant, site }
  }

  const enableCoachScheduling = () => {
    commitSite(siteDraftRef.current)
  }

  const planningAuthorization = useMemo(
    () => resolveSelectedAuthorization(participant, planningAuthorizationId),
    [participant.authorizations, planningAuthorizationId],
  )

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const regionCoaches = useMemo(
    () => filterCoachesForWeekView(state.coaches, participant.regionId, state.weekStart),
    [state.coaches, participant.regionId, state.weekStart],
  )

  const coachSchedulingEnabled = selectedCoachId !== NO_COACH_ID

  const coachRankings = useMemo(() => {
    if (!planningAuthorization || !coachSchedulingEnabled) return []
    return rankCoachesForParticipant(
      regionCoaches,
      participant,
      planningAuthorization,
      state.weekStart,
      weekDates,
      state.shifts,
      shiftDurationHours,
      shiftCount,
      preferredPeriod,
    )
  }, [
    regionCoaches,
    participant.id,
    participant.authorizations,
    planningAuthorization,
    state.weekStart,
    weekDates,
    state.shifts,
    shiftDurationHours,
    shiftCount,
    preferredPeriod,
    coachSchedulingEnabled,
  ])

  const selectedCoach = regionCoaches.find((c) => c.id === selectedCoachId)

  const suggestedSlots = useMemo(() => {
    if (!selectedCoach || !planShifts || !planningAuthorization || !coachSchedulingEnabled) {
      return []
    }
    return pickBestSlots(
      selectedCoach,
      participant,
      planningAuthorization,
      state.weekStart,
      state.shifts,
      shiftDurationHours,
      shiftCount,
      preferredPeriod,
    )
  }, [
    selectedCoach,
    participant.id,
    participant.authorizations,
    planningAuthorization,
    state.weekStart,
    state.shifts,
    shiftDurationHours,
    shiftCount,
    planShifts,
    preferredPeriod,
    coachSchedulingEnabled,
  ])

  useEffect(() => {
    if (planShifts && suggestedSlots.length > 0) {
      setSelectedSlotIds(new Set(suggestedSlots.map((s) => s.id)))
    } else {
      setSelectedSlotIds(new Set())
    }
  }, [suggestedSlots, planShifts, selectedCoachId, shiftDurationHours, shiftCount, preferredPeriod])

  useEffect(() => {
    if (!selectedCoachId) return
    if (coachRankings.length > 0 && !coachRankings.find((r) => r.coach.id === selectedCoachId)) {
      setSelectedCoachId(coachRankings[0].coach.id)
    }
  }, [coachRankings, selectedCoachId])

  const selectedSlots = suggestedSlots.filter((s) => selectedSlotIds.has(s.id))
  const plannedHours = selectedSlots.length * shiftDurationHours
  const willScheduleOnSave = planShifts && selectedSlots.length > 0 && !!selectedCoach

  const save = () => {
    const toSave = participantForSave()
    const errors = validateParticipant(toSave)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setShowValidationSummary(true)
      return
    }

    setShowValidationSummary(false)
    updateParticipant(toSave)

    if (planShifts && selectedSlots.length > 0 && selectedCoach && planningAuthorization) {
      addShifts(
        selectedSlots.map((slot) => ({
          participantId: toSave.id,
          authorizationId: planningAuthorization.id,
          date: slot.date,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          type: 'coached' as const,
          coachId: selectedCoach.id,
        })),
      )
    }

    onClose()
  }

  const handleCancel = () => {
    if (isNew) removeParticipant(participant.id)
    onClose()
  }

  const handleDelete = async () => {
    const ok = await confirm(participantDeleteConfirm(participant.name))
    if (!ok) return
    removeParticipant(participant.id)
    onClose()
  }

  const toggleSlot = (slot: SuggestedSlot) => {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev)
      if (next.has(slot.id)) {
        next.delete(slot.id)
      } else {
        for (const other of suggestedSlots) {
          if (other.date === slot.date && other.id !== slot.id) {
            next.delete(other.id)
          }
        }
        next.add(slot.id)
      }
      return next
    })
  }

  const coachSummary = selectedCoach
    ? getCoachHoursSummary(selectedCoach, weekDates, state.shifts)
    : null

  const projectedCoachHours = coachSummary
    ? coachSummary.assigned +
      selectedSlots.filter((s) => weekDates.includes(s.date)).length * shiftDurationHours
    : 0

  const slotShortageHint = planningAuthorization
    ? getSlotShortageHint(
        planningAuthorization,
        state.weekStart,
        shiftCount,
        suggestedSlots.length,
      )
    : null

  const slotsSpanWeeks =
    suggestedSlots.length > 0 &&
    new Set(suggestedSlots.map((s) => weekStartForDate(s.date))).size > 1

  const validationMessages = validationSummaryMessages(fieldErrors)

  return (
    <Modal
      wide
      title={isNew ? 'New Participant' : participant.name ? `Edit ${participant.name}` : 'Edit Participant'}
      subtitle={
        isNew
          ? `Starting week of ${formatWeekLabel(state.weekStart)} — slots may include upcoming weeks`
          : undefined
      }
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
              {isNew && willScheduleOnSave
                ? `Save & schedule ${selectedSlots.length} shift${selectedSlots.length !== 1 ? 's' : ''}`
                : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {showValidationSummary && validationMessages.length > 0 && (
          <div className="rounded-md border border-red-800/50 bg-red-950/30 px-4 py-3">
            <p className="text-sm font-medium text-red-200">
              Please complete the required fields before saving:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-200/90">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Name <span className="text-red-400">*</span>
            </span>
            <input
              className={`${inputClass} mt-1 ${fieldErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Participant name"
              value={participant.name}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.name
                  return next
                })
                setParticipant({ ...participant, name: e.target.value })
              }}
            />
            {fieldErrors.name && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.name}</span>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">Region</span>
            <select
              className={`${inputClass} mt-1`}
              value={participant.regionId}
              onChange={(e) => setParticipant({ ...participant, regionId: e.target.value })}
            >
              {state.regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Phone <span className="text-red-400">*</span>
            </span>
            <input
              className={`${inputClass} mt-1 ${fieldErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Phone number"
              type="tel"
              value={participant.phone}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.phone
                  return next
                })
                setParticipant({ ...participant, phone: e.target.value })
              }}
            />
            {fieldErrors.phone && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.phone}</span>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Counselor Name <span className="text-red-400">*</span>
            </span>
            <input
              className={`${inputClass} mt-1 ${fieldErrors.counselorName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Counselor name"
              value={participant.counselorName}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.counselorName
                  return next
                })
                setParticipant({ ...participant, counselorName: e.target.value })
              }}
            />
            {fieldErrors.counselorName && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.counselorName}</span>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Site <span className="text-red-400">*</span>
            </span>
            <SiteField
              initialValue={participant.site}
              draftRef={siteDraftRef}
              invalid={!!fieldErrors.site}
              error={fieldErrors.site}
              onCommit={commitSite}
              onClearError={() =>
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.site
                  return next
                })
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Site Contact <span className="text-red-400">*</span>
            </span>
            <input
              className={`${inputClass} mt-1 ${fieldErrors.siteContact ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Contact name at site"
              value={participant.siteContact}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.siteContact
                  return next
                })
                setParticipant({ ...participant, siteContact: e.target.value })
              }}
            />
            {fieldErrors.siteContact && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.siteContact}</span>
            )}
          </label>
          <AuthorizationsEditor
            participant={participant}
            onChange={setParticipant}
            fieldErrors={fieldErrors}
            onClearFieldError={(key) =>
              setFieldErrors((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
              })
            }
          />
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Best Participant Address for Checks <span className="text-red-400">*</span>
            </span>
            <textarea
              className={`${inputClass} mt-1 min-h-[3.25rem] resize-y ${fieldErrors.bestAddressForChecks ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Street address, city, state, ZIP"
              rows={2}
              maxLength={PARTICIPANT_CHECK_ADDRESS_MAX}
              value={participant.bestAddressForChecks}
              onChange={(e) => {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.bestAddressForChecks
                  return next
                })
                setParticipant({
                  ...participant,
                  bestAddressForChecks: e.target.value.slice(0, PARTICIPANT_CHECK_ADDRESS_MAX),
                })
              }}
            />
            {fieldErrors.bestAddressForChecks && (
              <span className="mt-1 block text-xs text-red-400">
                {fieldErrors.bestAddressForChecks}
              </span>
            )}
            <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
              {participant.bestAddressForChecks.length}/{PARTICIPANT_CHECK_ADDRESS_MAX}
            </span>
          </label>
        </div>

        {(isNew || planShifts) && (
          <>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">Assign coach</h4>
                {!isNew && (
                  <button
                    type="button"
                    onClick={() => setPlanShifts(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Hide
                  </button>
                )}
              </div>
              {regionCoaches.length === 0 ? (
                <p className="text-sm text-amber-400">Add a coach in this region to assign shifts.</p>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      enableCoachScheduling()
                      setSelectedCoachId(NO_COACH_ID)
                    }}
                    className={`flex w-full items-center rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedCoachId === NO_COACH_ID
                        ? 'border-slate-500 bg-slate-800/80'
                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium text-slate-300">NO COACH</span>
                    <span className="ml-2 text-xs text-slate-500">
                      Skip scheduling — assign a coach later on the calendar
                    </span>
                  </button>
                  {coachSchedulingEnabled
                    ? coachRankings.map(
                        ({ coach, assigned, maxHours, fitsAll, sameSite, slotCount }) => {
                          const selected = selectedCoachId === coach.id
                          const maxDisplay = Math.round(maxHours * 10) / 10
                          return (
                            <button
                              key={coach.id}
                              type="button"
                              onClick={() => {
                                enableCoachScheduling()
                                setSelectedCoachId(coach.id)
                              }}
                              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                selected
                                  ? 'border-blue-500 bg-blue-950/40'
                                  : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: coach.color }}
                                />
                                <span className="text-slate-200">{coach.name || 'Unnamed'}</span>
                                <span className="text-xs text-slate-500">{coach.startingLocation}</span>
                                {sameSite && (
                                  <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                    Same site
                                  </span>
                                )}
                                {!fitsAll && (
                                  <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                    Limited slots
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-3 text-xs tabular-nums">
                                <span className="text-slate-500">{slotCount} slots found</span>
                                <span
                                  className={
                                    maxHours > 0 && assigned > maxHours
                                      ? 'text-red-400'
                                      : maxHours > 0 && assigned >= maxHours * 0.75
                                        ? 'text-amber-400'
                                        : 'text-slate-400'
                                  }
                                >
                                  {Math.round(assigned * 10) / 10}/{maxDisplay}
                                </span>
                              </span>
                            </button>
                          )
                        },
                      )
                    : regionCoaches.map((coach) => (
                        <button
                          key={coach.id}
                          type="button"
                          onClick={() => {
                            enableCoachScheduling()
                            setSelectedCoachId(coach.id)
                          }}
                          className="flex w-full items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-left text-sm transition-colors hover:border-slate-600 hover:bg-slate-800"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: coach.color }}
                          />
                          <span className="text-slate-200">{coach.name || 'Unnamed'}</span>
                          <span className="text-xs text-slate-500">{coach.startingLocation}</span>
                        </button>
                      ))}
                </div>
              )}
            </div>

            {selectedCoachId && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-200">Schedule coached shifts</h4>
                <div className="space-y-4">
                {participant.authorizations.length > 1 && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">
                      Schedule for authorization
                    </span>
                    <select
                      className={`${inputClass} mt-1`}
                      value={planningAuthorizationId}
                      onChange={(e) => setPlanningAuthorizationId(e.target.value)}
                    >
                      {participant.authorizations.map((auth, index) => (
                        <option key={auth.id} value={auth.id}>
                          {auth.service} · {auth.status} · Auth {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Shift duration (hours)</span>
                    <select
                      className={`${inputClass} mt-1`}
                      value={shiftDurationHours}
                      onChange={(e) => setShiftDurationHours(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                        <option key={h} value={h}>
                          {h}h
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Number of shifts</span>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      className={`${inputClass} mt-1`}
                      value={shiftCount}
                      onChange={(e) =>
                        setShiftCount(Math.min(7, Math.max(1, Number(e.target.value))))
                      }
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-500">Max 1 shift per day</span>
                  </label>
                  <div className="block">
                    <span className="text-xs font-medium text-slate-400">Planned total</span>
                    <p className="mt-2 text-sm tabular-nums text-slate-300">
                      {plannedHours}h coached
                      {selectedSlots.length < shiftCount && (
                        <span className="ml-1 text-amber-400">
                          ({shiftCount - selectedSlots.length} slots unavailable)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {selectedCoach && coachSummary && (
                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      backgroundColor: hexToRgba(selectedCoach.color, 0.1),
                      borderLeft: `3px solid ${selectedCoach.color}`,
                    }}
                  >
                    <span className="font-medium text-slate-200">{selectedCoach.name}</span>
                    <span className="ml-2 tabular-nums text-slate-400">
                      currently {coachSummary.assigned}/{coachSummary.max}h
                      {selectedSlots.length > 0 && (
                        <span className="text-slate-300">
                          {' '}
                          → {projectedCoachHours}/{coachSummary.max}h after scheduling
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div>
                      <span className="text-xs font-medium text-slate-400">Preferred shifts</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(Object.keys(PREFERRED_SHIFT_OPTIONS) as PreferredShiftPeriod[]).map(
                          (period) => {
                            const option = PREFERRED_SHIFT_OPTIONS[period]
                            const active = preferredPeriod === period
                            return (
                              <button
                                key={period}
                                type="button"
                                onClick={() => setPreferredPeriod(period)}
                                className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                  active
                                    ? 'border-blue-500 bg-blue-950/50 text-blue-200'
                                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                              >
                                {option.label}
                              </button>
                            )
                          },
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {preferredPeriod === 'coach-best'
                          ? 'Uses the selected coach\u2019s full availability each day (not limited to morning or afternoon).'
                          : 'Only shows times when the coach is available during this window (varies by day).'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-400">
                        Suggested times (earliest first)
                      </span>
                      {slotShortageHint && (
                        <p className="mt-1 text-xs text-amber-400">{slotShortageHint}</p>
                      )}
                      {slotsSpanWeeks && suggestedSlots.length >= shiftCount && (
                        <p className="mt-1 text-xs text-slate-500">
                          Slots span multiple weeks to reach {shiftCount} shifts.
                        </p>
                      )}
                      {suggestedSlots.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          No open{' '}
                          {preferredPeriod === 'coach-best'
                            ? 'coach availability'
                            : PREFERRED_SHIFT_OPTIONS[preferredPeriod].shortLabel.toLowerCase()}{' '}
                          slots fit {shiftDurationHours}h shifts. Try{' '}
                          {preferredPeriod === 'coach-best'
                            ? 'morning or afternoon'
                            : preferredPeriod === 'morning'
                              ? 'afternoon or best for coach'
                              : 'morning or best for coach'}
                          , another coach, or a shorter duration.
                        </p>
                      ) : (
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {suggestedSlots.map((slot) => {
                            const checked = selectedSlotIds.has(slot.id)
                            const weekOffset = weekOffsetFromCalendar(state.weekStart, slot.date)
                            const weekBadge =
                              weekOffset !== 0 ? formatWeekOffsetLabel(weekOffset) : null
                            return (
                              <label
                                key={slot.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                                  checked
                                    ? 'border-blue-600/50 bg-blue-950/30'
                                    : 'border-slate-700 hover:bg-slate-800/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSlot(slot)}
                                  className="mt-0.5 rounded border-slate-600 bg-slate-800"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-slate-200">{slot.label}</span>
                                    {weekBadge && (
                                      <span className="rounded border border-amber-500/60 bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                        {weekBadge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {slot.reasons.join(' · ')}
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}
          </>
        )}

        {!isNew && !planShifts && regionCoaches.length > 0 && (
          <button
            type="button"
            onClick={() => setPlanShifts(true)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Schedule coached shifts…
          </button>
        )}

        <label className="block">
          <span className="text-xs font-medium text-slate-400">
            {PARTICIPANT_NOTES_LABEL} <span className="text-red-400">*</span>
          </span>
          <input
            className={`${inputClass} mt-1 ${fieldErrors.notes ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            placeholder="Brief notes or risks for coaches"
            maxLength={PARTICIPANT_NOTES_MAX}
            value={participant.notes}
            onChange={(e) => {
              setFieldErrors((prev) => {
                const next = { ...prev }
                delete next.notes
                return next
              })
              setParticipant({
                ...participant,
                notes: e.target.value.slice(0, PARTICIPANT_NOTES_MAX),
              })
            }}
          />
          {fieldErrors.notes && (
            <span className="mt-1 block text-xs text-red-400">{fieldErrors.notes}</span>
          )}
          <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
            {participant.notes.length}/{PARTICIPANT_NOTES_MAX}
          </span>
        </label>

        {!willScheduleOnSave && <CalendarScheduleHint />}
      </div>
    </Modal>
  )
}
