import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { DEMO_MODE } from '../lib/supabase'
import type { BrandMember } from '../types'

type Role = BrandMember['role']

const ROLE_WEIGHT: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
}

// Permission policy:
//   VIEWER  — read-only everywhere
//   EDITOR  — day-to-day ops mutations (approve/hold orders, push OMS, resolve
//             exceptions, process returns, edit products/warehouses)
//   ADMIN   — EDITOR + manage team, integrations, brand & warehouse settings
//   OWNER   — everything, incl. billing / subscription
export function useCurrentRole(): Role {
  const { user } = useAuthStore()
  const { teamMembers } = useAppStore()

  // Demo is a single-user sandbox — always full access so nothing is gated.
  if (DEMO_MODE) return 'OWNER'
  if (!user) return 'VIEWER'

  const member = teamMembers.find(m => m.email === user.email || m.user_id === user.id)
  return member?.role ?? 'VIEWER'
}

function useAtLeast(role: Role): boolean {
  return ROLE_WEIGHT[useCurrentRole()] >= ROLE_WEIGHT[role]
}

/** EDITOR+ — can perform day-to-day operational mutations. */
export function useCanEdit(): boolean {
  return useAtLeast('EDITOR')
}

/** ADMIN+ — can manage team members, integrations, and brand/warehouse settings. */
export function useCanManage(): boolean {
  return useAtLeast('ADMIN')
}

/** OWNER only — billing and subscription changes. */
export function useIsOwner(): boolean {
  return useAtLeast('OWNER')
}

/** EDITOR+ — may view financial figures (margins, payouts, cost). */
export function useCanViewFinancials(): boolean {
  return useAtLeast('EDITOR')
}
