import { create } from 'zustand'
import { DEMO_MODE, supabase } from '../lib/supabase'
import type { AuthUser } from '../types'

// ─── Hardcoded preview accounts ────────────────────────────────────────────
// These work in both demo mode and live mode (checked before Supabase auth).
const PREVIEW_ACCOUNTS: Record<string, { id: string; password: string }> = {
  'demo@xmetrics.app':    { id: 'user-demo-001', password: 'demo123' },
  'shopify@xmetrics.app': { id: 'user-demo-001', password: 'shopify123' },
}

const SESSION_KEY = 'xmetrics-session'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  initialize: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  initialize: () => {
    // Restore a persisted preview-account session (survives page reload, clears on tab close)
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        set({ user: JSON.parse(raw) as AuthUser, isLoading: false })
        return
      }
    } catch {}

    if (DEMO_MODE) {
      // No Supabase — just show login, no auto-login
      set({ isLoading: false })
      return
    }

    supabase!.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ? { id: session.user.id, email: session.user.email! } : null, isLoading: false })
    })

    supabase!.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ? { id: session.user.id, email: session.user.email! } : null })
    })
  },

  signIn: async (email, password) => {
    // Preview accounts — work in both demo and live mode
    const account = PREVIEW_ACCOUNTS[email.toLowerCase()]
    if (account && password === account.password) {
      const user: AuthUser = { id: account.id, email: email.toLowerCase() }
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
      set({ user })
      return { error: null }
    }

    if (DEMO_MODE) {
      return { error: 'Invalid email or password.' }
    }

    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  signUp: async (email, password) => {
    if (DEMO_MODE) {
      return { error: 'Sign up is not available in preview mode.' }
    }
    const { data, error } = await supabase!.auth.signUp({ email, password })
    if (!error && data.user) {
      set({ user: { id: data.user.id, email: data.user.email! } })
    }
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    if (!DEMO_MODE) await supabase!.auth.signOut()
    set({ user: null })
  },
}))
