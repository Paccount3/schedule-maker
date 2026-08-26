import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppState, Coach, OtherCoachingActivity, Participant, Shift } from '../types'
import {
  filterCoachesByRegion,
  filterParticipantsByRegion,
  filterShiftsByRegion,
  regionIdFromName,
} from '../lib/regions'
import {
  createEmptyCoach,
  createEmptyOtherCoachingActivity,
  createEmptyParticipant,
  createOtherCoachingShift,
  createShift,
} from '../lib/storage'
import { buildCopiedShiftsFromPreviousWeek } from '../lib/scheduling'
import { playSound, playSoundOption, type SoundOption } from '../lib/sounds'
import {
  deleteCoach,
  deleteOtherCoaching,
  deleteParticipant,
  deleteShift,
  loadAppStateFromSupabase,
  loadUiPrefs,
  persistCoach,
  persistOtherCoaching,
  persistParticipant,
  persistRegion,
  persistShifts,
  saveUiPrefs,
} from '../lib/supabaseSync'
import { addDays, durationHours, endMinutesFromStartingHours, parseDateInput, startOfWeek, toDateInput, todayDateInput } from '../lib/time'
import { useAccess } from './useAccess'

interface StoreContextValue {
  state: AppState
  persistError: string | null
  setSelectedRegionId: (regionId: string) => void
  addRegion: (name: string) => string | null
  setWeekStart: (weekStart: string) => void
  prevWeek: () => void
  nextWeek: () => void
  goToToday: () => void
  addParticipant: () => Participant
  updateParticipant: (p: Participant) => void
  removeParticipant: (id: string) => void
  addCoach: () => Coach
  updateCoach: (c: Coach) => void
  removeCoach: (id: string, mode?: 'convert-to-solo' | 'keep-history') => void
  addOtherCoachingActivity: () => OtherCoachingActivity
  updateOtherCoachingActivity: (activity: OtherCoachingActivity) => void
  removeOtherCoachingActivity: (id: string) => void
  addShift: (shift: Omit<Shift, 'id'>, sound?: SoundOption) => Shift
  addShifts: (shifts: Omit<Shift, 'id'>[], sound?: SoundOption) => void
  updateShift: (shift: Shift, sound?: SoundOption) => void
  removeShift: (id: string, sound?: SoundOption) => void
  createQuickShift: (
    participantId: string,
    authorizationId: string,
    date: string,
    startMinutes: number,
    endMinutes: number,
    type?: 'solo' | 'coached',
  ) => Shift
  createQuickOtherCoachingShift: (
    activityId: string,
    coachId: string,
    date: string,
    startMinutes: number,
    endMinutes: number,
  ) => Shift
  copyShiftsFromPreviousWeek: () => number
}

const StoreContext = createContext<StoreContextValue | null>(null)

