import { useEffect, useState } from 'react'
import { Search, ScrollText, ShieldAlert, HelpCircle, Menu, X } from 'lucide-react'
import faviconUrl from '/favicon.png'
import { useActiveWorldId, useAppStore } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import { useNavigate, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { TimeCursor } from './TimeCursor'
import { navItems } from './navItems'

/**
 * Full-height slide-in navigation for narrow screens. The desktop icon rail
 * (NavIcons) and the top-bar tool buttons don't fit on a phone, so below the
 * `lg` breakpoint they collapse behind a hamburger that opens this drawer with
 * labelled destinations plus the panel tools.
 */
function MobileNavDrawer({ worldId, open, onClose }: { worldId: string; open: boolean; onClose: () => void }) {
  const world = useWorld(worldId)
  const { setBriefOpen, setCheckerOpen, setHelpOpen } = useAppStore()

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const tools: { label: string; icon: typeof ScrollText; action: () => void }[] = [
    { label: "Writer's Brief", icon: ScrollText, action: () => setBriefOpen(true) },
    { label: 'Continuity Checker', icon: ShieldAlert, action: () => setCheckerOpen(true) },
    { label: 'Help', icon: HelpCircle, action: () => setHelpOpen(true) },
  ]

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
      isActive
        ? 'bg-[hsl(var(--accent))] font-medium text-[hsl(var(--foreground))]'
        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
    )

  return (
    <div className="fixed inset-0 z-[2000] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="pw-anim-fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <nav className="pw-anim-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-4">
          <img src={faviconUrl} alt="" className="h-7 w-7 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold tracking-wide text-[hsl(var(--foreground))]">PlotWeave</div>
            {world && <div className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={world.name}>{world.name}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={`/worlds/${worldId}/${to}`} end={end} onClick={onClose} className={itemClass}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}

          <div className="my-1 border-t border-[hsl(var(--border))]" />

          {tools.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              onClick={() => { action(); onClose() }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

export function TopBar() {
  const worldId = useActiveWorldId()
  const world = useWorld(worldId)
  const navigate = useNavigate()
  const { setSearchOpen, setBriefOpen, setCheckerOpen, setHelpOpen } = useAppStore()
  const [navOpen, setNavOpen] = useState(false)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 sm:px-4">
      {/* Left: menu (mobile) + brand + world name + time cursor */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {world && (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            className="pw-tap flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          aria-label="Go to world list"
          className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src={faviconUrl} alt="" className="h-7 w-7 rounded object-cover" />
          <span className="hidden text-sm font-bold tracking-wide text-[hsl(var(--foreground))] lg:inline">
            PlotWeave
          </span>
        </button>
        {world && (
          <>
            <span aria-hidden="true" className="hidden text-[hsl(var(--muted-foreground))] lg:inline">/</span>
            <span className="hidden max-w-[120px] truncate text-sm text-[hsl(var(--foreground))] lg:inline" title={world.name}>{world.name}</span>
          </>
        )}
        {world && worldId && (
          <>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-[hsl(var(--border))]" />
            <TimeCursor worldId={worldId} />
          </>
        )}
      </div>

      {/* Right: search + brief + continuity + help */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {world && (
          <>
            {/* Compact search (mobile) */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="pw-tap flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:hidden"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* Full search (desktop) */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
              title={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
              className="hidden h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <kbd className="rounded border border-[hsl(var(--border))] px-1 py-0.5 text-[10px]" aria-hidden="true">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            <div className="mx-0.5 hidden h-5 w-px bg-[hsl(var(--border))] lg:block" aria-hidden="true" />
            <button
              onClick={() => setBriefOpen(true)}
              aria-label="Writer's Brief"
              title="Writer's Brief"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
            >
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCheckerOpen(true)}
              aria-label="Continuity Checker"
              title="Continuity Checker"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
        <div className="mx-0.5 hidden h-5 w-px bg-[hsl(var(--border))] lg:block" aria-hidden="true" />
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          title="Help"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors lg:flex"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {world && worldId && <MobileNavDrawer worldId={worldId} open={navOpen} onClose={() => setNavOpen(false)} />}
    </header>
  )
}
