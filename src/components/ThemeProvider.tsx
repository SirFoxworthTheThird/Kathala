import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { APP_THEMES, themeClass } from '@/lib/themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const activeWorldTheme = useAppStore((s) => s.activeWorldTheme)

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove(...APP_THEMES.map((item) => `theme-${item.id}`))
    const effectiveTheme = activeWorldTheme ?? themeClass(theme)
    if (effectiveTheme) html.classList.add(effectiveTheme)
  }, [activeWorldTheme, theme])

  return <>{children}</>
}
