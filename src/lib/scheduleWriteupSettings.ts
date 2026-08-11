const ON_CALL_PHONE_KEY = 'schedule-maker-on-call-phone'

type OnCallPhoneStore = Record<string, string>

function storageKey(regionId: string, weekStart: string): string {
  return `${regionId}:${weekStart}`
}

function readStore(): OnCallPhoneStore {
  if (typeof window === 'undefined') return {}

  try {
    const raw = localStorage.getItem(ON_CALL_PHONE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as OnCallPhoneStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: OnCallPhoneStore): void {
  localStorage.setItem(ON_CALL_PHONE_KEY, JSON.stringify(store))
}

export function loadOnCallPhone(regionId: string, weekStart: string): string {
  return readStore()[storageKey(regionId, weekStart)] ?? ''
}

export function saveOnCallPhone(regionId: string, weekStart: string, phone: string): void {
  const store = readStore()
  const key = storageKey(regionId, weekStart)
  const trimmed = phone.trim()

  if (trimmed) {
    store[key] = trimmed
  } else {
    delete store[key]
  }

  writeStore(store)
}
