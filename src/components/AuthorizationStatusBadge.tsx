import type { Authorization } from '../types'
import {
  authorizationStatusBadgeClass,
  formatAuthorizationStatusLabel,
} from '../lib/authorizations'

interface AuthorizationStatusBadgeProps {
  authorization: Authorization
  className?: string
}

export function AuthorizationStatusBadge({
  authorization,
  className = '',
}: AuthorizationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${authorizationStatusBadgeClass(authorization)} ${className}`}
    >
      {formatAuthorizationStatusLabel(authorization)}
    </span>
  )
}
