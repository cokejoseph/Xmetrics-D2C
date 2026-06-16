import { create } from 'zustand'

interface ThemeState {
  dark: boolean
  toggle: () => void
}

function getInitial(): boolean {
  try {
    const saved = localStorage.getItem('xmetrics-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  try { localStorage.setItem('xmetrics-theme', dark ? 'dark' : 'light') } catch {}
}

// Apply before first render so there's no flash
const initialDark = getInitial()
applyTheme(initialDark)

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: initialDark,
  toggle: () => {
    const next = !get().dark
    applyTheme(next)
    set({ dark: next })
  },
}))
