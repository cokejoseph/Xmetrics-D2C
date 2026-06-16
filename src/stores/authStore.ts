import { create } from 'zustand'
import { DEMO_MODE, supabase } from '../lib/supabase'
import type { AuthUser } from '../types'

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
    // Restore persisted session (survives page reload, clears on tab close)
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        set({ user: JSON.parse(raw) as AuthUser, isLoading: false })
        return
      }
    } catch {}

    if (DEMO_MODE) {
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
    if (DEMO_MODE) {
      return { error: 'Invalid email or password.' }
    }
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      const user: AuthUser = { id: data.user.id, email: data.user.email! }
      // Persist @xmetrics.app demo sessions across reloads
      if (email.endsWith('@xmetrics.app')) {
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
      }
    }
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
