export function shareStatus(enabled: boolean, expiresAt: string | null): 'active' | 'disabled' | 'expired' {
  if (!enabled) return 'disabled'
  if (expiresAt && new Date(expiresAt) < new Date()) return 'expired'
  return 'active'
}
