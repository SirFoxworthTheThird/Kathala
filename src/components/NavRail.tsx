import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { navItems, type NavItem } from './navItems'
import { useReadingMode } from '@/db/hooks/useReading'

function RailLink({ item, worldId, expanded, dim }: {
  item: NavItem
  worldId: string
  expanded: boolean
  dim?: boolean
}) {
  const { to, label, icon: Icon, end } = item
  return (
    <NavLink
      to={`/worlds/${worldId}/${to}`}
      end={end}
      aria-label={label}
      title={expanded ? undefined : label}
      className={({ isActive }) =>
        cn(
          'mx-1.5 flex h-9 items-center gap-3 rounded-md px-2.5 transition-colors',
          isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : cn(
                'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                dim ? 'text-[hsl(var(--muted-foreground)/0.7)]' : 'text-[hsl(var(--muted-foreground))]'
              )
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={cn('truncate text-sm transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0')}>
        {label}
      </span>
    </NavLink>
  )
}

/**
 * Desktop left navigation rail. Collapsed to an icon-only rail by default; it
 * expands to show labels on hover, or stays expanded when pinned (persisted via
 * `navPinned`). Hidden below `lg`, where the top-bar hamburger drawer is used
 * instead. The reserved width is driven by the `data-nav-rail` CSS variable on
 * the AppShell root, so hover-expansion overlays the content rather than
 * reflowing it.
 */
export function NavRail() {
  const { worldId } = useParams<{ worldId: string }>()
  const navPinned = useAppStore((s) => s.navPinned)
  const setNavPinned = useAppStore((s) => s.setNavPinned)
  const [hovered, setHovered] = useState(false)
  const readingMode = useReadingMode(worldId ?? null)

  if (!worldId) return null
  const expanded = navPinned || hovered

  const visible = navItems.filter((n) => !(readingMode && n.writingOnly))
  const core = visible.filter((n) => n.tier === 'core')
  const extended = visible.filter((n) => n.tier === 'extended')

  return (
    <nav
      aria-label="Main navigation"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        // z above the fixed chapter-timeline bar (z-1000) so the expanded rail
        // overlays it, but below modals/panels (z-3000+).
        'fixed left-0 top-12 bottom-0 z-[1100] hidden flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-[width] duration-150 lg:flex',
        expanded ? 'w-52 shadow-xl' : 'w-[3.25rem]'
      )}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {core.map((item) => (
          <RailLink key={item.to} item={item} worldId={worldId} expanded={expanded} />
        ))}

        {/* Tier divider */}
        <div className="my-2 flex items-center px-2.5">
          <span className="h-px flex-1 bg-[hsl(var(--border))]" />
          <span className={cn('overflow-hidden text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground)/0.7)] transition-all duration-150', expanded ? 'ml-2 max-w-[6rem] opacity-100' : 'max-w-0 opacity-0')}>
            More
          </span>
        </div>

        {extended.map((item) => (
          <RailLink key={item.to} item={item} worldId={worldId} expanded={expanded} dim />
        ))}
      </div>

      {/* Pin toggle */}
      <div className="border-t border-[hsl(var(--border))] py-1.5">
        <button
          onClick={() => setNavPinned(!navPinned)}
          aria-label={navPinned ? 'Collapse navigation' : 'Pin navigation open'}
          aria-pressed={navPinned}
          title={navPinned ? 'Collapse navigation' : 'Pin navigation open'}
          className="mx-1.5 flex h-9 w-[calc(100%-0.75rem)] items-center gap-3 rounded-md px-2.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        >
          {navPinned
            ? <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className={cn('truncate text-sm transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0')}>
            {navPinned ? 'Collapse' : 'Pin open'}
          </span>
        </button>
      </div>
    </nav>
  )
}
