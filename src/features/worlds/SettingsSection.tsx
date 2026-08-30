import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  SETTINGS_COLLAPSED_KEY, parseCollapsed, serialiseCollapsed,
  isSectionOpen, toggleSection,
} from '@/lib/settingsSections'

interface SettingsFoldState {
  collapsed: string[]
  setCollapsed: (next: string[]) => void
  toggle: (id: string) => void
  /** Open a section without closing anything — what a jump link needs. */
  reveal: (id: string) => void
}

const FoldContext = createContext<SettingsFoldState | null>(null)

/**
 * The open/closed state of every World settings section, shared so that the
 * index across the top can open a section it is scrolling to and offer
 * *Collapse all*.
 *
 * Kept in `localStorage` rather than in the Zustand store: it is a per-device
 * view preference with no bearing on the world, and the store's persisted slice
 * is a deliberately short list.
 */
export function SettingsFoldProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<string[]>(
    () => parseCollapsed(typeof localStorage === 'undefined' ? null : localStorage.getItem(SETTINGS_COLLAPSED_KEY)),
  )

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_COLLAPSED_KEY, serialiseCollapsed(collapsed))
    } catch {
      // A full or blocked store must not take the settings screen down with it.
    }
  }, [collapsed])

  const value = useMemo<SettingsFoldState>(() => ({
    collapsed,
    setCollapsed: setCollapsedState,
    toggle: (id) => setCollapsedState((c) => toggleSection(c, id)),
    reveal: (id) => setCollapsedState((c) => c.filter((x) => x !== id)),
  }), [collapsed])

  return <FoldContext.Provider value={value}>{children}</FoldContext.Provider>
}

export function useSettingsFold(): SettingsFoldState {
  const ctx = useContext(FoldContext)
  if (!ctx) throw new Error('useSettingsFold must be used inside SettingsFoldProvider')
  return ctx
}

/**
 * One section of World settings, with its heading as the control that folds it.
 *
 * The `<section>` itself always renders, carrying `id` and
 * `data-settings-section` whether it is open or shut — the index reads those
 * from the DOM, so folding a section away by removing it would take its chip
 * with it and leave the page with a shorter index the more you tidied.
 *
 * The blurb folds with the body. It is the section's explanation of itself
 * (**X-5**), which is exactly the prose someone collapsing the page is trying
 * to get out of the way.
 */
export function SettingsSection({
  id, label, blurb, children,
}: {
  id: string
  label: string
  blurb?: ReactNode
  children: ReactNode
}) {
  const { collapsed, toggle } = useSettingsFold()
  const open = isSectionOpen(collapsed, id)

  return (
    <section id={id} data-settings-section={label} className="scroll-mt-16 space-y-4">
      <div>
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={open}
          className="group flex w-full items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--foreground))]">
            {label}
          </h2>
        </button>
        {open && blurb && (
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{blurb}</p>
        )}
      </div>
      {open && children}
    </section>
  )
}
