import { create } from 'zustand'
import { DEMO_MODE, supabase } from '../lib/supabase'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  initialize: () => void
  loginAsDemo: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  initialize: () => {
    if (DEMO_MODE) {
      set({ user: { id: 'user-demo-001', email: 'demo@centinal.app' }, isLoading: false })
      return
    }

    // Restore demo session across in-tab reloads (sessionStorage clears when tab closes)
    try {
      const demo = sessionStorage.getItem('centinal-demo')
      if (demo === '1') {
        set({ user: { id: 'user-demo-001', email: 'demo@centinal.app' }, isLoading: false })
        return
      }
    } catch {}

    supabase!.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ? { id: session.user.id, email: session.user.email! } : null, isLoading: false })
    })

    supabase!.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ? { id: session.user.id, email: session.user.email! } : null })
    })
  },

  loginAsDemo: () => {
    try { sessionStorage.setItem('centinal-demo', '1') } catch {}
    set({ user: { id: 'user-demo-001', email: 'demo@centinal.app' }, isLoading: false })
  },

  signIn: async (email, password) => {
    if (DEMO_MODE) {
      set({ user: { id: 'user-demo-001', email } })
      return { error: null }
    }
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  signUp: async (email, password) => {
    if (DEMO_MODE) {
      set({ user: { id: 'user-demo-001', email } })
      return { error: null }
    }
    const { data, error } = await supabase!.auth.signUp({ email, password })
    // Set user immediately so Onboarding can read it without waiting for onAuthStateChange
    if (!error && data.user) {
      set({ user: { id: data.user.id, email: data.user.email! } })
    }
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    try { sessionStorage.removeItem('centinal-demo') } catch {}
    if (!DEMO_MODE) await supabase!.auth.signOut()
    set({ user: null })
  },
}))
