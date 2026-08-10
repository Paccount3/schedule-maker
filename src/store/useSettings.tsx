import { createContext, useContext, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type AppSettings } from '../lib/settings'
import { setSoundsFxEnabled } from '../lib/sounds'

interface SettingsContextValue {
  settings: AppSettings
  setSoundsFxEnabled: (enabled: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings()
    setSoundsFxEnabled(loaded.soundsFxEnabled)
    return loaded
  })

  const updateSoundsFxEnabled = (enabled: boolean) => {
    setSoundsFxEnabled(enabled)
    setSettings((prev) => {
      const next = { ...prev, soundsFxEnabled: enabled }
      saveSettings(next)
      return next
    })
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSoundsFxEnabled: updateSoundsFxEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return ctx
}
