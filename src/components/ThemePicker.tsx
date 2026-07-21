import { useEffect } from 'react'
import { Check, Palette } from 'lucide-react'
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

export function ThemePicker() {
  const { theme, setTheme } = useAppStore()
  const selected = APP_THEMES.find((item) => item.id === theme) ?? APP_THEMES[0]

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-all hover:border-[hsl(var(--ring)/0.55)] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        title={`Theme: ${selected.label}`}
        aria-label={`Change theme. Current theme: ${selected.label}`}
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="h-3.5 w-5 rounded-sm border border-white/15 shadow-inner" style={{ background: selected.swatch }} />
      </button>

      <div className="absolute right-0 top-full z-[99999] hidden pt-2 group-hover:block group-focus-within:block">
        <div className="w-72 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover)/0.97)] p-1.5 shadow-2xl backdrop-blur-xl">
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Story atmosphere
          </div>
          {APP_THEMES.map((item) => (
            <button
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={`grid w-full grid-cols-[2.75rem_1fr_1rem] items-center gap-2.5 rounded-md px-2 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] ${
                theme === item.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.7)] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-8 w-11 rounded border border-white/15 shadow-inner"
                style={{ background: item.swatch }}
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[hsl(var(--foreground))]">{item.icon} {item.label}</span>
                <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{item.description}</span>
              </span>
              {theme === item.id && <Check className="h-3.5 w-3.5 text-[hsl(var(--ring))]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
