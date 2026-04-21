import { BookOpen, Map, Users, Network, LayoutDashboard, Package, Search, ScrollText, TableProperties, ShieldAlert, Settings, HelpCircle, BookMarked, Shield } from 'lucide-react'
import faviconUrl from '/favicon.png'
import { useActiveWorldId, useAppStore } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import { useNavigate, NavLink, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'maps', label: 'Maps', icon: Map, end: false },
  { to: 'characters', label: 'Characters', icon: Users, end: false },
  { to: 'items', label: 'Items', icon: Package, end: false },
  { to: 'relationships', label: 'Relations', icon: Network, end: false },
  { to: 'timeline', label: 'Timeline', icon: BookOpen, end: false },
  { to: 'arc', label: 'Arc', icon: TableProperties, end: false },
  { to: 'lore', label: 'Lore', icon: BookMarked, end: false },
  { to: 'factions', label: 'Factions', icon: Shield, end: false },
  { to: 'settings', label: 'Settings', icon: Settings, end: false },
]

function NavIcons() {
  const { worldId } = useParams<{ worldId: string }>()
  if (!worldId) return null

  return (
    <nav className="flex items-center gap-0.5">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={`/worlds/${worldId}/${to}`}
          end={end}
          title={label}
          className={({ isActive }) =>
            cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              isActive
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
            )
          }
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </NavLink>
      ))}
    </nav>
  )
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

export function TopBar() {
  const worldId = useActiveWorldId()
  const world = useWorld(worldId)
  const navigate = useNavigate()
  const { setSearchOpen, setBriefOpen, setCheckerOpen, setHelpOpen } = useAppStore()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
      {/* Left: brand + world name */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src={faviconUrl} alt="PlotWeave" className="h-7 w-7 rounded object-cover" />
          <span className="text-sm font-bold tracking-wide text-[hsl(var(--foreground))]">
            PlotWeave
          </span>
        </button>
        {world && (
          <>
            <span className="text-[hsl(var(--muted-foreground))]">/</span>
            <span className="max-w-[120px] truncate text-sm text-[hsl(var(--foreground))]">{world.name}</span>
          </>
        )}
      </div>

      {/* Center: nav icons */}
      {world && (
        <div className="flex flex-1 justify-center">
          <NavIcons />
        </div>
      )}

      {/* Right: search + brief + continuity + help */}
      <div className="flex shrink-0 items-center gap-1">
        {world && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              title={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
              className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <kbd className="rounded border border-[hsl(var(--border))] px-1 py-0.5 text-[10px]">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            <div className="mx-0.5 h-5 w-px bg-[hsl(var(--border))]" />
            <button
              onClick={() => setBriefOpen(true)}
              title="Writer's Brief"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <ScrollText className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCheckerOpen(true)}
              title="Continuity Checker"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <div className="mx-0.5 h-5 w-px bg-[hsl(var(--border))]" />
        <button
          onClick={() => setHelpOpen(true)}
          title="Help"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  )
}
