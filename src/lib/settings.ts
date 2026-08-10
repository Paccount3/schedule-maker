const SETTINGS_KEY = 'schedule-maker-settings'

export interface AppSettings {
  soundsFxEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  soundsFxEnabled: true,
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
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
