import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store/useStore'
import { filterCoachesByRegion, filterOtherCoachingForWeekView, filterParticipantsByRegion, filterParticipantsForWeekView } from './lib/regions'
import { isParticipantFullyScheduled } from './lib/scheduling'
import { Sidebar } from './components/Sidebar'
import { WeekScheduler } from './components/WeekScheduler'
import { ConfettiCelebration } from './components/ConfettiCelebration'

export default function App() {
  const { state } = useStore()

  const regionAllParticipants = useMemo(
    () => filterParticipantsByRegion(state.participants, state.selectedRegionId),
    [state.participants, state.selectedRegionId],
  )

  const [celebration, setCelebration] = useState<{ key: number; name: string } | null>(null)
  const scheduleStatusRef = useRef<Map<string, boolean>>(new Map())
  const scheduleTrackingReadyRef = useRef(false)

  useEffect(() => {
    scheduleTrackingReadyRef.current = false
    scheduleStatusRef.current.clear()
  }, [state.selectedRegionId])

  useEffect(() => {
    if (!scheduleTrackingReadyRef.current) {
      for (const p of regionAllParticipants) {
        scheduleStatusRef.current.set(
          p.id,
          isParticipantFullyScheduled(p, state.shifts),
        )
      }
      scheduleTrackingReadyRef.current = true
      return
    }

    for (const p of regionAllParticipants) {
      const nowFullyScheduled = isParticipantFullyScheduled(p, state.shifts)
      const wasFullyScheduled = scheduleStatusRef.current.get(p.id) ?? false
      if (nowFullyScheduled && !wasFullyScheduled) {
        setCelebration({ key: Date.now(), name: p.name || 'Participant' })
      }
      scheduleStatusRef.current.set(p.id, nowFullyScheduled)
    }
  }, [regionAllParticipants, state.shifts])

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
  const regionCoaches = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
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

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    () => regionParticipants[0]?.id ?? '',
  )
  const [selectedOtherCoachingId, setSelectedOtherCoachingId] = useState('')
  const [visibleCoachIds, setVisibleCoachIds] = useState<Set<string>>(() => new Set())
  const [visibleCoachShiftIds, setVisibleCoachShiftIds] = useState<Set<string>>(
    () => new Set(regionCoaches.map((c) => c.id)),
  )
  const [visibleOtherCoachingIds, setVisibleOtherCoachingIds] = useState<Set<string>>(() => new Set())
  const [visibleParticipantIds, setVisibleParticipantIds] = useState<Set<string>>(
    () => new Set(regionParticipants.map((p) => p.id)),
  )

  useEffect(() => {
    setVisibleCoachShiftIds((prev) => {
      const next = new Set<string>()
      for (const c of regionCoaches) {
        if (prev.has(c.id)) next.add(c.id)
        else next.add(c.id)
      }
      return next
    })
    setVisibleCoachIds((prev) => {
      const next = new Set<string>()
      for (const c of regionCoaches) {
        if (prev.has(c.id)) next.add(c.id)
      }
      return next
    })
  }, [regionCoaches])

  useEffect(() => {
    setVisibleParticipantIds((prev) => {
      const next = new Set<string>()
      for (const p of regionParticipants) {
        if (prev.has(p.id)) next.add(p.id)
        else next.add(p.id)
      }
      return next
    })
  }, [regionParticipants])

  useEffect(() => {
    setVisibleOtherCoachingIds((prev) => {
      const next = new Set<string>()
      for (const activity of regionOtherCoaching) {
        if (prev.has(activity.id)) next.add(activity.id)
        else next.add(activity.id)
      }
      return next
    })
  }, [regionOtherCoaching])

  useEffect(() => {
    if (regionParticipants.length === 0) {
      setSelectedParticipantId('')
      return
    }
    const stillValid = regionParticipants.some((p) => p.id === selectedParticipantId)
    if (!stillValid) {
      setSelectedParticipantId(regionParticipants[0].id)
    }
  }, [regionParticipants, selectedParticipantId])

  useEffect(() => {
    if (selectedOtherCoachingId && !regionOtherCoaching.some((a) => a.id === selectedOtherCoachingId)) {
      setSelectedOtherCoachingId('')
    }
  }, [regionOtherCoaching, selectedOtherCoachingId])

  const validSelection =
    regionParticipants.find((p) => p.id === selectedParticipantId)?.id ??
    regionParticipants[0]?.id ??
    ''
  const validOtherCoachingSelection =
    regionOtherCoaching.find((a) => a.id === selectedOtherCoachingId)?.id ?? ''

  const selectParticipant = (id: string) => {
    setSelectedParticipantId(id)
    if (id) setSelectedOtherCoachingId('')
  }

  const selectOtherCoaching = (id: string) => {
    setSelectedOtherCoachingId(id)
    if (id) setSelectedParticipantId('')
  }

  const toggleCoachVisibility = (coachId: string) => {
    setVisibleCoachIds((prev) => {
      const next = new Set(prev)
      if (next.has(coachId)) next.delete(coachId)
      else next.add(coachId)
      return next
    })
  }

  const toggleCoachShiftVisibility = (coachId: string) => {
    setVisibleCoachShiftIds((prev) => {
      const next = new Set(prev)
      if (next.has(coachId)) next.delete(coachId)
      else next.add(coachId)
      return next
    })
  }

  const toggleOtherCoachingVisibility = (activityId: string) => {
    setVisibleOtherCoachingIds((prev) => {
      const next = new Set(prev)
      if (next.has(activityId)) next.delete(activityId)
      else next.add(activityId)
      return next
    })
  }

  const toggleParticipantVisibility = (participantId: string) => {
    setVisibleParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {celebration && (
        <>
          <ConfettiCelebration
            trigger={celebration.key}
            onComplete={() => setCelebration(null)}
          />
          <div className="pointer-events-none fixed left-1/2 top-5 z-[210] -translate-x-1/2 animate-pulse rounded-full border border-emerald-500/40 bg-emerald-950/90 px-5 py-2.5 text-sm font-medium text-emerald-200 shadow-lg shadow-emerald-950/50">
            {celebration.name} — all shifts scheduled!
          </div>
        </>
      )}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Schedule Maker</h1>
        <p className="text-xs text-slate-400">Plan shifts and match coach availability</p>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          selectedParticipantId={validSelection}
          onSelectParticipant={selectParticipant}
          selectedOtherCoachingId={validOtherCoachingSelection}
          onSelectOtherCoaching={selectOtherCoaching}
          visibleCoachIds={visibleCoachIds}
          onToggleCoachVisibility={toggleCoachVisibility}
          visibleCoachShiftIds={visibleCoachShiftIds}
          onToggleCoachShiftVisibility={toggleCoachShiftVisibility}
          visibleOtherCoachingIds={visibleOtherCoachingIds}
          onToggleOtherCoachingVisibility={toggleOtherCoachingVisibility}
          visibleParticipantIds={visibleParticipantIds}
          onToggleParticipantVisibility={toggleParticipantVisibility}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 p-4">
          <WeekScheduler
            selectedParticipantId={validSelection}
            selectedOtherCoachingId={validOtherCoachingSelection}
            visibleCoachIds={visibleCoachIds}
            visibleCoachShiftIds={visibleCoachShiftIds}
            visibleOtherCoachingIds={visibleOtherCoachingIds}
            visibleParticipantIds={visibleParticipantIds}
          />
        </div>
      </div>
    </div>
  )
}
