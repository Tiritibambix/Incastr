import type { CategoryShare } from '../types'

export function shareStatus(share: CategoryShare): 'active' | 'disabled' | 'expired' {
  if (!share.enabled) return 'disabled'
  if (share.expires_at && new Date(share.expires_at) < new Date()) return 'expired'
  return 'active'
}
