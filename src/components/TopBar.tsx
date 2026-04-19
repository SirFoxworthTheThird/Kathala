import { BookOpen, Map, Users, Network, LayoutDashboard, Package, Search, ScrollText, TableProperties, ShieldAlert, Settings } from 'lucide-react'
import faviconUrl from '/favicon.png'
import { useActiveWorldId, useAppStore } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import { ThemePicker } from './ThemePicker'
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
          className={({ isActive }) =>
            cn(
              'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
            )
          }
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
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
  const { setSearchOpen, setBriefOpen, setCheckerOpen } = useAppStore()

  return (
    <header className="relative flex h-12 shrink-0 items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
      {/* Left: brand + world name */}
      <div className="flex items-center gap-2">
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
            <span className="text-sm text-[hsl(var(--foreground))]">{world.name}</span>
          </>
        )}
      </div>

      {/* Center: nav icons — absolutely centered */}
      {world && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <NavIcons />
        </div>
      )}

      {/* Right: search + brief + theme */}
      <div className="ml-auto flex items-center gap-1">
        {world && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-block rounded border border-[hsl(var(--border))] px-1 py-0.5 text-[10px]">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            <div className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
            <button
              onClick={() => setBriefOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Brief</span>
            </button>
            <button
              onClick={() => setCheckerOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Continuity</span>
            </button>
          </>
        )}
        <ThemePicker />
      </div>
    </header>
  )
}
