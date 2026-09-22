import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store/useStore'
import { filterCoachesForWeekView, filterOtherCoachingByRegion, filterOtherCoachingForWeekView, filterParticipantsByRegion, filterParticipantsForWeekView, filterShiftsByRegion } from './lib/regions'
import { resolveSelectedAuthorization } from './lib/authorizations'
import { collectSchedulingIssueKeys, isAuthorizationFullyScheduled } from './lib/scheduling'
import { playSound, playWarningSound } from './lib/sounds'
import { getWeekDates } from './lib/time'
import { useIsMobile } from './hooks/useMediaQuery'
import { Sidebar } from './components/Sidebar'
import { WeekScheduler } from './components/WeekScheduler'
import { SettingsMenu } from './components/SettingsMenu'
import { MobileTopBar } from './components/MobileTopBar'

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
  const coachShiftVisibilityPrefRef = useRef<Map<string, boolean>>(new Map())
  const coachAvailabilityPrefRef = useRef<Map<string, boolean>>(new Map())
  const participantVisibilityPrefRef = useRef<Map<string, boolean>>(new Map())
  const otherCoachingVisibilityPrefRef = useRef<Map<string, boolean>>(new Map())

  const [selectedAuthorizationByParticipant, setSelectedAuthorizationByParticipant] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    scheduleTrackingReadyRef.current = false
    scheduleStatusRef.current.clear()
    issueTrackingReadyRef.current = false
    issueKeysRef.current.clear()
    coachShiftVisibilityPrefRef.current.clear()
    coachAvailabilityPrefRef.current.clear()
    participantVisibilityPrefRef.current.clear()
    otherCoachingVisibilityPrefRef.current.clear()
  }, [state.selectedRegionId])

  const weekDates = useMemo(() => getWeekDates(state.weekStart), [state.weekStart])
  const regionCoachesForIssues = useMemo(
    () => filterCoachesForWeekView(state.coaches, state.selectedRegionId, state.weekStart),
    [state.coaches, state.selectedRegionId, state.weekStart],
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
    () => filterCoachesForWeekView(state.coaches, state.selectedRegionId, state.weekStart),
    [state.coaches, state.selectedRegionId, state.weekStart],
  )
  const regionOtherCoaching = useMemo(
    () =>
      filterOtherCoachingForWeekView(
        state.otherCoachingActivities,
        state.selectedRegionId,
        state.weekStart,
      ),
    [state.otherCoachingActivities, state.selectedRegionId, state.weekStart],
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
    setVisibleCoachShiftIds(() => {
      const next = new Set<string>()
      for (const c of regionCoaches) {
        if (!coachShiftVisibilityPrefRef.current.has(c.id)) {
          coachShiftVisibilityPrefRef.current.set(c.id, true)
        }
        if (coachShiftVisibilityPrefRef.current.get(c.id)) next.add(c.id)
      }
      return next
    })
    setVisibleCoachIds(() => {
      const next = new Set<string>()
      for (const c of regionCoaches) {
        if (!coachAvailabilityPrefRef.current.has(c.id)) {
          coachAvailabilityPrefRef.current.set(c.id, false)
        }
        if (coachAvailabilityPrefRef.current.get(c.id)) next.add(c.id)
      }
      return next
    })
  }, [regionCoaches])

  useEffect(() => {
    setVisibleParticipantIds(() => {
      const next = new Set<string>()
      for (const p of regionParticipants) {
        if (!participantVisibilityPrefRef.current.has(p.id)) {
          participantVisibilityPrefRef.current.set(p.id, true)
        }
        if (participantVisibilityPrefRef.current.get(p.id)) next.add(p.id)
      }
      return next
    })
  }, [regionParticipants])

  useEffect(() => {
    setVisibleOtherCoachingIds(() => {
      const next = new Set<string>()
      for (const activity of regionOtherCoaching) {
        if (!otherCoachingVisibilityPrefRef.current.has(activity.id)) {
          otherCoachingVisibilityPrefRef.current.set(activity.id, true)
        }
        if (otherCoachingVisibilityPrefRef.current.get(activity.id)) next.add(activity.id)
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
      const makingVisible = !next.has(coachId)
      if (makingVisible) next.add(coachId)
      else next.delete(coachId)
      coachAvailabilityPrefRef.current.set(coachId, makingVisible)
      return next
    })
  }

  const toggleCoachShiftVisibility = (coachId: string) => {
    setVisibleCoachShiftIds((prev) => {
      const next = new Set(prev)
      const makingVisible = !next.has(coachId)
      if (makingVisible) next.add(coachId)
      else next.delete(coachId)
      coachShiftVisibilityPrefRef.current.set(coachId, makingVisible)
      return next
    })
  }

  const toggleOtherCoachingVisibility = (activityId: string) => {
    setVisibleOtherCoachingIds((prev) => {
      const next = new Set(prev)
      const makingVisible = !next.has(activityId)
      if (makingVisible) next.add(activityId)
      else next.delete(activityId)
      otherCoachingVisibilityPrefRef.current.set(activityId, makingVisible)
      return next
    })
  }

  const toggleParticipantVisibility = (participantId: string) => {
    setVisibleParticipantIds((prev) => {
      const next = new Set(prev)
      const makingVisible = !next.has(participantId)
      if (makingVisible) next.add(participantId)
      else next.delete(participantId)
      participantVisibilityPrefRef.current.set(participantId, makingVisible)
      return next
    })
  }

  const isMobile = useIsMobile()

  const mobileVisibleCoachShiftIds = useMemo(
    () => new Set(regionCoaches.map((c) => c.id)),
    [regionCoaches],
  )
  const mobileVisibleParticipantIds = useMemo(
    () => new Set(regionParticipants.map((p) => p.id)),
    [regionParticipants],
  )
  const mobileVisibleOtherCoachingIds = useMemo(
    () => new Set(regionOtherCoaching.map((a) => a.id)),
    [regionOtherCoaching],
  )

  const effectiveVisibleCoachIds = isMobile ? new Set<string>() : visibleCoachIds
  const effectiveVisibleCoachShiftIds = isMobile
    ? mobileVisibleCoachShiftIds
    : visibleCoachShiftIds
  const effectiveVisibleParticipantIds = isMobile
    ? mobileVisibleParticipantIds
    : visibleParticipantIds
  const effectiveVisibleOtherCoachingIds = isMobile
    ? mobileVisibleOtherCoachingIds
    : visibleOtherCoachingIds

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
      {celebration && (
        <div
          className={`pointer-events-none fixed left-1/2 top-5 z-[210] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-5 py-2.5 text-sm font-medium text-emerald-200 shadow-lg shadow-emerald-950/50 ${
            celebration.fading ? 'celebration-banner-out' : 'celebration-banner-in'
          }`}
        >
          {celebration.name} — all shifts scheduled!
        </div>
      )}
      <header className="hidden shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-3 md:flex">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Schedule Maker Pro</h1>
          <p className="text-xs text-slate-400">Plan shifts and match coach availability</p>
        </div>
        <SettingsMenu />
      </header>

      <MobileTopBar />

      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full md:flex">
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
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 p-1 md:p-4">
          <WeekScheduler
            selectedParticipantId={validSelection}
            selectedAuthorizationId={selectedAuthorization?.id ?? ''}
            selectedOtherCoachingId={validOtherCoachingSelection}
            visibleCoachIds={effectiveVisibleCoachIds}
            visibleCoachShiftIds={effectiveVisibleCoachShiftIds}
            visibleOtherCoachingIds={effectiveVisibleOtherCoachingIds}
            visibleParticipantIds={effectiveVisibleParticipantIds}
            mobileMode={isMobile}
          />
        </div>
      </div>
    </div>
  )
}
