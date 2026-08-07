import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppState, Coach, Participant, Shift } from '../types'
import {
  filterCoachesByRegion,
  filterParticipantsByRegion,
  filterShiftsByRegion,
  regionIdFromName,
} from '../lib/regions'
import {
  createEmptyCoach,
  createEmptyParticipant,
  createShift,
  loadState,
  saveState,
} from '../lib/storage'
import { buildCopiedShiftsFromPreviousWeek } from '../lib/scheduling'
import { addDays, parseDateInput, startOfWeek, toDateInput } from '../lib/time'

interface StoreContextValue {
  state: AppState
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
  removeCoach: (id: string) => void
  addShift: (shift: Omit<Shift, 'id'>) => Shift
  addShifts: (shifts: Omit<Shift, 'id'>[]) => void
  updateShift: (shift: Shift) => void
  removeShift: (id: string) => void
  createQuickShift: (
    participantId: string,
    date: string,
    startMinutes: number,
    endMinutes: number,
    type?: 'solo' | 'coached',
  ) => Shift
  copyShiftsFromPreviousWeek: () => number
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const update = (fn: (prev: AppState) => AppState) => setState(fn)

  const value: StoreContextValue = {
    state,
    setSelectedRegionId: (regionId) =>
      update((s) =>
        s.regions.some((r) => r.id === regionId)
          ? { ...s, selectedRegionId: regionId }
          : s,
      ),
    addRegion: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const existingIds = new Set(state.regions.map((r) => r.id))
      const id = regionIdFromName(trimmed, existingIds)
      update((s) => ({
        ...s,
        regions: [...s.regions, { id, name: trimmed }],
      }))
      return id
    },
    setWeekStart: (weekStart) => update((s) => ({ ...s, weekStart })),
    prevWeek: () =>
      update((s) => ({
        ...s,
        weekStart: toDateInput(addDays(parseDateInput(s.weekStart), -7)),
      })),
    nextWeek: () =>
      update((s) => ({
        ...s,
        weekStart: toDateInput(addDays(parseDateInput(s.weekStart), 7)),
      })),
    goToToday: () =>
      update((s) => ({ ...s, weekStart: toDateInput(startOfWeek(new Date())) })),
    addParticipant: () => {
      const p = createEmptyParticipant(state.selectedRegionId)
      update((s) => ({ ...s, participants: [...s.participants, p] }))
      return p
    },
    updateParticipant: (p) =>
      update((s) => ({
        ...s,
        participants: s.participants.map((x) => (x.id === p.id ? p : x)),
      })),
    removeParticipant: (id) =>
      update((s) => ({
        ...s,
        participants: s.participants.filter((x) => x.id !== id),
        shifts: s.shifts.filter((x) => x.participantId !== id),
      })),
    addCoach: () => {
      const regionCoaches = filterCoachesByRegion(state.coaches, state.selectedRegionId)
      const c = createEmptyCoach(regionCoaches.length, state.selectedRegionId)
      update((s) => ({ ...s, coaches: [...s.coaches, c] }))
      return c
    },
    updateCoach: (c) =>
      update((s) => ({
        ...s,
        coaches: s.coaches.map((x) => (x.id === c.id ? c : x)),
      })),
    removeCoach: (id) =>
      update((s) => ({
        ...s,
        coaches: s.coaches.filter((x) => x.id !== id),
        shifts: s.shifts.map((sh) =>
          sh.coachId === id ? { ...sh, coachId: undefined, type: 'solo' as const } : sh,
        ),
      })),
    addShift: (shiftData) => {
      const shift: Shift = { ...shiftData, id: crypto.randomUUID() }
      update((s) => ({ ...s, shifts: [...s.shifts, shift] }))
      return shift
    },
    addShifts: (shiftsData) => {
      const newShifts: Shift[] = shiftsData.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
      }))
      update((s) => ({ ...s, shifts: [...s.shifts, ...newShifts] }))
    },
    updateShift: (shift) =>
      update((s) => ({
        ...s,
        shifts: s.shifts.map((x) => (x.id === shift.id ? shift : x)),
      })),
    removeShift: (id) =>
      update((s) => ({ ...s, shifts: s.shifts.filter((x) => x.id !== id) })),
    createQuickShift: (participantId, date, startMinutes, endMinutes, type = 'solo') => {
      const shift = createShift(participantId, date, startMinutes, endMinutes, type)
      update((s) => ({ ...s, shifts: [...s.shifts, shift] }))
      return shift
    },
    copyShiftsFromPreviousWeek: () => {
      const regionParticipants = filterParticipantsByRegion(
        state.participants,
        state.selectedRegionId,
      )
      const regionShifts = filterShiftsByRegion(
        state.shifts,
        state.participants,
        state.selectedRegionId,
      )
      const copied = buildCopiedShiftsFromPreviousWeek(
        state.weekStart,
        regionShifts,
        regionParticipants,
      )
      if (copied.length === 0) return 0
      const newShifts: Shift[] = copied.map((d) => ({ ...d, id: crypto.randomUUID() }))
      update((s) => ({ ...s, shifts: [...s.shifts, ...newShifts] }))
      return copied.length
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
