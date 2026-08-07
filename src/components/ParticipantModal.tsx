import { useEffect, useMemo, useState } from 'react'
import type { Participant, ParticipantService } from '../types'
import {
  PARTICIPANT_AUTH_NUMBER_LENGTH,
  PARTICIPANT_CHECK_ADDRESS_MAX,
  PARTICIPANT_NOTES_MAX,
  PARTICIPANT_SERVICES,
  DEFAULT_PARTICIPANT_AUTH_NUMBER,
} from '../types'
import { useStore } from '../store/useStore'
import { hexToRgba } from '../lib/colors'
import { filterCoachesByRegion } from '../lib/regions'
import {
  getCoachHoursSummary,
  isCoachingOnlyParticipant,
} from '../lib/scheduling'
import {
  getSlotShortageHint,
  pickBestSlots,
  PREFERRED_SHIFT_WINDOWS,
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
import { CalendarScheduleHint } from './CalendarScheduleHint'
import { DateSelect } from './DateSelect'
import { AddressAutocomplete } from './AddressAutocomplete'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface ParticipantModalProps {
  participant: Participant
  isNew?: boolean
  onClose: () => void
}

export function ParticipantModal({ participant: initial, isNew, onClose }: ParticipantModalProps) {
  const { state, updateParticipant, removeParticipant, addShifts } = useStore()
  const [participant, setParticipant] = useState(initial)

  const [shiftDurationHours, setShiftDurationHours] = useState(isNew ? 4 : 3)
  const [shiftCount, setShiftCount] = useState(
    isNew ? 4 : Math.max(1, Math.ceil(initial.coachingHoursPerWeek / 3)),
  )
  const [selectedCoachId, setSelectedCoachId] = useState<string>(() => {
    const coaches = filterCoachesByRegion(state.coaches, initial.regionId)
    return coaches[0]?.id ?? ''
  })
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [planShifts, setPlanShifts] = useState(isNew ?? false)
  const [preferredPeriod, setPreferredPeriod] = useState<PreferredShiftPeriod>('morning')
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    site?: string
    authStart?: string
    authEnd?: string
    authNumber?: string
  }>({})

  const coachingOnly = isCoachingOnlyParticipant(participant)

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, participant.regionId),
    [state.coaches, participant.regionId],
  )

  const coachRankings = useMemo(
    () =>
      rankCoachesForParticipant(
        regionCoaches,
        participant,
        state.weekStart,
        weekDates,
        state.shifts,
        shiftDurationHours,
        shiftCount,
        preferredPeriod,
      ),
    [regionCoaches, participant, state.weekStart, weekDates, state.shifts, shiftDurationHours, shiftCount, preferredPeriod],
  )

  const selectedCoach = regionCoaches.find((c) => c.id === selectedCoachId)

  const suggestedSlots = useMemo(() => {
    if (!selectedCoach || !planShifts) return []
    return pickBestSlots(
      selectedCoach,
      participant,
      state.weekStart,
      state.shifts,
      shiftDurationHours,
      shiftCount,
      preferredPeriod,
    )
  }, [
    selectedCoach,
    participant,
    state.weekStart,
    state.shifts,
    shiftDurationHours,
    shiftCount,
    planShifts,
    preferredPeriod,
  ])

  useEffect(() => {
    if (planShifts && suggestedSlots.length > 0) {
      setSelectedSlotIds(new Set(suggestedSlots.map((s) => s.id)))
    } else {
      setSelectedSlotIds(new Set())
    }
  }, [suggestedSlots, planShifts, selectedCoachId, shiftDurationHours, shiftCount, preferredPeriod])

  useEffect(() => {
    if (coachRankings.length > 0 && !coachRankings.find((r) => r.coach.id === selectedCoachId)) {
      setSelectedCoachId(coachRankings[0].coach.id)
    }
  }, [coachRankings, selectedCoachId])

  const selectedSlots = suggestedSlots.filter((s) => selectedSlotIds.has(s.id))
  const plannedHours = selectedSlots.length * shiftDurationHours
  const willScheduleOnSave = planShifts && selectedSlots.length > 0 && !!selectedCoach

  const save = () => {
    const errors: {
      name?: string
      site?: string
      authStart?: string
      authEnd?: string
      authNumber?: string
    } = {}
    if (!participant.name.trim()) errors.name = 'Name is required'
    if (!participant.site.trim()) errors.site = 'Work site is required'
    if (!participant.authStart?.trim()) errors.authStart = 'Authorization start is required'
    if (!participant.authEnd?.trim()) errors.authEnd = 'Authorization end is required'
    const authNumber = participant.authNumber?.trim() ?? ''
    if (!authNumber) {
      errors.authNumber = 'Authorization number is required'
    } else if (authNumber.length !== PARTICIPANT_AUTH_NUMBER_LENGTH) {
      errors.authNumber = `Authorization number must be exactly ${PARTICIPANT_AUTH_NUMBER_LENGTH} characters`
    }
    if (
      participant.authStart?.trim() &&
      participant.authEnd?.trim() &&
      participant.authEnd < participant.authStart
    ) {
      errors.authEnd = 'End date must be on or after the start date'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    updateParticipant(participant)

    if (planShifts && selectedSlots.length > 0 && selectedCoach) {
      addShifts(
        selectedSlots.map((slot) => ({
          participantId: participant.id,
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

  const handleDelete = () => {
    if (confirm(`Remove ${participant.name || 'this participant'}? All their shifts will be deleted.`)) {
      removeParticipant(participant.id)
      onClose()
    }
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

  const slotShortageHint = getSlotShortageHint(
    participant,
    state.weekStart,
    shiftCount,
    suggestedSlots.length,
  )

  const slotsSpanWeeks =
    suggestedSlots.length > 0 &&
    new Set(suggestedSlots.map((s) => weekStartForDate(s.date))).size > 1

  const setService = (service: ParticipantService) => {
    setParticipant((current) => ({
      ...current,
      service,
      workingHoursPerWeek:
        service === 'JC'
          ? 0
          : current.workingHoursPerWeek === 0
            ? 40
            : current.workingHoursPerWeek,
    }))
  }

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
                setFieldErrors((prev) => ({ ...prev, name: undefined }))
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
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Service</span>
            <select
              className={`${inputClass} mt-1`}
              value={participant.service}
              onChange={(e) => setService(e.target.value as ParticipantService)}
            >
              {PARTICIPANT_SERVICES.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Site <span className="text-red-400">*</span>
            </span>
            <AddressAutocomplete
              className={`${inputClass} mt-1`}
              placeholder="Work site address"
              value={participant.site}
              invalid={!!fieldErrors.site}
              onChange={(site) => {
                setFieldErrors((prev) => ({ ...prev, site: undefined }))
                setParticipant({ ...participant, site })
              }}
            />
            {fieldErrors.site && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.site}</span>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Site Contact</span>
            <input
              className={`${inputClass} mt-1`}
              placeholder="Contact name at site"
              value={participant.siteContact}
              onChange={(e) =>
                setParticipant({ ...participant, siteContact: e.target.value })
              }
            />
          </label>
          {!coachingOnly && (
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Working Hours / Week</span>
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-1`}
                value={participant.workingHoursPerWeek}
                onChange={(e) =>
                  setParticipant({ ...participant, workingHoursPerWeek: Number(e.target.value) })
                }
              />
            </label>
          )}
          <label className={`block ${coachingOnly ? 'sm:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-slate-400">Coaching Hours / Week</span>
            <input
              type="number"
              min={0}
              className={`${inputClass} mt-1`}
              value={participant.coachingHoursPerWeek}
              onChange={(e) => {
                const coachingHoursPerWeek = Number(e.target.value)
                setParticipant({ ...participant, coachingHoursPerWeek })
                if (isNew) {
                  setShiftCount(Math.max(1, Math.ceil(coachingHoursPerWeek / shiftDurationHours)))
                }
              }}
            />
            {coachingOnly && (
              <span className="mt-1 block text-[10px] text-slate-500">
                JC participants only require coaching hours.
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Authorization Start <span className="text-red-400">*</span>
            </span>
            <DateSelect
              className={`mt-1 ${fieldErrors.authStart ? '[&>button]:border-red-500' : ''}`}
              value={participant.authStart}
              onChange={(authStart) => {
                setParticipant({ ...participant, authStart })
                setFieldErrors((e) => ({ ...e, authStart: undefined, authEnd: undefined }))
              }}
            />
            {fieldErrors.authStart && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.authStart}</span>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Authorization End <span className="text-red-400">*</span>
            </span>
            <DateSelect
              className={`mt-1 ${fieldErrors.authEnd ? '[&>button]:border-red-500' : ''}`}
              value={participant.authEnd}
              onChange={(authEnd) => {
                setParticipant({ ...participant, authEnd })
                setFieldErrors((e) => ({ ...e, authEnd: undefined }))
              }}
            />
            {fieldErrors.authEnd && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.authEnd}</span>
            )}
            <span className="mt-1 block text-[10px] text-slate-500">
              Default authorization period is 90 days.
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">
              Authorization Number <span className="text-red-400">*</span>
            </span>
            <input
              className={`${inputClass} mt-1 font-mono tracking-wider ${fieldErrors.authNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder={DEFAULT_PARTICIPANT_AUTH_NUMBER}
              value={participant.authNumber}
              maxLength={PARTICIPANT_AUTH_NUMBER_LENGTH}
              onChange={(e) => {
                setFieldErrors((prev) => ({ ...prev, authNumber: undefined }))
                setParticipant({ ...participant, authNumber: e.target.value })
              }}
            />
            {fieldErrors.authNumber && (
              <span className="mt-1 block text-xs text-red-400">{fieldErrors.authNumber}</span>
            )}
            <span className="mt-1 block text-[10px] text-slate-500">
              {PARTICIPANT_AUTH_NUMBER_LENGTH} characters · default {DEFAULT_PARTICIPANT_AUTH_NUMBER}
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-400">Best Address for Checks</span>
            <textarea
              className={`${inputClass} mt-1 min-h-[3.25rem] resize-y`}
              placeholder="Street address, city, state, ZIP"
              rows={2}
              maxLength={PARTICIPANT_CHECK_ADDRESS_MAX}
              value={participant.bestAddressForChecks}
              onChange={(e) =>
                setParticipant({
                  ...participant,
                  bestAddressForChecks: e.target.value.slice(0, PARTICIPANT_CHECK_ADDRESS_MAX),
                })
              }
            />
            <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
              {participant.bestAddressForChecks.length}/{PARTICIPANT_CHECK_ADDRESS_MAX}
            </span>
          </label>
        </div>

        {(isNew || planShifts) && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">Schedule coached shifts</h4>
              {!isNew && (
                <button
                  onClick={() => setPlanShifts(!planShifts)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {planShifts ? 'Hide' : 'Show'}
                </button>
              )}
            </div>

            {planShifts && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Shift duration (hours)</span>
                    <select
                      className={`${inputClass} mt-1`}
                      value={shiftDurationHours}
                      onChange={(e) => {
                        const h = Number(e.target.value)
                        setShiftDurationHours(h)
                        if (isNew) {
                          setShiftCount(
                            Math.max(1, Math.ceil(participant.coachingHoursPerWeek / h)),
                          )
                        }
                      }}
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

                {regionCoaches.length === 0 ? (
                  <p className="text-sm text-amber-400">Add a coach in this region to assign shifts.</p>
                ) : (
                  <>
                    <div>
                      <span className="text-xs font-medium text-slate-400">Assign to coach</span>
                      <div className="mt-2 space-y-1">
                        {coachRankings.map(
                          ({ coach, assigned, maxHours, fitsAll, sameSite, slotCount }) => {
                            const selected = selectedCoachId === coach.id
                            const maxDisplay = Math.round(maxHours * 10) / 10
                            return (
                              <button
                                key={coach.id}
                                onClick={() => setSelectedCoachId(coach.id)}
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
                                  <span className="text-xs text-slate-500">
                                    {coach.startingLocation}
                                  </span>
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
                        )}
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
                      <div className="mt-1 flex gap-2">
                        {(Object.keys(PREFERRED_SHIFT_WINDOWS) as PreferredShiftPeriod[]).map(
                          (period) => {
                            const window = PREFERRED_SHIFT_WINDOWS[period]
                            const active = preferredPeriod === period
                            return (
                              <button
                                key={period}
                                type="button"
                                onClick={() => setPreferredPeriod(period)}
                                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                  active
                                    ? 'border-blue-500 bg-blue-950/50 text-blue-200'
                                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                              >
                                {window.label}
                              </button>
                            )
                          },
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Only shows times when the coach is available during this window (varies by
                        day)
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
                          No open {PREFERRED_SHIFT_WINDOWS[preferredPeriod].shortLabel.toLowerCase()}{' '}
                          slots fit {shiftDurationHours}h shifts. Try{' '}
                          {preferredPeriod === 'morning' ? 'afternoon' : 'morning'}, another coach,
                          or a shorter duration.
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
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-slate-400">Notes</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Short note (optional)"
            maxLength={PARTICIPANT_NOTES_MAX}
            value={participant.notes}
            onChange={(e) =>
              setParticipant({
                ...participant,
                notes: e.target.value.slice(0, PARTICIPANT_NOTES_MAX),
              })
            }
          />
          <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
            {participant.notes.length}/{PARTICIPANT_NOTES_MAX}
          </span>
        </label>

        {!willScheduleOnSave && <CalendarScheduleHint />}
      </div>
    </Modal>
  )
}
