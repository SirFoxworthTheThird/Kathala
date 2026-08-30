import { useEffect, useState, type RefObject } from 'react'
import { useSettingsFold } from './SettingsSection'
import { allCollapsed, collapseAll, expandAll } from '@/lib/settingsSections'

export interface SettingsSectionRef {
  id: string
  label: string
}

/**
 * The index across the top of World settings (**SET-2**).
 *
 * Settings is eleven sections in one unbroken scroll — world, reading mode,
 * theme, travel modes, continuity, manuscript, timelines, calendar, share,
 * database health, folder sync — with nothing to navigate by. Changing one
 * thing meant scrolling past everything else, and past the paragraph each
 * section carries explaining what it is for (**X-5**), which is the one screen
 * where that prose earns its place and the one screen where you meet all of it
 * at once.
 *
 * The index is read from the sections themselves rather than from a list kept
 * beside them. Several of them are conditional — the world block is hidden in
 * reading mode, everything from Travel Modes down is writing-only, and sync
 * only renders once its data exists — so a hand-maintained list would
 * eventually offer a chip that scrolls nowhere. A `MutationObserver` keeps it
 * honest as sections come and go.
 *
 * (Calendar was named here as conditional too, and is not: `CalendarEditor`
 * always renders, carrying an *Enable calendar* button when the world has
 * none. Corrected while fixing **CAL-2**, which needed to know.)
 */
export function useSettingsSections(containerRef: RefObject<HTMLElement | null>): SettingsSectionRef[] {
  const [sections, setSections] = useState<SettingsSectionRef[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function read() {
      const found = Array.from(el!.querySelectorAll<HTMLElement>('[data-settings-section]'))
        .map((s) => ({ id: s.id, label: s.dataset.settingsSection ?? '' }))
        .filter((s) => s.id && s.label)
      // Only replace on a real change: the observer watches the container this
      // runs inside, so setting state unconditionally would loop.
      setSections((prev) =>
        prev.length === found.length && prev.every((p, i) => p.id === found[i].id && p.label === found[i].label)
          ? prev
          : found,
      )
    }

    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [containerRef])

  return sections
}

export function SettingsIndex({ sections }: { sections: SettingsSectionRef[] }) {
  const { collapsed, setCollapsed, reveal } = useSettingsFold()
  const ids = sections.map((s) => s.id)
  const folded = allCollapsed(collapsed, ids)

  // One section is not a list, and two barely are — below that the index costs
  // more than the scrolling it saves. The reachable case today is zero: the
  // sections are read from the DOM in an effect, so the first paint has none,
  // and rendering an empty bar there would flash chrome with nothing in it.
  // Reading mode used to be the two-section case, and is three since Pictures
  // joined the reader's own decisions.
  if (sections.length < 3) return null

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-0 z-10 -mx-6 mb-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-6 py-2 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-1.5">
      <ul className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                // The app is on a hash router, so a bare fragment link would be
                // read as a route. Scroll it ourselves and leave the URL alone.
                e.preventDefault()
                // A chip that scrolled to a folded heading would look broken.
                reveal(s.id)
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="inline-flex rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring)/0.5)] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
      {/*
        HB-9 asked for collapsible sections. They are — each heading folds its
        own — but folding eleven one at a time is not the thing anyone wants,
        and defaulting the page to shut is not available: several reading-mode
        tests check a section is *gone*, and a shut one would satisfy them.
        This is the one press that turns the page into a menu.
      */}
      <button
        type="button"
        onClick={() => setCollapsed(folded ? expandAll(collapsed, ids) : collapseAll(collapsed, ids))}
        className="ml-auto inline-flex rounded-full px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
      >
        {folded ? 'Expand all' : 'Collapse all'}
      </button>
      </div>
    </nav>
  )
}
