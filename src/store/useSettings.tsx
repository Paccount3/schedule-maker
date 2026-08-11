import { createContext, useContext, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type AppSettings } from '../lib/settings'
import { setSoundsFxEnabled, setSoundVolume } from '../lib/sounds'

interface SettingsContextValue {
  settings: AppSettings
  setSoundsFxEnabled: (enabled: boolean) => void
  setSoundVolume: (volume: number) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings()
    setSoundsFxEnabled(loaded.soundsFxEnabled)
    setSoundVolume(loaded.soundVolume)
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

  const updateSoundVolume = (volume: number) => {
    const clamped = Math.min(1, Math.max(0, volume))
    setSoundVolume(clamped)
    setSettings((prev) => {
      const next = { ...prev, soundVolume: clamped }
      saveSettings(next)
      return next
    })
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSoundsFxEnabled: updateSoundsFxEnabled,
        setSoundVolume: updateSoundVolume,
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
