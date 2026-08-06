import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { Sidebar } from './components/Sidebar'
import { WeekScheduler } from './components/WeekScheduler'

export default function App() {
  const { state } = useStore()
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    () => state.participants[0]?.id ?? '',
  )
  const [visibleCoachIds, setVisibleCoachIds] = useState<Set<string>>(() => new Set())
  const [visibleCoachShiftIds, setVisibleCoachShiftIds] = useState<Set<string>>(
    () => new Set(state.coaches.map((c) => c.id)),
  )
  const [visibleParticipantIds, setVisibleParticipantIds] = useState<Set<string>>(
    () => new Set(state.participants.map((p) => p.id)),
  )

  useEffect(() => {
    setVisibleCoachShiftIds((prev) => {
      const next = new Set(prev)
      for (const c of state.coaches) {
        next.add(c.id)
      }
      return next
    })
  }, [state.coaches])

  useEffect(() => {
    setVisibleParticipantIds((prev) => {
      const next = new Set(prev)
      for (const p of state.participants) {
        next.add(p.id)
      }
      return next
    })
  }, [state.participants])

  const validSelection =
    state.participants.find((p) => p.id === selectedParticipantId)?.id ??
    state.participants[0]?.id ??
    ''

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
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Schedule Maker</h1>
        <p className="text-xs text-slate-400">Plan shifts and match coach availability</p>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          selectedParticipantId={validSelection}
          onSelectParticipant={setSelectedParticipantId}
          visibleCoachIds={visibleCoachIds}
          onToggleCoachVisibility={toggleCoachVisibility}
          visibleCoachShiftIds={visibleCoachShiftIds}
          onToggleCoachShiftVisibility={toggleCoachShiftVisibility}
          visibleParticipantIds={visibleParticipantIds}
          onToggleParticipantVisibility={toggleParticipantVisibility}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 p-4">
          <WeekScheduler
            selectedParticipantId={validSelection}
            visibleCoachIds={visibleCoachIds}
            visibleCoachShiftIds={visibleCoachShiftIds}
            visibleParticipantIds={visibleParticipantIds}
          />
        </div>
      </div>
    </div>
  )
}
