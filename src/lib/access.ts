export type AccessRole = 'admin' | 'coaches' | 'team'

const PASSWORDS: Record<AccessRole, string> = {
  admin: import.meta.env.VITE_ACCESS_PASSWORD_ADMIN ?? '',
  coaches: import.meta.env.VITE_ACCESS_PASSWORD_COACHES ?? '',
  team: import.meta.env.VITE_ACCESS_PASSWORD_TEAM ?? '',
}

export function matchAccessPassword(password: string): AccessRole | null {
  if (!password) return null
  if (PASSWORDS.admin && password === PASSWORDS.admin) return 'admin'
  if (PASSWORDS.coaches && password === PASSWORDS.coaches) return 'coaches'
  if (PASSWORDS.team && password === PASSWORDS.team) return 'team'
  return null
}

export function canEditSchedule(role: AccessRole | null): boolean {
  return role === 'admin'
}
