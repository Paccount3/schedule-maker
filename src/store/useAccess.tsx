import { createContext, useContext, useState, type ReactNode } from 'react'
import { canEditSchedule, matchAccessPassword, type AccessRole } from '../lib/access'
import { PasswordGate } from '../components/PasswordGate'

const STORAGE_KEY = 'schedule-maker-access-role'

interface AccessContextValue {
  role: AccessRole
  canEdit: boolean
  signOut: () => void
}

const AccessContext = createContext<AccessContextValue | null>(null)

function readStoredRole(): AccessRole | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === 'admin' || stored === 'coaches' || stored === 'team') return stored
  } catch {
    // ignore
  }
  return null
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AccessRole | null>(readStoredRole)

  const unlock = (password: string): boolean => {
    const matched = matchAccessPassword(password)
    if (!matched) return false
    sessionStorage.setItem(STORAGE_KEY, matched)
    setRole(matched)
    return true
  }

  const signOut = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setRole(null)
  }

  if (!role) {
    return <PasswordGate onUnlock={unlock} />
  }

  return (
    <AccessContext.Provider
      value={{
        role,
        canEdit: canEditSchedule(role),
        signOut,
      }}
    >
      {children}
    </AccessContext.Provider>
  )
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used within AccessProvider')
  return ctx
}
