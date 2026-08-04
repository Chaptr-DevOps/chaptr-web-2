'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Keep in sync with the inline bootstrap script in app/layout.tsx. */
export const THEME_STORAGE_KEY = 'chaptr-theme'

type ThemeContextValue = {
  /** What the user picked — may be 'system'. */
  theme: ThemeMode
  /** What's actually painted right now. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
  /** False until after hydration; gate any UI that renders the current choice. */
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  el.classList.add(resolved)
  el.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server renders 'system'; the real value is read from storage after mount.
  // The inline script has already painted the correct colors by then.
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let stored: ThemeMode = 'system'
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY)
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw
    } catch {
      // private mode / storage blocked — fall back to system
    }
    setThemeState(stored)
    setResolvedTheme(stored === 'system' ? systemTheme() : stored)
    setMounted(true)
  }, [])

  // Follow the OS while the user is on 'system'.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Paint whenever the resolved value changes (after the first mount).
  useEffect(() => {
    if (!mounted) return
    applyTheme(resolvedTheme)
  }, [mounted, resolvedTheme])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    const resolved = next === 'system' ? systemTheme() : next
    setResolvedTheme(resolved)
    applyTheme(resolved)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // non-fatal: the choice just won't survive a reload
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
