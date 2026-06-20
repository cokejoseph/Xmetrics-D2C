import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import type { BrandMember } from '../types'

type Role = BrandMember['role']

const ROLE_WEIGHT: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
}

export function useCurrentRole(): Role {
  const { user } = useAuthStore()
  const { teamMembers } = useAppStore()

  if (!user) return 'VIEWER'

  const member = teamMembers.find(m => m.email === user.email || m.user_id === user.id)
  return member?.role ?? 'ADMIN'
}

export function useCanViewFinancials(): boolean {
  const role = useCurrentRole()
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT['EDITOR']
}
