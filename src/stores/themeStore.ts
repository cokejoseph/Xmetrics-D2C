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
  try { localStorage.setItem('xmetrics-theme', dark ? 'dark' : 'light') } catch { /* storage unavailable (private mode) — theme still applies for the session */ }
}

/**
 * Flip the theme with every transition suppressed for the single frame in which
 * the `.dark` class changes. Without this, the ~170 elements carrying Tailwind
 * `transition-colors`/`transition-all` ease their colours over 150–300ms while
 * the body, cards and text snap instantly — producing a visible "tear" on every
 * toggle. We inject a global `transition:none` stylesheet, flip the class, force
 * a synchronous reflow so the new colours paint at once, then remove the override
 * on the next frame. (Same technique as next-themes' `disableTransitionOnChange`.)
 */
function applyThemeInstant(dark: boolean) {
  const override = document.createElement('style')
  override.appendChild(
    document.createTextNode(
      '*,*::before,*::after{transition:none !important;animation-duration:0s !important}'
    )
  )
  document.head.appendChild(override)

  applyTheme(dark)

  // Force the browser to compute styles now, so the override is in effect for the
  // class change, then drop it on the next frame and let transitions resume.
  void window.getComputedStyle(document.body).opacity
  requestAnimationFrame(() => {
    override.remove()
  })
}

// Apply before first render so there's no flash
const initialDark = getInitial()
applyTheme(initialDark)

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: initialDark,
  toggle: () => {
    const next = !get().dark
    applyThemeInstant(next)
    set({ dark: next })
  },
}))
