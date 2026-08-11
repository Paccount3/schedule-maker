const SETTINGS_KEY = 'schedule-maker-settings'

export interface AppSettings {
  soundsFxEnabled: boolean
  soundVolume: number
}

const DEFAULT_SETTINGS: AppSettings = {
  soundsFxEnabled: true,
  soundVolume: 1,
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      soundsFxEnabled:
        typeof parsed.soundsFxEnabled === 'boolean'
          ? parsed.soundsFxEnabled
          : DEFAULT_SETTINGS.soundsFxEnabled,
      soundVolume:
        typeof parsed.soundVolume === 'number' && Number.isFinite(parsed.soundVolume)
          ? Math.min(1, Math.max(0, parsed.soundVolume))
          : DEFAULT_SETTINGS.soundVolume,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