function emptyState(): AppState {
  return {
    regions: [],
    selectedRegionId: '',
    participants: [],
    coaches: [],
    otherCoachingActivities: [],
    shifts: [],
    weekStart: toDateInput(startOfWeek(new Date())),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { canEdit } = useAccess()
  const [state, setState] = useState<AppState>(emptyState)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await loadAppStateFromSupabase()
        if (cancelled) return
        setState(next)
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Failed to load schedule data')
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = (label: string, task: () => Promise<void>) => {
    if (!canEdit) return
    void task().then(
      () => setPersistError(null),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : `Failed to save (${label})`
        console.error(label, error)
        setPersistError(message)
      },
    )
  }

  const update = (fn: (prev: AppState) => AppState) => setState(fn)

  const value: StoreContextValue = {
    state,
    persistError,
    setSelectedRegionId: (regionId) =>
      update((s) => {
        if (!s.regions.some((r) => r.id === regionId)) return s
        saveUiPrefs({ ...loadUiPrefs(), selectedRegionId: regionId })
        return { ...s, selectedRegionId: regionId }
      }),
    addRegion: (name) => {
      if (!canEdit) return null
      const trimmed = name.trim()
      if (!trimmed) return null
      const existingIds = new Set(state.regions.map((r) => r.id))
      const id = regionIdFromName(trimmed, existingIds)
      const region = { id, name: trimmed }
      update((s) => ({
        ...s,
        regions: [...s.regions, region],
      }))
      persist('addRegion', () => persistRegion(region))
      return id
    },
    setWeekStart: (weekStart) =>
      update((s) => {
        saveUiPrefs({ ...loadUiPrefs(), weekStart })
        return { ...s, weekStart }
      }),
    prevWeek: () =>
      update((s) => {
        const weekStart = toDateInput(addDays(parseDateInput(s.weekStart), -7))
        saveUiPrefs({ ...loadUiPrefs(), weekStart })
        return { ...s, weekStart }
      }),
    nextWeek: () =>
      update((s) => {
        const weekStart = toDateInput(addDays(parseDateInput(s.weekStart), 7))
        saveUiPrefs({ ...loadUiPrefs(), weekStart })
        return { ...s, weekStart }
      }),
    goToToday: () =>
      update((s) => {
        const weekStart = toDateInput(startOfWeek(new Date()))
        saveUiPrefs({ ...loadUiPrefs(), weekStart })
        return { ...s, weekStart }
      }),
    addParticipant: () => {
      if (!canEdit) return createEmptyParticipant(state.selectedRegionId)
      const p = createEmptyParticipant(state.selectedRegionId)
      update((s) => ({ ...s, participants: [...s.participants, p] }))
      persist('addParticipant', () => persistParticipant(p))
      return p
    },
    updateParticipant: (p) => {
      if (!canEdit) return
      update((s) => ({
        ...s,
        participants: s.participants.map((x) => (x.id === p.id ? p : x)),
      }))
      persist('updateParticipant', () => persistParticipant(p))
    },
    removeParticipant: (id) => {
      if (!canEdit) return
      update((s) => ({
        ...s,
        participants: s.participants.filter((x) => x.id !== id),
        shifts: s.shifts.filter((x) => x.participantId !== id),
      }))
      persist('removeParticipant', () => deleteParticipant(id))
    },
    addCoach: () => {
      if (!canEdit) return createEmptyCoach(0, state.selectedRegionId)
      const regionCoaches = filterCoachesByRegion(state.coaches, state.selectedRegionId)
      const c = createEmptyCoach(regionCoaches.length, state.selectedRegionId)
      update((s) => ({ ...s, coaches: [...s.coaches, c] }))
      persist('addCoach', () => persistCoach(c))
      return c
    },
    updateCoach: (c) => {
      if (!canEdit) return
      update((s) => ({
        ...s,
        coaches: s.coaches.map((x) => (x.id === c.id ? c : x)),
      }))
      persist('updateCoach', () => persistCoach(c))
    },
    removeCoach: (id, mode = 'convert-to-solo') => {
      if (!canEdit) return

      if (mode === 'keep-history') {
        const existing = state.coaches.find((c) => c.id === id)
        if (!existing) return
        const inactivated: Coach = {
          ...existing,
          inactiveDate: existing.inactiveDate ?? todayDateInput(),
        }
        update((s) => ({
          ...s,
          coaches: s.coaches.map((c) => (c.id === id ? inactivated : c)),
        }))
        persist('deactivateCoach', () => persistCoach(inactivated))
        return
      }

      const deletedShiftIds = state.shifts
        .filter((sh) => sh.type === 'other-coaching' && sh.coachId === id)
        .map((sh) => sh.id)
      const convertedShifts = state.shifts
        .filter((sh) => sh.coachId === id && sh.type !== 'other-coaching')
        .map((sh) => ({ ...sh, coachId: undefined, type: 'solo' as const }))
      update((s) => ({
        ...s,
        coaches: s.coaches.filter((x) => x.id !== id),
        shifts: s.shifts
          .filter((sh) => !(sh.type === 'other-coaching' && sh.coachId === id))
          .map((sh) =>
            sh.coachId === id ? { ...sh, coachId: undefined, type: 'solo' as const } : sh,
          ),
      }))
      persist('removeCoach', () => deleteCoach(id, convertedShifts, deletedShiftIds))
    },
    addOtherCoachingActivity: () => {
      if (!canEdit) {
        return createEmptyOtherCoachingActivity(state.selectedRegionId, '', state.weekStart)
      }
      const regionCoaches = filterCoachesByRegion(state.coaches, state.selectedRegionId)
      const activity = createEmptyOtherCoachingActivity(
        state.selectedRegionId,
        regionCoaches[0]?.id ?? '',
        state.weekStart,
      )
      update((s) => ({
        ...s,
        otherCoachingActivities: [...s.otherCoachingActivities, activity],
      }))
      persist('addOtherCoaching', () => persistOtherCoaching(activity))
      return activity
    },
    updateOtherCoachingActivity: (activity) => {
      if (!canEdit) return
      const normalized = { ...activity, shiftsPerWeek: 1 }
      let relatedShifts: Shift[] = []
      update((s) => {
        const shifts = s.shifts.map((sh) => {
          if (sh.otherCoachingActivityId !== normalized.id || sh.type !== 'other-coaching') {
            return sh
          }
          const endMinutes = endMinutesFromStartingHours(
            sh.startMinutes,
            normalized.hoursPerWeek,
          )
          return {
            ...sh,
            coachId: normalized.coachId || sh.coachId,
            endMinutes: Math.max(sh.startMinutes + 30, endMinutes),
          }
        })
        relatedShifts = shifts.filter(
          (sh) => sh.otherCoachingActivityId === normalized.id && sh.type === 'other-coaching',
        )
        return {
          ...s,
          otherCoachingActivities: s.otherCoachingActivities.map((x) =>
            x.id === normalized.id ? normalized : x,
          ),
          shifts,
        }
      })
      persist('updateOtherCoaching', async () => {
        await persistOtherCoaching(normalized)
        await persistShifts(relatedShifts)
      })
    },
    removeOtherCoachingActivity: (id) => {
      if (!canEdit) return
      update((s) => ({
        ...s,
        otherCoachingActivities: s.otherCoachingActivities.filter((x) => x.id !== id),
        shifts: s.shifts.filter((x) => x.otherCoachingActivityId !== id),
      }))
      persist('removeOtherCoaching', () => deleteOtherCoaching(id))
    },
    addShift: (shiftData, sound) => {
      const shift: Shift = { ...shiftData, id: crypto.randomUUID() }
      if (!canEdit) return shift
      update((s) => ({ ...s, shifts: [...s.shifts, shift] }))
      persist('addShift', () => persistShifts([shift]))
      playSoundOption(sound, 'place')
      return shift
    },
    addShifts: (shiftsData, sound) => {
      if (!canEdit) return
      const newShifts: Shift[] = shiftsData.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
      }))
      update((s) => ({ ...s, shifts: [...s.shifts, ...newShifts] }))
      persist('addShifts', () => persistShifts(newShifts))
      playSoundOption(sound, newShifts.length > 1 ? 'bulk' : 'place')
    },
    updateShift: (shift, sound) => {
      if (!canEdit) return
      let relatedShifts: Shift[] = [shift]
      let relatedActivity: OtherCoachingActivity | undefined
      update((s) => {
        if (shift.type === 'other-coaching' && shift.otherCoachingActivityId) {
          const activityId = shift.otherCoachingActivityId
          const hoursPerWeek = durationHours(shift.startMinutes, shift.endMinutes)
          const coachId = shift.coachId
          const otherCoachingActivities = s.otherCoachingActivities.map((a) =>
            a.id === activityId
              ? {
                  ...a,
                  hoursPerWeek,
                  ...(coachId ? { coachId } : {}),
                }
              : a,
          )
          relatedActivity = otherCoachingActivities.find((a) => a.id === activityId)
          const shifts = s.shifts.map((sh) => {
            if (sh.id === shift.id) return shift
            if (sh.otherCoachingActivityId === activityId && sh.type === 'other-coaching' && coachId) {
              return { ...sh, coachId }
            }
            return sh
          })
          relatedShifts = shifts.filter(
            (sh) => sh.id === shift.id || (sh.otherCoachingActivityId === activityId && sh.type === 'other-coaching'),
          )
          return { ...s, otherCoachingActivities, shifts }
        }
        return {
          ...s,
          shifts: s.shifts.map((x) => (x.id === shift.id ? shift : x)),
        }
      })
      persist('updateShift', async () => {
        if (relatedActivity) await persistOtherCoaching(relatedActivity)
        await persistShifts(relatedShifts)
      })
      playSoundOption(sound, 'drop')
    },
    removeShift: (id, sound) => {
      if (!canEdit) return
      update((s) => ({ ...s, shifts: s.shifts.filter((x) => x.id !== id) }))
      persist('removeShift', () => deleteShift(id))
      playSoundOption(sound, 'delete')
    },
    createQuickShift: (participantId, authorizationId, date, startMinutes, endMinutes, type = 'solo') => {
      const shift = createShift(participantId, authorizationId, date, startMinutes, endMinutes, type)
      if (!canEdit) return shift
      update((s) => ({ ...s, shifts: [...s.shifts, shift] }))
      persist('createQuickShift', () => persistShifts([shift]))
      playSound('place')
      return shift
    },
    createQuickOtherCoachingShift: (activityId, coachId, date, startMinutes, endMinutes) => {
      const shift = createOtherCoachingShift(
        activityId,
        coachId,
        date,
        startMinutes,
        endMinutes,
      )
      if (!canEdit) return shift
      update((s) => ({ ...s, shifts: [...s.shifts, shift] }))
      persist('createQuickOtherCoachingShift', () => persistShifts([shift]))
      playSound('place')
      return shift
    },
    copyShiftsFromPreviousWeek: () => {
      if (!canEdit) return 0
      const regionParticipants = filterParticipantsByRegion(
        state.participants,
        state.selectedRegionId,
      )
      const regionShifts = filterShiftsByRegion(
        state.shifts,
        state.participants,
        state.selectedRegionId,
        state.otherCoachingActivities,
      )
      const copied = buildCopiedShiftsFromPreviousWeek(
        state.weekStart,
        regionShifts,
        regionParticipants,
      )
      if (copied.length === 0) return 0
      const newShifts: Shift[] = copied.map((d) => ({ ...d, id: crypto.randomUUID() }))
      update((s) => ({ ...s, shifts: [...s.shifts, ...newShifts] }))
      persist('copyShiftsFromPreviousWeek', () => persistShifts(newShifts))
      playSound('bulk')
      return copied.length
    },
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading schedule…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <p className="text-lg font-medium text-slate-100">Could not load schedule data</p>
        <p className="max-w-md text-sm text-slate-400">{loadError}</p>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <StoreContext.Provider value={value}>
      {persistError && (
        <div className="bg-red-950 px-4 py-2 text-center text-sm text-red-200">
          Could not save to the database: {persistError}
        </div>
      )}
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
