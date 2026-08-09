import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store/useStore'
import { filterCoachesByRegion, filterOtherCoachingByRegion, filterOtherCoachingForWeekView, filterParticipantsByRegion, filterParticipantsForWeekView, filterShiftsByRegion } from './lib/regions'
import { resolveSelectedAuthorization } from './lib/authorizations'
import { collectSchedulingIssueKeys, isAuthorizationFullyScheduled } from './lib/scheduling'
import { playSound, playWarningSound } from './lib/sounds'
import { getWeekDates } from './lib/time'
import { Sidebar } from './components/Sidebar'
import { WeekScheduler } from './components/WeekScheduler'
import { ConfettiCelebration } from './components/ConfettiCelebration'

const CELEBRATION_HOLD_MS = 5000
const CELEBRATION_FADE_MS = 2500

export default function App() {
  const { state } = useStore()

  const regionAllParticipants = useMemo(
    () => filterParticipantsByRegion(state.participants, state.selectedRegionId),
    [state.participants, state.selectedRegionId],
  )

  const [celebration, setCelebration] = useState<{
    key: number
    name: string
    fading?: boolean
  } | null>(null)
  const scheduleStatusRef = useRef<Map<string, boolean>>(new Map())
  const scheduleTrackingReadyRef = useRef(false)
  const issueKeysRef = useRef<Set<string>>(new Set())
  const issueTrackingReadyRef = useRef(false)

  const [selectedAuthorizationByParticipant, setSelectedAuthorizationByParticipant] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    scheduleTrackingReadyRef.current = false
    scheduleStatusRef.current.clear()
    issueTrackingReadyRef.current = false
    issueKeysRef.current.clear()
  }, [state.selectedRegionId])

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const regionCoachesForIssues = useMemo(
    () => filterCoachesByRegion(state.coaches, state.selectedRegionId),
    [state.coaches, state.selectedRegionId],
  )
  const regionShiftsForIssues = useMemo(
    () =>
      filterShiftsByRegion(
        state.shifts,
        state.participants,
        state.selectedRegionId,
        state.otherCoachingActivities,
      ),
    [state.shifts, state.participants, state.selectedRegionId, state.otherCoachingActivities],
  )

  const regionOtherCoachingForIssues = useMemo(
    () => filterOtherCoachingByRegion(state.otherCoachingActivities, state.selectedRegionId),
    [state.otherCoachingActivities, state.selectedRegionId],
  )

  useEffect(() => {
    const issueKeys = collectSchedulingIssueKeys(
      regionShiftsForIssues,
      regionAllParticipants,
      regionCoachesForIssues,
      weekDates,
      regionOtherCoachingForIssues,
    )

    if (!issueTrackingReadyRef.current) {
      issueKeysRef.current = issueKeys
      issueTrackingReadyRef.current = true
      return
    }

    let hasNewIssue = false
    for (const key of issueKeys) {
      if (!issueKeysRef.current.has(key)) {
        hasNewIssue = true
        break
      }
    }

    if (hasNewIssue) {
      playWarningSound()
    }

    issueKeysRef.current = issueKeys
  }, [
    regionAllParticipants,
    regionCoachesForIssues,
    regionOtherCoachingForIssues,
    regionShiftsForIssues,
    weekDates,
  ])

  useEffect(() => {
    if (!scheduleTrackingReadyRef.current) {
      for (const p of regionAllParticipants) {
        for (const auth of p.authorizations) {
          scheduleStatusRef.current.set(
            `${p.id}:${auth.id}`,
            isAuthorizationFullyScheduled(auth, p.id, state.shifts),
          )
        }
      }
      scheduleTrackingReadyRef.current = true
      return
    }

    for (const p of regionAllParticipants) {
      for (const auth of p.authorizations) {
        const key = `${p.id}:${auth.id}`
        const nowFullyScheduled = isAuthorizationFullyScheduled(auth, p.id, state.shifts)
        const wasFullyScheduled = scheduleStatusRef.current.get(key) ?? false
        if (nowFullyScheduled && !wasFullyScheduled) {
          setCelebration({
            key: Date.now(),
            name: `${p.name || 'Participant'} (${auth.service})`,
          })
        }
        scheduleStatusRef.current.set(key, nowFullyScheduled)
      }
    }
  }, [regionAllParticipants, state.shifts])

  useEffect(() => {
    if (!celebration) return

    const fadeTimer = window.setTimeout(() => {
      setCelebration((current) => (current ? { ...current, fading: true } : null))
    }, CELEBRATION_HOLD_MS)

    const dismissTimer = window.setTimeout(() => {
      setCelebration(null)
    }, CELEBRATION_HOLD_MS + CELEBRATION_FADE_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [celebration?.key])

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
    if (id) playSound('select')
    setSelectedParticipantId(id)
    if (id) setSelectedOtherCoachingId('')
  }

  const selectAuthorization = (participantId: string, authorizationId: string) => {
    playSound('select')
    setSelectedAuthorizationByParticipant((prev) => ({
      ...prev,
      [participantId]: authorizationId,
    }))
  }

  const selectedParticipant = regionParticipants.find((p) => p.id === validSelection)
  const selectedAuthorization = selectedParticipant
    ? resolveSelectedAuthorization(
        selectedParticipant,
        selectedAuthorizationByParticipant[selectedParticipant.id],
      )
    : undefined

  const selectOtherCoaching = (id: string) => {
    if (id) playSound('select')
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
          <ConfettiCelebration trigger={celebration.key} />
          <div
            className={`pointer-events-none fixed left-1/2 top-5 z-[210] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-5 py-2.5 text-sm font-medium text-emerald-200 shadow-lg shadow-emerald-950/50 ${
              celebration.fading ? 'celebration-banner-out' : 'celebration-banner-in'
            }`}
          >
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
          selectedAuthorizationByParticipant={selectedAuthorizationByParticipant}
          onSelectAuthorization={selectAuthorization}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 p-4">
          <WeekScheduler
            selectedParticipantId={validSelection}
            selectedAuthorizationId={selectedAuthorization?.id ?? ''}
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
