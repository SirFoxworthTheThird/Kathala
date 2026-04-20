import { useEffect } from 'react'
import { Palette } from 'lucide-react'
import { useAppStore } from '@/store'
import type { AppTheme } from '@/store'

const THEMES: { id: AppTheme; label: string; icon: string; swatch: string }[] = [
  { id: 'default',   label: 'Dark Slate',  icon: '🌑', swatch: '#1e3a5f' },
  { id: 'fantasy',   label: 'Fantasy',     icon: '⚔️',  swatch: '#7c5c2a' },
  { id: 'scifi',     label: 'Sci-Fi',      icon: '🚀', swatch: '#0a3d5c' },
  { id: 'cyberpunk', label: 'Cyberpunk',   icon: '🤖', swatch: '#6b21a8' },
  { id: 'horror',    label: 'Horror',      icon: '🩸', swatch: '#5c0a0a' },
  { id: 'western',   label: 'Western',     icon: '🤠', swatch: '#5c3a1a' },
  { id: 'action',    label: 'Action',      icon: '💥', swatch: '#b84a00' },
  { id: 'noir',      label: 'Noir',        icon: '🎬', swatch: '#2a2a2a' },
  { id: 'romance',   label: 'Romance',     icon: '🌹', swatch: '#8b2252' },
]

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const activeWorldTheme = useAppStore((s) => s.activeWorldTheme)

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove(...THEMES.map((t) => `theme-${t.id}`))
    if (activeWorldTheme) html.classList.add(activeWorldTheme)
  }, [activeWorldTheme])

  return <>{children}</>
}

export function ThemePicker() {
  const { theme, setTheme } = useAppStore()

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        title="Change theme"
      >
        <Palette className="h-3.5 w-3.5" />
        <span>{THEMES.find((t) => t.id === theme)?.icon}</span>
      </button>

      {/* Dropdown on hover */}
      <div className="absolute right-0 top-full mt-1 z-[99999] hidden group-hover:block">
        <div className="flex flex-col gap-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 shadow-xl min-w-36">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors ${
                theme === t.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0 border border-white/20"
                style={{ background: t.swatch }}
              />
              <span>{t.icon} {t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
